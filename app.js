const WINDOWS = {
  2008: { start: '2005-01-20', end: '2009-01-20', label: 'Jan 20, 2005 – Jan 20, 2009' },
  2012: { start: '2009-01-20', end: '2013-01-21', label: 'Jan 20, 2009 – Jan 21, 2013' },
  2016: { start: '2013-01-21', end: '2017-01-20', label: 'Jan 21, 2013 – Jan 20, 2017' },
  2020: { start: '2017-01-20', end: '2021-01-20', label: 'Jan 20, 2017 – Jan 20, 2021' },
  2024: { start: '2021-01-20', end: '2025-01-20', label: 'Jan 20, 2021 – Jan 20, 2025' },
};

// Statewide presidential winners, not district-level electoral-vote allocations.
// Source: National Archives Electoral College results (see README).
const D_STATES = {
  2008: 'CA CO CT DE DC FL HI IL IN IA ME MD MA MI MN NV NH NJ NM NY NC OH OR PA RI VT VA WA WI',
  2012: 'CA CO CT DE DC FL HI IL IA ME MD MA MI MN NV NH NJ NM NY OH OR PA RI VT VA WA WI',
  2016: 'CA CO CT DE DC HI IL ME MD MA MN NV NH NJ NM NY OR RI VT VA WA',
  2020: 'AZ CA CO CT DE DC GA HI IL ME MD MA MI MN NV NH NJ NM NY OR PA RI VT VA WA WI',
};
const D_SETS = Object.fromEntries(Object.entries(D_STATES).map(([year, codes]) => [year, new Set(codes.split(' '))]));

const $ = (id) => document.getElementById(id);
const state = { year: '2024', term: '', selected: 'PA', mode: 'election', votes: {}, paths: {}, imported: {} };
const COLORS = { D: '#527fa5', R: '#c96f61', none: '#e3e8e5' };

function winner(code) {
  if (state.year === '2024') return state.votes[code].d > state.votes[code].r ? 'D' : 'R';
  return D_SETS[state.year].has(code) ? 'D' : 'R';
}

function activeScores() {
  return state.imported[`${state.year}::${state.term.toLowerCase()}`] || null;
}

function saveImports() {
  try { localStorage.setItem('search-vote-trends-v1', JSON.stringify(state.imported)); }
  catch { setStatus('Data loaded for this session; browser storage is unavailable.', 'success'); }
}

function updateTerm() {
  state.term = $('term').value.trim().replace(/\s+/g, ' ');
  updateAll();
}

function trendsUrl() {
  const range = WINDOWS[state.year];
  const params = new URLSearchParams({ date: `${range.start} ${range.end}`, geo: 'US' });
  if (state.term) params.set('q', state.term);
  return `https://trends.google.com/trends/explore?${params.toString()}`;
}

function setStatus(message, kind = '') {
  $('upload-status').textContent = message;
  $('upload-status').className = `upload-status ${kind}`;
}

function mapColor(code, scores) {
  if (state.mode === 'election') return COLORS[winner(code)];
  const value = scores && scores[code];
  if (value === undefined) return COLORS.none;
  const t = Math.max(0, Math.min(1, value / 100));
  const from = [229, 240, 235], to = [27, 124, 120];
  return `rgb(${from.map((n, i) => Math.round(n + (to[i] - n) * t)).join(',')})`;
}

function renderMap() {
  const scores = activeScores();
  const svg = $('us-map');
  svg.replaceChildren();
  for (const [code, path] of Object.entries(state.paths)) {
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    shape.setAttribute('d', path);
    shape.setAttribute('fill', mapColor(code, scores));
    shape.setAttribute('class', `state-path${code === state.selected ? ' selected' : ''}`);
    shape.setAttribute('tabindex', '0');
    shape.setAttribute('role', 'button');
    const interest = scores && scores[code] !== undefined ? `, search interest ${scores[code]}` : '';
    shape.setAttribute('aria-label', `${state.votes[code].name}, ${winner(code) === 'D' ? 'Democratic' : 'Republican'} winner${interest}`);
    shape.addEventListener('click', () => chooseState(code));
    shape.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseState(code); }
    });
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = shape.getAttribute('aria-label');
    shape.appendChild(title);
    svg.appendChild(shape);
  }
  const legend = $('legend');
  legend.replaceChildren();
  if (state.mode === 'election') {
    legend.innerHTML = '<span class="legend-item"><i class="legend-swatch" style="background:#527fa5"></i>Democratic</span><span class="legend-item"><i class="legend-swatch" style="background:#c96f61"></i>Republican</span>';
  } else {
    legend.innerHTML = '<span class="legend-item">0 <i class="legend-gradient"></i> 100</span><span class="legend-item"><i class="legend-swatch" style="background:#e3e8e5"></i>No data</span>';
  }
}

