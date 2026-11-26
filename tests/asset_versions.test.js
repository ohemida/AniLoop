import test from 'node:test';
import assert from 'node:assert/strict';
import {stampedPages, stampPage} from '../scripts/stamp_assets.mjs';

test('index.html and admin.html carry current asset versions (run node scripts/stamp_assets.mjs)', async () => {
  for (const [page, {html, stamped}] of Object.entries(await stampedPages())) assert.equal(html, stamped, page + ' is out of date');
});

test('stampPage versions local files and maps nested imports', () => {
  const html = '<head><link rel="stylesheet" href="styles.css"><link rel="preconnect" href="https://x.test/a.js"><script type="module" src="app.js"></script></head>';
  const out = stampPage(html, {'app.js': 'aaa', 'assets/x.js': 'bbb', 'styles.css': 'ccc'});
  assert.match(out, /href="styles\.css\?v=ccc"/);
  assert.match(out, /src="app\.js\?v=aaa"/);
  assert.match(out, /"\.\/assets\/x\.js":"\.\/assets\/x\.js\?v=bbb"/);
  assert.ok(out.indexOf('importmap') < out.indexOf('type="module"'));
  assert.match(out, /href="https:\/\/x\.test\/a\.js"/);
  assert.equal(stampPage(out, {'app.js': 'aaa', 'assets/x.js': 'bbb', 'styles.css': 'ccc'}), out);
});
