const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');

const endpoint = 'https://script.google.com/macros/s/test/exec';
const sessionKey = 'reqly-directory-session-v1';
const id = letter => letter.repeat(64);
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setImmediate(resolve));
class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attributes = {}; this.style = {}; this.value = ''; this.textContent = ''; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  appendChild(node) { this.append(node); return node; }
  setAttribute(key, value) { this.attributes[key] = value; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
  focus() { this.focused = true; }
}
const walk = node => [node, ...node.children.flatMap(walk)];
function browser({ hash = '', storedSession, lifetime = 5000, pages } = {}) {
  let clock = 1800000000000, timerId = 0, nonce;
  const body = new Element('body'), listeners = {}, requests = [], events = [], timers = new Map(), held = [], holds = new Map(), overrides = new Map();
  const local = new Map(), session = new Map();
  const storage = map => ({ getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key) });
  if (storedSession) session.set(sessionKey, JSON.stringify(typeof storedSession === 'function' ? storedSession(clock) : storedSession));
  const location = new URL('https://sjk3446.github.io/rfp/' + hash);
  const sessionResult = () => ({ directoryToken: 'directory-session-fixture', expiresAt: clock + lifetime });
  const pageData = pages || [{ projects: [{ id: id('a'), name: '서버 전용 사업', updatedAt: '2026-10-27T00:00:00Z' }], nextCursor: '' }];
  const defaultResponse = request => {
    switch (request.action) {
      case 'directoryChallenge': return { configured: true, salt: id('d'), iterations: 600000 };
      case 'directoryLogin': case 'directorySetup': case 'directoryChangePassword': return sessionResult();
      case 'directorySetupChallenge': return { ready: true };
      case 'directoryList': return pageData[request.cursor ? Number(request.cursor.split('-')[1]) : 0];
      case 'load': return { error: true, code: 'AUTH', message: '프로젝트 비밀번호가 필요합니다.' };
      default: throw new Error('Unexpected request ' + request.action);
    }
  };
  const peer = { postMessage(message) {
    const request = message.request; requests.push(request);
    const response = (overrides.get(request.action) || defaultResponse)(request);
    const result = response?.error ? { ok: false, code: response.code, error: response.message } : { ok: true, value: response };
    const deliver = () => listeners.message({ origin: 'https://test-script.googleusercontent.com', source: peer, data: { channel: 'reqly-drive-v1', nonce, requestId: message.requestId, result } });
    if ((holds.get(request.action) || 0) > 0) { holds.set(request.action, holds.get(request.action) - 1); held.push(deliver); }
    else queueMicrotask(deliver);
  } };
  body.appendChild = frame => { body.append(frame); nonce = new URL(frame.src).searchParams.get('channel'); queueMicrotask(() => listeners.message({ origin: 'https://test-script.googleusercontent.com', source: peer, data: { channel: 'reqly-drive-v1', nonce, ready: true } })); };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const context = {
    URL, URLSearchParams, Map, Set, TextEncoder, Uint8Array, Date: Clock, CustomEvent,
    crypto: { randomUUID: webcrypto.randomUUID.bind(webcrypto), getRandomValues: webcrypto.getRandomValues.bind(webcrypto), subtle: {
      // Keep derivation deterministic and fast; these tests exercise callers and credential boundaries, not PBKDF2.
      importKey: async (_, bytes) => bytes,
      deriveBits: async (options, key) => Uint8Array.from(createHash('sha256').update(key).update(options.salt).digest()).buffer
    } },
    setTimeout(fn, delay) { const key = ++timerId; timers.set(key, { fn, at: clock + delay }); return key; },
    clearTimeout(key) { timers.delete(key); }, setInterval: () => 1, clearInterval() {},
    location, history: { replaceState(_, __, url) { location.href = String(url); } },
    document: { body, hidden: false, createElement: tag => new Element(tag) },
    window: {
      REQLY_CLOUD: { endpoint }, ReqlySharedCore: require('../shared-core.js'), ReqlyProjectDirectory: require('../project-directory.js'),
      ReqlyProjectPicker: { loading: () => ({ close() {}, update() {} }) },
      localStorage: storage(local), sessionStorage: storage(session),
      addEventListener(name, handler) { listeners[name] = handler; }, removeEventListener(name) { delete listeners[name]; },
      dispatchEvent(event) { events.push(event); }
    }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../shared-runtime.js'), 'utf8'), context);
  const form = () => walk(body).find(node => node.tag === 'form');
  const submit = values => { const current = form(); assert.ok(current, 'credential form is visible'); const inputs = walk(current).filter(node => node.tag === 'input'); assert.equal(inputs.length, values.length); inputs.forEach((input, index) => { input.value = values[index]; }); current.onsubmit({ preventDefault() {} }); return inputs; };
  return {
    api: context.window.ReqlyShared, requests, local, session, location, events, form, body, submit,
    override(action, response) { overrides.set(action, typeof response === 'function' ? response : () => response); },
    hold(action) { holds.set(action, (holds.get(action) || 0) + 1); },
    release() { held.splice(0).forEach(deliver => deliver()); },
    cancel() { const current = form(); assert.ok(current); walk(current).find(node => node.attributes['data-dialog-cancel'] !== undefined).onclick(); },
    advance(ms) { clock += ms; for (const [key, timer] of [...timers]) if (timer.at <= clock && timers.delete(key)) timer.fn(); },
    async unlock() { const work = this.api.unlockDirectory(); submit(['owner-password']); assert.equal(await work, true); }
  };
}

