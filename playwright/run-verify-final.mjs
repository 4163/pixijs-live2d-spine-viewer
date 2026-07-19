import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');
const BASE = join(__dirname, '..');
const MIME = {
  '.js':'application/javascript','.json':'application/json','.png':'image/png',
  '.txt':'text/plain','.skel':'application/octet-stream','.html':'text/html',
  '.css':'text/css','.moc':'application/octet-stream','.moc3':'application/octet-stream',
  '.mtn':'application/octet-stream','.atlas':'text/plain'
};

const server = createServer((req, res) => {
  const url = req.url.split('?')[0];
  const file = join(BASE, url === '/' ? 'index.html' : url);
  const ext = extname(file);
  readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

server.listen(8000, async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], warnings = [];
  page.on('console', m => {
    if (m.type() === 'error')   errors.push(m.text());
    if (m.type() === 'warning') warnings.push(m.text());
  });

  async function waitFor(txt, ms=15000) {
    const t = Date.now();
    while (Date.now()-t < ms) {
      const s = await page.locator('#info').textContent().catch(() => '');
      if (s.includes(txt)) return s;
      await sleep(250);
    }
    return await page.locator('#info').textContent().catch(() => 'TIMEOUT');
  }

  try {
    await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });
    await sleep(2000);

    const l2dOpts = await page.locator('#model-select option').all();
    console.log('=== LIVE2D (' + l2dOpts.length + ' models) ===');
    for (const opt of l2dOpts) {
      const val = await opt.getAttribute('value');
      const txt = await opt.textContent();
      await page.selectOption('#model-select', val);
      const info = await waitFor('interact', 12000);
      console.log('  OK:', txt.trim(), '->', info);
    }

    console.log('\n=== SPINE ===');
    await page.click('[data-mode="spine"]');
    await sleep(1500);
    const spineOpts = await page.locator('#model-select option').all();
    console.log('  (' + spineOpts.length + ' spine models)');
    for (const opt of spineOpts) {
      const val = await opt.getAttribute('value');
      const txt = await opt.textContent();
      await page.selectOption('#model-select', val);
      const info = await waitFor('cycle', 8000);
      console.log('  OK:', txt.trim(), '->', info);
    }

    console.log('\n=== SWITCHBACK (Spine -> Live2D) ===');
    await page.click('[data-mode="live2d"]');
    const switchInfo = await waitFor('interact', 10000);
    console.log('  Switchback:', switchInfo);

    await page.screenshot({ path: 'screenshots/verify-final.png' });

    console.log('\n=== ERRORS (' + errors.length + ') ===');
    errors.forEach(e => console.log('  ERR:', e.substring(0, 300)));
    console.log('\n=== WARNINGS (' + warnings.length + ') ===');
    warnings.slice(0,5).forEach(w => console.log('  WARN:', w.substring(0, 200)));

    console.log('\n=== DONE ===');
  } finally {
    await browser.close();
    server.close();
  }
});
