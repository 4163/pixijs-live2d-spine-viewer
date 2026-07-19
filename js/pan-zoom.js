/* ============================================================
   panzoom.js — Pan & Zoom controller for a PIXI Application
   ============================================================
   Usage:
     window.initPanZoom(app, viewContainer, toggleBtnId, resetBtnId)

   Exposes:
     window.isPanModeActive() — returns current pan/zoom mode state

   The toggle button state is persisted in sessionStorage.
   ============================================================ */

(function () {
  'use strict';

  let app = null;
  let isPanMode = localStorage.getItem('panMode') === 'true';
  let isDragging = false;
  let lastPos = { x: 0, y: 0 };
  
  // Touch tracking for pinch-to-zoom
  const activePointers = new Map();
  let initialPinchDistance = null;
  let initialScale = 1;
  let pinchCenter = { x: 0, y: 0 };

  function clampStage() {
    const s = app.stage.scale.x || 1;
    if (s > 1) return; // free pan when zoomed in
    const model = app.stage.children[0];
    const mx = model ? model.x : app.screen.width / 2;
    const my = model ? model.y : app.screen.height / 2;
    const mgX = app.screen.width * 0.3 / s;
    const mgY = app.screen.height * 0.3 / s;
    const minX = -mx * s - mgX;
    const maxX = app.screen.width - mx * s + mgX;
    const minY = -my * s - mgY;
    const maxY = app.screen.height - my * s + mgY;
    app.stage.position.x = Math.max(minX, Math.min(app.stage.position.x, maxX));
    app.stage.position.y = Math.max(minY, Math.min(app.stage.position.y, maxY));
  }

  function initPanZoom(pixiApp, viewContainer, toggleBtnId, resetBtnId) {
    app = pixiApp;

    const panToggleBtn = document.getElementById(toggleBtnId);
    const resetBtn     = document.getElementById(resetBtnId);

    // ── Toggle button wiring ──
    if (panToggleBtn) {
      panToggleBtn.setAttribute('aria-pressed', isPanMode);
      viewContainer.classList.toggle('pan-mode', isPanMode);

      panToggleBtn.addEventListener('click', () => {
        isPanMode = !isPanMode;
        localStorage.setItem('panMode', isPanMode);
        panToggleBtn.setAttribute('aria-pressed', isPanMode);
        viewContainer.classList.toggle('pan-mode', isPanMode);
      });
    }

    // ── Reset view wiring ──
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        app.stage.position.set(0, 0);
        app.stage.scale.set(1, 1);
        if (typeof window.repositionLive2D === 'function') window.repositionLive2D();
        if (typeof window.repositionChibi   === 'function') window.repositionChibi();
      });
    }

    // ── Pointer drag & Pinch zoom ──
    app.view.addEventListener('pointerdown', e => {
      if (!isPanMode) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      
      if (activePointers.size === 1) {
        isDragging = true;
        lastPos = { x: e.clientX, y: e.clientY };
      } else if (activePointers.size === 2) {
        isDragging = false; // Disable single-finger drag during pinch
        const pts = Array.from(activePointers.values());
        initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        initialScale = app.stage.scale.x;
        pinchCenter = {
          x: (pts[0].x + pts[1].x) / 2,
          y: (pts[0].y + pts[1].y) / 2
        };
      }
    });

    window.addEventListener('pointermove', e => {
      if (!isPanMode || !activePointers.has(e.pointerId)) return;
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1 && isDragging) {
        if (window.__playgroundDragging) {
          lastPos = { x: e.clientX, y: e.clientY };
          return;
        }
        
        const dx = e.clientX - lastPos.x;
        const dy = e.clientY - lastPos.y;
        lastPos = { x: e.clientX, y: e.clientY };

        const rect   = app.view.getBoundingClientRect();
        const ratioX = app.screen.width  / rect.width;
        const ratioY = app.screen.height / rect.height;

        app.stage.position.x += dx * ratioX;
        app.stage.position.y += dy * ratioY;
        clampStage();
      } else if (activePointers.size === 2 && initialPinchDistance > 0) {
        const pts = Array.from(activePointers.values());
        const currentDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const scaleFactor = currentDistance / initialPinchDistance;
        
        const oldScale = app.stage.scale.x;
        let newScale = Math.min(Math.max(initialScale * scaleFactor, 0.2), 5.0);
        
        if (oldScale !== newScale) {
          const rect = app.view.getBoundingClientRect();
          const pointerX = (pinchCenter.x - rect.left) * (app.screen.width / rect.width);
          const pointerY = (pinchCenter.y - rect.top)  * (app.screen.height / rect.height);

          app.stage.position.x = pointerX - (pointerX - app.stage.position.x) * (newScale / oldScale);
          app.stage.position.y = pointerY - (pointerY - app.stage.position.y) * (newScale / oldScale);
          app.stage.scale.set(newScale);
          clampStage();
        }
      }
    });

    const removePointer = (e) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        initialPinchDistance = null;
      }
      if (activePointers.size === 1) {
        const remaining = Array.from(activePointers.values())[0];
        isDragging = true;
        lastPos = { x: remaining.x, y: remaining.y };
      } else if (activePointers.size === 0) {
        isDragging = false;
      }
    };

    window.addEventListener('pointerup', removePointer);
    window.addEventListener('pointercancel', removePointer);

    // ── Wheel zoom ──
    app.view.addEventListener('wheel', e => {
      if (!isPanMode) return;
      e.preventDefault();

      const scaleFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const oldScale = app.stage.scale.x;
      let newScale = Math.min(Math.max(oldScale * scaleFactor, 0.2), 5.0);

      // Zoom around the cursor position
      const rect     = app.view.getBoundingClientRect();
      const pointerX = (e.clientX - rect.left) * (app.screen.width  / rect.width);
      const pointerY = (e.clientY - rect.top)  * (app.screen.height / rect.height);

      app.stage.position.x = pointerX - (pointerX - app.stage.position.x) * (newScale / oldScale);
      app.stage.position.y = pointerY - (pointerY - app.stage.position.y) * (newScale / oldScale);
      app.stage.scale.set(newScale);
      clampStage();
    }, { passive: false });
  }

  window.initPanZoom   = initPanZoom;
  window.isPanModeActive = () => isPanMode;

})();
