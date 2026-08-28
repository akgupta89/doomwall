# Connecting an agent to Doomwall (WebMCP)

Doomwall exposes its controls as [WebMCP](https://github.com/webmachinelearning/webmcp) tools.
Any agent that can see a page's `document.modelContext` — Chrome's built-in agent, Edge's,
or your own script driving the browser — can list rules, add/remove them, toggle, pause, and read stats.

## Tools

| Tool | Input | Does |
|---|---|---|
| `doomwall-list-rules` | – | rules + `on` + `paused` |
| `doomwall-add-rule` | `site`, `path?`, `allow?`, `from?`, `to?`, `days?` | add a block (or `allow: true` exception), optional `HH:MM` window and `days` (0=Sun…6=Sat) |
| `doomwall-remove-rule` | `site`, `path?` | remove matching rules |
| `doomwall-set-blocking` | `on` | master switch |
| `doomwall-pause` | `minutes?` | pause blocking |
| `doomwall-get-stats` | – | blocks / bypasses / minutes, today and all-time |

Every tool returns `{ content: [{ type: "text", text: "<json>" }] }`.

## Requirements

1. Chrome 149+ or Edge 150+ with WebMCP on: `chrome://flags/#enable-webmcp` → Enabled → relaunch
   (or launch with `--enable-features=WebMCP`).
2. Doomwall installed (unpacked is fine). Note the extension ID from `chrome://extensions`.
3. One Doomwall page open. Tools live on the extension's own pages — popup, options, blocked page,
   activity page — and exist only while one is open. The cheapest is the options page:
   `chrome-extension://<ID>/src/options.html`.

## Built-in browser agent

Open any Doomwall page, then ask the browser's agent: *"block reddit.com on weekdays 9 to 6"*.
The tools show up automatically; nothing to configure.

## Your own agent, fully automated

Drive Chrome over the DevTools protocol and call the tools from the options page. Node 22+ (built-in `WebSocket`), no packages:

```js
// doomwall-agent.mjs — usage: node doomwall-agent.mjs <tool> '<json-args>'
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; // adjust
const EXT = "/path/to/doomwall";                                                // the repo checkout
const PORT = 9333;
const [tool, args = "{}"] = process.argv.slice(2);

// 1. launch (or reuse) a Chrome with WebMCP on and the extension loaded
const alive = await fetch(`http://localhost:${PORT}/json/version`).then(() => true).catch(() => false);
if (!alive) {
  const { spawn } = await import("node:child_process");
  spawn(CHROME, [`--remote-debugging-port=${PORT}`, `--user-data-dir=${process.env.HOME}/.doomwall-agent`,
    `--load-extension=${EXT}`, "--enable-features=WebMCP", "--no-first-run", "about:blank"], { detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 50; i++) { await new Promise(r => setTimeout(r, 200)); if (await fetch(`http://localhost:${PORT}/json/version`).then(() => true).catch(() => false)) break; }
}

// 2. find the extension id from its service worker, open the options page
const targets = await (await fetch(`http://localhost:${PORT}/json`)).json();
const id = targets.find(t => t.url.endsWith("/src/bg.js"))?.url.match(/^chrome-extension:\/\/(\w+)/)[1];
if (!id) throw new Error("Doomwall not loaded");
let page = targets.find(t => t.url === `chrome-extension://${id}/src/options.html`)
  ?? await (await fetch(`http://localhost:${PORT}/json/new?chrome-extension://${id}/src/options.html`, { method: "PUT" })).json();

// 3. call the tool through document.modelContext
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
const send = (method, params) => new Promise(res => { const mid = Date.now(); ws.addEventListener("message", function h(e) { const m = JSON.parse(e.data); if (m.id === mid) { ws.removeEventListener("message", h); res(m.result); } }); ws.send(JSON.stringify({ id: mid, method, params })); });
const expr = `(async () => {
  const name = ${JSON.stringify(tool)}, args = ${args};
  const ctx = document.modelContext;
  let r;
  if (ctx?.getTools) {            // spec API (getTools/executeTool)
    const t = (await ctx.getTools()).find(t => t.name === name);
    if (!t) return "unknown tool; have: " + (await ctx.getTools()).map(t => t.name).join(", ");
    r = await ctx.executeTool(t, args);
  } else {                        // older builds only have registerTool: call the tool table directly
    const t = DoomwallTools[name]; if (!t) return "unknown tool; have: " + Object.keys(DoomwallTools).join(", ");
    r = await t.execute(args);
  }
  return r.content?.[0]?.text ?? JSON.stringify(r);
})()`;
const { result } = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
console.log(result.value); ws.close();
```

```sh
node doomwall-agent.mjs doomwall-list-rules
node doomwall-agent.mjs doomwall-add-rule '{"site":"reddit.com","from":"09:00","to":"18:00","days":[1,2,3,4,5]}'
node doomwall-agent.mjs doomwall-pause '{"minutes":10}'
```

Wrap that script as a tool in your agent framework (an MCP server with one `doomwall` tool that shells out, a Claude Code skill, a cron job) and the agent has full control of the wall.

Note: `--load-extension` is ignored by branded Chrome 137+. Use Chrome for Testing, Chromium, Edge, or a profile
where Doomwall is already installed (drop `--load-extension` and point `--user-data-dir` at it).

## Without WebMCP

`src/webmcp.js` also puts the same tool table on `window.DoomwallTools` on every Doomwall page, so
`DoomwallTools["doomwall-add-rule"].execute({ site: "reddit.com" })` works from the console or any
automation, flag or no flag. Underneath, everything is a write to `chrome.storage.local`
(`rules`, `on`, `pauseUntil`, `settings`).
