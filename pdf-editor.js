/**
 * Belge & PDF Düzenleyici - PDF Motoru
 * Doğrudan Tıklayıp Metin Düzenleme, Word Entegrasyonu, Sayfa Yönetimi ve Vektörel PDF Kaydetme.
 */

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// Base64 Data URL to Uint8Array (Zero-fetch, 100% offline & synchronous)
function dataUrlToUint8Array(dataUrl) {
  const parts = dataUrl.split(',');
  const base64 = parts[1] || parts[0];
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const pdfState = {
  rawBytes: null,
  fileName: '',
  pdfDoc: null,
  numPages: 0,
  currentPage: 1,
  scale: 1.25,
  activeTool: 'editText', // 'editText', 'select', 'text', 'highlight', 'draw'
  pageRotations: {},
  pageOrder: [],          // 1-based original page indices
  annotations: [],        // New text boxes, highlights
  editedTexts: [],        // Direct in-place edits to existing PDF text
  images: []              // Inserted draggable and resizable images
};

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('pdfFileInput');
  const dropZone = document.getElementById('pdfDropZone');
  const pagesContainer = document.getElementById('pdfPagesContainer');
  const sidebar = document.getElementById('pdfSidebar');
  const globalSaveBtn = document.getElementById('globalSaveBtn');
  const globalPrintBtn = document.getElementById('globalPrintBtn');
  const docTitleEl = document.getElementById('pdfDocTitle');
  const pageIndicator = document.getElementById('pdfPageIndicator');
  const zoomLabel = document.getElementById('pdfZoomLabel');
  const organizePagesBtn = document.getElementById('pdfOrganizePagesBtn');
  const editInWordBtn = document.getElementById('pdfEditInWordBtn');

  // ========================================================================
  // 1. Tool Selection
  // ========================================================================
  function updateToolButtons() {
    document.querySelectorAll('#pdfTab .tool-item[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === pdfState.activeTool);
    });

    const isEditMode = (pdfState.activeTool === 'editText');
    document.querySelectorAll('.pdf-text-layer').forEach(layer => {
      layer.style.pointerEvents = isEditMode ? 'auto' : 'none';
    });
  }

  document.querySelectorAll('#pdfTab .tool-item[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      pdfState.activeTool = btn.dataset.tool;
      updateToolButtons();
      if (btn.dataset.tool === 'editText') {
        showToast('Metin Düzenleme Modu: Değiştirmek istediğiniz yazıya tıklayın.');
      } else if (btn.dataset.tool === 'text') {
        showToast('Yeni Metin Ekle: Sayfa üzerinde herhangi bir yere tıklayın.');
      } else if (btn.dataset.tool === 'highlight') {
        showToast('Vurgulayıcı: Vurgulamak istediğiniz yere tıklayın.');
      }
    });
  });
  updateToolButtons();

  // ========================================================================
  // 2. Open PDF (File Picker & Windows "Open With" API)
  // ========================================================================
  window.loadPdfFromBuffer = async function(arrayBuffer, fileName) {
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      showToast('Seçilen PDF dosyası boş veya okunamadı.', 'error');
      return;
    }

    pdfState.fileName = fileName || 'Belge.pdf';
    if (docTitleEl) {
      if ('value' in docTitleEl) {
        docTitleEl.value = pdfState.fileName;
      } else {
        docTitleEl.textContent = pdfState.fileName;
      }
    }
    // Keep an independent clone of the raw bytes so it is never detached by PDF.js worker
    pdfState.rawBytes = new Uint8Array(arrayBuffer.slice ? arrayBuffer.slice(0) : arrayBuffer);
    if (window.addRecentDocument) window.addRecentDocument(pdfState.fileName, 'pdf');

    try {
      if (!window.pdfjsLib) {
        throw new Error('PDF motoru henüz yüklenemedi. Lütfen sayfayı yenileyin.');
      }

      // Configure worker if not already running on main thread
      if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc && (!window.pdfjsWorker || !window.pdfjsWorker.WorkerMessageHandler)) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
      }

      const workerBytes = new Uint8Array(arrayBuffer.slice ? arrayBuffer.slice(0) : arrayBuffer);
      const loadingTask = window.pdfjsLib.getDocument({
        data: workerBytes,
        onPassword: function(updatePassword) {
          const pw = prompt('Bu PDF dosyası parola korumalıdır. Lütfen şifreyi girin:');
          if (pw) updatePassword(pw);
        }
      });

      pdfState.pdfDoc = await loadingTask.promise;
      pdfState.numPages = pdfState.pdfDoc.numPages;
      pdfState.currentPage = 1;
      pdfState.annotations = [];
      pdfState.editedTexts = [];
      pdfState.images = [];
      pdfState.pageRotations = {};
      pdfState.pageOrder = Array.from({ length: pdfState.numPages }, (_, i) => i + 1);

      if (globalSaveBtn) globalSaveBtn.disabled = false;
      if (globalPrintBtn) globalPrintBtn.disabled = false;
      if (organizePagesBtn) organizePagesBtn.disabled = false;
      if (editInWordBtn) editInWordBtn.disabled = false;
      if (dropZone) dropZone.style.display = 'none';
      if (pagesContainer) pagesContainer.style.display = 'flex';

      updatePageIndicator();
      await renderAllPages();
      
      try {
        await renderThumbnails();
      } catch (thumbErr) {
        console.warn('Thumbnails warning:', thumbErr);
      }

      updateToolButtons();
      showToast(`"${pdfState.fileName}" açıldı.`);
      if (window.docManager) {
        window.docManager.onPdfLoaded(pdfState.fileName, arrayBuffer);
      }
    } catch (err) {
      console.error('PDF load error:', err);
      showToast('PDF açılırken hata oluştu: ' + (err.message || 'Bilinmeyen hata'), 'error');
    }
  };

  window.loadPdfFile = function(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      window.loadPdfFromBuffer(e.target.result, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  fileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      window.loadPdfFile(e.target.files[0]);
    }
  });

  docTitleEl?.addEventListener('input', () => {
    const val = docTitleEl.value.trim();
    if (val) {
      pdfState.fileName = val;
      if (window.docManager) window.docManager.updateActiveDocTitle(val);
    }
  });

  docTitleEl?.addEventListener('blur', () => {
    let val = docTitleEl.value.trim();
    if (!val) val = 'Belge.pdf';
    if (!val.toLowerCase().endsWith('.pdf')) val += '.pdf';
    docTitleEl.value = val;
    pdfState.fileName = val;
    if (window.docManager) window.docManager.updateActiveDocTitle(val);
  });

  // ========================================================================
  // 3. Render Pages with Canvas + Direct Clickable Text Lines
  // ========================================================================
  async function renderAllPages() {
    if (!pdfState.pdfDoc || !pagesContainer) return;
    pagesContainer.innerHTML = '';

    for (let idx = 0; idx < pdfState.pageOrder.length; idx++) {
      const originalPageNum = pdfState.pageOrder[idx];
      const displayPageNum = idx + 1;
      const page = await pdfState.pdfDoc.getPage(originalPageNum);
      const rotation = (pdfState.pageRotations[originalPageNum] || 0);
      const viewport = page.getViewport({ scale: pdfState.scale, rotation: rotation });

      const pageWrapper = document.createElement('div');
      pageWrapper.className = 'pdf-page-wrapper';
      pageWrapper.id = `pdf-page-${displayPageNum}`;
      pageWrapper.dataset.pageNum = displayPageNum;
      pageWrapper.dataset.origPageNum = originalPageNum;
      pageWrapper.style.width = `${viewport.width}px`;
      pageWrapper.style.height = `${viewport.height}px`;

      // 1. Vector Canvas
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(outputScale, outputScale);
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // 2. Interactive Text Layer
      const textLayer = document.createElement('div');
      textLayer.className = 'pdf-text-layer';
      textLayer.dataset.pageNum = displayPageNum;

      // Extract text items from PDF.js
      const textContent = await page.getTextContent();
      const lines = groupTextItemsIntoLines(textContent.items || [], viewport, displayPageNum);

      lines.forEach((line, lineIdx) => {
        const lineEl = document.createElement('div');
        lineEl.className = 'pdf-text-line';
        lineEl.dataset.lineKey = line.key;
        lineEl.dataset.pageNum = displayPageNum;
        lineEl.style.left = `${line.x}px`;
        lineEl.style.top = `${line.y}px`;
        lineEl.style.width = `${Math.max(18, line.width)}px`;
        lineEl.style.height = `${Math.max(14, line.height)}px`;
        lineEl.style.fontSize = `${line.fontSize}px`;
        lineEl.title = `Düzenlemek için tıklayın: "${line.text}"`;

        // Attach references for Search & Replace
        lineEl._lineItemRef = line;
        lineEl._viewportRef = viewport;

        // Check if this line was previously edited
        const existingEdit = pdfState.editedTexts.find(e => e.page === displayPageNum && (e.lineKey === line.key || (e.originalText && e.originalText === line.text)));
        if (existingEdit) {
          lineEl.classList.add('text-modified');
          if (existingEdit.text === '') {
            lineEl.classList.add('text-erased');
            lineEl.innerText = '';
            lineEl.style.backgroundColor = existingEdit.bgColor || '#FFFFFF';
          } else {
            lineEl.innerText = existingEdit.text;
            lineEl.style.backgroundColor = existingEdit.bgColor || '#FFFFFF';
            lineEl.style.color = existingEdit.color || '#111827';
          }
          lineEl.style.fontSize = `${existingEdit.fontSize * pdfState.scale}px`;
          if (existingEdit.isBold) lineEl.style.fontWeight = 'bold';
          if (existingEdit.isItalic) lineEl.style.fontStyle = 'italic';
          if (existingEdit.fontFamily) lineEl.style.fontFamily = existingEdit.fontFamily;
        } else {
          lineEl.innerText = line.text;
        }

        // On Click -> Open Inline Text Popover
        lineEl.addEventListener('click', (e) => {
          e.stopPropagation();
          openInlineTextEditor(lineEl, line, displayPageNum, viewport);
        });

        textLayer.appendChild(lineEl);
      });

      // Re-render custom inserted texts on this page
      const pageCustomTexts = (pdfState.editedTexts || []).filter(e => e.page === displayPageNum && (e.isCustom || (e.lineKey && e.lineKey.startsWith('custom_'))));
      pageCustomTexts.forEach(cText => {
        const cEl = document.createElement('div');
        cEl.className = 'pdf-text-line text-modified is-custom-text';
        cEl.dataset.lineKey = cText.lineKey;
        cEl.dataset.pageNum = displayPageNum;
        const leftPx = Math.round(cText.pctX * viewport.width);
        const topPx = Math.round(cText.pctY * viewport.height);
        cEl.style.left = `${leftPx}px`;
        cEl.style.top = `${topPx}px`;
        cEl.style.fontSize = `${cText.fontSize * pdfState.scale}px`;
        cEl.style.color = cText.color || '#111827';
        if (cText.isBold) cEl.style.fontWeight = 'bold';
        if (cText.isItalic) cEl.style.fontStyle = 'italic';
        if (cText.fontFamily) cEl.style.fontFamily = cText.fontFamily;
        if (cText.shouldMask) cEl.style.backgroundColor = cText.bgColor || '#FFFFFF';
        cEl.innerText = cText.text;

        cEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const lineItem = {
            x: leftPx,
            y: topPx,
            width: cEl.offsetWidth || 120,
            height: cEl.offsetHeight || 22,
            fontSize: cText.fontSize * pdfState.scale,
            text: cText.text,
            key: cText.lineKey,
            isCustom: true
          };
          openInlineTextEditor(cEl, lineItem, displayPageNum, viewport);
        });

        textLayer.appendChild(cEl);
      });

      // 3. Annotation Layer (for highlights, new text boxes)
      const annotLayer = document.createElement('div');
      annotLayer.className = 'pdf-annotation-layer';
      annotLayer.dataset.pageNum = displayPageNum;

      pageWrapper.appendChild(canvas);
      pageWrapper.appendChild(textLayer);
      pageWrapper.appendChild(annotLayer);
      pagesContainer.appendChild(pageWrapper);

      setupAnnotLayerEvents(annotLayer, pageWrapper, displayPageNum, viewport);

      renderAnnotationsForPage(annotLayer, displayPageNum);

      // 4. Re-render inserted images on this page
      const pageImages = (pdfState.images || []).filter(img => img.page === displayPageNum);
      pageImages.forEach(imgRecord => {
        createImageBoxElement(pageWrapper, imgRecord);
      });
    }
  }

  // ========================================================================
  // 4. Group adjacent PDF text items into coherent, clickable lines
  // ========================================================================
  function groupTextItemsIntoLines(items, viewport, pageNum) {
    if (!items || items.length === 0) return [];

    const rawList = [];
    for (const item of items) {
      if (!item || !item.str || item.str.trim() === '') continue;
      const tx = item.transform; // [a, b, c, d, x, y]
      if (!Array.isArray(tx) || tx.length < 6) continue;

      try {
        // Convert PDF coordinate to Viewport Pixel coordinate
        const [vx, vy] = viewport.convertToViewportPoint(tx[4], tx[5]);
        const fontSizePt = Math.hypot(tx[0], tx[1]) || item.height || 12;
        const fontSizePx = Math.max(9, Math.round(fontSizePt * pdfState.scale));
        const widthPx = Math.max(8, (item.width || 8) * pdfState.scale);
        const heightPx = Math.max(12, fontSizePx * 1.25);
        const topPx = vy - fontSizePx;

        rawList.push({
          vx: Math.round(vx),
          vy: Math.round(vy),
          topPx: Math.round(topPx),
          widthPx: Math.round(widthPx),
          heightPx: Math.round(heightPx),
          fontSizePx: fontSizePx,
          fontName: item.fontName || '',
          text: item.str
        });
      } catch (lineErr) {}
    }

    // Sort by vertical baseline first, then left to right
    rawList.sort((a, b) => {
      if (Math.abs(a.vy - b.vy) > 4) return a.vy - b.vy;
      return a.vx - b.vx;
    });

    // Group adjacent items on the same line
    const lines = [];
    let curLine = null;

    for (const it of rawList) {
      if (!curLine) {
        curLine = {
          x: it.vx,
          y: it.topPx,
          baselineY: it.vy,
          width: it.widthPx,
          height: it.heightPx,
          fontSize: it.fontSizePx,
          fontName: it.fontName,
          text: it.text
        };
        continue;
      }

      const isSameLine = Math.abs(it.vy - curLine.baselineY) <= 4;
      const gap = it.vx - (curLine.x + curLine.width);
      // Stricter adjacency threshold (8px) so separate table columns or form fields are never merged
      const isAdjacent = gap >= -3 && gap <= 8;

      if (isSameLine && isAdjacent) {
        // Space should only be added if there was a real visual gap (at least 2.5px or 0.22 * fontSize)
        const isSpaceGap = gap >= Math.max(2.5, it.fontSizePx * 0.22);
        const needsSpace = isSpaceGap && !curLine.text.endsWith(' ') && !it.text.startsWith(' ') && !/^[\.,:;!?_\-\/\\)\]\}]/.test(it.text);
        curLine.text += (needsSpace ? ' ' : '') + it.text;
        curLine.width = (it.vx + it.widthPx) - curLine.x;
        curLine.height = Math.max(curLine.height, it.heightPx);
      } else {
        curLine.text = curLine.text.trim();
        lines.push(curLine);
        curLine = {
          x: it.vx,
          y: it.topPx,
          baselineY: it.vy,
          width: it.widthPx,
          height: it.heightPx,
          fontSize: it.fontSizePx,
          fontName: it.fontName,
          text: it.text
        };
      }
    }

    if (curLine) {
      curLine.text = curLine.text.trim();
      lines.push(curLine);
    }

    lines.forEach((l, idx) => {
      l.key = `p${pageNum}_line_${idx}`;
    });

    return lines;
  }

  // ========================================================================
  // 5. In-Place Live PDF Text Editor & Canvas Pixel Sampling
  // ========================================================================

  function hexToRgb(hex) {
    if (!hex) return { r: 255, g: 255, b: 255 };
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function sampleCanvasColor(pageWrapper, x, y, width, height) {
    const defaultRes = { textColor: '#111827', bgColor: '#FFFFFF' };
    if (!pageWrapper) return defaultRes;
    const canvas = pageWrapper.querySelector('.pdf-page-canvas');
    if (!canvas) return defaultRes;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return defaultRes;

    const scaleX = canvas.width / (canvas.offsetWidth || 1);
    const scaleY = canvas.height / (canvas.offsetHeight || 1);

    const cx = Math.max(0, Math.floor(x * scaleX));
    const cy = Math.max(0, Math.floor(y * scaleY));
    const cw = Math.max(1, Math.min(canvas.width - cx, Math.floor(width * scaleX)));
    const ch = Math.max(1, Math.min(canvas.height - cy, Math.floor(height * scaleY)));

    try {
      const imgData = ctx.getImageData(cx, cy, cw, ch);
      const data = imgData.data;
      if (!data || data.length < 4) return defaultRes;

      // Sample background from corner pixel
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];
      const bgHex = '#' + ((1 << 24) + (bgR << 16) + (bgG << 8) + bgB).toString(16).slice(1).toUpperCase();
      const bgBrightness = (bgR * 299 + bgG * 587 + bgB * 114) / 1000;

      // Find the text color: highest contrast or most saturated pixel with distance from bg
      let bestColor = null;
      let maxScore = -1;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 128) continue;

        const distFromBg = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        if (distFromBg < 35) continue;

        const pixelBrightness = (r * 299 + g * 587 + b * 114) / 1000;
        const contrast = Math.abs(pixelBrightness - bgBrightness);
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);

        const score = contrast + (saturation * 0.85);
        if (score > maxScore) {
          maxScore = score;
          bestColor = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        }
      }

      return {
        textColor: bestColor || (bgBrightness < 128 ? '#FFFFFF' : '#111827'),
        bgColor: bgHex
      };
    } catch (e) {
      console.warn('Canvas color sampling fallback:', e);
      return defaultRes;
    }
  }

  function openInlineTextEditor(lineEl, lineItem, pageNum, viewport) {
    // 1. Clean up any existing active editor across pages
    document.querySelectorAll('.pdf-inline-editor-input, .pdf-inline-floating-toolbar').forEach(el => el.remove());
    document.querySelectorAll('.pdf-text-line[data-editing="true"]').forEach(el => {
      el.style.opacity = '1';
      delete el.dataset.editing;
    });

    const existingEdit = pdfState.editedTexts.find(e => e.page === pageNum && e.lineKey === lineItem.key);
    const currentText = existingEdit ? existingEdit.text : (lineEl.classList.contains('text-modified') ? lineEl.innerText : lineItem.text);
    const currentFontSize = existingEdit ? (existingEdit.fontSize * pdfState.scale) : (parseFloat(lineEl.style.fontSize) || lineItem.fontSize);
    let activeFontFamily = existingEdit ? (existingEdit.fontFamily || 'sans-serif') : 'sans-serif';
    let isBold = existingEdit ? !!existingEdit.isBold : false;
    let isItalic = existingEdit ? !!existingEdit.isItalic : false;

    // Auto-detect font style & family from PDF metadata if not previously edited
    if (!existingEdit && lineItem.fontName) {
      const fn = lineItem.fontName.toLowerCase();
      if (fn.includes('bold') || fn.includes('black') || fn.includes('heavy') || fn.includes('w7') || fn.includes('w8') || fn.includes('w9')) {
        isBold = true;
      }
      if (fn.includes('italic') || fn.includes('oblique')) {
        isItalic = true;
      }
      if (fn.includes('serif') || fn.includes('times') || fn.includes('roman') || fn.includes('georgia') || fn.includes('cambria')) {
        activeFontFamily = 'serif';
      } else if (fn.includes('mono') || fn.includes('courier') || fn.includes('consolas')) {
        activeFontFamily = 'monospace';
      }
    }

    const pageWrapper = lineEl.closest('.pdf-page-wrapper');
    const sampled = sampleCanvasColor(pageWrapper, lineItem.x, lineItem.y, lineItem.width, lineItem.height);

    const originalTextColor = existingEdit?.color || sampled.textColor || '#111827';
    const detectedBgColor = existingEdit?.bgColor || sampled.bgColor || '#FFFFFF';
    let activeColor = originalTextColor;
    let activeFontSize = Math.max(9, Math.round(currentFontSize));

    // Hide original line element during active editing
    lineEl.dataset.editing = 'true';
    lineEl.style.opacity = '0';

    // 2. Create in-place input aligned exactly with text line
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pdf-inline-editor-input';
    input.value = currentText;
    input.style.left = `${lineItem.x - 2}px`;
    input.style.top = `${lineItem.y - 2}px`;
    const minW = Math.max(lineItem.width + 16, 90);
    input.style.width = `${minW}px`;
    input.style.height = `${Math.max(lineItem.height + 4, 22)}px`;
    input.style.fontSize = `${activeFontSize}px`;
    input.style.fontFamily = activeFontFamily === 'serif' ? 'Times New Roman, serif' : (activeFontFamily === 'monospace' ? 'Courier New, monospace' : 'Arial, sans-serif');
    input.style.fontWeight = isBold ? 'bold' : 'normal';
    input.style.fontStyle = isItalic ? 'italic' : 'normal';
    input.style.color = activeColor;
    input.style.backgroundColor = detectedBgColor;

    input.addEventListener('input', () => {
      input.style.width = `${Math.max(minW, input.scrollWidth + 14)}px`;
    });

    // 3. Create sleek floating micro-toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'pdf-inline-floating-toolbar';
    let toolbarTop = lineItem.y - 42;
    if (toolbarTop < 6) {
      toolbarTop = lineItem.y + lineItem.height + 8;
    }
    const toolbarLeft = Math.max(6, Math.min((pageWrapper.clientWidth || 800) - 380, lineItem.x - 4));
    toolbar.style.top = `${toolbarTop}px`;
    toolbar.style.left = `${toolbarLeft}px`;

    toolbar.innerHTML = `
      <div class="inline-tool-group">
        <button type="button" class="inline-tool-btn ${isBold ? 'active' : ''}" id="inlineBoldBtn" title="Kalın (B)"><b>B</b></button>
        <button type="button" class="inline-tool-btn ${isItalic ? 'active' : ''}" id="inlineItalicBtn" title="İtalik (I)"><i>I</i></button>
        <button type="button" class="inline-tool-btn" id="inlineFontMinus" title="Yazıyı Küçült">A−</button>
        <span class="inline-size-badge" id="inlineFontSizeLabel">${activeFontSize}px</span>
        <button type="button" class="inline-tool-btn" id="inlineFontPlus" title="Yazıyı Büyüt">A+</button>
      </div>
      <div class="inline-tool-sep"></div>
      <div class="inline-colors-group" id="inlineColorsGroup">
        <button type="button" class="inline-color-swatch original-badge ${activeColor === originalTextColor ? 'active-swatch' : ''}" data-color="${originalTextColor}" style="background: ${originalTextColor};" title="Orijinal Renk (${originalTextColor})"></button>
        <button type="button" class="inline-color-swatch ${activeColor === '#111827' && originalTextColor !== '#111827' ? 'active-swatch' : ''}" data-color="#111827" style="background: #111827;" title="Siyah"></button>
        <button type="button" class="inline-color-swatch ${activeColor === '#1E40AF' && originalTextColor !== '#1E40AF' ? 'active-swatch' : ''}" data-color="#1E40AF" style="background: #1E40AF;" title="Lacivert"></button>
        <button type="button" class="inline-color-swatch ${activeColor === '#DC2626' && originalTextColor !== '#DC2626' ? 'active-swatch' : ''}" data-color="#DC2626" style="background: #DC2626;" title="Kırmızı"></button>
        <button type="button" class="inline-color-swatch ${activeColor === '#16A34A' && originalTextColor !== '#16A34A' ? 'active-swatch' : ''}" data-color="#16A34A" style="background: #16A34A;" title="Yeşil"></button>
        <button type="button" class="inline-color-swatch ${activeColor === '#7C3AED' && originalTextColor !== '#7C3AED' ? 'active-swatch' : ''}" data-color="#7C3AED" style="background: #7C3AED;" title="Mor"></button>
        <label class="inline-color-picker-label" title="Özel Renk Seç (Skala)">
          <input type="color" id="inlineCustomColor" value="${activeColor}">
          <span>🎨</span>
        </label>
      </div>
      <div class="inline-tool-sep"></div>
      <div class="inline-tool-group">
        <button type="button" class="inline-action-pill delete-pill" id="inlineDeleteBtn" title="Metni Sil / Beyazlat">🗑 Sil</button>
        <button type="button" class="inline-action-pill save-pill" id="inlineSaveBtn" title="Uygula (Enter)">✓</button>
        <button type="button" class="inline-action-pill cancel-pill" id="inlineCancelBtn" title="Vazgeç (Esc)">✕</button>
      </div>
    `;

    pageWrapper.appendChild(input);
    pageWrapper.appendChild(toolbar);

    input.focus();
    input.select();

    const fontLabel = toolbar.querySelector('#inlineFontSizeLabel');
    const boldBtn = toolbar.querySelector('#inlineBoldBtn');
    const italicBtn = toolbar.querySelector('#inlineItalicBtn');
    const customColorInput = toolbar.querySelector('#inlineCustomColor');

    boldBtn.onclick = (e) => {
      e.stopPropagation();
      isBold = !isBold;
      boldBtn.classList.toggle('active', isBold);
      input.style.fontWeight = isBold ? 'bold' : 'normal';
    };

    italicBtn.onclick = (e) => {
      e.stopPropagation();
      isItalic = !isItalic;
      italicBtn.classList.toggle('active', isItalic);
      input.style.fontStyle = isItalic ? 'italic' : 'normal';
    };

    toolbar.querySelector('#inlineFontMinus').onclick = (e) => {
      e.stopPropagation();
      if (activeFontSize > 8) {
        activeFontSize -= 1;
        fontLabel.textContent = `${activeFontSize}px`;
        input.style.fontSize = `${activeFontSize}px`;
      }
    };

    toolbar.querySelector('#inlineFontPlus').onclick = (e) => {
      e.stopPropagation();
      if (activeFontSize < 72) {
        activeFontSize += 1;
        fontLabel.textContent = `${activeFontSize}px`;
        input.style.fontSize = `${activeFontSize}px`;
      }
    };

    function updateActiveColor(newColor) {
      activeColor = newColor;
      input.style.color = activeColor;
      toolbar.querySelectorAll('.inline-color-swatch').forEach(sw => {
        sw.classList.toggle('active-swatch', sw.dataset.color.toUpperCase() === activeColor.toUpperCase());
      });
      if (customColorInput) customColorInput.value = activeColor;
    }

    toolbar.querySelectorAll('.inline-color-swatch').forEach(swatch => {
      swatch.onclick = (e) => {
        e.stopPropagation();
        updateActiveColor(swatch.dataset.color);
      };
    });

    customColorInput.oninput = (e) => {
      updateActiveColor(e.target.value);
    };

    function cleanup() {
      input.remove();
      toolbar.remove();
      lineEl.style.opacity = '1';
      delete lineEl.dataset.editing;
    }

    function applyChanges() {
      const newText = input.value.trim();
      const isCustom = Boolean(lineItem.isCustom || (lineItem.key && lineItem.key.startsWith('custom_')));

      if (newText) {
        lineEl.innerText = newText;
        lineEl.classList.remove('text-erased');
        lineEl.classList.add('text-modified');
        if (isCustom) lineEl.classList.add('is-custom-text');
        lineEl.style.backgroundColor = isCustom ? 'transparent' : (detectedBgColor || '#FFFFFF');
        lineEl.style.color = activeColor;
        lineEl.style.fontSize = `${activeFontSize}px`;
        lineEl.style.fontWeight = isBold ? 'bold' : 'normal';
        lineEl.style.fontStyle = isItalic ? 'italic' : 'normal';
        lineEl.style.fontFamily = activeFontFamily === 'serif' ? 'Times New Roman, serif' : (activeFontFamily === 'monospace' ? 'Courier New, monospace' : 'Arial, sans-serif');
        lineEl.style.width = 'auto';
        lineEl.style.opacity = '1';
        delete lineEl.dataset.editing;

        const editRecord = {
          id: existingEdit ? existingEdit.id : ('edit_' + Date.now()),
          page: pageNum,
          lineKey: lineItem.key,
          pctX: lineItem.x / viewport.width,
          pctY: lineItem.y / viewport.height,
          pctW: Math.max(0.015, Math.max(lineItem.width, input.scrollWidth + 4) / viewport.width),
          pctH: Math.max(0.012, (lineEl.offsetHeight || lineItem.height) / viewport.height),
          fontSize: activeFontSize / pdfState.scale,
          fontFamily: activeFontFamily,
          isBold: isBold,
          isItalic: isItalic,
          color: activeColor,
          bgColor: isCustom ? 'transparent' : (detectedBgColor || '#FFFFFF'),
          text: newText,
          originalText: lineItem.text || '',
          shouldMask: !isCustom,
          isCustom: isCustom
        };

        pdfState.editedTexts = pdfState.editedTexts.filter(e => !(e.page === pageNum && e.lineKey === lineItem.key));
        pdfState.editedTexts.push(editRecord);

        showToast(isCustom ? 'Yeni metin eklendi.' : 'Metin güncellendi.');
      } else {
        if (isCustom) {
          pdfState.editedTexts = pdfState.editedTexts.filter(e => !(e.page === pageNum && e.lineKey === lineItem.key));
          lineEl.remove();
        } else {
          // Erase / Whiteout original text
          lineEl.innerText = '';
          lineEl.classList.add('text-modified', 'text-erased');
          lineEl.style.backgroundColor = detectedBgColor || '#FFFFFF';
          lineEl.style.opacity = '1';
          delete lineEl.dataset.editing;

          const eraseRecord = {
            id: existingEdit ? existingEdit.id : ('edit_' + Date.now()),
            page: pageNum,
            lineKey: lineItem.key,
            pctX: lineItem.x / viewport.width,
            pctY: lineItem.y / viewport.height,
            pctW: Math.max(0.015, lineItem.width / viewport.width),
            pctH: Math.max(0.012, (lineEl.offsetHeight || lineItem.height) / viewport.height),
            fontSize: activeFontSize / pdfState.scale,
            fontFamily: activeFontFamily,
            isBold: false,
            isItalic: false,
            color: 'transparent',
            bgColor: detectedBgColor || '#FFFFFF',
            text: '',
            originalText: lineItem.text || '',
            shouldMask: true,
            isCustom: false
          };
          pdfState.editedTexts = pdfState.editedTexts.filter(e => !(e.page === pageNum && e.lineKey === lineItem.key));
          pdfState.editedTexts.push(eraseRecord);
          showToast('Metin silindi (beyazlatıldı).');
        }
      }
      input.remove();
      toolbar.remove();
    }

    toolbar.querySelector('#inlineDeleteBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      input.value = '';
      applyChanges();
    });

    toolbar.querySelector('#inlineSaveBtn').onclick = (e) => {
      e.stopPropagation();
      applyChanges();
    };

    toolbar.querySelector('#inlineCancelBtn').onclick = (e) => {
      e.stopPropagation();
      if (lineItem.key && lineItem.key.startsWith('custom_') && !existingEdit) {
        lineEl.remove();
      }
      cleanup();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyChanges();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (lineItem.key && lineItem.key.startsWith('custom_') && !existingEdit) {
          lineEl.remove();
        }
        cleanup();
      }
    });
  }

  // ========================================================================
  // 6. Annotations (New Freeform Text & Highlight)
  // ========================================================================
  function setupAnnotLayerEvents(layer, pageWrapper, pageNum, viewport) {
    if (!pageWrapper && layer) {
      pageWrapper = layer.closest('.pdf-page-wrapper');
    }
    if (!pageWrapper) return;

    pageWrapper.addEventListener('click', (e) => {
      // If clicking directly on a text line or popover, ignore
      if (e.target.closest('.pdf-text-line') || e.target.closest('.inline-text-popover') || e.target.closest('.annotation-box')) {
        return;
      }

      if (pdfState.activeTool === 'text') {
        const rect = pageWrapper.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Open popover to insert brand new text anywhere
        const dummyLine = {
          x: clickX,
          y: clickY,
          width: 120,
          height: 20,
          fontSize: 14 * pdfState.scale,
          text: '',
          key: `custom_${Date.now()}`,
          isCustom: true
        };

        const dummyEl = document.createElement('div');
        dummyEl.className = 'pdf-text-line text-modified is-custom-text';
        dummyEl.style.left = `${clickX}px`;
        dummyEl.style.top = `${clickY}px`;
        dummyEl.style.fontSize = `${dummyLine.fontSize}px`;
        pageWrapper.querySelector('.pdf-text-layer').appendChild(dummyEl);

        openInlineTextEditor(dummyEl, dummyLine, pageNum, viewport);
      } else if (pdfState.activeTool === 'highlight') {
        const rect = pageWrapper.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        addAnnotation({
          id: 'annot_' + Date.now(),
          page: pageNum,
          type: 'highlight',
          pctX: clickX / viewport.width,
          pctY: clickY / viewport.height,
          pctW: 140 / viewport.width,
          pctH: 24 / viewport.height,
          width: 140,
          height: 24
        });
        showToast('Vurgulayıcı eklendi.');
      }
    });
  }

  function addAnnotation(annot) {
    pdfState.annotations.push(annot);
    const layer = document.querySelector(`.pdf-annotation-layer[data-page-num="${annot.page}"]`);
    if (layer) createAnnotationElement(layer, annot);
  }

  function renderAnnotationsForPage(layer, pageNum) {
    const pageAnnots = pdfState.annotations.filter(a => a.page === pageNum);
    pageAnnots.forEach(a => createAnnotationElement(layer, a));
  }

  function createAnnotationElement(layer, annot) {
    const box = document.createElement('div');
    box.className = 'annotation-box';
    box.id = annot.id;

    const layerWidth = layer.clientWidth;
    const layerHeight = layer.clientHeight;

    box.style.left = `${annot.pctX * layerWidth}px`;
    box.style.top = `${annot.pctY * layerHeight}px`;
    box.style.width = `${annot.pctW ? annot.pctW * layerWidth : annot.width}px`;
    box.style.height = `${annot.pctH ? annot.pctH * layerHeight : annot.height}px`;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Kaldır';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      pdfState.annotations = pdfState.annotations.filter(a => a.id !== annot.id);
      box.remove();
    };
    box.appendChild(removeBtn);

    if (annot.type === 'highlight') {
      box.style.background = 'rgba(255, 235, 59, 0.45)';
      box.style.border = '1px solid rgba(255, 215, 0, 0.7)';
    }

    // Dragging with clean event binding
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(0, Math.min(layer.clientWidth - box.offsetWidth, initialLeft + dx));
      const newTop = Math.max(0, Math.min(layer.clientHeight - box.offsetHeight, initialTop + dy));

      box.style.left = `${newLeft}px`;
      box.style.top = `${newTop}px`;

      annot.pctX = newLeft / layer.clientWidth;
      annot.pctY = newTop / layer.clientHeight;
    };

    const onMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        box.style.zIndex = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
    };

    box.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseFloat(box.style.left) || 0;
      initialTop = parseFloat(box.style.top) || 0;
      box.style.zIndex = '50';
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    layer.appendChild(box);
  }

  // ========================================================================
  // 6b. PDF Image Insertion & Placement (Draggable & Resizable)
  // ========================================================================
  const pdfInsertImageBtn = document.getElementById('pdfInsertImageBtn');
  const pdfImageFileInput = document.getElementById('pdfImageFileInput');

  pdfInsertImageBtn?.addEventListener('click', () => {
    if (!pdfState.pdfDoc) {
      showToast('Lütfen önce bir PDF belgesi açın.', 'error');
      return;
    }
    pdfImageFileInput?.click();
  });

  pdfImageFileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = function(evt) {
        insertImageToPdf(evt.target.result);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  });

  function insertImageToPdf(dataUrl) {
    const pageNum = pdfState.currentPage;
    const pageCanvas = document.getElementById(`pdf-page-${pageNum}`);
    const pageWrapper = pageCanvas?.parentElement;
    if (!pageWrapper) {
      showToast('Sayfa bulunamadı.', 'error');
      return;
    }

    const img = new Image();
    img.onload = () => {
      const pw = pageWrapper.clientWidth;
      const ph = pageWrapper.clientHeight;

      let initW = Math.min(220, pw * 0.45);
      let initH = (img.naturalHeight / img.naturalWidth) * initW;
      if (initH > ph * 0.45) {
        initH = ph * 0.45;
        initW = (img.naturalWidth / img.naturalHeight) * initH;
      }

      const initX = (pw - initW) / 2;
      const initY = (ph - initH) / 2;

      const imgRecord = {
        id: 'img_' + Date.now(),
        page: pageNum,
        dataUrl: dataUrl,
        pctX: initX / pw,
        pctY: initY / ph,
        pctW: initW / pw,
        pctH: initH / ph
      };

      if (!pdfState.images) pdfState.images = [];
      pdfState.images.push(imgRecord);

      createImageBoxElement(pageWrapper, imgRecord);
      showToast('Resim PDF sayfasına eklendi! Sürükleyerek taşıyabilir, köşesinden boyutlandırabilirsiniz.');
    };
    img.src = dataUrl;
  }

  function createImageBoxElement(pageWrapper, imgRecord) {
    const box = document.createElement('div');
    box.className = 'pdf-image-box active';
    box.id = imgRecord.id;

    const pw = pageWrapper.clientWidth;
    const ph = pageWrapper.clientHeight;

    box.style.left = `${imgRecord.pctX * pw}px`;
    box.style.top = `${imgRecord.pctY * ph}px`;
    box.style.width = `${imgRecord.pctW * pw}px`;
    box.style.height = `${imgRecord.pctH * ph}px`;

    const imgEl = document.createElement('img');
    imgEl.src = imgRecord.dataUrl;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'img-remove-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Resmi Sil';
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      pdfState.images = (pdfState.images || []).filter(item => item.id !== imgRecord.id);
      box.remove();
      showToast('Resim kaldırıldı.');
    };

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'img-resize-handle';
    resizeHandle.title = 'Boyutlandır';

    box.appendChild(imgEl);
    box.appendChild(removeBtn);
    box.appendChild(resizeHandle);
    pageWrapper.appendChild(box);

    // Dragging & Resizing with clean event handling
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let initialLeft = 0, initialTop = 0;

    let isResizing = false;
    let resizeStartX = 0, resizeStartY = 0;
    let initialWidth = 0, initialHeight = 0;

    const onImageMouseMove = (e) => {
      if (isDragging) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        const newLeft = Math.max(0, Math.min(pageWrapper.clientWidth - box.offsetWidth, initialLeft + dx));
        const newTop = Math.max(0, Math.min(pageWrapper.clientHeight - box.offsetHeight, initialTop + dy));
        box.style.left = `${newLeft}px`;
        box.style.top = `${newTop}px`;
        imgRecord.pctX = newLeft / pageWrapper.clientWidth;
        imgRecord.pctY = newTop / pageWrapper.clientHeight;
      } else if (isResizing) {
        const dx = e.clientX - resizeStartX;
        const dy = e.clientY - resizeStartY;
        const newW = Math.max(40, Math.min(pageWrapper.clientWidth - box.offsetLeft, initialWidth + dx));
        const newH = Math.max(30, Math.min(pageWrapper.clientHeight - box.offsetTop, initialHeight + dy));
        box.style.width = `${newW}px`;
        box.style.height = `${newH}px`;
        imgRecord.pctW = newW / pageWrapper.clientWidth;
        imgRecord.pctH = newH / pageWrapper.clientHeight;
      }
    };

    const onImageMouseUp = () => {
      if (isDragging || isResizing) {
        isDragging = false;
        isResizing = false;
        window.removeEventListener('mousemove', onImageMouseMove);
        window.removeEventListener('mouseup', onImageMouseUp);
      }
    };

    box.addEventListener('mousedown', (e) => {
      if (e.target === removeBtn || e.target === resizeHandle) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLeft = parseFloat(box.style.left) || 0;
      initialTop = parseFloat(box.style.top) || 0;
      document.querySelectorAll('.pdf-image-box').forEach(b => b.classList.remove('active'));
      box.classList.add('active');
      e.preventDefault();
      window.addEventListener('mousemove', onImageMouseMove);
      window.addEventListener('mouseup', onImageMouseUp);
    });

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      initialWidth = parseFloat(box.style.width) || box.offsetWidth;
      initialHeight = parseFloat(box.style.height) || box.offsetHeight;
      e.stopPropagation();
      e.preventDefault();
      window.addEventListener('mousemove', onImageMouseMove);
      window.addEventListener('mouseup', onImageMouseUp);
    });
  }

  // ========================================================================
  // 6c. PDF Signature Studio (Drawing, Touch/Mouse, Colors, Clear)
  // ========================================================================
  const pdfSignBtn = document.getElementById('pdfSignBtn');
  const signatureCanvas = document.getElementById('signatureCanvas');
  const clearSignatureBtn = document.getElementById('clearSignatureBtn');
  const applySignatureBtn = document.getElementById('applySignatureBtn');
  let signCtx = null;
  let isSigning = false;
  let signInkColor = '#0F172A';
  let hasSigned = false;

  function initSignatureCanvas() {
    if (!signatureCanvas) return;
    signCtx = signatureCanvas.getContext('2d');
    signCtx.lineWidth = 2.5;
    signCtx.lineCap = 'round';
    signCtx.lineJoin = 'round';
    signCtx.strokeStyle = signInkColor;
    clearSignatureCanvas();
  }

  function clearSignatureCanvas() {
    if (!signatureCanvas || !signCtx) return;
    signCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
    hasSigned = false;
  }

  function getSignPos(e) {
    const rect = signatureCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = signatureCanvas.width / rect.width;
    const scaleY = signatureCanvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function startSign(e) {
    if (!signCtx) initSignatureCanvas();
    isSigning = true;
    hasSigned = true;
    const pos = getSignPos(e);
    signCtx.beginPath();
    signCtx.moveTo(pos.x, pos.y);
    if (e.cancelable) e.preventDefault();
  }

  function moveSign(e) {
    if (!isSigning) return;
    const pos = getSignPos(e);
    signCtx.lineTo(pos.x, pos.y);
    signCtx.stroke();
    if (e.cancelable) e.preventDefault();
  }

  function endSign() {
    if (isSigning) {
      signCtx.closePath();
      isSigning = false;
    }
  }

  if (signatureCanvas) {
    signatureCanvas.addEventListener('mousedown', startSign);
    signatureCanvas.addEventListener('mousemove', moveSign);
    window.addEventListener('mouseup', endSign);

    signatureCanvas.addEventListener('touchstart', startSign, { passive: false });
    signatureCanvas.addEventListener('touchmove', moveSign, { passive: false });
    signatureCanvas.addEventListener('touchend', endSign);
    signatureCanvas.addEventListener('touchcancel', endSign);
  }

  pdfSignBtn?.addEventListener('click', () => {
    if (!pdfState.pdfDoc) {
      showToast('Lütfen önce bir PDF belgesi açın.', 'error');
      return;
    }
    openModal('signatureModal');
    setTimeout(() => {
      initSignatureCanvas();
    }, 50);
  });

  clearSignatureBtn?.addEventListener('click', () => {
    clearSignatureCanvas();
  });

  document.querySelectorAll('.sign-color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.sign-color-dot').forEach(d => {
        d.classList.remove('active');
        d.style.boxShadow = '0 0 0 1px #CBD5E1';
      });
      dot.classList.add('active');
      dot.style.boxShadow = '0 0 0 2px var(--accent-primary)';
      signInkColor = dot.dataset.color || '#0F172A';
      if (signCtx) signCtx.strokeStyle = signInkColor;
    });
  });

  function isCanvasBlank(canvas) {
    try {
      const context = canvas.getContext('2d');
      const pixelBuffer = new Uint32Array(
        context.getImageData(0, 0, canvas.width, canvas.height).data.buffer
      );
      return !pixelBuffer.some(color => color !== 0);
    } catch (_) {
      return false;
    }
  }

  applySignatureBtn?.addEventListener('click', () => {
    if (!hasSigned && isCanvasBlank(signatureCanvas)) {
      showToast('Lütfen önce kutu içerisine imzanızı çizin.', 'error');
      return;
    }
    const dataUrl = signatureCanvas.toDataURL('image/png');
    insertImageToPdf(dataUrl);
    closeModal('signatureModal');
    clearSignatureCanvas();
    showToast('İmzanız PDF sayfasına eklendi! Dilediğiniz konuma taşıyabilirsiniz.');
  });

  // ========================================================================
  // 7. Thumbnails and Navigation
  // ========================================================================
  async function renderThumbnails() {
    if (!pdfState.pdfDoc || !sidebar) return;
    sidebar.innerHTML = '';

    for (let idx = 0; idx < pdfState.pageOrder.length; idx++) {
      const origNum = pdfState.pageOrder[idx];
      const dispNum = idx + 1;
      const page = await pdfState.pdfDoc.getPage(origNum);
      const viewport = page.getViewport({ scale: 0.22 });

      const card = document.createElement('div');
      card.className = `thumbnail-card ${dispNum === pdfState.currentPage ? 'active' : ''}`;
      card.dataset.pageNum = dispNum;

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = viewport.width;
      thumbCanvas.height = viewport.height;
      const ctx = thumbCanvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const label = document.createElement('span');
      label.className = 'thumbnail-label';
      label.textContent = `Sayfa ${dispNum}`;

      card.appendChild(thumbCanvas);
      card.appendChild(label);

      card.addEventListener('click', () => {
        pdfState.currentPage = dispNum;
        updatePageIndicator();
        scrollToPage(dispNum);
      });

      sidebar.appendChild(card);
    }
  }

  function scrollToPage(pageNum) {
    const el = document.getElementById(`pdf-page-${pageNum}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelectorAll('.thumbnail-card').forEach(c => {
      c.classList.toggle('active', parseInt(c.dataset.pageNum) === pageNum);
    });
  }

  function updatePageIndicator() {
    if (pageIndicator) {
      pageIndicator.textContent = `${pdfState.currentPage} / ${pdfState.pageOrder.length}`;
    }
    if (zoomLabel) {
      zoomLabel.textContent = `%${Math.round(pdfState.scale * 100)}`;
    }
  }

  // Zoom
  document.getElementById('pdfZoomInBtn')?.addEventListener('click', async () => {
    if (pdfState.scale < 2.5) {
      pdfState.scale += 0.2;
      updatePageIndicator();
      await renderAllPages();
    }
  });

  document.getElementById('pdfZoomOutBtn')?.addEventListener('click', async () => {
    if (pdfState.scale > 0.6) {
      pdfState.scale -= 0.2;
      updatePageIndicator();
      await renderAllPages();
    }
  });

  // Prev / Next Page
  document.getElementById('pdfPrevPageBtn')?.addEventListener('click', () => {
    if (pdfState.currentPage > 1) {
      pdfState.currentPage--;
      updatePageIndicator();
      scrollToPage(pdfState.currentPage);
    }
  });

  document.getElementById('pdfNextPageBtn')?.addEventListener('click', () => {
    if (pdfState.currentPage < pdfState.pageOrder.length) {
      pdfState.currentPage++;
      updatePageIndicator();
      scrollToPage(pdfState.currentPage);
    }
  });

  // Rotate Page
  document.getElementById('pdfRotateBtn')?.addEventListener('click', async () => {
    const curIdx = pdfState.currentPage - 1;
    const origNum = pdfState.pageOrder[curIdx];
    pdfState.pageRotations[origNum] = ((pdfState.pageRotations[origNum] || 0) + 90) % 360;
    await renderAllPages();
    await renderThumbnails();
    showToast(`Sayfa ${pdfState.currentPage} 90° döndürüldü.`);
  });

  // Delete Page
  document.getElementById('pdfDeletePageBtn')?.addEventListener('click', async () => {
    if (pdfState.pageOrder.length <= 1) {
      showToast('Belgedeki son sayfa silinemez.', 'error');
      return;
    }
    if (confirm(`Sayfa ${pdfState.currentPage} belgeden silinsin mi?`)) {
      const curIdx = pdfState.currentPage - 1;
      pdfState.pageOrder.splice(curIdx, 1);
      pdfState.currentPage = Math.min(pdfState.currentPage, pdfState.pageOrder.length);
      updatePageIndicator();
      await renderAllPages();
      await renderThumbnails();
      showToast('Sayfa silindi.');
    }
  });

  document.getElementById('pdfToggleSidebarBtn')?.addEventListener('click', () => {
    if (sidebar) sidebar.classList.toggle('collapsed');
  });

  // ========================================================================
  // 8. Open Full PDF in Word Editor ("Word'de Tam Düzenle")
  // ========================================================================
  editInWordBtn?.addEventListener('click', async () => {
    if (!pdfState.pdfDoc) return;
    try {
      showToast('PDF metinleri ve biçimlendirmesi Word düzenleyicisine aktarılıyor...');
      let fullHtml = '';

      for (let i = 1; i <= pdfState.numPages; i++) {
        const page = await pdfState.pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        // Extract items with visual positions
        const items = [];
        for (const it of (textContent.items || [])) {
          if (!it.str || it.str.trim() === '') continue;
          const tx = it.transform; // [a, b, c, d, x, y]
          const fontSize = Math.round(Math.hypot(tx[0], tx[1]) || it.height || 12);
          items.push({
            str: it.str,
            x: Math.round(tx[4]),
            y: Math.round(tx[5]), // PDF Y is from bottom
            width: Math.round(it.width || 0),
            fontSize: fontSize,
            fontName: it.fontName || ''
          });
        }

        // Sort top-to-bottom (descending Y in PDF), then left-to-right
        items.sort((a, b) => {
          if (Math.abs(a.y - b.y) > 4) return b.y - a.y;
          return a.x - b.x;
        });

        // Group into lines
        const lines = [];
        let curLine = null;

        for (const it of items) {
          if (!curLine) {
            curLine = { y: it.y, items: [it], fontSize: it.fontSize };
            continue;
          }
          if (Math.abs(it.y - curLine.y) <= 4) {
            curLine.items.push(it);
            curLine.fontSize = Math.max(curLine.fontSize, it.fontSize);
          } else {
            lines.push(curLine);
            curLine = { y: it.y, items: [it], fontSize: it.fontSize };
          }
        }
        if (curLine) lines.push(curLine);

        let pageHtml = '';
        if (i > 1) {
          pageHtml += `<div class="word-page-break" style="margin: 28px 0 16px 0; padding: 6px 0; border-top: 2px dashed #CBD5E1; color: #64748B; font-size: 11px; font-weight: 700; text-align: center;">─────── Sayfa ${i} / ${pdfState.numPages} ───────</div>`;
        }

        for (const line of lines) {
          // Detect if line is a table row / multi-column (multiple items separated by large gaps > 28px)
          const distinctCols = [];
          let curCol = null;

          for (const it of line.items) {
            if (!curCol) {
              curCol = { text: it.str, x: it.x, endX: it.x + it.width, fontSize: it.fontSize };
              continue;
            }
            const gap = it.x - curCol.endX;
            if (gap > 28) {
              distinctCols.push(curCol);
              curCol = { text: it.str, x: it.x, endX: it.x + it.width, fontSize: it.fontSize };
            } else {
              curCol.text += (gap >= 3 ? ' ' : '') + it.str;
              curCol.endX = it.x + it.width;
              curCol.fontSize = Math.max(curCol.fontSize, it.fontSize);
            }
          }
          if (curCol) distinctCols.push(curCol);

          if (distinctCols.length >= 2) {
            // Multi-column table row
            const tdWidth = Math.round(100 / distinctCols.length);
            let rowHtml = `<table style="width: 100%; border-collapse: collapse; margin: 3px 0;"><tr>`;
            for (const col of distinctCols) {
              const colText = escapeHtml(col.text.trim());
              const isColHeading = col.fontSize >= 13;
              const cellStyle = `width: ${tdWidth}%; padding: 4px 8px; vertical-align: top; font-size: ${Math.max(11, col.fontSize)}px;` + (isColHeading ? ' font-weight: 700; color: #1E3A8A;' : ' color: #1E293B;');
              rowHtml += `<td style="${cellStyle}">${colText}</td>`;
            }
            rowHtml += `</tr></table>`;
            pageHtml += rowHtml;
          } else {
            // Single column text line
            const lineText = escapeHtml(line.items.map(it => it.str).join(' ').trim());
            if (!lineText) continue;

            const isHeading1 = line.fontSize >= 18;
            const isHeading2 = line.fontSize >= 14 && line.fontSize < 18;
            const isCentered = Math.abs((line.items[0].x + (line.items[line.items.length - 1].x + line.items[line.items.length - 1].width)) / 2 - (viewport.width / 2)) < 50;

            const alignStyle = isCentered ? 'text-align: center;' : 'text-align: left;';

            if (isHeading1) {
              pageHtml += `<h2 style="color: #1E3A8A; font-size: 20px; font-weight: 800; margin: 12px 0 6px 0; ${alignStyle}">${lineText}</h2>`;
            } else if (isHeading2) {
              pageHtml += `<h3 style="color: #1E40AF; font-size: 16px; font-weight: 700; margin: 8px 0 4px 0; ${alignStyle}">${lineText}</h3>`;
            } else {
              pageHtml += `<p style="font-size: ${Math.max(12, line.fontSize)}px; line-height: 1.5; margin: 3px 0; color: #1E293B; ${alignStyle}">${lineText}</p>`;
            }
          }
        }

        fullHtml += pageHtml;
      }

      const baseTitle = (pdfState.fileName || 'Belge.pdf').replace(/\.pdf$/i, '');
      const newWordTitle = `${baseTitle} (Düzenleme).docx`;
      const htmlContent = fullHtml || '<p>PDF içeriği boş veya yalnızca görsel içeriyor.</p>';

      if (window.docManager) {
        window.docManager.onWordLoaded(newWordTitle, htmlContent);
      } else {
        const wordEditor = document.getElementById('wordEditor');
        if (wordEditor) wordEditor.innerHTML = htmlContent;
        const wordTitle = document.getElementById('wordDocTitle');
        if (wordTitle) wordTitle.value = newWordTitle;
        switchTab('wordTab');
      }
      showToast('PDF Word olarak yeni sekmede açıldı! Başlıklar ve tablolar başarıyla korundu.');
    } catch (err) {
      console.error(err);
      showToast('Word aktarımı sırasında hata: ' + err.message, 'error');
    }
  });

  // ========================================================================
  // 9. Page Organizer Modal
  // ========================================================================
  organizePagesBtn?.addEventListener('click', async () => {
    openModal('organizePagesModal');
    const grid = document.getElementById('pageOrganizerGrid');
    if (!grid || !pdfState.pdfDoc) return;
    grid.innerHTML = '';

    for (let i = 0; i < pdfState.pageOrder.length; i++) {
      const origNum = pdfState.pageOrder[i];
      const page = await pdfState.pdfDoc.getPage(origNum);
      const viewport = page.getViewport({ scale: 0.22, rotation: pdfState.pageRotations[origNum] || 0 });

      const card = document.createElement('div');
      card.className = 'page-organizer-card';
      card.dataset.index = i;

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const label = document.createElement('span');
      label.style.fontSize = '12px';
      label.style.fontWeight = '700';
      label.textContent = `Sayfa ${i + 1}`;

      const actions = document.createElement('div');
      actions.className = 'page-organizer-actions';

      if (i > 0) {
        const leftBtn = document.createElement('button');
        leftBtn.className = 'icon-btn';
        leftBtn.style.width = '26px'; leftBtn.style.height = '26px';
        leftBtn.innerHTML = '←';
        leftBtn.title = 'Öne Al';
        leftBtn.onclick = () => {
          const temp = pdfState.pageOrder[i];
          pdfState.pageOrder[i] = pdfState.pageOrder[i - 1];
          pdfState.pageOrder[i - 1] = temp;
          organizePagesBtn.click();
        };
        actions.appendChild(leftBtn);
      }

      if (i < pdfState.pageOrder.length - 1) {
        const rightBtn = document.createElement('button');
        rightBtn.className = 'icon-btn';
        rightBtn.style.width = '26px'; rightBtn.style.height = '26px';
        rightBtn.innerHTML = '→';
        rightBtn.title = 'Sona Al';
        rightBtn.onclick = () => {
          const temp = pdfState.pageOrder[i];
          pdfState.pageOrder[i] = pdfState.pageOrder[i + 1];
          pdfState.pageOrder[i + 1] = temp;
          organizePagesBtn.click();
        };
        actions.appendChild(rightBtn);
      }

      card.appendChild(canvas);
      card.appendChild(label);
      card.appendChild(actions);
      grid.appendChild(card);
    }
  });

  document.getElementById('savePageOrganizerBtn')?.addEventListener('click', async () => {
    closeModal('organizePagesModal');
    updatePageIndicator();
    await renderAllPages();
    await renderThumbnails();
    showToast('Sayfa düzeni uygulandı!');
  });

  // ========================================================================
  // 9b. PDF Find & Replace System (Bul & Değiştir / Ctrl+F)
  // ========================================================================
  const pdfFindBar = document.getElementById('pdfFindReplaceBar');
  const pdfFindInput = document.getElementById('pdfFindInput');
  const pdfReplaceInput = document.getElementById('pdfReplaceInput');
  const pdfFindCount = document.getElementById('pdfFindCount');
  const pdfFindPrevBtn = document.getElementById('pdfFindPrevBtn');
  const pdfFindNextBtn = document.getElementById('pdfFindNextBtn');
  const pdfReplaceOneBtn = document.getElementById('pdfReplaceOneBtn');
  const pdfReplaceAllBtn = document.getElementById('pdfReplaceAllBtn');
  const pdfCloseFindBarBtn = document.getElementById('pdfCloseFindBarBtn');
  const pdfFindToggleBtn = document.getElementById('pdfFindToggleBtn');

  let findMatches = [];
  let currentMatchIdx = -1;

  window.openPdfFindBar = function() {
    if (!pdfFindBar) return;
    pdfFindBar.style.display = 'flex';
    if (pdfFindInput) {
      pdfFindInput.focus();
      pdfFindInput.select();
    }
  };

  window.closePdfFindBar = function() {
    if (!pdfFindBar) return;
    pdfFindBar.style.display = 'none';
    clearFindHighlights();
  };

  function clearFindHighlights() {
    document.querySelectorAll('.pdf-text-line.find-match, .pdf-text-line.find-match-active').forEach(el => {
      el.classList.remove('find-match', 'find-match-active');
    });
    findMatches = [];
    currentMatchIdx = -1;
    if (pdfFindCount) pdfFindCount.textContent = '0/0';
  }

  function performPdfSearch() {
    clearFindHighlights();
    const query = (pdfFindInput?.value || '').trim();
    if (!query) return;

    const lowerQuery = query.toLocaleLowerCase('tr-TR');
    const textLines = Array.from(document.querySelectorAll('.pdf-text-line'));

    for (const el of textLines) {
      const lineText = el.innerText || '';
      if (lineText.toLocaleLowerCase('tr-TR').includes(lowerQuery)) {
        el.classList.add('find-match');
        findMatches.push({
          el: el,
          lineKey: el.dataset.lineKey,
          pageNum: parseInt(el.dataset.pageNum, 10),
          viewport: el._viewportRef,
          lineItem: el._lineItemRef
        });
      }
    }

    if (findMatches.length > 0) {
      currentMatchIdx = 0;
      updateActiveMatch();
    } else {
      if (pdfFindCount) pdfFindCount.textContent = '0/0';
    }
  }

  function updateActiveMatch() {
    document.querySelectorAll('.pdf-text-line.find-match-active').forEach(el => {
      el.classList.remove('find-match-active');
    });

    if (findMatches.length === 0 || currentMatchIdx < 0 || currentMatchIdx >= findMatches.length) {
      if (pdfFindCount) pdfFindCount.textContent = '0/0';
      return;
    }

    if (pdfFindCount) {
      pdfFindCount.textContent = `${currentMatchIdx + 1}/${findMatches.length}`;
    }

    const match = findMatches[currentMatchIdx];
    match.el.classList.add('find-match-active');
    match.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  pdfFindToggleBtn?.addEventListener('click', () => {
    if (pdfFindBar && pdfFindBar.style.display === 'flex') {
      window.closePdfFindBar();
    } else {
      window.openPdfFindBar();
    }
  });

  pdfCloseFindBarBtn?.addEventListener('click', () => {
    window.closePdfFindBar();
  });

  pdfFindInput?.addEventListener('input', () => {
    performPdfSearch();
  });

  pdfFindInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        pdfFindPrevBtn?.click();
      } else {
        pdfFindNextBtn?.click();
      }
    } else if (e.key === 'Escape') {
      window.closePdfFindBar();
    }
  });

  pdfFindNextBtn?.addEventListener('click', () => {
    if (findMatches.length === 0) return;
    currentMatchIdx = (currentMatchIdx + 1) % findMatches.length;
    updateActiveMatch();
  });

  pdfFindPrevBtn?.addEventListener('click', () => {
    if (findMatches.length === 0) return;
    currentMatchIdx = (currentMatchIdx - 1 + findMatches.length) % findMatches.length;
    updateActiveMatch();
  });

  // Replace Current Match
  pdfReplaceOneBtn?.addEventListener('click', () => {
    if (findMatches.length === 0 || currentMatchIdx < 0) return;
    const match = findMatches[currentMatchIdx];
    const findStr = pdfFindInput.value;
    const repStr = pdfReplaceInput.value;

    const currentText = match.el.innerText;
    const regex = new RegExp(findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const newText = currentText.replace(regex, repStr);

    const pageWrapper = match.el.closest('.pdf-page-wrapper');
    const sampled = sampleCanvasColor(pageWrapper, match.lineItem.x, match.lineItem.y, match.lineItem.width, match.lineItem.height);
    const bgColor = sampled.bgColor || '#FFFFFF';
    const textColor = sampled.textColor || '#111827';

    match.el.innerText = newText;
    match.el.classList.add('text-modified');
    match.el.style.backgroundColor = bgColor;
    match.el.style.color = textColor;
    match.el.style.fontSize = `${match.lineItem.fontSize}px`;
    match.el.style.width = 'auto';

    const editRecord = {
      id: 'edit_' + Date.now(),
      page: match.pageNum,
      lineKey: match.lineItem.key,
      pctX: match.lineItem.x / match.viewport.width,
      pctY: match.lineItem.y / match.viewport.height,
      pctW: Math.max(0.015, (match.el.offsetWidth || match.lineItem.width) / match.viewport.width),
      pctH: Math.max(0.012, (match.el.offsetHeight || match.lineItem.height) / match.viewport.height),
      fontSize: (match.lineItem.fontSize || 12) / pdfState.scale,
      fontFamily: 'sans-serif',
      isBold: false,
      isItalic: false,
      color: textColor,
      bgColor: bgColor,
      text: newText,
      originalText: match.lineItem.text,
      shouldMask: true
    };

    pdfState.editedTexts = pdfState.editedTexts.filter(e => !(e.page === match.pageNum && e.lineKey === match.lineItem.key));
    pdfState.editedTexts.push(editRecord);

    showToast('Kelime değiştirildi.');
    performPdfSearch();
  });

  // Replace All Matches
  pdfReplaceAllBtn?.addEventListener('click', () => {
    const findStr = pdfFindInput.value;
    const repStr = pdfReplaceInput.value;
    if (!findStr || findMatches.length === 0) {
      showToast('Değiştirilecek eşleşme bulunamadı.', 'error');
      return;
    }

    const count = findMatches.length;
    const regex = new RegExp(findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    for (const match of findMatches) {
      const currentText = match.el.innerText;
      const newText = currentText.replace(regex, repStr);

      const pageWrapper = match.el.closest('.pdf-page-wrapper');
      const sampled = sampleCanvasColor(pageWrapper, match.lineItem.x, match.lineItem.y, match.lineItem.width, match.lineItem.height);
      const bgColor = sampled.bgColor || '#FFFFFF';
      const textColor = sampled.textColor || '#111827';

      match.el.innerText = newText;
      match.el.classList.add('text-modified');
      match.el.style.backgroundColor = bgColor;
      match.el.style.color = textColor;
      match.el.style.fontSize = `${match.lineItem.fontSize}px`;
      match.el.style.width = 'auto';

      const editRecord = {
        id: 'edit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        page: match.pageNum,
        lineKey: match.lineItem.key,
        pctX: match.lineItem.x / match.viewport.width,
        pctY: match.lineItem.y / match.viewport.height,
        pctW: Math.max(0.015, (match.el.offsetWidth || match.lineItem.width) / match.viewport.width),
        pctH: Math.max(0.012, (match.el.offsetHeight || match.lineItem.height) / match.viewport.height),
        fontSize: (match.lineItem.fontSize || 12) / pdfState.scale,
        fontFamily: 'sans-serif',
        isBold: false,
        isItalic: false,
        color: textColor,
        bgColor: bgColor,
        text: newText,
        originalText: match.lineItem.text,
        shouldMask: true
      };

      pdfState.editedTexts = pdfState.editedTexts.filter(e => !(e.page === match.pageNum && e.lineKey === match.lineItem.key));
      pdfState.editedTexts.push(editRecord);
    }

    showToast(`${count} adet eşleşme tüm sayfalarda başarıyla değiştirildi! "Kaydet" butonuyla yeni PDF olarak indirebilirsiniz.`);
    clearFindHighlights();
  });

  // ========================================================================
  // 10. Save PDF (Permanently applies In-Place Text Edits, Images & Annotations)
  // ========================================================================
  async function generateExportPdfBytes() {
    if (!pdfState.rawBytes || !window.PDFLib) return null;
    const { PDFDocument, rgb, degrees } = window.PDFLib;
    const srcDoc = await PDFDocument.load(pdfState.rawBytes);
    const outDoc = await PDFDocument.create();

    const zeroBasedIndices = pdfState.pageOrder.map(n => n - 1);
    const copiedPages = await outDoc.copyPages(srcDoc, zeroBasedIndices);

    for (let i = 0; i < copiedPages.length; i++) {
      const page = copiedPages[i];
      const origNum = pdfState.pageOrder[i];
      const displayPageNum = i + 1;

      const addRotation = pdfState.pageRotations[origNum] || 0;
      if (addRotation) {
        const curRot = page.getRotation().angle;
        page.setRotation(degrees(curRot + addRotation));
      }

      const { width: pWidth, height: pHeight } = page.getSize();

      // 1. Process In-Place Edited Texts
      const pageEditedTexts = (pdfState.editedTexts || []).filter(e => e.page === displayPageNum);
      for (const editItem of pageEditedTexts) {
        const itemX = editItem.pctX * pWidth;
        const itemW = Math.max(16, editItem.pctW * pWidth);
        const itemH = Math.max(12, editItem.pctH * pHeight);

        const cvs = document.createElement('canvas');
        const factor = 3;
        const cCtx = cvs.getContext('2d');

        const fontStyle = editItem.isItalic ? 'italic ' : '';
        const fontWeight = editItem.isBold ? 'bold ' : '';
        let fontFam = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        if (editItem.fontFamily === 'serif') {
          fontFam = 'Georgia, "Times New Roman", serif';
        } else if (editItem.fontFamily === 'monospace') {
          fontFam = '"Courier New", Courier, monospace';
        }

        const fontPx = Math.round(editItem.fontSize * factor);
        cCtx.font = `${fontStyle}${fontWeight}${fontPx}px ${fontFam}`;
        const textMetrics = cCtx.measureText(editItem.text);
        const actualTextW = Math.ceil(textMetrics.width);
        const actualTextH = Math.ceil(fontPx * 1.25);

        cvs.width = actualTextW + 8;
        cvs.height = actualTextH + 6;

        cCtx.font = `${fontStyle}${fontWeight}${fontPx}px ${fontFam}`;
        if (editItem.shouldMask) {
          cCtx.fillStyle = editItem.bgColor || '#FFFFFF';
          cCtx.fillRect(0, 0, cvs.width, cvs.height);
        }

        cCtx.fillStyle = editItem.color || '#111827';
        cCtx.textBaseline = 'top';
        cCtx.fillText(editItem.text, 2, 2);

        const renderW = cvs.width / factor;
        const renderH = cvs.height / factor;
        const itemY = pHeight - (editItem.pctY * pHeight) - renderH;

        if (editItem.shouldMask) {
          const maskRgb = hexToRgb(editItem.bgColor || '#FFFFFF');
          const maskH = Math.max(itemH, renderH) + 2;
          const maskY = pHeight - (editItem.pctY * pHeight) - maskH;
          page.drawRectangle({
            x: Math.max(0, itemX - 2),
            y: Math.max(0, maskY),
            width: Math.max(itemW, renderW) + 4,
            height: maskH,
            color: rgb(maskRgb.r / 255, maskRgb.g / 255, maskRgb.b / 255),
            opacity: 1.0
          });
        }

        if (!editItem.text || editItem.text.trim() === '') {
          continue;
        }

        const pngBytes = dataUrlToUint8Array(cvs.toDataURL('image/png'));
        const textPng = await outDoc.embedPng(pngBytes);
        page.drawImage(textPng, {
          x: itemX,
          y: itemY,
          width: renderW,
          height: renderH
        });
      }

      // 2. Process Annotations
      const pageAnnots = (pdfState.annotations || []).filter(a => a.page === origNum);
      for (const annot of pageAnnots) {
        const targetX = annot.pctX * pWidth;
        if (annot.type === 'highlight') {
          const scaledW = (annot.pctW ? annot.pctW * pWidth : annot.width);
          const scaledH = (annot.pctH ? annot.pctH * pHeight : annot.height);

          page.drawRectangle({
            x: targetX,
            y: pHeight - (annot.pctY * pHeight) - scaledH,
            width: scaledW,
            height: scaledH,
            color: rgb(1, 0.9, 0.2),
            opacity: 0.45
          });
        }
      }

      // 3. Process Inserted Images & Signatures
      const pageImages = (pdfState.images || []).filter(img => img.page === displayPageNum);
      for (const imgItem of pageImages) {
        try {
          let embeddedImg;
          if (imgItem.dataUrl.startsWith('data:image/jpeg') || imgItem.dataUrl.startsWith('data:image/jpg')) {
            embeddedImg = await outDoc.embedJpg(dataUrlToUint8Array(imgItem.dataUrl));
          } else {
            embeddedImg = await outDoc.embedPng(dataUrlToUint8Array(imgItem.dataUrl));
          }

          const targetW = imgItem.pctW * pWidth;
          const targetH = imgItem.pctH * pHeight;
          const targetX = imgItem.pctX * pWidth;
          const targetY = pHeight - (imgItem.pctY * pHeight) - targetH;

          page.drawImage(embeddedImg, {
            x: targetX,
            y: targetY,
            width: targetW,
            height: targetH
          });
        } catch (imgErr) {
          console.warn('Image embedding fallback:', imgErr);
        }
      }
    }

    return await outDoc.save();
  }

  window.exportPdfBlob = async function() {
    const bytes = await generateExportPdfBytes();
    if (!bytes) return null;
    return new Blob([bytes], { type: 'application/pdf' });
  };

  window.savePdfDocument = async function() {
    if (!pdfState.rawBytes || !window.PDFLib) {
      showToast('PDF motoru hazır değil veya açık bir PDF yok.', 'error');
      return;
    }

    try {
      showToast('Değişiklikler işleniyor ve PDF oluşturuluyor...');
      const pdfBytes = await generateExportPdfBytes();
      if (!pdfBytes) throw new Error('PDF verisi oluşturulamadı.');
      const rawName = (pdfState.fileName || 'Belge.pdf').trim();
      const pdfFileName = rawName.toLowerCase().endsWith('.pdf') ? rawName : rawName + '.pdf';

      let savedDirectly = false;

      // 1. Direct Server Save (Writes straight to sync/documents folder)
      try {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const resp = await fetch(`/api/save-document?filename=${encodeURIComponent(pdfFileName)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: blob
        });
        if (resp.ok) {
          const resData = await resp.json();
          if (resData.success) {
            savedDirectly = true;
            if (window.addRecentDocument) {
              window.addRecentDocument(resData.filename || pdfFileName, 'pdf');
            }
            let saveMsg = `"${pdfFileName}" kaydedildi!`;
            if (resData.cloudProvider === 'gdrive' || resData.isGoogleDrive) {
              saveMsg = `"${pdfFileName}" Google Drive'a kaydedildi ve eşitlendi!`;
            } else if (resData.cloudProvider === 'onedrive') {
              saveMsg = `"${pdfFileName}" OneDrive'a kaydedildi ve eşitlendi!`;
            }
            showToast(saveMsg);
            if (window.loadDriveFiles) {
              window.loadDriveFiles();
            }
          }
        }
      } catch (serverErr) {
        // Fallback to AndroidBridge or browser download below
      }

      // 2. Android Bridge Save
      if (!savedDirectly && window.AndroidBridge && window.AndroidBridge.saveBase64File) {
        try {
          let binary = '';
          const len = pdfBytes.byteLength;
          const chunkSize = 8192;
          for (let i = 0; i < len; i += chunkSize) {
            const chunk = pdfBytes.subarray(i, Math.min(i + chunkSize, len));
            binary += String.fromCharCode.apply(null, chunk);
          }
          const base64Data = btoa(binary);
          window.AndroidBridge.saveBase64File(pdfFileName, base64Data, 'application/pdf');
          savedDirectly = true;
          showToast(`"${pdfFileName}" telefonunuzdaki "Belgeler" klasörüne kaydedildi!`);
        } catch (bridgeErr) {
          console.warn('AndroidBridge PDF save error:', bridgeErr);
        }
      }

      // 3. Browser File Download Fallback
      if (!savedDirectly) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = pdfFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`"${pdfFileName}" PDF olarak indirildi.`);
      }
    } catch (err) {
      console.error(err);
      showToast('PDF kaydedilirken hata oluştu: ' + err.message, 'error');
    }
  };

  // High-Resolution 300 DPI Vector-Quality Print Generator
  window.preparePdfPrintPages = async function(printRoot) {
    if (!pdfState.pdfDoc || !printRoot) return false;
    printRoot.innerHTML = '';
    const numPages = pdfState.pageOrder.length;
    // 300 DPI render scale (~2400px width for standard A4 page)
    const printScale = 3.5;

    for (let idx = 0; idx < numPages; idx++) {
      const origNum = pdfState.pageOrder[idx];
      const displayNum = idx + 1;
      const page = await pdfState.pdfDoc.getPage(origNum);
      const rotation = (pdfState.pageRotations[origNum] || 0);

      const unscaledViewport = page.getViewport({ scale: 1.0, rotation: rotation });
      const widthMm = (unscaledViewport.width / 72) * 25.4;
      const heightMm = (unscaledViewport.height / 72) * 25.4;

      const viewport = page.getViewport({ scale: printScale, rotation: rotation });

      const pageDiv = document.createElement('div');
      pageDiv.className = 'kalpten-print-pdf-page';
      pageDiv.style.position = 'relative';
      pageDiv.style.width = widthMm.toFixed(2) + 'mm';
      pageDiv.style.height = heightMm.toFixed(2) + 'mm';
      pageDiv.style.maxWidth = widthMm.toFixed(2) + 'mm';
      pageDiv.style.maxHeight = heightMm.toFixed(2) + 'mm';
      pageDiv.style.margin = '0 auto';
      pageDiv.style.backgroundColor = '#FFFFFF';
      pageDiv.style.pageBreakAfter = (idx === numPages - 1) ? 'auto' : 'always';
      pageDiv.style.breakAfter = (idx === numPages - 1) ? 'auto' : 'page';
      pageDiv.style.overflow = 'hidden';
      pageDiv.style.boxSizing = 'border-box';

      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';

      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      pageDiv.appendChild(canvas);

      // Render edited texts on print page with exact physical point matching
      const pageEditedTexts = (pdfState.editedTexts || []).filter(e => e.page === displayNum);
      pageEditedTexts.forEach(editItem => {
        const textEl = document.createElement('div');
        textEl.className = 'pdf-text-line text-modified';
        textEl.innerText = editItem.text;
        textEl.style.position = 'absolute';
        textEl.style.left = (editItem.pctX * 100) + '%';
        textEl.style.top = (editItem.pctY * 100) + '%';
        textEl.style.fontSize = editItem.fontSize + 'pt';
        textEl.style.lineHeight = '1.15';
        textEl.style.whiteSpace = 'pre';
        if (editItem.color) textEl.style.color = editItem.color;
        if (editItem.isBold) textEl.style.fontWeight = 'bold';
        if (editItem.isItalic) textEl.style.fontStyle = 'italic';
        if (editItem.fontFamily) textEl.style.fontFamily = editItem.fontFamily;
        if (editItem.shouldMask) {
          textEl.style.backgroundColor = editItem.bgColor || '#FFFFFF';
        }
        pageDiv.appendChild(textEl);
      });

      // Render inserted images on print page
      const pageImages = (pdfState.images || []).filter(img => img.page === displayNum);
      pageImages.forEach(imgItem => {
        const imgEl = document.createElement('img');
        imgEl.src = imgItem.dataUrl;
        imgEl.style.position = 'absolute';
        imgEl.style.left = (imgItem.pctX * 100) + '%';
        imgEl.style.top = (imgItem.pctY * 100) + '%';
        imgEl.style.width = (imgItem.pctW * 100) + '%';
        imgEl.style.height = (imgItem.pctH * 100) + '%';
        imgEl.style.objectFit = 'fill';
        pageDiv.appendChild(imgEl);
      });

      printRoot.appendChild(pageDiv);
    }
    return true;
  };

  // Print PDF
  window.printPdfDocument = async function() {
    if (window.prepareCleanPrintRoot) {
      await window.prepareCleanPrintRoot();
    }
    window.print();
  };

  // Expose state and rendering helpers for docManager multi-document tabs
  window.pdfState = pdfState;
  window.renderAllPages = renderAllPages;
  window.renderThumbnails = renderThumbnails;
  window.updatePageIndicator = updatePageIndicator;
});
