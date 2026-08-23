const dayKey = (t = Date.now()) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const bump = (days, site, field, n) => {
  const d = days[dayKey()] = days[dayKey()] || { blocks: 0, visits: 0, ms: 0, sites: {} };
  d[field] += n;
  if (site) d.sites[site] = (d.sites[site] || 0) + (field === "ms" ? n : 0);
};
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matchSite = (url, sites) => {
  try { const h = new URL(url).hostname; return sites.find(d => h === d || h.endsWith("." + d)) || null; } catch { return null; }
};

async function apply() {
  const { on = true, sites = [], pauseUntil = 0 } = await chrome.storage.local.get(["on", "sites", "pauseUntil"]);
  const paused = pauseUntil > Date.now();
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  const rules = on && !paused ? sites.map((d, i) => ({
    id: i + 1, priority: 1,
    // original URL goes in the hash: nothing in it (?, &, #) can break the redirect target
    action: { type: "redirect", redirect: { regexSubstitution: chrome.runtime.getURL("blocked.html") + "#\\0" } },
    condition: { regexFilter: `^https?://([^/]*\\.)?${esc(d)}([/?#].*)?$`, resourceTypes: ["main_frame"] }
  })) : [];
  await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: old.map(r => r.id) });
  await chrome.declarativeNetRequest.updateDynamicRules({ addRules: rules });
  const active = on && !paused;
  chrome.action.setIcon({ path: active ? { 16: "icon16.png", 32: "icon32.png", 48: "icon48.png", 128: "icon128.png" } : { 16: "icon-off16.png", 32: "icon-off32.png", 48: "icon-off48.png", 128: "icon-off128.png" } });
  chrome.action.setBadgeText({ text: paused ? "5m" : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#ff8a4c" });
}

chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get(["on", "sites"]);
  await chrome.storage.local.set({ on: cur.on ?? true, sites: cur.sites ?? [] });
  apply();
  if (!cur.sites) chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(apply);
chrome.alarms.onAlarm.addListener(apply);
chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && (c.sites || c.on || c.pauseUntil)) apply(); });

// Per-tab bypass: a session "allow" rule scoped to that tab. Gone when the tab closes.
const grant = (tabId, domain) => chrome.declarativeNetRequest.updateSessionRules({
  removeRuleIds: [tabId],
  addRules: [{
    id: tabId, priority: 2,
    action: { type: "allow" },
    condition: { urlFilter: `||${domain}^`, resourceTypes: ["main_frame"], tabIds: [tabId] }
  }]
});
const grantOf = async tabId => (await chrome.declarativeNetRequest.getSessionRules()).find(r => r.id === tabId);

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!sender.tab) return;
  (async () => {
    if (msg.bypass) {
      const { stats = {}, days = {} } = await chrome.storage.local.get(["stats", "days"]);
      stats[msg.bypass] = stats[msg.bypass] || { ms: 0, visits: 0 };
      stats[msg.bypass].visits++;
      bump(days, msg.bypass, "visits", 1);
      await chrome.storage.local.set({ stats, days });
      await grant(sender.tab.id, msg.bypass);
      reply(true);
    } else if (msg.pause) {
      const until = Date.now() + 5 * 60000;
      await chrome.storage.local.set({ pauseUntil: until });
      chrome.alarms.create("unpause", { when: until });
      reply(true);
    } else if (msg.inherit) {
      // blocked page asks: was I opened from a bypassed tab? (covers the onCreated race)
      const parent = sender.tab.openerTabId != null && await grantOf(sender.tab.openerTabId);
      if (parent) await grant(sender.tab.id, parent.condition.urlFilter.slice(2, -1));
      reply(!!parent);
    }
  })();
  return true;
});

// Time tracking: accumulate ms per site while it is the active tab of the focused window.
// ponytail: no idle detection — AFK on a bypassed tab counts as wasted. Add "idle" permission if that bugs you.
async function track() {
  const now = Date.now();
  const { open } = await chrome.storage.session.get("open");
  const { sites = [], stats = {}, days = {} } = await chrome.storage.local.get(["sites", "stats", "days"]);
  let cur = null;
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (win?.focused) {
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    cur = tab?.url ? matchSite(tab.url, sites) : null;
  }
  if (open && open.site !== cur) {
    stats[open.site] = stats[open.site] || { ms: 0, visits: 0 };
    stats[open.site].ms += now - open.start;
    bump(days, open.site, "ms", now - open.start);
    await chrome.storage.local.set({ stats, days });
  }
  if (cur && open?.site !== cur) await chrome.storage.session.set({ open: { site: cur, start: now } });
  else if (!cur) await chrome.storage.session.remove("open");
}
chrome.tabs.onActivated.addListener(track);
chrome.tabs.onUpdated.addListener((_, info) => { if (info.url || info.status === "complete") track(); });
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
  track();
});
chrome.windows.onFocusChanged.addListener(track);

// Tabs opened from a bypassed tab (e.g. slickdeals "Get Deal" → slickdeals.net/click → amazon) inherit the bypass.
chrome.tabs.onCreated.addListener(async tab => {
  if (tab.openerTabId == null) return;
  const parent = await grantOf(tab.openerTabId);
  if (parent) await grant(tab.id, parent.condition.urlFilter.slice(2, -1));
});


// Fallback for sites whose service worker serves pages from cache (x.com, gmail): DNR never sees those
// navigations, so enforce at the tab level too.
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  const url = info.url || (info.status === "loading" && tab.url);
  if (!url || !/^https?:/.test(url)) return;
  const { on = true, sites = [], pauseUntil = 0 } = await chrome.storage.local.get(["on", "sites", "pauseUntil"]);
  if (!on || pauseUntil > Date.now()) return;
  const site = matchSite(url, sites);
  if (!site || await grantOf(tabId)) return;
  chrome.tabs.update(tabId, { url: chrome.runtime.getURL("blocked.html") + "#" + url });
});
