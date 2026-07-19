import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 3000));

  // Read canvas pixel at centre to check if it's blank (all zeros = background color)
  const pixelData = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!ctx) return 'no-webgl-ctx';
    // Read a pixel from the center
    const buf = new Uint8Array(4);
    ctx.readPixels(640, 360, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
    return { r: buf[0], g: buf[1], b: buf[2], a: buf[3] };
  });

  // Also check via 2d context (after screenshot composite)
  const pixelData2d = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    // Try reading the canvas via 2d context (if crossOrigin allows)
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = 1280; offscreen.height = 720;
      const ctx2d = offscreen.getContext('2d');
      ctx2d.drawImage(canvas, 0, 0);
      const px = ctx2d.getImageData(640, 360, 1, 1).data;
      return { r: px[0], g: px[1], b: px[2], a: px[3] };
    } catch(e) { return 'err: ' + e.message; }
  });

  console.log('WebGL center pixel:', JSON.stringify(pixelData));
  console.log('2D center pixel:', JSON.stringify(pixelData2d));
  console.log('Info:', await page.$eval('#info', el => el.textContent));

  await page.screenshot({ path: 'screenshots/pixel-test.png' });
  await browser.close();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
