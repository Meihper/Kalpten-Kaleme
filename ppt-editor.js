/**
 * ============================================================================
 * Kalpten Kaleme - PowerPoint & Sunum Stüdyosu (ppt-editor.js)
 * Modern 16:9 Slayt Editörü, Canlı Şablonlar, F5 Tam Ekran Sunum Modu
 * ============================================================================
 */

const pptEditor = {
  state: {
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
    fileName: 'Sunum 1.pptx'
  },

  init() {
    this.loadFromStorage();
    this.bindEvents();
    this.render();

    window.addEventListener('resize', () => {
      if (this.state.zoom === 'fit') {
        this.applyZoom();
      }
    });
  },

  loadFromStorage() {
    try {
      const saved = localStorage.getItem('kalpten_kaleme_ppt_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
          const isOldDummy = parsed.slides.length >= 2 && parsed.slides[0]?.title === 'Kalpten Kaleme';
          if (!isOldDummy) {
            this.state.slides = parsed.slides;
            this.state.theme = (parsed.theme && parsed.theme !== 'theme-luxury-dark') ? parsed.theme : 'theme-clean-light';
            this.state.aspectRatio = parsed.aspectRatio || '16:9';
            this.state.zoom = parsed.zoom || 100;
            this.state.fileName = parsed.fileName || 'Sunum 1.pptx';
            this.state.currentIndex = 0;
            return;
          }
        }
      }
    } catch (e) {
      console.warn('PPT state load failed:', e);
    }
  },

  saveToStorage() {
    try {
      localStorage.setItem('kalpten_kaleme_ppt_state', JSON.stringify({
        slides: this.state.slides,
        theme: this.state.theme,
        aspectRatio: this.state.aspectRatio,
        zoom: this.state.zoom,
        fileName: this.state.fileName
      }));
    } catch (e) {
      console.warn('PPT state save failed:', e);
    }
  },

  setAspectRatio(ratio) {
    this.state.aspectRatio = ratio;
    this.saveToStorage();
    this.render();
  },

  setZoom(zoomVal) {
    if (zoomVal === 'fit') {
      this.state.zoom = 'fit';
    } else {
      this.state.zoom = parseInt(zoomVal, 10) || 100;
    }
    this.saveToStorage();
    this.applyZoom();
  },

  applyZoom() {
    const wrapper = document.querySelector('.ppt-slide-wrapper');
    const stage = document.querySelector('.ppt-stage');
    if (!wrapper) return;
    if (this.state.zoom === 'fit') {
      if (stage && stage.clientWidth > 0 && stage.clientHeight > 0) {
        const prevTransform = wrapper.style.transform;
        wrapper.style.transform = 'none';
        const naturalW = wrapper.offsetWidth || 960;
        const naturalH = wrapper.offsetHeight || 540;
        wrapper.style.transform = prevTransform;

        const availW = stage.clientWidth - 40;
        const availH = stage.clientHeight - 40;
        const scaleW = availW / naturalW;
        const scaleH = availH / naturalH;
        const fitScale = Math.min(scaleW, scaleH, 1.2);
        wrapper.style.transform = `scale(${Math.max(0.25, Number(fitScale.toFixed(3)))})`;
      } else {
        wrapper.style.transform = 'scale(1)';
      }
    } else {
      const scale = (this.state.zoom / 100);
      wrapper.style.transform = `scale(${scale})`;
    }
  },

  savedSelection: null,

  saveSelection() {
    const sel = window.getSelection();
    const canvas = document.getElementById('pptActiveSlideCanvas');
    if (sel && sel.rangeCount > 0 && canvas && canvas.contains(sel.anchorNode)) {
      this.savedSelection = sel.getRangeAt(0).cloneRange();
    }
  },

  restoreSelection() {
    if (this.savedSelection) {
      const canvas = document.getElementById('pptActiveSlideCanvas');
      if (canvas && canvas.contains(this.savedSelection.commonAncestorContainer)) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.savedSelection);
      }
    }
  },

  syncCurrentSlideFromDOM() {
    const canvas = document.getElementById('pptActiveSlideCanvas');
    const slide = this.getCurrentSlide();
    if (!canvas || !slide) return;
    canvas.querySelectorAll('[contenteditable="true"][data-field]').forEach(el => {
      const field = el.getAttribute('data-field');
      if (field) {
        slide[field] = el.innerHTML;
      }
    });
    this.debounceSave();
  },

  bindEvents() {
    document.addEventListener('selectionchange', () => {
      this.saveSelection();
    });

    // Aspect Ratio & Zoom
    const aspectSelect = document.getElementById('pptAspectSelect');
    if (aspectSelect) {
      aspectSelect.value = this.state.aspectRatio;
      aspectSelect.addEventListener('change', (e) => {
        this.setAspectRatio(e.target.value);
      });
    }

    const zoomSelect = document.getElementById('pptZoomSelect');
    if (zoomSelect) {
      zoomSelect.value = this.state.zoom.toString();
      zoomSelect.addEventListener('change', (e) => {
        this.setZoom(e.target.value);
      });
    }

    // Add Slide Button with fixed-position dropdown
    const addBtn = document.getElementById('pptAddSlideBtn');
    const layoutDropdown = document.getElementById('pptLayoutDropdown');
    
    if (addBtn && layoutDropdown) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = layoutDropdown.style.display === 'block';
        document.querySelectorAll('#pptToolbar .dropdown-menu').forEach(m => m.style.display = 'none');
        if (!isOpen) {
          const rect = addBtn.getBoundingClientRect();
          layoutDropdown.style.top = `${Math.round(rect.bottom + 6)}px`;
          layoutDropdown.style.left = `${Math.max(8, Math.round(rect.left))}px`;
          layoutDropdown.style.display = 'block';
        }
      });

      document.addEventListener('click', () => {
        layoutDropdown.style.display = 'none';
      });

      layoutDropdown.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const layout = item.getAttribute('data-layout') || 'title_content';
          this.addSlide(layout);
          layoutDropdown.style.display = 'none';
        });
      });
    }

    // Sidebar footer Add Slide
    document.getElementById('pptSidebarAddSlideBtn')?.addEventListener('click', () => {
      this.addSlide('title_content');
    });

    // Theme selector
    const themeSelect = document.getElementById('pptThemeSelect');
    if (themeSelect) {
      themeSelect.value = this.state.theme;
      themeSelect.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
      });
    }

    // Duplicate slide
    document.getElementById('pptDuplicateSlideBtn')?.addEventListener('click', () => {
      this.duplicateCurrentSlide();
    });

    // Prevent focus loss when clicking toolbar formatting buttons
    document.querySelectorAll('.ppt-toolbar button, .ppt-toolbar .toolbar-icon-btn, .ppt-color-dot').forEach(btn => {
      btn.addEventListener('mousedown', (e) => {
        this.saveSelection();
        if (e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
          e.preventDefault();
        }
      });
    });

    // Delete slide
    document.getElementById('pptDeleteSlideBtn')?.addEventListener('click', () => {
      this.deleteCurrentSlide();
    });

    // Presentation Mode (F5)
    document.getElementById('pptPresentBtn')?.addEventListener('click', () => {
      this.startPresentation();
    });

    // Text formatting
    document.getElementById('pptBoldBtn')?.addEventListener('click', () => {
      this.restoreSelection();
      document.execCommand('bold', false, null);
      this.syncCurrentSlideFromDOM();
    });
    document.getElementById('pptItalicBtn')?.addEventListener('click', () => {
      this.restoreSelection();
      document.execCommand('italic', false, null);
      this.syncCurrentSlideFromDOM();
    });
    document.getElementById('pptUnderlineBtn')?.addEventListener('click', () => {
      this.restoreSelection();
      document.execCommand('underline', false, null);
      this.syncCurrentSlideFromDOM();
    });

    document.getElementById('pptFontFamily')?.addEventListener('change', (e) => {
      this.restoreSelection();
      document.execCommand('fontName', false, e.target.value);
      this.syncCurrentSlideFromDOM();
    });

    document.getElementById('pptFontSize')?.addEventListener('change', (e) => {
      this.restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const span = document.createElement('span');
        span.style.fontSize = e.target.value;
        const range = sel.getRangeAt(0);
        span.appendChild(range.extractContents());
        range.insertNode(span);
        this.syncCurrentSlideFromDOM();
      }
    });

    // Add Elements
    document.getElementById('pptAddTextBoxBtn')?.addEventListener('click', () => {
      this.insertElement('textbox');
    });

    document.getElementById('pptAddBulletBtn')?.addEventListener('click', () => {
      this.insertElement('bullet');
    });

    document.getElementById('pptAddCardBtn')?.addEventListener('click', () => {
      this.insertElement('card');
    });

    // Image Upload
    const imgBtn = document.getElementById('pptAddImageBtn');
    const imgInput = document.getElementById('pptImageInput');
    if (imgBtn && imgInput) {
      imgBtn.addEventListener('click', () => imgInput.click());
      imgInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          this.insertImage(re.target.result);
        };
        reader.readAsDataURL(file);
        imgInput.value = '';
      });
    }

    // Fullscreen HUD Buttons
    document.getElementById('pptHudPrevBtn')?.addEventListener('click', () => this.prevSlide());
    document.getElementById('pptHudNextBtn')?.addEventListener('click', () => this.nextSlide());
    document.getElementById('pptHudExitBtn')?.addEventListener('click', () => this.exitPresentation());

    // Keyboard listener (F5, Arrows)
    window.addEventListener('keydown', (e) => {
      const overlay = document.getElementById('pptPresentationOverlay');
      const isPresenting = overlay && overlay.style.display !== 'none';

      if (e.key === 'F5') {
        e.preventDefault();
        if (isPresenting) {
          this.exitPresentation();
        } else {
          this.startPresentation();
        }
      } else if (isPresenting) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.nextSlide();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          this.prevSlide();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.exitPresentation();
        }
      }
    });

    // Title input hook
    const pptTitle = document.getElementById('pptDocTitle');
    if (pptTitle) {
      pptTitle.addEventListener('input', (e) => {
        this.state.fileName = e.target.value;
        this.saveToStorage();
        if (window.docManager) {
          window.docManager.updateActiveDocTitle(e.target.value);
        }
      });
    }

    // Active Slide Layout Selector
    const currentLayoutSelect = document.getElementById('pptCurrentLayoutSelect');
    if (currentLayoutSelect) {
      currentLayoutSelect.addEventListener('change', (e) => {
        this.setLayout(e.target.value);
      });
    }

    // Move slide up / down
    document.getElementById('pptMoveUpBtn')?.addEventListener('click', () => {
      this.moveCurrentSlide(-1);
    });
    document.getElementById('pptMoveDownBtn')?.addEventListener('click', () => {
      this.moveCurrentSlide(1);
    });

    // Text Alignment
    document.getElementById('pptAlignLeftBtn')?.addEventListener('click', () => {
      this.restoreSelection();
      document.execCommand('justifyLeft', false, null);
      this.syncCurrentSlideFromDOM();
    });
    document.getElementById('pptAlignCenterBtn')?.addEventListener('click', () => {
      this.restoreSelection();
      document.execCommand('justifyCenter', false, null);
      this.syncCurrentSlideFromDOM();
    });

    // Color menu toggle & dots with fixed positioning
    const colorBtn = document.getElementById('pptTextColorBtn');
    const colorMenu = document.getElementById('pptColorMenu');
    const colorBar = document.getElementById('pptTextColorBar');
    if (colorBtn && colorMenu) {
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = colorMenu.style.display === 'grid' || colorMenu.style.display === 'block';
        document.querySelectorAll('#pptToolbar .dropdown-menu').forEach(m => m.style.display = 'none');
        if (!isOpen) {
          const rect = colorBtn.getBoundingClientRect();
          colorMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
          colorMenu.style.left = `${Math.max(8, Math.min(window.innerWidth - 150, Math.round(rect.left - 40)))}px`;
          colorMenu.style.display = 'grid';
        }
      });
      document.addEventListener('click', () => {
        colorMenu.style.display = 'none';
      });
      colorMenu.querySelectorAll('.ppt-color-dot').forEach(dot => {
        dot.addEventListener('click', (e) => {
          e.stopPropagation();
          const color = dot.getAttribute('data-color');
          if (color) {
            this.restoreSelection();
            document.execCommand('foreColor', false, color);
            if (colorBar) colorBar.style.backgroundColor = color;
            this.syncCurrentSlideFromDOM();
          }
          colorMenu.style.display = 'none';
        });
      });
    }

    // Export Dropdown & actions with fixed positioning
    const exportBtn = document.getElementById('pptExportDropdownBtn');
    const exportMenu = document.getElementById('pptExportMenu');
    if (exportBtn && exportMenu) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = exportMenu.style.display === 'block';
        document.querySelectorAll('#pptToolbar .dropdown-menu').forEach(m => m.style.display = 'none');
        if (!isOpen) {
          const rect = exportBtn.getBoundingClientRect();
          exportMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
          exportMenu.style.left = 'auto';
          exportMenu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
          exportMenu.style.display = 'block';
        }
      });
      document.addEventListener('click', () => {
        exportMenu.style.display = 'none';
      });
      document.getElementById('pptExportHtmlBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.style.display = 'none';
        this.exportHtml();
      });
      document.getElementById('pptExportPrintBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.style.display = 'none';
        this.exportPrint();
      });
      document.getElementById('pptExportJsonBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.style.display = 'none';
        this.exportJson();
      });
    }
  },

  getCurrentSlide() {
    return this.state.slides[this.state.currentIndex] || this.state.slides[0];
  },

  render() {
    this.renderThumbnails();
    this.renderActiveSlide();
    this.updateCounters();
  },

  renderThumbnails() {
    const track = document.getElementById('pptThumbnailsTrack');
    if (!track) return;
    track.innerHTML = '';

    this.state.slides.forEach((slide, idx) => {
      const card = document.createElement('div');
      card.className = 'ppt-thumbnail-card' + (idx === this.state.currentIndex ? ' active' : '');
      card.addEventListener('click', () => {
        this.selectSlide(idx);
      });

      const numBadge = document.createElement('div');
      numBadge.className = 'ppt-thumb-num';
      numBadge.textContent = (idx + 1);

      const inner = document.createElement('div');
      inner.className = 'ppt-thumb-inner ' + this.state.theme + ' ratio-' + this.state.aspectRatio.replace(':', '-');

      // Extract brief clean title for preview
      const cleanTitle = (slide.title || '').replace(/<[^>]*>/g, '').trim();
      const previewTitle = cleanTitle ? cleanTitle.substring(0, 24) : ('Slayt ' + (idx + 1));
      const cleanSubtitle = (slide.subtitle || '').replace(/<[^>]*>/g, '').trim();
      inner.innerHTML = `
        <div style="font-weight: 800; font-size: 9px; line-height: 1.2; margin-bottom: 3px; ${!cleanTitle ? 'opacity: 0.55; font-style: italic;' : ''}">${escapeHtml(previewTitle)}</div>
        <div style="font-size: 7px; opacity: 0.7; overflow: hidden; max-height: 20px;">
          ${cleanSubtitle ? escapeHtml(cleanSubtitle.substring(0, 30)) : (slide.layout === 'two_col' ? '2 Sütun' : slide.layout === 'quote' ? 'Alıntı' : slide.layout === 'blank' ? 'Boş' : 'İçerik')}
        </div>
      `;

      card.appendChild(numBadge);
      card.appendChild(inner);
      track.appendChild(card);
    });
  },

  renderActiveSlide() {
    const canvas = document.getElementById('pptActiveSlideCanvas');
    if (!canvas) return;

    // Apply wrapper ratio and zoom
    const wrapper = document.querySelector('.ppt-slide-wrapper');
    if (wrapper) {
      wrapper.className = 'ppt-slide-wrapper ratio-' + this.state.aspectRatio.replace(':', '-');
      this.applyZoom();
    }
    const aspectSelect = document.getElementById('pptAspectSelect');
    if (aspectSelect) aspectSelect.value = this.state.aspectRatio;

    const zoomSelect = document.getElementById('pptZoomSelect');
    if (zoomSelect) zoomSelect.value = this.state.zoom.toString();

    // Apply current theme
    canvas.className = 'ppt-slide-canvas ' + this.state.theme;

    const slide = this.getCurrentSlide();
    if (!slide) return;

    let html = '';

    if (slide.layout === 'title') {
      html = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; text-align: center; padding: 20px;">
          <div class="slide-title-input" contenteditable="true" spellcheck="false" data-field="title" style="font-size: 42px; max-width: 800px;">${slide.title || ''}</div>
          <div class="slide-subtitle-input" contenteditable="true" spellcheck="false" data-field="subtitle" style="font-size: 20px; max-width: 650px;">${slide.subtitle || ''}</div>
        </div>
      `;
    } else if (slide.layout === 'two_col') {
      html = `
        <div class="slide-title-input" contenteditable="true" spellcheck="false" data-field="title">${slide.title || ''}</div>
        <div class="slide-two-cols">
          <div class="slide-col-card">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="leftCol" style="outline: none; flex: 1;">${slide.leftCol || ''}</div>
          </div>
          <div class="slide-col-card">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="rightCol" style="outline: none; flex: 1;">${slide.rightCol || ''}</div>
          </div>
        </div>
      `;
    } else if (slide.layout === 'quote') {
      html = `
        <div class="slide-quote-box">
          <div style="font-size: 64px; line-height: 1; opacity: 0.35; font-family: Georgia, serif;">“</div>
          <div class="slide-quote-text" contenteditable="true" spellcheck="false" data-field="quote">${slide.quote || ''}</div>
          <div class="slide-quote-author" contenteditable="true" spellcheck="false" data-field="author">${slide.author || ''}</div>
        </div>
      `;
    } else if (slide.layout === 'blank') {
      html = `
        <div class="slide-body-input" contenteditable="true" spellcheck="false" data-field="content" style="height: 100%;">
          ${slide.content || ''}
        </div>
      `;
    } else {
      // title_content default
      html = `
        <div class="slide-title-input" contenteditable="true" spellcheck="false" data-field="title">${slide.title || ''}</div>
        <div class="slide-body-input" contenteditable="true" spellcheck="false" data-field="content">${slide.content || ''}</div>
      `;
    }

    canvas.innerHTML = html;

    // Sync layout select
    const layoutSel = document.getElementById('pptCurrentLayoutSelect');
    if (layoutSel && slide) {
      layoutSel.value = slide.layout || 'title_content';
    }

    // Attach live sync input handlers
    canvas.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.addEventListener('input', () => {
        const field = el.getAttribute('data-field');
        if (field && slide) {
          slide[field] = el.innerHTML;
          this.debounceSave();
        }
      });
    });
  },

  updateCounters() {
    const badge = document.getElementById('pptSlideCountBadge');
    if (badge) {
      badge.textContent = `${this.state.currentIndex + 1} / ${this.state.slides.length}`;
    }
  },

  debounceTimer: null,
  debounceSave() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.saveToStorage();
      this.renderThumbnails();
    }, 300);
  },

  selectSlide(index) {
    if (index >= 0 && index < this.state.slides.length) {
      this.syncCurrentSlideFromDOM();
      this.state.currentIndex = index;
      this.render();
    }
  },

  addSlide(layout = 'title_content') {
    this.syncCurrentSlideFromDOM();
    const newId = 'slide_' + Date.now();
    let newSlide = {
      id: newId,
      layout: layout,
      title: '',
      subtitle: '',
      content: '',
      leftCol: '',
      rightCol: '',
      quote: '',
      author: ''
    };

    this.state.slides.splice(this.state.currentIndex + 1, 0, newSlide);
    this.state.currentIndex += 1;
    this.saveToStorage();
    this.render();
  },

  duplicateCurrentSlide() {
    this.syncCurrentSlideFromDOM();
    const current = this.getCurrentSlide();
    if (!current) return;
    const copy = JSON.parse(JSON.stringify(current));
    copy.id = 'slide_' + Date.now();
    this.state.slides.splice(this.state.currentIndex + 1, 0, copy);
    this.state.currentIndex += 1;
    this.saveToStorage();
    this.render();
  },

  deleteCurrentSlide() {
    if (this.state.slides.length <= 1) {
      if (window.showToast) window.showToast('Sunumda en az bir slayt bulunmalıdır.', 'warning');
      return;
    }
    this.state.slides.splice(this.state.currentIndex, 1);
    if (this.state.currentIndex >= this.state.slides.length) {
      this.state.currentIndex = this.state.slides.length - 1;
    }
    this.saveToStorage();
    this.render();
  },

  setLayout(layout) {
    this.syncCurrentSlideFromDOM();
    const current = this.getCurrentSlide();
    if (!current) return;
    current.layout = layout;
    this.saveToStorage();
    this.render();
  },

  moveCurrentSlide(direction) {
    this.syncCurrentSlideFromDOM();
    const from = this.state.currentIndex;
    const to = from + direction;
    if (to < 0 || to >= this.state.slides.length) return;
    const item = this.state.slides.splice(from, 1)[0];
    this.state.slides.splice(to, 0, item);
    this.state.currentIndex = to;
    this.saveToStorage();
    this.render();
  },

  setTheme(themeName) {
    this.syncCurrentSlideFromDOM();
    this.state.theme = themeName;
    this.saveToStorage();
    this.render();
  },

  insertElement(type) {
    this.syncCurrentSlideFromDOM();
    let canvas = document.getElementById('pptActiveSlideCanvas');
    if (!canvas) return;

    const slide = this.getCurrentSlide();
    if (slide && (slide.layout === 'title' || slide.layout === 'quote')) {
      slide.layout = 'title_content';
      if (!slide.content) slide.content = slide.subtitle || '';
      this.setLayout('title_content');
      canvas = document.getElementById('pptActiveSlideCanvas');
      if (window.showToast) window.showToast('İçerik alanı için slayt düzeni "Başlık ve İçerik" yapıldı.');
    }

    const targetContainer = canvas.querySelector('.slide-body-input') || 
                            canvas.querySelector('.slide-col-input') || 
                            canvas;

    if (type === 'textbox') {
      const box = document.createElement('div');
      box.className = 'slide-textbox';
      box.contentEditable = 'true';
      box.style.padding = '8px 12px';
      box.style.margin = '8px 0';
      box.style.border = '1px dashed var(--border-medium, #94A3B8)';
      box.style.borderRadius = '6px';
      box.style.color = 'inherit';
      box.innerHTML = 'Yeni metin kutusu... Buraya yazın.';
      targetContainer.appendChild(box);
      box.focus();
    } else if (type === 'bullet') {
      this.restoreSelection();
      document.execCommand('insertUnorderedList', false, null);
    } else if (type === 'card') {
      const card = document.createElement('div');
      card.className = 'slide-col-card';
      card.contentEditable = 'true';
      card.style.margin = '10px 0';
      card.innerHTML = '<h4>📌 Önemli Not</h4><p>Vurgulamak istediğiniz düşünce veya anahtar bilgi.</p>';
      targetContainer.appendChild(card);
    }
    this.syncCurrentSlideFromDOM();
  },

  insertImage(base64Src) {
    this.syncCurrentSlideFromDOM();
    let canvas = document.getElementById('pptActiveSlideCanvas');
    if (!canvas) return;

    const slide = this.getCurrentSlide();
    if (slide && (slide.layout === 'title' || slide.layout === 'quote')) {
      slide.layout = 'title_content';
      if (!slide.content) slide.content = slide.subtitle || '';
      this.setLayout('title_content');
      canvas = document.getElementById('pptActiveSlideCanvas');
    }

    const targetContainer = canvas.querySelector('.slide-body-input') || 
                            canvas.querySelector('.slide-col-input') || 
                            canvas;

    const img = document.createElement('img');
    img.src = base64Src;
    img.style.maxWidth = '280px';
    img.style.maxHeight = '200px';
    img.style.borderRadius = '8px';
    img.style.margin = '10px auto';
    img.style.display = 'block';
    img.style.boxShadow = '0 6px 16px rgba(0,0,0,0.15)';
    targetContainer.appendChild(img);
    this.syncCurrentSlideFromDOM();
  },

  // ========================================================================
  // Presentation Export & Import Tools
  // ========================================================================
  exportHtml() {
    this.syncCurrentSlideFromDOM();
    const title = this.state.fileName ? this.state.fileName.replace(/\.[^/.]+$/, '') : 'Kalpten_Kaleme_Sunum';
    const slidesJson = JSON.stringify(this.state.slides);
    const theme = this.state.theme || 'theme-clean-light';
    const ratioClass = 'ratio-' + (this.state.aspectRatio || '16:9').replace(':', '-');

    const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Kalpten Kaleme Sunum</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #0B1120;
      color: #fff;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      height: 100vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stage {
      width: 95vw;
      height: 95vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .slide-canvas {
      width: 100%;
      border-radius: 14px;
      padding: 50px 70px;
      display: none;
      flex-direction: column;
      box-shadow: 0 24px 64px rgba(0,0,0,0.6);
      animation: fadeIn 0.25s ease-out;
    }
    .slide-canvas.ratio-16-9 { aspect-ratio: 16 / 9; max-width: 1300px; }
    .slide-canvas.ratio-4-3 { aspect-ratio: 4 / 3; max-width: 1050px; }
    .slide-canvas.ratio-a4-portrait { aspect-ratio: 1 / 1.4142; max-height: 92vh; width: auto; max-width: 650px; }
    .slide-canvas.ratio-a4-landscape { aspect-ratio: 1.4142 / 1; max-width: 1300px; }
    .slide-canvas.active {
      display: flex;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
    /* Themes */
    .theme-luxury-dark { background: linear-gradient(135deg, #090D16, #131A2B); color: #F8FAFC; border: 1px solid rgba(212, 175, 55, 0.3); }
    .theme-clean-light { background: #FFFFFF; color: #1E293B; border: 1px solid #E2E8F0; }
    .theme-sepia-book { background: #FAF7EE; color: #382D23; border: 1px solid #E7DFCB; }
    .theme-sunset { background: linear-gradient(135deg, #431407, #7C2D12); color: #FFEDD5; border: 1px solid rgba(251, 146, 60, 0.4); }
    .theme-emerald { background: linear-gradient(135deg, #022C22, #064E3B); color: #ECFDF5; border: 1px solid rgba(52, 211, 153, 0.4); }
    
    .two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; flex: 1; }
    .col-card { padding: 20px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
    .theme-clean-light .col-card { background: #F8FAFC; border-color: #E2E8F0; }
    .theme-sepia-book .col-card { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08); }

    .hud {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(18, 22, 32, 0.88);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 30px;
      padding: 6px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 1000;
      box-shadow: 0 6px 24px rgba(0,0,0,0.4);
    }
    .hud button {
      background: transparent;
      border: none;
      color: #fff;
      padding: 5px 12px;
      border-radius: 16px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    }
    .hud button:hover { background: rgba(255,255,255,0.15); }
    .counter { font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.8); min-width: 60px; text-align: center; }
  </style>
</head>
<body>
  <div class="stage" id="stage"></div>
  <div class="hud" id="hud">
    <button id="prevBtn" title="Önceki (Sol Ok / PageUp)">◀</button>
    <span class="counter" id="counter">1 / 1</span>
    <button id="nextBtn" title="Sonraki (Sağ Ok / Space / PageDown)">▶</button>
    <button id="fsBtn" title="Tam Ekran (F5)">⛶ Tam Ekran</button>
  </div>
  <script>
    const slides = ${slidesJson};
    const theme = "${theme}";
    const ratioClass = "${ratioClass}";
    let currentIdx = 0;
    const stage = document.getElementById('stage');
    const counter = document.getElementById('counter');

    function renderSlide(idx) {
      if (idx < 0 || idx >= slides.length) return;
      currentIdx = idx;
      const s = slides[idx];
      let inner = '';
      if (s.layout === 'title') {
        inner = '<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;"><h1 style="font-size:52px;font-weight:800;margin-bottom:18px;">' + (s.title||'') + '</h1><p style="font-size:24px;opacity:0.85;">' + (s.subtitle||'') + '</p></div>';
      } else if (s.layout === 'two_col') {
        inner = '<h2 style="font-size:36px;font-weight:800;margin-bottom:20px;">' + (s.title||'') + '</h2><div class="two-cols"><div class="col-card">' + (s.leftCol||'') + '</div><div class="col-card">' + (s.rightCol||'') + '</div></div>';
      } else if (s.layout === 'quote') {
        inner = '<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;"><div style="font-size:72px;opacity:0.3;">“</div><div style="font-size:34px;font-style:italic;line-height:1.5;margin-bottom:18px;">' + (s.quote||'') + '</div><div style="font-size:18px;font-weight:700;">— ' + (s.author||'') + '</div></div>';
      } else {
        inner = '<h2 style="font-size:36px;font-weight:800;margin-bottom:20px;">' + (s.title||'') + '</h2><div style="font-size:20px;line-height:1.8;flex:1;">' + (s.content||'') + '</div>';
      }
      stage.innerHTML = '<div class="slide-canvas ' + theme + ' ' + ratioClass + ' active">' + inner + '</div>';
      counter.textContent = (currentIdx + 1) + ' / ' + slides.length;
    }

    function next() { if (currentIdx < slides.length - 1) renderSlide(currentIdx + 1); }
    function prev() { if (currentIdx > 0) renderSlide(currentIdx - 1); }

    document.getElementById('nextBtn').addEventListener('click', next);
    document.getElementById('prevBtn').addEventListener('click', prev);
    document.getElementById('fsBtn').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
      else if (e.key === 'F5') { e.preventDefault(); if (!document.fullscreenElement) document.documentElement.requestFullscreen(); }
    });

    stage.addEventListener('click', (e) => {
      if (e.clientX > window.innerWidth / 2) next();
      else prev();
    });

    renderSlide(0);
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.html`;
    a.click();
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast(`"${title}.html" bağımsız sunum olarak indirildi.`);
  },

  exportJson() {
    this.syncCurrentSlideFromDOM();
    const title = this.state.fileName ? this.state.fileName.replace(/\.[^/.]+$/, '') : 'Kalpten_Kaleme_Sunum';
    const data = {
      slides: this.state.slides,
      theme: this.state.theme,
      aspectRatio: this.state.aspectRatio || '16:9',
      fileName: this.state.fileName
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.json`;
    a.click();
    URL.revokeObjectURL(url);
    if (window.showToast) window.showToast(`"${title}.json" sunum dosyası indirildi.`);
  },

  exportPrint() {
    this.syncCurrentSlideFromDOM();
    if (window.executeCleanPrint) {
      window.executeCleanPrint();
    } else {
      window.print();
    }
  },

  async savePresentationDocument() {
    this.syncCurrentSlideFromDOM();
    this.saveToStorage();
    const rawName = (this.state.fileName || 'Sunum').replace(/\.[^/.]+$/, '');
    const fileName = `${rawName}.json`;
    const payload = JSON.stringify({
      slides: this.state.slides,
      theme: this.state.theme,
      aspectRatio: this.state.aspectRatio || '16:9',
      fileName: this.state.fileName
    }, null, 2);

    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const wordSaveStatus = document.getElementById('wordSaveStatus');
    try {
      const resp = await fetch('/api/save-document?filename=' + encodeURIComponent(fileName), {
        method: 'POST',
        body: blob
      });
      if (resp.ok) {
        const resData = await resp.json();
        if (resData && resData.success) {
          const timeStr = resData.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          if (wordSaveStatus) {
            if (resData.cloudProvider === 'gdrive' || resData.isGoogleDrive) {
              wordSaveStatus.textContent = `☁️ Drive'a Kaydedildi (${timeStr})`;
            } else if (resData.cloudProvider === 'onedrive') {
              wordSaveStatus.textContent = `☁️ OneDrive'a Kaydedildi (${timeStr})`;
            } else {
              wordSaveStatus.textContent = `💾 Kaydedildi (${timeStr})`;
            }
          }
          if (window.addRecentDocument) {
            window.addRecentDocument(resData.filename || fileName, 'ppt');
          }
          if (window.loadDriveFiles) {
            window.loadDriveFiles();
          }
          if (window.showToast) window.showToast(`"${resData.filename || fileName}" başarıyla kaydedildi.`);
          return true;
        }
      }
    } catch (_) {}

    if (window.AndroidBridge && window.AndroidBridge.saveBase64File) {
      try {
        const bytes = new TextEncoder().encode(payload);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const base64Data = btoa(binary);
        window.AndroidBridge.saveBase64File(fileName, base64Data, 'application/json');
        if (window.addRecentDocument) window.addRecentDocument(fileName, 'ppt');
        if (wordSaveStatus) wordSaveStatus.textContent = '● Telefona Kaydedildi';
        if (window.showToast) window.showToast(`"${fileName}" telefonunuzdaki "Belgeler/Kalpten Kaleme" klasörüne kaydedildi!`);
        return true;
      } catch (_) {}
    }

    if (wordSaveStatus) wordSaveStatus.textContent = '✓ Sunum Kaydedildi';
    if (window.showToast) window.showToast(`"${this.state.fileName || 'Sunum'}" yerel belleğe kaydedildi.`);
    return true;
  },

  async loadFile(file) {
    if (!file) return;
    if (typeof switchTab === 'function') switchTab('pptTab');
    const name = (file.name || '').toLowerCase();
    try {
      if (name.endsWith('.json')) {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data && Array.isArray(data.slides) && data.slides.length > 0) {
          this.state.slides = data.slides;
          this.state.theme = data.theme || 'theme-clean-light';
          this.state.aspectRatio = data.aspectRatio || '16:9';
          this.state.fileName = file.name;
          this.state.currentIndex = 0;
          this.saveToStorage();
          this.render();
          if (window.docManager) {
            window.docManager.onPptLoaded(file.name, this.state);
          }
          if (window.showToast) window.showToast(`"${file.name}" sunumu başarıyla yüklendi.`);
          return;
        }
      }

      if (name.endsWith('.pptx') || name.endsWith('.ppt')) {
        let retries = 25;
        while (!window.JSZip && retries-- > 0) {
          await new Promise(r => setTimeout(r, 80));
        }
        if (window.JSZip) {
          const zip = await window.JSZip.loadAsync(file);
          const slideFiles = Object.keys(zip.files).filter(k => /^ppt\/slides\/slide\d+\.xml$/i.test(k.replace(/\\/g, '/')));
          if (slideFiles.length > 0) {
            slideFiles.sort((a, b) => {
              const na = parseInt(a.replace(/\\/g, '/').match(/\d+/)[0], 10);
              const nb = parseInt(b.replace(/\\/g, '/').match(/\d+/)[0], 10);
              return na - nb;
            });

            const parsedSlides = [];
            for (let i = 0; i < slideFiles.length; i++) {
              const xmlText = await zip.files[slideFiles[i]].async('text');
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
              const textNodes = Array.from(xmlDoc.getElementsByTagName('a:t')).map(t => t.textContent.trim()).filter(Boolean);

              const slideTitle = textNodes[0] || `Slayt ${i + 1}`;
              const slideBullets = textNodes.slice(1);
              let contentHtml = '';
              if (slideBullets.length > 0) {
                contentHtml = '<ul>' + slideBullets.map(b => `<li>${escapeHtml(b)}</li>`).join('') + '</ul>';
              } else {
                contentHtml = '<p>' + escapeHtml(slideTitle) + '</p>';
              }

              parsedSlides.push({
                id: 'slide_' + Date.now() + '_' + i,
                layout: i === 0 ? 'title' : 'title_content',
                title: slideTitle,
                subtitle: i === 0 && slideBullets[0] ? slideBullets[0] : '',
                content: contentHtml,
                leftCol: '',
                rightCol: '',
                quote: '',
                author: ''
              });
            }

            if (parsedSlides.length > 0) {
              this.state.slides = parsedSlides;
              this.state.fileName = file.name;
              this.state.currentIndex = 0;
              this.saveToStorage();
              this.render();
              if (window.docManager) {
                window.docManager.onPptLoaded(file.name, this.state);
              }
              if (window.showToast) window.showToast(`"${file.name}" dosyasından ${parsedSlides.length} slayt aktarıldı.`);
              return;
            }
          }
        }
        if (window.showToast) window.showToast(`"${file.name}" sunum dosyası işlenemedi.`, 'error');
        return;
      }

      // Fallback for txt / markdown
      const rawText = await file.text();
      const sections = rawText.split(/\n(?=# |\n---|===)/).filter(s => s.trim().length > 0);
      if (sections.length > 0) {
        const parsed = sections.map((sec, idx) => {
          const lines = sec.trim().split('\n').filter(l => l.trim().length > 0);
          const title = (lines[0] || `Slayt ${idx + 1}`).replace(/^#+\s*/, '');
          const body = lines.slice(1).join('<br>');
          return {
            id: 'slide_' + Date.now() + '_' + idx,
            layout: idx === 0 ? 'title' : 'title_content',
            title: title,
            subtitle: '',
            content: body ? `<p>${body}</p>` : '',
            leftCol: '',
            rightCol: '',
            quote: '',
            author: ''
          };
        });
        this.state.slides = parsed;
        this.state.fileName = file.name;
        this.state.currentIndex = 0;
        this.saveToStorage();
        this.render();
        if (window.docManager) {
          window.docManager.onPptLoaded(file.name, this.state);
        }
        if (window.showToast) window.showToast(`"${file.name}" dosyasından ${parsed.length} slayt oluşturuldu.`);
      }
    } catch (err) {
      console.error('PPT load failed:', err);
      if (window.showToast) window.showToast('Sunum dosyası okunurken hata oluştu.');
    }
  },

  // ========================================================================
  // Fullscreen Presentation Mode (F5)
  // ========================================================================
  startPresentation() {
    this.syncCurrentSlideFromDOM();
    const overlay = document.getElementById('pptPresentationOverlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Request browser native fullscreen if supported
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    this.renderPresentationSlide();

    // Auto-hide HUD on mouse idle
    let hudTimer;
    overlay.onmousemove = () => {
      overlay.classList.add('show-cursor');
      const hud = document.getElementById('pptHudControls');
      if (hud) hud.style.opacity = '1';
      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => {
        overlay.classList.remove('show-cursor');
        if (hud) hud.style.opacity = '0';
      }, 2500);
    };

    // Mobile touch swipe gestures for presentation mode
    let touchStartX = 0;
    let touchStartY = 0;
    overlay.ontouchstart = (e) => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
      const hud = document.getElementById('pptHudControls');
      if (hud) hud.style.opacity = '1';
      clearTimeout(hudTimer);
      hudTimer = setTimeout(() => {
        if (hud) hud.style.opacity = '0';
      }, 3500);
    };

    overlay.ontouchend = (e) => {
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          this.nextSlide();
        } else {
          this.prevSlide();
        }
      }
    };
  },

  exitPresentation() {
    const overlay = document.getElementById('pptPresentationOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  },

  nextSlide() {
    if (this.state.currentIndex < this.state.slides.length - 1) {
      this.state.currentIndex++;
      this.render();
      this.renderPresentationSlide();
    }
  },

  prevSlide() {
    if (this.state.currentIndex > 0) {
      this.state.currentIndex--;
      this.render();
      this.renderPresentationSlide();
    }
  },

  renderPresentationSlide() {
    const container = document.getElementById('pptPresentationSlide');
    const counter = document.getElementById('pptHudCounter');
    if (!container) return;

    container.className = 'ppt-presentation-slide ' + this.state.theme + ' ratio-' + this.state.aspectRatio.replace(':', '-');
    const slide = this.getCurrentSlide();
    if (!slide) return;

    let contentHtml = '';
    if (slide.layout === 'title') {
      contentHtml = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; text-align: center;">
          <h1 style="font-size: 52px; font-weight: 800; line-height: 1.2; margin-bottom: 20px;">${slide.title || ''}</h1>
          <p style="font-size: 24px; opacity: 0.85; max-width: 800px;">${slide.subtitle || ''}</p>
        </div>
      `;
    } else if (slide.layout === 'two_col') {
      contentHtml = `
        <h2 style="font-size: 38px; font-weight: 800; margin-bottom: 24px;">${slide.title || ''}</h2>
        <div class="slide-two-cols" style="gap: 32px;">
          <div class="slide-col-card" style="padding: 24px; font-size: 20px;">${slide.leftCol || ''}</div>
          <div class="slide-col-card" style="padding: 24px; font-size: 20px;">${slide.rightCol || ''}</div>
        </div>
      `;
    } else if (slide.layout === 'quote') {
      contentHtml = `
        <div class="slide-quote-box" style="height: 100%;">
          <div style="font-size: 80px; opacity: 0.35;">“</div>
          <div style="font-size: 36px; font-style: italic; font-family: Georgia, serif; line-height: 1.5; margin-bottom: 20px;">${slide.quote || ''}</div>
          <div style="font-size: 20px; font-weight: 700; letter-spacing: 1.5px;">— ${slide.author || ''}</div>
        </div>
      `;
    } else {
      contentHtml = `
        <h2 style="font-size: 38px; font-weight: 800; margin-bottom: 24px;">${slide.title || ''}</h2>
        <div style="font-size: 22px; line-height: 1.8; flex: 1;">${slide.content || ''}</div>
      `;
    }

    container.innerHTML = contentHtml;
    if (counter) {
      counter.textContent = `${this.state.currentIndex + 1} / ${this.state.slides.length}`;
    }
  }
};

window.pptEditor = pptEditor;
document.addEventListener('DOMContentLoaded', () => {
  pptEditor.init();
});
