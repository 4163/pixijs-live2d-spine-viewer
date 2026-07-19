/* ============================================================
   main.js - Live2D Viewer
   PIXI init, manifest loading, mode switching, theme toggle,
   model pill / dropdown UI, canvas resize via PIXI resizeTo
   ============================================================ */

(function () {
  'use strict';

  // ── Theme ─────────────────────────────────────────────────
  const THEME_KEY = 'live2d-viewer-theme';

  function getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme, app, e) {
    const isDark = theme === 'dark';
    
    function performThemeSwitch() {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = isDark ? '☀' : '🌙';
    }

    if (!e || !document.startViewTransition) {
      performThemeSwitch();
      return;
    }

    // Modern View-Transition API for radial effect
    const x = e.clientX;
    const y = e.clientY;
    const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const transition = document.startViewTransition(performThemeSwitch);

    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 400,
          easing: 'ease-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  }

  const savedTheme = localStorage.getItem(THEME_KEY) || getSystemTheme();
  applyTheme(savedTheme, null);
  const WARN_KEY = THEME_KEY + '-warn';
  if (document.documentElement.getAttribute('data-theme') === 'dark' && !localStorage.getItem(WARN_KEY)) {
    document.getElementById('info').classList.add('info-hidden');
    var warn = document.createElement('div');
    warn.id = 'theme-warning';
    warn.textContent = '💡 Light mode recommended for visibility';
    warn.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:30;background:#1d1d1f;color:#f5f5f7;padding:6px 16px;border-radius:12px;font-size:13px;border:1px solid rgba(255,255,255,0.2);cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.3)';
    warn.addEventListener('click', function(){
      document.getElementById('info').classList.remove('info-hidden');
      document.getElementById('theme-toggle').click();
    });
    document.body.appendChild(warn);
  }

  // ── Viewer Callbacks (decouple canvas modules from DOM) ───
  window.__viewerCallbacks = {
    onStateChange: function(state) {
      const info = document.getElementById('info');
      const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      let html = '';
      
      switch(state.type) {
        case 'loading':
          html = state.modelName 
            ? `Loading ${state.modelName}${state.isDorm ? ' (dorm)' : ''}…` 
            : (state.message || 'Loading…');
          break;
        case 'error':
          html = state.message || `${state.modelName || 'Model'} — load failed`;
          break;
        case 'ready':
          if (state.mode === 'live2d') {
            html = `${state.modelName} — ${isTouch ? 'tap' : 'click'} to interact`;
          } else if (state.mode === 'spine') {
            html = `${state.modelName} — ${isTouch ? 'tap' : 'click'} to cycle animation (${state.defaultAnim || 'none'})`;
          }
          break;
        case 'anim-cycle':
          html = `${state.modelName} — ${state.animName}`;
          break;
        case 'playground-empty':
          html = 'Playground: no Spine models found.';
          break;
        case 'playground-loading':
          html = 'Playground: loading all models…';
          break;
        case 'playground-ready':
          html = isTouch
            ? `<div class="playground-controls-wrapper"><div class="playground-controls"><span>Tap cycle anims</span><span>Double-Tap duplicate</span><span>Triple-Tap delete</span><span>Drag to move</span></div></div>`
            : `<div class="playground-controls-wrapper"><div class="playground-controls"><span>LMB cycle anims</span><span>RMB duplicate</span><span>Double RMB delete</span><span>Drag to move</span></div></div>`;
          break;
      }
      if (html) info.innerHTML = html;
      
      // Manage SVG spinner visibility
      const spinner = document.getElementById('loading-spinner');
      if (spinner) {
        if (state.type === 'loading' || state.type === 'playground-loading') {
          spinner.style.display = 'block';
          spinner.setAttribute('aria-hidden', 'false');
        } else if (['ready', 'error', 'playground-ready', 'playground-empty'].includes(state.type)) {
          spinner.style.display = 'none';
          spinner.setAttribute('aria-hidden', 'true');
        }
      }
    },
    onDormChange: function(active) {
      const dt = document.getElementById('dorm-toggle');
      if (dt) dt.classList.toggle('active', active);
    }
  };

  // ── PIXI Application ──────────────────────────────────────
  const canvasWrap = document.getElementById('canvas-wrap');
  const sharedApp = new PIXI.Application({
    backgroundAlpha: 0,             // Transparent to show CSS floor gradient
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  });
  canvasWrap.appendChild(sharedApp.view);
  
  // Prevent browser context menu on right click
  sharedApp.view.addEventListener('contextmenu', e => e.preventDefault());

  sharedApp.stage.interactive = true;
  sharedApp.stage.eventMode = 'static';
  // A massive hitArea ensures the stage captures pointer events everywhere,
  // which is required for Live2D models to follow the cursor.
  sharedApp.stage.hitArea = new PIXI.Rectangle(-10000, -10000, 20000, 20000);
  PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
  window.__sharedApp = sharedApp;

  console.log('Renderer:', sharedApp.renderer.type === PIXI.RENDERER_TYPE.WEBGL ? 'WebGL' : 'Canvas (WebGL unavailable)');


  // ── Pan & Zoom - delegated to panzoom.js ─────────────────

  // ── Canvas Resize - delegated to resize.js ─────────────────
  if (typeof window.initCanvasResize === 'function') {
    window.initCanvasResize(sharedApp, canvasWrap, [
      () => { if (typeof window.repositionLive2D === 'function') window.repositionLive2D(); },
      () => { if (typeof window.repositionChibi === 'function') window.repositionChibi(); }
    ]);
  }

  document.getElementById('theme-toggle').addEventListener('click', (e) => {
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next, sharedApp, e);
    // Light mode toggle → dismiss warning permanently
    if (next === 'light') {
      document.getElementById('info').classList.remove('info-hidden');
      var w = document.getElementById('theme-warning');
      if (w) w.remove();
      localStorage.setItem(THEME_KEY + '-warn', '1');
    }
  });

  // ── Pan & Zoom init ──────────────────────────────────────
  if (typeof window.initPanZoom === 'function') {
    const pz = window.initPanZoom(sharedApp);
    window.panZoomController = pz;
    
    const panToggleBtn = document.getElementById('pan-toggle');
    const resetBtn = document.getElementById('reset-view');
    
    let isPanMode = localStorage.getItem('panMode') === 'true';
    if (isPanMode) pz.enable();
    
    // Sync PixiJS stage cursor and UI with pan-mode state
    // (stage has a massive hitArea so it acts as the "background" cursor;
    //  individual interactive objects like chibi spines override when hovered)
    const syncUI = () => {
      const active = pz.isActive();
      if (panToggleBtn) panToggleBtn.setAttribute('aria-pressed', active);
      canvasWrap.classList.toggle('pan-mode', active);
      sharedApp.stage.cursor = active ? 'move' : 'default';
    };
    syncUI();
    
    if (panToggleBtn) {
      panToggleBtn.addEventListener('click', () => {
        const active = pz.toggle();
        localStorage.setItem('panMode', active);
        syncUI();
      });
    }
    
    // Reset button: resets pan/zoom, repositions model, clears playground duplicates
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        pz.reset();
        if (currentMode === 'live2d' && typeof window.repositionLive2D === 'function') window.repositionLive2D();
        if (currentMode === 'spine' && typeof window.repositionChibi === 'function') window.repositionChibi();
        if (activePillId === 'playground' && typeof window.resetPlayground === 'function') window.resetPlayground();
      });
    }
  }


  // ── Dorm toggle wiring ────────────────────────────────────
  const dormToggle = document.getElementById('dorm-toggle');
  if (dormToggle) {
    dormToggle.addEventListener('click', () => {
      if (typeof window.toggleDormMode === 'function') {
        window.toggleDormMode();
      }
    });
  }
  function showDormToggle() {
    const dt = document.getElementById('dorm-toggle');
    if (dt) dt.classList.remove('hidden');
  }
  function hideDormToggle() {
    const dt = document.getElementById('dorm-toggle');
    if (dt) dt.classList.add('hidden');
  }

  async function loadManifest(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) return [];
      return await r.json();
    } catch { return []; }
  }

  async function buildModelLists() {
    const cfg = window.VIEWER_CONFIG || { live2d: [], spine: [], layout: {} };

    const [c2, c3, sp] = await Promise.all([
      loadManifest('models/cubism2/manifest.json'),
      loadManifest('models/cubism3/manifest.json'),
      loadManifest('models/spine/manifest.json')
    ]);

    const live2dModels = [...c2, ...c3, ...cfg.live2d];
    const spineModels  = [...sp, ...cfg.spine];

    return { live2dModels, spineModels };
  }

  // ── UI: Pills + Dropdown ──────────────────────────────────
  let allLive2d = [], allSpine = [];
  let currentMode = null;
  let activePillId = null;

  const pillContainer = document.getElementById('model-pills');
  const selectVisible = document.getElementById('model-select-visible');
  const selectHidden  = document.getElementById('model-select');  // for test-visual.mjs

  function badgeClass(type) {
    if (type === 'cubism2') return 'badge-c2';
    if (type === 'cubism3') return 'badge-c3';
    if (type === 'spine')   return 'badge-spine';
    return '';
  }
  function badgeLabel(type) {
    if (type === 'cubism2') return 'C2';
    if (type === 'cubism3') return 'C3';
    if (type === 'spine')   return 'Spine';
    return type;
  }

  function renderPills(models, onSelect) {
    pillContainer.innerHTML = '';
    selectVisible.innerHTML = '';
    selectHidden.innerHTML  = '';

    models.forEach((m, i) => {
      const pill = document.createElement('button');
      pill.className = 'model-pill' + (m.id === activePillId ? ' active' : '');
      pill.dataset.id = m.id;
      pill.style.animationDelay = `${i * 0.04}s`;

      const nameSpan = document.createElement('span');
      nameSpan.textContent = m.name;

      const badge = document.createElement('span');
      badge.className = `badge ${badgeClass(m.type)}`;
      badge.textContent = badgeLabel(m.type);

      pill.append(nameSpan, badge);
      pill.addEventListener('click', () => onSelect(m));
      pillContainer.appendChild(pill);

      const optV = document.createElement('option');
      optV.value = m.id;
      optV.textContent = `[${badgeLabel(m.type)}] ${m.name}`;
      selectVisible.appendChild(optV);

      const optH = document.createElement('option');
      optH.value = m.id;
      optH.textContent = (currentMode === 'live2d' ? 'L2D: ' : '') + m.name;
      selectHidden.appendChild(optH);
    });

    selectVisible.onchange = () => {
      const val = selectVisible.value;
      if (val === 'playground') {
        const pgPill = document.querySelector('.model-pill[data-id="playground"]');
        if (pgPill) pgPill.click();
        return;
      }
      const m = models.find(x => x.id === val);
      if (m) onSelect(m);
    };

    selectHidden.onchange = () => {
      const val = selectHidden.value;
      if (val === 'playground') {
        const pgPill = document.querySelector('.model-pill[data-id="playground"]');
        if (pgPill) pgPill.click();
        return;
      }
      const m = models.find(x => x.id === val);
      if (m) onSelect(m);
    };
  }

  function setActivePill(id) {
    activePillId = id;
    document.body.setAttribute('data-active-pill', id);
    document.querySelectorAll('.model-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.id === id);
    });
    if (selectVisible) selectVisible.value = id;
    if (selectHidden)  selectHidden.value  = id;
  }

  // Mode tab click (dorm-toggle handled separately below)
  document.querySelectorAll('.mode-tab:not(#dorm-toggle)').forEach(tab => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  // Legacy hidden mode-select (for test-visual.mjs)
  const hiddenModeSelect = document.getElementById('mode-select');
  if (hiddenModeSelect) {
    hiddenModeSelect.addEventListener('change', function () {
      switchMode(this.value === 'chibi' ? 'spine' : 'live2d');
    });
  }

  // ── Mode Switching ────────────────────────────────────────
  function destroyCurrent() {
    if (currentMode === 'live2d' && typeof window.destroyLive2D === 'function') window.destroyLive2D();
    if (currentMode === 'spine'  && typeof window.destroyChibi  === 'function') window.destroyChibi();
    if (currentMode === 'spine'  && typeof window.destroyPlayground === 'function') window.destroyPlayground();
    while (sharedApp.stage.children.length > 0) sharedApp.stage.removeChildAt(0);
    sharedApp.stage.position.set(0, 0);
    sharedApp.stage.scale.set(1, 1);
    currentMode = null;
  }

  async function switchMode(mode) {
    if (mode === currentMode) return;
    document.getElementById('info').textContent = 'Loading...';
    destroyCurrent();
    currentMode = mode;
    activePillId = null;
    document.body.setAttribute('data-mode', mode);
    document.body.removeAttribute('data-active-pill');

    if (mode === 'live2d' && window.location.hash === '#playground') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }

    // Sync tab UI
    document.querySelectorAll('.mode-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.mode === mode);
    });
    // Sync hidden mode-select
    if (hiddenModeSelect) {
      hiddenModeSelect.value = mode === 'spine' ? 'chibi' : 'live2d';
    }

    try {
      function makePillHandler(loadFn) {
        return m => {
          if (m.id === activePillId) {
            sharedApp.stage.position.set(0, 0);
            sharedApp.stage.scale.set(1, 1);
            if (currentMode === 'live2d' && typeof window.repositionLive2D === 'function') window.repositionLive2D();
            if (currentMode === 'spine' && typeof window.repositionChibi === 'function') window.repositionChibi();
            return;
          }
          setActivePill(m.id);
          sharedApp.stage.position.set(0, 0);
          sharedApp.stage.scale.set(1, 1);
          if (currentMode === 'spine' && typeof window.destroyPlayground === 'function') {
            window.destroyPlayground();
          }
          if (currentMode === 'spine') {
            showDormToggle();
            if (window.location.hash === '#playground') {
              history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          }
          loadFn(sharedApp, m).catch(e => console.error('loadModel:', e));
        };
      }
      if (mode === 'live2d') {
        hideDormToggle();
        renderPills(allLive2d, makePillHandler(window.loadLive2DModel));
        if (allLive2d.length) setActivePill(allLive2d[0].id);
        await window.initLive2DMode(sharedApp, allLive2d);
      } else if (mode === 'spine') {
        showDormToggle();
        renderPills(allSpine, makePillHandler(function(app, m) {
          const dorm = typeof window.getDormMode === 'function' ? window.getDormMode() : false;
          const dt = document.getElementById('dorm-toggle');
          if (dt) dt.classList.toggle('active', dorm);
          return window.loadChibiModel(app, m, dorm);
        }));
        
        // Append Playground pill
        const pgPill = document.createElement('button');
        pgPill.className = 'model-pill';
        pgPill.dataset.id = 'playground';
        pgPill.style.animationDelay = `${allSpine.length * 0.04}s`;
        
        const pgName = document.createElement('span');
        pgName.textContent = 'Playground';
        const pgBadge = document.createElement('span');
        pgBadge.className = 'badge badge-playground';
        pgBadge.textContent = 'All';
        pgPill.append(pgName, pgBadge);
        
        pgPill.addEventListener('click', () => {
          if (activePillId === 'playground') {
            sharedApp.stage.position.set(0, 0);
            sharedApp.stage.scale.set(1, 1);
            return;
          }
          setActivePill('playground');
          sharedApp.stage.position.set(0, 0);
          sharedApp.stage.scale.set(1, 1);
          hideDormToggle();
          
          if (window.location.hash !== '#playground') {
            history.replaceState(null, '', '#playground');
          }

          if (typeof window.destroyChibi === 'function') window.destroyChibi();
          if (typeof window.initPlaygroundMode === 'function') {
            window.initPlaygroundMode(sharedApp, allSpine);
          }
        });
        document.getElementById('model-pills').appendChild(pgPill);

        const optV = document.createElement('option');
        optV.value = 'playground';
        optV.textContent = '[All] Playground';
        selectVisible.appendChild(optV);

        const optH = document.createElement('option');
        optH.value = 'playground';
        optH.textContent = 'Playground';
        selectHidden.appendChild(optH);

        if (allSpine.length) setActivePill(allSpine[0].id);
        
        const dorm = typeof window.getDormMode === 'function' ? window.getDormMode() : false;
        const dt = document.getElementById('dorm-toggle');
        if (dt) dt.classList.toggle('active', dorm);

        await window.initChibiMode(sharedApp, allSpine);
      }
    } catch (e) {
      console.error('switchMode error:', e);
      document.getElementById('info').textContent = 'Failed to load ' + mode;
      currentMode = null;
    }
  }

  // ── Boot ──────────────────────────────────────────────────
  (async () => {
    const { live2dModels, spineModels } = await buildModelLists();
    allLive2d = live2dModels;
    allSpine  = spineModels;
    
    if (window.location.hash === '#playground') {
      await switchMode('spine');
      const pgPill = document.querySelector('.model-pill[data-id="playground"]');
      if (pgPill) pgPill.click();
    } else {
      await switchMode('live2d');
    }
    
    canvasWrap.classList.add('canvas-ready');
  })();

})();
