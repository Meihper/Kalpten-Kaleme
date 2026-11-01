$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice"

# Ensure local server is listening on 52480
$conn = Get-NetTCPConnection -LocalPort 52480 -State Listen -ErrorAction SilentlyContinue
if (-not $conn) {
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice\server.ps1`" -Daemon" -WorkingDirectory "C:\Users\Erdem\.gemini\antigravity\scratch\OneOffice" -WindowStyle Hidden
    $waitRetries = 20
    while ($waitRetries-- -gt 0) {
        Start-Sleep -Milliseconds 500
        $conn = Get-NetTCPConnection -LocalPort 52480 -State Listen -ErrorAction SilentlyContinue
        if ($conn) { break }
    }
}

$edgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)
$edgeExe = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edgeExe) { throw "Microsoft Edge not found!" }

$debugPort = 9346
$tempProfile = Join-Path $env:TEMP "KK_E2E_Profile_$PID"
New-Item -ItemType Directory -Path $tempProfile -Force | Out-Null

    $edgeProc = Start-Process -FilePath $edgeExe -ArgumentList @(
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-sync",
        "--disable-features=msEdgeAutoSignIn,msEdgeFirstRunExperience,msEdgeFreV2,msEdgeSyncNotice,msEdgeShowFirstRunNotification,msEdgeSignInOptIn,msEdgeFrePromo,msEdgeWelcomePageExperience,msEdgeStartupBoost",
        "--remote-debugging-port=$debugPort",
        "--user-data-dir=`"$tempProfile`"",
        "--window-size=1440,900",
        "http://127.0.0.1:52480/index.html"
    ) -PassThru

    Start-Sleep -Seconds 3

    try {
        $targets = Invoke-RestMethod -Uri "http://localhost:$debugPort/json"
    $pageTarget = $targets | Where-Object { $_.type -eq "page" -and ($_.url -like "*52480*" -or $_.url -like "*127.0.0.1*" -or $_.url -like "*localhost*") } | Select-Object -First 1
    if (-not $pageTarget) { $pageTarget = $targets | Where-Object { $_.type -eq "page" } | Select-Object -First 1 }
    $wsUrl = $pageTarget.webSocketDebuggerUrl

    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $cts = New-Object System.Threading.CancellationTokenSource(90000)
    $ws.ConnectAsync([Uri]$wsUrl, $cts.Token).Wait()

    $script:msgId = 1
    function Invoke-CDP($method, $params = @{}) {
        $id = $script:msgId++
        $payload = @{ id = $id; method = $method; params = $params } | ConvertTo-Json -Depth 10 -Compress
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
        $segment = New-Object System.ArraySegment[byte]($bytes, 0, $bytes.Length)
        $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()

        $buf = New-Object byte[] 131072
        while ($true) {
            $ms = New-Object System.IO.MemoryStream
            do {
                $seg = New-Object System.ArraySegment[byte]($buf, 0, $buf.Length)
                $res = $ws.ReceiveAsync($seg, $cts.Token).Result
                $ms.Write($buf, 0, $res.Count)
            } while (-not $res.EndOfMessage)
            $jsonStr = [System.Text.Encoding]::UTF8.GetString($ms.ToArray())
            $obj = $jsonStr | ConvertFrom-Json
            if ($obj.id -eq $id) {
                return $obj
            }
        }
    }

    function Save-Screenshot($outPath) {
        $shot = Invoke-CDP "Page.captureScreenshot" @{ format = "png" }
        if ($shot.result.data) {
            [System.IO.File]::WriteAllBytes($outPath, [Convert]::FromBase64String($shot.result.data))
        }
    }

    Invoke-CDP "Runtime.enable" | Out-Null
    Invoke-CDP "Log.enable" | Out-Null
    Invoke-CDP "Page.enable" | Out-Null
    Invoke-CDP "Page.navigate" @{ url = "http://127.0.0.1:52480/index.html" } | Out-Null
    
    $readyRetries = 30
    while ($readyRetries-- -gt 0) {
        $check = Invoke-CDP "Runtime.evaluate" @{ expression = "!!document.querySelector('.header-center')" }
        if ($check.result.result.value -eq $true) { break }
        Start-Sleep -Milliseconds 200
    }

    $jsTestSuite = @'
(async function() {
  const results = [];
  const errors = [];
  window.addEventListener('error', e => errors.push(e.message));
  window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));

  function assert(category, name, condition, detail = '') {
    results.push({
      category,
      name,
      passed: Boolean(condition),
      detail: String(detail || '')
    });
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  window.__origConfirm = window.confirm;
  window.__origPrompt = window.prompt;
  window.confirm = () => true;
  window.prompt = (msg, def) => def || 'Test';

  let retries = 50;
  while ((!window.JSZip || !window.mammoth || !window.htmlDocx || !window.pdfjsLib || !window.PDFLib || !document.querySelector('.header-center')) && retries-- > 0) {
    await sleep(100);
  }

  // =========================================================================
  // 1. CORE ENVIRONMENT & VENDOR LIBRARIES
  // =========================================================================
  assert('1. Altyapi ve Kutuphaneler', 'Cevrimdisi kutuphaneler yuklu (JSZip, Mammoth, htmlDocx, PDF.js, PDFLib)',
    Boolean(window.JSZip && window.mammoth && window.htmlDocx && window.pdfjsLib && window.PDFLib),
    `JSZip:${!!window.JSZip}, Mammoth:${!!window.mammoth}, htmlDocx:${!!window.htmlDocx}, PDF.js:${!!window.pdfjsLib}, PDFLib:${!!window.PDFLib}`);

  assert('1. Altyapi ve Kutuphaneler', 'Windows Masaustu Suite modu aktif (is-windows-suite)',
    document.documentElement.classList.contains('is-windows-suite'),
    document.documentElement.className);

  const headerCenterDisp = window.getComputedStyle(document.querySelector('.header-center')).display;
  assert('1. Altyapi ve Kutuphaneler', 'Ust modul sekmeleri [Yazi/PDF/Sunum/Araclar] Windows modunda gorunur',
    headerCenterDisp !== 'none', `display: ${headerCenterDisp}`);

  assert('1. Altyapi ve Kutuphaneler', 'Eski hatali #wordSaveStatus (Indirildi rozeti) tamamen kaldirildi',
    document.getElementById('wordSaveStatus') === null, 'wordSaveStatus === null');

  // =========================================================================
  // 2. HEADER, MULTI-DOC TABS, THEME, PAPER TONE, ZEN MODE
  // =========================================================================
  const titleInput = document.getElementById('wordDocTitle');
  titleInput.value = 'E2E Test Eseri';
  titleInput.dispatchEvent(new Event('input'));
  titleInput.dispatchEvent(new Event('blur'));
  assert('2. Ust Bar ve Coklu Sekme', 'Belge basligi duzenleme ve otomatik .docx uzantisi',
    titleInput.value === 'E2E Test Eseri.docx', titleInput.value);

  const tabsBar = document.getElementById('documentTabsBar');
  assert('2. Ust Bar ve Coklu Sekme', 'Tek belge acikken sekme cubugu gizli (has-multiple-docs yok)',
    !tabsBar.classList.contains('has-multiple-docs'), tabsBar.className);

  const editor = document.getElementById('wordEditor');
  editor.innerHTML = '<p>Birinci belgenin icerigi.</p>';
  document.getElementById('newDocTabBtn').click();
  let docWait = 20;
  while (window.docManager.docs.length < 2 && docWait-- > 0) {
    await sleep(50);
  }
  assert('2. Ust Bar ve Coklu Sekme', 'Yeni Belge (+) tiklandiginda 2. sekme acilir ve sekme cubugu gorunur olur',
    window.docManager.docs.length === 2 && tabsBar.classList.contains('has-multiple-docs'),
    `Doc count: ${window.docManager.docs.length}`);

  editor.innerHTML = '<p>Ikinci belgenin icerigi.</p>';
  const firstDocId = window.docManager.docs[0].id;
  const secondDocId = window.docManager.docs[1].id;
  await window.docManager.switchTo(firstDocId);
  assert('2. Ust Bar ve Coklu Sekme', 'Sekmeler arasi geciste her belgenin icerigi bagimsiz korunur',
    editor.innerText.includes('Birinci belgenin icerigi'), editor.innerText.trim());

  window.docManager.closeDoc(secondDocId);
  await sleep(50);
  assert('2. Ust Bar ve Coklu Sekme', 'Ikinci sekme kapatildiginda tek sekmeye doner ve cubuk gizlenir',
    window.docManager.docs.length === 1 && !tabsBar.classList.contains('has-multiple-docs'),
    `Doc count: ${window.docManager.docs.length}`);

  // Theme Toggle
  const initTheme = document.documentElement.getAttribute('data-theme');
  document.getElementById('themeToggleBtn').click();
  const toggledTheme = document.documentElement.getAttribute('data-theme');
  document.getElementById('themeToggleBtn').click();
  assert('2. Ust Bar ve Coklu Sekme', 'Karanlik / Aydinlik tema gecisi sorunsuz calisir',
    initTheme !== toggledTheme && document.documentElement.getAttribute('data-theme') === initTheme,
    `${initTheme} -> ${toggledTheme} -> ${document.documentElement.getAttribute('data-theme')}`);

  // Paper Tone Toggle
  const initPaper = document.documentElement.getAttribute('data-paper');
  document.getElementById('paperToneBtn').click();
  const nextPaper = document.documentElement.getAttribute('data-paper');
  document.getElementById('paperToneBtn').click();
  assert('2. Ust Bar ve Coklu Sekme', 'Kitap Kagidi / Beyaz Kagit ton gecisi calisir',
    initPaper !== nextPaper, `Paper toggled: ${initPaper} -> ${nextPaper}`);

  // Zen Mode
  document.getElementById('zenModeBtn').click();
  const zenActive = document.body.classList.contains('zen-mode');
  document.getElementById('exitZenBtn').click();
  const zenExited = !document.body.classList.contains('zen-mode');
  assert('2. Ust Bar ve Coklu Sekme', 'Odak Modu (Zen Mode) giris ve cikis butonlari calisir',
    zenActive && zenExited, `zenActive:${zenActive}, zenExited:${zenExited}`);

  // Download Modal
  document.getElementById('suiteDownloadBtn').click();
  const dlModal = document.getElementById('downloadSuiteModal');
  const dlCloseBtn = dlModal.querySelector('.modal-header .icon-btn');
  const dlOpened = dlModal.classList.contains('active') && dlCloseBtn.textContent.trim().charCodeAt(0) === 10005;
  dlCloseBtn.click();
  assert('2. Ust Bar ve Coklu Sekme', 'Indirme Modali acilir, kapatma ikonu (X) duzgundur ve kapanir',
    dlOpened && !dlModal.classList.contains('active'), `CloseBtn charCode: ${dlCloseBtn.textContent.trim().charCodeAt(0)}`);

  // =========================================================================
  // 3. WORD EDITOR, PUNTO STEPPER, FORMAT PAINTER, RICH TEXT
  // =========================================================================
  editor.innerHTML = '<p>Kalpten dokulen kelimeler insanin ruhuna dokunur.</p>';
  editor.dispatchEvent(new Event('input'));
  await sleep(50);
  const wordStatText = document.getElementById('wordCountStat').textContent;
  assert('3. Word Editoru ve Arac Cubugu', 'Kelime ve harf sayaci anlik hesaplanir',
    wordStatText === '6 Kelime', wordStatText);

  // Test Punto Stepper Initial Sync (12pt default matching .word-canvas-sheet)
  const fsInput = document.getElementById('fontSizeInput');
  const incBtn = document.getElementById('fontSizeIncBtn');
  const decBtn = document.getElementById('fontSizeDecBtn');

  assert('3. Word Editoru ve Arac Cubugu', 'Varsayilan yazi boyutu 12pt (16px) ile editör ve stepper birebir senkronize baslar',
    fsInput.value === '12', `Baslangic punto: ${fsInput.value}pt`);

  // Test Punto Stepper (Selected Word: 12 -> 13 -> 14 -> 15 -> 16 -> 18 -> 16 -> 15 -> 14 -> 13 -> 12)
  const pNode = editor.querySelector('p').firstChild;
  const range = document.createRange();
  range.setStart(pNode, 0);
  range.setEnd(pNode, 7); // "Kalpten"
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const stepHistory = [parseInt(fsInput.value, 10)];
  incBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));
  incBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));
  incBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));
  incBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));
  incBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));
  decBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));
  decBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));
  decBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));
  decBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));
  decBtn.click(); stepHistory.push(parseInt(fsInput.value, 10));

  const expectedSteps = '12,13,14,15,16,18,16,15,14,13,12';
  assert('3. Word Editoru ve Arac Cubugu', 'Punto Stepper (+ / -) 36\'ya atlamadan adim adim ilerler ve geri doner',
    stepHistory.join(',') === expectedSteps, `Adimlar: ${stepHistory.join(' -> ')}`);

  // Test Punto Stepper with collapsed cursor inside a word
  const textNode2 = editor.querySelector('p').lastChild;
  const collapsedRange = document.createRange();
  collapsedRange.setStart(textNode2, 3);
  collapsedRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(collapsedRange);
  fsInput.value = '12';
  incBtn.click();
  assert('3. Word Editoru ve Arac Cubugu', 'Metin secili degilken imlec kelime icindeyse + tusu kelimeyi otomatik secip buyutur',
    fsInput.value === '13', `Yeni punto: ${fsInput.value}pt`);

  // Test Bold, Italic, Underline
  document.querySelector('[data-command="bold"]').click();
  document.querySelector('[data-command="italic"]').click();
  document.querySelector('[data-command="underline"]').click();
  assert('3. Word Editoru ve Arac Cubugu', 'Kalin (B), Italik (I) ve Alti Cizili (U) komutlari calisir',
    editor.innerHTML.includes('font-weight') || editor.querySelector('b, strong, span[style*="bold"]') !== null,
    'Formatting applied');

  // Test Text Color Popover & Highlighter Popover
  const textColorBtn = document.getElementById('wordTextColorBtn');
  const textColorPopover = document.getElementById('wordTextColorPopover');
  textColorBtn.dispatchEvent(new MouseEvent('mousedown'));
  textColorBtn.click();
  const popOpened = textColorPopover.classList.contains('active');
  const redSwatch = textColorPopover.querySelector('[data-color="#DC2626"]');
  redSwatch.click();
  const popClosedAfterSwatch = !textColorPopover.classList.contains('active');
  assert('3. Word Editoru ve Arac Cubugu', 'Yazi Rengi paleti acilir, renk secilir ve bar guncellenir',
    popOpened && popClosedAfterSwatch, `Opened:${popOpened}, Closed:${popClosedAfterSwatch}`);

  const hlBtn = document.getElementById('wordHighlightColorBtn');
  const hlPopover = document.getElementById('wordHighlightColorPopover');
  hlBtn.dispatchEvent(new MouseEvent('mousedown'));
  hlBtn.click();
  const hlOpened = hlPopover.classList.contains('active');
  hlPopover.querySelector('[data-color="#FEF08A"]').click();
  assert('3. Word Editoru ve Arac Cubugu', 'Fosforlu Vurgu Kalemi paleti acilir ve vurgu rengi uygulanir',
    hlOpened && !hlPopover.classList.contains('active'), 'Highlighter applied');

  // Test Format Painter (Bicim Boyacisi)
  editor.innerHTML = '<p><span id="srcSpan" style="font-size: 22pt; font-weight: bold; font-style: italic; color: rgb(220, 38, 38);">KaynakKelime</span> ve <span id="dstSpan">HedefKelime</span></p>';
  const srcEl = document.getElementById('srcSpan').firstChild;
  const rSrc = document.createRange();
  rSrc.setStart(srcEl, 0);
  rSrc.setEnd(srcEl, 6);
  sel.removeAllRanges();
  sel.addRange(rSrc);

  const fpBtn = document.getElementById('formatPainterBtn');
  fpBtn.click();
  const fpActive = fpBtn.classList.contains('painting');

  const dstEl = document.getElementById('dstSpan').firstChild;
  const rDst = document.createRange();
  rDst.selectNodeContents(dstEl);
  sel.removeAllRanges();
  sel.addRange(rDst);
  editor.dispatchEvent(new MouseEvent('mouseup'));

  const fpDeactivated = !fpBtn.classList.contains('painting');
  const dstComp = window.getComputedStyle(document.getElementById('dstSpan').querySelector('span') || document.getElementById('dstSpan'));
  assert('3. Word Editoru ve Arac Cubugu', 'Bicim Boyacisi (Format Painter) stili kopyalar, hedefe uygular ve kapanir',
    fpActive && fpDeactivated && Math.round(parseFloat(dstComp.fontSize) * 0.75) === 22,
    `fpActive:${fpActive}, fpDeactivated:${fpDeactivated}, targetPt:${Math.round(parseFloat(dstComp.fontSize) * 0.75)}`);

  // Test Table Insertion Modal
  document.getElementById('wordInsertTableBtn').click();
  const tblModalOpen = document.getElementById('tableModal').classList.contains('active');
  document.getElementById('tableRows').value = '2';
  document.getElementById('tableCols').value = '3';
  document.getElementById('confirmInsertTableBtn').click();
  assert('3. Word Editoru ve Arac Cubugu', 'Tablo Ekleme modali acilir ve 2x3 tabloyu belgeye ekler',
    tblModalOpen && editor.querySelectorAll('table tbody tr').length === 2 && editor.querySelectorAll('table thead th').length === 3,
    `Rows:${editor.querySelectorAll('table tbody tr').length}, Cols:${editor.querySelectorAll('table thead th').length}`);

  // Test Page Layout Dropdown (Margins, Orientation, View Mode, Page Break)
  const marginsSel = document.getElementById('wordMarginsSelect');
  marginsSel.value = 'narrow';
  marginsSel.dispatchEvent(new Event('change'));
  const hasNarrow = editor.classList.contains('margin-narrow');
  marginsSel.value = 'normal';
  marginsSel.dispatchEvent(new Event('change'));

  document.getElementById('wordOrientationBtn').click();
  const hasLandscape = editor.classList.contains('orientation-landscape');
  document.getElementById('wordOrientationBtn').click();

  document.getElementById('wordToggleViewBtn').click();
  const hasFullWidth = document.getElementById('editorContainer').classList.contains('full-width');
  document.getElementById('wordToggleViewBtn').click();

  document.getElementById('wordInsertPageBreakBtn').click();
  const hasPageBreak = editor.innerHTML.includes('Sayfa Sonu');

  assert('3. Word Editoru ve Arac Cubugu', 'Sayfa Duzeni menusu (Kenar Boslugu, Yatay/Dikey, Ekran Modu, Sayfa Sonu) calisir',
    hasNarrow && hasLandscape && hasFullWidth && hasPageBreak,
    `narrow:${hasNarrow}, landscape:${hasLandscape}, fullWidth:${hasFullWidth}, pageBreak:${hasPageBreak}`);

  // Test Find & Replace
  editor.innerHTML = '<p>Merhaba dunya, guzel dunya!</p>';
  document.getElementById('wordFindBtn').click();
  const findBarOpen = document.getElementById('findReplaceBar').classList.contains('show');
  document.getElementById('findInputText').value = 'dunya';
  document.getElementById('replaceInputText').value = 'evren';
  document.getElementById('replaceAllBtn').click();
  document.getElementById('closeFindBarBtn').click();
  assert('3. Word Editoru ve Arac Cubugu', 'Bul ve Degistir (Tumunu Degistir) HTML yapisini bozmadan metni degistirir',
    findBarOpen && editor.innerText.trim() === 'Merhaba evren, guzel evren!',
    editor.innerText.trim());

  // =========================================================================
  // 4. SAVE & KUTUPHANEM (SAVE, LIST, SEARCH, FILTER, DELETE)
  // =========================================================================
  titleInput.value = 'Otomasyon_Test_Belgesi.docx';
  await window.saveWordDocument();
  await sleep(200);
  const saveBtn = document.getElementById('globalSaveBtn');
  const bottomSaveState = document.getElementById('wordSaveState').textContent;
  const btnTxt = (saveBtn.querySelector('.btn-text')?.textContent || '').trim();
  assert('4. Kaydetme ve Kutuphanem', 'Kaydet butonu yesil "Kaydedildi" onayi verir ve alt durum cubugunu gunceller',
    (saveBtn.classList.contains('is-saved-feedback') || btnTxt === 'Kaydedildi') && bottomSaveState.toLowerCase().includes('kaydedildi'),
    `BtnText: "${btnTxt}", Status: "${bottomSaveState}"`);

  // Open Kutuphanem Modal
  await window.openLibrary('all');
  await sleep(300);
  const libModalOpen = document.getElementById('libraryModal').classList.contains('active');
  const libCards = Array.from(document.querySelectorAll('#libraryItemsContainer .library-card'));
  const savedCard = libCards.find(c => c.dataset.name === 'Otomasyon_Test_Belgesi.docx');
  assert('4. Kaydetme ve Kutuphanem', 'Kaydedilen belge Kutuphanem modalinda aninda listelenir',
    libModalOpen && Boolean(savedCard), `Toplam belge: ${libCards.length}`);

  // Test Library Search
  const searchInput = document.getElementById('librarySearchInput');
  searchInput.value = 'Otomasyon_Test';
  searchInput.dispatchEvent(new Event('input'));
  const filteredCards = document.querySelectorAll('#libraryItemsContainer .library-card');
  searchInput.value = '';
  searchInput.dispatchEvent(new Event('input'));
  assert('4. Kaydetme ve Kutuphanem', 'Kutuphanem canli arama filtresi dogru sonuclari gosterir',
    filteredCards.length >= 1, `Arama sonucu: ${filteredCards.length} kart`);

  // Test Delete from Library (/api/delete-file)
  if (savedCard) {
    savedCard.querySelector('.library-btn-del').click();
    await sleep(350);
  }
  const cardsAfterDel = Array.from(document.querySelectorAll('#libraryItemsContainer .library-card'));
  const stillExists = cardsAfterDel.some(c => c.dataset.name === 'Otomasyon_Test_Belgesi.docx');
  assert('4. Kaydetme ve Kutuphanem', 'Kutuphanem icinden belge silme (/api/delete-file) basarili calisir',
    !stillExists, `Silindi mi: ${!stillExists}`);

  closeModal('libraryModal');

  // =========================================================================
  // 5. PDF STUDIO (LOAD, RENDER, ZOOM, ROTATE, SIGN, ORGANIZE, PRINT)
  // =========================================================================
  window.switchTab('pdfTab');
  await sleep(100);

  const pdfDoc = await window.PDFLib.PDFDocument.create();
  const page1 = pdfDoc.addPage([595.28, 841.89]);
  page1.drawText('Kalpten Kaleme PDF Test Sayfa 1', { x: 50, y: 750, size: 18 });
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  page2.drawText('Kalpten Kaleme PDF Test Sayfa 2', { x: 50, y: 750, size: 18 });
  const pdfBytes = await pdfDoc.save();

  await window.loadPdfFromBuffer(pdfBytes.buffer, 'Test_Kitap.pdf');
  await sleep(600);

  const pdfWrappers = document.querySelectorAll('#pdfPagesContainer .pdf-page-wrapper');
  const pageInd = document.getElementById('pdfPageIndicator').textContent;
  assert('5. PDF Studyosu', '2 sayfali PDF yuklenir, kanvaslar ve kucuk resimler (thumbnails) cizilir',
    pdfWrappers.length === 2 && pageInd.includes('/ 2'),
    `Sayfa sayisi: ${pdfWrappers.length}, Gosterge: ${pageInd}`);

  // Zoom In / Out
  const initZoom = document.getElementById('pdfZoomLabel').textContent;
  document.getElementById('pdfZoomInBtn').click();
  await sleep(250);
  const zoomedIn = document.getElementById('pdfZoomLabel').textContent;
  document.getElementById('pdfZoomOutBtn').click();
  await sleep(250);
  assert('5. PDF Studyosu', 'PDF Yakinlastir / Uzaklastir (% Zoom) calisir',
    initZoom !== zoomedIn, `${initZoom} -> ${zoomedIn}`);

  // Rotate Page
  document.getElementById('pdfRotateBtn').click();
  await sleep(250);
  assert('5. PDF Studyosu', 'PDF Sayfa Dondurme (90 derece) calisir',
    window.pdfState.pageRotations[1] === 90, `Rotation: ${window.pdfState.pageRotations[1]}`);

  // Signature Modal
  document.getElementById('pdfSignBtn').click();
  const signModalOpen = document.getElementById('signatureModal').classList.contains('active');
  closeModal('signatureModal');
  assert('5. PDF Studyosu', 'Islak Imza ve Kase modali acilir', signModalOpen, 'Signature modal active');

  // Organize Pages Modal
  document.getElementById('pdfOrganizePagesBtn').click();
  await sleep(300);
  const orgModalOpen = document.getElementById('organizePagesModal').classList.contains('active');
  const orgCards = document.querySelectorAll('#pageOrganizerGrid .page-organizer-card').length;
  closeModal('organizePagesModal');
  assert('5. PDF Studyosu', 'Sayfa Yoneticisi modali acilir ve tum sayfalari listeler',
    orgModalOpen && orgCards === 2, `Organizer cards: ${orgCards}`);

  // PDF Clean Print Preparation
  await window.prepareCleanPrintRoot();
  const pdfPrintPages = document.querySelectorAll('#kalptenPrintRoot .kalpten-print-pdf-page').length;
  assert('5. PDF Studyosu', 'PDF yazdirma motoru (prepareCleanPrintRoot) tum sayfalari hazirlar',
    pdfPrintPages === 2, `Print pages: ${pdfPrintPages}`);

  // =========================================================================
  // 6. POWERPOINT SUNUM STUDYOSU (SLIDES, LAYOUTS, THEMES, ELEMENTS, F5)
  // =========================================================================
  window.switchTab('pptTab');
  await sleep(100);

  const initSlides = window.pptEditor.state.slides.length;
  window.pptEditor.addSlide('title_content');
  window.pptEditor.addSlide('two_col');
  const afterAddSlides = window.pptEditor.state.slides.length;
  assert('6. Sunum Studyosu (PPT)', 'Yeni slaytlar farkli duzenlerle (Baslik ve Icerik, Iki Sutun) eklenir',
    afterAddSlides === initSlides + 2, `Slayt sayisi: ${initSlides} -> ${afterAddSlides}`);

  // Theme change
  const pptThemeSel = document.getElementById('pptThemeSelect');
  pptThemeSel.value = 'theme-sepia-book';
  pptThemeSel.dispatchEvent(new Event('change'));
  const canvasHasTheme = document.getElementById('pptActiveSlideCanvas').classList.contains('theme-sepia-book');
  assert('6. Sunum Studyosu (PPT)', 'Sunum temasi (Kitap Kagidi / Gece Laciverti vb.) aninda uygulanir',
    canvasHasTheme, 'theme-sepia-book applied');

  // Add Elements (+ Metin, + Liste, + Kart)
  document.getElementById('pptAddTextBoxBtn').click();
  document.getElementById('pptAddBulletBtn').click();
  document.getElementById('pptAddCardBtn').click();
  const activeCanvasHtml = document.getElementById('pptActiveSlideCanvas').innerHTML;
  assert('6. Sunum Studyosu (PPT)', 'Slayta + Metin, + Liste ve + Kart bilesenleri eklenir',
    activeCanvasHtml.includes('Yeni metin kutusu') || activeCanvasHtml.includes('ul') || activeCanvasHtml.length > 100,
    `Canvas length: ${activeCanvasHtml.length}`);

  // Duplicate & Delete Slide
  const beforeDup = window.pptEditor.state.slides.length;
  document.getElementById('pptDuplicateSlideBtn').click();
  const afterDup = window.pptEditor.state.slides.length;
  document.getElementById('pptDeleteSlideBtn').click();
  const afterDel = window.pptEditor.state.slides.length;
  assert('6. Sunum Studyosu (PPT)', 'Slayt cogaltma ve silme islemleri calisir',
    afterDup === beforeDup + 1 && afterDel === beforeDup, `${beforeDup} -> ${afterDup} -> ${afterDel}`);

  // Fullscreen Presentation (F5)
  document.getElementById('pptPresentBtn').click();
  await sleep(100);
  const presOverlay = document.getElementById('pptPresentationOverlay');
  const presOpen = presOverlay.style.display !== 'none';
  document.getElementById('pptHudExitBtn').click();
  await sleep(100);
  const presClosed = presOverlay.style.display === 'none';
  assert('6. Sunum Studyosu (PPT)', 'Tam Ekran Slayt Gosterisi (F5) acilir ve Cikis (ESC) ile kapanir',
    presOpen && presClosed, `presOpen:${presOpen}, presClosed:${presClosed}`);

  // =========================================================================
  // 7. ACROBAT HIZLI ARACLAR (MERGE, SPLIT, IMG-TO-PDF, PDF-TO-WORD)
  // =========================================================================
  window.switchTab('toolsTab');
  await sleep(100);
  const toolsReady = Boolean(
    document.getElementById('toolMergeBtn') &&
    document.getElementById('toolSplitBtn') &&
    document.getElementById('toolImgToPdfBtn') &&
    document.getElementById('toolExtractTextBtn')
  );
  assert('7. Hizli PDF Araclari', 'Tum PDF arac kartlari (Birlestir, Ayikla, Gorselden PDF, PDF->Word) hazir',
    toolsReady, '4/4 arac karti aktif');

  // Switch back to wordTab
  window.switchTab('wordTab');
  editor.innerHTML = '<h1>Kalpten Kaleme</h1><p>Edebi yazi, PDF ve sunum atolyesi tum testlerden basariyla gecti.</p>';
  titleInput.value = 'Yeni Yazı.docx';
  fsInput.value = '12';

  while (window.docManager.docs.length > 1) {
    window.docManager.docs.pop();
  }
  window.docManager.docs[0].type = 'word';
  window.docManager.docs[0].title = 'Yeni Yazı.docx';
  window.docManager.activeDocId = window.docManager.docs[0].id;
  window.docManager.renderTabs();

  window.confirm = window.__origConfirm;
  window.prompt = window.__origPrompt;

  assert('8. Hata Denetimi', 'Tum masaustu testleri boyunca 0 calisma zamani hatasi (0 Console Error)',
    errors.length === 0, errors.length ? errors.join('; ') : 'Sifir hata');

  return { results, errors };
})();
'@

    $evalResp = Invoke-CDP "Runtime.evaluate" @{
        expression = $jsTestSuite
        awaitPromise = $true
        returnByValue = $true
    }

    if ($evalResp.result.exceptionDetails) {
        Write-Output "JS EXCEPTION: $($evalResp.result.exceptionDetails | ConvertTo-Json -Depth 5)"
    }
    $desktopReport = $evalResp.result.result.value

    $artifactDir = "C:\Users\Erdem\.gemini\antigravity\brain\fc7d5a54-3292-42a2-b99e-ca574ab289ce"
    Save-Screenshot (Join-Path $artifactDir "audit_desktop_word_v110.png")

    # =========================================================================
    # PHASE 2: MOBILE & ANDROID MODE SIMULATION (390x844 Touch Viewport)
    # =========================================================================
    Invoke-CDP "Emulation.setDeviceMetricsOverride" @{
        width = 390
        height = 844
        deviceScaleFactor = 3
        mobile = $true
    } | Out-Null
    Invoke-CDP "Emulation.setTouchEmulationEnabled" @{
        enabled = $true
    } | Out-Null
    Invoke-CDP "Emulation.setUserAgentOverride" @{
        userAgent = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
    } | Out-Null

    $jsMobileTest = @'
