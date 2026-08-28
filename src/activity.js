const fmt = ms => { const m = Math.round(ms / 60000); return ms < 60000 ? `${Math.round(ms / 1000)} s` : m < 60 ? `${m} min` : `${(m / 60).toFixed(1)} h`; };
const el = id => document.getElementById(id);

async function render() {
  const { sites = [], stats = {}, count = 0, days = {} } = await chrome.storage.local.get(["sites", "stats", "count", "days"]);
  const rows = Object.entries(stats).sort((a, b) => b[1].ms - a[1].ms);
  const max = rows[0]?.[1].ms || 1;
  const total = rows.reduce((s, [, v]) => s + v.ms, 0);
  const key = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const td = days[key(Date.now())] || { blocks: 0, ms: 0 };
  el("today").innerHTML = `${td.blocks} <small>blocks</small> · ${fmt(td.ms)} <small>spent</small>`;
  el("total").innerHTML = `${count} <small>blocks</small> · ${fmt(total)} <small>spent</small>`;
  const last = Array.from({ length: 14 }, (_, i) => key(Date.now() - (13 - i) * 86400000));
  const dmax = Math.max(1, ...last.map(k => days[k]?.blocks || 0));
  el("days").innerHTML = last.map((k, i) => { const d = days[k] || { blocks: 0, ms: 0 }; return `
    <div class="day${i === 13 ? " today" : ""}" title="${k}: ${d.blocks} blocks, ${fmt(d.ms)}">
      <div class="b${d.blocks ? "" : " zero"}" style="height:${d.blocks / dmax * 90}%"></div>${k.slice(8)}</div>`; }).join("");
  el("chart").innerHTML = rows.length ? rows.map(([d, v]) => `
    <div class="row"><div>${d}</div><div class="bar" style="width:${v.ms / max * 100}%"></div>
    <div class="n num">${v.blocks || 0} blocked · ${fmt(v.ms)}</div></div>`).join("") : `<p class="muted">Nothing yet. Bypass something first.</p>`;

  // Suggestions from history: top hosts by visit count, excluding listed ones and their subdomains.
  let items = [], err = "";
  try { if (!chrome.history) throw new Error("no history permission"); items = await chrome.history.search({ text: "", maxResults: 10000, startTime: Date.now() - 30 * 86400000 }); }
  catch (e) { err = e.message; }
  const byHost = {};
  for (const it of items) {
    try {
      if (!/^https?:/.test(it.url)) continue;
      const h = new URL(it.url).hostname.replace(/^www\./, "");
      if (!h || sites.some(d => h === d || h.endsWith("." + d))) continue;
      byHost[h] = (byHost[h] || 0) + (it.visitCount || 1);
    } catch {}
  }
  const top = Object.entries(byHost).sort((a, b) => b[1] - a[1]).slice(0, 8);
  el("sug").innerHTML = top.length ? top.map(([h, n]) => `
    <div class="sug"><div>${h} <span>${n} visits</span></div><button class="btn" data-h="${h}">Block</button></div>`).join("")
    : `<p class="muted">${err ? "History access failed: " + err + " — remove and re-add the extension." : `Nothing to suggest (${items.length} history entries scanned).`}</p>`;
  el("sug").onclick = async e => {
    const h = e.target.dataset.h; if (!h) return;
    const { rules = [] } = await chrome.storage.local.get("rules");
    await chrome.storage.local.set({ rules: [...rules, { host: h, path: "", allow: false }] });
    render();
  };
}
render();