test('locked directory exposes no history; cancellation makes no bridge request', async () => {
  const b = browser();
  require('../project-directory.js').create({ getItem: key => b.local.get(key), setItem: (key, value) => b.local.set(key, value) }).remember({ id: id('f'), name: '기존 브라우저 기록' });
  assert.deepEqual(plain(b.api.knownProjects()), []);
  await assert.rejects(b.api.refreshDirectory(), /목록 관리자/);
  const work = b.api.unlockDirectory(); b.cancel(); assert.equal(await work, false);
  assert.equal(b.requests.length, 0); assert.equal(b.api.directoryUnlocked, false); assert.equal(b.session.size, 0);
});

test('incorrect directory password permits retry or cancel without retaining credentials', async () => {
  const b = browser(); let attempts = 0;
  b.override('directoryLogin', () => ++attempts === 1 ? { error: true, code: 'DIRECTORY_AUTH', message: '목록 비밀번호가 다릅니다.' } : { directoryToken: 'accepted-directory-token', expiresAt: 1800000005000 });
  const work = b.api.unlockDirectory(), oldInputs = b.submit(['wrong-password']); await tick();
  assert.equal(b.api.directoryUnlocked, false); assert.deepEqual(plain(b.api.knownProjects()), []); assert.equal(b.session.size, 0);
  assert.ok(walk(b.form()).some(node => node.textContent === '목록 비밀번호가 다릅니다.'));
  assert.ok(oldInputs.every(input => input.value === ''));
  b.submit(['owner-password']); assert.equal(await work, true);
  assert.equal(attempts, 2); assert.equal(JSON.stringify(b.requests).includes('owner-password'), false); assert.equal(JSON.stringify(b.requests).includes('wrong-password'), false);
  b.api.lockDirectory(); b.override('directoryLogin', { error: true, code: 'DIRECTORY_AUTH', message: '다시 입력' });
  const canceled = b.api.unlockDirectory(); b.submit(['wrong']); await tick(); b.cancel(); assert.equal(await canceled, false); assert.equal(b.api.directoryUnlocked, false);
});

test('all pages are fetched, deduplicated and metadata stays in memory with only session token persisted', async () => {
  const b = browser({ pages: [
    { projects: [{ id: id('a'), name: '처음 이름', updatedAt: '2026-10-25' }, { id: 'invalid', name: '무시' }], nextCursor: 'page-1' },
    { projects: [{ id: id('b'), name: '두 번째 사업', updatedAt: '2026-10-27', auth: 'must-not-retain', workspace: { secret: 1 } }, { id: id('a'), name: '최신 이름', updatedAt: '2026-10-26' }], nextCursor: '' }
  ] });
  await b.unlock();
  assert.deepEqual(plain(b.api.knownProjects()), [{ id: id('b'), name: '두 번째 사업', updatedAt: '2026-10-27' }, { id: id('a'), name: '최신 이름', updatedAt: '2026-10-26' }]);
  assert.deepEqual(b.requests.filter(request => request.action === 'directoryList').map(request => request.cursor || ''), ['', 'page-1']);
  assert.equal(b.local.size, 0);
  const saved = JSON.parse(b.session.get(sessionKey)); assert.deepEqual(Object.keys(saved).sort(), ['directoryToken', 'endpoint', 'expiresAt']);
  assert.equal(JSON.stringify([...b.session]).includes('두 번째 사업'), false);
  const copy = b.api.knownProjects(); copy[0].name = 'mutated'; assert.equal(b.api.knownProjects()[0].name, '두 번째 사업');
});

