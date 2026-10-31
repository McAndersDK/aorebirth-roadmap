const STATUS = {
  done:    { label: 'Live',           weight: 1 },
  testing: { label: 'In testing',     weight: 0.9 },
  partial: { label: 'Partly working', weight: 0.5 },
  wip:     { label: 'In development', weight: 0.25 },
  todo:    { label: 'Planned',        weight: 0 },
  blocked: { label: 'On hold',        weight: 0 },
};
const ORDER = Object.keys(STATUS);

// Player-facing blurbs; the milestone descriptions on GitHub are written for developers.
const BLURB = {
  'Baseline': 'Classic Rubi-Ka and everything the server does for every account: logging in, combat, nanos, items, missions, teams and more.',
  'Notum Wars': 'Land control: tower fields, controller towers, and organizations fighting over notum.',
  'Shadowlands': 'The Shadowlands playfields from Jobe to Pandemonium, shadowlevels, perks, symbiants and pocket bosses.',
  'Alien Invasion': 'Alien levels and perks, organization cities, alien raids and the alien playfields.',
  'Lost Eden': 'Research, Battle Stations and Victory Points, OFAB gear and the Dust Brigade.',
  'Legacy of the Xan': 'The Xan: their playfields and raids, LoX boards, and Xan weapons and belts.',
};

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k !== null && k !== undefined) n.append(k);
  return n;
};
const svg = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const k of kids) n.append(k);
  return n;
};

const score = (features) => features.length
  ? features.reduce((s, f) => s + STATUS[f.status].weight, 0) / features.length : 0;
const pct = (x) => Math.round(x * 100);
const slug = (t) => t.toLowerCase().replace(/\s+/g, '-');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const state = { scope: 0, search: '', statuses: new Set() };
let data;

function ring(value) {
  const r = 34, c = 2 * Math.PI * r;
  const val = svg('circle', { class: 'val', cx: 42, cy: 42, r, 'stroke-dasharray': c, 'stroke-dashoffset': c });
  requestAnimationFrame(() => requestAnimationFrame(() => val.setAttribute('stroke-dashoffset', c * (1 - value))));
  const grad = svg('linearGradient', { id: 'ringGrad', x1: 0, y1: 0, x2: 1, y2: 1 },
    svg('stop', { offset: '0%', 'stop-color': '#b8870a' }), svg('stop', { offset: '100%', 'stop-color': '#f0c674' }));
  const t = svg('text', { x: 42, y: 42 }); t.textContent = `${pct(value)}%`;
  return svg('svg', { class: 'ring', viewBox: '0 0 84 84', role: 'img', 'aria-label': `${pct(value)}% complete` },
    svg('defs', {}, grad), svg('circle', { class: 'track', cx: 42, cy: 42, r }), val, t);
}

function bar(features) {
  const b = el('div', { class: 'bar', 'aria-hidden': 'true' });
  for (const s of ORDER) {
    const n = features.filter((f) => f.status === s).length;
    if (n) b.append(el('span', { class: `s-${s}`, style: `width:${(n / features.length) * 100}%` }));
  }
  return b;
}

const pill = (s) => el('span', { class: `pill s-${s}` }, el('span', { class: 'dot' }), STATUS[s].label);

function renderScopes() {
  const box = $('#scopes');
  box.replaceChildren(...data.scopes.map((sc, i) => {
    const fs = sc.epics.flatMap((e) => e.features);
    const live = fs.filter((f) => f.status === 'done').length;
    return el('button', {
      class: 'scope', 'aria-pressed': String(i === state.scope),
      onclick: () => { state.scope = i; history.replaceState(null, '', '#' + slug(sc.title)); renderScopes(); renderDetail(); },
    }, ring(score(fs)), el('span', { class: 'scope-name' }, sc.title),
       el('span', { class: 'scope-sub' }, `${live} live · ${plural(fs.length, 'feature')}`));
  }));
}

