/**
 * Test suite for Dominion Dealer.
 *
 *   node test.js
 *
 * No dependencies and no build step. It reads dealer/index.html, pulls out the
 * <script> block, and runs it against a stubbed DOM, so it tests the real
 * shipping file rather than a copy.
 *
 * Adding a test: call `test('what it should do', fn)` inside a `group(...)`.
 * Inside the fn, use the assertion helpers (eq, ok, deepEq, match). Call
 * `env()` first in any test that touches app state — it gives you a fresh app
 * with empty storage.
 */

const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, 'dealer', 'index.html');
const html = fs.readFileSync(PAGE, 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

/* ------------------------------------------------------------------ *
 * Harness
 * ------------------------------------------------------------------ */

/**
 * Boots a fresh copy of the app.
 *
 * @param {object} [opts]
 * @param {string} [opts.hash]   location.hash, e.g. '#setup=RQKKCCAAACA'
 * @param {object} [opts.saved]     pre-existing localStorage state
 * @param {string} [opts.rawSaved]  raw localStorage string, for corruption tests
 * @returns {{app: object, els: object, store: object}}
 *   app   - the app's functions and live state (see the export list below)
 *   els   - stub elements, keyed by id, as the app created them
 *   store - the backing object for localStorage
 */
function env(opts) {
  opts = opts || {};
  const store = {};
  if (opts.saved) store['dominionDealer.v1'] = JSON.stringify(opts.saved);
  if (opts.rawSaved !== undefined) store['dominionDealer.v1'] = opts.rawSaved;

  global.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v },
    removeItem: k => { delete store[k] }
  };
  global.navigator = {};
  global.history = { replaceState() { } };
  global.location = {
    // Stub values only; nothing here depends on where the app is hosted.
    origin: 'https://example.github.io',
    pathname: '/dominion/dealer/',
    hash: opts.hash || ''
  };

  const els = {};
  const makeEl = id => ({
    id, innerHTML: '', textContent: '', value: '', disabled: false,
    // #moreList ships collapsed, so the stub has to start that way too or the
    // visible/hidden branching reads wrong.
    _classes: new Set(id === 'moreList' ? ['hidden'] : []),
    get classList() {
      const c = this._classes;
      return {
        add: x => c.add(x),
        remove: x => c.delete(x),
        contains: x => c.has(x),
        toggle: (x, force) => {
          const want = force === undefined ? !c.has(x) : force;
          if (want) c.add(x); else c.delete(x);
          return c.has(x);
        }
      };
    }
  });

  global.document = {
    getElementById: id => els[id] || (els[id] = makeEl(id)),
    querySelector: () => null,
    createElement: () => makeEl('transient'),
    body: { appendChild() { } },
    addEventListener() { }
  };
  global.btoa = s => Buffer.from(s, 'binary').toString('base64');
  global.atob = s => Buffer.from(s, 'base64').toString('binary');
  global.setTimeout = () => { };

  // The export object MUST be assigned as a literal. Object.assign would invoke
  // these getters once and freeze the results into stale snapshots.
  eval(script + `;global.__APP = {
    MASTER, SORTS, info, isBase, cardsIn,
    openSettings, saveSettings, cancelSettings, resetSettings,
    sortBy, applySort, toggleOwned, moveExpansion, setSearch, clearSearch,
    toggleExpansion, toggleMoreExpansions, setMixMode, changeMixSize,
    drawWithRandomMix, drawCards, performDraw, updateSummary, render,
    encodeSetup, decodeSetup, setupLink, liveState, applyState,
    get order() { return order },
    get owned() { return owned },
    get selected() { return selected },
    get sortKey() { return sortKey },
    get sortDir() { return sortDir },
    get mixMode() { return mixMode },
    get mixSize() { return mixSize },
    get draft() { return draft }
  };`);

  return { app: global.__APP, els, store };
}

/* ------------------------------------------------------------------ *
 * Assertions + runner
 * ------------------------------------------------------------------ */

let passed = 0;
const failures = [];
let currentGroup = '';

function group(name, fn) {
  currentGroup = name;
  console.log('\n' + name);
  fn();
}

function test(name, fn) {
  try {
    const note = fn();
    passed++;
    console.log('  ok    ' + name + (note ? '   ' + note : ''));
  } catch (err) {
    failures.push({ group: currentGroup, name, message: err.message });
    console.log('  FAIL  ' + name + '\n          ' + err.message.replace(/\n/g, '\n          '));
  }
}

