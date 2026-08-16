/**
 * Shared setup for the audit harnesses.
 *
 * These checks exist because the defects they catch are invisible in review and
 * in a screenshot. Each one was written after a real bug got through: a
 * pseudo-element that shifted every table column, a chart mark at 1.6:1 against
 * its own background, a page with no heading, a tooltip painted under a dot.
 * Keeping them in the repo is the difference between "verified once" and
 * "stays verified".
 */

/*
 * Playwright is deliberately not in package.json. Its install step downloads
 * about 150MB of browsers, and a deploy build has no use for them, so the
 * audit asks for it rather than making every build pay for it.
 */
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error(
    'The audit needs Playwright, which is not installed by default.\n\n' +
      '  npm i -D playwright && npx playwright install chromium\n\n' +
      'It is kept out of package.json on purpose: its install downloads about\n' +
      '150MB of browsers that a production build never needs.',
  );
  process.exit(1);
}

/** Where the app under test is served. Override with AUDIT_URL. */
const BASE = process.env.AUDIT_URL || 'http://127.0.0.1:3111';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Find a Chromium to drive.
 *
 * Playwright normally downloads a build matched to its own version, but some
 * environments pre-install one and only that one is present. When the versions
 * disagree Playwright fails with "Executable doesn't exist", so rather than
 * pinning a version forever, look for whatever build is actually on disk and
 * use it. CHROMIUM_PATH overrides everything.
 */
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !fs.existsSync(root)) return undefined;
  for (const dir of fs.readdirSync(root)) {
    if (!dir.startsWith('chromium-')) continue;
    const exe = path.join(root, dir, 'chrome-linux', 'chrome');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

function launch() {
  const executablePath = findChromium();
  return chromium.launch(executablePath ? { executablePath } : {});
}

/** Widths the product is designed against: phone, tablet, laptop, desktop. */
const WIDTHS = [393, 768, 1024, 1440];

/**
 * Routes worth checking. Every screen, both period bases, each role, and the
 * filter combinations that have previously broken something.
 */
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

/** The subset used by the per width checks, which are slower per route. */
const CORE_ROUTES = ['/', '/actions', '/leads', '/models', '/method', '/branch/B1', '/branch/B3', '/rep/SR1'];

/**
 * Report a result and set the exit code. A harness that finds something must
 * fail the run, or it is decoration.
 */
function report(name, findings) {
  if (findings === 0) {
    console.log(`  PASS  ${name}`);
    return 0;
  }
  console.log(`  FAIL  ${name}: ${findings} finding${findings === 1 ? '' : 's'}`);
  process.exitCode = 1;
  return findings;
}

module.exports = { BASE, launch, WIDTHS, ROUTES, CORE_ROUTES, report };
