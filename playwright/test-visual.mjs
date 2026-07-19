import { chromium } from 'playwright';

const SCREENSHOT_DIR = 'screenshots';
const L2D_CLICK_POS = { x: 640, y: 360 };
const CHIBI_CLICK_POS = { x: 640, y: 648 };

async function run() {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-http-cache',
      '--no-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling'
    ]
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  let seq = 0;
  function snap(name) {
    const n = String(++seq).padStart(2, '0');
    const path = `${SCREENSHOT_DIR}/${n}-${name}.png`;
    console.log(`  [snap] ${n}-${name}.png`);
    return page.screenshot({ path });
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function waitForText(contains) {
    for (let i = 0; i < 60; i++) {
      const text = await page.$eval('#info', el => el.textContent);
      if (text.includes(contains)) return text;
      await sleep(250);
    }
    return await page.$eval('#info', el => el.textContent);
  }

  try {
    // =============================================
    // A. Each L2D model — switch & interact
    // =============================================
    console.log('\n=== A. L2D models ===');
    await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });
    let infoText = await waitForText('click to interact');

    // Get all L2D model options
    const l2dOptions = await page.$$eval('#model-select option', opts =>
      opts.map(o => ({ value: o.value, text: o.textContent.replace('L2D: ', '') }))
    );
    console.log(`  Models: ${l2dOptions.map(o => o.text).join(', ')}`);

    for (const model of l2dOptions) {
      await page.selectOption('#model-select', model.value);
      infoText = await waitForText('click to interact');
      console.log(`  Loaded: ${model.text}`);
      await snap(`l2d-${model.text.replace(/[^a-z0-9]/gi, '_')}`);

      // Interact (click body)
      await page.click('canvas', { position: L2D_CLICK_POS });
      await sleep(1500);
      await snap(`l2d-${model.text.replace(/[^a-z0-9]/gi, '_')}_interact`);
      await sleep(1000);
    }

    // =============================================
    // B. Chibi — each animation state
    // =============================================
    console.log('\n=== B. Chibi animation states ===');
    await page.selectOption('#mode-select', 'chibi');
    infoText = await waitForText('click to cycle');
    console.log(`  Chibi loaded: ${infoText}`);
    await snap('chibi_wait');

    // Cycle through 5 animations (wait→die→move→victory→victoryloop→wait)
    for (let i = 0; i < 5; i++) {
      await page.click('canvas', { position: CHIBI_CLICK_POS });
      await sleep(800);
      infoText = await page.$eval('#info', el => el.textContent);
      const state = infoText.split(' - ').pop() || `click_${i + 1}`;
      console.log(`  Animation: ${state}`);
      await snap(`chibi_${state}`);
    }

    // =============================================
    // C. Switch back to L2D — no interaction
    // =============================================
    console.log('\n=== C. Switch back to L2D (no interact) ===');
    await page.selectOption('#mode-select', 'live2d');
    infoText = await waitForText('click to interact');
    console.log(`  ${infoText}`);
    await snap('l2d_switchback');

    // =============================================
    // D. Switch to Chibi — no interaction
    // =============================================
    console.log('\n=== D. Switch to Chibi (no interact) ===');
    await page.selectOption('#mode-select', 'chibi');
    infoText = await waitForText('click to cycle');
    console.log(`  ${infoText}`);
    await snap('chibi_switchback');

    console.log('\n=== ALL DONE ===');
  } catch (err) {
    console.error('FATAL:', err);
    try { await snap('fatal'); } catch(e) {}
    process.exit(1);
  } finally {
    await browser.close();
    process.exit(0);
  }
}

run();