function renderChips() {
  const fs = data.scopes[state.scope].epics.flatMap((e) => e.features);
  $('#chips').replaceChildren(...ORDER.map((s) => el('button', {
    class: `chip s-${s}`, 'aria-pressed': String(state.statuses.has(s)),
    onclick: () => { state.statuses.has(s) ? state.statuses.delete(s) : state.statuses.add(s); renderDetail(); },
  }, el('span', { class: 'dot' }), STATUS[s].label, el('span', { class: 'n' }, fs.filter((f) => f.status === s).length))));
}

function renderDetail() {
  renderChips();
  const sc = data.scopes[state.scope];
  const q = state.search.trim().toLowerCase();
  const match = (f, e) => (!state.statuses.size || state.statuses.has(f.status))
    && (!q || f.title.toLowerCase().includes(q) || e.title.toLowerCase().includes(q));

  const cards = sc.epics.map((e) => {
    const shown = e.features.filter((f) => match(f, e));
    if (!shown.length) return null;
    return el('article', { class: 'epic' },
      el('div', { class: 'epic-head' },
        el('h3', {}, e.wiki ? el('a', { href: e.wiki, target: '_blank', rel: 'noopener' }, e.title) : e.title),
        el('span', { class: 'pct' }, `${pct(score(e.features))}%`)),
      bar(e.features),
      el('ul', { class: 'features' }, shown.map((f) => el('li', {},
        el('span', { class: 'name' }, f.wiki
          ? el('a', { href: f.wiki, target: '_blank', rel: 'noopener', title: 'Read about it on wiki.aodb.us' }, f.title)
          : f.title),
        pill(f.status)))));
  }).filter(Boolean);

  const fs = sc.epics.flatMap((e) => e.features);
  $('#detail').replaceChildren(
    el('div', { class: 'scope-head' },
      el('h2', {}, sc.title),
      el('span', { class: 'pill s-testing' }, `${pct(score(fs))}% · ${plural(fs.length, 'feature')}`),
      el('p', {}, BLURB[sc.title] ?? sc.description ?? '')),
    el('div', { class: 'epics' }, cards));
  $('#empty').hidden = cards.length > 0;
}

function renderRecent() {
  const all = data.scopes.flatMap((sc) => sc.epics.flatMap((e) => e.features.map((f) => ({ ...f, scope: sc.title }))));
  // Seeding touched everything at once; only show the strip once something has moved since.
  const times = all.map((f) => Date.parse(f.updated)).sort((a, b) => a - b);
  const spread = times.at(-1) - times[0];
  if (spread < 6 * 3600e3) return;
  const fmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
  $('#recent').replaceChildren(...all.sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated)).slice(0, 8)
    .map((f) => el('li', {},
      el('span', { class: 'when' }, `${fmt.format(new Date(f.updated))} · ${f.scope}`),
      el('span', { class: 't', title: f.title }, f.title), pill(f.status))));
  $('#recent-wrap').hidden = false;
}

function renderOverall() {
  const fs = data.scopes.flatMap((sc) => sc.epics.flatMap((e) => e.features));
  const count = (s) => fs.filter((f) => f.status === s).length;
  $('#overall-pct').textContent = pct(score(fs));
  $('#overall-counts').textContent =
    `${count('done')} live · ${count('testing')} in testing · ${count('partial') + count('wip')} in progress · ${plural(fs.length, 'feature')}`;
  $('#overall').hidden = false;
  $('#generated').textContent = `Updated ${new Date(data.generated).toLocaleString()}.`;
}

async function main() {
  try {
    data = await (await fetch('data.json', { cache: 'no-cache' })).json();
  } catch {
    $('#detail').replaceChildren(el('p', { class: 'empty' }, 'Could not load the roadmap data.'));
    return;
  }
  const hash = decodeURIComponent(location.hash.slice(1));
  const fromHash = data.scopes.findIndex((s) => s.title.toLowerCase().replace(/\s+/g, '-') === hash);
  if (fromHash >= 0) state.scope = fromHash;

  $('#search').addEventListener('input', (e) => { state.search = e.target.value; renderDetail(); });

  renderOverall();
  renderScopes();
  renderRecent();
  renderDetail();
}

main();