test('directory session restoration is endpoint and expiry scoped and does not persist project names', async () => {
  const saved = clock => ({ endpoint, expiresAt: clock + 5000, directoryToken: 'restored-session' });
  const b = browser({ storedSession: saved }); assert.equal(b.api.directoryUnlocked, true); assert.deepEqual(plain(b.api.knownProjects()), []);
  await b.api.refreshDirectory(); assert.equal(b.api.knownProjects().length, 1); assert.equal(b.local.size, 0);
  assert.equal(b.requests[0].directoryToken, 'restored-session');
  for (const storedSession of [clock => ({ ...saved(clock), expiresAt: clock - 1 }), clock => ({ ...saved(clock), endpoint: 'https://another.example/exec' })]) {
    const invalid = browser({ storedSession }); assert.equal(invalid.api.directoryUnlocked, false); assert.deepEqual(plain(invalid.api.knownProjects()), []); assert.equal(invalid.requests.length, 0);
  }
});

test('locking while a list request is pending cannot restore names or session', async () => {
  const b = browser(); await b.unlock(); b.hold('directoryList');
  const first = b.api.refreshDirectory(), second = b.api.refreshDirectory(); await tick();
  assert.equal(b.requests.filter(request => request.action === 'directoryList').length, 2, 'concurrent refresh shares one request');
  b.api.lockDirectory(); assert.deepEqual(plain(b.api.knownProjects()), []); assert.equal(b.session.size, 0);
  b.release(); assert.deepEqual(plain(await first), []); await second;
  assert.equal(b.api.directoryUnlocked, false); assert.deepEqual(plain(b.api.knownProjects()), []); assert.equal(b.session.size, 0);
});

test('session expiry clears names and pending list responses cannot repopulate them', async () => {
  const b = browser(); await b.unlock(); b.hold('directoryList'); const work = b.api.refreshDirectory(); await tick();
  b.advance(5001); assert.equal(b.api.directoryUnlocked, false); assert.deepEqual(plain(b.api.knownProjects()), []); assert.equal(b.session.size, 0);
  b.release(); await work; assert.deepEqual(plain(b.api.knownProjects()), []);
  assert.ok(b.events.some(event => event.detail.message.includes('만료')));
});

test('authentication rejection clears a previously loaded directory and its session', async () => {
  for (const code of ['DIRECTORY_AUTH', 'DIRECTORY_UNCONFIGURED']) {
    const b = browser(); await b.unlock(); b.override('directoryList', { error: true, code, message: '목록 접속 만료' });
    await assert.rejects(b.api.refreshDirectory(), error => error.code === code);
    assert.equal(b.api.directoryUnlocked, false); assert.deepEqual(plain(b.api.knownProjects()), []); assert.equal(b.session.size, 0);
  }
});

test('setup secret is removed from URL immediately, never persisted and consumed after validated setup', async () => {
  const setupToken = id('e'), b = browser({ hash: '#directory-setup=' + setupToken });
  assert.equal(b.location.hash, ''); assert.equal(b.api.canSetupDirectory, true); assert.equal(b.requests.length, 0);
  assert.equal(b.local.size, 0); assert.equal(b.session.size, 0);
  const work = b.api.setupDirectory(); await tick(); b.submit(['new-password', 'typo']);
  assert.equal(b.requests.filter(request => request.action === 'directorySetup').length, 0); assert.ok(b.form());
  b.submit(['new-password', 'new-password']); assert.equal(await work, true);
  assert.equal(b.api.canSetupDirectory, false); assert.equal(b.api.directoryUnlocked, true);
  assert.deepEqual(b.requests.filter(request => request.action.startsWith('directorySetup')).map(request => request.setupToken), [setupToken, setupToken]);
  assert.equal(JSON.stringify([...b.local, ...b.session]).includes(setupToken), false); assert.equal(JSON.stringify(b.requests).includes('new-password'), false);
  assert.equal(await b.api.setupDirectory(), false);
});

