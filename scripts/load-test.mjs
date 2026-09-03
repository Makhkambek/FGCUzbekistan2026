/**
 * Load test for the tournament laptop. No dependencies — plain node.
 *
 * The public board polls /api/standings every 10s from every phone in the
 * hall, and each projector polls it every 3s alongside /api/display/state.
 * That route is force-dynamic and re-reads every team and match and re-scores
 * them on each request, so the only honest answer to "will the laptop hold"
 * is to measure it.
 *
 *   node scripts/load-test.mjs [baseUrl] [spectators] [seconds]
 */
const base = process.argv[2] ?? 'http://localhost:3200';
const spectators = Number(process.argv[3] ?? 100);
const seconds = Number(process.argv[4] ?? 20);

const samples = new Map();

async function hit(path) {
  const t0 = performance.now();
  try {
    const res = await fetch(base + path);
    await res.text();
    record(path, performance.now() - t0, res.ok);
  } catch {
    record(path, performance.now() - t0, false);
  }
}

function record(path, ms, ok) {
  if (!samples.has(path)) samples.set(path, { times: [], errors: 0 });
  const s = samples.get(path);
  s.times.push(ms);
  if (!ok) s.errors++;
}

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

const stop = Date.now() + seconds * 1000;
const loops = [];

// Spectators: /api/standings every 10s, staggered so they do not arrive in lockstep.
for (let i = 0; i < spectators; i++) {
  loops.push((async () => {
    await new Promise((r) => setTimeout(r, (i / spectators) * 10_000));
    while (Date.now() < stop) {
      await hit('/api/standings');
      await new Promise((r) => setTimeout(r, 10_000));
    }
  })());
}

// Two projectors: both endpoints every 3s.
for (let i = 0; i < 2; i++) {
  loops.push((async () => {
    while (Date.now() < stop) {
      await Promise.all([hit('/api/display/state'), hit('/api/standings')]);
      await new Promise((r) => setTimeout(r, 3_000));
    }
  })());
}

console.log(`${spectators} spectators + 2 projectors against ${base} for ${seconds}s…`);
await Promise.all(loops);

let worst = 0, totalReq = 0, totalErr = 0;
for (const [path, s] of samples) {
  const sorted = [...s.times].sort((a, b) => a - b);
  totalReq += sorted.length;
  totalErr += s.errors;
  worst = Math.max(worst, pct(sorted, 0.95));
  console.log(
    `${path.padEnd(22)} n=${String(sorted.length).padStart(5)}  ` +
    `p50=${pct(sorted, 0.5).toFixed(0).padStart(5)}ms  ` +
    `p95=${pct(sorted, 0.95).toFixed(0).padStart(5)}ms  ` +
    `p99=${pct(sorted, 0.99).toFixed(0).padStart(5)}ms  errors=${s.errors}`);
}
console.log(`\ntotal ${totalReq} requests, ${totalErr} errors`);
console.log(worst < 1000 && totalErr === 0
  ? 'VERDICT: fine — p95 under 1s everywhere, no errors'
  : 'VERDICT: look into it — p95 over 1s or errors present');
