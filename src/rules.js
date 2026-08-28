// Shared rule matching. Plain global so bg.js (importScripts), options.js (<script>) and node tests all get it.
// rule: { host, path, allow, window?: { from: "HH:MM", to: "HH:MM", days: [0..6] } }
(function () {
  const mins = s => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  // active: is this rule in force at `now`? No window = always.
  const active = (r, now = new Date()) => {
    const w = r.window;
    if (!w) return true;
    if (!w.days.includes(now.getDay())) return false;
    const t = now.getHours() * 60 + now.getMinutes(), a = mins(w.from), b = mins(w.to);
    return a <= b ? t >= a && t < b : t >= a || t < b; // overnight window wraps midnight
  };
  const hostHit = (h, r) => h === r.host || h.endsWith("." + r.host);
  const pathHit = (p, r) => !r.path || p === r.path || p.startsWith(r.path.endsWith("/") ? r.path : r.path + "/");
  // matches: host of the block rule that applies to url, or null. Allow rules win when they match.
  const matches = (url, rules, now = new Date()) => {
    let u; try { u = new URL(url); } catch { return null; }
    const hit = rules.filter(r => active(r, now) && hostHit(u.hostname, r) && pathHit(u.pathname, r));
    if (hit.some(r => r.allow)) return null;
    return hit.find(r => !r.allow)?.host ?? null;
  };
  globalThis.Rules = { active, matches };
})();
