const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseTrendsCsv, dateFromHeader, state, winner, WINDOWS } = require('../app.js');

state.votes = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/election-2024.json'), 'utf8'));
state.year = '2024';

test('2024 source has every state and DC with vote shares totaling about 100%', () => {
  assert.equal(Object.keys(state.votes).length, 51);
  for (const item of Object.values(state.votes)) {
    assert.ok(Math.abs(item.d + item.r + item.other - 100) < 0.12, item.name);
  }
});

test('all election maps cover the 51 regions and have expected statewide winner counts', () => {
  for (const [year, expectedD] of [[2008, 29], [2012, 27], [2016, 21], [2020, 26]]) {
    state.year = String(year);
    assert.equal(Object.keys(state.votes).filter((code) => winner(code) === 'D').length, expectedD);
  }
  state.year = '2024';
  assert.equal(winner('PA'), 'R');
  assert.equal(winner('CA'), 'D');
});

test('date windows follow the requested inauguration dates', () => {
  assert.deepEqual(Object.values(WINDOWS).map(({ start, end }) => [start, end]), [
    ['2005-01-20', '2009-01-20'], ['2009-01-20', '2013-01-21'],
    ['2013-01-21', '2017-01-20'], ['2017-01-20', '2021-01-20'],
    ['2021-01-20', '2025-01-20'],
  ]);
});

test('Google Trends regional CSV parses metadata, quoted states and <1', () => {
  const csv = 'Category: All categories\n\nRegion,"zombie: (1/20/21 - 1/20/25)"\nCalifornia,82\n"District of Columbia",<1\nPennsylvania,0\n';
  assert.deepEqual(parseTrendsCsv(csv).scores, { CA: 82, DC: 0.5, PA: 0 });
});

test('time series CSV does not masquerade as a regional CSV', () => {
  assert.throws(() => parseTrendsCsv('Week,zombie\n2024-01-01,50\n'), /Interest by region/);
});

test('Google Trends date text accepts short and ISO years', () => {
  assert.equal(dateFromHeader('1/20/21'), '2021-01-20');
  assert.equal(dateFromHeader('2025-01-20'), '2025-01-20');
});
