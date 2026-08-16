/**
 * Text-integrity sweep.
 *
 * The defect this exists for: a flex or grid container discards whitespace-only
 * text nodes between its children, so markup written as
 *   {name} <span>{city}</span>
 * renders as "DowntownChennai". Rather than guessing from rendered strings —
 * which produces piles of false positives wherever a container legitimately
 * concatenates labels — this looks for the mechanism directly: a
 * flex/grid/inline-flex parent that HAS a whitespace-only text node between two
 * visible children. That whitespace was authored and is not being rendered.
 *
 * Also sweeps for generated-grammar slips and leaked placeholders.
 */
const { BASE: B, launch, report } = require('./lib');
const ROUTES = [
  '/', '/actions', '/leads', '/models', '/method',
  '/branch/B1', '/branch/B5', '/rep/SR1',
  '/?period=2025-12', '/?period=q4', '/leads?status=stalled', '/actions?q=delays',
];

(async () => {
  const browser = await launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  let bad = 0;
  for (const route of ROUTES) {
    await page.goto(B + route, { waitUntil: 'networkidle' });
    const out = await page.evaluate(() => {
      const res = [];
      document.querySelectorAll('body *').forEach((el) => {
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
        const d = getComputedStyle(el).display;
        if (!/^(inline-)?(flex|grid)$/.test(d)) return;
        const kids = [...el.childNodes];
        for (let i = 1; i < kids.length - 1; i++) {
          const n = kids[i];
          if (n.nodeType !== 3 || n.textContent.trim() !== '' || n.textContent === '') continue;
          const before = kids[i - 1], after = kids[i + 1];
          const vis = (x) => x && (x.nodeType === 1 ? getComputedStyle(x).display !== 'none' : x.textContent.trim() !== '');
          if (vis(before) && vis(after)) {
            const a = (before.textContent || '').trim().slice(-16);
            const b = (after.textContent || '').trim().slice(0, 16);
            if (a && b) res.push(`<${el.tagName.toLowerCase()}.${el.className || '-'}> "${a}" + "${b}"`);
          }
        }
      });
      // Grammar and placeholders, over visible body text only.
      const txt = document.body.innerText.replace(/\s+/g, ' ');
      const grammar = [];
      for (const re of [/(?<![\d.])1 (leads|orders|branches|individuals)\b/, /\bundefined\b/, /\bNaN\b/, /\b0 fewer\b/, /\bInfinity\b/]) {
        const m = txt.match(re);
        if (m) grammar.push(txt.slice(Math.max(0, m.index - 40), m.index + 50));
      }
      return { res, grammar };
    });
    for (const o of out.res) { bad++; console.log(`${route}  dropped-space: ${o}`); }
    for (const g of out.grammar) { bad++; console.log(`${route}  grammar: …${g}…`); }
  }
  report('text integrity: dropped spaces, grammar, placeholders', bad);
  await browser.close();
})();
