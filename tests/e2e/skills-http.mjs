/**
 * Drives the running site over HTTP the way the operator does, and checks what
 * the public board and the projector say back.
 *
 * This one REWRITES the skills order and the display state, so run it against
 * a scratch database, never mid-tournament. It needs the dev server up and a
 * signed session cookie:
 *
 *   node -e "const c=require('crypto'),f=require('fs');\
 *     const s=f.readFileSync('.env.local','utf8').match(/SESSION_SECRET=(.*)/)[1].trim();\
 *     const p='admin.'+(Date.now()+3600000);\
 *     console.log(p+'.'+c.createHmac('sha256',s).update(p).digest('base64url'))" > /tmp/fgc-cookie.txt
 *   curl -s localhost:3000/api/standings > /tmp/fgc-standings-before.json
 *   DIR=/tmp node tests/e2e/skills-http.mjs
 */
import fs from 'node:fs';
const DIR = process.env.DIR ?? '/tmp';
const BASE = process.env.BASE ?? 'http://localhost:3000';
const COOKIE = 'fgc_session=' + fs.readFileSync(DIR + '/fgc-cookie.txt', 'utf8').trim();

let pass = 0; const fails = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fails.push(name + (detail ? ' — ' + detail : '')); console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
const eq = (name, got, want) =>
  check(name, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

async function api(method, path, body, auth = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: COOKIE } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch { /* html */ }
  return { status: res.status, json };
}

// An independent reading of the manual, written from the rules rather than
// from the code under test — so a wrong formula cannot agree with itself.
const CLIMB = { none: 0, contact: 5, zone1: 10, zone2: 20, zone3: 30 };
const up = (a, b) => Math.ceil(a / b);
function expected({ suppression = 0, humanBalls = 0, climb = 'none', extinguisher = 0,
  minorFouls = 0, majorFouls = 0, card = 'none' }) {
  if (card === 'red') return 0;
  const balls = suppression + 5 * humanBalls;
  const pre = up(balls * (100 + CLIMB[climb]), 100) + extinguisher;
  const pct = minorFouls * 5 + majorFouls * 10;
  return Math.max(0, pre - up(pre * pct, 100));
}

