/**
 * cache.js — Model Asset Cache
 * 
 * Provides an in-memory cache for Live2D and Spine assets to prevent 
 * redundant network requests when switching between previously loaded models.
 * Patches PIXI.live2d.XHRLoader and window.fetch globally.
 */
(function () {
  'use strict';

  // ── Model asset cache (in-memory, per session) ────────────
  var cache = Object.create(null);
  window.__MODEL_CACHE = cache;

  // Patch 1: Live2D models via XHRLoader.loader middleware
  // pixi-live2d-display loads all Live2D model files (model JSON, .moc/moc3,
  // textures, motions, physics, pose, expressions) through this middleware.
  (function () {
    var X = PIXI && PIXI.live2d && PIXI.live2d.XHRLoader;
    if (!X || typeof X.loader !== 'function') return;
    var origLoader = X.loader;
    var patchedLoader = function (options, next) {
      var url = options.settings
        ? options.settings.resolveURL(options.url)
        : options.url;
      var cached = cache[url];
      if (cached !== undefined) {
        options.result = cached;
        return Promise.resolve(next());
      }
      return origLoader(options, next).then(function () {
        cache[url] = options.result;
      });
    };
    X.loader = patchedLoader;
    var D = PIXI.live2d.Live2DLoader;
    if (D && Array.isArray(D.middlewares)) {
      for (var i = 0; i < D.middlewares.length; i++) {
        if (D.middlewares[i] === origLoader) {
          D.middlewares[i] = patchedLoader;
        }
      }
    }
  })();

  // Patch 2: Spine models via fetch() interception
  // chibi.js uses fetch() directly (not via XHRLoader) for skeleton.skel and
  // atlas.txt.  spritemap.png is loaded via new Image() and is cached by the
  // browser's HTTP cache automatically.
  (function () {
    var origFetch = window.fetch;
    if (typeof origFetch !== 'function') return;
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : input && input.url;
      if (url && /(skel|atlas(_dorm)?\.txt)$/i.test(url)) {
        var cached = cache[url];
        if (cached !== undefined) {
          return Promise.resolve(new Response(cached.body, {
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': cached.type }
          }));
        }
        return origFetch.call(this, input, init).then(function (response) {
          if (!response.ok) return response;
          response.clone().arrayBuffer().then(function (buf) {
            cache[url] = { body: buf, type: response.headers.get('content-type') || '' };
          });
          return response;
        });
      }
      return origFetch.call(this, input, init);
    };
  })();

})();
