/**
 * Studio Office Pro - Microsoft Word Pro Editor Engine
 * Full WYSIWYG editing, Mammoth DOCX import, OpenXML DOCX export, safe Find & Replace.
 */

document.addEventListener('DOMContentLoaded', () => {
  const editor = document.getElementById('wordEditor');
  const docTitleInput = document.getElementById('wordDocTitle');
  const fileInput = document.getElementById('wordFileInput');
  const imageInput = document.getElementById('wordImageInput');
  const wordCountStat = document.getElementById('wordCountStat');
  const charCountStat = document.getElementById('charCountStat');
  const readingTimeStat = document.getElementById('readingTimeStat');
  const saveStateEl = document.getElementById('wordSaveState');

  // Find & Replace Elements
  const findBar = document.getElementById('findReplaceBar');
  const findInput = document.getElementById('findInputText');
  const replaceInput = document.getElementById('replaceInputText');

  if (!editor) return;

  // 1. Statistics Calculation (Optimized with debounce for smooth performance on Windows 7)
  let statsRafId = null;
  function updateStats(immediate = false) {
    const doCalc = () => {
      const text = editor.innerText || '';
      const cleanText = text.trim();
      const words = cleanText ? cleanText.split(/\s+/).length : 0;
      const chars = text.length;
      const readingTime = Math.max(1, Math.ceil(words / 180));
      const heightPages = editor.scrollHeight > 1120 ? Math.ceil(editor.scrollHeight / 1056) : 1;
      const pages = Math.max(1, Math.ceil(words / 250), heightPages);

      editor.classList.toggle('has-multi-pages', pages > 1 || editor.scrollHeight > 1120);

      if (wordCountStat) wordCountStat.textContent = `${words.toLocaleString()} Kelime`;
      if (charCountStat) charCountStat.textContent = `${chars.toLocaleString()} Harf`;
      if (readingTimeStat) readingTimeStat.textContent = `~${readingTime} dk okuma (${pages} sayfa)`;

      const endMarkerWords = document.getElementById('mobileDocEndWords');
      if (endMarkerWords) endMarkerWords.textContent = `${words.toLocaleString()} Kelime`;

      const sheetWordCount = document.getElementById('sheetWordCount');
      if (sheetWordCount) sheetWordCount.textContent = words.toLocaleString();

      const sheetCharCount = document.getElementById('sheetCharCount');
      if (sheetCharCount) sheetCharCount.textContent = chars.toLocaleString();

      const sheetReadTime = document.getElementById('sheetReadTime');
      if (sheetReadTime) sheetReadTime.textContent = `${readingTime} dk`;
    };

    if (statsRafId) cancelAnimationFrame(statsRafId);
    if (immediate) {
      doCalc();
    } else {
      statsRafId = requestAnimationFrame(doCalc);
    }
  }

  // Robust Selection Preservation
  let savedWordSelection = null;
  function saveCurrentSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.anchorNode)) {
      savedWordSelection = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreCurrentSelection() {
    if (savedWordSelection) {
      editor.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedWordSelection);
    } else {
      editor.focus();
    }
  }

  const headerSaveStatus = document.getElementById('wordSaveStatus');

  // Auto-Save Draft with exact timestamp protection
  let autoSaveTimeout;
  editor.addEventListener('input', () => {
    updateStats();
    if (window.docManager) {
      const activeDoc = window.docManager.getActiveDoc();
      if (activeDoc && activeDoc.type === 'word') {
        activeDoc.isDirty = true;
        if (typeof window.updateDesktopWindowTitle === 'function') window.updateDesktopWindowTitle();
      }
    }
    if (saveStateEl) saveStateEl.textContent = 'Yazılıyor...';
    const endMarkerSave = document.getElementById('mobileDocEndSave');
    if (endMarkerSave) endMarkerSave.textContent = 'Yazılıyor...';
    const sheetSaveStatus = document.getElementById('sheetSaveStatus');
    if (sheetSaveStatus) sheetSaveStatus.textContent = '● Kaydediliyor...';
    if (headerSaveStatus) {
      headerSaveStatus.textContent = '● Kaydediliyor...';
      headerSaveStatus.classList.add('saving');
    }

    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
      try {
        localStorage.setItem('kalpten_kaleme_word_draft', editor.innerHTML);
        localStorage.setItem('kalpten_kaleme_word_title', docTitleInput.value);
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (saveStateEl) saveStateEl.textContent = `Otomatik korundu (${timeStr})`;
        if (endMarkerSave) endMarkerSave.textContent = `Otomatik korundu (${timeStr})`;
        if (sheetSaveStatus) sheetSaveStatus.textContent = `● Otomatik korundu (${timeStr})`;
        if (headerSaveStatus) {
          headerSaveStatus.textContent = `● Korundu (${timeStr})`;
          headerSaveStatus.classList.remove('saving');
        }
      } catch (err) {}
    }, 800);

    schedulePhysicalAutoSave();
  });

  // Physical Disk / Device Auto-Save (2.5s debounce)
  let physicalAutoSaveTimeout;
  function schedulePhysicalAutoSave() {
    clearTimeout(physicalAutoSaveTimeout);
    physicalAutoSaveTimeout = setTimeout(async () => {
      try {
        const text = editor ? editor.innerText.trim() : '';
        if (!text || text.length < 5) return;
        let title = (docTitleInput?.value || 'Yeni Yazı').trim();
        if (!title.toLowerCase().endsWith('.docx')) title += '.docx';

        // Protect existing files on disk: if this is an untitled default document and the name already exists on disk, auto-assign a unique title
        const activeDoc = window.docManager ? window.docManager.getActiveDoc() : null;
        if (activeDoc && activeDoc.isDefault && typeof window.getKnownCloudFileNames === 'function') {
          const knownFiles = window.getKnownCloudFileNames();
          if (knownFiles.includes(title.toLowerCase())) {
            title = window.docManager.getUniqueWordTitle('Yeni Yazı');
            if (docTitleInput) docTitleInput.value = title;
          }
          window.docManager.updateActiveDocTitle(title);
        }

        const blob = await buildOpenXmlDocxBlob(title, editor.innerHTML);
        if (window.kalptenVault) {
          window.kalptenVault.saveFile(title, blob, 'docx').catch(() => {});
        }
        if (window.addRecentDocument) {
          window.addRecentDocument(title, 'word');
        }

        // If user opened a specific local file on desktop server, update that exact path in place
        let autoSavedToBoundPath = false;
        if (typeof isOnlineServer !== 'undefined' && isOnlineServer && activeDoc && activeDoc.filePath) {
          try {
            const pResp = await fetch('/api/save-to-path?path=' + encodeURIComponent(activeDoc.filePath), {
              method: 'POST',
              body: blob
            });
            if (pResp.ok) {
              const pData = await pResp.json();
              if (pData && pData.success) {
                autoSavedToBoundPath = true;
                activeDoc.isDirty = false;
                if (typeof window.updateDesktopWindowTitle === 'function') window.updateDesktopWindowTitle();
                const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                if (headerSaveStatus) {
                  headerSaveStatus.textContent = `💾 Dosyaya korundu (${timeStr})`;
                  headerSaveStatus.classList.remove('saving');
                }
              }
            }
          } catch (_) {}
        }

        // 1. Desktop Server Mode (default sync folder when no explicit disk path is bound)
        if (!autoSavedToBoundPath && typeof isOnlineServer !== 'undefined' && isOnlineServer) {
          const resp = await fetch('/api/save-document?filename=' + encodeURIComponent(title), {
            method: 'POST',
            body: blob
          });
          if (resp.ok) {
            const resData = await resp.json();
            const timeStr = resData.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            if (headerSaveStatus) {
              if (resData.cloudProvider === 'gdrive' || resData.isGoogleDrive) {
                headerSaveStatus.textContent = `☁️ Drive'a korundu (${timeStr})`;
              } else if (resData.cloudProvider === 'onedrive') {
                headerSaveStatus.textContent = `☁️ OneDrive'a korundu (${timeStr})`;
              } else {
                headerSaveStatus.textContent = `💾 Diske korundu (${timeStr})`;
              }
              headerSaveStatus.classList.remove('saving');
            }
          }
        }
        // 2. Android Native Bridge Mode
        else if (window.AndroidBridge && window.AndroidBridge.saveBase64File) {
          const reader = new FileReader();
          reader.onloadend = function() {
            try {
              const base64data = reader.result.split(',')[1];
              window.AndroidBridge.saveBase64File(title, base64data, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
              const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
              if (headerSaveStatus) {
                headerSaveStatus.textContent = `📱 Cihaza korundu (${timeStr})`;
                headerSaveStatus.classList.remove('saving');
              }
            } catch (_) {}
          };
          reader.readAsDataURL(blob);
        }
        // 3. Web Client Storage Mode (Auto-Draft in localStorage)
        else {
          try {
            localStorage.setItem('kk_web_draft_word', editor.innerHTML);
            localStorage.setItem('kk_web_draft_title', title);
            const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            if (headerSaveStatus) {
              headerSaveStatus.textContent = `🌐 Tarayıcıya korundu (${timeStr})`;
              headerSaveStatus.classList.remove('saving');
            }
          } catch (_) {}
        }
      } catch (_) {}
    }, 2500);
  }

  // ==========================================================================
  // Gerçek Standart OpenXML (.docx) Üretici & Okuyucu Motoru (100% Native Word)
  // ==========================================================================
  function xmlEsc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function cssColorToHex6(colorStr) {
    if (!colorStr) return null;
    const c = String(colorStr).trim().toLowerCase();
    if (!c || c === 'transparent' || c === 'inherit' || c === 'initial' || c === 'rgba(0, 0, 0, 0)') return null;
    if (c.startsWith('#')) {
      const hex = c.slice(1).replace(/[^0-9a-f]/gi, '');
      if (hex.length === 3) {
        return (hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]).toUpperCase();
      }
      if (hex.length >= 6) return hex.slice(0, 6).toUpperCase();
    }
    const rgbMatch = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (rgbMatch) {
      const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
      const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
      const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
      return [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
    }
    return null;
  }

  function parseFontSizeHalfPoints(sizeStr) {
    if (!sizeStr) return null;
    const s = String(sizeStr).trim().toLowerCase();
    const num = parseFloat(s);
    if (isNaN(num) || num <= 0) return null;
    if (s.endsWith('pt')) return Math.round(num * 2);
    if (s.endsWith('px')) return Math.round(num * 0.75 * 2);
    return Math.round(num * 2);
  }

  function cleanFontName(fontStr) {
    if (!fontStr) return null;
    const first = String(fontStr).split(',')[0].replace(/['"]/g, '').trim();
    if (!first || first === 'serif' || first === 'sans-serif' || first === 'monospace') return null;
    return first;
  }

  async function buildOpenXmlDocxBlob(title, innerHtml) {
    if (!window.JSZip) {
      return buildWordBlobFallback(title, innerHtml);
    }

    try {
      const zip = new window.JSZip();
      const isLandscape = editor.classList.contains('orientation-landscape');
      const marginMode = editor.classList.contains('margin-narrow')
        ? 'narrow'
        : (editor.classList.contains('margin-wide') ? 'wide' : 'normal');
      const defaultFont = cleanFontName(editor.style.fontFamily) || 'Georgia';
      const defaultPt = parseInt(document.getElementById('fontSizeInput')?.value, 10) || 12;
      const defaultHalfPt = defaultPt * 2;
      const defaultLineHeight = parseFloat(editor.style.lineHeight) || 1.5;

      const rels = [
        { id: 'rIdStyles', type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', target: 'styles.xml' }
      ];
      let nextRelIdx = 1;
      let nextDrawingId = 1;

      const liveImgDims = new Map();
      editor.querySelectorAll('img').forEach(imgEl => {
        const s = imgEl.getAttribute('src');
        if (s && (imgEl.naturalWidth > 0 && imgEl.naturalHeight > 0)) {
          liveImgDims.set(s, { nw: imgEl.naturalWidth, nh: imgEl.naturalHeight });
        }
      });

      const tempRoot = document.createElement('div');
      tempRoot.innerHTML = innerHtml || '<p></p>';

      function buildRunPropsXml(ctx) {
        let rPr = '';
        const fName = ctx.fontFamily || defaultFont;
        if (fName) {
          const escF = xmlEsc(fName);
          rPr += `<w:rFonts w:ascii="${escF}" w:hAnsi="${escF}" w:cs="${escF}"/>`;
        }
        if (ctx.bold) rPr += '<w:b/><w:bCs/>';
        if (ctx.italic) rPr += '<w:i/><w:iCs/>';
        if (ctx.underline) rPr += '<w:u w:val="single"/>';
        if (ctx.strike) rPr += '<w:strike/>';
        if (ctx.vertAlign) rPr += `<w:vertAlign w:val="${ctx.vertAlign}"/>`;
        if (ctx.color) rPr += `<w:color w:val="${ctx.color}"/>`;
        if (ctx.bgColor) rPr += `<w:shd w:val="clear" w:color="auto" w:fill="${ctx.bgColor}"/>`;
        const sz = ctx.halfPt || defaultHalfPt;
        if (sz) rPr += `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;
        rPr += '<w:lang w:val="tr-TR"/>';
        return `<w:rPr>${rPr}</w:rPr>`;
      }

      function serializeInlineNodes(nodes, inheritedCtx) {
        let xml = '';
        for (const node of Array.from(nodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            const txt = node.nodeValue || '';
            if (txt.length > 0) {
              xml += `<w:r>${buildRunPropsXml(inheritedCtx)}<w:t xml:space="preserve">${xmlEsc(txt)}</w:t></w:r>`;
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toUpperCase();
            if (tag === 'BR') {
              xml += `<w:r>${buildRunPropsXml(inheritedCtx)}<w:br/></w:r>`;
              continue;
            }
            if (tag === 'IMG') {
              const src = node.getAttribute('src') || '';
              const dataMatch = src.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/i);
              if (dataMatch) {
                let ext = dataMatch[1].toLowerCase();
                if (ext === 'jpeg') ext = 'jpg';
                const b64 = dataMatch[2];
                const imgIdx = nextRelIdx++;
                const relId = `rIdImg${imgIdx}`;
                const mediaName = `image${imgIdx}.${ext}`;
                zip.file(`word/media/${mediaName}`, b64, { base64: true });
                rels.push({
                  id: relId,
                  type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
                  target: `media/${mediaName}`
                });

                const maxDocPxW = isLandscape ? 800 : 580;
                const rawW = String((node.style && node.style.width) || node.getAttribute('width') || '').trim().toLowerCase();
                const dims = (node.naturalWidth > 0 && node.naturalHeight > 0)
                  ? { nw: node.naturalWidth, nh: node.naturalHeight }
                  : (liveImgDims.get(src) || null);

                let pxW = 420;
                if (rawW.endsWith('%')) {
                  const pct = parseFloat(rawW);
                  if (!isNaN(pct) && pct > 0) {
                    pxW = Math.max(48, Math.round(maxDocPxW * Math.min(100, pct) / 100));
                  }
                } else if (rawW) {
                  const wNum = parseFloat(rawW);
                  if (!isNaN(wNum) && wNum > 20) {
                    pxW = Math.min(maxDocPxW, Math.round(wNum));
                  } else if (dims && dims.nw > 0) {
                    pxW = Math.min(maxDocPxW, dims.nw);
                  }
                } else if (dims && dims.nw > 0) {
                  pxW = Math.min(maxDocPxW, dims.nw);
                }

                const rawH = String((node.style && node.style.height) || node.getAttribute('height') || '').trim().toLowerCase();
                let pxH = 0;
                if (rawH && rawH !== 'auto' && !rawH.endsWith('%')) {
                  const hNum = parseFloat(rawH);
                  if (!isNaN(hNum) && hNum > 16) pxH = Math.round(hNum);
                }
                if (!pxH) {
                  const aspect = (dims && dims.nw > 0 && dims.nh > 0) ? (dims.nh / dims.nw) : 0.68;
                  pxH = Math.max(16, Math.round(pxW * aspect));
                }

                const cx = pxW * 9525;
                const cy = pxH * 9525;
                const docPrId = nextDrawingId++;
                xml += `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${docPrId}" name="Resim ${docPrId}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name="${mediaName}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
              }
              continue;
            }

            const nextCtx = Object.assign({}, inheritedCtx);
            if (tag === 'B' || tag === 'STRONG') nextCtx.bold = true;
            if (tag === 'I' || tag === 'EM') nextCtx.italic = true;
            if (tag === 'U') nextCtx.underline = true;
            if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') nextCtx.strike = true;
            if (tag === 'SUB') nextCtx.vertAlign = 'subscript';
            if (tag === 'SUP') nextCtx.vertAlign = 'superscript';

            if (node.style) {
              const fw = node.style.fontWeight;
              if (fw === 'bold' || parseInt(fw, 10) >= 600) nextCtx.bold = true;
              if (node.style.fontStyle === 'italic') nextCtx.italic = true;
              const td = (node.style.textDecoration || node.style.textDecorationLine || '').toLowerCase();
              if (td.includes('underline')) nextCtx.underline = true;
              if (td.includes('line-through')) nextCtx.strike = true;
              const col = cssColorToHex6(node.style.color);
              if (col) nextCtx.color = col;
              const bg = cssColorToHex6(node.style.backgroundColor);
              if (bg) nextCtx.bgColor = bg;
              const hp = parseFontSizeHalfPoints(node.style.fontSize);
              if (hp) nextCtx.halfPt = hp;
              const ff = cleanFontName(node.style.fontFamily);
              if (ff) nextCtx.fontFamily = ff;
            }
            if (tag === 'FONT') {
              const fCol = cssColorToHex6(node.getAttribute('color'));
              if (fCol) nextCtx.color = fCol;
              const fFace = cleanFontName(node.getAttribute('face'));
              if (fFace) nextCtx.fontFamily = fFace;
            }

            if (tag === 'A') {
              const href = node.getAttribute('href') || '';
              nextCtx.color = nextCtx.color || '0072DE';
              nextCtx.underline = true;
              if (href && /^https?:\/\//i.test(href)) {
                const relId = `rIdLink${nextRelIdx++}`;
                rels.push({
                  id: relId,
                  type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
                  target: href,
                  external: true
                });
                xml += `<w:hyperlink r:id="${relId}">${serializeInlineNodes(node.childNodes, nextCtx)}</w:hyperlink>`;
                continue;
              }
            }

            xml += serializeInlineNodes(node.childNodes, nextCtx);
          }
        }
        return xml;
      }

      function buildParagraphXml(el, extraOpts = {}) {
        const tag = el.tagName ? el.tagName.toUpperCase() : 'P';
        if (el.style && el.style.pageBreakAfter === 'always') {
          return `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
        }

        let pPr = '';
        const ctx = {
          bold: Boolean(extraOpts.bold),
          italic: Boolean(extraOpts.italic),
          underline: false,
          strike: false,
          vertAlign: null,
          color: extraOpts.color || null,
          bgColor: null,
          halfPt: extraOpts.halfPt || defaultHalfPt,
          fontFamily: defaultFont
        };

        if (tag === 'H1') {
          pPr += '<w:pStyle w:val="Heading1"/>';
          ctx.bold = true;
          ctx.halfPt = 44; // 22pt
          ctx.color = '0F172A';
        } else if (tag === 'H2') {
          pPr += '<w:pStyle w:val="Heading2"/>';
          ctx.bold = true;
          ctx.halfPt = 32; // 16pt
          ctx.color = '1E293B';
        } else if (tag === 'H3') {
          pPr += '<w:pStyle w:val="Heading3"/>';
          ctx.bold = true;
          ctx.halfPt = 26; // 13pt
        } else if (tag === 'BLOCKQUOTE') {
          pPr += '<w:pBdr><w:left w:val="single" w:sz="18" w:space="12" w:color="0072DE"/></w:pBdr>';
          ctx.italic = true;
          ctx.color = '475569';
        }

        // Alignment
        let align = (el.style?.textAlign || el.getAttribute?.('align') || '').toLowerCase();
        if (!align && el.querySelector) {
          const blockImg = el.querySelector('img');
          if (blockImg && blockImg.style) {
            const ml = (blockImg.style.marginLeft || '').toLowerCase();
            const mr = (blockImg.style.marginRight || '').toLowerCase();
            if (ml === 'auto' && mr === 'auto') align = 'center';
            else if (ml === 'auto' && (mr === '0' || mr === '0px')) align = 'right';
          }
        }
        if (align === 'center') pPr += '<w:jc w:val="center"/>';
        else if (align === 'right') pPr += '<w:jc w:val="right"/>';
        else if (align === 'justify') pPr += '<w:jc w:val="both"/>';

        // Indentation
        let leftTwips = extraOpts.leftTwips || (tag === 'BLOCKQUOTE' ? 480 : 0);
        if (el.style?.marginLeft || el.style?.paddingLeft) {
          const px = parseFloat(el.style.marginLeft || el.style.paddingLeft);
          if (!isNaN(px) && px > 0) leftTwips += Math.round(px * 15);
        }
        if (leftTwips > 0 || extraOpts.hangingTwips) {
          pPr += `<w:ind w:left="${leftTwips}"${extraOpts.hangingTwips ? ` w:hanging="${extraOpts.hangingTwips}"` : ''}/>`;
        }

        // Line spacing
        const lh = parseFloat(el.style?.lineHeight) || defaultLineHeight;
        const lineVal = Math.round(lh * 240);
        pPr += `<w:spacing w:after="${extraOpts.afterTwips !== undefined ? extraOpts.afterTwips : 160}" w:line="${lineVal}" w:lineRule="auto"/>`;

        if (el.style) {
          const elCol = cssColorToHex6(el.style.color);
          if (elCol) ctx.color = elCol;
          const elHp = parseFontSizeHalfPoints(el.style.fontSize);
          if (elHp) ctx.halfPt = elHp;
          const elFf = cleanFontName(el.style.fontFamily);
          if (elFf) ctx.fontFamily = elFf;
        }

        let runsXml = '';
        if (extraOpts.listPrefix) {
          runsXml += `<w:r>${buildRunPropsXml(ctx)}<w:t xml:space="preserve">${xmlEsc(extraOpts.listPrefix)}</w:t></w:r>`;
        }
        runsXml += serializeInlineNodes(el.childNodes, ctx);
        return `<w:p><w:pPr>${pPr}</w:pPr>${runsXml}</w:p>`;
      }

      function buildTableXml(tableEl) {
        const rows = Array.from(tableEl.querySelectorAll('tr'));
        if (rows.length === 0) return '';
        let tblXml = `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/></w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr>`;

        for (const tr of rows) {
          const cells = Array.from(tr.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
          if (cells.length === 0) continue;
          tblXml += '<w:tr>';
          const colPct = Math.floor(5000 / cells.length);
          for (const cell of cells) {
            const isHeader = cell.tagName === 'TH' || tr.parentElement?.tagName === 'THEAD';
            const bgHex = cssColorToHex6(cell.style?.backgroundColor) || (isHeader ? 'F1F5F9' : null);
            let tcPr = `<w:tcW w:w="${colPct}" w:type="pct"/>`;
            const colspan = parseInt(cell.getAttribute('colspan'), 10);
            if (!isNaN(colspan) && colspan > 1) tcPr += `<w:gridSpan w:val="${colspan}"/>`;
            if (bgHex) tcPr += `<w:shd w:val="clear" w:color="auto" w:fill="${bgHex}"/>`;
            const cellParagraph = buildParagraphXml(cell, { bold: isHeader, afterTwips: 60 });
            tblXml += `<w:tc><w:tcPr>${tcPr}</w:tcPr>${cellParagraph}</w:tc>`;
          }
          tblXml += '</w:tr>';
        }
        tblXml += '</w:tbl>';
        return tblXml;
      }

      function serializeBlockNodes(nodes) {
        let bodyXml = '';
        for (const node of Array.from(nodes)) {
          if (node.nodeType === Node.TEXT_NODE) {
            const t = node.nodeValue || '';
            if (t.trim().length > 0) {
              const p = document.createElement('p');
              p.textContent = t;
              bodyXml += buildParagraphXml(p);
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toUpperCase();
            if (tag === 'TABLE') {
              bodyXml += buildTableXml(node);
            } else if (tag === 'UL' || tag === 'OL') {
              const items = Array.from(node.children).filter(c => c.tagName === 'LI');
              items.forEach((li, idx) => {
                const prefix = tag === 'OL' ? `${idx + 1}. ` : '• ';
                bodyXml += buildParagraphXml(li, { listPrefix: prefix, leftTwips: 720, hangingTwips: 360, afterTwips: 80 });
              });
            } else if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI'].includes(tag)) {
              bodyXml += buildParagraphXml(node);
            } else if (tag === 'DIV') {
              if (node.style && node.style.pageBreakAfter === 'always') {
                bodyXml += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
              } else if (node.querySelector('p, h1, h2, h3, ul, ol, table, blockquote')) {
                bodyXml += serializeBlockNodes(node.childNodes);
              } else {
                bodyXml += buildParagraphXml(node);
              }
            } else {
              const p = document.createElement('p');
              p.appendChild(node.cloneNode(true));
              bodyXml += buildParagraphXml(p);
            }
          }
        }
        return bodyXml;
      }

      let bodyContentXml = serializeBlockNodes(tempRoot.childNodes);
      if (!bodyContentXml.trim()) {
        bodyContentXml = '<w:p/>';
      }

      const marginTwips = marginMode === 'narrow' ? 720 : (marginMode === 'wide' ? 2160 : 1440);
      const pgW = isLandscape ? 16838 : 11906;
      const pgH = isLandscape ? 11906 : 16838;
      const orientAttr = isLandscape ? ' w:orient="landscape"' : '';

      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${bodyContentXml}
    <w:sectPr>
      <w:pgSz w:w="${pgW}" w:h="${pgH}"${orientAttr}/>
      <w:pgMar w:top="${marginTwips}" w:right="${marginTwips}" w:bottom="${marginTwips}" w:left="${marginTwips}" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

      const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="${xmlEsc(defaultFont)}" w:hAnsi="${xmlEsc(defaultFont)}" w:cs="${xmlEsc(defaultFont)}"/>
        <w:sz w:val="${defaultHalfPt}"/>
        <w:szCs w:val="${defaultHalfPt}"/>
        <w:lang w:val="tr-TR"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
  </w:style>
</w:styles>`;

      const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels.map(r => `<Relationship Id="${r.id}" Type="${r.type}" Target="${xmlEsc(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`).join('\n  ')}
</Relationships>`;

      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Default Extension="webp" ContentType="image/webp"/>
  <Default Extension="html" ContentType="text/html"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

      zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);

      const isoNow = new Date().toISOString();
      zip.file('docProps/core.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlEsc(String(title || '').replace(/\.docx$/i, ''))}</dc:title>
  <dc:creator>Kalpten Kaleme</dc:creator>
  <cp:lastModifiedBy>Kalpten Kaleme</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${isoNow}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${isoNow}</dcterms:modified>
</cp:coreProperties>`);

      zip.file('docProps/app.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Kalpten Kaleme Office Studio</Application>
</Properties>`);

      zip.file('word/document.xml', documentXml);
      zip.file('word/styles.xml', stylesXml);
      zip.file('word/_rels/document.xml.rels', docRelsXml);

      // Lossless Kalpten Kaleme HTML & Layout Snapshot for 100% round-trip editing fidelity
      const metaHeader = `<!--KALPTEN_META:${JSON.stringify({
        orientation: isLandscape ? 'landscape' : 'portrait',
        margins: marginMode,
        fontFamily: editor.style.fontFamily || '',
        fontSize: editor.style.fontSize || '',
        lineHeight: editor.style.lineHeight || ''
      })}-->`;
      zip.file('word/kalpten_content.html', metaHeader + (innerHtml || ''));

      return await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
    } catch (err) {
      console.warn('OpenXML builder fallback:', err);
      return buildWordBlobFallback(title, innerHtml);
    }
  }

  function buildWordBlobFallback(title, innerHtml) {
    const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${innerHtml}</body></html>`;
    if (window.htmlDocx && typeof window.htmlDocx.asBlob === 'function') {
      return window.htmlDocx.asBlob(htmlContent, {
        orientation: editor.classList.contains('orientation-landscape') ? 'landscape' : 'portrait',
        margins: { top: 720, right: 720, bottom: 720, left: 720 }
      });
    }
    return new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
  }

  window.buildWordBlob = buildOpenXmlDocxBlob;

  // Restore draft if exists
  const savedDraft = localStorage.getItem('kalpten_kaleme_word_draft') || localStorage.getItem('studio_office_word_draft');
  const savedTitle = localStorage.getItem('kalpten_kaleme_word_title') || localStorage.getItem('studio_office_word_title');
  const isDummy = savedDraft && (savedDraft.includes('Gönülden dökülen kelimeler') || savedDraft.includes('Belge Başlığı') || savedDraft.includes('Yeni Yazı</h1>'));
  const isInvalidSavedTitle = savedTitle && /\.(apk|zip|exe|bat|vbs|ps1|rar|7z)$/i.test(savedTitle.trim());
  if (isInvalidSavedTitle) {
    localStorage.removeItem('kalpten_kaleme_word_title');
  }
  if (savedDraft && savedDraft.trim().length > 10 && !isDummy && !isInvalidSavedTitle) {
    editor.innerHTML = savedDraft;
    if (savedTitle && docTitleInput) docTitleInput.value = savedTitle;
  } else {
    editor.innerHTML = '';
    if (docTitleInput) docTitleInput.value = 'Yeni Yazı.docx';
  }
  updateStats();

  // Rich OpenXML Reader Helper (Parses word/document.xml with styles, colors, sizes, alignments, tables, and images)
  async function parseOpenXmlDocumentToHtml(zip) {
    const docEntry = Object.keys(zip.files).find(k => /^word[\/\\]document\.xml$/i.test(k));
    if (!docEntry) return null;

    // 1. Load relationships (images & hyperlinks)
    const relsMap = {};
    const relsEntry = Object.keys(zip.files).find(k => /^word[\/\\]_rels[\/\\]document\.xml\.rels$/i.test(k));
    if (relsEntry) {
      try {
        const relsXml = await zip.files[relsEntry].async('text');
        const relsDoc = new DOMParser().parseFromString(relsXml, 'text/xml');
        for (const r of Array.from(relsDoc.getElementsByTagName('Relationship'))) {
          const id = r.getAttribute('Id');
          const target = r.getAttribute('Target');
          if (id && target) relsMap[id] = target;
        }
      } catch (_) {}
    }

    // Preload media files as Base64 data URLs
    const mediaMap = {};
    for (const [rId, target] of Object.entries(relsMap)) {
      const cleanTarget = target.replace(/^[\/\\]+/, '');
      const fullMediaKey = Object.keys(zip.files).find(k => {
        const norm = k.replace(/\\/g, '/').toLowerCase();
        return norm === `word/${cleanTarget.toLowerCase()}` || norm === cleanTarget.toLowerCase();
      });
      if (fullMediaKey && !zip.files[fullMediaKey].dir) {
        try {
          const b64 = await zip.files[fullMediaKey].async('base64');
          const ext = fullMediaKey.split('.').pop().toLowerCase();
          const mime = ext === 'png' ? 'image/png' : (ext === 'gif' ? 'image/gif' : (ext === 'webp' ? 'image/webp' : 'image/jpeg'));
          mediaMap[rId] = `data:${mime};base64,${b64}`;
        } catch (_) {}
      }
    }

    const xmlText = await zip.files[docEntry].async('text');
    const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
    const body = xmlDoc.getElementsByTagName('w:body')[0] || xmlDoc.getElementsByTagName('body')[0];
    if (!body) return null;

    const getLocalTag = (n) => (n.localName || n.nodeName.replace(/^.*:/, '')).toLowerCase();
    const getChildByTag = (parent, localTag) => {
      if (!parent || !parent.children) return null;
      for (const ch of Array.from(parent.children)) {
        if (getLocalTag(ch) === localTag) return ch;
      }
      return null;
    };
    const getAttrVal = (el, name) => {
      if (!el) return null;
      return el.getAttribute(`w:${name}`) || el.getAttribute(`r:${name}`) || el.getAttribute(name);
    };

    function convertRunNode(rNode) {
      const rPr = getChildByTag(rNode, 'rpr');
      let inner = '';
      for (const ch of Array.from(rNode.children)) {
        const lt = getLocalTag(ch);
        if (lt === 't') {
          inner += escapeHtml(ch.textContent || '');
        } else if (lt === 'br') {
          const brType = getAttrVal(ch, 'type');
          if (brType === 'page') {
            inner += `<div style="page-break-after: always; border-top: 2px dashed #999; margin: 24px 0; text-align: center; color: #888; font-size: 11px; padding-top: 4px; user-select: none;">--- Sayfa Sonu (Page Break) ---</div>`;
          } else {
            inner += '<br>';
          }
        } else if (lt === 'tab') {
          inner += '&emsp;';
        } else if (lt === 'drawing' || lt === 'pict') {
          const blips = ch.getElementsByTagName('a:blip');
          const blip = blips[0] || ch.getElementsByTagName('blip')[0];
          if (blip) {
            const embedId = blip.getAttribute('r:embed') || blip.getAttribute('embed');
            if (embedId && mediaMap[embedId]) {
              const extEl = ch.getElementsByTagName('wp:extent')[0] || ch.getElementsByTagName('a:ext')[0] || ch.getElementsByTagName('extent')[0];
              const cxVal = extEl ? parseInt(extEl.getAttribute('cx'), 10) : 0;
              const pxW = (!isNaN(cxVal) && cxVal > 150000) ? Math.min(600, Math.round(cxVal / 9525)) : 0;
              const wStyle = pxW > 0 ? `width:${pxW}px; ` : '';
              inner += `<img src="${mediaMap[embedId]}" style="${wStyle}max-width:100%; height:auto;">`;
            }
          }
        }
      }
      if (!inner) return '';

      if (rPr) {
        const styles = [];
        const colorEl = getChildByTag(rPr, 'color');
        const colVal = getAttrVal(colorEl, 'val');
        if (colVal && colVal !== 'auto') styles.push(`color:#${colVal}`);

        const shdEl = getChildByTag(rPr, 'shd');
        const fillVal = getAttrVal(shdEl, 'fill');
        if (fillVal && fillVal !== 'auto' && fillVal !== 'FFFFFF') styles.push(`background-color:#${fillVal}`);

        const szEl = getChildByTag(rPr, 'sz');
        const szVal = parseInt(getAttrVal(szEl, 'val'), 10);
        if (!isNaN(szVal) && szVal > 0) styles.push(`font-size:${Math.round(szVal / 2)}pt`);

        const rFontsEl = getChildByTag(rPr, 'rfonts');
        const asciiFont = getAttrVal(rFontsEl, 'ascii') || getAttrVal(rFontsEl, 'hAnsi');
        if (asciiFont) styles.push(`font-family:'${escapeHtml(asciiFont)}'`);

        if (getChildByTag(rPr, 'b')) inner = `<b>${inner}</b>`;
        if (getChildByTag(rPr, 'i')) inner = `<i>${inner}</i>`;
        if (getChildByTag(rPr, 'u')) inner = `<u>${inner}</u>`;
        if (getChildByTag(rPr, 'strike')) inner = `<s>${inner}</s>`;

        const vaEl = getChildByTag(rPr, 'vertalign');
        const vaVal = getAttrVal(vaEl, 'val');
        if (vaVal === 'subscript') inner = `<sub>${inner}</sub>`;
        else if (vaVal === 'superscript') inner = `<sup>${inner}</sup>`;

        if (styles.length > 0) {
          inner = `<span style="${styles.join(';')}">${inner}</span>`;
        }
      }
      return inner;
    }

    function convertParagraphNode(pNode) {
      const pPr = getChildByTag(pNode, 'ppr');
      let tag = 'p';
      const pStyles = [];

      if (pPr) {
        const pStyleEl = getChildByTag(pPr, 'pstyle');
        const styleVal = (getAttrVal(pStyleEl, 'val') || '').toLowerCase();
        if (styleVal.includes('heading1') || styleVal === '1' || styleVal === 'balk1') tag = 'h1';
        else if (styleVal.includes('heading2') || styleVal === '2' || styleVal === 'balk2') tag = 'h2';
        else if (styleVal.includes('heading3') || styleVal === '3' || styleVal === 'balk3') tag = 'h3';
        else if (styleVal.includes('quote')) tag = 'blockquote';

        const jcEl = getChildByTag(pPr, 'jc');
        const jcVal = (getAttrVal(jcEl, 'val') || '').toLowerCase();
        if (jcVal === 'center') pStyles.push('text-align:center');
        else if (jcVal === 'right' || jcVal === 'end') pStyles.push('text-align:right');
        else if (jcVal === 'both' || jcVal === 'distribute') pStyles.push('text-align:justify');

        const indEl = getChildByTag(pPr, 'ind');
        const leftTwips = parseInt(getAttrVal(indEl, 'left') || getAttrVal(indEl, 'start'), 10);
        if (!isNaN(leftTwips) && leftTwips > 0 && tag === 'p') {
          pStyles.push(`margin-left:${Math.round(leftTwips / 15)}px`);
        }
      }

      let runsHtml = '';
      for (const ch of Array.from(pNode.children)) {
        const lt = getLocalTag(ch);
        if (lt === 'r') {
          runsHtml += convertRunNode(ch);
        } else if (lt === 'hyperlink') {
          const rId = getAttrVal(ch, 'id');
          const href = (rId && relsMap[rId]) ? relsMap[rId] : '#';
          let linkInner = '';
          for (const sub of Array.from(ch.children)) {
            if (getLocalTag(sub) === 'r') linkInner += convertRunNode(sub);
          }
          runsHtml += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${linkInner}</a>`;
        }
      }

      const styleAttr = pStyles.length > 0 ? ` style="${pStyles.join(';')}"` : '';
      return `<${tag}${styleAttr}>${runsHtml || '<br>'}</${tag}>`;
    }

    function convertTableNode(tblNode) {
      let tblHtml = '<table><tbody>';
      for (const ch of Array.from(tblNode.children)) {
        if (getLocalTag(ch) === 'tr') {
          tblHtml += '<tr>';
          for (const tc of Array.from(ch.children)) {
            if (getLocalTag(tc) === 'tc') {
              const tcPr = getChildByTag(tc, 'tcpr');
              const shd = getChildByTag(tcPr, 'shd');
              const fill = getAttrVal(shd, 'fill');
              const cellStyle = (fill && fill !== 'auto' && fill !== 'FFFFFF') ? ` style="background-color:#${fill}"` : '';
              let cellInner = '';
              for (const p of Array.from(tc.children)) {
                if (getLocalTag(p) === 'p') cellInner += convertParagraphNode(p);
              }
              tblHtml += `<td${cellStyle}>${cellInner}</td>`;
            }
          }
          tblHtml += '</tr>';
        }
      }
      tblHtml += '</tbody></table>';
      return tblHtml;
    }

    let htmlParts = [];
    for (const ch of Array.from(body.children)) {
      const lt = getLocalTag(ch);
      if (lt === 'p') {
        htmlParts.push(convertParagraphNode(ch));
      } else if (lt === 'tbl') {
        htmlParts.push(convertTableNode(ch));
      }
    }

    return htmlParts.join('');
  }

  // Decode legacy html-docx.js MHT files (word/afchunk.mht)
  function decodeLegacyMhtHtml(mhtText) {
    if (!mhtText) return null;
    try {
      const bodyStart = mhtText.indexOf('<body');
      const bodyEnd = mhtText.lastIndexOf('</body>');
      if (bodyStart === -1 || bodyEnd === -1) return null;
      const openTagEnd = mhtText.indexOf('>', bodyStart);
      if (openTagEnd === -1) return null;
      let rawHtml = mhtText.slice(openTagEnd + 1, bodyEnd);
      rawHtml = rawHtml.replace(/=3D/gi, '=').replace(/=\r?\n/g, '');
      return rawHtml.trim();
    } catch (_) {
      return null;
    }
  }

  // 2. Open Document (.docx / .txt / .html / .md)
  window.loadWordFromBuffer = function(arrayBuffer, fileName, fileMeta = null) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      if (typeof switchTab === 'function') switchTab('pdfTab');
      if (window.loadPdfFromBuffer) window.loadPdfFromBuffer(arrayBuffer, fileName, fileMeta);
      return;
    }
    const allowedWordExts = ['docx', 'doc', 'rtf', 'txt', 'md', 'html', 'htm'];
    if (!allowedWordExts.includes(ext)) {
      return;
    }

    if (docTitleInput) docTitleInput.value = fileName;
    if (window.addRecentDocument) window.addRecentDocument(fileName, 'word');
    if (window.kalptenVault && arrayBuffer) {
      window.kalptenVault.saveFile(fileName, arrayBuffer, ext).catch(() => {});
    }

    const finalizeWordLoad = (htmlContent, toastMsg) => {
      editor.innerHTML = htmlContent || '<p></p>';
      updateStats();
      if (window.docManager) {
        window.docManager.onWordLoaded(fileName, editor.innerHTML, arrayBuffer, fileMeta);
      }
      showToast(toastMsg || `"${fileName}" Word belgesi başarıyla açıldı.`);
    };

    if (ext === 'docx' || ext === 'doc') {
      const parseWordDoc = async () => {
        let retries = 25;
        while ((!window.mammoth || !window.JSZip) && retries-- > 0) {
          await new Promise(r => setTimeout(r, 80));
        }

        if (window.JSZip) {
          try {
            const zip = await window.JSZip.loadAsync(arrayBuffer);

            // 1. Check for lossless Kalpten Kaleme HTML snapshot (word/kalpten_content.html)
            const kalptenEntry = Object.keys(zip.files).find(k => /^word[\/\\]kalpten_content\.html$/i.test(k));
            if (kalptenEntry) {
              let snapHtml = await zip.files[kalptenEntry].async('text');
              const metaMatch = snapHtml.match(/^<!--KALPTEN_META:(\{.*?\})-->/);
              if (metaMatch) {
                try {
                  const meta = JSON.parse(metaMatch[1]);
                  snapHtml = snapHtml.slice(metaMatch[0].length);
                  editor.classList.toggle('orientation-landscape', meta.orientation === 'landscape');
                  document.getElementById('editorContainer')?.classList.toggle('orientation-landscape', meta.orientation === 'landscape');
                  editor.classList.remove('margin-narrow', 'margin-normal', 'margin-wide');
                  editor.classList.add('margin-' + (meta.margins || 'normal'));
                  if (meta.fontFamily) editor.style.fontFamily = meta.fontFamily;
                  if (meta.fontSize) editor.style.fontSize = meta.fontSize;
                  if (meta.lineHeight) editor.style.lineHeight = meta.lineHeight;
                } catch (_) {}
              }
              finalizeWordLoad(snapHtml);
              return;
            }

            // 2. Check for legacy html-docx.js MHT chunk (word/afchunk.mht)
            const mhtEntry = Object.keys(zip.files).find(k => /^word[\/\\]afchunk\.mht$/i.test(k));
            if (mhtEntry) {
              const mhtText = await zip.files[mhtEntry].async('text');
              const decodedHtml = decodeLegacyMhtHtml(mhtText);
              if (decodedHtml && decodedHtml.length > 0) {
                finalizeWordLoad(decodedHtml);
                return;
              }
            }

            // 3. Rich OpenXML Parser (preserves colors, font sizes, alignments, tables, images)
            const richHtml = await parseOpenXmlDocumentToHtml(zip);
            if (richHtml && richHtml.replace(/<[^>]*>/g, '').trim().length > 0) {
              finalizeWordLoad(richHtml);
              return;
            }
          } catch (zipErr) {
            console.warn('Rich OpenXML inspect warning:', zipErr);
          }
        }

        // 4. Fallback to Mammoth
        if (window.mammoth) {
          try {
            const result = await window.mammoth.convertToHtml({ arrayBuffer });
            if (result && result.value && result.value.trim().length > 0) {
              finalizeWordLoad(result.value);
              return;
            }
          } catch (mErr) {
            console.warn('Mammoth convert failed:', mErr);
          }
        }

        // 5. Plain text fallback
        try {
          const text = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
          const clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').trim();
          if (clean.length > 0 && !clean.startsWith('PK')) {
            finalizeWordLoad(`<p>${escapeHtml(clean)}</p>`, `"${fileName}" açıldı.`);
            return;
          }
        } catch (_) {}

        showToast(`"${fileName}" Word belgesi açılırken hata oluştu.`, 'error');
      };

      parseWordDoc();
    } else if (ext === 'txt' || ext === 'md') {
      try {
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        const paragraphs = text.split(/\r?\n/).map(line => `<p>${line || '<br>'}</p>`).join('');
        finalizeWordLoad(paragraphs, `"${fileName}" açıldı.`);
      } catch (err) {
        showToast('Metin dosyası açılamadı: ' + err.message, 'error');
      }
    } else if (ext === 'rtf') {
      try {
        const raw = new TextDecoder('windows-1254', { fatal: false }).decode(arrayBuffer);
        const plain = raw
          .replace(/\\par\b/g, '\n')
          .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
          .replace(/\\[a-zA-Z]+-?\d*\s?/g, '')
          .replace(/[{}]/g, '')
          .trim();
        const paragraphs = plain.split(/\r?\n/).map(line => `<p>${escapeHtml(line) || '<br>'}</p>`).join('');
        finalizeWordLoad(paragraphs || '<p></p>', `"${fileName}" Word belgesi açıldı.`);
      } catch (err) {
        showToast('RTF belgesi açılamadı: ' + err.message, 'error');
      }
    } else if (ext === 'html' || ext === 'htm') {
      try {
        const html = new TextDecoder('utf-8').decode(arrayBuffer);
        finalizeWordLoad(html, `"${fileName}" açıldı.`);
      } catch (err) {
        showToast('HTML dosyası açılamadı: ' + err.message, 'error');
      }
    }
  };

  window.loadWordFile = function(file, fileMeta = null) {
    const reader = new FileReader();
    reader.onload = function(e) {
      window.loadWordFromBuffer(e.target.result, file.name, fileMeta);
    };
    reader.readAsArrayBuffer(file);
  };

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      window.loadWordFile(e.target.files[0]);
      e.target.value = '';
    }
  });

  docTitleInput?.addEventListener('input', () => {
    const val = docTitleInput.value.trim();
    if (val && window.docManager) {
      window.docManager.updateActiveDocTitle(val);
    }
  });

  docTitleInput?.addEventListener('blur', () => {
    let val = docTitleInput.value.trim();
    if (!val) val = 'Yeni Yazı.docx';
    if (!val.toLowerCase().endsWith('.docx') && !val.toLowerCase().endsWith('.txt') && !val.toLowerCase().endsWith('.html') && !val.toLowerCase().endsWith('.md')) {
      val += '.docx';
    }
    docTitleInput.value = val;
    if (window.docManager) window.docManager.updateActiveDocTitle(val);
  });

  // 3. New Document
  document.getElementById('wordNewBtn')?.addEventListener('click', () => {
    if (window.docManager) {
      const activeNav = document.querySelector('.nav-pill-btn.active');
      if (activeNav && activeNav.dataset.tab === 'pptTab') {
        window.docManager.createNewPptDoc();
      } else {
        window.docManager.createNewWordDoc();
      }
    } else {
      editor.innerHTML = '<h1>Yeni Yazı</h1><p>Gönülden dökülen kelimeler... Buraya yazmaya başlayın.</p>';
      if (docTitleInput) docTitleInput.value = 'Yeni Yazı.docx';
      updateStats();
      showToast('Yeni yazı sayfası açıldı.');
    }
  });

  window.updateWordStats = (immediate = true) => updateStats(immediate);

  // 4. Save to .DOCX (Real OpenXML, Direct In-Place Local Overwrite, Save As Dialog & Cloud Sync)
  window.saveWordDocument = async function(options = {}) {
    const isSaveAs = Boolean(options && options.saveAs);
    let title = (docTitleInput?.value || 'Yeni Yazı').trim();
    if (!title.toLowerCase().endsWith('.docx')) {
      title += '.docx';
    }

    const activeDoc = window.docManager ? window.docManager.getActiveDoc() : null;
    const saveStatusEl = document.getElementById('wordSaveStatus');
    if (saveStatusEl) {
      saveStatusEl.textContent = '⏳ Kaydediliyor...';
      saveStatusEl.classList.add('saving');
    }

    try {
      const blob = await buildOpenXmlDocxBlob(title, editor.innerHTML);
      let savedDirectly = false;

      // A. "Farklı Kaydet" (Save As) explicitly requested on Desktop
      if (isSaveAs) {
        if (typeof isOnlineServer !== 'undefined' && isOnlineServer) {
          try {
            const resp = await fetch('/api/native-save-dialog?filename=' + encodeURIComponent(title), {
              method: 'POST',
              body: blob
            });
            if (resp.ok) {
              const resData = await resp.json();
              if (resData && (resData.cancelled || resData.canceled)) {
                if (saveStatusEl) saveStatusEl.classList.remove('saving');
                return false;
              }
              if (resData && resData.success && resData.path) {
                savedDirectly = true;
                title = resData.filename || title;
                if (docTitleInput) docTitleInput.value = title;
                if (activeDoc) {
                  activeDoc.filePath = resData.path;
                  activeDoc.fileHandle = null;
                  activeDoc.title = title;
                  activeDoc.isDirty = false;
                  activeDoc.isDefault = false;
                  if (window.docManager) window.docManager.renderTabs();
                }
                if (typeof window.updateLocalFileBadge === 'function') window.updateLocalFileBadge();
                showToast(`"${title}" doğrudan seçilen konuma kaydedildi: ${resData.path}`);
              }
            }
          } catch (_) {}
        } else if (typeof window.showSaveFilePicker === 'function') {
          try {
            const handle = await window.showSaveFilePicker({
              suggestedName: title,
              types: [{
                description: 'Microsoft Word Belgesi (.docx)',
                accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] }
              }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            savedDirectly = true;
            title = handle.name || title;
            if (docTitleInput) docTitleInput.value = title;
            if (activeDoc) {
              activeDoc.fileHandle = handle;
              activeDoc.filePath = null;
              activeDoc.title = title;
              activeDoc.isDirty = false;
              activeDoc.isDefault = false;
              if (window.docManager) window.docManager.renderTabs();
            }
            if (typeof window.updateLocalFileBadge === 'function') window.updateLocalFileBadge();
            showToast(`"${title}" doğrudan bilgisayarınıza kaydedildi!`);
          } catch (pickerErr) {
            if (pickerErr && pickerErr.name === 'AbortError') {
              if (saveStatusEl) saveStatusEl.classList.remove('saving');
              return false;
            }
          }
        }
      }

      if (window.kalptenVault) {
        await window.kalptenVault.saveFile(title, blob, 'docx');
      }

      // B. Direct In-Place Overwrite if Document is Bound to a Local File Handle (File System Access API)
      if (!savedDirectly && !isSaveAs && activeDoc && activeDoc.fileHandle) {
        try {
          const writable = await activeDoc.fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          savedDirectly = true;
          activeDoc.isDirty = false;
          if (window.docManager) window.docManager.renderTabs();
          showToast(`"${activeDoc.fileHandle.name || title}" doğrudan yerel dosyanın üzerine kaydedildi!`);
        } catch (handleErr) {
          console.warn('FileHandle in-place write fallback:', handleErr);
        }
      }

      // C. Direct In-Place Overwrite if Document is Bound to a Local File Path on Desktop Server
      if (!savedDirectly && !isSaveAs && typeof isOnlineServer !== 'undefined' && isOnlineServer && activeDoc && activeDoc.filePath) {
        try {
          const pathResp = await fetch('/api/save-to-path?path=' + encodeURIComponent(activeDoc.filePath), {
            method: 'POST',
            body: blob
          });
          if (pathResp.ok) {
            const pathData = await pathResp.json();
            if (pathData && pathData.success) {
              savedDirectly = true;
              activeDoc.isDirty = false;
              if (window.docManager) window.docManager.renderTabs();
              showToast(`"${title}" doğrudan açık dosyanın üzerine kaydedildi!`);
            }
          }
        } catch (_) {}
      }

      // D. Desktop Server Default Sync Folder Save (/api/save-document)
      if (!savedDirectly && typeof isOnlineServer !== 'undefined' && isOnlineServer) {
        try {
          const resp = await fetch('/api/save-document?filename=' + encodeURIComponent(title), {
            method: 'POST',
            body: blob
          });
          if (resp.ok) {
            const resData = await resp.json();
            if (resData && resData.success) {
              savedDirectly = true;
              if (activeDoc) {
                if (resData.path && !activeDoc.filePath) activeDoc.filePath = resData.path;
                activeDoc.isDirty = false;
                activeDoc.isDefault = false;
                if (window.docManager) window.docManager.renderTabs();
              }
              if (typeof window.updateLocalFileBadge === 'function') window.updateLocalFileBadge();
              let saveMsg = `"${resData.filename || title}" kaydedildi!`;
              if (resData.cloudProvider === 'gdrive' || resData.isGoogleDrive) {
                saveMsg = `"${resData.filename || title}" Google Drive'a kaydedildi ve eşitlendi!`;
              } else if (resData.cloudProvider === 'onedrive') {
                saveMsg = `"${resData.filename || title}" OneDrive'a kaydedildi ve eşitlendi!`;
              }
              showToast(saveMsg);
              const timeStr = resData.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
              if (saveStatusEl) {
                if (resData.cloudProvider === 'gdrive' || resData.isGoogleDrive) {
                  saveStatusEl.textContent = `☁️ Drive'a Kaydedildi (${timeStr})`;
                } else if (resData.cloudProvider === 'onedrive') {
                  saveStatusEl.textContent = `☁️ OneDrive'a Kaydedildi (${timeStr})`;
                } else {
                  saveStatusEl.textContent = `💾 Kaydedildi (${timeStr})`;
                }
                saveStatusEl.classList.remove('saving');
              }
              if (resData.filename) title = resData.filename;
              if (window.loadDriveFiles) {
                window.loadDriveFiles();
              }
            }
          }
        } catch (fetchErr) {
          // Fallback to download below
        }
      }

      if (!savedDirectly && window.AndroidBridge && window.AndroidBridge.saveBase64File) {
        try {
          const reader = new FileReader();
          reader.onloadend = function() {
            try {
              const base64data = reader.result.split(',')[1];
              window.AndroidBridge.saveBase64File(title, base64data, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
              savedDirectly = true;
              if (saveStatusEl) {
                saveStatusEl.textContent = '● Telefona Kaydedildi';
                saveStatusEl.classList.remove('saving');
              }
              showToast(`"${title}" telefonunuzdaki "Belgeler" klasörüne kaydedildi!`);
            } catch (bridgeErr) {
              console.warn('AndroidBridge save error:', bridgeErr);
            }
          };
          reader.readAsDataURL(blob);
        } catch (e) {
          console.warn('FileReader error:', e);
        }
      }

      if (!savedDirectly) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = title;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (saveStatusEl) {
          saveStatusEl.textContent = '● Kaydedildi';
          saveStatusEl.classList.remove('saving');
        }
        showToast(`"${title}" başarıyla kaydedildi.`);
      }

      if (activeDoc) activeDoc.isDirty = false;
      if (window.docManager) window.docManager.renderTabs();

      const bottomSaveState = document.getElementById('wordSaveState');
      if (bottomSaveState) {
        const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        bottomSaveState.textContent = `Tüm değişiklikler kaydedildi (${timeStr})`;
      }
      if (typeof window.triggerSaveFeedback === 'function') {
        window.triggerSaveFeedback();
      }
      if (typeof window.addRecentDocument === 'function') {
        window.addRecentDocument(title, 'word');
      }
    } catch (err) {
      console.error(err);
      if (saveStatusEl) saveStatusEl.classList.remove('saving');
      showToast('Kayıt sırasında hata: ' + err.message, 'error');
    }
  };

  // 5. Export to PDF / Print (WYSIWYG: Ekranda görünenin 1:1 aynısını yazdır)
  window.printWordDocument = function() {
    if (window.executeCleanPrint) {
      window.executeCleanPrint();
    } else {
      window.print();
    }
  };

  // 6. Safe Find & Replace (DOM TreeWalker based)
  function toggleFindBar() {
    if (findBar) {
      findBar.classList.toggle('show');
      if (findBar.classList.contains('show')) {
        findInput?.focus();
      }
    }
  }

  document.getElementById('wordFindBtn')?.addEventListener('click', toggleFindBar);
  document.getElementById('closeFindBarBtn')?.addEventListener('click', toggleFindBar);

  document.getElementById('findNextBtn')?.addEventListener('click', () => {
    const term = findInput?.value;
    if (!term) return;
    if (window.find) {
      const found = window.find(term, false, false, true, false, false, false);
      if (!found) {
        window.getSelection()?.removeAllRanges();
        const refound = window.find(term, false, false, true, false, false, false);
        if (!refound) showToast('Eşleşme bulunamadı.', 'error');
      }
    }
  });

  document.getElementById('replaceBtn')?.addEventListener('click', () => {
    const term = findInput?.value;
    const replacement = replaceInput?.value || '';
    if (!term) return;

    const sel = window.getSelection();
    if (sel && sel.toString().toLowerCase() === term.toLowerCase()) {
      document.execCommand('insertText', false, replacement);
      showToast('Kelime değiştirildi.');
      if (window.find) window.find(term, false, false, true, false, false, false);
    } else {
      if (window.find && window.find(term, false, false, true, false, false, false)) {
        document.execCommand('insertText', false, replacement);
        showToast('Kelime değiştirildi.');
      } else {
        showToast('Eşleşme bulunamadı.', 'error');
      }
    }
    updateStats();
  });

  // Safe Replace All: TreeWalker walks ONLY text nodes, preserving all HTML markup!
  document.getElementById('replaceAllBtn')?.addEventListener('click', () => {
    const term = findInput?.value;
    const replacement = replaceInput?.value || '';
    if (!term) return;

    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let n;
    while (n = walker.nextNode()) {
      textNodes.push(n);
    }

    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let totalReplacements = 0;

    for (const node of textNodes) {
      if (regex.test(node.nodeValue)) {
        const matches = node.nodeValue.match(regex);
        totalReplacements += matches ? matches.length : 1;
        node.nodeValue = node.nodeValue.replace(regex, replacement);
      }
    }

    if (totalReplacements > 0) {
      showToast(`${totalReplacements} adet eşleşme güvenle değiştirildi!`);
      updateStats();
    } else {
      showToast('Eşleşme bulunamadı.', 'error');
    }
  });

  // 7. Rich Text Formatting Commands & Dynamic Toolbar State
  try {
    document.execCommand('styleWithCSS', false, true);
  } catch (e) {}

  function executeCmd(command, value = null) {
    editor.focus();
    document.execCommand(command, false, value);
    updateStats();
    updateToolbarState();
  }

  // Prevent losing selection in editor when clicking toolbar buttons
  document.querySelectorAll('#wordTab .tool-item, #wordTab .icon-btn, #wordTab .stepper-btn, .word-formatting-bar .tool-btn').forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
      }
    });
  });

  document.querySelectorAll('#wordTab .tool-item[data-command], .word-formatting-bar .tool-btn[data-command]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const cmd = btn.dataset.command;
      executeCmd(cmd);
    });
  });

  // Dynamic Toolbar State Synchronization (reflects cursor format)
  function updateToolbarState() {
    const commands = [
      'bold', 'italic', 'underline', 'strikeThrough', 'subscript', 'superscript',
      'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull',
      'insertUnorderedList', 'insertOrderedList'
    ];
    commands.forEach(cmd => {
      try {
        const state = document.queryCommandState(cmd);
        document.querySelectorAll(`[data-command="${cmd}"]`).forEach(btn => {
          btn.classList.toggle('active', !!state);
        });
      } catch (e) {}
    });

    // Format Block (H1, H2, H3, P, Blockquote)
    try {
      let block = document.queryCommandValue('formatBlock') || '';
      block = block.toLowerCase().replace(/[<>]/g, '');
      const blockSelect = document.getElementById('wordFormatBlock');
      if (blockSelect) {
        if (['h1', 'h2', 'h3', 'blockquote', 'p'].includes(block)) {
          blockSelect.value = block;
        } else {
          blockSelect.value = 'p';
        }
      }
    } catch (e) {}

    // Font Family
    try {
      const font = document.queryCommandValue('fontName') || '';
      const fontSelect = document.getElementById('wordFontFamily');
      if (fontSelect && font) {
        const cleanFont = font.replace(/['"]/g, '').toLowerCase();
        for (const opt of fontSelect.options) {
          if (opt.value.toLowerCase().includes(cleanFont)) {
            fontSelect.value = opt.value;
            break;
          }
        }
      }
    } catch (e) {}

    // Punto Stepper Sync (Cursor Position)
    try {
      const sel = window.getSelection();
      if (sel && sel.anchorNode) {
        let el = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
        if (!sel.isCollapsed && sel.anchorNode.nodeType === 1 && sel.anchorNode.childNodes[sel.anchorOffset]) {
          const child = sel.anchorNode.childNodes[sel.anchorOffset];
          if (child.nodeType === 1) el = child;
        }
        if (el && editor.contains(el)) {
          const comp = window.getComputedStyle(el);
          const px = parseFloat(comp.fontSize);
          if (px > 0) {
            const pt = Math.round(px * 0.75);
            const input = document.getElementById('fontSizeInput');
            if (input && document.activeElement !== input) {
              input.value = pt;
            }
          }
        }
      }
    } catch (e) {}
  }

  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (sel && sel.anchorNode && editor.contains(sel.anchorNode)) {
      updateToolbarState();
    }
  });
  editor.addEventListener('keyup', updateToolbarState);
  editor.addEventListener('mouseup', updateToolbarState);
  editor.addEventListener('touchend', updateToolbarState);

  document.getElementById('wordFormatBlock')?.addEventListener('change', (e) => {
    executeCmd('formatBlock', `<${e.target.value}>`);
  });

  document.getElementById('wordFontFamily')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      editor.style.fontFamily = val;
    }
    executeCmd('fontName', val);
    showToast(`Yazı tipi değiştirildi.`);
  });

  // Punto Stepper Engine (Incremental 1-by-1 Step Progression)
  const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 36, 42, 48, 72];

  function applyFontSizePt(pt) {
    pt = parseInt(pt, 10);
    if (isNaN(pt) || pt < 6 || pt > 96) return;
    const input = document.getElementById('fontSizeInput');
    if (input) input.value = pt;

    editor.focus();
    let sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      editor.style.fontSize = pt + 'pt';
      return;
    }

    // If cursor is inside a word without selection, automatically select that word
    if (sel.isCollapsed) {
      const node = sel.anchorNode;
      if (node && node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue;
        const offset = sel.anchorOffset;
        let start = offset;
        while (start > 0 && /\S/.test(text[start - 1])) start--;
        let end = offset;
        while (end < text.length && /\S/.test(text[end])) end++;
        if (end > start) {
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, end);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }

    if (!sel.isCollapsed) {
      try {
        // Fast path: if selection is already the full text of a single span inside editor, update it directly
        let anchorEl = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
        if (anchorEl && anchorEl.tagName === 'SPAN' && editor.contains(anchorEl) && anchorEl.innerText === sel.toString()) {
          anchorEl.style.fontSize = pt + 'pt';
          anchorEl.querySelectorAll('[style*="font-size"]').forEach(child => {
            child.style.fontSize = '';
            if (!child.getAttribute('style')?.trim()) child.removeAttribute('style');
          });
          const newRange = document.createRange();
          newRange.selectNodeContents(anchorEl);
          sel.removeAllRanges();
          sel.addRange(newRange);
        } else {
          // Toggle styleWithCSS off temporarily so fontSize generates standard <font size="7">
          document.execCommand('styleWithCSS', false, false);
          document.execCommand('fontSize', false, '7');
          document.execCommand('styleWithCSS', false, true);

          const updatedSpans = [];
          // Replace all generated font/span markers with exact pt size
          editor.querySelectorAll('font, span').forEach(el => {
            const sz = el.getAttribute('size');
            const fs = el.style.fontSize || '';
            if (sz === '7' || fs.includes('xxx-large') || fs === '48px') {
              el.removeAttribute('size');
              let targetSpan = el;
              if (el.tagName.toLowerCase() === 'font') {
                const span = document.createElement('span');
                span.innerHTML = el.innerHTML;
                el.parentNode.replaceChild(span, el);
                targetSpan = span;
              }
              targetSpan.style.fontSize = pt + 'pt';
              // Clear any nested stale font-size styles so inner spans don't override the new pt size
              targetSpan.querySelectorAll('[style*="font-size"]').forEach(child => {
                child.style.fontSize = '';
                if (!child.getAttribute('style')?.trim()) child.removeAttribute('style');
              });
              updatedSpans.push(targetSpan);
            }
          });

          // Re-select inside the updated span(s) so repeated +/- clicks step smoothly without losing selection
          if (updatedSpans.length === 1) {
            const newRange = document.createRange();
            newRange.selectNodeContents(updatedSpans[0]);
            sel.removeAllRanges();
            sel.addRange(newRange);
          } else if (updatedSpans.length > 1) {
            const newRange = document.createRange();
            newRange.setStart(updatedSpans[0], 0);
            const lastSpan = updatedSpans[updatedSpans.length - 1];
            newRange.setEnd(lastSpan, lastSpan.childNodes.length);
            sel.removeAllRanges();
            sel.addRange(newRange);
          }
        }
      } catch (err) {
        console.warn('applyFontSize error:', err);
      }
      updateStats();
      updateToolbarState();
      if (input) input.value = pt;
    } else {
      // Cursor is in an empty editor or at a whitespace/empty block
      const cleanText = (editor.innerText || '').trim();
      if (!cleanText) {
        editor.style.fontSize = pt + 'pt';
      }
      let block = sel.anchorNode ? (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode) : editor;
      if (block && editor.contains(block)) {
        block.style.fontSize = pt + 'pt';
      } else {
        editor.style.fontSize = pt + 'pt';
      }
      if (input) input.value = pt;
    }
  }

  const fontSizeInput = document.getElementById('fontSizeInput');
  const fontSizeDecBtn = document.getElementById('fontSizeDecBtn');
  const fontSizeIncBtn = document.getElementById('fontSizeIncBtn');

  function stepFontSize(delta) {
    let current = parseInt(fontSizeInput?.value, 10) || 12;
    if (delta > 0) {
      const next = FONT_SIZES.find(s => s > current);
      applyFontSizePt(next !== undefined ? next : Math.min(96, current + 2));
    } else {
      const reversed = [...FONT_SIZES].reverse();
      const prev = reversed.find(s => s < current);
      applyFontSizePt(prev !== undefined ? prev : Math.max(6, current - 2));
    }
  }

  fontSizeDecBtn?.addEventListener('mousedown', (e) => e.preventDefault());
  fontSizeDecBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    stepFontSize(-1);
  });

  fontSizeIncBtn?.addEventListener('mousedown', (e) => e.preventDefault());
  fontSizeIncBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    stepFontSize(1);
  });

  fontSizeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyFontSizePt(fontSizeInput.value);
      editor.focus();
    }
  });

  fontSizeInput?.addEventListener('blur', () => {
    applyFontSizePt(fontSizeInput.value);
  });

  // Legacy fallback if any code references wordFontSize
  document.getElementById('wordFontSize')?.addEventListener('change', (e) => {
    applyFontSizePt(e.target.value);
  });

  // ========================================================================
  // Format Painter (Biçim Boyacısı / Stil Kopyalama Rulosu)
  // ========================================================================
  let copiedFormat = null;
  let isPersistentPainter = false;
  const formatPainterBtn = document.getElementById('formatPainterBtn');

  function deactivateFormatPainter() {
    copiedFormat = null;
    isPersistentPainter = false;
    formatPainterBtn?.classList.remove('painting');
    document.body.classList.remove('format-painter-active');
  }

  function activateFormatPainter(persistent = false) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    let node = sel.anchorNode;
    if (!node) return;
    let el = node.nodeType === 3 ? node.parentElement : node;
    if (!el || !editor.contains(el)) el = editor;

    const comp = window.getComputedStyle(el);
    copiedFormat = {
      fontFamily: comp.fontFamily,
      fontSize: comp.fontSize,
      fontWeight: comp.fontWeight,
      fontStyle: comp.fontStyle,
      textDecorationLine: comp.textDecorationLine || comp.textDecoration,
      color: comp.color,
      backgroundColor: comp.backgroundColor,
      lineHeight: comp.lineHeight
    };

    isPersistentPainter = persistent;
    formatPainterBtn?.classList.add('painting');
    document.body.classList.add('format-painter-active');
    showToast(persistent ? 'Biçim kopyalandı (Kalıcı mod - Çıkmak için Esc).' : 'Biçim kopyalandı. Metin seçerek uygulayın.');
  }

  formatPainterBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (copiedFormat) {
      deactivateFormatPainter();
    } else {
      activateFormatPainter(false);
    }
  });

  formatPainterBtn?.addEventListener('dblclick', (e) => {
    e.preventDefault();
    e.stopPropagation();
    activateFormatPainter(true);
  });

  editor.addEventListener('mouseup', () => {
    if (!copiedFormat) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    try {
      document.execCommand('styleWithCSS', false, true);
      if (copiedFormat.fontFamily) executeCmd('fontName', copiedFormat.fontFamily);
      if (copiedFormat.fontSize) {
        const pt = Math.round(parseFloat(copiedFormat.fontSize) * 0.75);
        applyFontSizePt(pt);
      }
      if (copiedFormat.color && copiedFormat.color !== 'rgba(0, 0, 0, 0)') {
        document.execCommand('foreColor', false, copiedFormat.color);
      }
      if (copiedFormat.backgroundColor && copiedFormat.backgroundColor !== 'rgba(0, 0, 0, 0)' && copiedFormat.backgroundColor !== 'transparent') {
        document.execCommand('hiliteColor', false, copiedFormat.backgroundColor) || document.execCommand('backColor', false, copiedFormat.backgroundColor);
      }
      const isBold = parseInt(copiedFormat.fontWeight, 10) >= 700 || copiedFormat.fontWeight === 'bold';
      if (isBold !== document.queryCommandState('bold')) {
        document.execCommand('bold', false, null);
      }
      const isItalic = copiedFormat.fontStyle === 'italic';
      if (isItalic !== document.queryCommandState('italic')) {
        document.execCommand('italic', false, null);
      }
      const isUnderline = (copiedFormat.textDecorationLine || '').includes('underline');
      if (isUnderline !== document.queryCommandState('underline')) {
        document.execCommand('underline', false, null);
      }
      showToast('Biçim uygulandı.');
    } catch (err) {
      console.warn('Format Painter apply error:', err);
    }

    if (!isPersistentPainter) {
      deactivateFormatPainter();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && copiedFormat) {
      deactivateFormatPainter();
    }
  });

  // Word Editor Fast Color Presets & Popovers (No need to open OS spectrum for primary colors)
  function setupColorPopover(btnId, popoverId, barId, inputId, commandName) {
    const btn = document.getElementById(btnId);
    const popover = document.getElementById(popoverId);
    const bar = document.getElementById(barId);
    const input = document.getElementById(inputId);
    if (!btn || !popover) return;

    btn.addEventListener('mousedown', () => {
      saveCurrentSelection();
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCurrentlyActive = popover.classList.contains('active');
      document.querySelectorAll('.color-preset-popover').forEach(p => p.classList.remove('active'));

      if (!isCurrentlyActive) {
        // Calculate exact button position in viewport
        const rect = btn.getBoundingClientRect();
        popover.style.position = 'fixed';
        popover.style.top = `${Math.round(rect.bottom + 6)}px`;
        const popW = 230;
        const leftPos = Math.max(10, Math.min(window.innerWidth - popW - 12, Math.round(rect.left - 4)));
        popover.style.left = `${leftPos}px`;
        popover.style.zIndex = '999999';
        popover.classList.add('active');
      }
    });

    popover.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    popover.querySelectorAll('.preset-swatch, .preset-default-btn').forEach(swatch => {
      swatch.addEventListener('mousedown', (e) => e.preventDefault());
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = swatch.dataset.color;
        restoreCurrentSelection();
        if (commandName === 'hiliteColor') {
          document.execCommand('hiliteColor', false, color) || document.execCommand('backColor', false, color);
        } else {
          document.execCommand('foreColor', false, color);
        }
        if (bar && color !== 'transparent') bar.style.backgroundColor = color;
        popover.querySelectorAll('.preset-swatch').forEach(s => s.classList.remove('active'));
        if (swatch.classList.contains('preset-swatch')) swatch.classList.add('active');
        popover.classList.remove('active');
      });
    });

    if (input) {
      input.addEventListener('input', (e) => {
        const color = e.target.value;
        restoreCurrentSelection();
        if (commandName === 'hiliteColor') {
          document.execCommand('hiliteColor', false, color) || document.execCommand('backColor', false, color);
        } else {
          document.execCommand('foreColor', false, color);
        }
        if (bar) bar.style.backgroundColor = color;
        popover.classList.remove('active');
      });
    }
  }

  setupColorPopover('wordTextColorBtn', 'wordTextColorPopover', 'wordTextColorBar', 'wordTextColor', 'foreColor');
  setupColorPopover('wordHighlightColorBtn', 'wordHighlightColorPopover', 'wordHighlightColorBar', 'wordHighlightColor', 'hiliteColor');

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.color-dropdown-container') && !e.target.closest('.color-preset-popover')) {
      document.querySelectorAll('.color-preset-popover').forEach(p => p.classList.remove('active'));
    }
  });

  document.getElementById('wordLineHeight')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let parent = sel.anchorNode.parentElement;
      while (parent && parent !== editor && !['P', 'DIV', 'H1', 'H2', 'H3', 'LI'].includes(parent.tagName)) {
        parent = parent.parentElement;
      }
      if (parent && parent !== editor) {
        parent.style.lineHeight = val;
      } else {
        editor.style.lineHeight = val;
      }
      showToast(`Satır aralığı ${val}x yapıldı.`);
    }
  });

  // Page Break
  document.getElementById('wordInsertPageBreakBtn')?.addEventListener('click', () => {
    editor.focus();
    const pageBreakHtml = `
      <div style="page-break-after: always; border-top: 2px dashed #999; margin: 24px 0; text-align: center; color: #888; font-size: 11px; padding-top: 4px; user-select: none;">
        --- Sayfa Sonu (Page Break) ---
      </div>
      <p><br></p>
    `;
    document.execCommand('insertHTML', false, pageBreakHtml);
    showToast('Sayfa sonu eklendi.');
  });

  // Insert Image
  document.getElementById('wordInsertImageBtn')?.addEventListener('click', () => {
    imageInput?.click();
  });

  imageInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = function(evt) {
        editor.focus();
        document.execCommand('insertImage', false, evt.target.result);
        updateStats();
        showToast('Görsel eklendi.');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  });

  // Insert Table
  document.getElementById('wordInsertTableBtn')?.addEventListener('click', () => {
    saveCurrentSelection();
    openModal('tableModal');
  });

  document.getElementById('confirmInsertTableBtn')?.addEventListener('click', () => {
    restoreCurrentSelection();
    const rows = parseInt(document.getElementById('tableRows').value) || 3;
    const cols = parseInt(document.getElementById('tableCols').value) || 3;

    let tableHtml = '<table><thead><tr>';
    for (let c = 0; c < cols; c++) {
      tableHtml += `<th>Başlık ${c + 1}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';

    for (let r = 0; r < rows; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td>Hücre ${r + 1}-${c + 1}</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p></p>';

    editor.focus();
    document.execCommand('insertHTML', false, tableHtml);
    closeModal('tableModal');
    updateStats(true);
    showToast(`${rows}x${cols} Tablo eklendi.`);
  });

  // Insert Link
  document.getElementById('wordInsertLinkBtn')?.addEventListener('click', () => {
    saveCurrentSelection();
    const askUrl = (cb) => {
      if (typeof window.showPromptDialog === 'function') {
        window.showPromptDialog('Bağlantı URL adresini girin:', 'https://', cb, 'Bağlantı Ekle');
      } else {
        const u = prompt('Bağlantı URL adresini girin:', 'https://');
        if (u !== null) cb(u);
      }
    };
    askUrl((url) => {
      if (url && url.trim() && url.trim() !== 'https://') {
        const cleanUrl = url.trim();
        restoreCurrentSelection();
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
          editor.focus();
          document.execCommand('insertHTML', false, `<a href="${escapeHtml(cleanUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(cleanUrl)}</a>`);
        } else {
          executeCmd('createLink', cleanUrl);
        }
        showToast('Bağlantı eklendi.');
      }
    });
  });

  // Smart Paste Sanitizer (Prevents broken web layouts / scripts from corrupting A4 sheet)
  editor.addEventListener('paste', (e) => {
    if (!e.clipboardData) return;
    const html = e.clipboardData.getData('text/html');
    if (html && html.trim().length > 0) {
      e.preventDefault();
      const temp = document.createElement('div');
      temp.innerHTML = html;
      temp.querySelectorAll('script, style, iframe, object, embed, meta, link').forEach(el => el.remove());
      temp.querySelectorAll('*').forEach(el => {
        if (el.style) {
          if (el.style.position === 'fixed' || el.style.position === 'absolute') {
            el.style.position = 'static';
          }
          el.style.maxWidth = '100%';
        }
        el.removeAttribute('onload');
        el.removeAttribute('onerror');
        el.removeAttribute('onclick');
      });
      document.execCommand('insertHTML', false, temp.innerHTML);
      updateStats();
    }
  });

  // Toggle View (A4 Sayfa / Geniş Görünüm)
  document.getElementById('wordToggleViewBtn')?.addEventListener('click', () => {
    const container = document.getElementById('editorContainer');
    const label = document.getElementById('wordToggleViewLabel');
    if (container) {
      container.classList.toggle('full-width');
      const isFull = container.classList.contains('full-width');
      if (label) label.textContent = isFull ? 'Geniş' : 'A4 Sayfa';
      showToast(isFull ? 'Görünüm: Geniş Ekran' : 'Görünüm: A4 Sayfa');
    }
  });

  // Margins (Normal / Dar / Geniş)
  document.getElementById('wordMarginsSelect')?.addEventListener('change', (e) => {
    const val = e.target.value;
    editor.classList.remove('margin-narrow', 'margin-normal', 'margin-wide');
    if (val === 'narrow') {
      editor.classList.add('margin-narrow');
      showToast('Kenar Boşluğu: Dar (1.27 cm)');
    } else if (val === 'wide') {
      editor.classList.add('margin-wide');
      showToast('Kenar Boşluğu: Geniş (3.8 cm)');
    } else {
      editor.classList.add('margin-normal');
      showToast('Kenar Boşluğu: Normal (2.54 cm)');
    }
  });

  // Page Orientation (Dikey / Yatay)
  let isLandscape = false;
  document.getElementById('wordOrientationBtn')?.addEventListener('click', () => {
    isLandscape = !isLandscape;
    const container = document.getElementById('editorContainer');
    const label = document.getElementById('wordOrientationLabel');

    if (isLandscape) {
      editor.classList.add('orientation-landscape');
      if (container) container.classList.add('orientation-landscape');
      if (label) label.textContent = 'Yatay';
      showToast('Sayfa Yönü: Yatay');
    } else {
      editor.classList.remove('orientation-landscape');
      if (container) container.classList.remove('orientation-landscape');
      if (label) label.textContent = 'Dikey';
      showToast('Sayfa Yönü: Dikey');
    }
  });

  // ========================================================================
  // Desktop Keyboard Enhancements: Tab / Shift+Tab (Table Cell Navigation & Indentation)
  // ========================================================================
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;

      let node = sel.anchorNode;
      let el = node && node.nodeType === 3 ? node.parentElement : node;
      const cell = el ? el.closest('td, th') : null;

      if (cell && editor.contains(cell)) {
        const table = cell.closest('table');
        if (table) {
          const cells = Array.from(table.querySelectorAll('th, td'));
          const idx = cells.indexOf(cell);
          if (!e.shiftKey) {
            if (idx >= 0 && idx < cells.length - 1) {
              const nextCell = cells[idx + 1];
              const range = document.createRange();
              range.selectNodeContents(nextCell);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            } else if (idx === cells.length - 1) {
              // Last cell in table -> append a new row automatically (like Microsoft Word)
              const currentRow = cell.closest('tr');
              const tbody = table.querySelector('tbody') || table;
              const colCount = currentRow ? currentRow.children.length : 1;
              const newRow = document.createElement('tr');
              for (let c = 0; c < colCount; c++) {
                const td = document.createElement('td');
                td.innerHTML = '<br>';
                newRow.appendChild(td);
              }
              tbody.appendChild(newRow);
              const firstNewCell = newRow.querySelector('td');
              if (firstNewCell) {
                const range = document.createRange();
                range.selectNodeContents(firstNewCell);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
              }
              updateStats();
            }
          } else {
            if (idx > 0) {
              const prevCell = cells[idx - 1];
              const range = document.createRange();
              range.selectNodeContents(prevCell);
              range.collapse(false);
              sel.removeAllRanges();
              sel.addRange(range);
            }
          }
          return;
        }
      }

      // Outside tables: indent / outdent list items or paragraphs
      if (e.shiftKey) {
        document.execCommand('outdent', false, null);
      } else {
        const li = el ? el.closest('li') : null;
        if (li && editor.contains(li)) {
          document.execCommand('indent', false, null);
        } else {
          document.execCommand('insertHTML', false, '&emsp;');
        }
      }
      updateStats();
    }
  });

  // ========================================================================
  // Interactive Image & Table Contextual Toolbars
  // ========================================================================
  const wordWorkspaceArea = document.getElementById('wordWorkspaceArea');
  const wordImageToolbar = document.getElementById('wordImageToolbar');
  const wordTableToolbar = document.getElementById('wordTableToolbar');
  let activeWordImage = null;
  let activeWordTableCell = null;

  function hideWordContextToolbars() {
    if (wordImageToolbar) wordImageToolbar.style.display = 'none';
    if (wordTableToolbar) wordTableToolbar.style.display = 'none';
    if (activeWordImage) {
      activeWordImage.classList.remove('selected-word-img');
      activeWordImage = null;
    }
    activeWordTableCell = null;
  }

  function positionContextToolbar(toolbarEl, targetEl) {
    if (!toolbarEl || !targetEl || !wordWorkspaceArea) return;
    const wsRect = wordWorkspaceArea.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    toolbarEl.style.display = 'flex';
    const topPos = Math.max(8, targetRect.top - wsRect.top + wordWorkspaceArea.scrollTop - 44);
    const leftPos = Math.max(12, Math.min(wsRect.width - 320, targetRect.left - wsRect.left + wordWorkspaceArea.scrollLeft));
    toolbarEl.style.top = `${Math.round(topPos)}px`;
    toolbarEl.style.left = `${Math.round(leftPos)}px`;
  }

  editor.addEventListener('click', (e) => {
    const clickedImg = e.target.closest('img');
    if (clickedImg && editor.contains(clickedImg)) {
      if (activeWordImage && activeWordImage !== clickedImg) {
        activeWordImage.classList.remove('selected-word-img');
      }
      activeWordImage = clickedImg;
      activeWordImage.classList.add('selected-word-img');
      if (wordTableToolbar) wordTableToolbar.style.display = 'none';
      positionContextToolbar(wordImageToolbar, clickedImg);
      return;
    }

    if (activeWordImage) {
      activeWordImage.classList.remove('selected-word-img');
      activeWordImage = null;
    }
    if (wordImageToolbar) wordImageToolbar.style.display = 'none';

    const clickedCell = e.target.closest('td, th');
    if (clickedCell && editor.contains(clickedCell)) {
      activeWordTableCell = clickedCell;
      const table = clickedCell.closest('table');
      positionContextToolbar(wordTableToolbar, table || clickedCell);
    } else {
      activeWordTableCell = null;
      if (wordTableToolbar) wordTableToolbar.style.display = 'none';
    }
  });

  wordImageToolbar?.addEventListener('mousedown', (e) => e.preventDefault());
  wordImageToolbar?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-img-size], button[data-img-align], button[data-img-action]');
    if (!btn || !activeWordImage) return;
    const sizeVal = btn.dataset.imgSize;
    const alignVal = btn.dataset.imgAlign;
    const action = btn.dataset.imgAction;

    if (sizeVal || action === '25' || action === '50' || action === '75' || action === '100') {
      const targetWidth = sizeVal || `${action}%`;
      activeWordImage.style.width = targetWidth;
      activeWordImage.style.height = 'auto';
      positionContextToolbar(wordImageToolbar, activeWordImage);
      showToast(`Görsel boyutu %${targetWidth.replace('%', '')} yapıldı.`);
    } else if (alignVal === 'left' || action === 'left') {
      activeWordImage.style.display = 'block';
      activeWordImage.style.marginLeft = '0';
      activeWordImage.style.marginRight = 'auto';
      positionContextToolbar(wordImageToolbar, activeWordImage);
    } else if (alignVal === 'center' || action === 'center') {
      activeWordImage.style.display = 'block';
      activeWordImage.style.marginLeft = 'auto';
      activeWordImage.style.marginRight = 'auto';
      positionContextToolbar(wordImageToolbar, activeWordImage);
    } else if (alignVal === 'right' || action === 'right') {
      activeWordImage.style.display = 'block';
      activeWordImage.style.marginLeft = 'auto';
      activeWordImage.style.marginRight = '0';
      positionContextToolbar(wordImageToolbar, activeWordImage);
    } else if (action === 'delete') {
      activeWordImage.remove();
      hideWordContextToolbars();
      showToast('Görsel silindi.');
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });

  wordTableToolbar?.addEventListener('mousedown', (e) => e.preventDefault());
  wordTableToolbar?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tbl-action]');
    if (!btn || !activeWordTableCell) return;
    const action = btn.dataset.tblAction;
    const row = activeWordTableCell.closest('tr');
    const table = activeWordTableCell.closest('table');
    if (!row || !table) return;

    const colIdx = Array.from(row.children).indexOf(activeWordTableCell);
    const colCount = row.children.length;

    if (action === 'addRowAbove' || action === 'addRowBelow') {
      const newRow = document.createElement('tr');
      for (let i = 0; i < colCount; i++) {
        const td = document.createElement('td');
        td.innerHTML = '<br>';
        newRow.appendChild(td);
      }
      if (action === 'addRowAbove') {
        row.parentNode.insertBefore(newRow, row);
      } else {
        row.parentNode.insertBefore(newRow, row.nextSibling);
      }
      positionContextToolbar(wordTableToolbar, table);
      showToast('Yeni satır eklendi.');
    } else if (action === 'addColLeft' || action === 'addColRight') {
      const allRows = table.querySelectorAll('tr');
      allRows.forEach((tr) => {
        const isHeader = tr.parentElement && tr.parentElement.tagName === 'THEAD';
        const cellEl = document.createElement(isHeader ? 'th' : 'td');
        cellEl.innerHTML = isHeader ? 'Başlık' : '<br>';
        const refCell = tr.children[colIdx];
        if (refCell) {
          tr.insertBefore(cellEl, action === 'addColLeft' ? refCell : refCell.nextSibling);
        } else {
          tr.appendChild(cellEl);
        }
      });
      positionContextToolbar(wordTableToolbar, table);
      showToast('Yeni sütun eklendi.');
    } else if (action === 'delRow') {
      const allRows = table.querySelectorAll('tr');
      if (allRows.length <= 1) {
        table.remove();
        hideWordContextToolbars();
      } else {
        row.remove();
        hideWordContextToolbars();
      }
      showToast('Satır silindi.');
    } else if (action === 'delCol') {
      if (colCount <= 1) {
        table.remove();
        hideWordContextToolbars();
      } else {
        table.querySelectorAll('tr').forEach((tr) => {
          if (tr.children[colIdx]) tr.children[colIdx].remove();
        });
        hideWordContextToolbars();
      }
      showToast('Sütun silindi.');
    } else if (action === 'delTable') {
      table.remove();
      hideWordContextToolbars();
      showToast('Tablo silindi.');
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  });

  document.addEventListener('click', (e) => {
    if (editor.contains(e.target)) return;
    if (wordImageToolbar && wordImageToolbar.contains(e.target)) return;
    if (wordTableToolbar && wordTableToolbar.contains(e.target)) return;
    hideWordContextToolbars();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideWordContextToolbars();
    }
  });

  // ========================================================================
  // Desktop A4 Zoom Controls (50% - 200% + Ctrl+Wheel)
  // ========================================================================
  const zoomSlider = document.getElementById('wordZoomSlider');
  const zoomOutBtn = document.getElementById('wordZoomOutBtn');
  const zoomInBtn = document.getElementById('wordZoomInBtn');
  const zoomLabel = document.getElementById('wordZoomLabel');
  let currentWordZoom = 100;

  function applyWordZoom(zoomPct) {
    currentWordZoom = Math.max(50, Math.min(200, Math.round(Number(zoomPct) || 100)));
    const container = document.getElementById('editorContainer');
    if (container) {
      container.style.zoom = `${currentWordZoom}%`;
    }
    if (zoomSlider) zoomSlider.value = String(currentWordZoom);
    if (zoomLabel) zoomLabel.textContent = `%${currentWordZoom}`;
  }

  zoomSlider?.addEventListener('input', (e) => {
    applyWordZoom(e.target.value);
  });

  zoomOutBtn?.addEventListener('click', () => {
    applyWordZoom(currentWordZoom - 10);
  });

  zoomInBtn?.addEventListener('click', () => {
    applyWordZoom(currentWordZoom + 10);
  });

  zoomLabel?.addEventListener('click', () => {
    applyWordZoom(100);
  });

  wordWorkspaceArea?.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      applyWordZoom(currentWordZoom + delta);
    }
  }, { passive: false });

});

