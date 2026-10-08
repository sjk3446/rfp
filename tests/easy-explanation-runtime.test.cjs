const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../pages-runtime.js'), 'utf8');

function runtime({token = '', health = {}, result = {}, offline = false} = {}) {
  const calls = [];
  const request = value => {
    const req = {result: value};
    queueMicrotask(() => req.onsuccess());
    return req;
  };
  const context = {
    window: {fetch: async (url, options) => {
      calls.push({url, options});
      if (offline) throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(url.endsWith('/health') ? health : result));
    }},
    sessionStorage: {getItem: () => token},
    location: {href: 'http://localhost:8876/'}, URL, Headers, Response,
    indexedDB: {open: () => request({transaction: () => ({objectStore: () => ({get: () => request({workspace: {references: []}})})})})},
  };
  vm.runInNewContext(source, context);
  return {calls, explain: async () => {
    const response = await context.window.fetch('/api/explain', {body: JSON.stringify({projectId: 'test', requirement: {id: 'DAR-009', name: '자료', description: '원문', easyExplanation: 'private old text'}})});
    return {status: response.status, body: await response.json()};
  }};
}

test('no connection returns an error, not the original text disguised as explanation', async () => {
  const app = runtime(); const result = await app.explain();
  assert.equal(result.status, 400);
  assert.match(result.body.error, /AI 보안 연결/);
  assert.equal(result.body.easyExplanation, undefined);
  assert.equal(app.calls.length, 0);
});
test('offline helper provides actionable guidance', async () => {
  const result = await runtime({token: 'test', offline: true}).explain();
  assert.match(result.body.error, /도우미를 실행/);
});
test('old helper must be updated before any paid AI request', async () => {
  const app = runtime({token: 'test', health: {paired: true, hasKey: true}});
  assert.match((await app.explain()).body.error, /업데이트/);
  assert.equal(app.calls.length, 1);
});
test('actual response returned; only selected requirement fields sent', async () => {
  const app = runtime({token: 'test', health: {paired: true, hasKey: true, explanationVersion: 2}, result: {text: '쉬운 해설', sources: []}});
  assert.equal((await app.explain()).body.easyExplanation, '쉬운 해설');
  const body = JSON.parse(app.calls[1].options.body);
  assert.equal(body.requirement.easyExplanation, undefined);
  assert.equal(body.requirement.id, 'DAR-009');
});
test('empty AI output is an error', async () => {
  const result = await runtime({token: 'test', health: {paired: true, hasKey: true, explanationVersion: 2}, result: {text: ' '}}).explain();
  assert.equal(result.status, 400);
  assert.match(result.body.error, /빈 설명/);
});
