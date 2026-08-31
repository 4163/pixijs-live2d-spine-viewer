// exporter.js: multi-format animation exporter (APNG, WebP, AVIF, GIF).
// Exposes window.exportModel(options) for devtools usage.

console.log(`
Usage (DevTools console):

  exportModel()                                    // APNG (default), current animation, auto-duration
  exportModel({ format: 'webp' })                  // Animated WebP (lossless, full alpha)
  exportModel({ format: 'avif' })                  // Animated AVIF (lossy, high compression, full alpha)
  exportModel({ format: 'avis' })                  // Alias
  exportModel({ format: 'gif' })                   // GIF (1-bit alpha via chroma-key)
  exportModel({ format: 'png' })                   // PNG snapshot (current frame, ignores duration/motion)
  exportModel({ motion: 'move' })                  // Specific Spine animation
  exportModel({ duration: 4000 })                  // Override duration (ms)
  exportModel({ scale: 2.0 })                      // 2× supersampling resolution
  exportModel({ maxSize: 1024 })                   // Cap output size (default: 2048)
  exportModel({ fps: 20 })                         // Lower FPS = smaller file
  exportModel({ padding: 0.2 })                    // 20% canvas padding (default: 0.2)
` );

(function () {
  'use strict';

  // Lazy library loader
  // Dynamically injects a <script> tag and returns a promise.
  // Libraries are loaded from local lib/exporter/, no CDN calls.
  function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  // APNG encoder backend
  async function encodeAPNG(frames, outW, outH, delayMs) {
    // UPNG.js requires pako for DEFLATE compression
    await loadScript('lib/exporter/pako.min.js', 'pako');
    await loadScript('lib/exporter/UPNG.js', 'UPNG');

    const bufs = frames.map(f => f.buffer);
    const dels = frames.map(() => Math.round(delayMs));

    console.log('Encoding APNG...');
    let lastPercent = -1;
    const pngArrayBuffer = await UPNG.encodeAsync(bufs, outW, outH, 0, dels, null, false, (progress) => {
      const pct = Math.round(progress * 100);
      if (pct >= lastPercent + 10) {
        console.log(`  encoding: ${pct}%`);
        lastPercent = pct;
      }
    });

    return {
      blob: new Blob([pngArrayBuffer], { type: 'image/png' }),
      ext: 'apng'
    };
  }

  // Animated WebP encoding is delegated to lib/exporter/webp-muxer.js,
  // loaded on demand from exportModel() below.

  // GIF encoder backend (chroma-key pipeline)
  async function encodeGIF(frames, outW, outH, delayMs) {
    await loadScript('lib/exporter/gif.js', 'GIF');

    // Load and patch the worker
    const workerRes = await fetch('lib/exporter/gif.worker.js');
    let workerText = await workerRes.text();

    // PATCH: gif.js has a known bug where NeuQuant's lookupRGB and findClosest
    // disagree on exact color indices. Force the transparency finder to use the
    // same lookup logic.
    workerText = workerText.replace(
      /if\(this\.neuQuant&&!used\)\{return this\.neuQuant\.lookupRGB\(r,g,b\)\}/,
      'if(this.neuQuant){return this.neuQuant.lookupRGB(r,g,b)}'
    );

    const workerBlob = new Blob([workerText], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(workerBlob);

    const transparentColor = 0xFF00FF;

    const gif = new GIF({
      workers: 2,
      quality: 10,
      width: outW,
      height: outH,
      workerScript: workerUrl,
      transparent: transparentColor
    });

    // GIF requires special pixel processing:
    // 1. Un-premultiply alpha (WebGL pre-multiplies)
    // 2. Force alpha=0 pixels to magenta chroma-key
    for (const rgbaData of frames) {
      const pixels = new Uint8Array(rgbaData.buffer);
      for (let p = 0; p < pixels.length; p += 4) {
        const a = pixels[p + 3];
        if (a === 0) {
          pixels[p] = 255;     // R (Magenta)
          pixels[p + 1] = 0;   // G
          pixels[p + 2] = 255; // B
          pixels[p + 3] = 255; // Force opaque for GIF encoder
        } else if (a < 255) {
          pixels[p] = Math.round((pixels[p] * 255) / a);
          pixels[p + 1] = Math.round((pixels[p + 1] * 255) / a);
          pixels[p + 2] = Math.round((pixels[p + 2] * 255) / a);
        }
      }
      const idata = new ImageData(new Uint8ClampedArray(pixels.buffer), outW, outH);
      gif.addFrame(idata, { delay: delayMs });
    }

    console.log('Encoding GIF...');

    return new Promise((resolve) => {
      let lastPercent = -1;
      gif.on('progress', function (p) {
        const percent = Math.round(p * 100);
        if (percent >= lastPercent + 10) {
          console.log(`  encoding: ${percent}%`);
          lastPercent = percent;
        }
      });

      gif.on('finished', function (blob) {
        URL.revokeObjectURL(workerUrl);
        resolve({ blob, ext: 'gif' });
      });

      gif.render();
    });
  }

  // AVIF encoder backend (WASM libavif + custom ISOBMFF muxer)
  // Uses @jsquash/avif WASM encoder (from Google Squoosh) to produce valid
  // still AVIF frames, then extracts AV1 data and assembles an animated container.
  async function encodeAVIF(frames, outW, outH, fps) {
    await loadScript('lib/exporter/avif-encoder.js', 'encodeStillAVIF');
    console.log('Encoding AVIF (WASM)...');

    // ── ISOBMFF helpers ──
    function u32be(v) { return [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff]; }
    function u16be(v) { return [(v >>> 8) & 0xff, v & 0xff]; }
    function asciiBytes(s) { return Array.from(s).map(c => c.charCodeAt(0)); }
    function flatten(items) {
      const res = [];
      for (const item of items) {
        if (item instanceof Uint8Array) res.push(...item);
        else if (Array.isArray(item)) res.push(...flatten(item));
        else res.push(item);
      }
      return res;
    }
    function makeBox(type, ...payloads) {
      const body = flatten(payloads);
      return new Uint8Array([...u32be(8 + body.length), ...asciiBytes(type), ...body]);
    }
    function makeFullBox(type, version, flags, ...payloads) {
      return makeBox(type, version, ...u32be(flags).slice(1), ...payloads);
    }

    // Extract raw AV1 data and av1C config from a still AVIF ArrayBuffer
    function extractAV1FromAVIF(buf) {
      const bytes = new Uint8Array(buf);
      const view = new DataView(buf);
      let av1CRecords = [];
      let ilocData = null;

      for (let i = 0; i < bytes.length - 8; i++) {
        if (bytes[i+4] === 0x61 && bytes[i+5] === 0x76 && bytes[i+6] === 0x31 && bytes[i+7] === 0x43) { // 'av1C'
          const sz = view.getUint32(i);
          if (sz >= 12 && sz < 100 && i + sz <= bytes.length) {
            av1CRecords.push(bytes.slice(i + 8, i + sz));
          }
        }
        if (bytes[i+4] === 0x69 && bytes[i+5] === 0x6C && bytes[i+6] === 0x6F && bytes[i+7] === 0x63) { // 'iloc'
          const sz = view.getUint32(i);
          ilocData = bytes.slice(i + 8, i + sz);
        }
      }

      let colorData = null;
      let alphaData = null;

      if (ilocData) {
        const iv = new DataView(ilocData.buffer, ilocData.byteOffset, ilocData.byteLength);
        const version = ilocData[0];
        let p = 4;
        const offLen = ilocData[p]; p++;
        const offsetSize = (offLen >> 4) & 15;
        const lengthSize = offLen & 15;
        const baseOffSize = (ilocData[p] >> 4) & 15; p++;
        const itemCount = version < 2 ? iv.getUint16(p) : iv.getUint16(p); p += 2;

        for (let i = 0; i < itemCount; i++) {
          const itemId = version < 2 ? iv.getUint16(p) : iv.getUint16(p); p += 2;
          if (version === 1 || version === 2) p++; // method
          p += 2; // data_ref
          p += baseOffSize;
          const extCount = iv.getUint16(p); p += 2;
          for (let e = 0; e < extCount; e++) {
            const extOffset = offsetSize === 4 ? iv.getUint32(p) : iv.getUint16(p); p += offsetSize;
            const extLen = lengthSize === 4 ? iv.getUint32(p) : iv.getUint16(p); p += lengthSize;
            const slice = bytes.slice(extOffset, extOffset + extLen);
            if (itemId === 1) colorData = slice;
            if (itemId === 2) alphaData = slice;
          }
        }
      }
      return { colorData, alphaData, colorAv1C: av1CRecords[0], alphaAv1C: av1CRecords[1] };
    }

    // ── Encode each frame via WASM, extract AV1 data ──
    const av1Frames = [];
    const alphaFrames = [];
    let colorConfig = null;
    let alphaConfig = null;

    for (let i = 0; i < frames.length; i++) {
      const imgData = new ImageData(new Uint8ClampedArray(frames[i].buffer), outW, outH);
      const avifBuf = await window.encodeStillAVIF(imgData, { quality: 63, qualityAlpha: 63, speed: 6, subsample: 3 });

      const res = extractAV1FromAVIF(avifBuf);
      if (!res.colorData) throw new Error('Could not extract AV1 data from WASM-encoded AVIF frame ' + i);
      
      av1Frames.push(res.colorData);
      if (res.alphaData) alphaFrames.push(res.alphaData);
      
      if (!colorConfig && res.colorAv1C) colorConfig = res.colorAv1C;
      if (!alphaConfig && res.alphaAv1C) alphaConfig = res.alphaAv1C;

      if (i % 5 === 0) {
        console.log(`  encoding: ${Math.round((i / frames.length) * 100)}%`);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    console.log(`  encoded ${av1Frames.length} frames, building container...`);

    // ── Build ISOBMFF container ──
    const frameDur = 600; // duration per frame in timescale units
    const timescale = fps * frameDur;
    const totalDuration = frames.length * frameDur;
    const hasAlpha = alphaFrames.length === frames.length;

    // ftyp
    const ftypBox = makeBox('ftyp',
      asciiBytes('avis'), u32be(0),
      asciiBytes('avis'), asciiBytes('avif'), asciiBytes('mif1'), asciiBytes('miaf'), asciiBytes('iso8')
    );

    // mdat: chunk 1 (all color frames), chunk 2 (all alpha frames)
    let mdatPayloadSize = 0;
    const colorSampleSizes = [];
    for (const f of av1Frames) { colorSampleSizes.push(f.length); mdatPayloadSize += f.length; }
    
    const alphaSampleSizes = [];
    if (hasAlpha) {
      for (const f of alphaFrames) { alphaSampleSizes.push(f.length); mdatPayloadSize += f.length; }
    }

    const mdatBox = new Uint8Array(8 + mdatPayloadSize);
    new DataView(mdatBox.buffer).setUint32(0, mdatBox.length);
    mdatBox[4] = 0x6D; mdatBox[5] = 0x64; mdatBox[6] = 0x61; mdatBox[7] = 0x74;
    
    let mc = 8;
    for (const f of av1Frames) { mdatBox.set(f, mc); mc += f.length; }
    const colorChunkOffset = 8;
    
    let alphaChunkOffset = 0;
    if (hasAlpha) {
      alphaChunkOffset = mc;
      for (const f of alphaFrames) { mdatBox.set(f, mc); mc += f.length; }
    }

    function createTrack(trackId, isAlpha, refTrackId) {
      const sizes = isAlpha ? alphaSampleSizes : colorSampleSizes;
      const av1C = isAlpha ? alphaConfig : colorConfig;
      const chunkOffset = isAlpha ? alphaChunkOffset : colorChunkOffset;
      const auxCBox = isAlpha ? makeBox('auxC', asciiBytes('urn:mpeg:mpegB:cicp:systems:auxiliary:alpha'), [0,0,0,0]) : [];
      
      const tkhdBox = makeFullBox('tkhd', 0, 3,
        u32be(0), u32be(0), u32be(trackId), u32be(0), u32be(totalDuration),
        new Array(8).fill(0), u16be(0), u16be(0), u16be(0), u16be(0),
        [0,1,0,0,0,0].flatMap(v => u32be(v === 1 ? 0x00010000 : v)),
        u32be(0), u32be(0), u32be(0x40000000),
        u32be(outW << 16), u32be(outH << 16)
      );

      const trefBox = isAlpha ? makeBox('tref', makeBox('auxl', u32be(refTrackId))) : [];

      const mdhdBox = makeFullBox('mdhd', 0, 0, u32be(0), u32be(0), u32be(timescale), u32be(totalDuration), u16be(0x55C4), u16be(0));
      const hdlrBox = makeFullBox('hdlr', 0, 0, u32be(0), asciiBytes('vide'), u32be(0), u32be(0), u32be(0), 0);
      const vmhdBox = makeFullBox('vmhd', 0, 1, u16be(0), u16be(0), u16be(0), u16be(0));
      const dinfBox = makeBox('dinf', makeFullBox('dref', 0, 0, u32be(1), makeFullBox('url ', 0, 1)));
      
      const av01Entry = makeBox('av01',
        new Array(6).fill(0), u16be(1), u16be(0), u16be(0), u32be(0), u32be(0), u32be(0),
        u16be(outW), u16be(outH), u32be(0x00480000), u32be(0x00480000), u32be(0), u16be(1),
        new Array(32).fill(0), u16be(0x0018), [0xFF, 0xFF],
        makeBox('av1C', ...Array.from(av1C || [0x81,0,12,0])),
        auxCBox
      );
      
      const stsdBox = makeFullBox('stsd', 0, 0, u32be(1), av01Entry);
      const sttsBox = makeFullBox('stts', 0, 0, u32be(1), u32be(frames.length), u32be(frameDur));
      const stssEntries = []; for(let i=0; i<frames.length; i++) stssEntries.push(...u32be(i+1));
      const stssBox = makeFullBox('stss', 0, 0, u32be(frames.length), stssEntries);
      const stscBox = makeFullBox('stsc', 0, 0, u32be(1), u32be(1), u32be(frames.length), u32be(1));
      const stszEntries = sizes.flatMap(s => u32be(s));
      const stszBox = makeFullBox('stsz', 0, 0, u32be(0), u32be(frames.length), stszEntries);
      
      // We will patch the chunk offset later
      const stcoBox = makeFullBox('stco', 0, 0, u32be(1), u32be(chunkOffset));

      const stblBox = makeBox('stbl', stsdBox, sttsBox, stssBox, stscBox, stszBox, stcoBox);
      const minfBox = makeBox('minf', vmhdBox, dinfBox, stblBox);
      const mdiaBox = makeBox('mdia', mdhdBox, hdlrBox, minfBox);
      return makeBox('trak', tkhdBox, trefBox, mdiaBox);
    }

    const mvhdBox = makeFullBox('mvhd', 0, 0,
      u32be(0), u32be(0), u32be(timescale), u32be(totalDuration),
      [0x00, 0x01, 0x00, 0x00], [0x01, 0x00], new Array(10).fill(0),
      [0,1,0,0,0,0].flatMap(v => u32be(v === 1 ? 0x00010000 : v)),
      u32be(0), u32be(0), u32be(0x40000000), new Array(24).fill(0), u32be(hasAlpha ? 3 : 2)
    );

    const trak1Box = createTrack(1, false, 0);
    const trak2Box = hasAlpha ? createTrack(2, true, 1) : [];
    const moovBox = makeBox('moov', mvhdBox, trak1Box, trak2Box);

    // ── meta box (HEIF primary item for poster frame) ──
    const metaHdlr = makeFullBox('hdlr', 0, 0, u32be(0), asciiBytes('pict'), u32be(0), u32be(0), u32be(0), 0);
    const pitmBox = makeFullBox('pitm', 0, 0, u16be(1));
    const ispeBox = makeFullBox('ispe', 0, 0, u32be(outW), u32be(outH));
    const pixiBox = makeFullBox('pixi', 0, 0, 3, 8, 8, 8);
    const av1CMetaBox = makeBox('av1C', ...Array.from(colorConfig || [0x81,0,12,0]));
    
    // Minimal iprp mapping for the primary item
    const ipcoBox = makeBox('ipco', ispeBox, pixiBox, av1CMetaBox);
    const ipmaBox = makeFullBox('ipma', 0, 0, u32be(1), u16be(1), 3, 0x01, 0x02, 0x03);
    const iprpBox = makeBox('iprp', ipcoBox, ipmaBox);
    const infeBox = makeFullBox('infe', 2, 0, u16be(1), u16be(0), asciiBytes('av01'), 0);
    const iinfBox = makeFullBox('iinf', 0, 0, u16be(1), infeBox);
    
    // The iloc needs to point to the first frame of the color track in mdat
    const ilocBox = makeFullBox('iloc', 0, 0,
      0x44, 0x00, u16be(1), u16be(1), u16be(0), u16be(1), u32be(0), u32be(0)
    );
    const metaBox = makeFullBox('meta', 0, 0, metaHdlr, pitmBox, ilocBox, iinfBox, iprpBox);

    // ── Assemble: ftyp + meta + moov + mdat ──
    const totalSize = ftypBox.length + metaBox.length + moovBox.length + mdatBox.length;
    const out = new Uint8Array(totalSize);
    let p = 0;
    out.set(ftypBox, p); p += ftypBox.length;
    out.set(metaBox, p); const metaOff = p; p += metaBox.length;
    out.set(moovBox, p); const moovOff = p; p += moovBox.length;
    out.set(mdatBox, p); const mdatOff = p;

    const ov = new DataView(out.buffer);
    const mdatDataStart = mdatOff; // absolute offset to start of mdat box

    // Patch stco for all tracks
    let chunkIndex = 0;
    for (let i = moovOff; i < moovOff + moovBox.length - 8; i++) {
      if (ov.getUint32(i + 4) === 0x7374636F) {
        const originalOffset = ov.getUint32(i + 16);
        ov.setUint32(i + 16, mdatDataStart + originalOffset);
        chunkIndex++;
      }
    }
    // Patch iloc
    for (let i = metaOff; i < metaOff + metaBox.length - 8; i++) {
      if (ov.getUint32(i + 4) === 0x696C6F63) {
        ov.setUint32(i + 22, mdatDataStart + 8); // point to first frame
        ov.setUint32(i + 26, colorSampleSizes[0]);
        break;
      }
    }

    return {
      blob: new Blob([out], { type: 'image/avif' }),
      ext: 'avif'
    };
  }

  // Main exporter: shared capture loop + format dispatch
  window.exportModel = async function (options = {}) {
    let format = (options.format || 'apng').toLowerCase();
    if (format === 'avis') format = 'avif';
    if (!['apng', 'webp', 'gif', 'png', 'avif'].includes(format)) {
      return console.error(`exportModel: Unknown format '${format}'. Use 'apng', 'webp', 'avif', 'gif', or 'png'.`);
    }

    const fps = options.fps || 30;
    const maxSize = options.maxSize || 2048;
    const scale = options.scale || 1.0;
    const padding = options.padding !== undefined ? options.padding : 0.2;

    const app = window.__sharedApp;
    if (!app) return console.error("exportModel: No PIXI app found.");

    const model = app.stage.children.find(c => c.internalModel || c.skeleton);
    if (!model) return console.error("exportModel: No model found on stage.");

    const isSpine = !!(model.skeleton && model.state);
    const isLive2D = !!(model.internalModel);

    console.log(`Exporting as ${format.toUpperCase()}...`);

    // Detect current animation & duration
    let durationSeconds = (options.duration || 2000) / 1000;
    let motionName = options.motion;

    function getAnimCfg(name) {
      const vc = window.VIEWER_CONFIG || {};
      const sa = vc.spineAnim || {};
      const modelId = model._entryId || '';
      const perModel = sa[modelId] || {};
      const globalCfg = sa['global'] || {};
      return perModel[name] || globalCfg[name] || null;
    }

    // Reset Live2D focus (mouse tracking) so the character looks straight ahead during export
    if (isLive2D && model.internalModel && model.internalModel.focusController) {
      model._preExportFocusX = model.internalModel.focusController.x;
      model._preExportFocusY = model.internalModel.focusController.y;
      model.internalModel.focusController.focus(0, 0);
      // Instantly snap to 0,0 so we don't capture the slow head-turning transition
      model.internalModel.focusController.x = 0;
      model.internalModel.focusController.y = 0;
    }

    if (format !== 'png') {
      if (isSpine) {
        const currentTrack = model.state.getCurrent(0);
        const currentAnimName = currentTrack && currentTrack.animation
          ? currentTrack.animation.name : 'wait';
        motionName = motionName || currentAnimName;
      // Store to restore after capture
      model._preExportAnim = currentAnimName;

      // Reverse-lookup: if the user triggered the export while the followUp was already playing,
      // we want to rewind and capture the entire sequence starting from the parent motion!
      if (!options.motion) {
        const vc = window.VIEWER_CONFIG || {};
        const sa = vc.spineAnim || {};
        const allCfgs = Object.assign({}, sa['global'] || {}, sa[model._entryId] || {});
        for (const key in allCfgs) {
          if (allCfgs[key].followUp === motionName) {
            console.log(`Detected followUp '${motionName}', rewinding to parent motion '${key}'`);
            motionName = key;
            break;
          }
        }
      }

      const animData = model.skeleton.data.findAnimation(motionName);
      if (animData) {
        durationSeconds = animData.duration;
        console.log(`Spine animation '${motionName}' duration: ${durationSeconds.toFixed(3)}s`);
      } else {
        console.warn(`Animation '${motionName}' not found in skeleton data, using ${durationSeconds}s fallback.`);
      }

      let followUpName = null;
      const animCfg = getAnimCfg(motionName);
      if (animCfg && animCfg.followUp) {
        followUpName = animCfg.followUp;
        const followUpData = model.skeleton.data.findAnimation(followUpName);
        if (followUpData) {
          durationSeconds += followUpData.duration;
          console.log(`Spine followUp '${followUpName}' added. Total duration: ${durationSeconds.toFixed(3)}s`);
        }
      }

      // Reset skeleton to clear any residual bone positions from previously played animations
      model.skeleton.setToSetupPose();
      model.state.setAnimationByName(0, motionName, false);

      if (followUpName) {
        model.state.addAnimationByName(0, followUpName, false, 0);
      }
    } else if (isLive2D) {
      motionName = motionName || 'idle';

      if (!options.duration) {
        try {
          const motionGroups = model.internalModel.motionManager.motionGroups;
          const group = motionGroups[motionName];
          if (group && group.length > 0) {
            const m = group[0];
            let mDuration = m.duration || m._duration;
            if (mDuration === undefined && typeof m.getDuration === 'function') mDuration = m.getDuration();
            if (mDuration === undefined && typeof m.getDurationMSec === 'function') mDuration = m.getDurationMSec() / 1000;
            if (mDuration === undefined && m._motionData && m._motionData.duration) mDuration = m._motionData.duration;

            if (typeof mDuration === 'number' && !isNaN(mDuration) && mDuration > 0) {
              // If duration is extremely large, it's likely in milliseconds
              if (mDuration > 100) mDuration = mDuration / 1000;
              durationSeconds = mDuration;
              console.log(`Detected Live2D motion '${motionName}' duration: ${durationSeconds.toFixed(3)}s`);
            }
          }
        } catch (e) {
          console.warn("Could not auto-detect live2d motion duration:", e);
        }
      }

      try {
        model.motion(motionName);
        console.log(`Started Live2D motion '${motionName}'. Using ${durationSeconds.toFixed(3)}s duration.`);
      } catch (e) { console.warn("Could not play live2d motion:", e); }
      }
    }

    // Calculate stable bounds & apply padding
    let nativeW, nativeH;
    let originX = 0, originY = 0;

    // We calculate bounds exactly ONCE here to establish a stable camera.
    // If we recalculated inside the loop, the camera would track the model's movement (moonwalking).
    if (isLive2D) {
      nativeW = model.internalModel.originalWidth;
      nativeH = model.internalModel.originalHeight;
      originX = nativeW * (model.anchor ? model.anchor.x : 0);
      originY = nativeH * (model.anchor ? model.anchor.y : 0);
    } else {
      const b = model.getLocalBounds();
      nativeW = b.width;
      nativeH = b.height;
      originX = -b.x;
      originY = -b.y;
    }

    // Apply any manual layout offsets from config.js so the framing matches the viewport adjustments
    const vc = window.VIEWER_CONFIG || {};
    const entryCfg = (vc.layout && vc.layout[model._entryId]) || {};
    if (entryCfg.offsetX) originX += entryCfg.offsetX * nativeW;
    if (entryCfg.offsetY) originY += entryCfg.offsetY * nativeH;

    // Apply padding to canvas size
    const paddedW = nativeW * (1 + padding);
    const paddedH = nativeH * (1 + padding);

    // Shift the stable origin so the model sits perfectly in the padded center
    originX += (nativeW * padding) / 2;
    originY += (nativeH * padding) / 2;

    // Apply scale multiplier, then downscale if resolution exceeds maxSize
    let renderScale = scale;
    if (paddedW * renderScale > maxSize || paddedH * renderScale > maxSize) {
      renderScale = maxSize / Math.max(paddedW, paddedH);
      console.log(`Size exceeds maxSize ${maxSize}, scaling clamped to ${Math.round(renderScale * 100)}%.`);
    }

    const outW = Math.ceil(paddedW * renderScale);
    const outH = Math.ceil(paddedH * renderScale);
    const delayMs = 1000 / fps;
    const deltaSec = 1 / fps;
    const framesCount = format === 'png' ? 1 : Math.max(1, Math.round(fps * durationSeconds));

    console.log(`Output ${format.toUpperCase()}: ${outW}×${outH} @ ${fps}fps, ${durationSeconds.toFixed(2)}s, ${framesCount} frames`);

    // Prepare render target
    const renderTexture = PIXI.RenderTexture.create({ width: outW, height: outH });

    // For Spine: disable autoUpdate so autoUpdateTransform (which uses Date.now()) doesn't interfere
    const wasSpineAutoUpdate = isSpine ? model.autoUpdate : undefined;
    if (isSpine) model.autoUpdate = false;

    // Stop PIXI.Ticker.shared to prevent Live2D's registered update from double-advancing.
    // We intentionally keep app.ticker running so the screen stays visually responsive.
    const sharedWasRunning = PIXI.Ticker.shared.started;
    PIXI.Ticker.shared.stop();

    console.log(`Capturing ${framesCount} frames...`);
    const captureStart = performance.now();

    // Frame capture loop
    const capturedFrames = [];

    for (let i = 0; i < framesCount; i++) {
      const oldScaleX = model.scale.x, oldScaleY = model.scale.y;
      const oldX = model.x, oldY = model.y;

      model.scale.set(renderScale);
      // Use the pre-calculated, stable origin
      model.x = originX * renderScale;
      model.y = originY * renderScale;

      if (format !== 'png') {
        if (isSpine) {
          model.update(deltaSec);
        } else if (isLive2D) {
          // PIXI.Ticker.shared.deltaMS can be 0 if the ticker is stopped, which would result in Infinity!
          // We use a fixed 16.6666ms (60fps) standard frame delta to avoid NaN explosions.
          model.update(delayMs / 16.6666);
        }
      }

      // Render with a pure transparent background
      app.renderer.render(model, { renderTexture, clear: true });

      model.scale.set(oldScaleX, oldScaleY);
      model.x = oldX;
      model.y = oldY;

      // Extract raw WebGL pixels (RGBA Uint8Array)
      const pixels = app.renderer.extract.pixels(renderTexture);

      // Un-premultiply alpha for all formats (WebGL natively pre-multiplies)
      // For GIF, the chroma-key transform happens in the GIF encoder backend instead.
      if (format !== 'gif') {
        for (let p = 0; p < pixels.length; p += 4) {
          const a = pixels[p + 3];
          if (a === 0) {
            pixels[p] = 0;
            pixels[p + 1] = 0;
            pixels[p + 2] = 0;
          } else if (a < 255) {
            // Must use Math.min(255) to prevent Uint8Array overflow wrap-around (neon color glitch)
            pixels[p] = Math.min(255, Math.round((pixels[p] * 255) / a));
            pixels[p + 1] = Math.min(255, Math.round((pixels[p + 1] * 255) / a));
            pixels[p + 2] = Math.min(255, Math.round((pixels[p + 2] * 255) / a));
          }
        }
      }

      capturedFrames.push(pixels);

      if (i % 5 === 0) {
        console.log(`  frame ${i + 1}/${framesCount}`);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    const captureMs = (performance.now() - captureStart).toFixed(0);
    console.log(`Capture done (${captureMs}ms). Encoding ${format.toUpperCase()}...`);

    // Restore animation systems
    if (isSpine) {
      if (wasSpineAutoUpdate !== undefined) model.autoUpdate = wasSpineAutoUpdate;
      // Restart the exact animation it was playing previously
      try {
        if (model._preExportAnim) model.state.setAnimationByName(0, model._preExportAnim, true);
      } catch (e) {}
    }
    if (sharedWasRunning) PIXI.Ticker.shared.start();

    // For Live2D: restart idle motion and restore pointer focus tracking
    if (isLive2D) {
      try { model.motion('idle'); } catch(e) {}

      if (model.internalModel && model.internalModel.focusController && model._preExportFocusX !== undefined) {
        model.internalModel.focusController.focus(model._preExportFocusX, model._preExportFocusY);
        delete model._preExportFocusX;
        delete model._preExportFocusY;
      }
    }

    // Safety net: force a render tick to ensure the screen repaints
    requestAnimationFrame(() => app.renderer.render(app.stage));

    // Encode to requested format
    let result;
    if (format === 'png') {
      console.log('Encoding PNG...');
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      const imgData = new ImageData(new Uint8ClampedArray(capturedFrames[0]), outW, outH);
      ctx.putImageData(imgData, 0, 0);
      result = await new Promise(resolve => canvas.toBlob(blob => resolve({ blob, ext: 'png' }), 'image/png'));
    } else if (format === 'webp') {
      await loadScript('lib/exporter/webp-muxer.js', 'encodeAnimatedWebP');
      result = await window.encodeAnimatedWebP(capturedFrames, outW, outH, delayMs);
    } else if (format === 'avif') {
      result = await encodeAVIF(capturedFrames, outW, outH, fps);
    } else if (format === 'apng') {
      result = await encodeAPNG(capturedFrames, outW, outH, delayMs);
    } else {
      result = await encodeGIF(capturedFrames, outW, outH, delayMs);
    }

    const sizeMB = (result.blob.size / 1024 / 1024).toFixed(2);
    console.log(`Encoding finished! ${sizeMB} MB`);

    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `export_${Date.now()}.${result.ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    renderTexture.destroy(true);
  };

})();
