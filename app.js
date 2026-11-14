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

// ========================================================================
// Native-Look Custom Confirm & Prompt Dialogs (Avoids ugly localhost alerts)
// ========================================================================
window.__origConfirm = window.__origConfirm || window.confirm;
window.__origPrompt = window.__origPrompt || window.prompt;

function ensureCustomDialogModal() {
  let backdrop = document.getElementById('kkCustomDialogModal');
  if (backdrop) return backdrop;
  backdrop = document.createElement('div');
  backdrop.id = 'kkCustomDialogModal';
  backdrop.className = 'modal-backdrop';
  backdrop.style.zIndex = '9999999';
  backdrop.innerHTML = `
    <div class="modal-card" style="max-width: 400px; width: 92%; padding: 22px; border-radius: 16px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
        <h3 id="kkDialogTitle" style="font-size: 16px; font-weight: 800; margin: 0; color: var(--text-primary);">Kalpten Kaleme</h3>
        <button type="button" class="icon-btn" id="kkDialogCloseX" style="width: 28px; height: 28px;">✕</button>
      </div>
      <p id="kkDialogMessage" style="font-size: 13.5px; line-height: 1.55; color: var(--text-secondary); margin: 0 0 16px 0;"></p>
      <input type="text" id="kkDialogInput" class="find-input" style="width: 100%; height: 38px; font-size: 14px; margin-bottom: 16px; display: none; padding: 0 12px; border-radius: 10px;" spellcheck="false">
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <button type="button" class="pill-btn pill-btn-secondary" id="kkDialogCancelBtn" style="padding: 7px 16px; font-size: 13px;">Vazgeç</button>
        <button type="button" class="pill-btn pill-btn-primary" id="kkDialogOkBtn" style="padding: 7px 18px; font-size: 13px; font-weight: 700;">Tamam</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);
  return backdrop;
}

window.showConfirmDialog = function(message, onConfirm, title = 'Onay') {
  // If running under E2E test suite where window.confirm is mocked, execute synchronously
  if (window.__origConfirm && window.confirm !== window.__origConfirm) {
    if (window.confirm(message)) onConfirm();
    return;
  }
  const backdrop = ensureCustomDialogModal();
  const titleEl = document.getElementById('kkDialogTitle');
  const msgEl = document.getElementById('kkDialogMessage');
  const inputEl = document.getElementById('kkDialogInput');
  const okBtn = document.getElementById('kkDialogOkBtn');
  const cancelBtn = document.getElementById('kkDialogCancelBtn');
  const closeX = document.getElementById('kkDialogCloseX');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (inputEl) inputEl.style.display = 'none';
  if (okBtn) okBtn.textContent = 'Evet, Devam Et';

  const cleanup = () => {
    backdrop.classList.remove('active');
    window.removeEventListener('keydown', keyHandler);
  };
  const keyHandler = (e) => {
    if (!backdrop.classList.contains('active')) return;
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    else if (e.key === 'Enter') { e.preventDefault(); cleanup(); onConfirm(); }
  };

  okBtn.onclick = () => { cleanup(); onConfirm(); };
  cancelBtn.onclick = cleanup;
  closeX.onclick = cleanup;
  window.addEventListener('keydown', keyHandler);
  backdrop.classList.add('active');
};

window.showPromptDialog = function(message, defaultValue, onConfirm, title = 'Bilgi Girişi') {
  if (window.__origPrompt && window.prompt !== window.__origPrompt) {
    const val = window.prompt(message, defaultValue);
    if (val !== null) onConfirm(val);
    return;
  }
  const backdrop = ensureCustomDialogModal();
  const titleEl = document.getElementById('kkDialogTitle');
  const msgEl = document.getElementById('kkDialogMessage');
  const inputEl = document.getElementById('kkDialogInput');
  const okBtn = document.getElementById('kkDialogOkBtn');
  const cancelBtn = document.getElementById('kkDialogCancelBtn');
  const closeX = document.getElementById('kkDialogCloseX');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (inputEl) {
    inputEl.style.display = 'block';
    inputEl.value = defaultValue || '';
  }
  if (okBtn) okBtn.textContent = 'Tamam';

  const cleanup = () => {
    backdrop.classList.remove('active');
    window.removeEventListener('keydown', keyHandler);
  };
  const submit = () => {
    const val = inputEl ? inputEl.value : '';
    cleanup();
    onConfirm(val);
  };
  const keyHandler = (e) => {
    if (!backdrop.classList.contains('active')) return;
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    else if (e.key === 'Enter') { e.preventDefault(); submit(); }
  };

  okBtn.onclick = submit;
  cancelBtn.onclick = cleanup;
  closeX.onclick = cleanup;
  window.addEventListener('keydown', keyHandler);
  backdrop.classList.add('active');
  setTimeout(() => {
    if (inputEl) {
      inputEl.focus();
      inputEl.select();
    }
  }, 40);
};

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

// ========================================================================
// 🌟 AppPlatform Engine — Unified Platform Architecture
// Seamlessly distinguishes Web (GitHub Pages), Windows Desktop, and Android APK
// ========================================================================
const AppPlatform = {
  // 1. Android APK Native Wrapper
  isAndroid: Boolean(window.AndroidBridge),

  // 2. Windows Desktop Mode (Local Server, Self-Contained Kalpten Kaleme.html on file://, or Installed Desktop PWA)
  get isDesktop() {
    if (Boolean(window.AndroidBridge)) return false;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || Boolean(window.__KALPTEN_DESKTOP_STANDALONE)) return true;
    if (window.innerWidth > 768 && (window.location.search.includes('mode=desktop') || (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches)))) return true;
    return false;
  },
  isLocalServer: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && !Boolean(window.AndroidBridge),

  // 3. Web Mode (GitHub Pages: https://meihper.github.io/Kalpten-Kaleme/ or external web server)
  get isWeb() {
    return !this.isAndroid && !this.isDesktop;
  },

  // 4. Form Factor (Small Mobile Screen <= 768px vs Desktop / Wide Screen)
  isMobileScreen() {
    if (window.__KALPTEN_DESKTOP_STANDALONE) return false;
    return window.innerWidth <= 768;
  },

  // 5. Installed Standalone App Check
  isInstalled() {
    if (this.isAndroid || this.isDesktop) return true;
    if (window.location.protocol === 'file:') return true;
    if (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: window-controls-overlay)').matches)) return true;
    if (window.navigator && window.navigator.standalone === true) return true;
    return false;
  },

  // 6. Platform Key
  getType() {
    if (this.isAndroid) return 'android';
    if (this.isDesktop) return 'desktop';
    return 'web';
  }
};
window.AppPlatform = AppPlatform;

// Backwards-compatible globals
const isOnlineServer = AppPlatform.isLocalServer;

// ========================================================================
// 🗄️ KalptenKalemeVault — Offline IndexedDB + In-Memory Document Vault
// Powers full Kütüphanem & Auto-Save in standalone Kalpten Kaleme.html mode
// ========================================================================
const kalptenVault = {
  dbName: 'KalptenKalemeVaultDB',
  storeName: 'documents',
  memCache: new Map(),
  dbPromise: null,

  openDB() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      if (!window.indexedDB) return resolve(null);
      try {
        const req = window.indexedDB.open(this.dbName, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'key' });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
    return this.dbPromise;
  },

  async toUint8Array(data) {
    if (!data) return new Uint8Array(0);
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      const buf = await data.arrayBuffer();
      return new Uint8Array(buf);
    }
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    return new Uint8Array(0);
  },

  formatSize(byteLen) {
    if (byteLen > 1024 * 1024) return (byteLen / (1024 * 1024)).toFixed(1) + ' MB';
    return Math.max(1, Math.round(byteLen / 1024)) + ' KB';
  },

  formatDate(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  async saveFile(name, data, explicitExt) {
    if (!name) return false;
    const cleanName = String(name).trim();
    const key = cleanName.toLowerCase();
    const ext = (explicitExt || cleanName.split('.').pop() || 'docx').toLowerCase().replace(/^\./, '');
    const bytes = await this.toUint8Array(data);
    const record = {
      key,
      name: cleanName,
      path: cleanName,
      ext,
      size: this.formatSize(bytes.byteLength),
      date: this.formatDate(new Date()),
      timestamp: Date.now(),
      bytes
    };
    this.memCache.set(key, record);
    const db = await this.openDB();
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readwrite');
          tx.objectStore(this.storeName).put(record);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    }
    return true;
  },

  async listFiles() {
    const db = await this.openDB();
    const merged = new Map();
    for (const [k, v] of this.memCache.entries()) {
      merged.set(k, v);
    }
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readonly');
          const req = tx.objectStore(this.storeName).getAll();
          req.onsuccess = () => {
            const rows = req.result || [];
            rows.forEach(r => {
              if (r && r.key) {
                merged.set(r.key, r);
                this.memCache.set(r.key, r);
              }
            });
            resolve();
          };
          req.onerror = () => resolve();
        } catch (_) {
          resolve();
        }
      });
    }
    return Array.from(merged.values())
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .map(r => ({
        name: r.name,
        path: r.name,
        size: r.size || '1 KB',
        date: r.date || 'Bugün',
        ext: r.ext || 'docx'
      }));
  },

  async getFileBytes(name) {
    if (!name) return null;
    const key = String(name).trim().toLowerCase();
    if (this.memCache.has(key)) {
      const rec = this.memCache.get(key);
      if (rec && rec.bytes) return rec.bytes.buffer.slice(rec.bytes.byteOffset, rec.bytes.byteOffset + rec.bytes.byteLength);
    }
    const db = await this.openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, 'readonly');
        const req = tx.objectStore(this.storeName).get(key);
        req.onsuccess = () => {
          const rec = req.result;
          if (rec && rec.bytes) {
            this.memCache.set(key, rec);
            const u8 = rec.bytes instanceof Uint8Array ? rec.bytes : new Uint8Array(rec.bytes);
            resolve(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch (_) {
        resolve(null);
      }
    });
  },

  async deleteFile(name) {
    if (!name) return false;
    const key = String(name).trim().toLowerCase();
    this.memCache.delete(key);
    const db = await this.openDB();
    if (db) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(this.storeName, 'readwrite');
          tx.objectStore(this.storeName).delete(key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (_) {
          resolve(false);
        }
      });
    }
    return true;
  }
};
window.kalptenVault = kalptenVault;

function isMobileWordStudio() {
  return AppPlatform.isMobileScreen() && AppPlatform.isAndroid;
}

function isWindowsSuiteMode() {
  return AppPlatform.isDesktop && !AppPlatform.isMobileScreen();
}

function isInstalledApp() {
  return AppPlatform.isInstalled();
}

function syncMobileAppMode() {
  const isMobile = AppPlatform.isMobileScreen();
  const isLandscape = isMobile && window.innerWidth > window.innerHeight;
  const isSuite = isWindowsSuiteMode();
  const isInstalled = AppPlatform.isInstalled();
  const isWeb = AppPlatform.isWeb;

  document.documentElement.classList.toggle('is-mobile-app', isMobile);
  document.body.classList.toggle('is-mobile-app', isMobile);
  document.documentElement.classList.toggle('is-mobile-landscape', isLandscape);
  document.body.classList.toggle('is-mobile-landscape', isLandscape);
  document.documentElement.classList.toggle('is-windows-suite', isSuite);
  document.body.classList.toggle('is-windows-suite', isSuite);
  document.documentElement.classList.toggle('is-installed-app', isInstalled);
  document.body.classList.toggle('is-installed-app', isInstalled);
  document.documentElement.classList.toggle('is-platform-web', isWeb);
  document.body.classList.toggle('is-platform-web', isWeb);
  document.documentElement.classList.toggle('is-platform-desktop', AppPlatform.isDesktop);
  document.body.classList.toggle('is-platform-desktop', AppPlatform.isDesktop);
  document.documentElement.classList.toggle('is-platform-android', AppPlatform.isAndroid);
  document.body.classList.toggle('is-platform-android', AppPlatform.isAndroid);

  const suiteDlBtn = document.getElementById('suiteDownloadBtn');
  const mobileDlBtn = document.getElementById('mobileDownloadAppBtn');
  // Download button only shown on Web!
  if (suiteDlBtn) suiteDlBtn.style.display = isWeb ? 'inline-flex' : 'none';
  if (mobileDlBtn) mobileDlBtn.style.display = isWeb ? '' : 'none';

  if (!isSuite) {
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
  const isSuite = isWindowsSuiteMode();
  if (!isSuite) {
    tabId = 'wordTab';
  } else if (!tabId) {
    tabId = 'wordTab';
  }
  appState.currentTab = tabId;

  document.querySelectorAll('.nav-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  const wordDocTitle = document.getElementById('wordDocTitle');
  const pdfDocTitle = document.getElementById('pdfDocTitle');
  const pptDocTitle = document.getElementById('pptDocTitle');
  const toolsDocLabel = document.getElementById('toolsDocLabel');
  if (wordDocTitle && pdfDocTitle) {
    wordDocTitle.style.display = tabId === 'wordTab' ? 'inline-block' : 'none';
    pdfDocTitle.style.display = tabId === 'pdfTab' ? 'inline-block' : 'none';
    if (pptDocTitle) {
      pptDocTitle.style.display = tabId === 'pptTab' ? 'inline-block' : 'none';
    }
    if (toolsDocLabel) {
      toolsDocLabel.style.display = tabId === 'toolsTab' ? 'inline-block' : 'none';
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

  if (typeof window.updateDesktopWindowTitle === 'function') {
    window.updateDesktopWindowTitle();
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
      const defTitle = activeDoc.type === 'ppt' ? 'Sunum 1.pptx' : (activeDoc.type === 'pdf' ? 'Belge.pdf' : 'Yeni Yazı.docx');
      activeDoc.title = newTitle || defTitle;
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
      if (editor) {
        editor.innerHTML = targetDoc.content || '<p></p>';
        if (!targetDoc.content) editor.style.fontSize = '';
      }
      if (titleInput) titleInput.value = targetDoc.title || 'Yeni Yazı.docx';
      const fsInput = document.getElementById('fontSizeInput');
      if (fsInput && !targetDoc.content) fsInput.value = '12';
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

  getUniqueWordTitle(basePrefix = 'Yeni Yazı') {
    const knownCloud = (typeof window.getKnownCloudFileNames === 'function') ? window.getKnownCloudFileNames() : [];
    const openTitles = this.docs.map(d => (d.title || '').toLowerCase());
    const isTaken = (name) => {
      const lower = name.toLowerCase();
      return openTitles.includes(lower) || knownCloud.includes(lower);
    };
    const firstCandidate = `${basePrefix}.docx`;
    if (!isTaken(firstCandidate)) return firstCandidate;
    let idx = 2;
    while (idx < 500) {
      const candidate = `${basePrefix} ${idx}.docx`;
      if (!isTaken(candidate)) return candidate;
      idx++;
    }
    return `${basePrefix} ${Date.now()}.docx`;
  },

  createNewWordDoc() {
    this.saveCurrentDocState();
    const count = this.docs.filter(d => d.type === 'word').length + 1;
    const knownCloud = (typeof window.getKnownCloudFileNames === 'function') ? window.getKnownCloudFileNames() : [];
    const openTitles = this.docs.map(d => (d.title || '').toLowerCase());
    let num = count;
    let candidate = `Yeni Yazı ${num}.docx`;
    while (openTitles.includes(candidate.toLowerCase()) || knownCloud.includes(candidate.toLowerCase())) {
      num++;
      candidate = `Yeni Yazı ${num}.docx`;
    }
    const newDoc = {
      id: 'doc_' + (this.nextId++),
      title: candidate,
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
            transition: 'fade',
            title: '',
            subtitle: '',
            content: '',
            leftCol: '',
            rightCol: '',
            card1: '',
            card2: '',
            card3: '',
            quote: '',
            author: '',
            notes: '',
            elements: []
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

  onWordLoaded(fileName, content, arrayBuffer, fileMeta = {}) {
    const editor = document.getElementById('wordEditor');
    const wordTitle = document.getElementById('wordDocTitle');

    const activeDoc = this.getActiveDoc();
    const currentText = editor ? editor.innerText.trim() : '';
    const isDocEmpty = !currentText || currentText.length === 0;

    if (activeDoc && activeDoc.isDefault && activeDoc.type === 'word' && isDocEmpty) {
      activeDoc.title = fileName;
      activeDoc.content = content;
      activeDoc.rawBytes = arrayBuffer;
      activeDoc.filePath = fileMeta?.filePath || null;
      activeDoc.fileHandle = fileMeta?.fileHandle || null;
      activeDoc.isDirty = false;
      activeDoc.isDefault = false;
      this.renderTabs();
      switchTab('wordTab');
      if (wordTitle) wordTitle.value = fileName;
      if (editor) editor.innerHTML = content;
      if (window.updateWordStats) window.updateWordStats();
      return;
    }

    const existing = this.docs.find(d => d.title.toLowerCase() === fileName.toLowerCase() && (!fileMeta?.filePath || !d.filePath || d.filePath === fileMeta.filePath));
    if (existing) {
      existing.content = content;
      existing.rawBytes = arrayBuffer;
      if (fileMeta?.filePath) existing.filePath = fileMeta.filePath;
      if (fileMeta?.fileHandle) existing.fileHandle = fileMeta.fileHandle;
      existing.isDirty = false;
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
      filePath: fileMeta?.filePath || null,
      fileHandle: fileMeta?.fileHandle || null,
      isDirty: false,
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

  onPdfLoaded(fileName, arrayBuffer, fileMeta = {}) {
    const activeDoc = this.getActiveDoc();
    const editor = document.getElementById('wordEditor');
    const currentText = (activeDoc?.type === 'word' && editor) ? editor.innerText.trim() : '';
    const isDocEmpty = !currentText || currentText.length === 0;

    if (activeDoc && activeDoc.isDefault && isDocEmpty) {
      activeDoc.title = fileName;
      activeDoc.type = 'pdf';
      activeDoc.rawBytes = arrayBuffer;
      activeDoc.filePath = fileMeta?.filePath || null;
      activeDoc.fileHandle = fileMeta?.fileHandle || null;
      activeDoc.isDirty = false;
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
      if (fileMeta?.filePath) existing.filePath = fileMeta.filePath;
      if (fileMeta?.fileHandle) existing.fileHandle = fileMeta.fileHandle;
      existing.isDirty = false;
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
      filePath: fileMeta?.filePath || null,
      fileHandle: fileMeta?.fileHandle || null,
      isDirty: false,
      isDefault: false
    };
    this.docs.push(newDoc);
    this.activeDocId = newDoc.id;
    this.renderTabs();
    switchTab('pdfTab');
    const pdfTitle = document.getElementById('pdfDocTitle');
    if (pdfTitle) pdfTitle.value = fileName;
  },

  onPptLoaded(fileName, pptState, fileMeta = {}) {
    if (window.addRecentDocument) window.addRecentDocument(fileName, 'ppt');
    const activeDoc = this.getActiveDoc();
    const editor = document.getElementById('wordEditor');
    const currentText = (activeDoc?.type === 'word' && editor) ? editor.innerText.trim() : '';
    const isDocEmpty = !currentText || currentText.length === 0;

    if (activeDoc && activeDoc.isDefault && activeDoc.type === 'word' && isDocEmpty) {
      activeDoc.title = fileName;
      activeDoc.type = 'ppt';
      activeDoc.pptStateSnapshot = JSON.parse(JSON.stringify(pptState));
      activeDoc.filePath = fileMeta?.filePath || null;
      activeDoc.fileHandle = fileMeta?.fileHandle || null;
      activeDoc.isDirty = false;
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
      if (fileMeta?.filePath) existing.filePath = fileMeta.filePath;
      if (fileMeta?.fileHandle) existing.fileHandle = fileMeta.fileHandle;
      existing.isDirty = false;
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
      filePath: fileMeta?.filePath || null,
      fileHandle: fileMeta?.fileHandle || null,
      isDirty: false,
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
      filePath: null,
      fileHandle: null,
      isDirty: false,
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

    const performClose = () => {
      if (this.docs.length <= 1) {
        const doc = this.docs[0];
        doc.title = this.getUniqueWordTitle('Yeni Yazı');
        doc.type = 'word';
        doc.content = '';
        doc.isDefault = true;
        doc.isDirty = false;
        doc.filePath = null;
        doc.fileHandle = null;
        doc.pdfStateSnapshot = null;
        doc.pptStateSnapshot = null;
        doc.rawBytes = null;
        this.activeDocId = doc.id;
        try {
          localStorage.removeItem('kalpten_kaleme_word_draft');
          localStorage.removeItem('kalpten_kaleme_word_title');
          localStorage.removeItem('studio_office_word_draft');
          localStorage.removeItem('studio_office_word_title');
        } catch (_) {}
        switchTab('wordTab');
        const titleInput = document.getElementById('wordDocTitle');
        if (editor) {
          editor.innerHTML = '';
          editor.style.fontSize = '';
        }
        if (titleInput) titleInput.value = doc.title;
        const fsInput = document.getElementById('fontSizeInput');
        if (fsInput) fsInput.value = '12';
        if (window.updateWordStats) window.updateWordStats();
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
    };

    if (hasContent && typeof window.showConfirmDialog === 'function') {
      window.showConfirmDialog(
        `"${docToClose.title}" belgesini kapatmak istediğinize emin misiniz? Kaydedilmemiş değişiklikler silinecektir.`,
        performClose,
        'Belgeyi Kapat'
      );
    } else {
      performClose();
    }
  },

  renderTabs() {
    const track = document.getElementById('docTabsTrack');
    const tabsBar = document.getElementById('documentTabsBar');
    if (!track) return;

    const isSuite = isWindowsSuiteMode();
    const visibleDocs = (!isSuite)
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
      const dirtyMark = doc.isDirty ? '<span style="color:var(--accent-coral);margin-right:3px;">●</span>' : '';
      const pathHint = doc.filePath ? `\nKonum: ${escapeHtml(doc.filePath)}` : '';
      return `
        <div class="doc-tab ${isActive ? 'active' : ''}" data-id="${doc.id}" title="${safeTitle}${pathHint}">
          <img src="${iconSrc}" class="doc-tab-type-img" alt="${typeLabel}">
          <span class="doc-tab-title">${dirtyMark}${safeTitle}</span>
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

    if (typeof window.updateLocalFileBadge === 'function') window.updateLocalFileBadge();
    if (typeof window.updateDesktopWindowTitle === 'function') window.updateDesktopWindowTitle();
  }
};
window.docManager = docManager;

