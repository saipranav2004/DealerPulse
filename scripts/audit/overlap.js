/**
 * SVG paints in document order, so a tooltip panel belonging to point i can be
 * overdrawn by the dot of any point j > i. Check every panel against every
 * later dot, at several widths, on every chart that has them.
 */
const { BASE: B, launch, report } = require('./lib');
const ROUTES = ['/', '/branch/B1', '/branch/B3', '/rep/SR1', '/models', '/actions'];

(async () => {
  const browser = await launch();
  let bad = 0;
  for (const W of [393, 768, 1024, 1440]) {
    const page = await (await browser.newContext({ viewport: { width: W, height: 900 } })).newPage();
    for (const route of ROUTES) {
      await page.goto(B + route, { waitUntil: 'networkidle' });
      const out = await page.evaluate(() => {
        const res = [];
        document.querySelectorAll('svg').forEach((svg, si) => {
          const pts = [...svg.querySelectorAll('.tr-pt')];
          if (pts.length === 0) return;
          const box = (el) => { const b = el.getBBox(); return b; };
          pts.forEach((g, i) => {
            const tip = g.querySelector('.tr-tip rect');
            if (!tip) return;
            const t = box(tip);
            for (let j = i + 1; j < pts.length; j++) {
              const dot = pts[j].querySelector('.tr-dot');
              const lab = pts[j].querySelector('.tr-lab');
              for (const [name, el] of [['dot', dot], ['label', lab]]) {
                if (!el) continue;
                const d = box(el);
                const hit = !(d.x + d.width < t.x || d.x > t.x + t.width ||
                              d.y + d.height < t.y || d.y > t.y + t.height);
                if (hit) res.push(`svg#${si} panel[${i}] overdrawn by ${name}[${j}]`);
              }
            }
          });
        });
        return res;
      });
      for (const o of out) { bad++; console.log(`${W}px ${route}  ${o}`); }
    }
    await page.close();
  }
  report('SVG paint order: tooltips never overdrawn', bad);
  await browser.close();
})();
