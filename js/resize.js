// resize.js: generic canvas resize handler for PixiJS apps.
// Uses ResizeObserver instead of PIXI's built-in `resizeTo`, which avoids
// blank-frame flickers on renderer resize.
//
// initCanvasResize(app, containerElement, onResizeCallbacks)
//   app:                PIXI.Application instance
//   containerElement:   DOM element to observe for resizes
//   onResizeCallbacks:  optional functions run after resize, before next render
// Returns the ResizeObserver instance.
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
