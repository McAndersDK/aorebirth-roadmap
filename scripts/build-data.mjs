// Reads the roadmap issues and writes site/data.json for the player page.
// Needs GITHUB_TOKEN (any token with read access) and GITHUB_REPOSITORY (owner/name).
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const repo = process.env.GITHUB_REPOSITORY || 'McAndersDK/aorebirth-roadmap';
const token = process.env.GITHUB_TOKEN;
const out = process.argv[2] || 'site/data.json';

async function api(path) {
  const res = await fetch(`https://api.github.com/repos/${repo}/${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function all(path) {
  const items = [];
  for (let page = 1; ; page++) {
    const batch = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    items.push(...batch);
    if (batch.length < 100) return items;
  }
}

const statusOf = (issue) => {
  if (issue.state === 'closed') return 'done';
  const label = issue.labels.map((l) => l.name).find((n) => n.startsWith('status: '));
  return label ? label.slice(8) : 'todo';
};

const wikiOf = (body) => body?.match(/https:\/\/wiki\.aodb\.us\/[^\s)]+/)?.[0] ?? null;

const milestones = (await all('milestones?state=all&sort=number')).sort((a, b) => a.number - b.number);
const issues = (await all('issues?state=all')).filter((i) => !i.pull_request);
const epics = issues.filter((i) => i.labels.some((l) => l.name === 'epic')).sort((a, b) => a.number - b.number);

const data = {
  generated: new Date().toISOString(),
  repo,
  scopes: [],
};

for (const m of milestones) {
  const scope = { title: m.title, description: m.description, epics: [] };
  for (const e of epics.filter((x) => x.milestone?.number === m.number)) {
    const subs = await all(`issues/${e.number}/sub_issues`);
    scope.epics.push({
      number: e.number,
      title: e.title.replace(/^Epic:\s*[^-]+-\s*/, ''),
      wiki: wikiOf(e.body),
      features: subs.sort((a, b) => a.number - b.number).map((f) => ({
        number: f.number,
        title: f.title,
        status: statusOf(f),
        wiki: wikiOf(f.body),
        updated: f.updated_at,
      })),
    });
  }
  data.scopes.push(scope);
}

await mkdir(dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(data, null, 1));
console.log(`Wrote ${out}: ${data.scopes.length} scopes, ${epics.length} epics`);
