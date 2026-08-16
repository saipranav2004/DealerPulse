/**
 * Touch-target and visible-box audit. Every interactive control must clear
 * 44x44 of *target* on a touch tier, while the checkbox's visible square must
 * stay small — a 44px bordered box reads as a broken image, not a control.
 */
const { BASE: B, launch, report } = require('./lib');
const ROUTES = ['/', '/actions', '/leads', '/models', '/method', '/branch/B1', '/branch/B3', '/rep/SR1'];

(async () => {
  const browser = await launch();
  const W = Number(process.argv[2] || 393);
  const page = await (await browser.newContext({ viewport: { width: W, height: 852 } })).newPage();
  let bad = 0;
  for (const route of ROUTES) {
    await page.goto(B + route, { waitUntil: 'networkidle' });
    // Density must never shrink a target below the floor.
    if (process.env.DENSITY) {
      await page.evaluate((d) => document.documentElement.setAttribute('data-density', d), process.env.DENSITY);
      await page.waitForTimeout(80);
    }
    const out = await page.evaluate((width) => {
      const res = [];
      const sel = 'button, a[href], input, select, summary, [role="checkbox"]';
      document.querySelectorAll(sel).forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        // Links inside running prose are exempt from WCAG target size, as is a
        // skip link that is only rendered while focused.
        if (el.classList.contains('sr-only')) return;
        const inProse = el.closest('p, dd, li, .t-micro, .t-small, figcaption');
        const min = width <= 1023 ? 44 : 24;
        if (!inProse && (r.width < min - 0.5 || r.height < min - 0.5)) {
          res.push({ why: `target ${Math.round(r.width)}x${Math.round(r.height)} < ${min}`, t: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 28) });
        }
      });
      // The checkbox box itself, drawn as ::before.
      document.querySelectorAll('.chk').forEach((el) => {
        const b = getComputedStyle(el, '::before');
        const w = parseFloat(b.width), h = parseFloat(b.height);
        if (w > 22 || h > 22) res.push({ why: `visible box ${w}x${h} too large`, t: 'chk' });
        if (w < 14 || h < 14) res.push({ why: `visible box ${w}x${h} too small`, t: 'chk' });
      });
      return res;
    }, W);
    for (const o of out) { bad++; console.log(`${route}  "${o.t}"  ${o.why}`); }
  }
  report(`target sizes @ ${W}px`, bad);
  await browser.close();
})();
