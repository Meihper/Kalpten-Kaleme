/**
 * Studio Office Pro - Core Controller
 * Handles tabs, themes, global drag-and-drop, modals, and keyboard shortcuts.
 */

const appState = {
  currentTab: 'wordTab',
  theme: localStorage.getItem('studio_theme') || 'light'
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('oneuiToast');
  const msgEl = document.getElementById('toastMessage');
  if (!toast || !msgEl) return;

  msgEl.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

// Native page layout details fixed-positioning & dismiss on outside click
const pageLayoutDetailsEl = document.getElementById('pageLayoutDetails');
const pageLayoutMenuEl = document.getElementById('pageLayoutMenu');

function updatePageLayoutMenuPos() {
  if (!pageLayoutDetailsEl || !pageLayoutMenuEl || !pageLayoutDetailsEl.open) return;
  const rect = pageLayoutDetailsEl.getBoundingClientRect();
  pageLayoutMenuEl.style.top = (rect.bottom + 6) + 'px';
  pageLayoutMenuEl.style.left = 'auto';
  pageLayoutMenuEl.style.right = Math.max(12, window.innerWidth - rect.right) + 'px';
}

if (pageLayoutDetailsEl) {
  pageLayoutDetailsEl.addEventListener('toggle', () => {
    if (pageLayoutDetailsEl.open) updatePageLayoutMenuPos();
  });
}

window.addEventListener('resize', updatePageLayoutMenuPos);
window.addEventListener('scroll', updatePageLayoutMenuPos, true);

document.addEventListener('click', (e) => {
  if (pageLayoutDetailsEl && pageLayoutDetailsEl.open && !pageLayoutDetailsEl.contains(e.target)) {
    pageLayoutDetailsEl.removeAttribute('open');
  }
});

// Enable horizontal mouse wheel scrolling on toolbars when content exceeds viewport
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.slim-toolbar').forEach(tb => {
    tb.addEventListener('wheel', (e) => {
      if (e.deltaY !== 0 && tb.scrollWidth > tb.clientWidth) {
        e.preventDefault();
        tb.scrollLeft += e.deltaY * 0.9;
      }
    }, { passive: false });
  });
});

function setTheme(theme) {
  appState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('studio_theme', theme);

  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    if (theme === 'dark') {
      themeIcon.innerHTML = `
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      `;
    } else {
      themeIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
    }
  }
}

function isMobileWordStudio() {
  if (Boolean(window.AndroidBridge)) return true;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|Silk/i.test(ua)) return true;
  const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && window.innerWidth <= 768) return true;
  return false;
}

function syncMobileAppMode() {
  const isMobile = isMobileWordStudio();
  const isLandscape = isMobile && window.innerWidth > window.innerHeight;
  document.documentElement.classList.toggle('is-mobile-app', isMobile);
  document.body.classList.toggle('is-mobile-app', isMobile);
  document.documentElement.classList.toggle('is-mobile-landscape', isLandscape);
  document.body.classList.toggle('is-mobile-landscape', isLandscape);

  if (isMobile && !appState.currentTab) {
    appState.currentTab = 'wordTab';
  }

  if (window.docManager) {
    window.docManager.renderTabs();
  }
}

// Immediately trigger mobile sync on script parse
syncMobileAppMode();
window.addEventListener('resize', syncMobileAppMode);
window.addEventListener('orientationchange', () => {
  setTimeout(syncMobileAppMode, 100);
  setTimeout(syncMobileAppMode, 300);
});

