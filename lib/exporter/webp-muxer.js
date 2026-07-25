(function (global) {
  'use strict';

  // Helper: write a string as ASCII bytes into a DataView
  function writeStr(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  // Convert a single RGBA frame to a lossless WebP blob via offscreen canvas
  function frameToWebPBlob(rgbaData, w, h) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const imgData = new ImageData(new Uint8ClampedArray(rgbaData.buffer), w, h);
      ctx.putImageData(imgData, 0, 0);
      canvas.toBlob(resolve, 'image/webp', 1.0); // 1.0 = lossless
    });
  }

  // Extract the raw VP8/VP8L bitstream from a single-frame WebP file
  function extractWebPBitstream(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    // RIFF header: "RIFF" + size + "WEBP"
    // Then chunks follow. We need the VP8, VP8L, or VP8X chunk.
    let offset = 12; // skip past "RIFF" (4) + fileSize (4) + "WEBP" (4)
    while (offset < arrayBuffer.byteLength) {
      const chunkId = String.fromCharCode(
        view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3)
      );
      const chunkSize = view.getUint32(offset + 4, true); // little-endian
      if (chunkId === 'VP8 ' || chunkId === 'VP8L') {
        // Return the chunk header + data as a single block
        const totalSize = 8 + chunkSize + (chunkSize % 2); // pad to even
        return {
          id: chunkId,
          data: new Uint8Array(arrayBuffer, offset, 8 + chunkSize),
          paddedSize: totalSize
        };
      }
      // Skip to next chunk (8 bytes header + data + optional padding byte)
      offset += 8 + chunkSize + (chunkSize % 2);
    }
    throw new Error('No VP8/VP8L chunk found in WebP frame');
  }

  async function encodeAnimatedWebP(frames, outW, outH, delayMs) {
    console.log('Encoding individual WebP frames...');

    // Step 1: Encode each RGBA frame as a standalone WebP blob
    const webpBlobs = [];
    for (let i = 0; i < frames.length; i++) {
      const blob = await frameToWebPBlob(frames[i], outW, outH);
      if (!blob) throw new Error(`Browser failed to encode frame ${i} as WebP. Your browser may not support WebP encoding.`);
      webpBlobs.push(blob);
      if (i % 10 === 0) {
        console.log(`  WebP frame ${i + 1}/${frames.length}`);
        await new Promise(r => setTimeout(r, 0));
      }
    }

    // Step 2: Read each blob as ArrayBuffer and extract the VP8/VP8L bitstream
    const bitstreamChunks = [];
    for (const blob of webpBlobs) {
      const ab = await blob.arrayBuffer();
      bitstreamChunks.push(extractWebPBitstream(ab));
    }

    console.log('Muxing animated WebP container...');

    // Step 3: Build the animated WebP RIFF container
    //
    // Structure:
    //   RIFF header (12 bytes)
    //   VP8X chunk  (18 bytes: 8 header + 10 payload)
    //   ANIM chunk  (14 bytes: 8 header + 6 payload)
    //   ANMF chunks (24 byte header each + embedded VP8/VP8L data)

    const delay = Math.round(delayMs);

    // Calculate ANMF chunk sizes
    let anmfTotalSize = 0;
    for (const chunk of bitstreamChunks) {
      // ANMF chunk = 8 (chunk header) + 16 (ANMF payload header) + bitstream data
      const bitstreamLen = chunk.data.byteLength;
      const anmfPayload = 16 + bitstreamLen;
      const anmfChunkSize = 8 + anmfPayload + (anmfPayload % 2);
      anmfTotalSize += anmfChunkSize;
    }

    const fileSize = 4 + 18 + 14 + anmfTotalSize; // "WEBP" + VP8X + ANIM + ANMFs
    const buffer = new ArrayBuffer(12 + fileSize - 4); // RIFF(4) + size(4) + rest
    const totalBuf = new ArrayBuffer(8 + fileSize); // Full file
    const view = new DataView(totalBuf);
    const bytes = new Uint8Array(totalBuf);

    let pos = 0;

    // RIFF header
    writeStr(view, pos, 'RIFF'); pos += 4;
    view.setUint32(pos, fileSize, true); pos += 4;
    writeStr(view, pos, 'WEBP'); pos += 4;

    // VP8X chunk (extended file format — required for animation)
    writeStr(view, pos, 'VP8X'); pos += 4;
    view.setUint32(pos, 10, true); pos += 4; // chunk payload size = 10
    // Flags: bit 1 = animation, bit 4 = alpha
    view.setUint32(pos, (1 << 1) | (1 << 4), true); pos += 4;
    // Canvas width - 1 (24-bit LE, stored in 3 bytes)
    const cw = outW - 1, ch = outH - 1;
    bytes[pos] = cw & 0xFF; bytes[pos + 1] = (cw >> 8) & 0xFF; bytes[pos + 2] = (cw >> 16) & 0xFF; pos += 3;
    // Canvas height - 1 (24-bit LE, stored in 3 bytes)
    bytes[pos] = ch & 0xFF; bytes[pos + 1] = (ch >> 8) & 0xFF; bytes[pos + 2] = (ch >> 16) & 0xFF; pos += 3;

    // ANIM chunk (global animation parameters)
    writeStr(view, pos, 'ANIM'); pos += 4;
    view.setUint32(pos, 6, true); pos += 4; // payload size = 6
    view.setUint32(pos, 0x00000000, true); pos += 4; // background color (transparent)
    view.setUint16(pos, 0, true); pos += 2; // loop count (0 = infinite)

    // ANMF chunks (one per frame)
    for (const chunk of bitstreamChunks) {
      const bitstreamLen = chunk.data.byteLength;
      const anmfPayloadSize = 16 + bitstreamLen;

      writeStr(view, pos, 'ANMF'); pos += 4;
      view.setUint32(pos, anmfPayloadSize, true); pos += 4;

      // Frame X offset (24-bit LE) — divided by 2 per spec
      bytes[pos] = 0; bytes[pos + 1] = 0; bytes[pos + 2] = 0; pos += 3;
      // Frame Y offset (24-bit LE) — divided by 2 per spec
      bytes[pos] = 0; bytes[pos + 1] = 0; bytes[pos + 2] = 0; pos += 3;

      // Frame width - 1 (24-bit LE)
      bytes[pos] = cw & 0xFF; bytes[pos + 1] = (cw >> 8) & 0xFF; bytes[pos + 2] = (cw >> 16) & 0xFF; pos += 3;
      // Frame height - 1 (24-bit LE)
      bytes[pos] = ch & 0xFF; bytes[pos + 1] = (ch >> 8) & 0xFF; bytes[pos + 2] = (ch >> 16) & 0xFF; pos += 3;

      // Duration (24-bit LE, in ms)
      bytes[pos] = delay & 0xFF; bytes[pos + 1] = (delay >> 8) & 0xFF; bytes[pos + 2] = (delay >> 16) & 0xFF; pos += 3;

      // Flags: bit 1 = blending (0 = overwrite), bit 0 = disposal (0 = do not dispose)
      bytes[pos] = 0x02; pos += 1; // alpha blending, no dispose

      // Embedded bitstream (VP8 or VP8L chunk including its own 8-byte header)
      bytes.set(new Uint8Array(chunk.data.buffer, chunk.data.byteOffset, chunk.data.byteLength), pos);
      pos += bitstreamLen;

      // Pad to even
      if (anmfPayloadSize % 2 !== 0) { bytes[pos] = 0; pos += 1; }
    }

    return {
      blob: new Blob([totalBuf.slice(0, pos)], { type: 'image/webp' }),
      ext: 'webp'
    };
  }

  global.encodeAnimatedWebP = encodeAnimatedWebP;

})(typeof window !== 'undefined' ? window : this);
