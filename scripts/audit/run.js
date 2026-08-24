/**
 * The audit runner.
 *
 * Builds the app, serves it, runs every harness against the real rendered
 * output, and exits non zero if anything fails. This is the check that the
 * unit tests cannot do: the baseline suite proves the numbers are right, this
 * proves they are legible, reachable and correctly laid out in a browser.
 *
 *   npm run audit
 *
 * Set AUDIT_URL to point at an already running server and skip the build:
 *   AUDIT_URL=https://example.vercel.app npm run audit -- --no-build
 */

const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const HARNESSES = [
  ['structure.js', []],
  ['gate.js', []],
  ['text.js', []],
  ['overlap.js', []],
  ['contrast.js', []],
  ['controls.js', []],
  // These take a width, and each width is a separate layout to get wrong.
  ...[393, 768, 1024, 1440].flatMap((w) => [['align.js', [String(w)]], ['touch.js', [String(w)]]]),
];

const PORT = process.env.AUDIT_PORT || '3111';
const external = !!process.env.AUDIT_URL;
const skipBuild = process.argv.includes('--no-build') || external;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) {
    console.error(`\n${cmd} ${args.join(' ')} failed`);
    process.exit(1);
  }
}

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function stopServer() {
  if (!server) return;
  try {
    // Negative pid kills the whole group, not just npm.
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    try { server.kill(); } catch { /* already gone */ }
  }
  server = null;
}

let server = null;

// A crash or a Ctrl C must not leave the port held.
for (const sig of ['SIGINT', 'SIGTERM', 'exit']) process.on(sig, stopServer);

(async () => {

  if (!skipBuild) {
    console.log('Building…\n');
    run('npm', ['run', 'build']);
  }

  const base = process.env.AUDIT_URL || `http://127.0.0.1:${PORT}`;

  if (!external) {
    /*
     * Refuse to audit a server this run did not start.
     *
     * Without this the failure mode is silent and very confusing: a stale
     * server left over from earlier holds the port, the new one cannot bind,
     * the readiness probe sees the old one answering, and the audit runs
     * against a build whose CSS files the rebuild has just deleted. Every
     * check then fails against an unstyled page, and none of the failures are
     * about the code.
     */
    let occupied = false;
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(1500) });
      occupied = res.ok;
    } catch {
      /* Nothing there, which is what we want. */
    }
    if (occupied) {
      console.error(
        `\nSomething is already serving ${base}.\n` +
          `Stop it first, or point the audit at it with AUDIT_URL=${base} npm run audit -- --no-build`,
      );
      process.exit(1);
    }

    console.log(`\nStarting the server on ${base}…`);
    /*
     * `detached` so the server gets its own process group. `npm run start`
     * spawns the real server as a child, and killing npm alone leaves that
     * child holding the port, which then blocks the next run.
     */
    server = spawn('npm', ['run', 'start'], {
      env: { ...process.env, PORT },
      stdio: 'ignore',
      detached: true,
    });
    if (!(await waitForServer(base))) {
      console.error('The server did not start.');
      stopServer();
      process.exit(1);
    }
  }

  console.log(`\nAuditing ${base}\n`);
  let failed = 0;
  for (const [file, args] of HARNESSES) {
    const r = spawnSync(process.execPath, [path.join(__dirname, file), ...args], {
      stdio: 'inherit',
      env: { ...process.env, AUDIT_URL: base },
    });
    if (r.status !== 0) failed++;
  }

  stopServer();

  console.log('');
  if (failed === 0) {
    console.log('Everything passed.');
    process.exit(0);
  }
  console.log(`${failed} check${failed === 1 ? '' : 's'} failed.`);
  process.exit(1);
})();
