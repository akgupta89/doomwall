# Doomwall

A Chrome extension that blocks the sites you open on autopilot and shames you a little when you try.

![icon](assets/icon128.png)

## What it does

- **Block list.** Add the domains you open without thinking. Subdomains are included.
- **Blocked page.** A guilt line, how many times you tried today and overall, and roughly how much time you got back.
- **Bypass.** One tab gets through when you admit you have no self-control. Links opened from it work too.
- **Pause.** Turn everything off for 5 minutes when you actually need a site.
- **Activity.** Daily and all-time numbers, a 14-day chart, time spent per site, and suggestions from your browsing history.
- **Toggle.** One click in the toolbar. Ember icon means blocking, grey means off.
- **Private.** Everything stays in your browser. No accounts, no servers, no background process.

## Install (unpacked)

1. Clone this repo.
2. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick the folder.
3. Click the toolbar icon → **Block list** → edit → **Save**.

## Files

| File | Purpose |
|---|---|
| `src/bg.js` | rules, bypass/pause logic, time tracking |
| `src/blocked.*` | the page you land on |
| `src/activity.*` | stats and suggestions |
| `src/options.*` | block list editor |
| `src/popup.*` | toolbar dropdown |
| `src/theme.css` | shared "ink & ember" theme |
| `assets/` | icons (PNGs rasterized from the SVGs) |

## Permissions

- `declarativeNetRequest` + `host_permissions` - redirect blocked navigations to the blocked page
- `storage` - list, toggle, stats
- `history` - suggestions on the activity page
- `alarms` - end the 5-minute pause
