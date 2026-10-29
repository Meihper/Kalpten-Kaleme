/**
 * ============================================================================
 * Kalpten Kaleme - PowerPoint & Sunum Stüdyosu PRO (ppt-editor.js)
 * 8 Profesyonel Düzen, Serbest Sürüklenebilir/Boyutlandırılabilir Kanvas Nesneleri,
 * Şekiller, Diyagramlar, Tablolar, Geçiş Efektleri, Konuşmacı Notları,
 * Canlı Görsel Küçük Resimler, Otomatik Oynatıcılı & Lazer/Kalemli F5 Sunum Modu,
 * Gerçek .PPTX / .HTML / .PDF / .JSON Dışa Aktarım
 * ============================================================================
 */

const pptEditor = {
  state: {
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
    fileName: 'Sunum 1.pptx'
  },

  selectedElementId: null,
  savedSelection: null,
  debounceTimer: null,

  // Presentation Player Runtime State
  presentation: {
    isActive: false,
    autoPlay: false,
    autoSpeedMs: 5000,
    loop: true,
    autoTimer: null,
    progressRaf: null,
    slideStartTime: 0,
    presentationStartTime: 0,
    clockInterval: null,
    laserActive: false,
    penActive: false,
    isDrawing: false,
    lastPenX: 0,
    lastPenY: 0,
    hudTimer: null
  },

  init() {
    this.loadFromStorage();
    this.normalizeSlides();
    this.bindEvents();
    this.render();

    window.addEventListener('resize', () => {
      if (this.state.zoom === 'fit') {
        this.applyZoom();
      }
      this.updateThumbnailScales();
      if (this.presentation.isActive) {
        this.resizeAnnotationCanvas();
      }
    });
  },

  normalizeSlides() {
    if (!Array.isArray(this.state.slides) || this.state.slides.length === 0) {
      this.state.slides = [this.createBlankSlideObj('title')];
    }
    this.state.slides.forEach((s, i) => {
      if (!s.id) s.id = 'slide_' + Date.now() + '_' + i;
      if (!s.layout) s.layout = i === 0 ? 'title' : 'title_content';
      if (!s.transition) s.transition = 'fade';
      if (typeof s.notes !== 'string') s.notes = '';
      if (!Array.isArray(s.elements)) s.elements = [];
      if (typeof s.card1 !== 'string') s.card1 = '';
      if (typeof s.card2 !== 'string') s.card2 = '';
      if (typeof s.card3 !== 'string') s.card3 = '';
    });
    if (this.state.currentIndex < 0 || this.state.currentIndex >= this.state.slides.length) {
      this.state.currentIndex = 0;
    }
  },

  createBlankSlideObj(layout = 'title_content') {
    return {
      id: 'slide_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      layout: layout,
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
    };
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
            this.state.theme = parsed.theme || 'theme-clean-light';
            this.state.aspectRatio = parsed.aspectRatio || '16:9';
            this.state.zoom = parsed.zoom || 100;
            this.state.fileName = parsed.fileName || 'Sunum 1.pptx';
            this.state.currentIndex = 0;
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
    this.syncCurrentSlideFromDOM();
    this.state.aspectRatio = ratio;
    this.saveToStorage();
    this.render();
  },

  setZoom(zoomVal) {
    if (zoomVal === 'fit') {
      this.state.zoom = 'fit';
    } else {
      const num = parseInt(zoomVal, 10) || 100;
      this.state.zoom = Math.max(40, Math.min(160, num));
    }
    this.saveToStorage();
    this.applyZoom();
  },

  stepZoom(delta) {
    const currentNum = this.state.zoom === 'fit' ? 100 : (parseInt(this.state.zoom, 10) || 100);
    const nextNum = Math.max(50, Math.min(150, currentNum + delta));
    this.setZoom(nextNum);
  },

  applyZoom() {
    const wrapper = document.querySelector('.ppt-slide-wrapper');
    const stage = document.querySelector('.ppt-stage');
    const zoomLabel = document.getElementById('pptZoomLabel');
    const zoomSelect = document.getElementById('pptZoomSelect');
    if (!wrapper) return;

    if (this.state.zoom === 'fit') {
      if (stage && stage.clientWidth > 0 && stage.clientHeight > 0) {
        const prevTransform = wrapper.style.transform;
        wrapper.style.transform = 'none';
        const naturalW = wrapper.offsetWidth || 960;
        const naturalH = wrapper.offsetHeight || 540;
        wrapper.style.transform = prevTransform;

        const availW = stage.clientWidth - 36;
        const availH = stage.clientHeight - 36;
        const scaleW = availW / naturalW;
        const scaleH = availH / naturalH;
        const fitScale = Math.min(scaleW, scaleH, 1.15);
        const clamped = Math.max(0.35, Number(fitScale.toFixed(3)));
        wrapper.style.transform = `scale(${clamped})`;
        if (zoomLabel) zoomLabel.textContent = `%${Math.round(clamped * 100)}`;
      } else {
        wrapper.style.transform = 'scale(1)';
        if (zoomLabel) zoomLabel.textContent = '%100';
      }
      if (zoomSelect) zoomSelect.value = 'fit';
    } else {
      const scale = (this.state.zoom / 100);
      wrapper.style.transform = `scale(${scale})`;
      if (zoomLabel) zoomLabel.textContent = `%${this.state.zoom}`;
      if (zoomSelect) zoomSelect.value = this.state.zoom.toString();
    }
  },

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

    canvas.querySelectorAll('.ppt-canvas-el[data-el-id]').forEach(elNode => {
      const elId = elNode.getAttribute('data-el-id');
      const item = (slide.elements || []).find(x => x.id === elId);
      if (item) {
        const contentNode = elNode.querySelector('.ppt-el-content');
        if (contentNode && item.type !== 'image') {
          item.html = contentNode.innerHTML;
        }
      }
    });

    const notesInput = document.getElementById('pptSpeakerNotesInput');
    if (notesInput) {
      slide.notes = notesInput.value || '';
    }

    this.debounceSave();
  },

  closeAllToolbarDropdowns() {
    document.querySelectorAll('#pptToolbar .dropdown-menu').forEach(m => {
      m.style.display = 'none';
    });
  },

  toggleDropdownFixed(btn, menu, alignRight = false, displayMode = 'block') {
    if (!btn || !menu) return;
    const isOpen = menu.style.display === displayMode || menu.style.display === 'block' || menu.style.display === 'grid';
    this.closeAllToolbarDropdowns();
    if (!isOpen) {
      const rect = btn.getBoundingClientRect();
      menu.style.top = `${Math.round(rect.bottom + 6)}px`;
      if (alignRight) {
        menu.style.left = 'auto';
        menu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
      } else {
        const maxLeft = Math.max(8, window.innerWidth - 240);
        menu.style.right = 'auto';
        menu.style.left = `${Math.max(8, Math.min(maxLeft, Math.round(rect.left)))}px`;
      }
      menu.style.display = displayMode;
    }
  },

  bindEvents() {
    document.addEventListener('selectionchange', () => {
      this.saveSelection();
    });

    document.addEventListener('click', () => {
      this.closeAllToolbarDropdowns();
    });

    // Deselect floating element when clicking outside elements on stage
    const stageEl = document.getElementById('pptStage');
    if (stageEl) {
      stageEl.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.ppt-canvas-el') && !e.target.closest('#pptElementInspector')) {
          this.selectCanvasElement(null);
        }
      });
    }

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

    document.getElementById('pptZoomInBtn')?.addEventListener('click', () => this.stepZoom(15));
    document.getElementById('pptZoomOutBtn')?.addEventListener('click', () => this.stepZoom(-15));
    document.getElementById('pptZoomFitBtn')?.addEventListener('click', () => {
      this.setZoom(this.state.zoom === 'fit' ? 100 : 'fit');
    });

    // 1. Add Slide Dropdown
    const addBtn = document.getElementById('pptAddSlideBtn');
    const layoutDropdown = document.getElementById('pptLayoutDropdown');
    if (addBtn && layoutDropdown) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdownFixed(addBtn, layoutDropdown, false, 'block');
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

    // 2. Ready-Made Templates Dropdown
    const templatesBtn = document.getElementById('pptTemplatesBtn');
    const templatesMenu = document.getElementById('pptTemplatesMenu');
    if (templatesBtn && templatesMenu) {
      templatesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdownFixed(templatesBtn, templatesMenu, false, 'block');
      });
      templatesMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const tpl = item.getAttribute('data-template');
          if (tpl) this.loadStarterTemplate(tpl);
          templatesMenu.style.display = 'none';
        });
      });
    }

    // 3. Shapes Dropdown
    const shapeBtn = document.getElementById('pptAddShapeBtn');
    const shapeMenu = document.getElementById('pptShapeMenu');
    if (shapeBtn && shapeMenu) {
      shapeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdownFixed(shapeBtn, shapeMenu, false, 'block');
      });
      shapeMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const shapeType = item.getAttribute('data-shape') || 'rect';
          this.insertFloatingShape(shapeType);
          shapeMenu.style.display = 'none';
        });
      });
    }

    // 4. Diagrams / Cards / Table Dropdown
    const diagramBtn = document.getElementById('pptAddCardBtn');
    const diagramMenu = document.getElementById('pptDiagramMenu');
    if (diagramBtn && diagramMenu) {
      diagramBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdownFixed(diagramBtn, diagramMenu, false, 'block');
      });
      diagramMenu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const elType = item.getAttribute('data-element') || 'card';
          this.insertElement(elType);
          diagramMenu.style.display = 'none';
        });
      });
    }

    // Sidebar Add Slide
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

    // Transition selector
    const transSelect = document.getElementById('pptTransitionSelect');
    if (transSelect) {
      transSelect.addEventListener('change', (e) => {
        const slide = this.getCurrentSlide();
        if (slide) {
          slide.transition = e.target.value;
          this.saveToStorage();
          this.renderThumbnails();
          this.updateCounters();
          this.previewCurrentSlideTransition();
        }
      });
    }

    document.getElementById('pptPreviewTransitionBtn')?.addEventListener('click', () => {
      this.previewCurrentSlideTransition();
    });

    document.getElementById('pptApplyTransitionAllBtn')?.addEventListener('click', () => {
      const slide = this.getCurrentSlide();
      const tr = slide?.transition || 'fade';
      this.state.slides.forEach(s => { s.transition = tr; });
      this.saveToStorage();
      this.renderThumbnails();
      if (window.showToast) window.showToast(`"${this.getTransitionLabel(tr)}" geçiş efekti tüm slaytlara uygulandı.`);
    });

    // Speaker Notes Drawer Toggle & Sync
    const notesDrawer = document.getElementById('pptNotesDrawer');
    const notesInput = document.getElementById('pptSpeakerNotesInput');
    document.getElementById('pptToggleNotesBtn')?.addEventListener('click', () => {
      if (notesDrawer) {
        notesDrawer.classList.toggle('open');
        if (notesDrawer.classList.contains('open')) {
          notesInput?.focus();
        }
        if (this.state.zoom === 'fit') this.applyZoom();
      }
    });
    document.getElementById('pptCloseNotesBtn')?.addEventListener('click', () => {
      notesDrawer?.classList.remove('open');
      if (this.state.zoom === 'fit') this.applyZoom();
    });
    if (notesInput) {
      notesInput.addEventListener('input', (e) => {
        const slide = this.getCurrentSlide();
        if (slide) {
          slide.notes = e.target.value;
          this.debounceSave();
        }
      });
    }

    // Duplicate & Delete slide
    document.getElementById('pptDuplicateSlideBtn')?.addEventListener('click', () => {
      this.duplicateCurrentSlide();
    });
    document.getElementById('pptDeleteSlideBtn')?.addEventListener('click', () => {
      this.deleteCurrentSlide();
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

    // ========================================================================
    // Slide Show Play Triggers (Toolbar, Sidebar, Status Bar, Auto-Play)
    // ========================================================================
    document.getElementById('pptPresentBtn')?.addEventListener('click', () => {
      this.startPresentation({ fromStart: false, autoPlay: false });
    });
    document.getElementById('pptAutoPlayStartBtn')?.addEventListener('click', () => {
      this.startPresentation({ fromStart: true, autoPlay: true });
    });
    document.getElementById('pptSidebarPlayBtn')?.addEventListener('click', () => {
      this.startPresentation({ fromStart: true, autoPlay: false });
    });
    document.getElementById('pptSidebarHeaderPlayBtn')?.addEventListener('click', () => {
      this.startPresentation({ fromStart: false, autoPlay: false });
    });
    document.getElementById('pptPlayFromCurrentBtn')?.addEventListener('click', () => {
      this.startPresentation({ fromStart: false, autoPlay: false });
    });
    document.getElementById('pptPlayFromStartBtn')?.addEventListener('click', () => {
      this.startPresentation({ fromStart: true, autoPlay: false });
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
      } else if (this.selectedElementId) {
        const elNode = document.querySelector(`.ppt-canvas-el[data-el-id="${this.selectedElementId}"] .ppt-el-content`);
        if (elNode) {
          elNode.style.fontSize = e.target.value;
          this.syncCurrentSlideFromDOM();
        }
      }
    });

    // Add Floating Text Box
    document.getElementById('pptAddTextBoxBtn')?.addEventListener('click', () => {
      this.insertElement('textbox');
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

    // Contextual Inspector Bar Actions for Selected Floating Element
    document.querySelectorAll('#pptElementInspector .ppt-el-fill-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const fill = dot.getAttribute('data-fill') || '';
        const border = dot.getAttribute('data-border') || '';
        const color = dot.getAttribute('data-color') || '';
        this.styleSelectedElement({ fill, border, color });
      });
    });
    document.getElementById('pptElBringFrontBtn')?.addEventListener('click', () => this.layerSelectedElement(1));
    document.getElementById('pptElSendBackBtn')?.addEventListener('click', () => this.layerSelectedElement(-1));
    document.getElementById('pptElDuplicateBtn')?.addEventListener('click', () => this.duplicateSelectedElement());
    document.getElementById('pptElDeleteBtn')?.addEventListener('click', () => this.deleteSelectedElement());

    // ========================================================================
    // Fullscreen Presentation HUD Controls
    // ========================================================================
    document.getElementById('pptHudPrevBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.prevSlide();
    });
    document.getElementById('pptHudNextBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.nextSlide();
    });
    document.getElementById('pptHudExitBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.exitPresentation();
    });
    document.getElementById('pptHudAutoPlayBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePresentationAutoPlay();
    });
    document.getElementById('pptHudAutoSpeed')?.addEventListener('change', (e) => {
      e.stopPropagation();
      this.presentation.autoSpeedMs = parseInt(e.target.value, 10) || 5000;
      if (this.presentation.autoPlay) {
        this.restartAutoPlayCycle();
      }
    });
    document.getElementById('pptHudLoopBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.presentation.loop = !this.presentation.loop;
      e.currentTarget.classList.toggle('active', this.presentation.loop);
      if (window.showToast) window.showToast(this.presentation.loop ? 'Döngü modu açık: Sunum sonunda başa döner.' : 'Döngü modu kapalı.');
    });
    document.getElementById('pptHudLaserBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleLaserPointer();
    });
    document.getElementById('pptHudPenBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleAnnotationPen();
    });
    document.getElementById('pptHudClearPenBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearAnnotationCanvas();
    });
    document.getElementById('pptHudGridBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSlideGridOverlay();
    });
    document.getElementById('pptCloseGridOverlayBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSlideGridOverlay(false);
    });
    document.getElementById('pptHudNotesBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePresenterNotesPopup();
    });
    document.getElementById('pptClosePresenterNotesBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePresenterNotesPopup(false);
    });

    // Click on Fullscreen Stage to Advance Slide
    const presContainer = document.getElementById('pptPresentationCanvasContainer');
    if (presContainer) {
      presContainer.addEventListener('click', (e) => {
        if (this.presentation.penActive) return;
        if (e.target.closest('#pptHudControls') || e.target.closest('#pptSlideGridOverlay') || e.target.closest('#pptPresenterNotesPopup')) return;
        const clickX = e.clientX;
        if (clickX < window.innerWidth * 0.22) {
          this.prevSlide();
        } else {
          if (this.state.currentIndex < this.state.slides.length - 1) {
            this.nextSlide();
          } else if (this.presentation.loop) {
            this.state.currentIndex = 0;
            this.render();
            this.renderPresentationSlide();
          } else {
            if (window.showToast) window.showToast('Sunumun son slaytındasınız. Çıkmak için ESC tuşuna veya Çıkış butonuna basın.');
          }
        }
      });
    }

    // Keyboard Shortcuts (F5, Shift+F5, Arrows, Space, L, P, G, N, Delete)
    window.addEventListener('keydown', (e) => {
      const overlay = document.getElementById('pptPresentationOverlay');
      const isPresenting = overlay && overlay.style.display !== 'none';

      if (e.key === 'F5') {
        e.preventDefault();
        if (isPresenting) {
          this.exitPresentation();
        } else {
          this.startPresentation({ fromStart: !e.shiftKey, autoPlay: false });
        }
        return;
      }

      if (isPresenting) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.nextSlide();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          this.prevSlide();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.exitPresentation();
        } else if (e.key.toLowerCase() === 'l') {
          this.toggleLaserPointer();
        } else if (e.key.toLowerCase() === 'p') {
          this.toggleAnnotationPen();
        } else if (e.key.toLowerCase() === 'g') {
          this.toggleSlideGridOverlay();
        } else if (e.key.toLowerCase() === 'n') {
          this.togglePresenterNotesPopup();
        }
        return;
      }

      // In Editor Mode: Delete selected floating element if not actively typing inside an input/editable
      const activeEl = document.activeElement;
      const isTyping = activeEl && (activeEl.isContentEditable || activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (!isTyping && this.selectedElementId && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        this.deleteSelectedElement();
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

    // Color menu toggle & dots
    const colorBtn = document.getElementById('pptTextColorBtn');
    const colorMenu = document.getElementById('pptColorMenu');
    const colorBar = document.getElementById('pptTextColorBar');
    if (colorBtn && colorMenu) {
      colorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdownFixed(colorBtn, colorMenu, false, 'grid');
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

    // Export Dropdown & actions
    const exportBtn = document.getElementById('pptExportDropdownBtn');
    const exportMenu = document.getElementById('pptExportMenu');
    if (exportBtn && exportMenu) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDropdownFixed(exportBtn, exportMenu, true, 'block');
      });
      document.getElementById('pptExportPptxBtn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        exportMenu.style.display = 'none';
        this.exportPptx();
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

  getTransitionLabel(tr) {
    const map = {
      fade: 'Yumuşak',
      slide: 'Kaydır',
      zoom: 'Yakınlaş',
      flip: '3B Dönüş',
      reveal: 'Perde',
      none: 'Keskin'
    };
    return map[tr] || 'Yumuşak';
  },

  getLayoutLabel(layout) {
    const map = {
      title: 'Kapak Başlık',
      title_content: 'Başlık & İçerik',
      two_col: 'İki Sütunlu',
      three_cards: "3'lü Kartlar",
      split_media: 'Görsel + Metin',
      metrics: 'İstatistik (KPI)',
      quote: 'Edebi Alıntı',
      blank: 'Boş Kanvas'
    };
    return map[layout] || 'Başlık & İçerik';
  },

  // ========================================================================
  // Unified Slide HTML Builder (Used by Editor, Thumbnails, Player, HTML & PDF)
  // ========================================================================
  buildStaticSlideHtml(slide, forPresentation = false) {
    if (!slide) return '';
    const titleSz = forPresentation ? '48px' : '34px';
    const subSz = forPresentation ? '22px' : '18px';
    const h2Sz = forPresentation ? '36px' : '28px';
    const bodySz = forPresentation ? '20px' : '16px';

    let layoutHtml = '';
    if (slide.layout === 'title') {
      layoutHtml = `
        <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;text-align:center;padding:16px;position:relative;z-index:5;">
          <div style="width:56px;height:4px;border-radius:99px;background:currentColor;opacity:0.35;margin-bottom:18px;"></div>
          <div style="font-size:${titleSz};font-weight:800;line-height:1.2;margin-bottom:14px;max-width:85%;">${slide.title || '<span style="opacity:0.4;">Sunum Başlığı</span>'}</div>
          <div style="font-size:${subSz};opacity:0.82;line-height:1.45;max-width:75%;">${slide.subtitle || ''}</div>
        </div>
      `;
    } else if (slide.layout === 'two_col') {
      layoutHtml = `
        <div style="font-size:${h2Sz};font-weight:800;margin-bottom:16px;line-height:1.22;position:relative;z-index:5;">${slide.title || ''}</div>
        <div class="slide-two-cols" style="font-size:${bodySz};">
          <div class="slide-col-card">${slide.leftCol || ''}</div>
          <div class="slide-col-card">${slide.rightCol || ''}</div>
        </div>
      `;
    } else if (slide.layout === 'three_cards') {
      layoutHtml = `
        <div style="font-size:${h2Sz};font-weight:800;margin-bottom:16px;line-height:1.22;position:relative;z-index:5;">${slide.title || ''}</div>
        <div class="slide-three-cards" style="font-size:${forPresentation ? '17px' : '14.5px'};">
          <div class="slide-col-card">${slide.card1 || ''}</div>
          <div class="slide-col-card">${slide.card2 || ''}</div>
          <div class="slide-col-card">${slide.card3 || ''}</div>
        </div>
      `;
    } else if (slide.layout === 'split_media') {
      layoutHtml = `
        <div style="font-size:${h2Sz};font-weight:800;margin-bottom:16px;line-height:1.22;position:relative;z-index:5;">${slide.title || ''}</div>
        <div class="slide-split-media" style="font-size:${bodySz};">
          <div class="slide-col-card" style="justify-content:center;align-items:center;text-align:center;">${slide.leftCol || ''}</div>
          <div class="slide-col-card">${slide.rightCol || ''}</div>
        </div>
      `;
    } else if (slide.layout === 'metrics') {
      layoutHtml = `
        <div style="font-size:${h2Sz};font-weight:800;margin-bottom:16px;line-height:1.22;position:relative;z-index:5;">${slide.title || ''}</div>
        <div class="slide-metrics-grid">
          <div class="slide-kpi-card">${slide.card1 || ''}</div>
          <div class="slide-kpi-card">${slide.card2 || ''}</div>
          <div class="slide-kpi-card">${slide.card3 || ''}</div>
        </div>
      `;
    } else if (slide.layout === 'quote') {
      layoutHtml = `
        <div class="slide-quote-box" style="height:100%;">
          <div style="font-size:${forPresentation ? '72px' : '56px'};line-height:1;opacity:0.32;font-family:Georgia,serif;">“</div>
          <div class="slide-quote-text" style="font-size:${forPresentation ? '32px' : '24px'};">${slide.quote || ''}</div>
          <div class="slide-quote-author" style="font-size:${forPresentation ? '18px' : '14px'};">${slide.author ? '— ' + slide.author : ''}</div>
        </div>
      `;
    } else if (slide.layout === 'blank') {
      layoutHtml = `
        <div style="font-size:${bodySz};line-height:1.65;flex:1;height:100%;position:relative;z-index:5;">${slide.content || ''}</div>
      `;
    } else {
      layoutHtml = `
        <div style="font-size:${h2Sz};font-weight:800;margin-bottom:14px;line-height:1.22;position:relative;z-index:5;">${slide.title || ''}</div>
        <div style="font-size:${bodySz};line-height:1.68;flex:1;position:relative;z-index:5;">${slide.content || ''}</div>
      `;
    }

    // Append Floating Elements Layer
    const elementsHtml = (slide.elements || []).map(el => {
      const styleStr = [
        `left:${el.x ?? 15}%`,
        `top:${el.y ?? 25}%`,
        `width:${el.w ?? 30}%`,
        `height:${el.h ?? 22}%`,
        `z-index:${el.zIndex || 20}`,
        el.fill ? `background:${el.fill}` : '',
        el.border ? `border:2px solid ${el.border}` : '',
        el.color ? `color:${el.color}` : ''
      ].filter(Boolean).join(';');

      const shapeClass = el.type === 'shape' ? `ppt-shape-${el.shapeType || 'rect'}` : '';
      let inner = '';
      if (el.type === 'image') {
        inner = `<img src="${el.src || ''}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;display:block;" alt="">`;
      } else {
        inner = `<div class="ppt-el-content ${shapeClass}" style="${el.fill ? `background:${el.fill};` : ''}${el.border ? `border-color:${el.border};` : ''}${el.color ? `color:${el.color} !important;` : ''}">${el.html || ''}</div>`;
      }
      return `<div class="ppt-canvas-el" style="${styleStr};pointer-events:none;">${inner}</div>`;
    }).join('');

    return `${layoutHtml}<div class="ppt-elements-layer">${elementsHtml}</div>`;
  },

  render() {
    this.renderThumbnails();
    this.renderActiveSlide();
    this.updateCounters();
    this.updateInspectorUI();
  },

  renderThumbnails() {
    const track = document.getElementById('pptThumbnailsTrack');
    if (!track) return;
    track.innerHTML = '';

    const ratioClass = 'ratio-' + this.state.aspectRatio.replace(':', '-');

    this.state.slides.forEach((slide, idx) => {
      const card = document.createElement('div');
      card.className = 'ppt-thumbnail-card' + (idx === this.state.currentIndex ? ' active' : '');
      card.addEventListener('click', () => {
        this.selectSlide(idx);
      });

      const numBadge = document.createElement('div');
      numBadge.className = 'ppt-thumb-num';
      numBadge.textContent = (idx + 1);

      const transBadge = document.createElement('div');
      transBadge.className = 'ppt-thumb-trans-badge';
      transBadge.textContent = `✨ ${this.getTransitionLabel(slide.transition || 'fade')}`;

      const inner = document.createElement('div');
      inner.className = `ppt-thumb-inner ${this.state.theme} ${ratioClass}`;

      const scaledStage = document.createElement('div');
      scaledStage.className = `ppt-thumb-scaled-stage ${this.state.theme}`;
      scaledStage.innerHTML = this.buildStaticSlideHtml(slide, false);

      inner.appendChild(scaledStage);
      card.appendChild(numBadge);
      card.appendChild(transBadge);
      card.appendChild(inner);
      track.appendChild(card);
    });

    requestAnimationFrame(() => this.updateThumbnailScales());
  },

  updateThumbnailScales() {
    document.querySelectorAll('#pptThumbnailsTrack .ppt-thumb-inner').forEach(inner => {
      const stage = inner.querySelector('.ppt-thumb-scaled-stage');
      if (!stage) return;
      const w = inner.clientWidth || 184;
      const h = inner.clientHeight || 104;
      const scaleX = w / 960;
      const scaleY = h / 540;
      const scale = Math.min(scaleX, scaleY);
      stage.style.transform = `scale(${scale.toFixed(4)})`;
    });
  },

  renderActiveSlide() {
    const canvas = document.getElementById('pptActiveSlideCanvas');
    if (!canvas) return;

    const wrapper = document.querySelector('.ppt-slide-wrapper');
    if (wrapper) {
      wrapper.className = 'ppt-slide-wrapper ratio-' + this.state.aspectRatio.replace(':', '-');
      this.applyZoom();
    }

    const aspectSelect = document.getElementById('pptAspectSelect');
    if (aspectSelect) aspectSelect.value = this.state.aspectRatio;

    const themeSelect = document.getElementById('pptThemeSelect');
    if (themeSelect) themeSelect.value = this.state.theme;

    canvas.className = 'ppt-slide-canvas ' + this.state.theme;

    const slide = this.getCurrentSlide();
    if (!slide) return;

    let html = '';

    if (slide.layout === 'title') {
      html = `
        <div style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100%; text-align: center; padding: 20px; position: relative; z-index: 5;">
          <div style="width: 56px; height: 4px; border-radius: 99px; background: currentColor; opacity: 0.35; margin-bottom: 16px;"></div>
          <div class="slide-title-input" contenteditable="true" spellcheck="false" data-field="title" style="font-size: 42px; max-width: 820px;">${slide.title || ''}</div>
          <div class="slide-subtitle-input" contenteditable="true" spellcheck="false" data-field="subtitle" style="font-size: 20px; max-width: 680px;">${slide.subtitle || ''}</div>
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
    } else if (slide.layout === 'three_cards') {
      html = `
        <div class="slide-title-input" contenteditable="true" spellcheck="false" data-field="title">${slide.title || ''}</div>
        <div class="slide-three-cards">
          <div class="slide-col-card">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="card1" style="outline: none; flex: 1;">${slide.card1 || '<h4>01 • Birinci Adım</h4><p>Temel kavramları ve hedefleri buraya yazın.</p>'}</div>
          </div>
          <div class="slide-col-card">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="card2" style="outline: none; flex: 1;">${slide.card2 || '<h4>02 • İkinci Adım</h4><p>Uygulama süreci ve yöntemleri açıklayın.</p>'}</div>
          </div>
          <div class="slide-col-card">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="card3" style="outline: none; flex: 1;">${slide.card3 || '<h4>03 • Üçüncü Adım</h4><p>Elde edilen kazanımları ve sonuçları özetleyin.</p>'}</div>
          </div>
        </div>
      `;
    } else if (slide.layout === 'split_media') {
      html = `
        <div class="slide-title-input" contenteditable="true" spellcheck="false" data-field="title">${slide.title || ''}</div>
        <div class="slide-split-media">
          <div class="slide-col-card" style="justify-content: center; align-items: center; text-align: center;">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="leftCol" style="outline: none; width: 100%;">${slide.leftCol || '<div style="font-size:42px;margin-bottom:8px;">🖼️</div><h4>Görsel veya Ana Vurgu Alanı</h4><p style="font-size:13px;opacity:0.75;">Yukarıdaki "Görsel" butonuna tıklayarak fotoğraf ekleyebilir veya bu alanı düzenleyebilirsiniz.</p>'}</div>
          </div>
          <div class="slide-col-card">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="rightCol" style="outline: none; flex: 1;">${slide.rightCol || '<h4>Detaylı Açıklama</h4><ul><li>Anahtar bulgu ve analiz maddesi</li><li>Destekleyici veri veya örnek</li><li>Uygulama önerisi</li></ul>'}</div>
          </div>
        </div>
      `;
    } else if (slide.layout === 'metrics') {
      html = `
        <div class="slide-title-input" contenteditable="true" spellcheck="false" data-field="title">${slide.title || ''}</div>
        <div class="slide-metrics-grid">
          <div class="slide-kpi-card">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="card1" style="outline: none; width: 100%;">${slide.card1 || '<div style="font-size:44px;font-weight:900;color:#2563EB;line-height:1.1;">%96</div><div style="font-weight:700;margin-top:8px;">Memnuniyet Oranı</div><div style="font-size:12px;opacity:0.7;margin-top:4px;">Yıllık artış +14%</div>'}</div>
          </div>
          <div class="slide-kpi-card">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="card2" style="outline: none; width: 100%;">${slide.card2 || '<div style="font-size:44px;font-weight:900;color:#10B981;line-height:1.1;">3.4x</div><div style="font-weight:700;margin-top:8px;">Verimlilik Artışı</div><div style="font-size:12px;opacity:0.7;margin-top:4px;">Hedeflerin üzerinde</div>'}</div>
          </div>
          <div class="slide-kpi-card">
            <div class="slide-col-input" contenteditable="true" spellcheck="false" data-field="card3" style="outline: none; width: 100%;">${slide.card3 || '<div style="font-size:44px;font-weight:900;color:#F59E0B;line-height:1.1;">24/7</div><div style="font-weight:700;margin-top:8px;">Kesintisiz Erişim</div><div style="font-size:12px;opacity:0.7;margin-top:4px;">Bulut ve çevrimdışı</div>'}</div>
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
      html = `
        <div class="slide-title-input" contenteditable="true" spellcheck="false" data-field="title">${slide.title || ''}</div>
        <div class="slide-body-input" contenteditable="true" spellcheck="false" data-field="content">${slide.content || ''}</div>
      `;
    }

    // Add interactive floating elements layer
    html += `<div class="ppt-elements-layer" id="pptElementsLayer"></div>`;
    canvas.innerHTML = html;

    this.renderFloatingElementsOnCanvas();

    // Sync layout, transition, and speaker notes inputs
    const layoutSel = document.getElementById('pptCurrentLayoutSelect');
    if (layoutSel) layoutSel.value = slide.layout || 'title_content';

    const transSel = document.getElementById('pptTransitionSelect');
    if (transSel) transSel.value = slide.transition || 'fade';

    const notesInput = document.getElementById('pptSpeakerNotesInput');
    if (notesInput) notesInput.value = slide.notes || '';

    // Attach live sync input handlers for structured fields
    canvas.querySelectorAll('[contenteditable="true"][data-field]').forEach(el => {
      el.addEventListener('focus', () => {
        this.selectCanvasElement(null);
      });
      el.addEventListener('input', () => {
        const field = el.getAttribute('data-field');
        if (field && slide) {
          slide[field] = el.innerHTML;
          this.debounceSave();
        }
      });
    });
  },

  // ========================================================================
  // Interactive Draggable & Resizable Canvas Elements Engine
  // ========================================================================
  renderFloatingElementsOnCanvas() {
    const layer = document.getElementById('pptElementsLayer');
    const slide = this.getCurrentSlide();
    if (!layer || !slide) return;
    layer.innerHTML = '';

    if (!Array.isArray(slide.elements)) slide.elements = [];

    slide.elements.forEach(el => {
      const node = document.createElement('div');
      node.className = 'ppt-canvas-el' + (el.id === this.selectedElementId ? ' selected' : '');
      node.setAttribute('data-el-id', el.id);
      node.style.left = `${el.x ?? 15}%`;
      node.style.top = `${el.y ?? 25}%`;
      node.style.width = `${el.w ?? 30}%`;
      node.style.height = `${el.h ?? 22}%`;
      node.style.zIndex = (el.zIndex || 20).toString();
      if (el.fill && el.type !== 'shape') node.style.background = el.fill;
      if (el.border && el.type !== 'shape') node.style.border = `2px solid ${el.border}`;
      if (el.color) node.style.color = el.color;

      // Top Drag Handle
      const dragHandle = document.createElement('div');
      dragHandle.className = 'ppt-el-drag-handle';
      dragHandle.innerHTML = '✥ Sürükle / Taşı';
      dragHandle.addEventListener('mousedown', (e) => this.startDragOrResize(e, el, 'move'));

      // Quick Delete Button
      const delBtn = document.createElement('button');
      delBtn.className = 'ppt-el-quick-del';
      delBtn.innerHTML = '✕';
      delBtn.title = 'Nesneyi Sil';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedElementId = el.id;
        this.deleteSelectedElement();
      });

      // Content Container
      const content = document.createElement('div');
      const shapeClass = el.type === 'shape' ? `ppt-shape-${el.shapeType || 'rect'}` : '';
      content.className = `ppt-el-content ${shapeClass}`;
      if (el.fill) content.style.background = el.fill;
      if (el.border) content.style.borderColor = el.border;
      if (el.color) content.style.color = el.color;

      if (el.type === 'image') {
        content.innerHTML = `<img src="${el.src || ''}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;pointer-events:none;display:block;" alt="Slayt Görseli">`;
        content.style.cursor = 'move';
        content.addEventListener('mousedown', (e) => this.startDragOrResize(e, el, 'move'));
      } else {
        content.contentEditable = 'true';
        content.spellcheck = false;
        content.innerHTML = el.html || '';
        content.addEventListener('input', () => {
          el.html = content.innerHTML;
          this.debounceSave();
        });
      }

      node.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        if (this.selectedElementId !== el.id) {
          this.selectCanvasElement(el.id);
        }
        // Allow dragging by clicking the border/frame
        if (e.target === node) {
          this.startDragOrResize(e, el, 'move');
        }
      });

      node.appendChild(dragHandle);
      node.appendChild(delBtn);
      node.appendChild(content);

      // 8 Resize Handles
      ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(dir => {
        const h = document.createElement('div');
        h.className = `ppt-resize-handle ${dir}`;
        h.addEventListener('mousedown', (e) => this.startDragOrResize(e, el, dir));
        node.appendChild(h);
      });

      layer.appendChild(node);
    });
  },

  selectCanvasElement(elId) {
    this.selectedElementId = elId;
    document.querySelectorAll('#pptActiveSlideCanvas .ppt-canvas-el').forEach(node => {
      node.classList.toggle('selected', node.getAttribute('data-el-id') === elId);
    });
    this.updateInspectorUI();
  },

  updateInspectorUI() {
    const inspector = document.getElementById('pptElementInspector');
    if (!inspector) return;
    const slide = this.getCurrentSlide();
    const hasSelected = !!(slide && this.selectedElementId && (slide.elements || []).some(e => e.id === this.selectedElementId));
    inspector.style.display = hasSelected ? 'flex' : 'none';
  },

  startDragOrResize(e, el, mode) {
    e.stopPropagation();
    e.preventDefault();
    this.selectCanvasElement(el.id);

    const canvas = document.getElementById('pptActiveSlideCanvas');
    const node = document.querySelector(`.ppt-canvas-el[data-el-id="${el.id}"]`);
    if (!canvas || !node) return;

    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x ?? 15;
    const origY = el.y ?? 25;
    const origW = el.w ?? 30;
    const origH = el.h ?? 22;

    const onMove = (me) => {
      const dxPct = ((me.clientX - startX) / rect.width) * 100;
      const dyPct = ((me.clientY - startY) / rect.height) * 100;

      if (mode === 'move') {
        el.x = Math.max(0, Math.min(96 - origW, Number((origX + dxPct).toFixed(2))));
        el.y = Math.max(0, Math.min(96 - origH, Number((origY + dyPct).toFixed(2))));
      } else {
        let nx = origX;
        let ny = origY;
        let nw = origW;
        let nh = origH;

        if (mode.includes('e')) nw = Math.max(8, Math.min(100 - origX, origW + dxPct));
        if (mode.includes('s')) nh = Math.max(8, Math.min(100 - origY, origH + dyPct));
        if (mode.includes('w')) {
          const possibleW = origW - dxPct;
          if (possibleW >= 8) {
            nw = possibleW;
            nx = Math.max(0, origX + dxPct);
          }
        }
        if (mode.includes('n')) {
          const possibleH = origH - dyPct;
          if (possibleH >= 8) {
            nh = possibleH;
            ny = Math.max(0, origY + dyPct);
          }
        }
        el.x = Number(nx.toFixed(2));
        el.y = Number(ny.toFixed(2));
        el.w = Number(nw.toFixed(2));
        el.h = Number(nh.toFixed(2));
      }

      node.style.left = `${el.x}%`;
      node.style.top = `${el.y}%`;
      node.style.width = `${el.w}%`;
      node.style.height = `${el.h}%`;
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      this.debounceSave();
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  },

  styleSelectedElement({ fill, border, color }) {
    const slide = this.getCurrentSlide();
    if (!slide || !this.selectedElementId) return;
    const el = (slide.elements || []).find(x => x.id === this.selectedElementId);
    if (!el) return;
    el.fill = fill;
    el.border = border;
    if (color) el.color = color;
    this.renderFloatingElementsOnCanvas();
    this.debounceSave();
  },

  layerSelectedElement(dir) {
    const slide = this.getCurrentSlide();
    if (!slide || !this.selectedElementId) return;
    const el = (slide.elements || []).find(x => x.id === this.selectedElementId);
    if (!el) return;
    el.zIndex = Math.max(6, Math.min(60, (el.zIndex || 20) + dir * 5));
    this.renderFloatingElementsOnCanvas();
    this.debounceSave();
  },

  duplicateSelectedElement() {
    const slide = this.getCurrentSlide();
    if (!slide || !this.selectedElementId) return;
    const el = (slide.elements || []).find(x => x.id === this.selectedElementId);
    if (!el) return;
    const copy = JSON.parse(JSON.stringify(el));
    copy.id = 'el_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    copy.x = Math.min(85, (copy.x || 15) + 4);
    copy.y = Math.min(85, (copy.y || 25) + 4);
    slide.elements.push(copy);
    this.selectedElementId = copy.id;
    this.renderFloatingElementsOnCanvas();
    this.updateInspectorUI();
    this.debounceSave();
  },

  deleteSelectedElement() {
    const slide = this.getCurrentSlide();
    if (!slide || !this.selectedElementId) return;
    slide.elements = (slide.elements || []).filter(x => x.id !== this.selectedElementId);
    this.selectedElementId = null;
    this.renderFloatingElementsOnCanvas();
    this.updateInspectorUI();
    this.debounceSave();
  },

  insertFloatingShape(shapeType = 'rect') {
    this.syncCurrentSlideFromDOM();
    const slide = this.getCurrentSlide();
    if (!slide) return;
    if (!Array.isArray(slide.elements)) slide.elements = [];

    const defaults = {
      rect:    { w: 28, h: 18, html: '<div>Dikdörtgen Başlık</div>' },
      pill:    { w: 24, h: 12, html: '<div>✨ Önemli Rozet</div>' },
      circle:  { w: 18, h: 30, html: '<div>01</div>' },
      arrow:   { w: 28, h: 14, html: '<div>Sonraki Aşama</div>' },
      callout: { w: 34, h: 20, html: '<div>💡 <b>İpucu:</b> Buraya vurgu notunuzu yazın.</div>' },
      star:    { w: 22, h: 16, html: '<div>★ Öne Çıkan</div>' }
    };
    const cfg = defaults[shapeType] || defaults.rect;
    const offset = (slide.elements.length % 5) * 3;

    const newEl = {
      id: 'el_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      type: 'shape',
      shapeType: shapeType,
      x: 32 + offset,
      y: 34 + offset,
      w: cfg.w,
      h: cfg.h,
      html: cfg.html,
      fill: '',
      border: '',
      color: '',
      zIndex: 25 + slide.elements.length
    };

    slide.elements.push(newEl);
    this.selectedElementId = newEl.id;
    this.renderFloatingElementsOnCanvas();
    this.updateInspectorUI();
    this.debounceSave();
    if (window.showToast) window.showToast('Şekil eklendi. Üstteki mavi tutamaçtan sürükleyebilir veya köşelerinden boyutlandırabilirsiniz.');
  },

  insertElement(type) {
    this.syncCurrentSlideFromDOM();
    const slide = this.getCurrentSlide();
    if (!slide) return;
    if (!Array.isArray(slide.elements)) slide.elements = [];

    if (type === 'bullet') {
      const canvas = document.getElementById('pptActiveSlideCanvas');
      const bodyField = canvas?.querySelector('.slide-body-input, .slide-col-input');
      if (bodyField) {
        bodyField.focus();
        document.execCommand('insertUnorderedList', false, null);
        this.syncCurrentSlideFromDOM();
        return;
      }
    }

    const offset = (slide.elements.length % 5) * 3;
    let newEl = null;

    if (type === 'textbox') {
      newEl = {
        id: 'el_' + Date.now(),
        type: 'textbox',
        x: 22 + offset,
        y: 30 + offset,
        w: 38,
        h: 20,
        html: '<div style="padding:10px 14px;font-size:18px;font-weight:600;">Serbest Metin Kutusu — İstediğiniz yere sürükleyin</div>',
        fill: 'rgba(37, 99, 235, 0.06)',
        border: '#93C5FD',
        zIndex: 25 + slide.elements.length
      };
    } else if (type === 'card') {
      newEl = {
        id: 'el_' + Date.now(),
        type: 'card',
        x: 25 + offset,
        y: 28 + offset,
        w: 42,
        h: 28,
        html: '<div style="padding:14px 18px;"><h4 style="margin-bottom:6px;font-size:18px;">📌 Önemli Bilgi Kartı</h4><p style="font-size:14px;opacity:0.85;">Vurgulamak istediğiniz anahtar düşünceyi veya açıklamayı buraya yazın.</p></div>',
        fill: 'rgba(15, 23, 42, 0.05)',
        border: '#CBD5E1',
        zIndex: 25 + slide.elements.length
      };
    } else if (type === 'kpi') {
      newEl = {
        id: 'el_' + Date.now(),
        type: 'kpi',
        x: 34 + offset,
        y: 28 + offset,
        w: 28,
        h: 28,
        html: '<div style="text-align:center;padding:12px;"><div style="font-size:42px;font-weight:900;color:#10B981;line-height:1.1;">%98.4</div><div style="font-weight:700;font-size:15px;margin-top:6px;">Başarı Gösterge Değeri</div><div style="font-size:12px;opacity:0.75;margin-top:2px;">▲ Geçen döneme göre +18%</div></div>',
        fill: 'rgba(16, 185, 129, 0.1)',
        border: '#10B981',
        zIndex: 25 + slide.elements.length
      };
    } else if (type === 'process') {
      newEl = {
        id: 'el_' + Date.now(),
        type: 'process',
        x: 10,
        y: 56,
        w: 80,
        h: 24,
        html: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px;align-items:center;text-align:center;">
          <div style="background:rgba(37,99,235,0.12);border:1px solid #3B82F6;border-radius:8px;padding:10px;"><b>1. Analiz</b><div style="font-size:12px;opacity:0.8;">Veri toplama</div></div>
          <div style="background:rgba(16,185,129,0.12);border:1px solid #10B981;border-radius:8px;padding:10px;"><b>2. Geliştirme</b><div style="font-size:12px;opacity:0.8;">Uygulama süreci</div></div>
          <div style="background:rgba(245,158,11,0.12);border:1px solid #F59E0B;border-radius:8px;padding:10px;"><b>3. Sonuç</b><div style="font-size:12px;opacity:0.8;">Değerlendirme</div></div>
        </div>`,
        fill: 'transparent',
        border: 'transparent',
        zIndex: 25 + slide.elements.length
      };
    } else if (type === 'table') {
      newEl = {
        id: 'el_' + Date.now(),
        type: 'table',
        x: 14,
        y: 32,
        w: 72,
        h: 38,
        html: `<table style="width:100%;height:100%;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:rgba(37,99,235,0.15);">
              <th style="border:1px solid rgba(148,163,184,0.4);padding:8px;text-align:left;">Kategori / Kriter</th>
              <th style="border:1px solid rgba(148,163,184,0.4);padding:8px;text-align:left;">Mevcut Durum</th>
              <th style="border:1px solid rgba(148,163,184,0.4);padding:8px;text-align:left;">Hedeflenen</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border:1px solid rgba(148,163,184,0.35);padding:8px;">Performans</td>
              <td style="border:1px solid rgba(148,163,184,0.35);padding:8px;">Standart</td>
              <td style="border:1px solid rgba(148,163,184,0.35);padding:8px;font-weight:700;color:#10B981;">Yüksek Hız</td>
            </tr>
            <tr>
              <td style="border:1px solid rgba(148,163,184,0.35);padding:8px;">Kapsam</td>
              <td style="border:1px solid rgba(148,163,184,0.35);padding:8px;">Bölgesel</td>
              <td style="border:1px solid rgba(148,163,184,0.35);padding:8px;font-weight:700;color:#2563EB;">Ulusal & Küresel</td>
            </tr>
          </tbody>
        </table>`,
        fill: 'transparent',
        border: 'transparent',
        zIndex: 25 + slide.elements.length
      };
    }

    if (newEl) {
      slide.elements.push(newEl);
      this.selectedElementId = newEl.id;
      this.renderFloatingElementsOnCanvas();
      this.updateInspectorUI();
      this.debounceSave();
      if (window.showToast) window.showToast('Bileşen eklendi. İstediğiniz yere sürükleyebilir ve boyutlandırabilirsiniz.');
    }
  },

  insertImage(base64Src) {
    this.syncCurrentSlideFromDOM();
    const slide = this.getCurrentSlide();
    if (!slide) return;
    if (!Array.isArray(slide.elements)) slide.elements = [];

    const newEl = {
      id: 'el_' + Date.now(),
      type: 'image',
      src: base64Src,
      x: 28,
      y: 24,
      w: 44,
      h: 48,
      html: '',
      fill: 'transparent',
      border: 'transparent',
      zIndex: 30 + slide.elements.length
    };

    slide.elements.push(newEl);
    this.selectedElementId = newEl.id;
    this.renderFloatingElementsOnCanvas();
    this.updateInspectorUI();
    this.debounceSave();
    if (window.showToast) window.showToast('Görsel eklendi. Sürükleyerek taşıyabilir, köşelerinden boyutlandırabilirsiniz.');
  },

  // ========================================================================
  // Ready-Made Multi-Slide Starter Templates
  // ========================================================================
  loadStarterTemplate(templateName) {
    if (templateName === 'reset_blank') {
      this.state.slides = [this.createBlankSlideObj('title')];
      this.state.currentIndex = 0;
      this.selectedElementId = null;
      this.saveToStorage();
      this.render();
      if (window.showToast) window.showToast('Temiz boş sunum başlatıldı.');
      return;
    }

    if (templateName === 'pitch') {
      this.state.theme = 'theme-clean-light';
      this.state.slides = [
        {
          id: 's_pitch_1',
          layout: 'title',
          transition: 'zoom',
          title: 'Yeni Nesil Strateji & Proje Sunumu',
          subtitle: 'Vizyon, Yol Haritası ve Temel Performans Göstergeleri',
          notes: 'Açılış konuşması: Projenin ana amacını ve çözdüğü temel problemi vurgula.',
          elements: []
        },
        {
          id: 's_pitch_2',
          layout: 'two_col',
          transition: 'slide',
          title: 'Mevcut Durum ve Çözüm Önerimiz',
          leftCol: '<h4>⚠️ Mevcut Zorluklar</h4><ul><li>Dağınık iş akışları ve zaman kaybı</li><li>Yüksek operasyonel maliyetler</li><li>Veri takibinde yaşanan kopukluklar</li></ul>',
          rightCol: '<h4>✅ Önerilen Çözüm</h4><ul><li>Tek merkezden bütünleşik yönetim</li><li>%40 daha hızlı süreç tamamlama</li><li>Gerçek zamanlı raporlama ve analiz</li></ul>',
          notes: 'İki sütunu karşılaştırırken somut zaman tasarrufu örneklerini paylaş.',
          elements: []
        },
        {
          id: 's_pitch_3',
          layout: 'three_cards',
          transition: 'fade',
          title: '3 Aşamalı Uygulama Yol Haritası',
          card1: '<h4>01 • Hazırlık & Analiz</h4><p>İhtiyaçların belirlenmesi, altyapı kurulumu ve ekip planlaması.</p>',
          card2: '<h4>02 • Pilot Uygulama</h4><p>İlk sürümün devreye alınması, kullanıcı testleri ve optimizasyon.</p>',
          card3: '<h4>03 • Tam Ölçekleme</h4><p>Tüm birimlerde yaygınlaştırma ve performans takibi.</p>',
          notes: 'Her aşamanın yaklaşık 4 hafta süreceğini belirt.',
          elements: []
        },
        {
          id: 's_pitch_4',
          layout: 'metrics',
          transition: 'flip',
          title: 'Hedeflenen Temel Kazanımlar (KPI)',
          card1: '<div style="font-size:46px;font-weight:900;color:#2563EB;">%94</div><div style="font-weight:700;margin-top:8px;">Kullanıcı Memnuniyeti</div><div style="font-size:12px;opacity:0.75;margin-top:4px;">İlk 6 ay hedefi</div>',
          card2: '<div style="font-size:46px;font-weight:900;color:#10B981;">2.8x</div><div style="font-weight:700;margin-top:8px;">Üretkenlik Artışı</div><div style="font-size:12px;opacity:0.75;margin-top:4px;">Süreç otomasyonu ile</div>',
          card3: '<div style="font-size:46px;font-weight:900;color:#F59E0B;">-%35</div><div style="font-weight:700;margin-top:8px;">Maliyet Tasarrufu</div><div style="font-size:12px;opacity:0.75;margin-top:4px;">Yıllık bütçe etkisi</div>',
          notes: 'Rakamların finansal projeksiyon tablosuna dayandığını ifade et.',
          elements: []
        },
        {
          id: 's_pitch_5',
          layout: 'quote',
          transition: 'reveal',
          quote: 'Geleceği tahmin etmenin en güçlü yolu, onu bugün doğru araçlarla inşa etmektir.',
          author: 'Teşekkürler • Soru & Cevap',
          notes: 'Katılımcılara teşekkür et ve soruları al.',
          elements: []
        }
      ];
    } else if (templateName === 'academic') {
      this.state.theme = 'theme-ocean-blue';
      this.state.slides = [
        {
          id: 's_acad_1',
          layout: 'title',
          transition: 'fade',
          title: 'Akademik Araştırma ve Bulgular Sunumu',
          subtitle: 'Kavramsal Çerçeve, Metodoloji ve Veri Analizi',
          notes: 'Araştırmanın kapsamını ve literatürdeki yerini kısaca tanıt.',
          elements: []
        },
        {
          id: 's_acad_2',
          layout: 'title_content',
          transition: 'slide',
          title: '1. Araştırmanın Amacı ve Hipotezler',
          content: '<ul><li><b>Temel Amaç:</b> İncelenen değişkenler arasındaki nedensel ilişkiyi ortaya koymak.</li><li><b>Hipotez 1 (H1):</b> Uygulanan yeni yöntem, öğrenme kalıcılığını anlamlı düzeyde artırır.</li><li><b>Hipotez 2 (H2):</b> Görsel destekli sunum materyalleri bilişsel yükü azaltır.</li></ul>',
          notes: 'Hipotezlerin kuramsal dayanaklarını vurgula.',
          elements: []
        },
        {
          id: 's_acad_3',
          layout: 'three_cards',
          transition: 'zoom',
          title: '2. Araştırma Metodolojisi',
          card1: '<h4>Örneklem Grubu</h4><p>Farklı disiplinlerden seçilen N=240 katılımcı ile yürütülen saha çalışması.</p>',
          card2: '<h4>Veri Toplama</h4><p>Ön-test / Son-test kontrol gruplu deneysel desen ve yapılandırılmış ölçekler.</p>',
          card3: '<h4>İstatistiksel Analiz</h4><p>Çok değişkenli varyans analizi (ANOVA) ve regresyon modelleri.</p>',
          notes: '',
          elements: []
        },
        {
          id: 's_acad_4',
          layout: 'metrics',
          transition: 'flip',
          title: '3. Temel Deneysel Bulgular',
          card1: '<div style="font-size:44px;font-weight:900;color:#38BDF8;">p &lt; .001</div><div style="font-weight:700;margin-top:8px;">İstatistiksel Anlamlılık</div><div style="font-size:12px;opacity:0.8;">Yüksek güven düzeyi</div>',
          card2: '<div style="font-size:44px;font-weight:900;color:#34D399;">+%42</div><div style="font-weight:700;margin-top:8px;">Başarı Puanı Artışı</div><div style="font-size:12px;opacity:0.8;">Deney grubu ortalaması</div>',
          card3: '<div style="font-size:44px;font-weight:900;color:#FBBF24;">r = 0.84</div><div style="font-weight:700;margin-top:8px;">Pozitif Korelasyon</div><div style="font-size:12px;opacity:0.8;">Güçlü etki büyüklüğü</div>',
          notes: '',
          elements: []
        },
        {
          id: 's_acad_5',
          layout: 'two_col',
          transition: 'fade',
          title: '4. Sonuç ve Gelecek Çalışmalar İçin Öneriler',
          leftCol: '<h4>📌 Temel Sonuçlar</h4><ul><li>H1 ve H2 hipotezleri güçlü biçimde doğrulanmıştır.</li><li>Uygulamalı görsel araçlar katılımı iki katına çıkarmıştır.</li></ul>',
          rightCol: '<h4>🔭 Öneriler</h4><ul><li>Farklı yaş ve eğitim gruplarında boylamsal çalışmalar yapılmalıdır.</li><li>Dijital kütüphane arşivleri sürece dahil edilmelidir.</li></ul>',
          notes: '',
          elements: []
        }
      ];
    } else if (templateName === 'literature') {
      this.state.theme = 'theme-sepia-book';
      this.state.slides = [
        {
          id: 's_lit_1',
          layout: 'title',
          transition: 'fade',
          title: 'Edebi Eser ve Metin Çözümlemesi',
          subtitle: 'Anlatı Yapısı, Karakter Derinliği ve Dönemsel İzlekler',
          notes: 'Eserin yazıldığı tarihsel arka planla giriş yap.',
          elements: []
        },
        {
          id: 's_lit_2',
          layout: 'split_media',
          transition: 'slide',
          title: 'Eserin Kimliği ve Tarihsel Bağlamı',
          leftCol: '<div style="font-size:48px;margin-bottom:10px;">📖</div><h4>Klasik Dönem Başyapıtı</h4><p style="font-size:14px;opacity:0.8;">Bireyin iç dünyası ile toplumsal dönüşüm arasındaki gerilimi işleyen öncü anlatı.</p>',
          rightCol: '<h4>Temel Özellikler</h4><ul><li><b>Anlatıcı Bakış Açısı:</b> Çoğulcu ve iç monolog destekli</li><li><b>Zaman Kurgu:</b> Geriye dönüşlerle zenginleşen katmanlı yapı</li><li><b>Dil ve Üslup:</b> Şiirsel, imge yüklü ve derinlikli</li></ul>',
          notes: '',
          elements: []
        },
        {
          id: 's_lit_3',
          layout: 'three_cards',
          transition: 'zoom',
          title: 'Metindeki Üç Ana İzlek (Tema)',
          card1: '<h4>🕰️ Zaman ve Bellek</h4><p>Geçmişin bugünkü kimlik inşası üzerindeki silinmez izleri ve hatırlama eylemi.</p>',
          card2: '<h4>🌿 Yabancılaşma ve Arayış</h4><p>Modernleşen dünyada bireyin kendi iç sesini ve aidiyetini bulma çabası.</p>',
          card3: '<h4>✒️ Yazmanın Sağaltıcı Gücü</h4><p>Kelimelerin ve edebiyatın insan ruhunu onaran kalıcı etkisi.</p>',
          notes: '',
          elements: []
        },
        {
          id: 's_lit_4',
          layout: 'quote',
          transition: 'reveal',
          quote: 'Kalpten çıkan her samimi cümle, zamanın ötesine bırakılmış sönmeyen bir ışıktır.',
          author: 'Edebiyat İnceleme Notları',
          notes: '',
          elements: []
        }
      ];
    }

    this.state.currentIndex = 0;
    this.selectedElementId = null;
    this.saveToStorage();
    this.render();
    if (window.showToast) window.showToast('Hazır sunum şablonu yüklendi! "Slayt Oynat (F5)" ile hemen izleyebilirsiniz.');
  },

  previewCurrentSlideTransition() {
    const canvas = document.getElementById('pptActiveSlideCanvas');
    const slide = this.getCurrentSlide();
    if (!canvas || !slide) return;
    const tr = slide.transition || 'fade';
    canvas.classList.remove('ppt-trans-fade', 'ppt-trans-slide', 'ppt-trans-zoom', 'ppt-trans-flip', 'ppt-trans-reveal');
    if (tr !== 'none') {
      void canvas.offsetWidth; // trigger reflow
      canvas.classList.add(`ppt-trans-${tr}`);
    }
  },

  updateCounters() {
    const total = this.state.slides.length;
    const cur = this.state.currentIndex + 1;
    const badge = document.getElementById('pptSlideCountBadge');
    if (badge) badge.textContent = `${cur} / ${total}`;

    const slide = this.getCurrentSlide();
    const statusInfo = document.getElementById('pptStatusSlideInfo');
    if (statusInfo && slide) {
      statusInfo.textContent = `Slayt ${cur} / ${total}`;
    }
  },

  debounceSave() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.saveToStorage();
      this.renderThumbnails();
      this.updateCounters();
    }, 280);
  },

  selectSlide(index) {
    if (index >= 0 && index < this.state.slides.length) {
      this.syncCurrentSlideFromDOM();
      this.selectedElementId = null;
      this.state.currentIndex = index;
      this.render();
      this.previewCurrentSlideTransition();
    }
  },

  addSlide(layout = 'title_content') {
    this.syncCurrentSlideFromDOM();
    const newSlide = this.createBlankSlideObj(layout);
    this.state.slides.splice(this.state.currentIndex + 1, 0, newSlide);
    this.state.currentIndex += 1;
    this.selectedElementId = null;
    this.saveToStorage();
    this.render();
    this.previewCurrentSlideTransition();
  },

  duplicateCurrentSlide() {
    this.syncCurrentSlideFromDOM();
    const current = this.getCurrentSlide();
    if (!current) return;
    const copy = JSON.parse(JSON.stringify(current));
    copy.id = 'slide_' + Date.now();
    this.state.slides.splice(this.state.currentIndex + 1, 0, copy);
    this.state.currentIndex += 1;
    this.selectedElementId = null;
    this.saveToStorage();
    this.render();
    if (window.showToast) window.showToast('Slayt çoğaltıldı.');
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
    this.selectedElementId = null;
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

  // ========================================================================
  // Fullscreen Presentation Player (F5, Auto-Play, Laser, Live Pen, Grid, Notes)
  // ========================================================================
  startPresentation(options = { fromStart: false, autoPlay: false }) {
    this.syncCurrentSlideFromDOM();
    const overlay = document.getElementById('pptPresentationOverlay');
    if (!overlay) return;

    if (options.fromStart) {
      this.state.currentIndex = 0;
    }

    this.presentation.isActive = true;
    this.presentation.laserActive = false;
    this.presentation.penActive = false;
    this.presentation.presentationStartTime = Date.now();

    overlay.style.display = 'flex';
    overlay.classList.add('active');
    overlay.classList.remove('laser-active', 'pen-active');
    document.body.style.overflow = 'hidden';

    const laserDot = document.getElementById('pptLaserDot');
    if (laserDot) laserDot.style.display = 'none';
    document.getElementById('pptHudLaserBtn')?.classList.remove('active');
    document.getElementById('pptHudPenBtn')?.classList.remove('active');
    const clearBtn = document.getElementById('pptHudClearPenBtn');
    if (clearBtn) clearBtn.style.display = 'none';
    const gridOverlay = document.getElementById('pptSlideGridOverlay');
    if (gridOverlay) gridOverlay.style.display = 'none';

    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    this.renderPresentationSlide();
    this.initAnnotationCanvas();
    this.startPresentationClock();

    if (options.autoPlay) {
      this.setPresentationAutoPlay(true);
    } else {
      this.setPresentationAutoPlay(false);
    }

    // Mouse move handler for HUD visibility & Laser Pointer
    overlay.onmousemove = (e) => {
      if (this.presentation.laserActive && laserDot) {
        laserDot.style.left = `${e.clientX}px`;
        laserDot.style.top = `${e.clientY}px`;
      }
      const hud = document.getElementById('pptHudControls');
      const topBadge = document.getElementById('pptPresenterTopBadge');
      if (hud) hud.style.opacity = '1';
      if (topBadge) topBadge.style.opacity = '1';
      clearTimeout(this.presentation.hudTimer);
      this.presentation.hudTimer = setTimeout(() => {
        if (!this.presentation.penActive) {
          if (hud) hud.style.opacity = '0.18';
          if (topBadge) topBadge.style.opacity = '0.35';
        }
      }, 3200);
    };

    // Touch swipe navigation
    let touchStartX = 0;
    let touchStartY = 0;
    overlay.ontouchstart = (e) => {
      if (this.presentation.penActive) return;
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    };
    overlay.ontouchend = (e) => {
      if (this.presentation.penActive) return;
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) this.nextSlide();
        else this.prevSlide();
      }
    };
  },

  exitPresentation() {
    this.presentation.isActive = false;
    this.setPresentationAutoPlay(false);
    clearInterval(this.presentation.clockInterval);
    clearTimeout(this.presentation.hudTimer);

    const overlay = document.getElementById('pptPresentationOverlay');
    if (overlay) {
      overlay.style.display = 'none';
      overlay.classList.remove('active', 'laser-active', 'pen-active');
      document.body.style.overflow = '';
    }
    const laserDot = document.getElementById('pptLaserDot');
    if (laserDot) laserDot.style.display = 'none';

    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    this.render();
  },

  startPresentationClock() {
    clearInterval(this.presentation.clockInterval);
    const timerText = document.getElementById('pptPresenterTimerText');
    const updateClock = () => {
      if (!timerText) return;
      const sec = Math.floor((Date.now() - this.presentation.presentationStartTime) / 1000);
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      timerText.textContent = `⏱️ ${mm}:${ss}`;
    };
    updateClock();
    this.presentation.clockInterval = setInterval(updateClock, 1000);
  },

  togglePresentationAutoPlay() {
    this.setPresentationAutoPlay(!this.presentation.autoPlay);
  },

  setPresentationAutoPlay(enable) {
    this.presentation.autoPlay = !!enable;
    const btn = document.getElementById('pptHudAutoPlayBtn');
    const modeLabel = document.getElementById('pptPresenterModeLabel');
    const autoBar = document.getElementById('pptAutoPlayProgressBar');

    clearTimeout(this.presentation.autoTimer);
    cancelAnimationFrame(this.presentation.progressRaf);

    if (this.presentation.autoPlay) {
      if (btn) {
        btn.textContent = '⏸ Duraklat';
        btn.classList.add('active');
      }
      if (modeLabel) modeLabel.style.display = 'inline';
      this.restartAutoPlayCycle();
    } else {
      if (btn) {
        btn.textContent = '▶ Oto-Oynat';
        btn.classList.remove('active');
      }
      if (modeLabel) modeLabel.style.display = 'none';
      if (autoBar) autoBar.style.width = '0%';
    }
  },

  restartAutoPlayCycle() {
    clearTimeout(this.presentation.autoTimer);
    cancelAnimationFrame(this.presentation.progressRaf);
    if (!this.presentation.isActive || !this.presentation.autoPlay) return;

    const duration = this.presentation.autoSpeedMs || 5000;
    this.presentation.slideStartTime = performance.now();
    const autoBar = document.getElementById('pptAutoPlayProgressBar');

    const tick = (now) => {
      if (!this.presentation.autoPlay || !this.presentation.isActive) return;
      const elapsed = now - this.presentation.slideStartTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      if (autoBar) autoBar.style.width = `${pct.toFixed(1)}%`;
      if (elapsed < duration) {
        this.presentation.progressRaf = requestAnimationFrame(tick);
      }
    };
    this.presentation.progressRaf = requestAnimationFrame(tick);

    this.presentation.autoTimer = setTimeout(() => {
      if (!this.presentation.isActive || !this.presentation.autoPlay) return;
      if (this.state.currentIndex < this.state.slides.length - 1) {
        this.nextSlide();
      } else if (this.presentation.loop) {
        this.state.currentIndex = 0;
        this.render();
        this.renderPresentationSlide();
        this.restartAutoPlayCycle();
      } else {
        this.setPresentationAutoPlay(false);
        if (window.showToast) window.showToast('Otomatik sunum tamamlandı.');
      }
    }, duration);
  },

  nextSlide() {
    if (this.state.currentIndex < this.state.slides.length - 1) {
      this.state.currentIndex++;
      this.render();
      this.renderPresentationSlide();
      if (this.presentation.autoPlay) this.restartAutoPlayCycle();
    } else if (this.presentation.isActive && this.presentation.loop && this.presentation.autoPlay) {
      this.state.currentIndex = 0;
      this.render();
      this.renderPresentationSlide();
      this.restartAutoPlayCycle();
    }
  },

  prevSlide() {
    if (this.state.currentIndex > 0) {
      this.state.currentIndex--;
      this.render();
      this.renderPresentationSlide();
      if (this.presentation.autoPlay) this.restartAutoPlayCycle();
    }
  },

  renderPresentationSlide() {
    const container = document.getElementById('pptPresentationSlide');
    const counter = document.getElementById('pptHudCounter');
    const progBar = document.getElementById('pptPresentationProgressBar');
    const notesBody = document.getElementById('pptPresenterNotesBody');
    if (!container) return;

    const slide = this.getCurrentSlide();
    if (!slide) return;

    const tr = slide.transition || 'fade';
    const transClass = tr !== 'none' ? `ppt-trans-${tr}` : '';
    const ratioClass = 'ratio-' + this.state.aspectRatio.replace(':', '-');

    container.className = `ppt-presentation-slide ${this.state.theme} ${ratioClass}`;
    void container.offsetWidth; // trigger animation reflow
    if (transClass) container.classList.add(transClass);

    container.innerHTML = this.buildStaticSlideHtml(slide, true);

    if (counter) {
      counter.textContent = `${this.state.currentIndex + 1} / ${this.state.slides.length}`;
    }
    if (progBar) {
      const pct = ((this.state.currentIndex + 1) / Math.max(1, this.state.slides.length)) * 100;
      progBar.style.width = `${pct.toFixed(1)}%`;
    }
    if (notesBody) {
      notesBody.textContent = (slide.notes && slide.notes.trim()) ? slide.notes : 'Bu slayt için konuşmacı notu eklenmemiş.';
    }

    this.clearAnnotationCanvas();
  },

  // ========================================================================
  // Live Presenter Tools: Laser Pointer, Annotation Pen, Grid, Speaker Notes
  // ========================================================================
  toggleLaserPointer() {
    const overlay = document.getElementById('pptPresentationOverlay');
    const laserDot = document.getElementById('pptLaserDot');
    const btn = document.getElementById('pptHudLaserBtn');
    this.presentation.laserActive = !this.presentation.laserActive;

    if (this.presentation.laserActive && this.presentation.penActive) {
      this.toggleAnnotationPen();
    }
    overlay?.classList.toggle('laser-active', this.presentation.laserActive);
    btn?.classList.toggle('active', this.presentation.laserActive);
    if (laserDot) {
      laserDot.style.display = this.presentation.laserActive ? 'block' : 'none';
    }
  },

  initAnnotationCanvas() {
    const canvas = document.getElementById('pptAnnotationCanvas');
    if (!canvas) return;
    this.resizeAnnotationCanvas();

    canvas.onmousedown = (e) => {
      if (!this.presentation.penActive) return;
      e.stopPropagation();
      this.presentation.isDrawing = true;
      const rect = canvas.getBoundingClientRect();
      this.presentation.lastPenX = e.clientX - rect.left;
      this.presentation.lastPenY = e.clientY - rect.top;
    };

    canvas.onmousemove = (e) => {
      if (!this.presentation.penActive || !this.presentation.isDrawing) return;
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(this.presentation.lastPenX, this.presentation.lastPenY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      this.presentation.lastPenX = x;
      this.presentation.lastPenY = y;
    };

    window.addEventListener('mouseup', () => {
      this.presentation.isDrawing = false;
    });
  },

  resizeAnnotationCanvas() {
    const canvas = document.getElementById('pptAnnotationCanvas');
    const wrap = document.getElementById('pptPresentationSlideWrap');
    if (!canvas || !wrap) return;
    canvas.width = wrap.clientWidth || window.innerWidth;
    canvas.height = wrap.clientHeight || window.innerHeight;
  },

  toggleAnnotationPen() {
    const overlay = document.getElementById('pptPresentationOverlay');
    const btn = document.getElementById('pptHudPenBtn');
    const clearBtn = document.getElementById('pptHudClearPenBtn');
    this.presentation.penActive = !this.presentation.penActive;

    if (this.presentation.penActive && this.presentation.laserActive) {
      this.toggleLaserPointer();
    }
    this.resizeAnnotationCanvas();
    overlay?.classList.toggle('pen-active', this.presentation.penActive);
    btn?.classList.toggle('active', this.presentation.penActive);
    if (clearBtn) {
      clearBtn.style.display = this.presentation.penActive ? 'inline-block' : 'none';
    }
  },

  clearAnnotationCanvas() {
    const canvas = document.getElementById('pptAnnotationCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  },

  toggleSlideGridOverlay(forceState) {
    const gridOverlay = document.getElementById('pptSlideGridOverlay');
    const gridBody = document.getElementById('pptSlideGridBody');
    const btn = document.getElementById('pptHudGridBtn');
    if (!gridOverlay || !gridBody) return;

    const shouldOpen = typeof forceState === 'boolean' ? forceState : (gridOverlay.style.display === 'none');
    if (!shouldOpen) {
      gridOverlay.style.display = 'none';
      btn?.classList.remove('active');
      return;
    }

    gridBody.innerHTML = '';
    this.state.slides.forEach((s, idx) => {
      const card = document.createElement('div');
      card.className = 'ppt-grid-jump-card' + (idx === this.state.currentIndex ? ' active' : '');
      const cleanTitle = (s.title || s.quote || '').replace(/<[^>]*>/g, '').trim() || `Slayt ${idx + 1}`;
      card.innerHTML = `
        <div style="font-size:11px;font-weight:800;color:#34D399;margin-bottom:4px;">SLAYT ${idx + 1} • ${this.getLayoutLabel(s.layout)}</div>
        <div style="font-size:14px;font-weight:700;line-height:1.35;">${escapeHtml(cleanTitle.substring(0, 60))}</div>
      `;
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        this.state.currentIndex = idx;
        this.render();
        this.renderPresentationSlide();
        gridOverlay.style.display = 'none';
        btn?.classList.remove('active');
      });
      gridBody.appendChild(card);
    });

    gridOverlay.style.display = 'flex';
    btn?.classList.add('active');
  },

  togglePresenterNotesPopup(forceState) {
    const popup = document.getElementById('pptPresenterNotesPopup');
    const btn = document.getElementById('pptHudNotesBtn');
    if (!popup) return;
    const shouldOpen = typeof forceState === 'boolean' ? forceState : (popup.style.display === 'none');
    popup.style.display = shouldOpen ? 'flex' : 'none';
    btn?.classList.toggle('active', shouldOpen);
  },

  // ========================================================================
  // Presentation Export & Import Tools (.PPTX, .HTML, .PDF, .JSON)
  // ========================================================================
  async exportPptx() {
    this.syncCurrentSlideFromDOM();
    if (!window.JSZip) {
      if (window.showToast) window.showToast('PPTX oluşturucu hazırlanıyor, lütfen tekrar deneyin.', 'warning');
      return;
    }

    try {
      const zip = new window.JSZip();
      const slides = this.state.slides || [];
      const title = this.state.fileName ? this.state.fileName.replace(/\.[^/.]+$/, '') : 'Kalpten_Kaleme_Sunum';

      const stripHtml = (html) => {
        const tmp = document.createElement('div');
        tmp.innerHTML = html || '';
        return (tmp.textContent || tmp.innerText || '').trim();
      };

      const xmlEscape = (str) => String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

      // 1. [Content_Types].xml
      const slideOverrides = slides.map((_, i) =>
        `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
      ).join('\n  ');

      zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  ${slideOverrides}
</Types>`);

      // 2. _rels/.rels
      zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);

      // 3. ppt/_rels/presentation.xml.rels
      const presRels = slides.map((_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
      ).join('\n  ');

      zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${presRels}
</Relationships>`);

      // 4. ppt/presentation.xml
      const sldIdLst = slides.map((_, i) =>
        `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`
      ).join('\n    ');

      zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
    ${sldIdLst}
  </p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`);

      // 5. Each slide XML: ppt/slides/slide{N}.xml
      slides.forEach((s, i) => {
        const heading = stripHtml(s.title || s.quote || `Slayt ${i + 1}`);
        const bodyParts = [
          stripHtml(s.subtitle),
          stripHtml(s.content),
          stripHtml(s.leftCol),
          stripHtml(s.rightCol),
          stripHtml(s.card1),
          stripHtml(s.card2),
          stripHtml(s.card3),
          stripHtml(s.author)
        ].filter(Boolean);

        (s.elements || []).forEach(el => {
          const t = stripHtml(el.html);
          if (t) bodyParts.push(t);
        });

        const paragraphsXml = bodyParts.length > 0
          ? bodyParts.map(p => `<a:p><a:r><a:rPr lang="tr-TR" sz="2000"/><a:t>${xmlEscape(p)}</a:t></a:r></a:p>`).join('')
          : `<a:p><a:r><a:rPr lang="tr-TR" sz="2000"/><a:t></a:t></a:r></a:p>`;

        zip.file(`ppt/slides/slide${i + 1}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="457200"/><a:ext cx="10820400" cy="1143000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="tr-TR" sz="3200" b="1"/><a:t>${xmlEscape(heading)}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="685800" y="1828800"/><a:ext cx="10820400" cy="4343400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/>${paragraphsXml}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`);
      });

      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.pptx`;
      a.click();
      URL.revokeObjectURL(url);
      if (window.showToast) window.showToast(`"${title}.pptx" PowerPoint sunumu olarak indirildi.`);
    } catch (err) {
      console.error('PPTX export error:', err);
      if (window.showToast) window.showToast('PPTX oluşturulurken hata oluştu.', 'error');
    }
  },

  exportHtml() {
    this.syncCurrentSlideFromDOM();
    const title = this.state.fileName ? this.state.fileName.replace(/\.[^/.]+$/, '') : 'Kalpten_Kaleme_Sunum';
    const theme = this.state.theme || 'theme-clean-light';
    const ratioClass = 'ratio-' + (this.state.aspectRatio || '16:9').replace(':', '-');

    const renderedSlidesArray = this.state.slides.map(s => ({
      html: this.buildStaticSlideHtml(s, true),
      transition: s.transition || 'fade'
    }));

    const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - Kalpten Kaleme Sunum</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #050811;
      color: #fff;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      height: 100vh;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }
    .stage { width: 95vw; height: 92vh; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .slide-canvas {
      width: 100%; border-radius: 14px; padding: 52px 68px; display: flex; flex-direction: column;
      position: relative; overflow: hidden; box-shadow: 0 24px 64px rgba(0,0,0,0.65);
      animation: fadeIn 0.35s ease-out;
    }
    .slide-canvas.ratio-16-9 { aspect-ratio: 16 / 9; max-width: 1360px; }
    .slide-canvas.ratio-4-3 { aspect-ratio: 4 / 3; max-width: 1080px; }
    .slide-canvas.ratio-a4-portrait { aspect-ratio: 1 / 1.4142; max-height: 90vh; width: auto; max-width: 660px; }
    .slide-canvas.ratio-a4-landscape { aspect-ratio: 1.4142 / 1; max-width: 1360px; }
    @keyframes fadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
    .theme-luxury-dark { background: linear-gradient(135deg, #090D16, #131A2B); color: #F8FAFC; border: 1px solid rgba(212, 175, 55, 0.3); }
    .theme-clean-light { background: #FFFFFF; color: #0F172A; border: 1px solid #E2E8F0; }
    .theme-sepia-book { background: #FAF7EE; color: #382D23; border: 1px solid #E7DFCB; }
    .theme-sunset { background: linear-gradient(135deg, #431407, #7C2D12); color: #FFEDD5; border: 1px solid rgba(251, 146, 60, 0.4); }
    .theme-emerald { background: linear-gradient(135deg, #022C22, #064E3B); color: #ECFDF5; border: 1px solid rgba(52, 211, 153, 0.4); }
    .theme-ocean-blue { background: linear-gradient(135deg, #0C4A6E, #1E3A8A); color: #F0F9FF; border: 1px solid rgba(56, 189, 248, 0.35); }
    .theme-royal-purple { background: linear-gradient(135deg, #2E1065, #4C1D95); color: #F5F3FF; border: 1px solid rgba(167, 139, 250, 0.35); }
    .slide-two-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; flex: 1; }
    .slide-three-cards, .slide-metrics-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; flex: 1; }
    .slide-split-media { display: grid; grid-template-columns: 1.05fr 1fr; gap: 22px; flex: 1; }
    .slide-col-card, .slide-kpi-card { padding: 20px; border-radius: 10px; background: rgba(148,163,184,0.1); border: 1px solid rgba(148,163,184,0.25); }
    .slide-quote-box { display: flex; flex-direction: column; justify-content: center; align-items: center; flex: 1; text-align: center; }
    .ppt-elements-layer { position: absolute; inset: 0; pointer-events: none; z-index: 15; }
    .ppt-canvas-el { position: absolute; border-radius: 8px; display: flex; flex-direction: column; }
    .ppt-el-content { width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; }
    .hud {
      position: fixed; bottom: 18px; left: 50%; transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.18); border-radius: 30px; padding: 6px 18px;
      display: flex; align-items: center; gap: 10px; z-index: 1000;
    }
    .hud button { background: transparent; border: none; color: #fff; padding: 5px 12px; border-radius: 16px; cursor: pointer; font-size: 13px; font-weight: 600; }
    .hud button:hover, .hud button.active { background: #10B981; }
    .counter { font-size: 13px; font-weight: 700; color: #34D399; min-width: 56px; text-align: center; }
  </style>
</head>
<body>
  <div class="stage" id="stage"></div>
  <div class="hud" id="hud">
    <button id="prevBtn">◀ Önceki</button>
    <span class="counter" id="counter">1 / 1</span>
    <button id="nextBtn">Sonraki ▶</button>
    <button id="autoBtn">▶ Oto-Oynat</button>
    <button id="fsBtn">⛶ Tam Ekran</button>
  </div>
  <script>
    const slides = ${JSON.stringify(renderedSlidesArray)};
    const theme = "${theme}";
    const ratioClass = "${ratioClass}";
    let currentIdx = 0;
    let autoTimer = null;
    const stage = document.getElementById('stage');
    const counter = document.getElementById('counter');
    const autoBtn = document.getElementById('autoBtn');

    function renderSlide(idx) {
      if (idx < 0 || idx >= slides.length) return;
      currentIdx = idx;
      stage.innerHTML = '<div class="slide-canvas ' + theme + ' ' + ratioClass + '">' + slides[idx].html + '</div>';
      counter.textContent = (currentIdx + 1) + ' / ' + slides.length;
    }
    function next() {
      if (currentIdx < slides.length - 1) renderSlide(currentIdx + 1);
      else if (autoTimer) renderSlide(0);
    }
    function prev() { if (currentIdx > 0) renderSlide(currentIdx - 1); }

    document.getElementById('nextBtn').addEventListener('click', next);
    document.getElementById('prevBtn').addEventListener('click', prev);
    autoBtn.addEventListener('click', () => {
      if (autoTimer) {
        clearInterval(autoTimer); autoTimer = null;
        autoBtn.textContent = '▶ Oto-Oynat'; autoBtn.classList.remove('active');
      } else {
        autoTimer = setInterval(next, 5000);
        autoBtn.textContent = '⏸ Duraklat'; autoBtn.classList.add('active');
      }
    });
    document.getElementById('fsBtn').addEventListener('click', () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    });
    stage.addEventListener('click', (e) => {
      if (e.clientX > window.innerWidth * 0.25) next();
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
    if (window.showToast) window.showToast(`"${title}.html" etkileşimli sunum olarak indirildi.`);
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
    if (window.showToast) window.showToast(`"${title}.json" sunum proje dosyası indirildi.`);
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
          this.normalizeSlides();
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
                transition: 'fade',
                title: slideTitle,
                subtitle: i === 0 && slideBullets[0] ? slideBullets[0] : '',
                content: contentHtml,
                leftCol: '',
                rightCol: '',
                card1: '',
                card2: '',
                card3: '',
                quote: '',
                author: '',
                notes: '',
                elements: []
              });
            }

            if (parsedSlides.length > 0) {
              this.state.slides = parsedSlides;
              this.state.fileName = file.name;
              this.state.currentIndex = 0;
              this.normalizeSlides();
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
            transition: 'fade',
            title: title,
            subtitle: '',
            content: body ? `<p>${body}</p>` : '',
            leftCol: '',
            rightCol: '',
            card1: '',
            card2: '',
            card3: '',
            quote: '',
            author: '',
            notes: '',
            elements: []
          };
        });
        this.state.slides = parsed;
        this.state.fileName = file.name;
        this.state.currentIndex = 0;
        this.normalizeSlides();
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
  }
};

window.pptEditor = pptEditor;
document.addEventListener('DOMContentLoaded', () => {
  pptEditor.init();
});
