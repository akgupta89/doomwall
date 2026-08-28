const fmt = m => m < 60 ? `${m} min` : m < 1440 ? `${(m / 60).toFixed(1)} hours` : `${(m / 1440).toFixed(1)} days`;
const LINES = [
  "Nothing changed since you last checked.",
  "Was there a reason, or just a reflex?",
  "The thing you were doing is still waiting.",
  "This is attempt #COUNT. Impressive, in a way.",
  "Your hands did that. You didn't decide anything.",
  "It'll still be there later. It always is.",
  "Blink twice if you meant to do this.",
  "Muscle memory: 1. You: 0.",
  "You already know what's on there.",
  "Whatever you were avoiding just got a little bigger.",
  "You put this here. Past you had a point.",
  "Scrolling isn't resting.",
  "Nobody posted anything that changes your day.",
  "Fun fact: the feed doesn't miss you.",
  "This is the #COUNTth time. The number goes up either way.",
  "You closed this tab for a reason once.",
  "Take a breath. Then go back to the thing.",
  "Check-in complete. Nothing to see.",
  "The itch passes in about 90 seconds.",
  "Congrats, you found the wall again.",
];
const EXCUSES = [
  "I need it this time. Let me through.",
  "But I need to waste time.",
  "It's different this time, I swear.",
  "Just five minutes. Famous last words.",
  "I'll be productive after this. Probably.",
];

const target = location.hash.slice(1);
const btn = document.getElementById("bypass");
btn.textContent = EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
if (!target) document.getElementById("actions").hidden = true;
document.getElementById("pause").onclick = async () => {
  await chrome.runtime.sendMessage({ pause: true });
  location.replace(target);
};

(async () => {
  // Chrome prerender: don't count or redirect until the page is actually shown
  if (document.prerendering) await new Promise(r => document.addEventListener("prerenderingchange", r, { once: true }));
  // opened from a bypassed tab (new-tab links, redirect hops)? go straight through
  if (target && await chrome.runtime.sendMessage({ inherit: true })) return location.replace(target);
  let { count = 0, stats = {}, sites = [], days = {}, settings = {} } = await chrome.storage.local.get(["count", "stats", "sites", "days", "settings"]);
  const lines = settings.lines?.length ? settings.lines : LINES;
  count++;
  const host = target ? new URL(target).hostname : "";
  const domain = sites.find(d => host === d || host.endsWith("." + d)) || host;
  const now = new Date(), key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; // local day
  const day = days[key] = days[key] || { blocks: 0, visits: 0, ms: 0, sites: {}, blocked: {} };
  day.blocks++;
  day.blocked = day.blocked || {};
  day.blocked[domain] = (day.blocked[domain] || 0) + 1;
  const s = stats[domain] = stats[domain] || { ms: 0, visits: 0, blocks: 0 };
  s.blocks = (s.blocks || 0) + 1;
  await chrome.storage.local.set({ count, days, stats });
  const today = day.blocked[domain], all = s.blocks;
  // measured average for this site; no estimate until there's data
  const perVisit = s?.visits && s.ms ? Math.max(1, Math.round(s.ms / s.visits / 60000)) : 0;
  document.getElementById("line1").textContent = lines[Math.floor(Math.random() * lines.length)].replaceAll("COUNT", count);
  const limit = settings.bypassLimit ?? 0, used = day.visits ?? 0;
  if (limit && used >= limit) { btn.textContent = `No bypasses left today (${limit}/${limit} used)`; btn.disabled = true; }
  else if (limit) btn.textContent += ` (${limit - used} left today)`;
  document.getElementById("line2").innerHTML =
    `<b>${domain}</b>: <b>${today}</b> ${today === 1 ? "time" : "times"} today, <b>${all}</b> all time.${perVisit ? ` That's roughly <b>${fmt(all * perVisit)}</b> you got back.` : ""}`;
  btn.onclick = async () => {
    if (!await chrome.runtime.sendMessage({ bypass: domain })) return location.reload();
    location.replace(target); // replace: Back shouldn't land on this page and count again
  };
})();
