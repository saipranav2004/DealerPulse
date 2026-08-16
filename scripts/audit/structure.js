/**
 * Second-order audit: the things a gate for overflow and contrast does not see.
 * Heading order, landmarks, focus visibility, keyboard reachability, no-JS
 * degradation, page weight, and the 404.
 */
const { BASE: B, launch, report } = require('./lib');
const ROUTES = ['/', '/actions', '/leads', '/models', '/method', '/branch/B1', '/rep/SR1'];

(async () => {
  let bad = 0;
  const browser = await launch();

  // ---- structure & a11y ---------------------------------------------------
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  console.log('=== heading order, landmarks, alt text ===');
  for (const route of ROUTES) {
    await page.goto(B + route, { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => {
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .filter((h) => getComputedStyle(h).display !== 'none')
        .map((h) => +h.tagName[1]);
      const skips = [];
      for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) skips.push(`h${hs[i - 1]}→h${hs[i]}`);
      return {
        h1: document.querySelectorAll('h1').length,
        skips,
        main: document.querySelectorAll('main').length,
        nav: document.querySelectorAll('nav').length,
        imgNoAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
        svgNoName: [...document.querySelectorAll('svg[role="img"]')].filter(
          (s) => !s.getAttribute('aria-label') && !s.querySelector('title'),
        ).length,
        lang: document.documentElement.lang || '(none)',
        title: document.title,
      };
    });
    const flags = [];
    if (r.h1 !== 1) flags.push(`h1 count ${r.h1}`);
    if (r.skips.length) flags.push(`heading skips ${r.skips.join(',')}`);
    if (r.main !== 1) flags.push(`main ${r.main}`);
    if (r.imgNoAlt) flags.push(`${r.imgNoAlt} img without alt`);
    if (r.svgNoName) flags.push(`${r.svgNoName} unnamed role=img svg`);
    if (!r.title) flags.push('no <title>');
    bad += flags.length;
    console.log(`  ${route.padEnd(14)} ${flags.length ? 'FLAG: ' + flags.join('; ') : 'ok'}  (title: "${r.title.slice(0, 44)}")`);
  }

  // ---- focus visibility ---------------------------------------------------
  console.log('\n=== focus ring on every interactive element ===');
  await page.goto(B + '/leads', { waitUntil: 'networkidle' });
  const noRing = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('a[href], button, input, summary, [tabindex="0"]').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || el.getBoundingClientRect().width === 0) return;
      el.focus();
      const f = getComputedStyle(el);
      const has =
        (f.outlineStyle !== 'none' && parseFloat(f.outlineWidth) > 0) ||
        f.boxShadow !== 'none' ||
        f.borderColor !== cs.borderColor;
      if (!has) bad.push((el.textContent || el.tagName).trim().slice(0, 26));
    });
    return bad;
  });
  console.log(noRing.length ? `  FLAG ${noRing.length}: ${noRing.slice(0, 6).join(' | ')}` : '  ok — every control shows a focus indicator');

  // ---- 404 ----------------------------------------------------------------
  console.log('\n=== not-found ===');
  for (const bad of ['/nope', '/branch/ZZZ', '/rep/ZZZ']) {
    const res = await page.goto(B + bad, { waitUntil: 'networkidle' });
    const txt = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
    console.log(`  ${bad.padEnd(14)} HTTP ${res.status()}  "${txt.slice(0, 70)}"`);
  }

  // ---- page weight --------------------------------------------------------
  console.log('\n=== transferred bytes per route ===');
  for (const route of ['/', '/leads', '/actions']) {
    const ctx2 = await browser.newContext();
    const p2 = await ctx2.newPage();
    let bytes = 0;
    p2.on('response', async (r) => {
      try { bytes += (await r.body()).length; } catch { /* redirects, aborted */ }
    });
    await p2.goto(B + route, { waitUntil: 'networkidle' });
    await p2.waitForTimeout(400);
    console.log(`  ${route.padEnd(10)} ${(bytes / 1024).toFixed(0)} KB`);
    await ctx2.close();
  }

  // ---- no JavaScript ------------------------------------------------------
  console.log('\n=== with JavaScript disabled ===');
  const njs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const p3 = await njs.newPage();
  for (const route of ['/', '/leads', '/actions']) {
    await p3.goto(B + route, { waitUntil: 'domcontentloaded' });
    const r = await p3.evaluate(() => ({
      words: document.querySelector('main')?.innerText.trim().split(/\s+/).length ?? 0,
      links: document.querySelectorAll('main a[href]').length,
      filters: document.querySelectorAll('[data-filter-menu]').length,
    }));
    console.log(`  ${route.padEnd(10)} ${r.words} words, ${r.links} links, ${r.filters} filter menus — ${r.words > 100 ? 'usable' : 'FLAG: little content'}`);
  }
  await njs.close();

  report('structure: one h1 per page, heading order, landmarks, titles', bad);
  await browser.close();
})();