function fail(message) { throw new Error(message) }
function ok(cond, message) { if (!cond) fail(message || 'expected truthy') }
function eq(actual, expected, message) {
  if (actual !== expected) {
    fail((message ? message + '\n' : '') + 'expected: ' + JSON.stringify(expected) + '\n  actual: ' + JSON.stringify(actual));
  }
}
function deepEq(actual, expected, message) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) fail((message ? message + '\n' : '') + 'expected: ' + b + '\n  actual: ' + a);
}
function match(text, re, message) {
  if (!re.test(text)) fail((message || 'no match for ' + re) + '\n  actual: ' + JSON.stringify(text));
}
/** Asserts a list is ordered by `valueOf`, ascending or descending. */
function ordered(list, valueOf, dir, message) {
  for (let i = 1; i < list.length; i++) {
    const prev = valueOf(list[i - 1]), cur = valueOf(list[i]);
    const bad = dir === 'asc' ? prev > cur : prev < cur;
    if (bad) fail((message || 'out of order') + ' at index ' + i + ': ' + list[i - 1] + ' then ' + list[i]);
  }
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

const SORT_BUTTON = { alpha: 'sortAlpha', pop: 'sortPop', year: 'sortYear' };

/** Original (1st edition) release year per expansion family. */
const FAMILY_YEAR = {
  Base: 2008, Intrigue: 2009, Seaside: 2009, Alchemy: 2010, Prosperity: 2010,
  Cornucopia: 2011, Hinterlands: 2011, 'Dark Ages': 2012, Guilds: 2013,
  Adventures: 2015, Empires: 2016, Nocturne: 2017, Renaissance: 2018,
  Menagerie: 2020, Allies: 2022, Plunder: 2022, 'Rising Sun': 2024
};

const familyOf = name => name.replace(/ [12]E$/, '');

/** Applies a sort from a clean slate, since clicking an active key flips it. */
function sortFresh(app, key, dir) {
  app.openSettings();
  app.resetSettings();
  app.sortBy(key);
  if (dir === -1) app.sortBy(key);
}

/** Expansion names shown in the last result, ignoring the Platinum/Colony line. */
function drawnNames(els) {
  return els.result.innerHTML
    .split('<br>')
    .filter(line => line.indexOf('Platinum') === -1 && line.length > 0)
    .map(line => line.split(':')[0]);
}

function tickAll(app) { app.order.forEach(n => app.toggleExpansion(n, true)) }

function settingsRowCount(els) {
  return (els.settingsList.innerHTML.match(/class="setting-row/g) || []).length;
}

/* ================================================================== *
 * Tests
 * ================================================================== */

group('Expansion data', () => {
  const { app } = env();

  test('every entry has the fields the app relies on', () => {
    app.MASTER.forEach(e => {
      ok(typeof e.id === 'number' && e.id > 0, e.name + ' has no id');
      ok(typeof e.cards === 'number' && e.cards > 0, e.name + ' has no card count');
      ok(typeof e.year === 'number', e.name + ' has no year');
      ok(typeof e.pop === 'number', e.name + ' has no popularity rank');
    });
    return app.MASTER.length + ' entries';
  });

  test('ids are unique', () => {
    const ids = app.MASTER.map(e => e.id);
    eq(new Set(ids).size, ids.length, 'duplicate id in MASTER');
  });

  test('ids fit the 6-bit setup-link field', () => {
    const over = app.MASTER.filter(e => e.id > 63).map(e => e.name);
    deepEq(over, [], 'ids above 63 cannot be encoded; widen the bit fields');
  });

  test('names are unique', () => {
    const names = app.MASTER.map(e => e.name);
    eq(new Set(names).size, names.length, 'duplicate name in MASTER');
  });

  // Editions are split only where the Kingdom card count differs, because that
  // is what changes the draw weighting.
  [['Base', 25, 26], ['Intrigue', 25, 26], ['Seaside', 26, 27]].forEach(([fam, first, second]) => {
    test(fam + ' is split 1E/2E with distinct counts', () => {
      eq(app.info(fam + ' 1E').cards, first);
      eq(app.info(fam + ' 2E').cards, second);
      return first + ' vs ' + second + ' cards';
    });
  });

  // Same count across editions, so one entry dated to the newest edition.
  [['Prosperity', 25, 2022], ['Hinterlands', 26, 2022],
   ['Cornucopia', 13, 2024], ['Guilds', 13, 2024]].forEach(([name, cards, year]) => {
    test(name + ' is a single entry dated to its latest edition', () => {
      eq(app.MASTER.filter(e => e.name === name).length, 1);
      eq(app.info(name).cards, cards);
      eq(app.info(name).year, year);
      return cards + ' cards, ' + year;
    });
  });

  test('every family in FAMILY_YEAR is present', () => {
    const fams = new Set(app.MASTER.map(e => familyOf(e.name)));
    const missing = Object.keys(FAMILY_YEAR).filter(f => !fams.has(f));
    deepEq(missing, [], 'test data out of step with MASTER');
    return fams.size + ' families';
  });
});

group('Default state (no setup link, no saved settings)', () => {
  const { app, els } = env();

  test('both Base editions lead the list', () => {
    deepEq(app.order.slice(0, 2), ['Base 1E', 'Base 2E']);
    return app.order.slice(0, 4).join(' > ');
  });

  test('no sort is applied', () => eq(app.sortKey, null));

  test('editions of a family stay together', () => {
    const runs = [];
    app.order.forEach(n => { if (runs[runs.length - 1] !== familyOf(n)) runs.push(familyOf(n)) });
    eq(runs.length, new Set(runs).size, 'a family is split across the list');
  });

  test('families run in original release order', () => {
    const runs = [];
    app.order.forEach(n => { if (runs[runs.length - 1] !== familyOf(n)) runs.push(familyOf(n)) });
    ordered(runs, f => FAMILY_YEAR[f], 'asc', 'families out of release order');
    return runs.slice(0, 5).map(f => f + '(' + FAMILY_YEAR[f] + ')').join(' ');
  });

  test('every expansion appears exactly once', () => eq(new Set(app.order).size, app.MASTER.length));

  test('default owned set is the five starter boxes', () => {
    eq(app.owned.size, 5);
    ok(app.owned.has('Base 2E'), 'Base 2E should be owned by default');
  });

  test('only Base 2E starts ticked', () => deepEq([...app.selected], ['Base 2E']));

  test('settings hint describes the default order', () => {
    app.openSettings();
    match(els.sortHint.textContent, /^Default/);
    app.cancelSettings();
    return els.sortHint.textContent;
  });
});

group('Sorting', () => {
  // The arrow must describe the order you SEE. Popularity is deliberately
  // inverted: rank 1 is the most popular, so ascending rank = popularity
  // descending. These cases check the glyph against the list actually produced.
  const cases = [
    { key: 'alpha', dir: 1, arrow: '▲', hint: 'A to Z.', first: 'Adventures' },
    { key: 'alpha', dir: -1, arrow: '▼', hint: 'Z to A.', first: 'Seaside 2E' },
    { key: 'year', dir: 1, arrow: '▲', hint: 'Oldest first.', first: 'Base 1E' },
    { key: 'year', dir: -1, arrow: '▼', hint: 'Newest first.' },
    { key: 'pop', dir: 1, arrow: '▼', hint: 'Most popular first.', first: 'Prosperity' },
    { key: 'pop', dir: -1, arrow: '▲', hint: 'Least popular first.', first: 'Alchemy' }
  ];

  const valueOf = { alpha: (app, n) => n, year: (app, n) => app.info(n).year, pop: (app, n) => app.info(n).pop };

  cases.forEach(({ key, dir, arrow, hint, first }) => {
    test(key + ' dir ' + dir + ' sorts correctly and shows ' + arrow, () => {
      const { app, els } = env();
      sortFresh(app, key, dir);
      const list = app.draft.order.slice();

      // For pop the arrow is flipped relative to the underlying field, so the
      // expected field direction comes from the case table, not from the arrow.
      const fieldDir = dir === 1 ? 'asc' : 'desc';
      if (key === 'alpha') {
        ordered(list, n => n.toLowerCase(), fieldDir, 'names out of order');
      } else {
        ordered(list, n => valueOf[key](app, n), fieldDir, key + ' out of order');
      }

      const label = els[SORT_BUTTON[key]].textContent;
      eq(label.slice(-1), arrow, 'button arrow does not match the order produced');
      eq(els.sortHint.textContent, hint, 'hint does not match the order produced');
      if (first) eq(list[0], first, 'unexpected first entry');
      app.cancelSettings();
      return label + ' -> ' + list.slice(0, 3).join(', ');
    });
  });

  test('a third click clears the sort back to default', () => {
    const { app, els } = env();
    const original = app.order.slice();
    app.openSettings();

    app.sortBy('pop');
    eq(app.draft.sortKey, 'pop');
    eq(app.draft.sortDir, 1);

    app.sortBy('pop');
    eq(app.draft.sortKey, 'pop');
    eq(app.draft.sortDir, -1);

    app.sortBy('pop');
    eq(app.draft.sortKey, null, 'third click should clear the sort');
    deepEq(app.draft.order, original, 'third click should restore the default order');
    match(els.sortHint.textContent, /^Default/);
    eq(els.sortPop.textContent, 'Popularity*', 'cleared sort should drop its arrow');

    // and the cycle starts over
    app.sortBy('pop');
    eq(app.draft.sortDir, 1);
    app.cancelSettings();
  });

  test('every sort button cycles in three clicks', () => {
    ['alpha', 'pop', 'year'].forEach(key => {
      const { app } = env();
      const original = app.order.slice();
      app.openSettings();
      app.sortBy(key); app.sortBy(key); app.sortBy(key);
      eq(app.draft.sortKey, null, key + ' did not clear on the third click');
      deepEq(app.draft.order, original, key + ' did not restore the default order');
      app.cancelSettings();
    });
  });

  test('cycling one key does not strand another', () => {
    const { app } = env();
    app.openSettings();
    app.sortBy('pop');
    app.sortBy('year');          // switch key: starts fresh at ascending
    eq(app.draft.sortDir, 1);
    app.sortBy('year');
    app.sortBy('year');          // third click on year
    eq(app.draft.sortKey, null);
    app.cancelSettings();
  });

  test('a cleared sort encodes as the default order', () => {
    const { app } = env();
    app.openSettings();
    app.sortBy('alpha'); app.sortBy('alpha'); app.sortBy('alpha');
    app.saveSettings();
    const code = app.encodeSetup(app.liveState());
    const back = app.decodeSetup(code);
    eq(back.sortKey, null);
    deepEq(back.order, app.order);
    ok(code.length <= 16, 'cleared sort should encode compactly, got ' + code.length);
    return code.length + ' chars';
  });

  test('clicking the active sort flips direction', () => {
    const { app } = env();
    app.openSettings();
    app.sortBy('year');
    eq(app.draft.sortDir, 1);
    app.sortBy('year');
    eq(app.draft.sortDir, -1);
    app.cancelSettings();
  });

  test('switching key resets to ascending', () => {
    const { app } = env();
    app.openSettings();
    app.sortBy('year'); app.sortBy('year');
    app.sortBy('pop');
    eq(app.draft.sortDir, 1);
    app.cancelSettings();
  });

  test('sorting never loses or duplicates an entry', () => {
    const { app } = env();
    ['alpha', 'pop', 'year'].forEach(key => {
      [1, -1].forEach(dir => {
        sortFresh(app, key, dir);
        eq(new Set(app.draft.order).size, app.MASTER.length, key + ' ' + dir + ' changed the list contents');
        app.cancelSettings();
      });
    });
  });

  test('moving an entry by hand drops the sort', () => {
    const { app, els } = env();
    app.openSettings();
    app.sortBy('pop');
    app.moveExpansion(0, 1);
    eq(app.draft.sortKey, null);
    match(els.sortHint.textContent, /^Default/);
    app.cancelSettings();
  });

  test('every sort mode has a button to reach it', () => {
    const { app } = env();
    Object.keys(app.SORTS).forEach(key => {
      ok(SORT_BUTTON[key], 'no button mapped for sort "' + key + '"');
      ok(html.indexOf('id="' + SORT_BUTTON[key] + '"') !== -1, 'no markup for ' + SORT_BUTTON[key]);
    });
  });
});

group('Search', () => {
  test('filters the list down', () => {
    const { app, els } = env();
    app.openSettings();
    app.setSearch('sea');
    eq(settingsRowCount(els), 2);
    ok(els.settingsList.innerHTML.indexOf('Seaside 1E') !== -1);
    return '2 rows for "sea"';
  });

  test('is case-insensitive', () => {
    const { app, els } = env();
    app.openSettings();
    app.setSearch('SEASIDE');
    eq(settingsRowCount(els), 2);
  });

  test('never changes ownership or ticks', () => {
    const { app } = env();
    app.openSettings();
    const owned = [...app.draft.owned].sort().join();
    const ticked = [...app.draft.selected].sort().join();
    app.setSearch('plunder');
    app.setSearch('a');
    app.setSearch('');
    eq([...app.draft.owned].sort().join(), owned, 'ownership changed');
    eq([...app.draft.selected].sort().join(), ticked, 'ticks changed');
  });

  test('disables reorder arrows while filtering', () => {
    const { app, els } = env();
    app.openSettings();
    app.setSearch('sea');
    // 2 rows x 2 arrows, all disabled because neighbours may be hidden.
    eq((els.settingsList.innerHTML.match(/disabled/g) || []).length, 4);
  });

  test('says so when nothing matches', () => {
    const { app, els } = env();
    app.openSettings();
    app.setSearch('qqqq');
    eq(settingsRowCount(els), 0);
    ok(els.settingsList.innerHTML.indexOf('No matches') !== -1);
  });

  test('the cross clears the term and restores the list', () => {
    const { app, els } = env();
    app.openSettings();
    app.setSearch('sea');
    ok(els.clearSearch.disabled === false, 'clear button should be live while filtering');
    app.clearSearch();
    eq(settingsRowCount(els), app.MASTER.length);
    eq(els.settingsSearch.value, '');
    ok(els.clearSearch.disabled === true, 'clear button should be inert when empty');
  });

  test('a filtered row can still be toggled', () => {
    const { app, els } = env();
    app.openSettings();
    app.setSearch('plun');
    app.toggleOwned('Plunder', true);
    ok(app.draft.owned.has('Plunder'));
    ok(els.settingsList.innerHTML.indexOf('Rising Sun') === -1, 'filter should survive the toggle');
  });

  test('search resets when settings reopen', () => {
    const { app, els } = env();
    app.openSettings();
    app.setSearch('sea');
    app.cancelSettings();
    app.openSettings();
    eq(els.settingsSearch.value, '');
    eq(settingsRowCount(els), app.MASTER.length);
  });
});

group('Staged settings', () => {
  test('edits do not touch live state until saved', () => {
    const { app } = env();
    const before = app.order.slice();
    app.openSettings();
    app.sortBy('pop');
    app.toggleOwned('Plunder', true);
    app.changeMixSize(3);
    app.setMixMode('base');
    deepEq(app.order, before, 'live order changed while editing');
    eq(app.mixSize, 2, 'live mix size changed while editing');
    eq(app.mixMode, 'any', 'live mix mode changed while editing');
    ok(!app.owned.has('Plunder'), 'live ownership changed while editing');
  });

  test('cancel discards everything', () => {
    const { app, store } = env();
    const before = app.order.slice();
    app.openSettings();
    app.sortBy('pop');
    app.toggleOwned('Plunder', true);
    app.cancelSettings();
    deepEq(app.order, before);
    ok(!app.owned.has('Plunder'));
    ok(!store['dominionDealer.v1'], 'cancel should not write to storage');
  });

  test('save commits and persists', () => {
    const { app, store } = env();
    app.openSettings();
    app.sortBy('year');
    app.toggleOwned('Plunder', true);
    app.setMixMode('base');
    app.saveSettings();
    eq(app.sortKey, 'year');
    ok(app.owned.has('Plunder'));
    eq(app.mixMode, 'base');
    const saved = JSON.parse(store['dominionDealer.v1']);
    eq(saved.sortKey, 'year');
    eq(saved.mixMode, 'base');
  });

  // The whole point of staging: browsing sorts must not cost you a hand-made order.
  test('a hand-made order survives browsing every sort', () => {
    const { app } = env();
    app.openSettings();
    app.moveExpansion(0, 1);
    app.moveExpansion(4, 1);
    app.moveExpansion(9, -1);
    app.saveSettings();
    const custom = app.order.slice();

    app.openSettings();
    app.sortBy('pop'); app.sortBy('pop');
    app.sortBy('year'); app.sortBy('year');
    app.sortBy('alpha');
    app.cancelSettings();

    deepEq(app.order, custom, 'browsing sorts destroyed the custom order');
  });

  test('reset only stages defaults, and save applies them', () => {
    const { app } = env();
    app.openSettings();
    app.sortBy('year');
    app.saveSettings();

    app.openSettings();
    app.resetSettings();
    eq(app.sortKey, 'year', 'reset leaked into live state');
    eq(app.draft.sortKey, null);
    app.saveSettings();
    eq(app.sortKey, null);
    eq(app.owned.size, 5);
  });
});

group('Setup links', () => {
  test('default setup encodes compactly', () => {
    const { app } = env();
    const code = app.encodeSetup(app.liveState());
    ok(code.length <= 16, 'default link got long: ' + code.length + ' chars');
    return code.length + ' chars -> ' + app.setupLink();
  });

  test('sorted setups stay compact (order is recomputed, not stored)', () => {
    const { app } = env();
    const lengths = [];
    ['alpha', 'pop', 'year'].forEach(key => {
      [1, -1].forEach(dir => {
        sortFresh(app, key, dir);
        app.saveSettings();
        const code = app.encodeSetup(app.liveState());
        ok(code.length <= 16, key + ' ' + dir + ' link got long: ' + code.length);
        lengths.push(code.length);
      });
    });
    return 'max ' + Math.max(...lengths) + ' chars';
  });

  test('every sort mode round-trips', () => {
    ['alpha', 'pop', 'year'].forEach(key => {
      [1, -1].forEach(dir => {
        const { app } = env();
        sortFresh(app, key, dir);
        app.saveSettings();
        const back = app.decodeSetup(app.encodeSetup(app.liveState()));
        deepEq(back.order, app.order, key + ' ' + dir + ' order lost');
        eq(back.sortKey, key, key + ' ' + dir + ' key lost');
        eq(back.sortDir, dir, key + ' ' + dir + ' direction lost');
      });
    });
  });

  test('a hand-made order round-trips', () => {
    const { app } = env();
    app.openSettings();
    app.moveExpansion(0, 1);
    app.moveExpansion(7, -1);
    app.saveSettings();
    const code = app.encodeSetup(app.liveState());
    const back = app.decodeSetup(code);
    deepEq(back.order, app.order);
    eq(back.sortKey, null, 'custom order should not decode as a sort');
    ok(code.length <= 40, 'custom-order link got long: ' + code.length);
    return code.length + ' chars';
  });

  test('ownership, ticks and mix settings round-trip', () => {
    const { app } = env();
    app.openSettings();
    app.toggleOwned('Plunder', true);
    app.toggleOwned('Base 1E', true);
    app.setMixMode('base');
    app.changeMixSize(4);
    app.saveSettings();
    app.toggleExpansion('Nocturne', true);
    app.toggleExpansion('Alchemy', true);

    const back = app.decodeSetup(app.encodeSetup(app.liveState()));
    deepEq(back.owned.sort(), [...app.owned].sort());
    deepEq(back.selected.sort(), [...app.selected].sort());
    eq(back.mixMode, 'base');
    eq(back.mixSize, app.mixSize);
  });

  test('links are URL-safe', () => {
    const { app } = env();
    app.openSettings(); app.sortBy('alpha'); app.moveExpansion(3, 1); app.saveSettings();
    const code = app.encodeSetup(app.liveState());
    ok(!/[+/=]/.test(code), 'link contains characters that need escaping: ' + code);
  });

  test('a link alone reproduces the whole setup', () => {
    const first = env().app;
    first.openSettings();
    first.sortBy('pop');
    first.toggleOwned('Plunder', true);
    first.setMixMode('base');
    first.changeMixSize(2);
    first.saveSettings();
    first.toggleExpansion('Plunder', true);

    const link = first.setupLink();
    const expected = {
      order: first.order.slice(),
      owned: [...first.owned].sort(),
      selected: [...first.selected].sort(),
      mixMode: first.mixMode,
      mixSize: first.mixSize,
      sortKey: first.sortKey
    };

    // Fresh device: no saved settings, just the URL.
    const second = env({ hash: link.slice(link.indexOf('#')) }).app;
    deepEq(second.order, expected.order, 'order lost');
    deepEq([...second.owned].sort(), expected.owned, 'ownership lost');
    deepEq([...second.selected].sort(), expected.selected, 'ticks lost');
    eq(second.mixMode, expected.mixMode, 'mix mode lost');
    eq(second.mixSize, expected.mixSize, 'mix size lost');
    eq(second.sortKey, expected.sortKey, 'sort lost');
  });

  test('an outdated link is rejected, not misread', () => {
    const { app } = env();
    let threw = false;
    try { app.decodeSetup(global.btoa('2~0.1~2~3~0~2').replace(/=+$/, '')) } catch (e) { threw = true }
    ok(threw, 'an older-format link should be rejected');
  });

  test('a junk link still boots to the default', () => {
    const { app } = env({ hash: '#setup=aGVsbG93b3JsZA' });
    eq(app.order.length, app.MASTER.length);
    eq(new Set(app.order).size, app.MASTER.length);
    deepEq(app.order.slice(0, 2), ['Base 1E', 'Base 2E']);
  });

  test('a truncated link still boots', () => {
    const { app } = env({ hash: '#setup=RQKK' });
    eq(app.order.length, app.MASTER.length);
  });
});

group('Saved-state migration', () => {
  test('pre-edition-split names are migrated', () => {
    const { app } = env({
      saved: {
        order: ['Base', 'Seaside', 'Alchemy'],
        owned: ['Base', 'Seaside'],
        selected: ['Base', 'Intrigue']
      }
    });
    ok(app.owned.has('Base 2E'), 'bare "Base" should map to Base 2E');
    ok(app.owned.has('Seaside 2E'), 'bare "Seaside" should map to Seaside 2E');
    ok(app.selected.has('Intrigue 2E'), 'bare "Intrigue" should map to Intrigue 2E');
    ok(!app.owned.has('Base'), 'stale name left behind');
  });

  test('expansions added since the save are appended', () => {
    const { app } = env({ saved: { order: ['Base 2E', 'Alchemy'], owned: ['Base 2E'], selected: ['Base 2E'] } });
    eq(app.order.length, app.MASTER.length);
    eq(new Set(app.order).size, app.MASTER.length);
    deepEq(app.order.slice(0, 2), ['Base 2E', 'Alchemy'], 'saved order should lead');
  });

  test('unknown names are dropped', () => {
    const { app } = env({ saved: { order: ['Base 2E', 'Nonesuch'], owned: ['Ghost'], selected: ['Base 2E'] } });
    ok(app.order.indexOf('Nonesuch') === -1);
    eq(app.owned.size, 0);
    eq(app.order.length, app.MASTER.length);
  });

  test('a corrupt saved blob does not stop the page booting', () => {
    const { app } = env({ rawSaved: '{not json' });
    eq(app.order.length, app.MASTER.length);
    deepEq(app.order.slice(0, 2), ['Base 1E', 'Base 2E'], 'should fall back to defaults');
  });
});

group('Drawing', () => {
  test('draws exactly 10 cards', () => {
    const { app, els } = env();
    tickAll(app);
    for (let i = 0; i < 50; i++) {
      app.performDraw(app.order.slice());
      const total = (els.result.innerHTML.match(/<span>(\d+)<\/span>/g) || [])
        .map(m => Number(m.replace(/\D/g, '')))
        .reduce((a, b) => a + b, 0);
      eq(total, 10, 'draw ' + i + ' did not total 10');
    }
  });

  test('expansions drawing zero cards are not listed', () => {
    const { app, els } = env();
    tickAll(app);
    for (let i = 0; i < 500; i++) {
      app.performDraw(app.order.slice());
      ok(!/<span>0<\/span>/.test(els.result.innerHTML), 'a zero-count row was shown');
    }
  });

  test('draw is weighted by card count', () => {
    // Base 2E has 26 randomizers, Alchemy 12 -> 68.4% / 31.6%.
    const { app } = env();
    const counts = { 'Base 2E': 0, Alchemy: 0 };
    for (let i = 0; i < 4000; i++) {
      const pool = [];
      ['Base 2E', 'Alchemy'].forEach(n => {
        for (let k = 0; k < app.cardsIn(n); k++) pool.push(n);
      });
      for (let x = pool.length - 1; x > 0; x--) {
        const j = Math.floor(Math.random() * (x + 1));
        [pool[x], pool[j]] = [pool[j], pool[x]];
      }
      pool.slice(0, 10).forEach(n => counts[n]++);
    }
    const pct = counts['Base 2E'] / (counts['Base 2E'] + counts.Alchemy) * 100;
    ok(Math.abs(pct - 68.4) < 2.5, 'weighting looks wrong: ' + pct.toFixed(1) + '% Base 2E, expected ~68.4%');
    return pct.toFixed(1) + '% / ' + (100 - pct).toFixed(1) + '%';
  });

  test('too few cards is reported rather than drawn', () => {
    const { app, els } = env();
    app.performDraw([]);
    match(els.result.textContent, /Not enough cards/);
  });

  test('mix mode "any" never exceeds the configured size', () => {
    const { app, els } = env();
    app.openSettings(); app.saveSettings();
    tickAll(app);
    for (let i = 0; i < 400; i++) {
      app.drawWithRandomMix();
      ok(drawnNames(els).length <= app.mixSize,
        'drew ' + drawnNames(els).length + ' expansions with mixSize ' + app.mixSize);
    }
    return 'size ' + app.mixSize;
  });

  test('mix mode "base" at size 1 draws only from Base', () => {
    const { app, els } = env();
    app.openSettings();
    app.setMixMode('base');
    app.changeMixSize(-1);
    app.saveSettings();
    tickAll(app);
    eq(app.mixSize, 1);
    for (let i = 0; i < 300; i++) {
      app.drawWithRandomMix();
      ok(drawnNames(els).every(app.isBase), 'non-Base expansion in the mix: ' + drawnNames(els).join(', '));
    }
  });

  test('mix mode "base" keeps Base in the pool at larger sizes', () => {
    const { app, els } = env();
    app.openSettings();
    app.setMixMode('base');
    app.changeMixSize(1);
    app.saveSettings();
    tickAll(app);
    let withBase = 0;
    const runs = 500;
    for (let i = 0; i < runs; i++) {
      app.drawWithRandomMix();
      ok(drawnNames(els).length <= app.mixSize, 'mix exceeded its size');
      if (drawnNames(els).some(app.isBase)) withBase++;
    }
    // Base is always in the pool but can legitimately draw zero cards, so this
    // is a high-frequency check rather than an absolute one.
    ok(withBase / runs > 0.5, 'Base turned up in only ' + (withBase / runs * 100).toFixed(0) + '% of draws');
    return (withBase / runs * 100).toFixed(0) + '% of draws included a Base card';
  });

  test('mix mode "base" explains itself when Base is not ticked', () => {
    const { app, els } = env();
    app.openSettings();
    app.setMixMode('base');
    app.saveSettings();
    app.order.forEach(n => app.toggleExpansion(n, false));
    app.toggleExpansion('Plunder', true);
    app.drawWithRandomMix();
    match(els.result.textContent, /Tick Base/);
    return els.result.textContent;
  });

  test('Platinum/Colony only appears when Prosperity is in the mix', () => {
    const { app, els } = env();
    app.performDraw(['Base 2E', 'Alchemy']);
    ok(els.result.innerHTML.indexOf('Platinum') === -1, 'offered Platinum without Prosperity');
    app.performDraw(['Base 2E', 'Prosperity']);
    match(els.result.innerHTML, /Platinum\/Colony/);
  });
});

group('Main view', () => {
  test('footer counts expansions and cards', () => {
    const { app, els } = env();
    app.updateSummary();
    eq(els.footer.textContent, '1 expansion · 26 cards');
    app.toggleExpansion('Plunder', true);
    app.toggleExpansion('Alchemy', true);
    eq(els.footer.textContent, '3 expansions · 78 cards');
    return els.footer.textContent;
  });

  test('footer stays on one line at full size', () => {
    const { app, els } = env();
    tickAll(app);
    ok(els.footer.textContent.length <= 40, 'footer too long: ' + els.footer.textContent);
    match(html.replace(/\n/g, ' '), /\.footer \{[^}]*white-space: nowrap/);
    return els.footer.textContent;
  });

  test('More Expansions flags hidden ticks', () => {
    const { app, els } = env();
    app.toggleMoreExpansions();            // open it
    app.toggleExpansion('Plunder', true);
    app.toggleExpansion('Nocturne', true);
    app.toggleMoreExpansions();            // collapse with those still ticked
    match(els.moreBtn.textContent, /\(2 ticked\)/);
    ok(els.moreBtn.classList.contains('has-selection'));
    return els.moreBtn.textContent;
  });

  test('More Expansions shows no badge when expanded', () => {
    const { app, els } = env();
    app.toggleMoreExpansions();
    app.toggleExpansion('Plunder', true);
    match(els.moreBtn.textContent, /^Less/);
    ok(!els.moreBtn.classList.contains('has-selection'));
  });

  test('owning nothing shows the short prompt', () => {
    const { app, els } = env();
    app.openSettings();
    app.draft.order.forEach(n => app.toggleOwned(n, false));
    app.saveSettings();
    const text = els.ownedList.innerHTML.replace(/<[^>]+>/g, '').trim();
    match(text, /⚙/, 'prompt should point at the settings button');
    ok(text.length <= 40, 'prompt should stay short, got: ' + text);
    return text;
  });
});

group('Modal layout', () => {
  // The scrollbar used to run down the modal's rounded edge. Only an inner
  // body should scroll, with the frame clipping it.
  const cssRule = selector => {
    const i = html.indexOf(selector + ' {');
    return i === -1 ? '' : html.slice(i, html.indexOf('}', i));
  };
  const has = (text, needle) => text.indexOf(needle) !== -1;

  test('both modals have a separate scrolling body', () => {
    const ids = ['helpModal', 'settingsModal'];
    ids.forEach(id => {
      const start = html.indexOf('id="' + id + '"');
      ok(start !== -1, id + ' is missing');
      const body = html.indexOf('class="modal-body"', start);
      const header = html.indexOf('class="modal-header"', start);
      ok(body !== -1, id + ' has no scrolling body');
      ok(header !== -1 && header < body, id + ' header should sit outside the scrolling body');
    });
  });

  test('the modal frame clips to its rounded corners', () => {
    const rule = cssRule('.modal');
    ok(has(rule, 'overflow: hidden'), '.modal should clip its contents');
    ok(has(rule, 'border-radius'), '.modal lost its rounded corners');
    ok(!has(rule, 'overflow-y: auto'), 'the frame itself must not scroll');
  });

  test('only the body scrolls, with a styled scrollbar', () => {
    ok(has(cssRule('.modal-body'), 'overflow-y: auto'), '.modal-body should scroll');
    ok(has(cssRule('.modal-body'), 'scrollbar-width: thin'), 'Firefox scrollbar not slimmed');
    ok(has(cssRule('.modal-body::-webkit-scrollbar-thumb'), 'border-radius'), 'WebKit thumb not rounded');
    ok(has(cssRule('.modal-body'), 'padding'), 'body padding keeps the scrollbar off the edge');
  });

  test('save and cancel stay pinned above the scroll area', () => {
    const start = html.indexOf('id="settingsModal"');
    const body = html.indexOf('class="modal-body"', start);
    ok(html.indexOf('saveSettings()', start) < body, 'save button should be in the header');
    ok(html.indexOf('cancelSettings()', start) < body, 'cancel button should be in the header');
  });
});

group('Markup invariants', () => {
  test('the page is self-contained', () => {
    ok(!/<script[^>]+src=/.test(html), 'external script found');
    ok(!/<link[^>]+stylesheet/.test(html), 'external stylesheet found');
    ok(html.indexOf('http://') === -1, 'plain-http reference found');
  });

  test('no bulk select-all/none controls remain', () => {
    ok(html.indexOf('setAllOwned') === -1, 'setAllOwned still referenced');
    ok(html.indexOf('setAllSelected') === -1, 'setAllSelected still referenced');
    ok(html.indexOf('Select none') === -1, 'bulk button text still present');
  });

  test('settings offers save and cancel', () => {
    ok(html.indexOf('saveSettings()') !== -1);
    ok(html.indexOf('cancelSettings()') !== -1);
  });

  test('popularity is asterisked and sourced', () => {
    ok(html.indexOf('>Popularity*<') !== -1, 'sort button is missing its asterisk');
    const i = html.indexOf('class="footnote"');
    ok(i !== -1, 'no footnote in settings');
    const note = html.slice(i, html.indexOf('</p>', i));
    match(note, /BoardGameGeek/);
    match(note, /not live data/i);
    ok(i > html.indexOf('id="shareBox"'), 'footnote should sit at the bottom of settings');
  });

  test('every onclick handler names a function that exists', () => {
    const handlers = new Set();
    html.replace(/on(?:click|change|input)="([a-zA-Z_$][\w$]*)\(/g, (_, fn) => { handlers.add(fn); return _ });
    const missing = [...handlers].filter(fn => !new RegExp('function\\s+' + fn + '\\s*\\(').test(script));
    deepEq(missing, [], 'handlers with no matching function');
    return handlers.size + ' handlers checked';
  });

  test('every getElementById target exists in the markup', () => {
    const ids = new Set();
    script.replace(/getElementById\("([^"]+)"\)/g, (_, id) => { ids.add(id); return _ });
    const missing = [...ids].filter(id => html.indexOf('id="' + id + '"') === -1);
    deepEq(missing, [], 'ids referenced but never rendered');
    return ids.size + ' ids checked';
  });
});

/* ------------------------------------------------------------------ */

console.log('\n' + '-'.repeat(60));
if (failures.length === 0) {
  console.log('ALL ' + passed + ' CHECKS PASSED');
} else {
  console.log(failures.length + ' FAILED, ' + passed + ' passed\n');
  failures.forEach(f => console.log('  ' + f.group + ' / ' + f.name));
}
process.exit(failures.length ? 1 : 0);
