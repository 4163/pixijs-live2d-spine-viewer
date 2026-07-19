import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  // Capture ALL console output
  const consoleLines = [];
  page.on('console', msg => {
    consoleLines.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => consoleLines.push(`[PAGE_ERROR] ${err.message}`));
  page.on('response', res => {
    if (res.status() >= 400) consoleLines.push(`[${res.status()}] ${res.url()}`);
  });

  await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });

  // Wait for page to be ready
  for (let i = 0; i < 40; i++) {
    const t = await page.$eval('#info', el => el.textContent);
    if (t.includes('click') || t.includes('Failed')) break;
    await new Promise(r => setTimeout(r, 250));
  }
  await new Promise(r => setTimeout(r, 1000));

  // Switch to Spine mode
  const spineTab = await page.$('.mode-tab[data-mode="spine"]');
  if (spineTab) await spineTab.click();
  await new Promise(r => setTimeout(r, 2000));

  // Click the first chibi pill (classic_witch has dorm atlas)
  const pills = await page.$$('.model-pill');
  if (pills.length > 0) await pills[0].click();
  await new Promise(r => setTimeout(r, 2000));

  // Toggle dorm on
  const dormBtn = await page.$('#dorm-toggle');
  if (dormBtn) {
    const dormActive = await dormBtn.evaluate(el => el.classList.contains('active'));
    consoleLines.push(`[INFO] Dorm active before click: ${dormActive}`);
    await dormBtn.click();
    await new Promise(r => setTimeout(r, 2000));
  }

  // Click another chibi that also has dorm atlas
  if (pills.length > 1) {
    await pills[1].click();
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log('=== CONSOLE CAPTURE ===');
  for (const line of consoleLines) {
    console.log(line);
  }

  await browser.close();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
