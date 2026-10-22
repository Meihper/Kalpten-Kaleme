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
  function updateStats() {
    if (statsRafId) cancelAnimationFrame(statsRafId);
    statsRafId = requestAnimationFrame(() => {
      const text = editor.innerText || '';
      const cleanText = text.trim();
      const words = cleanText ? cleanText.split(/\s+/).length : 0;
      const chars = text.length;
      const paragraphs = cleanText ? cleanText.split(/\n+/).filter(p => p.trim().length > 0).length : 0;
      const readingTime = Math.max(1, Math.ceil(words / 180));
      const pages = Math.max(1, Math.ceil(words / 250));

      if (wordCountStat) wordCountStat.textContent = `${words.toLocaleString()} Kelime`;
      if (charCountStat) charCountStat.textContent = `${chars.toLocaleString()} Harf`;
      if (readingTimeStat) readingTimeStat.textContent = `~${readingTime} dk okuma (${pages} sayfa)`;

      const endMarkerWords = document.getElementById('mobileDocEndWords');
      if (endMarkerWords) endMarkerWords.textContent = `✍️ ${words.toLocaleString()} Kelime`;

      const sheetWordCount = document.getElementById('sheetWordCount');
      if (sheetWordCount) sheetWordCount.textContent = words.toLocaleString();

      const sheetCharCount = document.getElementById('sheetCharCount');
      if (sheetCharCount) sheetCharCount.textContent = chars.toLocaleString();

      const sheetReadTime = document.getElementById('sheetReadTime');
      if (sheetReadTime) sheetReadTime.textContent = `${readingTime} dk`;
    });
  }

  const headerSaveStatus = document.getElementById('wordSaveStatus');

  // Auto-Save Draft with exact timestamp protection
  let autoSaveTimeout;
  editor.addEventListener('input', () => {
    updateStats();
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
  });

  // Restore draft if exists
  const savedDraft = localStorage.getItem('kalpten_kaleme_word_draft') || localStorage.getItem('studio_office_word_draft');
  const savedTitle = localStorage.getItem('kalpten_kaleme_word_title') || localStorage.getItem('studio_office_word_title');
  const isDummy = savedDraft && (savedDraft.includes('Gönülden dökülen kelimeler') || savedDraft.includes('Belge Başlığı') || savedDraft.includes('Yeni Yazı</h1>'));
  if (savedDraft && savedDraft.trim().length > 10 && !isDummy) {
    editor.innerHTML = savedDraft;
    if (savedTitle && docTitleInput) docTitleInput.value = savedTitle;
  } else {
    editor.innerHTML = '';
  }
  updateStats();

  // 2. Open Document (.docx / .txt / .html / .md)
  window.loadWordFromBuffer = function(arrayBuffer, fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      if (typeof switchTab === 'function') switchTab('pdfTab');
      if (window.loadPdfFromBuffer) window.loadPdfFromBuffer(arrayBuffer, fileName);
      return;
    }

    if (docTitleInput) docTitleInput.value = fileName;
    if (window.addRecentDocument) window.addRecentDocument(fileName, 'word');

    if (ext === 'docx') {
      if (window.mammoth) {
        window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
          .then(result => {
            editor.innerHTML = result.value || '<p></p>';
            updateStats();
            if (window.docManager) {
              window.docManager.onWordLoaded(fileName, editor.innerHTML, arrayBuffer);
            }
            showToast(`"${fileName}" Word belgesi başarıyla açıldı.`);
          })
          .catch(err => {
            console.error(err);
            showToast('DOCX belgesi açılırken hata oluştu: ' + err.message, 'error');
          });
      }
    } else if (ext === 'txt' || ext === 'md') {
      try {
        const text = new TextDecoder('utf-8').decode(arrayBuffer);
        const paragraphs = text.split(/\r?\n/).map(line => `<p>${line || '<br>'}</p>`).join('');
        editor.innerHTML = paragraphs;
        updateStats();
        if (window.docManager) {
          window.docManager.onWordLoaded(fileName, editor.innerHTML, arrayBuffer);
        }
        showToast(`"${fileName}" açıldı.`);
      } catch (err) {
        showToast('Metin dosyası açılamadı: ' + err.message, 'error');
      }
    } else if (ext === 'html') {
      try {
        const html = new TextDecoder('utf-8').decode(arrayBuffer);
        editor.innerHTML = html;
        updateStats();
        if (window.docManager) {
          window.docManager.onWordLoaded(fileName, editor.innerHTML, arrayBuffer);
        }
        showToast(`"${fileName}" açıldı.`);
      } catch (err) {
        showToast('HTML dosyası açılamadı: ' + err.message, 'error');
      }
    }
  };

  window.loadWordFile = function(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      window.loadWordFromBuffer(e.target.result, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      window.loadWordFile(e.target.files[0]);
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

  window.updateWordStats = updateStats;

  // 4. Save to .DOCX (Microsoft Word format & Google Drive Sync)
  window.saveWordDocument = async function() {
    let title = (docTitleInput?.value || 'Yeni Yazı').trim();
    if (!title.toLowerCase().endsWith('.docx')) {
      title += '.docx';
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #111; }
          h1 { font-size: 22pt; margin-bottom: 12pt; color: #0072DE; }
          h2 { font-size: 16pt; margin-top: 14pt; margin-bottom: 8pt; }
          h3 { font-size: 13pt; margin-top: 12pt; margin-bottom: 6pt; }
          p { margin-bottom: 8pt; }
          table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
          th, td { border: 1px solid #777; padding: 6pt 10pt; text-align: left; }
          th { background-color: #EEE; font-weight: bold; }
          blockquote { border-left: 4px solid #0072DE; padding-left: 10pt; color: #555; }
        </style>
      </head>
      <body>
        ${editor.innerHTML}
      </body>
      </html>
    `;

    const saveStatusEl = document.getElementById('wordSaveStatus');
    if (saveStatusEl) {
      saveStatusEl.textContent = '⏳ Kaydediliyor...';
      saveStatusEl.classList.add('saving');
    }

    try {
      let blob;
      if (window.htmlDocx && typeof window.htmlDocx.asBlob === 'function') {
        blob = window.htmlDocx.asBlob(htmlContent, {
          orientation: editor.classList.contains('orientation-landscape') ? 'landscape' : 'portrait',
          margins: { top: 720, right: 720, bottom: 720, left: 720 }
        });
      } else {
        blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
      }

      let savedDirectly = false;
      try {
        const resp = await fetch('/api/save-document?filename=' + encodeURIComponent(title), {
          method: 'POST',
          body: blob
        });
        if (resp.ok) {
          const resData = await resp.json();
          if (resData.success) {
            savedDirectly = true;
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
            if (window.addRecentDocument) {
              window.addRecentDocument(resData.filename || title, 'word');
            }
            let saveMsg = `"${title}" kaydedildi!`;
            if (resData.cloudProvider === 'gdrive' || resData.isGoogleDrive) {
              saveMsg = `"${title}" Google Drive'a kaydedildi ve eşitlendi!`;
            } else if (resData.cloudProvider === 'onedrive') {
              saveMsg = `"${title}" OneDrive'a kaydedildi ve eşitlendi!`;
            }
            showToast(saveMsg);
            if (window.loadDriveFiles) {
              window.loadDriveFiles();
            }
          }
        }
      } catch (fetchErr) {
        // Fallback to download below
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
          saveStatusEl.textContent = '● İndirildi';
          saveStatusEl.classList.remove('saving');
        }
        showToast(`"${title}" Word dosyası olarak indirildi.`);
      }
    } catch (err) {
      console.error(err);
      if (saveStatusEl) saveStatusEl.classList.remove('saving');
      showToast('Kayıt sırasında hata: ' + err.message, 'error');
    }
  };

  // 5. Export to PDF / Print (WYSIWYG: Ekranda görünenin 1:1 aynısını yazdır)
  window.printWordDocument = function() {
    const title = (docTitleInput?.value || 'Belge').replace(/\.docx$/i, '');
    
    let printIframe = document.getElementById('oneOfficePrintFrame');
    if (printIframe) printIframe.remove();

    printIframe = document.createElement('iframe');
    printIframe.id = 'oneOfficePrintFrame';
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = '0';
    document.body.appendChild(printIframe);

    // Uygulamanın tüm stil ve tema kurallarını birebir kopyala
    const stylesHtml = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    const doc = printIframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        ${stylesHtml}
        <style>
          @page {
            size: auto;
            margin: 4mm 6mm;
          }
          * {
            box-sizing: border-box !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            background: #fff !important;
            color: #111 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
          }
          .print-wrapper {
            width: 100%;
            max-width: 820px;
            margin: 0 auto;
            background: #fff;
            zoom: 0.84; /* Sayfayı %16 küçülterek tek sayfaya tam sığdırır */
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .word-canvas-sheet {
            background: #fff !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            min-height: 0 !important;
            height: auto !important;
            width: 100% !important;
            color: #111 !important;
          }
          table, tr, td, p, div {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        </style>
      </head>
      <body>
        <div class="print-wrapper">
          <div class="word-canvas-sheet">
            ${editor.innerHTML}
          </div>
        </div>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
      } catch (err) {
        window.print();
      }
    }, 250);
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
  document.querySelectorAll('#wordTab .tool-item, #wordTab .icon-btn, .word-formatting-bar .tool-btn').forEach(btn => {
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

  document.getElementById('wordFontSize')?.addEventListener('change', (e) => {
    const val = e.target.value;
    editor.focus();
    document.execCommand('fontSize', false, val);
    const sizeMap = { '1': '10pt', '2': '12pt', '3': '14pt', '4': '16pt', '5': '18pt', '6': '24pt', '7': '32pt' };
    editor.querySelectorAll('font[size]').forEach(f => {
      const span = document.createElement('span');
      span.style.fontSize = sizeMap[f.getAttribute('size')] || '16pt';
      span.innerHTML = f.innerHTML;
      f.parentNode.replaceChild(span, f);
    });
    updateStats();
    updateToolbarState();
  });

  // Word Editor Fast Color Presets & Popovers (No need to open OS spectrum for primary colors)
  let savedWordSelection = null;
  function saveCurrentSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedWordSelection = sel.getRangeAt(0);
    }
  }
  function restoreCurrentSelection() {
    if (savedWordSelection) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedWordSelection);
    }
  }

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
    }
  });

  // Insert Table
  document.getElementById('wordInsertTableBtn')?.addEventListener('click', () => {
    openModal('tableModal');
  });

  document.getElementById('confirmInsertTableBtn')?.addEventListener('click', () => {
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
    updateStats();
    showToast(`${rows}x${cols} Tablo eklendi.`);
  });

  // Insert Link
  document.getElementById('wordInsertLinkBtn')?.addEventListener('click', () => {
    const url = prompt('Bağlantı URL adresini girin:', 'https://');
    if (url && url !== 'https://') {
      executeCmd('createLink', url);
      showToast('Bağlantı eklendi.');
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

});
