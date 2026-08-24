/**
 * Sliders and other dragged controls.
 *
 * The other harnesses check tables and hit targets, and a range input is
 * neither, so this class of defect passed every one of them. It exists because
 * the scenario panel set its two column split with an inline style, which no
 * media query can override: one slider survived that on a phone, and the
 * moment a second lever was added the pair became unaimable.
 *
 * A slider is not like a button. A button you tap; a slider you drag to a
 * value, so its length is its precision. Below roughly 200px a whole percent
 * is under two pixels of travel and the control stops being usable even though
 * it is perfectly tappable.
 */

const { BASE, launch, WIDTHS, report } = require('./lib.js');

/** Routes that carry a dragged control. */
const ROUTES = ['/actions', '/actions?as=B3', '/actions?period=q4'];

/** Shortest a slider may be before its travel stops resolving single steps. */
const MIN_TRACK = 200;
/** Touch minimum, per the same rule the target size harness uses. */
const MIN_TOUCH = 44;

(async () => {
  const browser = await launch();
  let findings = 0;

  for (const width of WIDTHS) {
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.emulateMedia({ colorScheme: scheme });

      for (const route of ROUTES) {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });

        const result = await page.evaluate(() => {
          const controls = [...document.querySelectorAll('input[type="range"]')].map((el) => {
            const box = el.getBoundingClientRect();
            const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
            return {
              name: el.id || el.getAttribute('aria-label') || 'unnamed',
              width: Math.round(box.width),
              height: Math.round(box.height),
              right: Math.round(box.right),
              labelled: !!label || !!el.getAttribute('aria-label'),
              // A range input with no accessible value reads as a bare number.
              valueText: !!el.getAttribute('aria-valuetext'),
            };
          });
          return {
            controls,
            viewport: document.documentElement.clientWidth,
            scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          };
        });

        for (const control of result.controls) {
          const problems = [];
          if (control.width < MIN_TRACK) problems.push(`track ${control.width}px, need ${MIN_TRACK}`);
          if (width < 768 && control.height < MIN_TOUCH) {
            problems.push(`height ${control.height}px, need ${MIN_TOUCH} on touch`);
          }
          if (control.right > result.viewport) problems.push(`overflows by ${control.right - result.viewport}px`);
          if (!control.labelled) problems.push('no label');
          if (!control.valueText) problems.push('no aria-valuetext');
          if (problems.length > 0) {
            findings++;
            console.log(`  ${width} ${scheme} ${route} · ${control.name}: ${problems.join('; ')}`);
          }
        }

        if (result.scrolls) {
          findings++;
          console.log(`  ${width} ${scheme} ${route}: page scrolls sideways`);
        }
      }

      await page.close();
    }
  }

  await browser.close();
  report('dragged controls: track length, touch height, labelling', findings);
})();