function switchTab(tabId) {
  if (!tabId) tabId = 'wordTab';
  appState.currentTab = tabId;

  document.querySelectorAll('.nav-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.mobile-suite-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  const wordDocTitle = document.getElementById('wordDocTitle');
  const pdfDocTitle = document.getElementById('pdfDocTitle');
  const pptDocTitle = document.getElementById('pptDocTitle');
  if (wordDocTitle && pdfDocTitle) {
    wordDocTitle.style.display = tabId === 'wordTab' ? 'inline-block' : 'none';
    pdfDocTitle.style.display = tabId === 'pdfTab' ? 'inline-block' : 'none';
    if (pptDocTitle) {
      pptDocTitle.style.display = tabId === 'pptTab' ? 'inline-block' : 'none';
    }
  }

  // Update doc capsule luxury icon
  const capsuleIcon = document.getElementById('docCapsuleTypeIcon');
  if (capsuleIcon) {
    if (tabId === 'pdfTab') capsuleIcon.src = 'pdf_file.png';
    else if (tabId === 'pptTab') capsuleIcon.src = 'pptx_file.png';
    else if (tabId === 'toolsTab') capsuleIcon.src = 'tools_file.png';
    else capsuleIcon.src = 'docx_file.png';
  }
}

window.switchTab = switchTab;
window.appState = appState;
window.setTheme = setTheme;

// ========================================================================
// Multi-Document Manager (Sekme & Çoklu Belge Yöneticisi)
// ========================================================================
const docManager = {
  docs: [],
  activeDocId: null,
  nextId: 1,

  init() {
    const savedDraft = localStorage.getItem('kalpten_kaleme_word_draft') || localStorage.getItem('studio_office_word_draft');
    const rawSavedTitle = localStorage.getItem('kalpten_kaleme_word_title') || localStorage.getItem('studio_office_word_title') || 'Yeni Yazı.docx';
    const isInvalidTitle = /\.(apk|zip|exe|bat|vbs|ps1|rar|7z)$/i.test(rawSavedTitle.trim());
    const isDummy = savedDraft && (savedDraft.includes('Gönülden dökülen kelimeler') || savedDraft.includes('Belge Başlığı') || savedDraft.includes('Yeni Yazı</h1>'));
    const hasValidDraft = Boolean(savedDraft && savedDraft.trim().length > 10 && !isDummy && !isInvalidTitle);
    const savedTitle = hasValidDraft ? rawSavedTitle : 'Yeni Yazı.docx';

    const initialDoc = {
      id: 'doc_' + (this.nextId++),
      title: savedTitle,
      type: 'word',
      content: hasValidDraft ? savedDraft : '',
      isDefault: !hasValidDraft
    };
    this.docs.push(initialDoc);
    this.activeDocId = initialDoc.id;
    this.renderTabs();

    // Hook listeners for document title pills
    const wordTitle = document.getElementById('wordDocTitle');
    const pdfTitle = document.getElementById('pdfDocTitle');

    wordTitle?.addEventListener('input', (e) => {
      this.updateActiveDocTitle(e.target.value);
    });

    pdfTitle?.addEventListener('input', (e) => {
      this.updateActiveDocTitle(e.target.value);
      if (window.pdfState) window.pdfState.fileName = e.target.value;
    });

    // Hook + Yeni Belge tab button
    document.getElementById('newDocTabBtn')?.addEventListener('click', () => {
      const activeNav = document.querySelector('.nav-pill-btn.active');
      if (activeNav && activeNav.dataset.tab === 'pptTab') {
        this.createNewPptDoc();
      } else {
        this.createNewWordDoc();
      }
    });
  },

  getActiveDoc() {
    return this.docs.find(d => d.id === this.activeDocId);
  },

  updateActiveDocTitle(newTitle) {
    const activeDoc = this.getActiveDoc();
    if (activeDoc) {
      activeDoc.title = newTitle || (activeDoc.type === 'pdf' ? 'Belge.pdf' : 'Yeni Yazı.docx');
      activeDoc.isDefault = false;
      this.renderTabs();
    }
  },

  saveCurrentDocState() {
    const activeDoc = this.getActiveDoc();
    if (!activeDoc) return;

    if (activeDoc.type === 'word') {
      const editor = document.getElementById('wordEditor');
      const titleInput = document.getElementById('wordDocTitle');
      if (editor) activeDoc.content = editor.innerHTML;
      if (titleInput) activeDoc.title = titleInput.value;
    } else if (activeDoc.type === 'ppt') {
      const titleInput = document.getElementById('pptDocTitle');
      if (titleInput) activeDoc.title = titleInput.value;
      if (window.pptEditor) {
        activeDoc.pptStateSnapshot = JSON.parse(JSON.stringify(window.pptEditor.state));
      }
    } else if (activeDoc.type === 'pdf') {
      const titleInput = document.getElementById('pdfDocTitle');
      if (titleInput) activeDoc.title = titleInput.value;
      if (window.pdfState) {
        activeDoc.pdfStateSnapshot = {
          rawBytes: window.pdfState.rawBytes,
          fileName: window.pdfState.fileName,
          pdfDoc: window.pdfState.pdfDoc,
          numPages: window.pdfState.numPages,
          currentPage: window.pdfState.currentPage,
          scale: window.pdfState.scale,
          activeTool: window.pdfState.activeTool,
          pageRotations: Object.assign({}, window.pdfState.pageRotations),
          pageOrder: [...(window.pdfState.pageOrder || [])],
          annotations: [...(window.pdfState.annotations || [])],
          editedTexts: [...(window.pdfState.editedTexts || [])],
          images: [...(window.pdfState.images || [])]
        };
      }
    }
  },

  async switchTo(docId) {
    if (docId === this.activeDocId) return;
    const targetDoc = this.docs.find(d => d.id === docId);
    if (!targetDoc) return;

    // 1. Save current active document state
    this.saveCurrentDocState();

    // 2. Set new active ID
    this.activeDocId = docId;
    this.renderTabs();

    // 3. Restore target document
    if (targetDoc.type === 'word') {
      switchTab('wordTab');
      const editor = document.getElementById('wordEditor');
      const titleInput = document.getElementById('wordDocTitle');
      if (editor) editor.innerHTML = targetDoc.content || '<p></p>';
      if (titleInput) titleInput.value = targetDoc.title || 'Yeni Yazı.docx';
      if (window.updateWordStats) window.updateWordStats();
    } else if (targetDoc.type === 'ppt') {
      switchTab('pptTab');
      const titleInput = document.getElementById('pptDocTitle');
      if (titleInput) titleInput.value = targetDoc.title || 'Sunum 1.pptx';
      if (targetDoc.pptStateSnapshot && window.pptEditor) {
        window.pptEditor.state = JSON.parse(JSON.stringify(targetDoc.pptStateSnapshot));
        window.pptEditor.render();
      }
    } else if (targetDoc.type === 'pdf') {
      switchTab('pdfTab');
      const titleInput = document.getElementById('pdfDocTitle');
      if (titleInput) titleInput.value = targetDoc.title || 'Belge.pdf';

      if (targetDoc.pdfStateSnapshot && window.pdfState) {
        Object.assign(window.pdfState, targetDoc.pdfStateSnapshot);
        if (window.renderAllPages) await window.renderAllPages();
        if (window.renderThumbnails) await window.renderThumbnails();
        if (window.updatePageIndicator) window.updatePageIndicator();
      } else if (targetDoc.rawBytes && window.loadPdfFromBuffer) {
        await window.loadPdfFromBuffer(targetDoc.rawBytes, targetDoc.title);
      }
    }
  },

  createNewWordDoc() {
    this.saveCurrentDocState();
    const count = this.docs.filter(d => d.type === 'word').length + 1;
    const newDoc = {
      id: 'doc_' + (this.nextId++),
      title: `Yeni Yazı ${count}.docx`,
      type: 'word',
      content: '',
      isDefault: false
    };
    this.docs.push(newDoc);
    this.switchTo(newDoc.id);
    showToast(`"${newDoc.title}" sayfası açıldı.`);
  },

  createNewPptDoc() {
    this.saveCurrentDocState();
    const count = this.docs.filter(d => d.type === 'ppt').length + 1;
    const newDoc = {
      id: 'doc_' + (this.nextId++),
      title: `Sunum ${count}.pptx`,
      type: 'ppt',
      pptStateSnapshot: {
        slides: [
          {
            id: 'slide_1',
            layout: 'title',
            title: '',
            subtitle: '',
            content: '',
            leftCol: '',
            rightCol: '',
            quote: '',
            author: ''
          }
        ],
        currentIndex: 0,
        theme: 'theme-clean-light',
        aspectRatio: '16:9',
        zoom: 100,
        fileName: `Sunum ${count}.pptx`
      },
      isDefault: false
    };
    this.docs.push(newDoc);
    this.switchTo(newDoc.id);
    showToast(`"${newDoc.title}" sunumu açıldı.`);
  },

  onWordLoaded(fileName, content, arrayBuffer) {
    const editor = document.getElementById('wordEditor');
    const wordTitle = document.getElementById('wordDocTitle');

    const activeDoc = this.getActiveDoc();
    const currentText = editor ? editor.innerText.trim() : '';
    const isDocEmpty = !currentText || currentText.length === 0;

    if (activeDoc && activeDoc.isDefault && activeDoc.type === 'word' && isDocEmpty) {
      activeDoc.title = fileName;
      activeDoc.content = content;
      activeDoc.rawBytes = arrayBuffer;
      activeDoc.isDefault = false;
      this.renderTabs();
      switchTab('wordTab');
      if (wordTitle) wordTitle.value = fileName;
      if (editor) editor.innerHTML = content;
      if (window.updateWordStats) window.updateWordStats();
      return;
    }

    const existing = this.docs.find(d => d.title.toLowerCase() === fileName.toLowerCase());
    if (existing) {
      existing.content = content;
      existing.rawBytes = arrayBuffer;
      this.activeDocId = existing.id;
      this.renderTabs();
      switchTab('wordTab');
      if (wordTitle) wordTitle.value = fileName;
      if (editor) editor.innerHTML = content;
      if (window.updateWordStats) window.updateWordStats();
      return;
    }

    this.saveCurrentDocState();
    const newDoc = {
      id: 'doc_' + (this.nextId++),
      title: fileName,
      type: 'word',
      content: content,
      rawBytes: arrayBuffer,
      isDefault: false
    };
    this.docs.push(newDoc);
    this.activeDocId = newDoc.id;
    this.renderTabs();
    switchTab('wordTab');
    if (wordTitle) wordTitle.value = fileName;
    if (editor) editor.innerHTML = content;
    if (window.updateWordStats) window.updateWordStats();
  },

  onPdfLoaded(fileName, arrayBuffer) {
    const activeDoc = this.getActiveDoc();
    const editor = document.getElementById('wordEditor');
    const currentText = (activeDoc?.type === 'word' && editor) ? editor.innerText.trim() : '';
    const isDocEmpty = !currentText || currentText.length === 0;

    if (activeDoc && activeDoc.isDefault && isDocEmpty) {
      activeDoc.title = fileName;
      activeDoc.type = 'pdf';
      activeDoc.rawBytes = arrayBuffer;
      activeDoc.isDefault = false;
      this.renderTabs();
      switchTab('pdfTab');
      const pdfTitle = document.getElementById('pdfDocTitle');
      if (pdfTitle) pdfTitle.value = fileName;
      return;
    }

    const existing = this.docs.find(d => d.title.toLowerCase() === fileName.toLowerCase());
    if (existing) {
      existing.rawBytes = arrayBuffer;
      this.activeDocId = existing.id;
      this.renderTabs();
      switchTab('pdfTab');
      const pdfTitle = document.getElementById('pdfDocTitle');
      if (pdfTitle) pdfTitle.value = fileName;
      return;
    }

    this.saveCurrentDocState();
    const newDoc = {
      id: 'doc_' + (this.nextId++),
      title: fileName,
      type: 'pdf',
      rawBytes: arrayBuffer,
      isDefault: false
    };
    this.docs.push(newDoc);
    this.activeDocId = newDoc.id;
    this.renderTabs();
    switchTab('pdfTab');
    const pdfTitle = document.getElementById('pdfDocTitle');
    if (pdfTitle) pdfTitle.value = fileName;
  },

  onPptLoaded(fileName, pptState) {
    if (window.addRecentDocument) window.addRecentDocument(fileName, 'ppt');
    const activeDoc = this.getActiveDoc();
    const editor = document.getElementById('wordEditor');
    const currentText = (activeDoc?.type === 'word' && editor) ? editor.innerText.trim() : '';
    const isDocEmpty = !currentText || currentText.length === 0;

    if (activeDoc && activeDoc.isDefault && activeDoc.type === 'word' && isDocEmpty) {
      activeDoc.title = fileName;
      activeDoc.type = 'ppt';
      activeDoc.pptStateSnapshot = JSON.parse(JSON.stringify(pptState));
      activeDoc.isDefault = false;
      this.renderTabs();
      switchTab('pptTab');
      const pptTitle = document.getElementById('pptDocTitle');
      if (pptTitle) pptTitle.value = fileName;
      return;
    }

    const existing = this.docs.find(d => d.title.toLowerCase() === fileName.toLowerCase() && d.type === 'ppt');
    if (existing) {
      existing.pptStateSnapshot = JSON.parse(JSON.stringify(pptState));
      this.activeDocId = existing.id;
      this.renderTabs();
      switchTab('pptTab');
      const pptTitle = document.getElementById('pptDocTitle');
      if (pptTitle) pptTitle.value = fileName;
      return;
    }

    this.saveCurrentDocState();
    const newDoc = {
      id: 'doc_' + (this.nextId++),
      title: fileName,
      type: 'ppt',
      pptStateSnapshot: JSON.parse(JSON.stringify(pptState)),
      isDefault: false
    };
    this.docs.push(newDoc);
    this.activeDocId = newDoc.id;
    this.renderTabs();
    switchTab('pptTab');
    const pptTitle = document.getElementById('pptDocTitle');
    if (pptTitle) pptTitle.value = fileName;
  },

  registerCurrentPptDoc() {
    this.saveCurrentDocState();
    const fileName = (window.pptEditor && window.pptEditor.state && window.pptEditor.state.fileName) || 'Sunum 1.pptx';
    const newDoc = {
      id: 'doc_' + (this.nextId++),
      title: fileName,
      type: 'ppt',
      pptStateSnapshot: window.pptEditor ? JSON.parse(JSON.stringify(window.pptEditor.state)) : null,
      isDefault: false
    };
    this.docs.push(newDoc);
    this.activeDocId = newDoc.id;
    this.renderTabs();
    switchTab('pptTab');
    const pptTitle = document.getElementById('pptDocTitle');
    if (pptTitle) pptTitle.value = fileName;
  },

  closeDoc(docId, event) {
    if (event) event.stopPropagation();
    const docToClose = this.docs.find(d => d.id === docId) || this.docs[0];
    if (!docToClose) return;

    const editor = document.getElementById('wordEditor');
    const isCurrentActive = (this.activeDocId === docId);
    let hasContent = false;
    if (docToClose.type === 'word') {
      const text = isCurrentActive && editor ? editor.innerText.trim() : (docToClose.content || '').replace(/<[^>]*>/g, '').trim();
      hasContent = text.length > 0;
    } else if (docToClose.type === 'ppt') {
      hasContent = (docToClose.pptStateSnapshot?.slides?.length > 1) || (docToClose.title && !docToClose.isDefault);
    } else if (docToClose.type === 'pdf') {
      hasContent = Boolean(docToClose.pdfStateSnapshot || docToClose.rawBytes);
    }

    if (hasContent) {
      if (!confirm(`"${docToClose.title}" belgesini kapatmak istediğinize emin misiniz? Kaydedilmemiş değişiklikler silinecektir.`)) {
        return;
      }
    }

    if (this.docs.length <= 1) {
      const doc = this.docs[0];
      doc.title = 'Yeni Yazı.docx';
      doc.type = 'word';
      doc.content = '';
      doc.isDefault = true;
      doc.pdfStateSnapshot = null;
      doc.pptStateSnapshot = null;
      doc.rawBytes = null;
      this.activeDocId = doc.id;
      switchTab('wordTab');
      const titleInput = document.getElementById('wordDocTitle');
      if (editor) editor.innerHTML = '';
      if (titleInput) titleInput.value = doc.title;
      this.renderTabs();
      showToast('Belge sıfırlandı.');
      return;
    }

    const docIndex = this.docs.findIndex(d => d.id === docId);
    if (docIndex === -1) return;

    const closedDoc = this.docs[docIndex];
    this.docs.splice(docIndex, 1);

    if (this.activeDocId === docId) {
      const nextIndex = Math.max(0, docIndex - 1);
      this.activeDocId = this.docs[nextIndex].id;
      const nextDoc = this.docs[nextIndex];
      if (nextDoc.type === 'word') {
        switchTab('wordTab');
        const editor = document.getElementById('wordEditor');
        const titleInput = document.getElementById('wordDocTitle');
        if (editor) editor.innerHTML = nextDoc.content || '<p></p>';
        if (titleInput) titleInput.value = nextDoc.title;
        if (window.updateWordStats) window.updateWordStats();
      } else if (nextDoc.type === 'ppt') {
        switchTab('pptTab');
        const titleInput = document.getElementById('pptDocTitle');
        if (titleInput) titleInput.value = nextDoc.title;
        if (nextDoc.pptStateSnapshot && window.pptEditor) {
          window.pptEditor.state = JSON.parse(JSON.stringify(nextDoc.pptStateSnapshot));
          window.pptEditor.render();
        }
      } else if (nextDoc.type === 'pdf') {
        switchTab('pdfTab');
        const titleInput = document.getElementById('pdfDocTitle');
        if (titleInput) titleInput.value = nextDoc.title;
        if (nextDoc.pdfStateSnapshot && window.pdfState) {
          Object.assign(window.pdfState, nextDoc.pdfStateSnapshot);
          if (window.renderAllPages) window.renderAllPages();
          if (window.renderThumbnails) window.renderThumbnails();
        }
      }
    }

    this.renderTabs();
    showToast(`"${closedDoc.title}" kapatıldı.`);
  },

  renderTabs() {
    const track = document.getElementById('docTabsTrack');
    const tabsBar = document.getElementById('documentTabsBar');
    if (!track) return;

    const visibleDocs = isMobileWordStudio()
      ? this.docs.filter(d => d.type === 'word')
      : this.docs;

    if (tabsBar) {
      tabsBar.classList.toggle('has-multiple-docs', visibleDocs.length > 1);
    }

    track.innerHTML = visibleDocs.map(doc => {
      const isActive = doc.id === this.activeDocId;
      let iconSrc = 'docx_file.png';
      let typeLabel = 'DOCX';
      if (doc.type === 'pdf') {
        iconSrc = 'pdf_file.png';
        typeLabel = 'PDF';
      } else if (doc.type === 'ppt') {
        iconSrc = 'pptx_file.png';
        typeLabel = 'PPTX';
      }
      const safeTitle = escapeHtml(doc.title);
      return `
        <div class="doc-tab ${isActive ? 'active' : ''}" data-id="${doc.id}" title="${safeTitle}">
          <img src="${iconSrc}" class="doc-tab-type-img" alt="${typeLabel}">
          <span class="doc-tab-title">${safeTitle}</span>
          <button class="doc-tab-close" data-id="${doc.id}" title="Belgeyi Kapat (Ctrl+W)">✕</button>
        </div>
      `;
    }).join('');

    // Attach click events
    track.querySelectorAll('.doc-tab').forEach(tabEl => {
      tabEl.addEventListener('click', (e) => {
        if (e.target.classList.contains('doc-tab-close')) return;
        this.switchTo(tabEl.dataset.id);
      });
    });

    track.querySelectorAll('.doc-tab-close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeDoc(closeBtn.dataset.id, e);
      });
    });
  }
};
window.docManager = docManager;

