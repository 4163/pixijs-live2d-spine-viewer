/**
 * canvas-resize.js
 * Generic canvas resize handler for PixiJS applications.
 * 
 * Uses ResizeObserver to resize the WebGL renderer without causing blank-frame
 * flickers, which can happen with PIXI's built-in `resizeTo`.
 * 
 * @param {PIXI.Application} app - The PIXI application instance.
 * @param {HTMLElement} containerElement - The DOM element to observe for resize.
 * @param {Array<Function>} onResizeCallbacks - Optional array of functions to call after resize but before render.
 * @returns {ResizeObserver} - The created observer instance.
 */
(function () {
  'use strict';

  window.initCanvasResize = function (app, containerElement, onResizeCallbacks = []) {
    function resizeCanvas() {
      const rect = containerElement.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      if (w > 0 && h > 0 && (app.screen.width !== w || app.screen.height !== h)) {
        app.renderer.resize(w, h);
        
        onResizeCallbacks.forEach(cb => {
          if (typeof cb === 'function') {
            cb();
          }
        });
        
        app.ticker.update();
      }
    }

    // Force initial size synchronously before observer first fires
    resizeCanvas();

    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(containerElement);
    
    return ro;
  };
})();
