const $ = id => document.getElementById(id);
const STARTERS = ["x.com", "twitter.com", "instagram.com", "facebook.com", "tiktok.com", "reddit.com", "youtube.com", "linkedin.com", "threads.net", "snapchat.com"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const cleanHost = s => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
const cleanPath = s => { s = s.trim(); return s ? "/" + s.replace(/^\/+/, "").replace(/\/+$/, "") : ""; };
let rules = [], editing = -1;

const when = r => r.window ? `${r.window.from}–${r.window.to} ${r.window.days.length === 7 ? "daily" : r.window.days.map(d => DAYS[d]).join(" ")}` : "";
function render() {
  $("rules").innerHTML = rules.map((r, i) => `
    <div class="rule${r.allow ? " allow" : ""}" data-i="${i}"><span class="what">${r.host}${r.path}</span><span class="when">${when(r)}</span><button class="x" title="Delete">×</button></div>`).join("")
    || `<p class="muted">No rules yet.</p>`;
}
async function save() { await chrome.storage.local.set({ rules }); render(); }

// Rule list: click row = edit, × = delete
$("rules").onclick = e => {
  const row = e.target.closest(".rule"); if (!row) return;
  const i = +row.dataset.i;
  if (e.target.classList.contains("x")) { rules.splice(i, 1); save(); } else edit(i);
};

// Dialog
$("days").innerHTML = DAYS.map((d, i) => `<button type="button" data-d="${i}">${d}</button>`).join("");
$("days").onclick = e => { if (e.target.dataset.d) e.target.classList.toggle("on"); };
$("timed").onchange = () => $("when").hidden = !$("timed").checked;
function edit(i = -1) {
  editing = i;
  const r = rules[i] || { host: "", path: "", allow: false };
  $("host").value = r.host; $("path").value = r.path;
  $("form").type.value = r.allow ? "allow" : "block";
  $("timed").checked = !!r.window; $("when").hidden = !r.window;
  $("from").value = r.window?.from ?? "09:00"; $("to").value = r.window?.to ?? "18:00";
  const days = r.window?.days ?? [1, 2, 3, 4, 5];
  for (const b of $("days").children) b.classList.toggle("on", days.includes(+b.dataset.d));
  $("dlg").showModal();
}
$("add").onclick = () => edit();
$("dlg").onclose = () => {
  if ($("dlg").returnValue !== "ok") return;
  const host = cleanHost($("host").value); if (!host) return;
  const r = { host, path: cleanPath($("path").value), allow: $("form").type.value === "allow" };
  if ($("timed").checked) r.window = { from: $("from").value, to: $("to").value, days: [...$("days").children].filter(b => b.classList.contains("on")).map(b => +b.dataset.d) };
  if (editing < 0) rules.push(r); else rules[editing] = r;
  save();
};

// Settings
$("save").onclick = async () => {
  const settings = { pauseMinutes: +$("pause").value || 5, bypassLimit: +$("limit").value || 0, lines: $("lines").value.split("\n").map(s => s.trim()).filter(Boolean) };
  await chrome.storage.local.set({ settings });
  $("msg").textContent = "Saved";
};

chrome.storage.local.get(["rules", "sites", "settings"]).then(({ rules: r, sites, settings = {} }) => {
  // first run: prefill common sites so they're right there to trim
  rules = r ?? (sites?.length ? sites : STARTERS).map(host => ({ host, path: "", allow: false }));
  if (!r) save(); else render();
  $("pause").value = settings.pauseMinutes ?? 5; $("limit").value = settings.bypassLimit ?? 0; $("lines").value = (settings.lines ?? []).join("\n");
});
