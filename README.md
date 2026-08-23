# Doomwall

A Chrome extension that blocks the sites you open on autopilot and shames you a little when you try.

![icon](icon128.png)

## What it does

- **Blocks** any domain on your list (subdomains included), even sites that serve pages from a service worker cache (x.com, Gmail).
- **Blocked page** with a rotating guilt line, per-site counts for today and all time, and an estimate of the time you got back.
- **Bypass** — a small shameful link lets that one tab through; tabs opened from it (deal links, redirects) inherit the pass. Closes with the tab.
- **Pause** — "I actually need this" unblocks everything for 5 minutes, then re-arms itself.
- **Activity page** — today / all-time totals, a 14-day chart, per-site blocks and time spent after bypassing, and suggestions from your history of frequently visited sites not yet on the list.
- **One-click toggle** in the toolbar popup. Ember icon = blocking, grey = off/paused.
- No background process: a Manifest V3 service worker that only wakes on events. Nothing leaves your browser; all data is in `chrome.storage.local`.

## Install (unpacked)

1. Clone this repo.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick the folder.
3. Click the toolbar icon → **Block list** → edit → **Save**.

## Files

| File | Purpose |
|---|---|
| `bg.js` | rules, bypass/pause logic, time tracking |
| `blocked.html/js` | the page you land on |
| `activity.html/js` | stats and suggestions |
| `options.html/js` | block list editor |
| `popup.html/js` | toolbar dropdown |
| `theme.css` | shared "ink & ember" theme |
| `icon.svg` / `icon-off.svg` | icon sources (PNGs are rasterized from these) |

## Permissions

- `declarativeNetRequest` + `host_permissions` — redirect blocked navigations to the blocked page
- `storage` — list, toggle, stats
- `history` — suggestions on the activity page
- `alarms` — end the 5-minute pause

## Publish

```sh
zip -r doomwall.zip . -x '*.zip' -x '.git*' -x README.md -x '*.svg'
```

Upload at the [Chrome Web Store developer console](https://chrome.google.com/webstore/devconsole). Single purpose: block user-chosen websites. No data collected.