document.addEventListener('DOMContentLoaded', () => {
  syncMobileAppMode();
  setTheme(appState.theme);
  docManager.init();

  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    const nextTheme = appState.theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    showToast(nextTheme === 'dark' ? 'Karanlık Tema Etkinleştirildi' : 'Aydınlık Tema Etkinleştirildi');
  });

  // Paper Tone (Sıcak Kitap Kağıdı / Klasik Beyaz)
  let currentPaper = localStorage.getItem('kalpten_paper_tone') || 'book';
  function setPaperTone(tone) {
    currentPaper = tone;
    localStorage.setItem('kalpten_paper_tone', tone);
    const btn = document.getElementById('paperToneBtn');
    if (tone === 'book') {
      document.documentElement.setAttribute('data-paper', 'book');
      if (btn) btn.innerHTML = '<span class="paper-dot" style="display:inline-block; width:11px; height:11px; border-radius:50%; background:#FAF7EE; border:1px solid #C4BAA9; margin-right:4px;"></span><span class="btn-text">Kitap Kağıdı</span>';
    } else {
      document.documentElement.removeAttribute('data-paper');
      if (btn) btn.innerHTML = '<span class="paper-dot" style="display:inline-block; width:11px; height:11px; border-radius:50%; background:#FFFFFF; border:1px solid #CCC; margin-right:4px;"></span><span class="btn-text">Beyaz Kağıt</span>';
    }
  }
  setPaperTone(currentPaper);

  document.getElementById('paperToneBtn')?.addEventListener('click', () => {
    const nextTone = currentPaper === 'book' ? 'white' : 'book';
    setPaperTone(nextTone);
    showToast(nextTone === 'book' ? 'Sıcak Kitap Kağıdı Tonu Etkin (Gözü Dinlendirir)' : 'Klasik Beyaz Kağıt Modu Etkin');
  });

  // Zen Mode (Odaklanma / Daktilo Modu)
  function toggleZenMode() {
    document.body.classList.toggle('zen-mode');
    const isZen = document.body.classList.contains('zen-mode');
    const isMobile = isMobileWordStudio();
    if (isZen) {
      showToast(isMobile ? 'Tam Ekran Odak Modu Etkin' : 'Odak Modu Etkin (Çıkmak için Esc tuşuna basın)');
    } else {
      showToast('Normal Çalışma Modu');
    }
  }

  document.getElementById('zenModeBtn')?.addEventListener('click', toggleZenMode);
  document.getElementById('exitZenBtn')?.addEventListener('click', toggleZenMode);

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('zen-mode')) {
      toggleZenMode();
    }
    if (e.key === 'F11') {
      e.preventDefault();
      toggleZenMode();
    }
  });

  document.querySelectorAll('.nav-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      if (window.docManager && tabId !== 'toolsTab') {
        const activeDoc = window.docManager.getActiveDoc();
        const expectedType = tabId === 'pptTab' ? 'ppt' : tabId === 'pdfTab' ? 'pdf' : 'word';
        if (activeDoc?.type !== expectedType) {
          const matchingDoc = window.docManager.docs.find(d => d.type === expectedType);
          if (matchingDoc) {
            window.docManager.switchTo(matchingDoc.id);
            return;
          } else if (tabId === 'pptTab') {
            window.docManager.registerCurrentPptDoc();
            return;
          }
        }
      }
      switchTab(btn.dataset.tab);
    });
  });

  // Global Header Actions: Aç (Open File)
  const wordFileInput = document.getElementById('wordFileInput');
  const pdfFileInput = document.getElementById('pdfFileInput');
  const pptFileInput = document.getElementById('pptFileInput');

  function openAnySelectedFile(file) {
    if (!file) return;
    closeModal('libraryModal');
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.pdf')) {
      switchTab('pdfTab');
      if (window.loadPdfFile) window.loadPdfFile(file);
    } else if (name.endsWith('.pptx') || name.endsWith('.ppt') || name.endsWith('.json') || name.endsWith('.slides')) {
      switchTab('pptTab');
      if (window.pptEditor && window.pptEditor.loadFile) {
        window.pptEditor.loadFile(file);
      }
    } else if (['.docx', '.doc', '.txt', '.md', '.html', '.htm'].some(ext => name.endsWith(ext))) {
      switchTab('wordTab');
      if (window.loadWordFile) window.loadWordFile(file);
    } else {
      showToast('Desteklenmeyen dosya türü. Lütfen Word (.docx), PDF veya PowerPoint (.pptx) dosyası seçin.', 'error');
    }
  }

  function triggerUnifiedFilePicker() {
    closeModal('libraryModal');
    const input = document.getElementById('wordFileInput');
    if (input) {
      input.setAttribute('accept', '.docx,.doc,.txt,.html,.md,.pdf,.pptx,.ppt,.json');
      input.click();
    }
  }
  window.triggerUnifiedFilePicker = triggerUnifiedFilePicker;

  wordFileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      openAnySelectedFile(e.target.files[0]);
      e.target.value = '';
    }
  });

  pdfFileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      openAnySelectedFile(e.target.files[0]);
      e.target.value = '';
    }
  });

  pptFileInput?.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      openAnySelectedFile(e.target.files[0]);
      e.target.value = '';
    }
  });

  document.getElementById('pptOpenBtn')?.addEventListener('click', () => {
    pptFileInput?.click();
  });

  document.getElementById('globalOpenBtn')?.addEventListener('click', () => {
    if (appState.currentTab === 'pptTab' && pptFileInput) {
      pptFileInput.click();
    } else if (appState.currentTab === 'pdfTab' && pdfFileInput) {
      pdfFileInput.click();
    } else {
      wordFileInput?.click();
    }
  });

  document.getElementById('globalSaveBtn')?.addEventListener('click', () => {
    if (appState.currentTab === 'pdfTab') {
      if (window.savePdfDocument) window.savePdfDocument();
    } else if (appState.currentTab === 'pptTab') {
      if (window.pptEditor && typeof window.pptEditor.savePresentationDocument === 'function') {
        window.pptEditor.savePresentationDocument();
      } else if (window.pptEditor) {
        window.pptEditor.saveToStorage();
        showToast('Sunum otomatik korundu ve kaydedildi.');
      }
    } else {
      if (window.saveWordDocument) window.saveWordDocument();
    }
  });

  document.getElementById('wordSaveStatus')?.addEventListener('click', () => {
    document.getElementById('globalSaveBtn')?.click();
  });

  // ========================================================================
  // Unified Clean Print Engine (Word, PowerPoint, PDF)
  // Guarantees 100% pure document output without any top headers or toolbars
  // ========================================================================
  function ensurePrintElements() {
    let printRoot = document.getElementById('kalptenPrintRoot');
    if (!printRoot) {
      printRoot = document.createElement('div');
      printRoot.id = 'kalptenPrintRoot';
      document.body.appendChild(printRoot);
    }
    let pageStyle = document.getElementById('kalptenDynamicPrintPageStyle');
    if (!pageStyle) {
      pageStyle = document.createElement('style');
      pageStyle.id = 'kalptenDynamicPrintPageStyle';
      document.head.appendChild(pageStyle);
    }
    return { printRoot, pageStyle };
  }

  window.prepareCleanPrintRoot = async function() {
    const { printRoot, pageStyle } = ensurePrintElements();

    // Remove any legacy print iframes if present
    document.getElementById('oneOfficePrintFrame')?.remove();
    document.getElementById('oneOfficePptPrintFrame')?.remove();

    if (appState.currentTab === 'pptTab' && window.pptEditor) {
      window.pptEditor.syncCurrentSlideFromDOM();
      const isPortrait = window.pptEditor.state.aspectRatio === 'a4-portrait';
      pageStyle.textContent = `@page { size: A4 ${isPortrait ? 'portrait' : 'landscape'}; margin: 0; }`;
      const theme = window.pptEditor.state.theme || 'theme-clean-light';
      const ratioClass = isPortrait ? 'ratio-a4-portrait' : 'ratio-16-9';

      const slidesHtml = (window.pptEditor.state.slides || []).map((s, idx, arr) => {
        let inner = '';
        if (s.layout === 'title') {
          inner = `<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;"><h1 style="font-size:38px;font-weight:800;margin-bottom:14px;line-height:1.2;">${s.title || ''}</h1><p style="font-size:18px;opacity:0.85;line-height:1.4;">${s.subtitle || ''}</p></div>`;
        } else if (s.layout === 'two_col') {
          inner = `<h2 style="font-size:28px;font-weight:800;margin-bottom:16px;line-height:1.25;">${s.title || ''}</h2><div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex:1;"><div style="padding:16px;border-radius:8px;border:1px solid rgba(148,163,184,0.3);overflow:hidden;">${s.leftCol || ''}</div><div style="padding:16px;border-radius:8px;border:1px solid rgba(148,163,184,0.3);overflow:hidden;">${s.rightCol || ''}</div></div>`;
        } else if (s.layout === 'quote') {
          inner = `<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;"><div style="font-size:56px;opacity:0.35;font-family:Georgia,serif;line-height:1;">“</div><div style="font-size:26px;font-style:italic;line-height:1.5;margin-bottom:14px;">${s.quote || ''}</div><div style="font-size:15px;font-weight:700;">${s.author ? '— ' + s.author : ''}</div></div>`;
        } else if (s.layout === 'blank') {
          inner = `<div style="font-size:16px;line-height:1.75;flex:1;height:100%;overflow:hidden;">${s.content || ''}</div>`;
        } else {
          inner = `<h2 style="font-size:28px;font-weight:800;margin-bottom:16px;line-height:1.25;">${s.title || ''}</h2><div style="font-size:16px;line-height:1.75;flex:1;overflow:hidden;">${s.content || ''}</div>`;
        }
        const isLast = (idx === arr.length - 1);
        const breakStyle = isLast ? 'page-break-after: auto !important; break-after: auto !important;' : 'page-break-after: always !important; break-after: page !important;';
        return `<div class="kalpten-print-slide ${theme} ${ratioClass}" style="${breakStyle}">${inner}</div>`;
      }).join('');

      printRoot.innerHTML = slidesHtml;
      return;
    }

    if (appState.currentTab === 'pdfTab') {
      pageStyle.textContent = `@page { size: auto; margin: 0; }`;
      if (window.preparePdfPrintPages) {
        const ok = await window.preparePdfPrintPages(printRoot);
        if (ok) return;
      }
      printRoot.innerHTML = '';
      const wrappers = document.querySelectorAll('#pdfPagesContainer .pdf-page-wrapper');
      wrappers.forEach((wrapper) => {
        const pageDiv = wrapper.cloneNode(true);
        pageDiv.className = 'kalpten-print-pdf-page';
        pageDiv.style.width = wrapper.style.width || (wrapper.offsetWidth ? wrapper.offsetWidth + 'px' : '100%');
        pageDiv.style.height = wrapper.style.height || (wrapper.offsetHeight ? wrapper.offsetHeight + 'px' : 'auto');

        const origCanvas = wrapper.querySelector('.pdf-page-canvas');
        const clonedCanvas = pageDiv.querySelector('.pdf-page-canvas');
        if (origCanvas && clonedCanvas) {
          clonedCanvas.width = origCanvas.width;
          clonedCanvas.height = origCanvas.height;
          const ctx = clonedCanvas.getContext('2d');
          if (ctx) ctx.drawImage(origCanvas, 0, 0);
        }
        printRoot.appendChild(pageDiv);
      });
      return;
    }

    // Default: Word Document (wordTab)
    const editor = document.getElementById('wordEditor');
    const isLandscape = editor ? editor.classList.contains('orientation-landscape') : false;
    let pageMargin = '15mm 18mm';
    if (editor) {
      if (editor.classList.contains('margin-narrow')) pageMargin = '10mm 12mm';
      else if (editor.classList.contains('margin-wide')) pageMargin = '20mm 25mm';
    }
    pageStyle.textContent = `@page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: ${pageMargin}; }`;
    const computed = editor ? window.getComputedStyle(editor) : null;
    const fontFam = (editor && editor.style.fontFamily) ? editor.style.fontFamily : (computed ? computed.fontFamily : "'Georgia', serif");
    const fontSz = (editor && editor.style.fontSize) ? editor.style.fontSize : (computed ? computed.fontSize : '16px');
    const lineHt = (editor && editor.style.lineHeight) ? editor.style.lineHeight : (computed ? computed.lineHeight : '1.7');
    printRoot.innerHTML = `<div class="kalpten-print-word-sheet" style="font-family: ${fontFam}; font-size: ${fontSz}; line-height: ${lineHt};">${editor ? editor.innerHTML : ''}</div>`;
  };

  window.executeCleanPrint = async function() {
    await window.prepareCleanPrintRoot();
    if (window.AndroidBridge && typeof window.AndroidBridge.printDocument === 'function') {
      window.AndroidBridge.printDocument();
    } else {
      window.print();
    }
  };

  window.addEventListener('beforeprint', () => {
    if (appState.currentTab === 'wordTab') {
      const { printRoot, pageStyle } = ensurePrintElements();
      const editor = document.getElementById('wordEditor');
      const isLandscape = editor ? editor.classList.contains('orientation-landscape') : false;
      let pageMargin = '15mm 18mm';
      if (editor) {
        if (editor.classList.contains('margin-narrow')) pageMargin = '10mm 12mm';
        else if (editor.classList.contains('margin-wide')) pageMargin = '20mm 25mm';
      }
      pageStyle.textContent = `@page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: ${pageMargin}; }`;
      const computed = editor ? window.getComputedStyle(editor) : null;
      const fontFam = (editor && editor.style.fontFamily) ? editor.style.fontFamily : (computed ? computed.fontFamily : "'Georgia', serif");
      const fontSz = (editor && editor.style.fontSize) ? editor.style.fontSize : (computed ? computed.fontSize : '16px');
      const lineHt = (editor && editor.style.lineHeight) ? editor.style.lineHeight : (computed ? computed.lineHeight : '1.7');
      printRoot.innerHTML = `<div class="kalpten-print-word-sheet" style="font-family: ${fontFam}; font-size: ${fontSz}; line-height: ${lineHt};">${editor ? editor.innerHTML : ''}</div>`;
    }
  });

  document.getElementById('globalPrintBtn')?.addEventListener('click', () => {
    window.executeCleanPrint();
  });

  window.addEventListener('dragover', (e) => e.preventDefault());

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    openAnySelectedFile(e.dataTransfer.files[0]);
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      document.getElementById('globalSaveBtn')?.click();
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      document.getElementById('globalOpenBtn')?.click();
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      if (appState.currentTab === 'pdfTab') {
        if (window.openPdfFindBar) window.openPdfFindBar();
      } else {
        document.getElementById('wordFindBtn')?.click();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
      e.preventDefault();
      document.getElementById('globalPrintBtn')?.click();
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      if (window.docManager) {
        if (appState.currentTab === 'pptTab') {
          window.docManager.createNewPptDoc();
        } else {
          window.docManager.createNewWordDoc();
        }
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      if (window.docManager && window.docManager.activeDocId) {
        window.docManager.closeDoc(window.docManager.activeDocId);
      }
    }
  });

  // ========================================================================
  // Recent Documents History
  // ========================================================================
  function addRecentDocument(name, type) {
    if (!name) return;
    let recents = [];
    try {
      recents = JSON.parse(localStorage.getItem('belge_recent_documents') || '[]');
    } catch (e) { recents = []; }

    // Remove existing duplicate
    recents = recents.filter(d => d.name.toLowerCase() !== name.toLowerCase());

    // Add to top
    recents.unshift({
      name: name,
      type: type, // 'word' | 'pdf'
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
    });

    if (recents.length > 15) recents.pop();
    localStorage.setItem('belge_recent_documents', JSON.stringify(recents));
  }
  window.addRecentDocument = addRecentDocument;

  function renderRecentDocs() {
    const listEl = document.getElementById('recentDocsList');
    if (!listEl) return;
    let recents = [];
    try {
      recents = JSON.parse(localStorage.getItem('belge_recent_documents') || '[]');
    } catch (e) { recents = []; }

    if (recents.length === 0) {
      listEl.innerHTML = `
        <div class="recent-doc-empty">
          Henüz açılmış bir dosya geçmişi yok.<br>
          <span style="font-size: 11.5px; opacity: 0.7;">Açtığınız Word ve PDF belgeleri burada listelenecektir.</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = recents.map(doc => {
      const lower = (doc.name || '').toLowerCase();
      const isPpt = (doc.type === 'ppt') || lower.endsWith('.pptx') || lower.endsWith('.ppt');
      const isPdf = (doc.type === 'pdf') || lower.endsWith('.pdf');
      const iconSrc = isPpt ? 'pptx_file.png' : (isPdf ? 'pdf_file.png' : 'docx_file.png');
      const typeLabel = isPpt ? 'PPTX' : (isPdf ? 'PDF' : 'DOCX');

      const safeName = escapeHtml(doc.name);
      return `
        <div class="recent-doc-item" data-name="${safeName}" data-type="${isPpt ? 'ppt' : (isPdf ? 'pdf' : 'word')}">
          <img src="${iconSrc}" class="recent-doc-luxury-icon" alt="${typeLabel}">
          <div class="recent-doc-info">
            <div class="recent-doc-name" title="${safeName}">${safeName}</div>
            <div class="recent-doc-meta">${escapeHtml(doc.time) || 'Bugün'}</div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.recent-doc-item').forEach(item => {
      item.addEventListener('click', async () => {
        const type = item.dataset.type;
        const fileName = item.dataset.name;
        closeModal('libraryModal');

        if (isOnlineServer && fileName) {
          try {
            const checkRes = await fetch('/api/open-specific-file', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
              body: fileName
            });
            const data = await checkRes.json();
            if (data && data.success) {
              await checkForOpenedFile();
              return;
            }
          } catch (_) {}
        }

        if (type === 'pdf') {
          switchTab('pdfTab');
          document.getElementById('pdfFileInput')?.click();
        } else if (type === 'ppt') {
          switchTab('pptTab');
          document.getElementById('pptFileInput')?.click();
        } else {
          switchTab('wordTab');
          document.getElementById('wordFileInput')?.click();
        }
      });
    });
  }

  document.getElementById('recentDocsBtn')?.addEventListener('click', () => {
    openLibrary('recents');
  });

  document.getElementById('clearRecentDocsBtn')?.addEventListener('click', () => {
    if (confirm('Son açılan belgeler geçmişi temizlensin mi?')) {
      localStorage.removeItem('belge_recent_documents');
      if (typeof renderRecentDocs === 'function') renderRecentDocs();
      if (typeof loadLibraryFiles === 'function') loadLibraryFiles();
      showToast('Geçmiş temizlendi.');
    }
  });

  // ========================================================================
  // Application Heartbeat & Native Lifecycle Management
  // Keeps BelgeDuzenleyici.exe alive while window is open, cleanly shuts down on exit
  // ========================================================================
  const isOnlineServer = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
                         (window.location.protocol === 'http:' || window.location.protocol === 'https:');

  function pingServer() {
    if (!isOnlineServer) return;
    fetch('/api/heartbeat').catch(() => {});
  }
  pingServer();

  if (isOnlineServer) {
    try {
      const blob = new Blob(["setInterval(function() { postMessage('p'); }, 2000);"], { type: 'application/javascript' });
      const hbWorker = new Worker(URL.createObjectURL(blob));
      hbWorker.onmessage = pingServer;
    } catch (e) {
      setInterval(pingServer, 2000);
    }

    window.addEventListener('beforeunload', () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/exit');
        } else {
          fetch('/api/exit', { method: 'POST', keepalive: true }).catch(() => {});
        }
      } catch (e) {}
    });
  }

  // Windows "Open With" / CLI file integration polling (Desktop only)
  let isCheckingFile = false;
  async function checkForOpenedFile() {
    if (!isOnlineServer || isCheckingFile) return;
    isCheckingFile = true;
    try {
      const res = await fetch('/api/opened-file-info');
      if (res.ok) {
        const info = await res.json();
        if (info.hasFile && info.filename) {
          const dataRes = await fetch('/api/opened-file-data');
          if (dataRes.ok) {
            const buffer = await dataRes.arrayBuffer();
            const ext = (info.ext || '').toLowerCase();
            if (ext === 'pdf') {
              switchTab('pdfTab');
              addRecentDocument(info.filename, 'pdf');
              let retries = 25;
              while (!window.loadPdfFromBuffer && retries-- > 0) {
                await new Promise(r => setTimeout(r, 80));
              }
              if (window.loadPdfFromBuffer) {
                window.loadPdfFromBuffer(buffer, info.filename);
              }
            } else if (ext === 'pptx' || ext === 'ppt' || ext === 'json' || ext === 'slides') {
              switchTab('pptTab');
              addRecentDocument(info.filename, 'ppt');
              let retries = 25;
              while ((!window.pptEditor || !window.pptEditor.loadFile) && retries-- > 0) {
                await new Promise(r => setTimeout(r, 80));
              }
              if (window.pptEditor && window.pptEditor.loadFile) {
                const file = new File([buffer], info.filename);
                window.pptEditor.loadFile(file);
              }
            } else if (['docx', 'doc', 'txt', 'md', 'html', 'htm'].includes(ext)) {
              switchTab('wordTab');
              addRecentDocument(info.filename, 'word');
              let retries = 25;
              while (!window.loadWordFromBuffer && retries-- > 0) {
                await new Promise(r => setTimeout(r, 80));
              }
              if (window.loadWordFromBuffer) {
                window.loadWordFromBuffer(buffer, info.filename);
              }
            }
          }
        }
      }
    } catch (err) {
      // In local file:// mode or server disconnected
    } finally {
      isCheckingFile = false;
    }
  }

  if (isOnlineServer) {
    checkForOpenedFile();
    setInterval(checkForOpenedFile, 1500);
  }

  // ========================================================================
  // Google Drive & Cloud Synchronization Controller
  // ========================================================================
  let currentSyncFolder = '';
  let isGoogleDriveActive = false;

  async function fetchDriveStatus() {
    const pill = document.getElementById('driveSyncPill');
    const dot = document.getElementById('driveStatusDot');
    const text = document.getElementById('driveStatusText');
    const modalBadge = document.getElementById('driveModalBadge');
    const modalDot = document.getElementById('driveModalDot');
    const modalBadgeText = document.getElementById('driveModalBadgeText');
    const modalPath = document.getElementById('driveModalPath');
    const openBtn = document.getElementById('openDriveFolderBtn');
    const changeBtn = document.getElementById('changeDriveFolderBtn');

    if (!isOnlineServer) {
      const isAndroid = !!window.AndroidBridge;
      const isMobile = window.innerWidth <= 768 || isAndroid;
      if (pill && dot && text) {
        dot.classList.remove('local');
        text.textContent = isAndroid ? '📱 Telefon' : (isMobile ? '📱 Cihaz' : '☁️ Bulut / Web');
        pill.title = isAndroid
          ? 'Belgeleriniz telefonun Belgeler/Kalpten Kaleme klasörüne kaydedilir.\n(Belgeleri görüntülemek için tıklayın)'
          : 'Belgeleri görüntülemek veya Drive/OneDrive üzerinden dosya açmak için tıklayın.';
      }
      if (modalPath) {
        modalPath.textContent = isAndroid
          ? 'Dahili Depolama / Belgeler / Kalpten Kaleme'
          : 'Tarayıcı & Bulut İndirme Klasörü (Google Drive / OneDrive / Cihaz)';
      }
      if (modalBadge && modalDot && modalBadgeText) {
        modalBadge.classList.remove('local');
        modalDot.classList.remove('local');
        modalBadgeText.textContent = isAndroid
          ? 'Android Belgeler & Bulut Eşitleme Aktif'
          : 'Web & Bulut Dosya Erişimi Aktif';
      }
      if (openBtn) openBtn.textContent = '📂 Buluttan / Cihazdan Aç';
      if (changeBtn) changeBtn.style.display = 'none';
      return;
    }
    if (changeBtn) changeBtn.style.display = '';
    if (openBtn) openBtn.textContent = '📁 Klasörü Aç';
    try {
      const res = await fetch('/api/drive-status');
      if (!res.ok) return;
      const data = await res.json();
      currentSyncFolder = data.syncFolder || '';
      const provider = data.cloudProvider || (data.isGoogleDrive ? 'gdrive' : 'local');
      isGoogleDriveActive = !!data.isGoogleDrive;

      // Update Header Pill
      if (pill && dot && text) {
        if (provider === 'gdrive') {
          dot.classList.remove('local');
          text.textContent = '☁️ Drive';
          pill.title = `Google Drive Senkronize: ${currentSyncFolder}\n(Yazıları görüntülemek için tıklayın)`;
        } else if (provider === 'onedrive') {
          dot.classList.remove('local');
          text.textContent = '☁️ OneDrive';
          pill.title = `OneDrive Senkronize: ${currentSyncFolder}\n(Yazıları görüntülemek için tıklayın)`;
        } else {
          dot.classList.add('local');
          text.textContent = '📁 Yerel';
          pill.title = `Kayıt Klasörü: ${currentSyncFolder}\n(Yazıları görüntülemek için tıklayın)`;
        }
      }

      if (modalPath) modalPath.textContent = currentSyncFolder;
      if (modalBadge && modalDot && modalBadgeText) {
        if (provider === 'gdrive') {
          modalBadge.classList.remove('local');
          modalDot.classList.remove('local');
          modalBadgeText.textContent = 'Google Drive Eşitleme Aktif (Mobil & Masaüstü)';
        } else if (provider === 'onedrive') {
          modalBadge.classList.remove('local');
          modalDot.classList.remove('local');
          modalBadgeText.textContent = 'OneDrive Bulut Eşitleme Aktif (Mobil & Masaüstü)';
        } else {
          modalBadge.classList.add('local');
          modalDot.classList.add('local');
          modalBadgeText.textContent = 'Yerel Klasör Kaydı (Bulut Bağlantısı Yok)';
        }
      }
    } catch (e) {
      // Offline / file mode
    }
  }

  async function loadDriveFiles() {
    const listEl = document.getElementById('driveFileList');
    const countEl = document.getElementById('driveFilesCount');
    if (!listEl) return;

    // Android Native Bridge File Listing or Standalone Web Recent Files Fallback
    if (!isOnlineServer) {
      let files = [];
      if (window.AndroidBridge && typeof window.AndroidBridge.listSavedFilesJson === 'function') {
        try {
          files = JSON.parse(window.AndroidBridge.listSavedFilesJson() || '[]');
        } catch (_) { files = []; }
      }
      if (!files || files.length === 0) {
        try {
          const recents = JSON.parse(localStorage.getItem('belge_recent_documents') || '[]');
          files = recents.map(r => ({
            name: r.name,
            path: r.name,
            size: 'Kayıtlı',
            date: r.time || 'Bugün',
            ext: (r.name.split('.').pop() || 'docx').toLowerCase(),
            isRecentOnly: true
          }));
        } catch (_) { files = []; }
      }

      if (countEl) countEl.textContent = `${files.length} belge`;
      if (!files || files.length === 0) {
        listEl.innerHTML = `
          <div class="recent-doc-empty">
            Henüz kaydedilmiş bir belge yok.<br>
            <span style="font-size: 11.5px; opacity: 0.7;">"Kaydet" tuşuna bastığınızda belgeleriniz buraya kaydedilir veya "Buluttan / Cihazdan Aç" ile Drive/OneDrive dosyalarınızı açabilirsiniz.</span>
          </div>
        `;
        return;
      }

      listEl.innerHTML = files.map(file => {
        const ext = (file.ext || '').toLowerCase();
        let iconSrc = 'docx_file.png';
        let extLabel = 'DOCX';
        if (ext === 'pdf') { iconSrc = 'pdf_file.png'; extLabel = 'PDF'; }
        else if (ext === 'pptx' || ext === 'ppt' || ext === 'json') { iconSrc = 'pptx_file.png'; extLabel = 'PPTX'; }
        const safeName = escapeHtml(file.name);
        const safeDate = escapeHtml(file.date || '');
        const safeSize = escapeHtml(file.size || '');
        return `
          <div class="recent-doc-item" data-name="${safeName}" data-ext="${ext}" data-recent="${file.isRecentOnly ? '1' : '0'}">
            <img src="${iconSrc}" class="recent-doc-luxury-icon" alt="${extLabel}">
            <div class="recent-doc-info">
              <div class="recent-doc-name" title="${safeName}">${safeName}</div>
              <div class="recent-doc-meta">${safeDate} • ${safeSize}</div>
            </div>
            <button class="pill-btn pill-btn-secondary" style="font-size: 11.5px; padding: 4px 10px; margin-left: 8px;">Aç</button>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.recent-doc-item').forEach(item => {
        item.addEventListener('click', () => {
          const fileName = item.dataset.name;
          const ext = item.dataset.ext;
          closeModal('libraryModal');
          if (window.AndroidBridge && typeof window.AndroidBridge.readBase64File === 'function' && item.dataset.recent !== '1') {
            try {
              const b64 = window.AndroidBridge.readBase64File(fileName);
              if (b64) {
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                const buffer = bytes.buffer;
                if (ext === 'pdf') {
                  switchTab('pdfTab');
                  if (window.loadPdfFromBuffer) window.loadPdfFromBuffer(buffer, fileName);
                } else if (ext === 'pptx' || ext === 'ppt' || ext === 'json') {
                  switchTab('pptTab');
                  if (window.pptEditor) window.pptEditor.loadFile(new File([buffer], fileName));
                } else {
                  switchTab('wordTab');
                  if (window.loadWordFromBuffer) window.loadWordFromBuffer(buffer, fileName);
                }
                showToast(`"${fileName}" açıldı.`);
                return;
              }
            } catch (_) {}
          }
          document.getElementById('wordFileInput')?.click();
        });
      });
      return;
    }

    try {
      listEl.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-tertiary); font-size: 12px;">⏳ Belgeler yükleniyor...</div>';
      const res = await fetch('/api/drive-files');
      if (!res.ok) throw new Error('Sunucu yanıt vermedi');
      const files = await res.json();

      if (countEl) countEl.textContent = `${files.length} belge`;

      if (!files || files.length === 0) {
        listEl.innerHTML = `
          <div class="recent-doc-empty">
            Bu klasörde henüz kaydedilmiş bir yazı yok.<br>
            <span style="font-size: 11.5px; opacity: 0.7;">"Kaydet" tuşuna bastığınızda yazılarınız otomatik olarak buraya ve telefonunuza eşitlenir.</span>
          </div>
        `;
        return;
      }

      listEl.innerHTML = files.map(file => {
        const ext = (file.ext || '').toLowerCase();
        let iconSrc = 'docx_file.png';
        let extLabel = 'DOCX';
        if (ext === 'pdf') {
          iconSrc = 'pdf_file.png';
          extLabel = 'PDF';
        } else if (ext === 'pptx' || ext === 'ppt' || ext === 'json') {
          iconSrc = 'pptx_file.png';
          extLabel = 'PPTX';
        }

        const safeName = escapeHtml(file.name);
        const safePath = escapeHtml(file.path);
        const safeSize = escapeHtml(file.size);
        const safeDate = escapeHtml(file.date);

        return `
          <div class="recent-doc-item" data-path="${safePath}" data-name="${safeName}" data-ext="${ext}">
            <img src="${iconSrc}" class="recent-doc-luxury-icon" alt="${extLabel}">
            <div class="recent-doc-info">
              <div class="recent-doc-name" title="${safeName}">${safeName}</div>
              <div class="recent-doc-meta">${safeDate} • ${safeSize}</div>
            </div>
            <button class="pill-btn pill-btn-secondary" style="font-size: 11.5px; padding: 4px 10px; margin-left: 8px;">Aç</button>
          </div>
        `;
      }).join('');

      listEl.querySelectorAll('.recent-doc-item').forEach(item => {
        item.addEventListener('click', async () => {
          const filePath = item.dataset.path;
          const fileName = item.dataset.name;
          const ext = item.dataset.ext;
          await openDriveFile(filePath, fileName, ext);
        });
      });
    } catch (err) {
      listEl.innerHTML = `
        <div class="recent-doc-empty" style="color: var(--accent-coral);">
          Klasör taranırken bir sorun oluştu: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
  window.loadDriveFiles = function() {
    loadDriveFiles();
    if (typeof loadLibraryFiles === 'function') {
      loadLibraryFiles();
    }
  };
  window.loadLibraryFiles = loadLibraryFiles;

  async function openDriveFile(filePath, fileName, ext) {
    try {
      const res = await fetch('/api/open-specific-file', {
        method: 'POST',
        body: filePath
      });
      if (res.ok) {
        lastLoadedFile = ''; // Reset cache check so it reloads immediately
        closeModal('libraryModal');
        await checkForOpenedFile();
        showToast(`"${fileName}" açıldı.`);
      }
    } catch (err) {
      showToast('Belge açılamadı: ' + err.message, 'error');
    }
  }

  // Drive Buttons & Modal Events
  document.getElementById('driveSyncPill')?.addEventListener('click', () => {
    openLibrary();
  });

  document.getElementById('refreshDriveFilesBtn')?.addEventListener('click', () => {
    fetchDriveStatus();
    loadDriveFiles();
    showToast('Belge listesi güncellendi.');
  });

  document.getElementById('openDriveFolderBtn')?.addEventListener('click', () => {
    if (!isOnlineServer) {
      closeModal('libraryModal');
      document.getElementById('wordFileInput')?.click();
      return;
    }
    fetch('/api/open-sync-folder').catch(() => {});
    showToast('Klasör Dosya Gezgini\'nde açılıyor...');
  });

  document.getElementById('changeDriveFolderBtn')?.addEventListener('click', async () => {
    try {
      showToast('Lütfen açılan pencereden yeni klasörü seçin...');
      const res = await fetch('/api/select-sync-folder', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        fetchDriveStatus();
        loadDriveFiles();
        showToast('Kayıt klasörü güncellendi: ' + (data.syncFolder || ''));
      }
    } catch (err) {
      showToast('Klasör seçimi iptal edildi veya başarısız oldu.', 'error');
    }
  });

  // ========================================================================
  // Mobile Word Studio Drawer (100% Word-Focused Mobile Experience)
  // ========================================================================
  if (wordFileInput) {
    wordFileInput.setAttribute('accept', '.docx,.doc,.txt,.html,.md,.pdf,.pptx,.ppt,.json');
  }

  function syncMobileAtmosphereUI() {
    const isDark = appState.theme === 'dark';
    const isBook = document.documentElement.getAttribute('data-paper') === 'book';
    const activeAtmo = isDark ? 'dark' : (isBook ? 'cream' : 'white');

    document.querySelectorAll('#mobileAtmosphereGroup .mobile-atmo-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.atmo === activeAtmo);
    });
  }

  document.getElementById('mobileMoreBtn')?.addEventListener('click', () => {
    syncMobileAtmosphereUI();
    if (window.updateWordStats) window.updateWordStats();
    openModal('mobileActionSheetModal');
  });

  // Tapping brand icon on mobile also opens the studio drawer
  document.getElementById('mobileBrandMark')?.addEventListener('click', () => {
    document.getElementById('mobileMoreBtn')?.click();
  });

  // 3-Way Atmosphere Switcher (Beyaz Kağıt / Kitap Kağıdı / Gece Modu)
  document.querySelectorAll('#mobileAtmosphereGroup .mobile-atmo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.atmo;
      if (mode === 'dark') {
        setTheme('dark');
        showToast('Gece Yazma Modu Etkin');
      } else if (mode === 'cream') {
        setTheme('light');
        setPaperTone('book');
        showToast('Sıcak Kitap Kağıdı Etkin');
      } else {
        setTheme('light');
        setPaperTone('white');
        showToast('Klasik Beyaz Kağıt Etkin');
      }
      syncMobileAtmosphereUI();
    });
  });

  // Mobile Typography Controls (Font Family, Size, Line Spacing)
  const mobileFontFamilySelect = document.getElementById('mobileFontFamilySelect');
  const mobileFontSizeSelect = document.getElementById('mobileFontSizeSelect');

  mobileFontFamilySelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    const editor = document.getElementById('wordEditor');
    if (editor) editor.style.fontFamily = val;
    const desktopFont = document.getElementById('wordFontFamily');
    if (desktopFont) {
      desktopFont.value = val;
      desktopFont.dispatchEvent(new Event('change'));
    }
    showToast('Yazı tipi güncellendi');
  });

  mobileFontSizeSelect?.addEventListener('change', (e) => {
    const val = e.target.value;
    const editor = document.getElementById('wordEditor');
    if (editor) editor.style.fontSize = val;
    showToast('Yazı boyutu: ' + val);
  });

  document.querySelectorAll('#mobileSpacingPills .mobile-spacing-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const lh = pill.dataset.lh;
      document.querySelectorAll('#mobileSpacingPills .mobile-spacing-pill').forEach(p => {
        p.classList.toggle('active', p === pill);
      });
      const editor = document.getElementById('wordEditor');
      if (editor && lh) editor.style.lineHeight = lh;
      const desktopLh = document.getElementById('wordLineHeight');
      if (desktopLh && lh) {
        desktopLh.value = lh;
        desktopLh.dispatchEvent(new Event('change'));
      }
      showToast('Satır aralığı: ' + lh);
    });
  });

  // Mobile Suite Module Switcher Buttons
  document.querySelectorAll('.mobile-suite-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      closeModal('mobileActionSheetModal');
      if (window.docManager && tabId !== 'toolsTab') {
        const activeDoc = window.docManager.getActiveDoc();
        const expectedType = tabId === 'pptTab' ? 'ppt' : tabId === 'pdfTab' ? 'pdf' : 'word';
        if (activeDoc?.type !== expectedType) {
          const matchingDoc = window.docManager.docs.find(d => d.type === expectedType);
          if (matchingDoc) {
            window.docManager.switchTo(matchingDoc.id);
            return;
          } else if (tabId === 'pptTab') {
            window.docManager.registerCurrentPptDoc();
            return;
          }
        }
      }
      switchTab(tabId);
    });
  });

  // 8 Crisp Vector SVG Action Tiles
  document.getElementById('mobileNewDocBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    document.getElementById('wordNewBtn')?.click();
  });

  document.getElementById('mobileOpenDocBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    document.getElementById('wordFileInput')?.click();
  });

  document.getElementById('mobileSaveDocBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    document.getElementById('globalSaveBtn')?.click();
  });

  document.getElementById('mobileDriveBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    openLibrary();
  });

  document.getElementById('mobileLibraryBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    openLibrary('all');
  });

  document.getElementById('mobileRecentDocsBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    openLibrary('recents');
  });

  document.getElementById('recentDocsBtn')?.addEventListener('click', () => {
    openLibrary('recents');
  });

  document.getElementById('mobileRenameDocBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    const currentTitle = (document.getElementById('wordDocTitle')?.value || 'Yeni Yazı.docx').replace(/\.docx$/i, '');
    const newName = prompt('Yazınız için yeni bir başlık girin:', currentTitle);
    if (newName && newName.trim().length > 0) {
      let finalName = newName.trim();
      if (!finalName.toLowerCase().endsWith('.docx')) finalName += '.docx';
      const titleInput = document.getElementById('wordDocTitle');
      if (titleInput) titleInput.value = finalName;
      if (window.docManager) window.docManager.updateActiveDocTitle(finalName);
      showToast(`Başlık "${finalName}" olarak güncellendi.`);
    }
  });

  document.getElementById('openLibraryBtn')?.addEventListener('click', () => openLibrary('all'));

  // ========================================================================
  // 📚 KÜTÜPHANEM (Library & Writing Archive) Controller
  // ========================================================================
  let currentLibraryFilter = 'all';
  let libraryFilesCache = [];

  async function openLibrary(filter) {
    if (typeof filter !== 'string') filter = 'all';
    currentLibraryFilter = filter;
    document.querySelectorAll('.library-filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });

    const folderBtn = document.getElementById('openLibraryFolderBtn');
    if (folderBtn) {
      if (window.AndroidBridge && typeof window.AndroidBridge.openDocumentsFolder === 'function') {
        folderBtn.innerHTML = '📁 Klasörü Aç';
        folderBtn.title = 'Telefondaki Belgeler/Kalpten Kaleme klasörünü aç';
      } else if (isOnlineServer) {
        folderBtn.innerHTML = '📁 Klasörü Aç';
        folderBtn.title = 'Bilgisayardaki Belgelerim klasörünü Dosya Gezgini\'nde aç';
      } else {
        folderBtn.innerHTML = '📂 Cihazdan Belge Aç';
        folderBtn.title = 'Telefonunuzdaki bir Word, PDF ya da Sunum belgesini seçip açın';
      }
    }

    openModal('libraryModal');
    await loadLibraryFiles();
  }
  window.openLibrary = openLibrary;

  async function loadLibraryFiles() {
    const container = document.getElementById('libraryItemsContainer');
    const emptyState = document.getElementById('libraryEmptyState');
    const countBadge = document.getElementById('libraryItemsCount');
    const storageLocation = document.getElementById('libraryStorageLocation');
    const storageSubtitle = document.getElementById('libraryStorageSubtitle');
    const syncDot = document.getElementById('librarySyncDot');
    const gDriveWebBtn = document.getElementById('libraryGDriveWebBtn');

    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding: 30px; color: var(--text-tertiary); font-size: 13px;">⏳ Kütüphane taranıyor...</div>';
    if (emptyState) emptyState.style.display = 'none';

    let files = [];

    // 1. Android Native Storage Scan
    if (window.AndroidBridge && typeof window.AndroidBridge.listSavedFilesJson === 'function') {
      try {
        files = JSON.parse(window.AndroidBridge.listSavedFilesJson() || '[]');
        if (storageLocation) storageLocation.textContent = 'Dahili Hafıza & Belgeler/Kalpten Kaleme';
        if (storageSubtitle) storageSubtitle.textContent = 'Cihazınızdaki tüm kayıtlı yazılar ve belgeler';
        if (syncDot) syncDot.className = 'drive-status-dot active';
      } catch (e) {
        files = [];
      }
    } 
    // 2. Desktop Server Storage Scan
    else if (isOnlineServer) {
      try {
        const res = await fetch('/api/drive-files');
        if (res.ok) {
          files = await res.json();
        }
        const stRes = await fetch('/api/drive-status');
        if (stRes.ok) {
          const st = await stRes.json();
          if (storageLocation) storageLocation.textContent = st.syncFolder || 'Belgelerim';
          if (storageSubtitle) storageSubtitle.textContent = st.isGoogleDrive ? 'Google Drive ile anında eşitlenir' : 'Yerel bilgisayar arşiviniz';
          if (syncDot) syncDot.className = 'drive-status-dot' + (st.isCloudSync ? ' active' : ' local');
          if (gDriveWebBtn) gDriveWebBtn.style.display = st.isGoogleDrive ? 'inline-flex' : 'none';
        }
      } catch (e) {}
    }

    // 3. Web / Fallback Recent Cache
    if (!files || files.length === 0) {
      try {
        const recents = JSON.parse(localStorage.getItem('belge_recent_documents') || '[]');
        files = recents.map(r => ({
          name: r.name,
          path: r.name,
          size: 'Kayıtlı',
          date: r.time || 'Bugün',
          ext: (r.name.split('.').pop() || 'docx').toLowerCase(),
          isRecentOnly: true
        }));
        if (storageLocation && !isOnlineServer) {
          storageLocation.textContent = 'Tarayıcı Yerel Hafızası';
        }
      } catch (_) { files = []; }
    }

    libraryFilesCache = files;
    renderLibraryGrid();
  }

  function renderLibraryGrid() {
    const container = document.getElementById('libraryItemsContainer');
    const emptyState = document.getElementById('libraryEmptyState');
    const countBadge = document.getElementById('libraryItemsCount');
    const clearRecentsBtn = document.getElementById('libraryClearRecentsBtn');
    const searchVal = (document.getElementById('librarySearchInput')?.value || '').toLowerCase().trim();

    // Read stored recents
    let recentsList = [];
    try {
      recentsList = JSON.parse(localStorage.getItem('belge_recent_documents') || '[]');
    } catch (_) {}

    // Update filter counts
    const countAll = libraryFilesCache.length;
    const countRecents = recentsList.length;
    const countDocx = libraryFilesCache.filter(f => (f.ext || '').match(/^(docx|doc|txt|md|html)$/i)).length;
    const countPdf = libraryFilesCache.filter(f => (f.ext || '').match(/^pdf$/i)).length;
    const countOther = countAll - countDocx - countPdf;

    if (document.getElementById('countFilterAll')) document.getElementById('countFilterAll').textContent = countAll;
    if (document.getElementById('countFilterRecents')) document.getElementById('countFilterRecents').textContent = countRecents;
    if (document.getElementById('countFilterDocx')) document.getElementById('countFilterDocx').textContent = countDocx;
    if (document.getElementById('countFilterPdf')) document.getElementById('countFilterPdf').textContent = countPdf;
    if (document.getElementById('countFilterOther')) document.getElementById('countFilterOther').textContent = countOther;
    if (countBadge) countBadge.textContent = `${countAll} Yazı`;

    // Toggle clear recents button
    if (clearRecentsBtn) {
      clearRecentsBtn.style.display = (currentLibraryFilter === 'recents' && countRecents > 0) ? 'inline-block' : 'none';
    }

    let filtered = libraryFilesCache.filter(f => {
      const ext = (f.ext || '').toLowerCase();
      if (currentLibraryFilter === 'recents') {
        return recentsList.some(r => r.name.toLowerCase() === (f.name || '').toLowerCase());
      } else if (currentLibraryFilter === 'docx') {
        if (!ext.match(/^(docx|doc|txt|md|html)$/i)) return false;
      } else if (currentLibraryFilter === 'pdf') {
        if (ext !== 'pdf') return false;
      } else if (currentLibraryFilter === 'other') {
        if (ext.match(/^(docx|doc|txt|md|html|pdf)$/i)) return false;
      }

      if (searchVal) {
        return (f.name || '').toLowerCase().includes(searchVal);
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '';
      if (emptyState) {
        emptyState.style.display = 'block';
        const emptyMsg = emptyState.querySelector('h4');
        if (emptyMsg) {
          emptyMsg.textContent = currentLibraryFilter === 'recents' ? 'Henüz Son Açılan Belge Yok' : 'Henüz Kayıtlı Yazı Bulunmuyor';
        }
      }
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = filtered.map(file => {
      const ext = (file.ext || '').toLowerCase();
      let iconSrc = 'docx_file.png';
      let chipClass = 'chip-docx';
      let chipLabel = 'WORD';

      if (ext === 'pdf') {
        iconSrc = 'pdf_file.png';
        chipClass = 'chip-pdf';
        chipLabel = 'PDF';
      } else if (ext === 'pptx' || ext === 'ppt') {
        iconSrc = 'pptx_file.png';
        chipClass = 'chip-pptx';
        chipLabel = 'SUNUM';
      } else if (ext === 'txt' || ext === 'md') {
        chipLabel = 'METİN';
      }

      const safeName = escapeHtml(file.name);
      const safeDate = escapeHtml(file.date || '');
      const safeSize = escapeHtml(file.size || '');

      return `
        <div class="library-card" data-name="${safeName}" data-path="${escapeHtml(file.path || file.name)}" data-ext="${ext}">
          <div class="library-card-left" title="Açmak için tıklayın">
            <img src="${iconSrc}" class="library-card-icon-img" alt="${chipLabel}">
            <div class="library-card-details">
              <div class="library-card-title">${safeName}</div>
              <div class="library-card-meta">
                <span class="library-ext-chip ${chipClass}">${chipLabel}</span>
                <span>${safeDate}</span>
                <span>•</span>
                <span>${safeSize}</span>
              </div>
            </div>
          </div>
          <div class="library-card-actions">
            <button class="library-btn-open" title="Belgeyi Aç ve Düzenle">Aç</button>
            <button class="library-btn-del" title="Kütüphaneden Sil">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach card action listeners
    container.querySelectorAll('.library-card').forEach(card => {
      const fileName = card.dataset.name;
      const filePath = card.dataset.path;
      const ext = card.dataset.ext;

      // Click card or Aç button to open
      const openFile = async () => {
        closeModal('libraryModal');
        // Android Bridge load
        if (window.AndroidBridge && typeof window.AndroidBridge.readBase64File === 'function') {
          try {
            const b64 = window.AndroidBridge.readBase64File(fileName);
            if (b64) {
              window.__openAndroidDocument(fileName, b64);
              return;
            }
          } catch (e) {}
        }
        // Online Server load
        if (isOnlineServer) {
          try {
            const res = await fetch('/api/open-specific-file', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
              body: filePath
            });
            if (res.ok) {
              await checkForOpenedFile();
              showToast(`"${fileName}" açıldı.`);
              return;
            }
          } catch (e) {}
        }
        // Standalone file picker fallback
        showToast(`"${fileName}" açılıyor...`);
        document.getElementById('wordFileInput')?.click();
      };

      card.querySelector('.library-card-left')?.addEventListener('click', openFile);
      card.querySelector('.library-btn-open')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openFile();
      });

      // Delete file action
      card.querySelector('.library-btn-del')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm(`"${fileName}" adlı yazıyı silmek istediğinize emin misiniz?`)) return;

        let deleted = false;
        if (window.AndroidBridge && typeof window.AndroidBridge.deleteSavedFile === 'function') {
          try {
            deleted = window.AndroidBridge.deleteSavedFile(fileName);
          } catch (_) {}
        } else if (isOnlineServer) {
          try {
            const res = await fetch('/api/delete-file', {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
              body: filePath
            });
            if (res.ok) {
              const r = await res.json();
              deleted = r.success;
            }
          } catch (_) {}
        } else {
          // Remove from local storage
          try {
            const recents = JSON.parse(localStorage.getItem('belge_recent_documents') || '[]');
            const filtered = recents.filter(r => r.name !== fileName);
            localStorage.setItem('belge_recent_documents', JSON.stringify(filtered));
            deleted = true;
          } catch (_) {}
        }

        if (deleted) {
          try {
            const recents = JSON.parse(localStorage.getItem('belge_recent_documents') || '[]');
            const filtered = recents.filter(r => (r.name || '').toLowerCase() !== fileName.toLowerCase());
            localStorage.setItem('belge_recent_documents', JSON.stringify(filtered));
          } catch (_) {}
          showToast(`"${fileName}" silindi.`);
          await loadLibraryFiles();
        } else {
          showToast('Dosya silinemedi veya zaten mevcut değil.', 'error');
        }
      });
    });
  }

  document.getElementById('refreshLibraryBtn')?.addEventListener('click', loadLibraryFiles);
  document.getElementById('openLibraryFolderBtn')?.addEventListener('click', () => {
    if (window.AndroidBridge && typeof window.AndroidBridge.openDocumentsFolder === 'function') {
      window.AndroidBridge.openDocumentsFolder();
      return;
    }
    if (isOnlineServer) {
      fetch('/api/open-sync-folder').catch(() => {});
      showToast('Kayıt klasörü Dosya Gezgini\'nde açılıyor...');
      return;
    }
    // Mobile Web / Standalone Browser:
    triggerUnifiedFilePicker();
  });

  document.getElementById('libraryChangeFolderBtn')?.addEventListener('click', async () => {
    if (isOnlineServer) {
      try {
        const res = await fetch('/api/select-sync-folder');
        if (res.ok) {
          await loadLibraryFiles();
          showToast('Kayıt klasörü güncellendi.');
        }
      } catch (_) {}
    } else if (window.AndroidBridge) {
      showToast('Kayıt klasörü telefonunuzdaki "Belgeler/Kalpten Kaleme" klasörüdür.');
    } else {
      showToast('Web sürümünde yazılar tarayıcı hafızasına ve telefonunuza otomatik kaydedilir.');
    }
  });

  // Filter chips
  document.querySelectorAll('.library-filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.library-filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLibraryFilter = btn.dataset.filter || 'all';
      renderLibraryGrid();
    });
  });

  // Search input live filtering
  document.getElementById('librarySearchInput')?.addEventListener('input', () => {
    renderLibraryGrid();
  });

  // Clear recents history button
  document.getElementById('libraryClearRecentsBtn')?.addEventListener('click', () => {
    if (confirm('Açılan belgeler geçmişi temizlensin mi? (Orijinal dosyalarınız silinmez)')) {
      localStorage.removeItem('belge_recent_documents');
      showToast('Geçmiş temizlendi.');
      loadLibraryFiles();
    }
  });

  document.getElementById('mobileFindBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    document.getElementById('wordFindBtn')?.click();
  });

  document.getElementById('mobileZenModeBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    toggleZenMode();
  });

  document.getElementById('mobilePrintBtn')?.addEventListener('click', () => {
    closeModal('mobileActionSheetModal');
    document.getElementById('globalPrintBtn')?.click();
  });

  // Download Modal local vs remote links
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    const winDl = document.getElementById('winDownloadLink');
    const apkDl = document.getElementById('androidDownloadLink');
    if (winDl) winDl.href = 'KalptenKaleme-Windows.zip';
    if (apkDl) apkDl.href = 'KalptenKaleme.apk';
  }

  // Initial Drive status fetch
  fetchDriveStatus();

  // Check if opened via Android "Birlikte Aç" (Open With)
  if (window.AndroidBridge && typeof window.AndroidBridge.getPendingDocumentJson === 'function') {
    try {
      const docJson = window.AndroidBridge.getPendingDocumentJson();
      if (docJson) {
        const doc = JSON.parse(docJson);
        if (doc && doc.fileName && doc.base64) {
          setTimeout(() => {
            if (typeof window.__openAndroidDocument === 'function') {
              window.__openAndroidDocument(doc.fileName, doc.base64);
            }
          }, 350);
        }
      }
    } catch (e) {
      console.error('Error checking pending Android document:', e);
    }
  }

  if (location.hash === '#open-library') {
    setTimeout(() => openLibrary('all'), 250);
  }
});

// Android Native "Birlikte Aç" (Open With) Handler
window.__openAndroidDocumentDirect = function(jsonPayload) {
  try {
    const data = typeof jsonPayload === 'string' ? JSON.parse(jsonPayload) : jsonPayload;
    if (data && data.fileName && data.base64) {
      window.__openAndroidDocument(data.fileName, data.base64);
    }
  } catch (err) {
    console.error('Error in __openAndroidDocumentDirect:', err);
  }
};

window.__openAndroidDocument = function(fileName, base64Data) {
  try {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const bin = atob(base64Data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const buffer = bytes.buffer;

    if (ext === 'pdf') {
      switchTab('pdfTab');
      if (window.loadPdfFromBuffer) window.loadPdfFromBuffer(buffer, fileName);
    } else if (ext === 'pptx' || ext === 'ppt') {
      switchTab('pptTab');
      if (window.pptEditor) window.pptEditor.loadFile(new File([buffer], fileName));
    } else {
      switchTab('wordTab');
      if (window.loadWordFromBuffer) window.loadWordFromBuffer(buffer, fileName);
    }
    showToast(`"${fileName}" açıldı.`);
  } catch (err) {
    console.error('Error opening Android document:', err);
  }
};

// Android Native Back Button & Mobile Lifecycle Hook
window.__handleAndroidBack = function() {
  const openModalEl = document.querySelector('.modal-backdrop.active');
  if (openModalEl) {
    openModalEl.classList.remove('active');
    return true; // Modal closed
  }
  if (document.body.classList.contains('zen-mode')) {
    document.body.classList.remove('zen-mode');
    return true; // Zen mode exited
  }
  return false; // Handled by Android system (exit)
};

