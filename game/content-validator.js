/* Independent, deterministic game-data validation. No browser, Android or Node APIs. */
function validateWorldContent(content) {
  if (!content || typeof content !== 'object') throw new TypeError('World content missing');
  var WORLD = content.WORLD, FOES = content.FOES, TEXT = content.TEXT, ACTIONS = content.ACTIONS;
  function record(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length)
      throw new TypeError(name + ' must be a nonempty object');
    return value;
  }
  record(WORLD, 'WORLD'); record(FOES, 'FOES'); record(TEXT, 'TEXT'); record(ACTIONS, 'ACTIONS');
  var areas = Object.keys(WORLD), events = Object.keys(TEXT), foes = Object.keys(FOES), actions = Object.keys(ACTIONS);
  var isColor = function(x) {return typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x);};
  var id = function(x) {return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(x);};
  var validTile = function(k, area) {return '#.P'.indexOf(k) !== -1 || Object.prototype.hasOwnProperty.call(TEXT,k) || Object.prototype.hasOwnProperty.call(area.exits,k);};
  var errors = [];
  function assert(condition, message) {if(!condition)errors.push(message);}
  areas.forEach(function(key) {
    var area = WORLD[key];
    assert(id(key), 'Invalid area id ' + key);
    if (!area || typeof area !== 'object') {errors.push(key + ': invalid area');return;}
    assert(typeof area.name === 'string' && area.name.trim().length > 0, key + ': missing display name');
    ['sky','stone','light'].forEach(function(c) {assert(isColor(area[c]), key + ': invalid ' + c + ' color');});
    if (!Array.isArray(area.rows) || !area.rows.length || typeof area.rows[0] !== 'string' || !area.rows[0].length) {
      errors.push(key + ': missing map rows');return;
    }
    var width = area.rows[0].length;
    assert(width <= 1024 && area.rows.length <= 1024, key + ': map exceeds size budget');
    assert(area.exits && typeof area.exits === 'object' && !Array.isArray(area.exits), key + ': invalid exits');
    var exitKeys = area.exits && typeof area.exits === 'object' ? Object.keys(area.exits) : [];
    exitKeys.forEach(function(tile) {
      assert(tile.length === 1 && tile !== '#' && tile !== '.' && tile !== 'P' && !Object.prototype.hasOwnProperty.call(TEXT,tile), key + ': invalid exit marker ' + tile);
      var target = area.exits[tile];
      if (!Array.isArray(target) || target.length !== 3 || typeof target[0] !== 'string' || !Number.isInteger(target[1]) || !Number.isInteger(target[2])) {
        errors.push(key + ': malformed exit ' + tile);return;
      }
      var destination = WORLD[target[0]];
      assert(!!destination, key + ': exit ' + tile + ' references missing area ' + target[0]);
      if (destination && Array.isArray(destination.rows)) {
        var row = destination.rows[target[2]];
        assert(typeof row === 'string' && row[target[1]] !== undefined && row[target[1]] !== '#', key + ': exit ' + tile + ' target is blocked or out of bounds');
      }
    });
    var seen = Object.create(null), walkable = 0;
    area.rows.forEach(function(row, y) {
      if (typeof row !== 'string' || row.length !== width) {errors.push(key + ': row ' + y + ' width mismatch');return;}
      for (var x=0; x<row.length; x++) {
        var tile = row[x];
        assert(validTile(tile, area), key + ': unknown tile ' + tile + ' at ' + x + ',' + y);
        if (tile !== '#') walkable++;
        if (exitKeys.indexOf(tile) !== -1)seen[tile] = true;
      }
    });
    assert(walkable > 0, key + ': map contains no walkable cells');
    exitKeys.forEach(function(tile) {assert(seen[tile], key + ': unused exit marker ' + tile);});
  });
  events.forEach(function(key) {
    assert(key.length === 1 && '#.P'.indexOf(key) === -1, 'Invalid event marker ' + key);
    assert(typeof TEXT[key] === 'string' && TEXT[key].length > 0 && TEXT[key].length <= 10000, 'Invalid event text for ' + key);
    assert(Object.prototype.hasOwnProperty.call(ACTIONS,key), 'Missing ACTIONS for ' + key);
  });
  actions.forEach(function(key) {
    assert(Object.prototype.hasOwnProperty.call(TEXT,key), 'Orphan ACTIONS ' + key);
    var choices = ACTIONS[key];
    if (!Array.isArray(choices) || !choices.length) {errors.push('Missing choices for ' + key);return;}
    var seen = Object.create(null);
    choices.forEach(function(choice,i) {
      if (!Array.isArray(choice) || choice.length !== 2 || typeof choice[0] !== 'string' || !id(choice[0]) || typeof choice[1] !== 'string' || !choice[1].trim()) {
        errors.push('Malformed choice ' + key + '[' + i + ']');return;
      }
      assert(!seen[choice[0]], 'Duplicate choice ' + key + ':' + choice[0]);
      seen[choice[0]] = true;
      if (choice[0] === 'fight' || choice[0] === 'challenge')
        assert(Object.prototype.hasOwnProperty.call(FOES,key), 'Combat choice ' + key + ' has no foe');
    });
  });
  foes.forEach(function(key) {
    var f = FOES[key];
    assert(key.length === 1 && f && typeof f.name === 'string' && !!f.name.trim(), 'Invalid foe ' + key);
    if (!f) return;
    ['hp','power','period'].forEach(function(prop) {assert(Number.isSafeInteger(f[prop]) && f[prop] > 0 && f[prop] <= 100000, 'Invalid foe ' + key + '.' + prop);});
  });
  if (errors.length) throw new TypeError('Invalid game content (' + errors.length + '):\n' + errors.join('\n'));
  return Object.freeze({areas:areas.length,events:events.length,foes:foes.length});
}
if (typeof module !== 'undefined') module.exports = validateWorldContent;
