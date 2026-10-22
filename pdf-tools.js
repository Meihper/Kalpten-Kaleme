/**
 * Studio Office Pro - Acrobat Pro Fast Utilities
 * Merge, Split, Images-to-PDF, PDF-to-Word Converter, and Page Numbering.
 */

document.addEventListener('DOMContentLoaded', () => {

  // 1. PDF Birleştirici (Merge PDFs)
  const mergeBtn = document.getElementById('toolMergeBtn');
  const mergeInput = document.getElementById('toolMergeInput');

  mergeBtn?.addEventListener('click', () => mergeInput?.click());

  mergeInput?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length < 2) {
      showToast('Birleştirmek için lütfen en az 2 PDF dosyası seçin.', 'error');
      return;
    }

    try {
      showToast(`${files.length} adet PDF birleştiriliyor...`);
      const { PDFDocument } = window.PDFLib;
      const mergedDoc = await PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const bytes = await file.arrayBuffer();
        const srcDoc = await PDFDocument.load(bytes);
        const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        copiedPages.forEach(p => mergedDoc.addPage(p));
      }

      const mergedPdfBytes = await mergedDoc.save();
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'Birlestirilmis_Belgeler.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('PDF belgeleri başarıyla birleştirildi!');
    } catch (err) {
      console.error(err);
      showToast('Birleştirme hatası: ' + err.message, 'error');
    }
  });

  // 2. PDF Sayfa Ayırıcı (Split / Extract Pages)
  const splitBtn = document.getElementById('toolSplitBtn');
  const splitInput = document.getElementById('toolSplitInput');

  splitBtn?.addEventListener('click', () => splitInput?.click());

  splitInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const bytes = await file.arrayBuffer();
      const { PDFDocument } = window.PDFLib;
      const srcDoc = await PDFDocument.load(bytes);
      const totalPages = srcDoc.getPageCount();

      const rangeInput = prompt(
        `"${file.name}" toplam ${totalPages} sayfadan oluşuyor.\n\n` +
        `Ayıklamak istediğiniz sayfa numaralarını girin (Örn: 1-3 veya 1, 4, 7):`,
        `1-${Math.min(3, totalPages)}`
      );

      if (!rangeInput) return;

      const targetIndices = new Set();
      const parts = rangeInput.split(',');

      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-');
          const start = parseInt(startStr);
          const end = parseInt(endStr);
          if (!isNaN(start) && !isNaN(end)) {
            for (let p = Math.max(1, start); p <= Math.min(totalPages, end); p++) {
              targetIndices.add(p - 1);
            }
          }
        } else {
          const p = parseInt(trimmed);
          if (!isNaN(p) && p >= 1 && p <= totalPages) {
            targetIndices.add(p - 1);
          }
        }
      }

      if (targetIndices.size === 0) {
        showToast('Geçerli bir sayfa aralığı girilmedi.', 'error');
        return;
      }

      const newDoc = await PDFDocument.create();
      const sortedIndices = Array.from(targetIndices).sort((a, b) => a - b);
      const copiedPages = await newDoc.copyPages(srcDoc, sortedIndices);
      copiedPages.forEach(p => newDoc.addPage(p));

      const newBytes = await newDoc.save();
      const blob = new Blob([newBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '') + '_ayiklanan.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`${sortedIndices.length} sayfa ayıklandı ve kaydedildi!`);
    } catch (err) {
      console.error(err);
      showToast('Sayfa ayıklama hatası: ' + err.message, 'error');
    }
  });

  // 3. Görselleri PDF'e Dönüştür (Images to PDF)
  const imgToPdfBtn = document.getElementById('toolImgToPdfBtn');
  const imgToPdfInput = document.getElementById('toolImgToPdfInput');

  imgToPdfBtn?.addEventListener('click', () => imgToPdfInput?.click());

  imgToPdfInput?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      showToast(`${files.length} görsel PDF'e dönüştürülüyor...`);
      const { PDFDocument } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const bytes = await file.arrayBuffer();
        let image;

        if (file.type === 'image/jpeg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
          image = await pdfDoc.embedJpg(bytes);
        } else {
          image = await pdfDoc.embedPng(bytes);
        }

        const dims = image.scale(1);
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        const margin = 40;
        const maxWidth = pageWidth - (margin * 2);
        const maxHeight = pageHeight - (margin * 2);
        const scale = Math.min(maxWidth / dims.width, maxHeight / dims.height, 1);

        const scaledW = dims.width * scale;
        const scaledH = dims.height * scale;
        const posX = (pageWidth - scaledW) / 2;
        const posY = (pageHeight - scaledH) / 2;

        page.drawImage(image, {
          x: posX,
          y: posY,
          width: scaledW,
          height: scaledH
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'Gorsellerden_Olusturulan_Belge.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Görseller PDF dosyasına dönüştürüldü!');
    } catch (err) {
      console.error(err);
      showToast('Dönüştürme hatası: ' + err.message, 'error');
    }
  });

  // 4. PDF'i Word'e Dönüştür & Metin Ayıkla (PDF to DOCX)
  const extractTextBtn = document.getElementById('toolExtractTextBtn');
  const extractTextInput = document.getElementById('toolExtractTextInput');

  extractTextBtn?.addEventListener('click', () => extractTextInput?.click());

  extractTextInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast('PDF metinleri Word için ayıklanıyor...');
      const bytes = await file.arrayBuffer();
      const loadingTask = window.pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
      const pdf = await loadingTask.promise;

      let extractedHtml = `<h1>${file.name.replace(/\.pdf$/i, '')}</h1>`;

      for (let pNum = 1; pNum <= pdf.numPages; pNum++) {
        const page = await pdf.getPage(pNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');

        extractedHtml += `<h2>--- Sayfa ${pNum} ---</h2>`;
        extractedHtml += `<p>${pageText.replace(/\n/g, '<br>')}</p>`;
      }

      const wordTitle = file.name.replace(/\.pdf$/i, '') + '.docx';
      if (window.docManager) {
        window.docManager.onWordLoaded(wordTitle, extractedHtml);
      } else {
        switchTab('wordTab');
        const editor = document.getElementById('wordEditor');
        const titleInput = document.getElementById('wordDocTitle');
        if (editor) editor.innerHTML = extractedHtml;
        if (titleInput) titleInput.value = wordTitle;
      }

      showToast('PDF başarıyla Word formatına dönüştürüldü! Dilediğiniz gibi düzenleyip DOCX kaydedebilirsiniz.');
    } catch (err) {
      console.error(err);
      showToast('Dönüştürme hatası: ' + err.message, 'error');
    }
  });

});