window.updateLocalFileBadge = function() {
  const badge = document.getElementById('localFileBadge');
  const textEl = document.getElementById('localFileBadgeText');
  if (!badge || !textEl) return;
  const activeDoc = window.docManager ? window.docManager.getActiveDoc() : null;
  if (activeDoc && (activeDoc.filePath || activeDoc.fileHandle)) {
    badge.style.display = 'inline-flex';
    if (activeDoc.filePath) {
      textEl.textContent = activeDoc.filePath;
      badge.title = `Yerel Dosya Konumu: ${activeDoc.filePath}\n(Ctrl+S doğrudan bu dosyanın üzerine kaydeder)`;
    } else if (activeDoc.fileHandle) {
      textEl.textContent = activeDoc.fileHandle.name || activeDoc.title;
      badge.title = `Yerel Dosya Bağlantısı: ${activeDoc.fileHandle.name || activeDoc.title}\n(Ctrl+S doğrudan bu dosyanın üzerine kaydeder)`;
    }
  } else {
    badge.style.display = 'none';
    textEl.textContent = '';
  }
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('localFileBadge')?.addEventListener('click', () => {
    const activeDoc = window.docManager ? window.docManager.getActiveDoc() : null;
    const loc = activeDoc?.filePath || activeDoc?.fileHandle?.name;
    if (loc) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(loc).catch(() => {});
      }
      showToast(`Bağlı dosya: ${loc} (Ctrl+S doğrudan üzerine yazar)`);
    }
  });
});

