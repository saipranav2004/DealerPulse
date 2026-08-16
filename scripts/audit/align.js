/**
 * Column-alignment audit. For every table on the page at a given width, compare
 * each header cell's box to the box of the body cells in the same column. A
 * header that does not sit over its data is the defect in the screenshots.
 */
const { BASE: B, launch, report } = require('./lib');
const ROUTES = ['/', '/actions', '/leads', '/models', '/method', '/branch/B1', '/branch/B3', '/rep/SR1'];

(async () => {
  const browser = await launch();
  const W = Number(process.argv[2] || 393);
  const ctx = await browser.newContext({ viewport: { width: W, height: 852 } });
  const page = await ctx.newPage();
  let bad = 0;
  for (const route of ROUTES) {
    await page.goto(B + route, { waitUntil: 'networkidle' });
    const out = await page.evaluate(() => {
      const res = [];
      document.querySelectorAll('table').forEach((tbl, ti) => {
        const head = tbl.querySelector('thead');
        if (!head || getComputedStyle(head).display === 'none') return;
        const hrow = head.querySelector('tr');
        const brow = tbl.querySelector('tbody tr');
        if (!hrow || !brow) return;
        const hs = [...hrow.children].map((c) => c.getBoundingClientRect());
        const bs = [...brow.children].map((c) => c.getBoundingClientRect());
        if (hs.length !== bs.length) {
          res.push({ ti, why: `col count ${hs.length} vs ${bs.length}`, cls: tbl.className });
          return;
        }
        hs.forEach((h, i) => {
          const b = bs[i];
          if (Math.abs(h.left - b.left) > 1.5 || Math.abs(h.width - b.width) > 1.5) {
            res.push({
              ti, col: i, cls: tbl.className,
              why: `head[${Math.round(h.left)},${Math.round(h.width)}] body[${Math.round(b.left)},${Math.round(b.width)}]`,
              text: hrow.children[i].textContent.trim().slice(0, 20),
            });
          }
        });
        // Does the table overflow its own scroll container?
        const sc = tbl.closest('.scrollx');
        if (sc && tbl.scrollWidth > sc.clientWidth + 1) {
          res.push({ ti, why: `overflows scrollx: ${tbl.scrollWidth} > ${sc.clientWidth}`, cls: tbl.className });
        }
      });
      return res;
    });
    for (const o of out) { bad++; console.log(`${route}  table#${o.ti} [${o.cls}] col=${o.col ?? '-'} "${o.text ?? ''}" ${o.why}`); }
  }
  report(`table column alignment @ ${W}px`, bad);
  await browser.close();
})();