function chooseState(code) {
  state.selected = code;
  $('state-picker').value = code;
  renderMap();
  renderDetail();
}

function renderDetail() {
  const item = state.votes[state.selected];
  const party = winner(state.selected);
  $('state-name').textContent = item.name;
  $('state-code').textContent = state.selected;
  $('winner-pill').textContent = party === 'D' ? 'Democratic win' : 'Republican win';
  $('winner-pill').className = `winner-pill ${party === 'D' ? 'democratic' : 'republican'}`;
  $('vote-label').textContent = `${state.year} VOTE ${state.year === '2024' ? 'SHARE' : 'RESULT'}`;
  const votes = $('vote-content');
  if (state.year === '2024') {
    votes.innerHTML = `<div class="vote-row"><span>Democratic</span><strong>${item.d.toFixed(2)}%</strong></div><div class="meter"><span class="d" style="width:${item.d}%"></span></div><div class="vote-row"><span>Republican</span><strong>${item.r.toFixed(2)}%</strong></div><div class="meter"><span class="r" style="width:${item.r}%"></span></div><div class="vote-row"><span>Other</span><strong>${item.other.toFixed(2)}%</strong></div>`;
  } else {
    votes.innerHTML = `<p class="no-shares">${party === 'D' ? 'Democratic' : 'Republican'} statewide winner. Vote percentages were not in the supplied data.</p>`;
  }
  const scores = activeScores();
  const interest = $('interest-content');
  if (scores && scores[state.selected] !== undefined) {
    interest.innerHTML = `<strong>${scores[state.selected]}</strong><small>out of 100 for “${escapeHtml(state.term)}”</small>`;
  } else {
    interest.innerHTML = '<p class="interest-empty">No search-interest score loaded for this state and term.</p>';
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function renderComparison() {
  const scores = activeScores();
  const body = $('comparison-body');
  const coverage = $('coverage');
  const values = { D: [], R: [] };
  for (const [code, score] of Object.entries(scores || {})) values[winner(code)].push(score);
  const total = values.D.length + values.R.length;
  coverage.textContent = total ? `${total} of 51 regions with data` : 'Awaiting Trends data';
  if (!total) {
    body.innerHTML = '<p>Upload a regional Google Trends CSV to compare the average search-interest score in states won by each party.</p>';
    return;
  }
  if (!values.D.length || !values.R.length) {
    body.innerHTML = '<p>Upload scores for states won by both parties to compare the groups.</p>';
    return;
  }
  const avg = (list) => list.reduce((sum, n) => sum + n, 0) / list.length;
  const d = avg(values.D), r = avg(values.R);
  const higher = d > r ? 'Democratic' : r > d ? 'Republican' : null;
  const difference = Math.abs(d - r);
  body.innerHTML = `<div class="comparison-row"><span>Democratic states <small>(${values.D.length})</small></span><div class="comparison-track"><span style="width:${d}%;background:${COLORS.D}"></span></div><strong>${d.toFixed(1)}</strong></div><div class="comparison-row"><span>Republican states <small>(${values.R.length})</small></span><div class="comparison-track"><span style="width:${r}%;background:${COLORS.R}"></span></div><strong>${r.toFixed(1)}</strong></div><p class="insight">${higher ? `${higher}-won states averaged ${difference.toFixed(1)} points higher search interest for “${escapeHtml(state.term)}”.` : `Both groups averaged the same search interest for “${escapeHtml(state.term)}”.`} These are unweighted averages of state scores, not estimates of voter behavior.</p>`;
}

function updateAll() {
  const range = WINDOWS[state.year];
  $('date-range').textContent = range.label;
  $('map-title').textContent = `${state.year} election map`;
  $('map-subtitle').textContent = state.mode === 'election' ? 'Select a state to inspect its result.' : 'Darker teal means higher relative search interest.';
  $('trends-link').href = trendsUrl();
  $('mode-election').classList.toggle('active', state.mode === 'election');
  $('mode-interest').classList.toggle('active', state.mode === 'interest');
  $('mode-election').setAttribute('aria-pressed', state.mode === 'election');
  $('mode-interest').setAttribute('aria-pressed', state.mode === 'interest');
  const scores = activeScores();
  setStatus(scores ? `${Object.keys(scores).length} regions loaded for “${state.term}” in ${state.year}. Stored in this browser.` : state.term ? `No Trends data loaded for “${state.term}” in ${state.year}.` : 'Enter a search term, then upload its regional Trends CSV.');
  renderMap();
  renderDetail();
  renderComparison();
}

function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const character = text[i];
    if (quoted) {
      if (character === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { row.push(cell); cell = ''; }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += character;
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseTrendsCsv(text) {
  const rows = parseCsv(text.replace(/^\uFEFF/, ''));
  const headerIndex = rows.findIndex((row) => /^(region|subregion|state)$/i.test((row[0] || '').trim()) && row.length >= 2);
  if (headerIndex < 0) throw new Error('This does not look like an “Interest by region” CSV. Export that chart from Google Trends.');
  const header = rows[headerIndex];
  if (header.length > 2 && header.slice(2).some((value) => value.trim())) throw new Error('Please export one search term at a time.');
  const lookup = Object.fromEntries(Object.entries(state.votes).map(([code, item]) => [item.name.toLowerCase(), code]));
  const result = {};
  for (const row of rows.slice(headerIndex + 1)) {
    const name = (row[0] || '').trim().toLowerCase();
    const code = lookup[name] || (state.votes[name.toUpperCase()] ? name.toUpperCase() : null);
    if (!code) continue;
    const raw = (row[1] || '').trim();
    if (!raw) continue;
    const score = raw === '<1' ? 0.5 : Number(raw);
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error(`Invalid Trends score for ${state.votes[code].name}.`);
    result[code] = score;
  }
  if (!Object.keys(result).length) throw new Error('No US state rows were found in that CSV. Select United States in Google Trends.');
  return { scores: result, header: header[1] || '' };
}

function dateFromHeader(value) {
  const match = value.match(/(\d{1,4})[-/](\d{1,2})[-/](\d{1,4})/);
  if (!match) return null;
  let year, month, day;
  if (match[1].length === 4) [year, month, day] = match.slice(1).map(Number);
  else { [month, day, year] = match.slice(1).map(Number); if (year < 100) year += 2000; }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function importCsv(file) {
  if (!state.term) { setStatus('Enter the search term used for this CSV first.', 'error'); return; }
  try {
    const { scores, header } = parseTrendsCsv(await file.text());
    const namedTerm = header.split(':')[0].trim();
    if (namedTerm && !/^(interest|value|search interest)$/i.test(namedTerm) && namedTerm.toLowerCase() !== state.term.toLowerCase()) {
      throw new Error(`This CSV is for “${namedTerm}”. Enter that term or upload the matching file.`);
    }
    const dates = header.match(/\(([^()]+)\s+-\s+([^()]+)\)/);
    if (dates) {
      const start = dateFromHeader(dates[1]), end = dateFromHeader(dates[2]);
      const expected = WINDOWS[state.year];
      if (start && end && (start !== expected.start || end !== expected.end)) {
        throw new Error(`This CSV uses ${start} to ${end}. Export the ${state.year} window: ${expected.label}.`);
      }
    }
    state.imported[`${state.year}::${state.term.toLowerCase()}`] = scores;
    saveImports();
    state.mode = 'interest';
    updateAll();
    setStatus(`${Object.keys(scores).length} regions loaded for “${state.term}” in ${state.year}. Check that the Trends export used ${WINDOWS[state.year].label}.`, 'success');
  } catch (error) { setStatus(error.message || 'Could not read that CSV.', 'error'); }
}

async function init() {
  try {
    const [votesResponse, pathsResponse] = await Promise.all([fetch('data/election-2024.json'), fetch('data/state-paths.json')]);
    if (!votesResponse.ok || !pathsResponse.ok) throw new Error('Data files could not be loaded.');
    [state.votes, state.paths] = await Promise.all([votesResponse.json(), pathsResponse.json()]);
    try { state.imported = JSON.parse(localStorage.getItem('search-vote-trends-v1') || '{}') || {}; } catch { state.imported = {}; }
    const picker = $('state-picker');
    for (const [code, item] of Object.entries(state.votes).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
      const option = document.createElement('option'); option.value = code; option.textContent = item.name; picker.appendChild(option);
    }
    picker.value = state.selected;
    picker.addEventListener('change', () => chooseState(picker.value));
    $('year').addEventListener('change', () => { state.year = $('year').value; updateAll(); });
    $('apply-term').addEventListener('click', updateTerm);
    $('term').addEventListener('keydown', (event) => { if (event.key === 'Enter') updateTerm(); });
    $('term').addEventListener('change', updateTerm);
    $('mode-election').addEventListener('click', () => { state.mode = 'election'; updateAll(); });
    $('mode-interest').addEventListener('click', () => { state.mode = 'interest'; updateAll(); });
    $('trends-link').addEventListener('click', (event) => { updateTerm(); if (!state.term) { event.preventDefault(); $('term').focus(); setStatus('Enter a search term before opening Google Trends.', 'error'); } });
    $('trends-file').addEventListener('change', async (event) => { updateTerm(); const file = event.target.files[0]; if (file) await importCsv(file); event.target.value = ''; });
    updateAll();
  } catch (error) { setStatus(`${error.message} Serve this folder with a local web server or deploy it to GitHub Pages.`, 'error'); }
}

if (typeof document !== 'undefined') init();
if (typeof module !== 'undefined') module.exports = { parseCsv, parseTrendsCsv, dateFromHeader, state, WINDOWS, winner };