let lastSentWinTitle = '';
window.updateDesktopWindowTitle = function() {
  const isTools = appState.currentTab === 'toolsTab';
  const activeDoc = window.docManager ? window.docManager.getActiveDoc() : null;
  const expectedType = appState.currentTab === 'pptTab' ? 'ppt' : appState.currentTab === 'pdfTab' ? 'pdf' : 'word';
  let docName = 'Yeni Yazı.docx';
  let isDirty = false;
  if (isTools) {
    docName = 'PDF & Belge Araçları';
  } else if (activeDoc && activeDoc.type === expectedType) {
    docName = activeDoc.title || docName;
    isDirty = Boolean(activeDoc.isDirty);
  } else if (appState.currentTab === 'pdfTab') {
    docName = document.getElementById('pdfDocTitle')?.value || 'PDF Düzenleyici';
  } else if (activeDoc && activeDoc.title) {
    docName = activeDoc.title;
    isDirty = Boolean(activeDoc.isDirty);
  }
  const dirtyPrefix = isDirty ? '● ' : '';
  const fullTitle = `${dirtyPrefix}${docName} — Kalpten Kaleme`;
  document.title = fullTitle;
  if (isOnlineServer && fullTitle !== lastSentWinTitle) {
    lastSentWinTitle = fullTitle;
    fetch('/api/window-title', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: fullTitle
    }).catch(() => {});
  }
};


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

  // Global Header Actions: Aç (Open File) & Farklı Kaydet (Save As)
  const wordFileInput = document.getElementById('wordFileInput');
  const pdfFileInput = document.getElementById('pdfFileInput');
  const pptFileInput = document.getElementById('pptFileInput');

  function openAnySelectedFile(file, fileMeta = {}) {
    if (!file) return;
    closeModal('libraryModal');
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.pdf')) {
      switchTab('pdfTab');
      if (window.loadPdfFile) window.loadPdfFile(file, fileMeta);
    } else if (name.endsWith('.pptx') || name.endsWith('.ppt') || name.endsWith('.json') || name.endsWith('.slides')) {
      switchTab('pptTab');
      if (window.pptEditor && window.pptEditor.loadFile) {
        window.pptEditor.loadFile(file, fileMeta);
      }
    } else if (['.docx', '.doc', '.txt', '.md', '.html', '.htm'].some(ext => name.endsWith(ext))) {
      switchTab('wordTab');
      if (window.loadWordFile) window.loadWordFile(file, fileMeta);
    } else {
      showToast('Desteklenmeyen dosya türü. Lütfen Word (.docx), PDF veya PowerPoint (.pptx) dosyası seçin.', 'error');
    }
  }

  async function triggerNativeOrModernOpenDialog(preferredMode = 'all') {
    closeModal('libraryModal');

    // 1. Desktop Native Server Dialog (BelgeDuzenleyici.cs / server.ps1)
    if (isOnlineServer) {
      try {
        const res = await fetch('/api/native-open-dialog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({ mode: preferredMode })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && (data.cancelled || data.canceled)) return;
          if (data && data.success) {
            await checkForOpenedFile();
            return;
          }
        }
      } catch (_) {}
    }

    // 2. Modern Chromium File System Access API (Standalone Desktop Mode)
    // Allows direct Ctrl+S in-place overwrite via FileSystemFileHandle!
    if (typeof window.showOpenFilePicker === 'function' && !AppPlatform.isAndroid) {
      try {
        const [fileHandle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'Ofis Belgeleri (.docx, .pdf, .pptx, .txt)',
              accept: {
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
                'application/pdf': ['.pdf'],
                'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
                'text/plain': ['.txt', '.md'],
                'text/html': ['.html', '.htm'],
                'application/json': ['.json']
              }
            }
          ]
        });
        if (fileHandle) {
          const file = await fileHandle.getFile();
          openAnySelectedFile(file, { fileHandle });
          return;
        }
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    // 3. Classic <input type="file"> fallback
    if (preferredMode === 'ppt' && pptFileInput) {
      pptFileInput.click();
    } else if (preferredMode === 'pdf' && pdfFileInput) {
      pdfFileInput.click();
    } else if (wordFileInput) {
      wordFileInput.setAttribute('accept', '.docx,.doc,.txt,.html,.md,.pdf,.pptx,.ppt,.json');
      wordFileInput.click();
    }
  }

  function triggerUnifiedFilePicker() {
    triggerNativeOrModernOpenDialog('all');
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
    triggerNativeOrModernOpenDialog('ppt');
  });

  document.getElementById('globalOpenBtn')?.addEventListener('click', () => {
    const mode = appState.currentTab === 'pptTab' ? 'ppt' : (appState.currentTab === 'pdfTab' ? 'pdf' : 'word');
    triggerNativeOrModernOpenDialog(mode);
  });

  function triggerSaveFeedback() {
    const saveBtn = document.getElementById('globalSaveBtn');
    if (!saveBtn) return;
    const textSpan = saveBtn.querySelector('.btn-text');
    if (textSpan && !saveBtn.classList.contains('is-saved-feedback')) {
      saveBtn.classList.add('is-saved-feedback');
      const originalText = textSpan.textContent;
      textSpan.textContent = 'Kaydedildi';
      setTimeout(() => {
        textSpan.textContent = originalText;
        saveBtn.classList.remove('is-saved-feedback');
      }, 2000);
    }
  }
  window.triggerSaveFeedback = triggerSaveFeedback;

  document.getElementById('globalSaveBtn')?.addEventListener('click', () => {
    triggerSaveFeedback();
    if (appState.currentTab === 'pdfTab') {
      if (window.savePdfDocument) window.savePdfDocument({ saveAs: false });
    } else if (appState.currentTab === 'pptTab') {
      if (window.pptEditor && typeof window.pptEditor.savePresentationDocument === 'function') {
        window.pptEditor.savePresentationDocument({ saveAs: false });
      } else if (window.pptEditor) {
        window.pptEditor.saveToStorage();
        showToast('Sunum otomatik korundu ve kaydedildi.');
      }
    } else {
      if (window.saveWordDocument) window.saveWordDocument({ saveAs: false });
    }
  });

  document.getElementById('globalSaveAsBtn')?.addEventListener('click', () => {
    if (appState.currentTab === 'pdfTab') {
      if (window.savePdfDocument) window.savePdfDocument({ saveAs: true });
    } else if (appState.currentTab === 'pptTab') {
      if (window.pptEditor && typeof window.pptEditor.savePresentationDocument === 'function') {
        window.pptEditor.savePresentationDocument({ saveAs: true });
      }
    } else {
      if (window.saveWordDocument) window.saveWordDocument({ saveAs: true });
    }
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
        const inner = typeof window.pptEditor.buildStaticSlideHtml === 'function'
          ? window.pptEditor.buildStaticSlideHtml(s, false)
          : `<h2 style="font-size:28px;font-weight:800;margin-bottom:16px;">${s.title || ''}</h2><div>${s.content || ''}</div>`;
        const isLast = (idx === arr.length - 1);
        const breakStyle = isLast ? 'page-break-after: auto !important; break-after: auto !important;' : 'page-break-after: always !important; break-after: page !important;';
        return `<div class="kalpten-print-slide ${theme} ${ratioClass}" style="position:relative;${breakStyle}">${inner}</div>`;
      }).join('');

      printRoot.innerHTML = slidesHtml;
      return;
    }

    if (appState.currentTab === 'pdfTab') {
      if (window.preparePdfPrintPages) {
        const ok = await window.preparePdfPrintPages(printRoot);
        if (ok) {
          const dims = window.pdfState?.printDimensions;
          if (dims && dims.widthMm && dims.heightMm) {
            pageStyle.textContent = `@page { size: ${dims.widthMm.toFixed(1)}mm ${dims.heightMm.toFixed(1)}mm; margin: 0; }`;
          } else {
            pageStyle.textContent = `@page { size: auto; margin: 0; }`;
          }
          return;
        }
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
    if (e.key === 'F12' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      document.getElementById('globalSaveAsBtn')?.click();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (e.shiftKey) {
        document.getElementById('globalSaveAsBtn')?.click();
      } else {
        document.getElementById('globalSaveBtn')?.click();
      }
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
    window.showConfirmDialog('Son açılan belgeler geçmişi temizlensin mi?', () => {
      localStorage.removeItem('belge_recent_documents');
      if (typeof renderRecentDocs === 'function') renderRecentDocs();
      if (typeof loadLibraryFiles === 'function') loadLibraryFiles();
      showToast('Geçmiş temizlendi.');
    }, 'Geçmişi Temizle');
  });

  // ========================================================================
  // Application Heartbeat & Native Lifecycle Management
  // Keeps desktop server alive while window is open, cleanly shuts down on exit
  // ========================================================================
  function pingServer() {
    if (!isOnlineServer) return;
    fetch('/api/heartbeat').catch(() => {});
  }
  pingServer();

  if (isOnlineServer) {
    try {
      const blob = new Blob(["setInterval(function() { postMessage('p'); }, 1000);"], { type: 'application/javascript' });
      const hbWorker = new Worker(URL.createObjectURL(blob));
      hbWorker.onmessage = pingServer;
    } catch (e) {
      setInterval(pingServer, 1000);
    }

    // Clean exit notification when the user closes the window
    window.addEventListener('pagehide', () => {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/exit');
        } else {
          fetch('/api/exit', { keepalive: true, method: 'GET' }).catch(() => {});
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
            const fileMeta = { filePath: info.path || null };
            if (ext === 'pdf') {
              switchTab('pdfTab');
              addRecentDocument(info.filename, 'pdf');
              let retries = 25;
              while (!window.loadPdfFromBuffer && retries-- > 0) {
                await new Promise(r => setTimeout(r, 80));
              }
              if (window.loadPdfFromBuffer) {
                window.loadPdfFromBuffer(buffer, info.filename, fileMeta);
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
                window.pptEditor.loadFile(file, fileMeta);
              }
            } else if (['docx', 'doc', 'txt', 'md', 'html', 'htm'].includes(ext)) {
              switchTab('wordTab');
              addRecentDocument(info.filename, 'word');
              let retries = 25;
              while (!window.loadWordFromBuffer && retries-- > 0) {
                await new Promise(r => setTimeout(r, 80));
              }
              if (window.loadWordFromBuffer) {
                window.loadWordFromBuffer(buffer, info.filename, fileMeta);
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
    const openLibraryBtn = document.getElementById('openLibraryBtn');
    const dot = document.getElementById('driveStatusDot');
    const modalBadge = document.getElementById('driveModalBadge');
    const modalDot = document.getElementById('driveModalDot');
    const modalBadgeText = document.getElementById('driveModalBadgeText');
    const modalPath = document.getElementById('driveModalPath');
    const openBtn = document.getElementById('openDriveFolderBtn');
    const changeBtn = document.getElementById('changeDriveFolderBtn');

    if (!AppPlatform.isDesktop) {
      const isAndroid = AppPlatform.isAndroid;
      if (dot) {
        dot.className = isAndroid ? 'drive-status-dot active android' : 'drive-status-dot active web';
      }
      if (openLibraryBtn) {
        openLibraryBtn.title = isAndroid
          ? 'Belgeleriniz telefonun Belgeler/Kalpten Kaleme klasöründe saklanır.\n(Kütüphaneyi açmak için tıklayın)'
          : 'Kalpten Kaleme Web Sürümü — Belgeleriniz tarayıcınızda güvendedir.\n(Kütüphaneyi açmak için tıklayın)';
      }
      if (modalPath) {
        modalPath.textContent = isAndroid
          ? 'Dahili Depolama / Belgeler / Kalpten Kaleme'
          : '🌐 Tarayıcı Güvenli Belleği (Çevrimdışı Çalışabilir)';
      }
      if (modalBadge && modalDot && modalBadgeText) {
        modalBadge.className = isAndroid ? 'drive-modal-badge' : 'drive-modal-badge web';
        modalDot.className = isAndroid ? 'drive-status-dot active android' : 'drive-status-dot active web';
        modalBadgeText.textContent = isAndroid
          ? 'Android Dahili Depolama Aktif'
          : '🌐 Web & Çevrimdışı Sürüm Aktif';
      }
      if (openBtn) openBtn.textContent = isAndroid ? '📂 Belgeler Klasörünü Aç' : '📂 Dosya Aç';
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

      // Update Kütüphanem button status dot & title
      if (dot) {
        if (provider === 'local') {
          dot.classList.add('local');
        } else {
          dot.classList.remove('local');
        }
      }
      if (openLibraryBtn) {
        if (provider === 'gdrive') {
          openLibraryBtn.title = `Google Drive Senkronize: ${currentSyncFolder}\n(Kütüphaneyi açmak için tıklayın)`;
        } else if (provider === 'onedrive') {
          openLibraryBtn.title = `OneDrive Senkronize: ${currentSyncFolder}\n(Kütüphaneyi açmak için tıklayın)`;
        } else {
          openLibraryBtn.title = `Kayıt Klasörü: ${currentSyncFolder}\n(Kütüphaneyi açmak için tıklayın)`;
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
      const rawFiles = await res.json();
      const files = Array.isArray(rawFiles) ? rawFiles : (rawFiles ? [rawFiles] : []);

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
    const ptNum = parseInt(val, 10);
    const fsInput = document.getElementById('fontSizeInput');
    if (fsInput && !isNaN(ptNum)) fsInput.value = ptNum;
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
    window.showPromptDialog('Yazınız için yeni bir başlık girin:', currentTitle, (newName) => {
      if (newName && newName.trim().length > 0) {
        let finalName = newName.trim();
        if (!finalName.toLowerCase().endsWith('.docx')) finalName += '.docx';
        const titleInput = document.getElementById('wordDocTitle');
        if (titleInput) titleInput.value = finalName;
        if (window.docManager) window.docManager.updateActiveDocTitle(finalName);
        showToast(`Başlık "${finalName}" olarak güncellendi.`);
      }
    }, 'Yazı Başlığını Değiştir');
  });

  document.getElementById('openLibraryBtn')?.addEventListener('click', () => openLibrary('all'));

  // ========================================================================
  // 📚 KÜTÜPHANEM (Library & Writing Archive) Controller
  // ========================================================================
  let currentLibraryFilter = 'all';
  let libraryFilesCache = [];

  window.getKnownCloudFileNames = function() {
    return (libraryFilesCache || []).map(f => (f.name || '').toLowerCase()).filter(Boolean);
  };

  // Pre-populate libraryFilesCache silently on startup so auto-save knows existing filenames
  if (isOnlineServer) {
    fetch('/api/drive-files')
      .then(r => r.ok ? r.json() : [])
      .then(raw => {
        const arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        if (arr.length > 0) libraryFilesCache = arr;
      })
      .catch(() => {});
  } else if (window.AndroidBridge && typeof window.AndroidBridge.listSavedFilesJson === 'function') {
    try {
      libraryFilesCache = JSON.parse(window.AndroidBridge.listSavedFilesJson() || '[]');
    } catch (_) {}
  } else if (window.kalptenVault) {
    window.kalptenVault.listFiles().then(arr => {
      if (arr && arr.length > 0) libraryFilesCache = arr;
    }).catch(() => {});
  }

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
          const rawFiles = await res.json();
          files = Array.isArray(rawFiles) ? rawFiles : (rawFiles ? [rawFiles] : []);
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

    // 3. Standalone Desktop / Web Vault (IndexedDB + Recents)
    if (!files || files.length === 0) {
      try {
        const vaultFiles = window.kalptenVault ? await window.kalptenVault.listFiles() : [];
        const recents = JSON.parse(localStorage.getItem('belge_recent_documents') || '[]');
        const map = new Map();
        vaultFiles.forEach(vf => map.set(vf.name.toLowerCase(), vf));
        recents.forEach(r => {
          if (r && r.name && !map.has(r.name.toLowerCase())) {
            map.set(r.name.toLowerCase(), {
              name: r.name,
              path: r.name,
              size: 'Kayıtlı',
              date: r.time || 'Bugün',
              ext: (r.name.split('.').pop() || 'docx').toLowerCase(),
              isRecentOnly: true
            });
          }
        });
        files = Array.from(map.values());
        if (storageLocation && !isOnlineServer) {
          storageLocation.textContent = AppPlatform.isDesktop ? 'Bilgisayar Arşivi & Kütüphanem' : 'Tarayıcı Yerel Hafızası';
        }
        if (storageSubtitle && !isOnlineServer && AppPlatform.isDesktop) {
          storageSubtitle.textContent = 'Yazılarınız otomatik korunur; Kaydet tuşuyla bilgisayarınıza da indirilir';
        }
        if (syncDot && !isOnlineServer) {
          syncDot.className = 'drive-status-dot active';
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
      } else if (ext === 'pptx' || ext === 'ppt' || ext === 'json') {
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
        // Offline Vault load (Kalpten Kaleme.html standalone desktop or Web)
        if (window.kalptenVault) {
          try {
            const buffer = await window.kalptenVault.getFileBytes(fileName);
            if (buffer && buffer.byteLength > 0) {
              if (ext === 'pdf') {
                switchTab('pdfTab');
                if (window.loadPdfFromBuffer) await window.loadPdfFromBuffer(buffer, fileName);
              } else if (ext === 'pptx' || ext === 'ppt' || ext === 'json') {
                switchTab('pptTab');
                if (window.pptEditor) await window.pptEditor.loadFile(new File([buffer], fileName));
              } else {
                switchTab('wordTab');
                if (window.loadWordFromBuffer) await window.loadWordFromBuffer(buffer, fileName);
              }
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
      card.querySelector('.library-btn-del')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.showConfirmDialog(`"${fileName}" adlı belgeyi silmek istediğinize emin misiniz?`, async () => {
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
            // Remove from IndexedDB vault & local storage
            try {
              if (window.kalptenVault) await window.kalptenVault.deleteFile(fileName);
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
        }, 'Belgeyi Sil');
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
    window.showConfirmDialog('Açılan belgeler geçmişi temizlensin mi? (Orijinal dosyalarınız silinmez)', () => {
      localStorage.removeItem('belge_recent_documents');
      showToast('Geçmiş temizlendi.');
      loadLibraryFiles();
    }, 'Geçmişi Temizle');
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

  // Download Modal local vs remote links & PWA Desktop Installer
  function syncSuiteDownloadLinks() {
    const winDl = document.getElementById('winDownloadLink');
    const apkDl = document.getElementById('androidDownloadLink');
    const pagesBase = 'https://meihper.github.io/Kalpten-Kaleme/';
    if (winDl) winDl.href = pagesBase + 'KalptenKaleme-Windows.zip';
    if (apkDl) apkDl.href = pagesBase + 'KalptenKaleme.apk';
  }
  window.syncSuiteDownloadLinks = syncSuiteDownloadLinks;
  syncSuiteDownloadLinks();

  // Register Service Worker for 1-Click Native Desktop PWA Install & Offline Mode
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__deferredPwaPrompt = e;
  });

  window.addEventListener('appinstalled', () => {
    window.__deferredPwaPrompt = null;
    closeModal('downloadSuiteModal');
    showToast('Kalpten Kaleme Masaüstü Uygulaması başarıyla kuruldu!');
  });

  window.triggerDesktopPwaInstall = async function() {
    if (window.__deferredPwaPrompt) {
      try {
        window.__deferredPwaPrompt.prompt();
        const choice = await window.__deferredPwaPrompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          window.__deferredPwaPrompt = null;
          closeModal('downloadSuiteModal');
          showToast('Masaüstü uygulaması kuruluyor...');
        }
        return;
      } catch (_) {}
    }
    const helper = document.getElementById('pwaInstallHelperBox');
    if (helper) {
      helper.style.display = 'block';
      showToast('Adres çubuğundaki "Uygulamayı Yükle" simgesine tıklayarak hemen kurabilirsiniz.');
    }
  };

  if (location.search.includes('install=1')) {
    setTimeout(() => openModal('downloadSuiteModal'), 300);
  }

  // Standalone file:// mode: Offer 1-Click Fullscreen Desktop Studio Mode (Hides browser tabs/address bar)
  if (window.location.protocol === 'file:' && !sessionStorage.getItem('kk_fs_bar_dismissed')) {
    const headerEl = document.querySelector('.global-header');
    if (headerEl && !document.getElementById('standaloneFileModeBar')) {
      const bar = document.createElement('div');
      bar.id = 'standaloneFileModeBar';
      bar.style.cssText = 'background: linear-gradient(90deg, #0f172a, #1e3a8a); color: #f8fafc; padding: 6px 16px; font-size: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.12); z-index: 900;';
      bar.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <span>🖥️ <strong>Kalpten Kaleme Taşınabilir Masaüstü Stüdyosu</strong> — Tarayıcı sekmelerini gizleyip tam ekran masaüstü modunda çalışabilirsiniz:</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
          <button type="button" id="enterDesktopFullscreenBtn" style="background:#2563eb; color:#fff; border:1px solid rgba(255,255,255,0.25); border-radius:6px; padding:4px 11px; font-size:11.5px; font-weight:700; cursor:pointer;">⚡ Tam Ekran Masaüstü Modu (F11)</button>
          <a href="https://meihper.github.io/Kalpten-Kaleme/?install=1" target="_blank" rel="noopener" style="background:rgba(255,255,255,0.12); color:#fff; text-decoration:none; border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:4px 10px; font-size:11.5px; font-weight:600;">📌 Kalıcı Pencere Kur</a>
          <button type="button" id="dismissDesktopFullscreenBar" title="Gizle" style="background:transparent; color:#cbd5e1; border:none; font-size:14px; cursor:pointer; padding:2px 6px;">✕</button>
        </div>
      `;
      headerEl.insertAdjacentElement('afterend', bar);
      document.getElementById('enterDesktopFullscreenBtn')?.addEventListener('click', () => {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (document.exitFullscreen && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      });
      document.getElementById('dismissDesktopFullscreenBar')?.addEventListener('click', () => {
        sessionStorage.setItem('kk_fs_bar_dismissed', '1');
        bar.remove();
      });
    }
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
    } else if (ext === 'pptx' || ext === 'ppt' || ext === 'json') {
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

