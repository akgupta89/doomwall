// WebMCP: expose Doomwall as tools to in-browser agents (Chrome 149+ origin trial / flag).
// Included by every extension page; no-op where document.modelContext is missing.
(async () => {
  const get = k => chrome.storage.local.get(k);
  const text = v => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v) }] });
  const same = (a, b) => a.host === b.host && a.path === b.path && a.allow === b.allow;
  const day = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const TOOLS = [{
    name: "doomwall-list-rules", description: "List Doomwall block/allow rules and whether blocking is on or paused.",
    inputSchema: { type: "object", properties: {} },
    async execute() { const { rules = [], on = true, pauseUntil = 0 } = await get(["rules", "on", "pauseUntil"]); return text({ on, paused: pauseUntil > Date.now(), rules }); }
  }, {
    name: "doomwall-add-rule", description: "Add a rule. Blocks a site (and subdomains), optionally only a path prefix, optionally only inside a daily time window. allow=true makes an exception instead of a block.",
    inputSchema: { type: "object", properties: {
      site: { type: "string", description: "Domain, e.g. reddit.com" }, path: { type: "string", description: "Optional path prefix, e.g. /r/all" },
      allow: { type: "boolean", description: "true = exception (never blocked)" },
      from: { type: "string", description: "HH:MM start of window (needs `to`)" }, to: { type: "string", description: "HH:MM end of window" },
      days: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 }, description: "0=Sun..6=Sat; default every day" }
    }, required: ["site"] },
    async execute(input) { const r = Rules.toRule(input); const { rules = [] } = await get("rules"); if (!rules.some(x => same(x, r))) rules.push(r); await chrome.storage.local.set({ rules }); return text({ added: r, total: rules.length }); }
  }, {
    name: "doomwall-remove-rule", description: "Remove rules matching a site (and optional path).",
    inputSchema: { type: "object", properties: { site: { type: "string" }, path: { type: "string" } }, required: ["site"] },
    async execute({ site, path }) { const host = Rules.cleanHost(site), p = Rules.cleanPath(path); const { rules = [] } = await get("rules"); const keep = rules.filter(r => !(r.host === host && (path === undefined || r.path === p))); await chrome.storage.local.set({ rules: keep }); return text({ removed: rules.length - keep.length }); }
  }, {
    name: "doomwall-set-blocking", description: "Turn blocking on or off.",
    inputSchema: { type: "object", properties: { on: { type: "boolean" } }, required: ["on"] },
    async execute({ on }) { await chrome.storage.local.set({ on: !!on }); return text({ on: !!on }); }
  }, {
    name: "doomwall-pause", description: "Pause blocking for a few minutes (default: the configured pause length).",
    inputSchema: { type: "object", properties: { minutes: { type: "number", minimum: 1, maximum: 120 } } },
    async execute({ minutes }) { const { settings = {} } = await get("settings"); const m = minutes || settings.pauseMinutes || 5, until = Date.now() + m * 60000; await chrome.storage.local.set({ pauseUntil: until }); chrome.alarms.create("unpause", { when: until }); return text({ pausedMinutes: m, until: new Date(until).toISOString() }); }
  }, {
    name: "doomwall-get-stats", description: "Blocked attempts, bypasses and minutes spent, today and all-time, per site.",
    inputSchema: { type: "object", properties: {} },
    async execute() { const { stats = {}, days = {}, count = 0 } = await get(["stats", "days", "count"]); const t = days[day()] || {}; const min = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, minutes: Math.round((v.ms || 0) / 60000), ms: undefined }])); return text({ totalBlocks: count, today: { blocks: t.blocks || 0, bypasses: t.visits || 0, minutes: Math.round((t.ms || 0) / 60000), blockedBySite: t.blocked || {} }, allTime: min(stats) }); }
  }];
  // Direct handle for scripts driving the page (CDP etc.) on browsers without getTools/executeTool.
  globalThis.DoomwallTools = Object.fromEntries(TOOLS.map(t => [t.name, t]));
  const ctx = document.modelContext || navigator.modelContext; if (!ctx?.registerTool) return;
  for (const t of TOOLS) await ctx.registerTool(t).catch(e => console.warn("webmcp", t.name, e.message));
})();