test('cancelled setup sends no setup write; invalid setup link is discarded', async () => {
  const b = browser({ hash: '#directory-setup=' + id('e') }); const work = b.api.setupDirectory(); await tick(); b.cancel();
  assert.equal(await work, false); assert.deepEqual(b.requests.map(request => request.action), ['directorySetupChallenge']); assert.equal(b.session.size, 0);
  b.override('directorySetupChallenge', { error: true, code: 'DIRECTORY_SETUP_INVALID', message: '설정 링크 만료' });
  await assert.rejects(b.api.setupDirectory(), /설정 링크 만료/); assert.equal(b.api.canSetupDirectory, false);
});

test('directory authentication never grants project credentials or forwards its token as a project token', async () => {
  const b = browser(); await b.unlock(); assert.equal(b.api.project, undefined); assert.equal(b.api.role, '');
  await assert.rejects(b.api.refresh(), error => error.code === 'AUTH');
  const load = b.requests.find(request => request.action === 'load'); assert.equal(load.token, ''); assert.equal(load.directoryToken, undefined);
  assert.equal(b.api.project, undefined); assert.equal(b.api.role, '');
});

test('locking during directory login prevents a delayed successful login from reopening the list', async () => {
  const b = browser(); b.hold('directoryLogin'); const work = b.api.unlockDirectory(); b.submit(['owner-password']); await tick();
  b.api.lockDirectory(); b.release(); await work;
  assert.equal(b.api.directoryUnlocked, false); assert.deepEqual(plain(b.api.knownProjects()), []); assert.equal(b.session.size, 0);
});

test('locking during setup or password change prevents delayed success from restoring directory access', async () => {
  const setup = browser({ hash: '#directory-setup=' + id('e') }); setup.hold('directorySetup');
  const setupWork = setup.api.setupDirectory(); await tick(); setup.submit(['new-password', 'new-password']); await tick();
  setup.api.lockDirectory(); setup.release(); assert.equal(await setupWork, false);
  assert.equal(setup.api.directoryUnlocked, false); assert.equal(setup.api.canSetupDirectory, false); assert.equal(setup.session.size, 0); assert.deepEqual(plain(setup.api.knownProjects()), []);
  const changed = browser(); await changed.unlock(); changed.hold('directoryChangePassword');
  const changeWork = changed.api.changeDirectoryPassword(); changed.submit(['old-password', 'new-password', 'new-password']); await tick();
  changed.api.lockDirectory(); changed.release(); assert.equal(await changeWork, false);
  assert.equal(changed.api.directoryUnlocked, false); assert.equal(changed.session.size, 0); assert.deepEqual(plain(changed.api.knownProjects()), []);
});

test('a late authentication failure from an older request does not lock a newer login', async () => {
  const b = browser(); await b.unlock(); b.hold('directoryList');
  b.override('directoryList', { error: true, code: 'DIRECTORY_AUTH', message: '이전 접속 만료' });
  const stale = b.api.refreshDirectory(); const rejected = assert.rejects(stale, error => error.code === 'DIRECTORY_AUTH'); await tick();
  b.api.lockDirectory(); b.override('directoryList', { projects: [{ id: id('b'), name: '새 접속에서 불러온 사업', updatedAt: '2026-10-27' }], nextCursor: '' });
  await b.unlock(); b.release(); await rejected;
  assert.equal(b.api.directoryUnlocked, true); assert.equal(b.api.knownProjects()[0].name, '새 접속에서 불러온 사업'); assert.ok(b.session.has(sessionKey));
});

test('a cyclic pagination response cannot commit a partial replacement directory', async () => {
  const b = browser(); await b.unlock(); const original = plain(b.api.knownProjects());
  b.override('directoryList', { projects: [{ id: id('b'), name: '미완료 목록', updatedAt: '2026-10-27' }], nextCursor: 'repeated-cursor' });
  await assert.rejects(b.api.refreshDirectory(), /끝까지 확인/);
  assert.deepEqual(plain(b.api.knownProjects()), original); assert.equal(b.local.size, 0);
});
