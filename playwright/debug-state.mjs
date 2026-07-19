import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false, args: ['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });
await new Promise(r => setTimeout(r, 5000));
const state = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  return {
    info: document.getElementById('info').textContent,
    canvasPhysW: c.width,
    canvasPhysH: c.height,
    canvasCSSW: c.style.width,
    canvasCSS_H: c.style.height,
    canvasClientW: c.clientWidth,
    canvasClientH: c.clientHeight,
    screenW: window.__sharedApp.screen.width,
    screenH: window.__sharedApp.screen.height,
  };
});
console.log(JSON.stringify(state, null, 2));
await browser.close();
