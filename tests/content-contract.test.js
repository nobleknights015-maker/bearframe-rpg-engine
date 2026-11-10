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
