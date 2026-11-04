// Type-checks Brain Explorer's JavaScript with the TypeScript compiler, without changing how the site is built.
// The app's code lives inside index.html, so it is copied out to .typecheck/app.js first, and every problem is
// reported with its line number in index.html.
//
// Problems that already existed when checking was set up are listed in typecheck-baseline.json and allowed;
// the check fails only on new ones. After fixing old problems, run `npm run typecheck -- --update` to shrink the list.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const update = process.argv.includes('--update');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

// the main app script is the largest inline <script> in the page
let best = null;
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) if (!best || m[1].length > best[1].length) best = m;
const startLine = html.slice(0, best.index + '<script>'.length).split('\n').length - 1; // lines before the code
fs.mkdirSync(path.join(root, '.typecheck'), { recursive: true });
fs.writeFileSync(path.join(root, '.typecheck/app.js'), best[1]);

function check(configFile) {
  const cfg = ts.getParsedCommandLineOfConfigFile(path.join(root, configFile), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')); } });
  const program = ts.createProgram(cfg.fileNames, cfg.options);
  return ts.getPreEmitDiagnostics(program).map(d => {
    // messages can name files by full path, which differs between computers, so make paths relative
    const msg = ts.flattenDiagnosticMessageText(d.messageText, ' ').split(root + path.sep).join('');
    if (!d.file) return { where: configFile, line: 0, code: d.code, msg, text: '' };
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    const text = d.file.text.split('\n')[line].trim().slice(0, 160);
    const isApp = d.file.fileName.endsWith('.typecheck/app.js');
    return { where: isApp ? 'index.html' : path.relative(root, d.file.fileName), line: isApp ? line + 1 + startLine : line + 1, code: d.code, msg, text };
  });
}

const found = [...check('tsconfig.json'), ...check('tsconfig.sw.json')];
// a problem is identified by its file, error code, message and the code on its line, so it survives lines moving
const key = p => [p.where, p.code, p.msg, p.text].join(' | ');
const basePath = path.join(root, 'typecheck-baseline.json');

if (update || !fs.existsSync(basePath)) {
  const counts = {};
  for (const p of found) counts[key(p)] = (counts[key(p)] || 0) + 1;
  fs.writeFileSync(basePath, JSON.stringify(counts, null, 1) + '\n');
  console.log(`Baseline saved: ${found.length} existing problems are now allowed.`);
  process.exit(0);
}

const allowed = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const left = { ...allowed }, fresh = [];
for (const p of found) { const k = key(p); if (left[k] > 0) left[k]--; else fresh.push(p); }
const fixed = Object.values(left).reduce((a, b) => a + b, 0);

console.log(`Type check: ${found.length} problems, ${found.length - fresh.length} already known, ${fresh.length} new, ${fixed} known ones fixed.`);
if (fixed) console.log('Some known problems are gone. Run `npm run typecheck -- --update` to remove them from the baseline.');
if (fresh.length) {
  console.log('\nNew problems:');
  for (const p of fresh) console.log(`  ${p.where}:${p.line}  TS${p.code}: ${p.msg}\n      ${p.text}`);
  process.exit(1);
}
