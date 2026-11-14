const test = require('node:test');
const assert = require('node:assert/strict');
const validate = require('../game/content-validator');
const current = require('../game/world');
const clone = x => JSON.parse(JSON.stringify(x));
const changes = fn => { const next = clone(current); fn(next); return next; };

test('authoritative Sounding Ridge data satisfies the reusable engine content contract', () => {
  assert.deepEqual(validate(current), {areas:3,events:7,foes:3});
});
test('rejects malformed map geometry and undefined tiles', () => {
  assert.throws(() => validate(changes(c => { c.WORLD.pod.rows[1] += '.'; })), /width mismatch/);
  assert.throws(() => validate(changes(c => { c.WORLD.pod.rows[1] = '#?..###.###.#'; })), /unknown tile/);
});
test('rejects unsafe exits and missing destinations', () => {
  assert.throws(() => validate(changes(c => { c.WORLD.pod.exits['>'] = ['missing',1,4]; })), /missing area/);
  assert.throws(() => validate(changes(c => { c.WORLD.pod.exits['>'] = ['gallery',0,0]; })), /blocked or out of bounds/);
  assert.throws(() => validate(changes(c => { c.WORLD.pod.exits['>'] = ['gallery',100,4]; })), /blocked or out of bounds/);
});
test('rejects broken event and combat contracts', () => {
  assert.throws(() => validate(changes(c => { delete c.ACTIONS.G; })), /Missing ACTIONS/);
  assert.throws(() => validate(changes(c => { c.ACTIONS.E.push(['invite','Duplicate']); })), /Duplicate choice/);
  assert.throws(() => validate(changes(c => { delete c.FOES.H; })), /Combat choice H has no foe/);
  assert.throws(() => validate(changes(c => { c.FOES.H.period = 0; })), /Invalid foe H.period/);
});
test('validation never mutates source content', () => {
  const original = JSON.stringify(current);
  validate(current);
  assert.equal(JSON.stringify(current), original);
});

const fingerprint = require('../framework/content-contract');
test('content fingerprints refuse enumerable array metadata rather than silently ignoring it', () => {
  const base = {contentRevision:'v1', entries:[1,2]};
  const original = fingerprint(base);
  const extra = {contentRevision:'v1', entries:[1,2]};
  extra.entries.note = 'unfingerprinted metadata';
  assert.throws(() => fingerprint(extra), /array property/);
  const edge = {contentRevision:'v1', entries:[1,2]};
  edge.entries[4] = 5;
  assert.throws(() => fingerprint(edge), /Sparse content contract array/);
  assert.equal(fingerprint(base), original);
  assert.equal(fingerprint({entries:[1,2],contentRevision:'v1'}), original);
});

test('content fingerprints reject accessors and symbol-keyed metadata without invoking getters', () => {
  const baseline = {contentRevision:'v1', entries:[1,2]};
  const stable = fingerprint(baseline);
  let calls = 0;
  const accessor = {contentRevision:'v1', entries:[1,2]};
  Object.defineProperty(accessor.entries, '0', {
    enumerable:true, configurable:true,
    get(){ calls++; return 1; }
  });
  assert.throws(() => fingerprint(accessor), /accessor property/);
  assert.equal(calls, 0);
  const symbol = {contentRevision:'v1', entries:[1,2]};
  symbol[Symbol('metadata')] = 'ignored without guard';
  assert.throws(() => fingerprint(symbol), /symbol property/);
  assert.equal(fingerprint(baseline), stable);
});
