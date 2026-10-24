#!/usr/bin/env node
/*
 * Read-only dead-code finder. Builds the import graph with the project's own TypeScript
 * resolution (baseUrl `src`), starting from the real entry points, and reports:
 *   - source files nothing in the app or the tests imports (dead candidates)
 *   - source files only the tests import (not shipped)
 *   - file names that exist in more than one folder (possible duplicates)
 *   - with --exports: exported names no other file mentions (mostly types; low value)
 *
 * Usage: node scripts/find-unreachable.js [--exports]
 *
 * It deletes nothing. See "Finding and removing dead code" in AGENTS.md before acting on it.
 * Lazy `import()` and `require()` with a string literal are followed. Anything loaded by a
 * computed path, a webpack config, or a string (for example a route table built from names)
 * is invisible to it, so check each hit by hand.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..').replace(/\\/g, '/');
const src = `${root}/src`;
const ENTRIES = ['src/app/main.tsx', 'src/native/main.ts'].map(e => `${root}/${e}`);
const withExports = process.argv.includes('--exports');

const opts = {
  baseUrl: src, allowJs: true, jsx: ts.JsxEmit.React, esModuleInterop: true,
  moduleResolution: ts.ModuleResolutionKind.NodeJs, paths: { '*': ['*', 'src/*'] },
};

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = `${dir}/${name}`;
    if (fs.statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p, out); }
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
};

const srcFiles = walk(src);
const testFiles = walk(`${root}/tests`);

const importsOf = (file) => {
  const text = fs.readFileSync(file, 'utf8');
  const specs = ts.preProcessFile(text, true, true).importedFiles.map(i => i.fileName);
  const re = /(?:require|import)\(\s*(?:\/\*[^*]*\*\/\s*)*['"]([^'"]+)['"]/g;
  let m; while ((m = re.exec(text))) specs.push(m[1]);
  return [...new Set(specs)];
};
const resolve = (spec, from) => {
  const found = ts.resolveModuleName(spec, from, opts, ts.sys).resolvedModule;
  const file = found && found.resolvedFileName;
  return file && file.startsWith(src) && !file.includes('node_modules') ? file : null;
};

const graph = new Map();
for (const f of [...srcFiles, ...testFiles]) graph.set(f, importsOf(f).map(s => resolve(s, f)).filter(Boolean));
const reach = (starts) => {
  const seen = new Set(); const stack = [...starts];
  while (stack.length) { const f = stack.pop(); if (seen.has(f)) continue; seen.add(f); (graph.get(f) || []).forEach(n => stack.push(n)); }
  return seen;
};
const fromApp = reach(ENTRIES.filter(e => graph.has(e)));
const fromTests = reach(testFiles);
const rel = f => f.replace(`${root}/`, '');
// Escape every regular-expression metacharacter, backslash included.
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const unreachable = srcFiles.filter(f => !fromApp.has(f));
const dead = unreachable.filter(f => !fromTests.has(f)).sort();
const testsOnly = unreachable.filter(f => fromTests.has(f)).sort();

console.log(`Source files: ${srcFiles.length}; reachable from the app entries: ${fromApp.size}`);
console.log(`\nNot imported by the app or the tests (dead candidates): ${dead.length}`);
dead.forEach(f => console.log(`  ${rel(f)}`));
console.log(`\nImported only by tests (not shipped): ${testsOnly.length}`);
testsOnly.forEach(f => console.log(`  ${rel(f)}`));

const byName = new Map();
for (const f of srcFiles) byName.set(path.basename(f), [...(byName.get(path.basename(f)) || []), f]);
console.log('\nSame file name in more than one folder (not always a duplicate; compare the contents):');
for (const [name, list] of [...byName].sort()) {
  if (list.length > 1 && !/^(index|constants|interfaces|utils|types|actions)\./.test(name)) console.log(`  ${name}: ${list.map(rel).join(' | ')}`);
}

if (withExports) {
  const texts = new Map([...srcFiles, ...testFiles].map(f => [f, fs.readFileSync(f, 'utf8')]));
  const unused = [];
  for (const f of srcFiles) {
    if (!fromApp.has(f)) continue;
    const names = new Set(); let m;
    const re = /export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|interface|type|enum)\s+([A-Za-z0-9_$]+)/g;
    while ((m = re.exec(texts.get(f)))) names.add(m[1]);
    for (const n of names) {
      const word = new RegExp(`\\b${escapeRegExp(n)}\\b`);
      if (![...texts].some(([g, t]) => g !== f && word.test(t))) unused.push(`${rel(f)} :: ${n}`);
    }
  }
  console.log(`\nExports no other file mentions: ${unused.length}`);
  unused.sort().forEach(x => console.log(`  ${x}`));
}