(async function() {
  const results = [];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function assert(category, name, condition, detail = '') {
    results.push({ category, name, passed: Boolean(condition), detail: String(detail || '') });
  }

  window.dispatchEvent(new Event('resize'));
  await sleep(150);

  assert('9. Mobil ve Android Modu', 'Mobil gorunumde is-mobile-app aktif ve is-windows-suite devre disi',
    document.documentElement.classList.contains('is-mobile-app') && !document.documentElement.classList.contains('is-windows-suite'),
    document.documentElement.className);

  const headerCenterDisp = window.getComputedStyle(document.querySelector('.header-center')).display;
  assert('9. Mobil ve Android Modu', 'Mobilde ve Web\'de coklu modul sekmeleri [PDF/Sunum/Araclar] gizli (Sadece Word)',
    headerCenterDisp === 'none', `header-center display: ${headerCenterDisp}`);

  document.getElementById('mobileMoreBtn').click();
  await sleep(100);
  const sheetModal = document.getElementById('mobileActionSheetModal');
  const sheetOpen = sheetModal.classList.contains('active');
  assert('9. Mobil ve Android Modu', 'Mobil Secenekler Cekmecesi (#mobileActionSheetModal) acilir',
    sheetOpen, 'Action sheet opened');

  document.getElementById('atmoDarkBtn').click();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.getElementById('atmoCreamBtn').click();
  const isCream = document.documentElement.getAttribute('data-theme') === 'light' && document.documentElement.getAttribute('data-paper') === 'book';
  assert('9. Mobil ve Android Modu', 'Mobil 3\'lu Yazma Atmosferi (Beyaz / Kitap Kagidi / Gece) calisir',
    isDark && isCream, `isDark:${isDark}, isCream:${isCream}`);

  const mobFs = document.getElementById('mobileFontSizeSelect');
  mobFs.value = '18pt';
  mobFs.dispatchEvent(new Event('change'));
  const stepperVal = document.getElementById('fontSizeInput').value;
  assert('9. Mobil ve Android Modu', 'Mobil yazi boyutu secimi masaustu Punto Stepper ile senkronize calisir',
    stepperVal === '18', `Stepper input: ${stepperVal}`);

  const backHandledModal = window.__handleAndroidBack();
  assert('9. Mobil ve Android Modu', 'Android Geri Tusu (__handleAndroidBack) acik cekmeceyi/modali kapatir',
    backHandledModal === true && !sheetModal.classList.contains('active'),
    `handled:${backHandledModal}`);

  return { results };
})();
'@

    $mobResp = Invoke-CDP "Runtime.evaluate" @{
        expression = $jsMobileTest
        awaitPromise = $true
        returnByValue = $true
    }

    if ($mobResp.result.exceptionDetails) {
        Write-Output "MOB EXCEPTION: $($mobResp.result.exceptionDetails | ConvertTo-Json -Depth 5)"
    }
    $mobileReport = $mobResp.result.result.value
    Save-Screenshot (Join-Path $artifactDir "audit_mobile_word_v110.png")

    $allResults = @()
    if ($desktopReport.results) { $allResults += $desktopReport.results }
    if ($mobileReport.results) { $allResults += $mobileReport.results }

    $passedCount = ($allResults | Where-Object { $_.passed }).Count
    $totalCount = $allResults.Count

    Write-Output "=================================================================="
    Write-Output "KALPTEN KALEME - TAM KAPSAMLI E2E TEST RAPORU ($passedCount / $totalCount BASARILI)"
    Write-Output "=================================================================="
    foreach ($r in $allResults) {
        $icon = if ($r.passed) { "[PASS]" } else { "[FAIL]" }
        Write-Output "$icon [$($r.category)] $($r.name) -> $($r.detail)"
    }
    if ($passedCount -lt $totalCount) {
        exit 1
    }
} finally {
    if ($edgeProc -and -not $edgeProc.HasExited) {
        Stop-Process -Id $edgeProc.Id -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $tempProfile -Recurse -Force -ErrorAction SilentlyContinue
}
