/**
 * Assembles a DealerPulse design artifact:
 *   <title> (first, so it stays inside the 8KB title-scan window)
 *   <style> embedded IBM Plex woff2 data URIs
 *   <style> shared tokens + product components
 *   page body
 *
 * Usage: node build.js <src.body.html> <out.html>
 */
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const [, , src, out] = process.argv;
if (!src || !out) {
  console.error('usage: node build.js <src.body.html> <out.html>');
  process.exit(1);
}

const plex = fs.readFileSync(path.join(HERE, 'plex.css'), 'utf8');
const tokens = fs.readFileSync(path.join(HERE, 'tokens.css'), 'utf8');
const app = fs.readFileSync(path.join(HERE, 'app.css'), 'utf8');
const body = fs.readFileSync(src, 'utf8');

const m = body.match(/^<!--TITLE:([^]*?)-->\n?/);
if (!m) {
  console.error('Source must begin with <!--TITLE:Your Title-->');
  process.exit(1);
}
const title = m[1].trim();
const content = body.slice(m[0].length);

const html =
  `<title>${title}</title>\n` +
  `<style>${plex}</style>\n` +
  `<style>\n${tokens}\n${app}\n</style>\n` +
  content;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);

const kb = (n) => (n / 1024).toFixed(0) + 'KB';
console.log(
  `built ${path.basename(out)} — ${kb(html.length)} ` +
  `(fonts ${kb(plex.length)}, css ${kb(tokens.length + app.length)}, body ${kb(content.length)})`
);
