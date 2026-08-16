/**
 * The whole-product gate: every route at every breakpoint, in both themes.
 * Checks the things that break silently — overflow, hydration errors, invalid
 * nesting, empty rendered panels, and 404/500s.
 */
const { BASE: B, launch, report } = require('./lib');

const ROUTES = [
  '/', '/actions', '/leads', '/models', '/method',
  '/branch/B1', '/branch/B3', '/branch/B5', '/rep/SR1', '/rep/SR14',
  '/?period=q4', '/?period=2025-12', '/?period=q4&basis=cohort', '/?period=q4&basis=calendar',
  '/?branch=B3', '/?branch=B1,B5', '/?model=Camry', '/?source=social_media',
  '/?as=B1', '/?as=B3', '/?as=B5',
  '/leads?status=stalled', '/leads?status=uncontacted', '/leads?q=varma', '/leads?page=2',
  '/leads?sort=age&dir=asc', '/actions?q=delays', '/actions?q=cold', '/models?model=Fortuner',
  '/?lead=L0022', '/?period=2025-06', '/?period=2025-06&branch=B3',
];

(async () => {
  const browser = await launch();
  let bad = 0;
  for (const [w, h] of [[393, 852], [768, 1024], [1024, 800], [1440, 900]]) {
    for (const theme of w === 1440 ? ['light', 'dark'] : ['light']) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
      for (const route of ROUTES) {
        errs.length = 0;
        const res = await page.goto(B + route, { waitUntil: 'networkidle' });
        const status = res ? res.status() : 0;
        if (status !== 200) { bad++; console.log(`${w}/${theme} ${route}  HTTP ${status}`); continue; }
        await page.waitForTimeout(60);
        const r = await page.evaluate(() => {
          const de = document.documentElement;
          return {
            overflow: de.scrollWidth - de.clientWidth,
            detailsInP: document.querySelectorAll('p details').length,
            divInP: document.querySelectorAll('p div').length,
            emptyMain: (document.querySelector('main')?.innerText || '').trim().length < 40,
            nestedA: document.querySelectorAll('a a').length,
            nestedBtn: document.querySelectorAll('button button').length,
          };
        });
        const say = (m) => { bad++; console.log(`${w}/${theme} ${route}  ${m}`); };
        if (r.overflow > 1) say(`horizontal overflow ${r.overflow}px`);
        if (r.detailsInP) say(`${r.detailsInP} <details> inside <p>`);
        if (r.divInP) say(`${r.divInP} <div> inside <p>`);
        if (r.emptyMain) say('main rendered empty');
        if (r.nestedA) say(`${r.nestedA} nested <a>`);
        if (r.nestedBtn) say(`${r.nestedBtn} nested <button>`);
        if (errs.length) say(`console: ${errs[0].slice(0, 130)}`);
      }
      await ctx.close();
    }
  }
  report(`routes: overflow, hydration, nesting, 404 (${ROUTES.length} routes x 5 configurations)`, bad);
  await browser.close();
})();