(async () => {
  console.log('\n== 1. Who can touch the skills phase ==');
  eq('a stranger cannot build the order', (await api('POST', '/api/admin/skills', { teamIds: [1], attemptsPerTeam: 3, alliance: 'red' }, false)).status, 401);
  eq('a stranger cannot score an attempt', (await api('PUT', '/api/admin/skills/1', { suppression: 1, humanBalls: 0, climb: 'none', extinguisher: 0, minorFouls: 0, majorFouls: 0, card: 'none' }, false)).status, 401);
  eq('a stranger cannot put an attempt on the projector', (await api('POST', '/api/admin/display/skills', { matchId: 1 }, false)).status, 401);

  const teams = (await api('GET', '/api/admin/skills')).json.teams;
  const picked = teams.slice(0, 4).map((t) => t.id);
  const nameOf = Object.fromEntries(teams.map((t) => [t.id, t.name]));
  console.log('  teams picked:', picked.map((id) => nameOf[id]).join(', '));

  console.log('\n== 2. Building the running order ==');
  eq('no teams at all is refused', (await api('POST', '/api/admin/skills', { teamIds: [], attemptsPerTeam: 3, alliance: 'red' })).status, 400);
  eq('zero attempts each is refused', (await api('POST', '/api/admin/skills', { teamIds: picked, attemptsPerTeam: 0, alliance: 'red' })).status, 400);
  eq('eleven attempts each is refused', (await api('POST', '/api/admin/skills', { teamIds: picked, attemptsPerTeam: 11, alliance: 'red' })).status, 400);
  eq('the same team twice is refused', (await api('POST', '/api/admin/skills', { teamIds: [picked[0], picked[0]], attemptsPerTeam: 3, alliance: 'red' })).status, 400);
  eq('a team that does not exist is refused', (await api('POST', '/api/admin/skills', { teamIds: [999999], attemptsPerTeam: 3, alliance: 'red' })).status, 400);
  eq('a side that is not red or blue is refused', (await api('POST', '/api/admin/skills', { teamIds: picked, attemptsPerTeam: 3, alliance: 'green' })).status, 400);

  const built = await api('POST', '/api/admin/skills', { teamIds: picked, attemptsPerTeam: 3, alliance: 'red' });
  eq('four teams × three attempts is twelve', built.json, { ok: true, attempts: 12 });

  let order = (await api('GET', '/api/admin/skills')).json.attempts;
  eq('twelve attempts came back', order.length, 12);
  eq('three rounds', [...new Set(order.map((a) => a.round))], [1, 2, 3]);
  eq('every team takes attempt 1 before anyone takes attempt 2',
    order.filter((a) => a.round === 1).map((a) => a.teamId), picked);
  eq('the order of teams repeats in round 2',
    order.filter((a) => a.round === 2).map((a) => a.teamId), picked);
  eq('nobody has been scored yet', order.every((a) => !a.played && a.score === null), true);
  eq('everyone starts on the side that was chosen', [...new Set(order.map((a) => a.alliance))], ['red']);

  console.log('\n== 3. Which side of the field ==');
  const first = order[0];
  eq('a team can be moved to the blue side', (await api('PATCH', `/api/admin/skills/${first.id}`, { alliance: 'blue' })).status, 200);
  order = (await api('GET', '/api/admin/skills')).json.attempts;
  eq('and the order remembers it', order.find((a) => a.id === first.id).alliance, 'blue');
  eq('only that attempt moved', order.filter((a) => a.alliance === 'blue').length, 1);
  eq('a side that does not exist is refused', (await api('PATCH', `/api/admin/skills/${first.id}`, { alliance: 'green' })).status, 400);
  eq('an attempt that does not exist is a 404', (await api('PATCH', '/api/admin/skills/999999', { alliance: 'red' })).status, 404);

  console.log('\n== 4. The projector ==');
  eq('the clock will not start on an attempt that is not on screen',
    (await api('POST', '/api/admin/display/skills-go', { matchId: first.id })).status, 409);
  eq('putting the attempt on screen', (await api('POST', '/api/admin/display/skills', { matchId: first.id })).status, 200);
  let d = (await api('GET', '/api/display/state')).json;
  eq('the screen says a skills attempt is live', d.phase, 'skills-live');
  eq('the team stands on the side it plays from', d.blue.teams, [nameOf[first.teamId], '—', '—']);
  eq('the opposing alliance is empty', d.red.teams, ['—', '—', '—']);
  eq('nothing is scored while it runs', d.score, null);
  eq('the clock has not started yet', d.startedAt, null);
  eq('starting the clock', (await api('POST', '/api/admin/display/skills-go', { matchId: first.id })).status, 200);
  d = (await api('GET', '/api/display/state')).json;
  check('the clock is running', typeof d.startedAt === 'number', `startedAt ${d.startedAt}`);
  eq('an attempt that does not exist cannot go on screen',
    (await api('POST', '/api/admin/display/skills', { matchId: 999999 })).status, 404);

  console.log('\n== 5. Scoring, situation by situation ==');
  const situations = [
    ['a quiet attempt: robot balls only, no climb', { suppression: 12, humanBalls: 0, climb: 'none', extinguisher: 0, minorFouls: 0, majorFouls: 0, card: 'none' }],
    ['the human player alone, five points a ball', { suppression: 0, humanBalls: 4, climb: 'none', extinguisher: 0, minorFouls: 0, majorFouls: 0, card: 'none' }],
    ['a full climb multiplies the balls', { suppression: 20, humanBalls: 2, climb: 'zone3', extinguisher: 20, minorFouls: 0, majorFouls: 0, card: 'none' }],
    ['fouls come off the team\'s own score', { suppression: 14, humanBalls: 3, climb: 'zone2', extinguisher: 20, minorFouls: 1, majorFouls: 1, card: 'none' }],
    ['a red card wipes the attempt', { suppression: 40, humanBalls: 6, climb: 'zone3', extinguisher: 20, minorFouls: 0, majorFouls: 0, card: 'red' }],
    ['a yellow card does not', { suppression: 10, humanBalls: 1, climb: 'contact', extinguisher: 5, minorFouls: 0, majorFouls: 0, card: 'yellow' }],
    ['a robot that never moved', { suppression: 0, humanBalls: 0, climb: 'none', extinguisher: 0, minorFouls: 0, majorFouls: 0, card: 'none' }],
    ['fouls cannot push a score below zero', { suppression: 1, humanBalls: 0, climb: 'none', extinguisher: 0, minorFouls: 20, majorFouls: 20, card: 'none' }],
  ];
  const scored = {};
  for (const [i, [label, body]] of situations.entries()) {
    const a = order[i];
    const res = await api('PUT', `/api/admin/skills/${a.id}`, body);
    if (res.status !== 200) { check(label, false, `PUT ${res.status}`); continue; }
    const back = (await api('GET', '/api/admin/skills')).json.attempts.find((x) => x.id === a.id);
    eq(`${label} → ${expected(body)}`, back.score, expected(body));
    scored[a.id] = { teamId: a.teamId, round: a.round, score: expected(body) };
  }

  console.log('\n== 6. What the projector does when the referee saves ==');
  d = (await api('GET', '/api/display/state')).json;
  eq('scoring what was live flips the screen to the result', d.phase, 'skills-result');
  eq('and the result carries the score', d.score, expected(situations[0][1]));
  eq('the empty alliance is still empty', d.red.teams, ['—', '—', '—']);

  console.log('\n== 7. Bad scores are refused ==');
  const badId = order[8].id;
  for (const [label, body] of [
    ['negative balls', { suppression: -1, humanBalls: 0, climb: 'none', extinguisher: 0, minorFouls: 0, majorFouls: 0, card: 'none' }],
    ['a climb position that does not exist', { suppression: 1, humanBalls: 0, climb: 'orbit', extinguisher: 0, minorFouls: 0, majorFouls: 0, card: 'none' }],
    ['a card colour that does not exist', { suppression: 1, humanBalls: 0, climb: 'none', extinguisher: 0, minorFouls: 0, majorFouls: 0, card: 'green' }],
    ['half a ball', { suppression: 1.5, humanBalls: 0, climb: 'none', extinguisher: 0, minorFouls: 0, majorFouls: 0, card: 'none' }],
    ['a missing field', { suppression: 1 }],
  ]) eq(label + ' is refused', (await api('PUT', `/api/admin/skills/${badId}`, body)).status, 400);
  eq('scoring an attempt that does not exist is a 404',
    (await api('PUT', '/api/admin/skills/999999', situations[0][1])).status, 404);

  console.log('\n== 8. The public board ==');
  const pub = (await api('GET', '/api/standings')).json;
  // Everyone in the running order belongs on the table, including a team
  // whose turn has not come round yet.
  const byTeam = Object.fromEntries(picked.map((id) => [id, { total: 0, best: 0, played: 0 }]));
  for (const s of Object.values(scored)) {
    byTeam[s.teamId].total += s.score;
    byTeam[s.teamId].best = Math.max(byTeam[s.teamId].best, s.score);
    byTeam[s.teamId].played++;
  }
  const wantRows = Object.entries(byTeam)
    .map(([id, v]) => ({ teamId: Number(id), ...v }))
    .sort((a, b) => (b.total - a.total) || (b.best - a.best) || (a.teamId - b.teamId));
  eq('every team in the running order is on the skills table, played or not',
    pub.skills.map((s) => s.teamId), wantRows.map((r) => r.teamId));
  // Every team here still has its third attempt to come, so the table is
  // showing rows for runs that have not happened. Section 12 checks the
  // stronger case: a team on the table before it has run at all.
  check('a team is listed with attempts still ahead of it',
    pub.skills.every((s) => s.attempts.some((a) => !a.played)),
    JSON.stringify(pub.skills.map((s) => [s.name, s.attemptsPlayed])));
  eq('the total is the sum of the attempts, nothing dropped',
    pub.skills.map((s) => s.total), wantRows.map((r) => r.total));
  eq('the best attempt is reported too', pub.skills.map((s) => s.best), wantRows.map((r) => r.best));
  eq('so is how many were taken', pub.skills.map((s) => s.attemptsPlayed), wantRows.map((r) => r.played));
  check('the table is sorted by total, highest first',
    pub.skills.every((s, i, arr) => i === 0 || arr[i - 1].total >= s.total), JSON.stringify(pub.skills.map((s) => s.total)));
  const opened = pub.skills[0] ?? { attempts: [], teamId: null };
  eq('opening a team shows all three of its attempts', opened.attempts.length, 3);
  eq('its rounds are in running order', opened.attempts.map((a) => a.round), [1, 2, 3]);
  check('an attempt not yet taken carries no score',
    opened.attempts.every((a) => a.played || a.score === null), JSON.stringify(opened.attempts));
  eq('the scores it has are the ones that were saved',
    opened.attempts.filter((a) => a.played).map((a) => a.score),
    Object.values(scored).filter((s) => s.teamId === opened.teamId).sort((a, b) => a.round - b.round).map((s) => s.score));

  console.log('\n== 9. The board holds skills back until the finals are decided ==');
  const playoff = pub.matches.filter((m) => m.phase === 'playoff');
  const finalsOver = playoff.length > 0 && playoff.every((m) => m.played);
  console.log(`  (${playoff.length} playoff matches, ${playoff.filter((m) => m.played).length} played)`);
  if (finalsOver) {
    check('with the finals decided, the skills table is published', pub.skills.length > 0, 'skills is empty');
  } else {
    eq('until the finals are decided the board carries no skills at all', pub.skills, []);
    console.log('  (score the bracket and run again to see the other half of this rule)');
  }

  console.log('\n== 10. Skills does not touch the qualification ranking ==');
  const before = JSON.parse(fs.readFileSync(DIR + '/fgc-standings-before.json', 'utf8'));
  eq('the ranking is the same team order as before the skills phase',
    pub.standings.map((s) => s.teamId), before.standings.map((s) => s.teamId));
  eq('and the same ranking scores',
    pub.standings.map((s) => s.rankingScore), before.standings.map((s) => s.rankingScore));
  eq('the matches are untouched', pub.matches.length, before.matches.length);

  console.log('\n== 11. The order is locked once anything is scored ==');
  const rebuild = await api('POST', '/api/admin/skills', { teamIds: picked, attemptsPerTeam: 3, alliance: 'red' });
  eq('rebuilding is refused', rebuild.status, 409);
  eq('and says why', /already been scored/.test(rebuild.json.error ?? ''), true);
  eq('the order survived the attempt', (await api('GET', '/api/admin/skills')).json.attempts.length, 12);

  console.log('\n== 12. Clearing a result ==');
  const clearId = Number(Object.keys(scored)[0]);
  eq('a scored attempt can be cleared', (await api('DELETE', `/api/admin/skills/${clearId}`)).status, 200);
  const after = (await api('GET', '/api/admin/skills')).json.attempts.find((a) => a.id === clearId);
  eq('it is unplayed again', [after.played, after.score], [false, null]);
  eq('it keeps its place in the order', [after.round, after.teamId], [order[0].round, order[0].teamId]);
  d = (await api('GET', '/api/display/state')).json;
  eq('the projector stops showing what no longer has a score', d.phase, 'standings');

  console.log('\n== 13. With every result cleared, the order can be rebuilt ==');
  for (const id of Object.keys(scored)) await api('DELETE', `/api/admin/skills/${id}`);
  const rebuilt = await api('POST', '/api/admin/skills', { teamIds: picked.slice(0, 2), attemptsPerTeam: 5, alliance: 'blue' });
  eq('two teams × five attempts is ten', rebuilt.json, { ok: true, attempts: 10 });
  const reorder = (await api('GET', '/api/admin/skills')).json.attempts;
  eq('five rounds', [...new Set(reorder.map((a) => a.round))], [1, 2, 3, 4, 5]);
  eq('all on the side that was chosen this time', [...new Set(reorder.map((a) => a.alliance))], ['blue']);
  const fresh = (await api('GET', '/api/standings')).json.skills;
  eq('the board shows the new order straight away, before anyone has run',
    fresh.map((s) => s.teamId).sort(), picked.slice(0, 2).sort());
  eq('all of them on nil points', fresh.map((s) => s.total), [0, 0]);
  eq('with five empty attempts each waiting', fresh.map((s) => s.attempts.length), [5, 5]);
  eq('and the teams dropped from the order are gone from the table',
    fresh.some((s) => picked.slice(2).includes(s.teamId)), false);

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { fails.forEach((f) => console.log(' - ' + f)); process.exit(1); }
})();
