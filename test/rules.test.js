const assert = require("assert");
require("../src/rules.js");
const { matches, active, cleanHost, cleanPath, toRule } = globalThis.Rules;

const R = (host, o = {}) => ({ host, path: "", allow: false, ...o });
const mon10 = new Date(2026, 7, 31, 10, 0); // Monday 10:00 local
const sat10 = new Date(2026, 8, 5, 10, 0);  // Saturday
const mon22 = new Date(2026, 7, 31, 22, 0);

// active(): time windows
assert.equal(active(R("x.com"), mon10), true);
const win = R("x.com", { window: { from: "09:00", to: "18:00", days: [1, 2, 3, 4, 5] } });
assert.equal(active(win, mon10), true);
assert.equal(active(win, mon22), false);
assert.equal(active(win, sat10), false);
const overnight = R("x.com", { window: { from: "22:00", to: "02:00", days: [0, 1, 2, 3, 4, 5, 6] } });
assert.equal(active(overnight, mon22), true);
assert.equal(active(overnight, mon10), false);

// matches(): returns host of the blocking rule or null
const rules = [R("reddit.com"), R("reddit.com", { path: "/r/programming", allow: true }), R("youtube.com", { path: "/shorts" }), win];
assert.equal(matches("https://www.reddit.com/r/all", rules, mon10), "reddit.com");
assert.equal(matches("https://reddit.com/r/programming/top", rules, mon10), null);
assert.equal(matches("https://youtube.com/", rules, mon10), null);
assert.equal(matches("https://youtube.com/shorts/abc", rules, mon10), "youtube.com");
assert.equal(matches("https://x.com/home", rules, mon10), "x.com");
assert.equal(matches("https://x.com/home", rules, sat10), null);
assert.equal(matches("https://notreddit.com/", rules, mon10), null);
assert.equal(matches("not a url", rules, mon10), null);
// cleaners (shared by options UI and WebMCP tools)
assert.equal(cleanHost(" https://WWW.Reddit.com/r/x "), "reddit.com");
assert.equal(cleanPath(" r/programming/ "), "/r/programming");
assert.equal(cleanPath(""), "");
assert.deepEqual(toRule({ site: "YouTube.com", path: "shorts" }), { host: "youtube.com", path: "/shorts", allow: false });
assert.deepEqual(toRule({ site: "x.com", allow: true, from: "09:00", to: "18:00", days: [1, 2] }), { host: "x.com", path: "", allow: true, window: { from: "09:00", to: "18:00", days: [1, 2] } });
assert.deepEqual(toRule({ site: "x.com", from: "09:00", to: "18:00" }).window.days, [0, 1, 2, 3, 4, 5, 6]);
assert.throws(() => toRule({ site: "" }), /site/);
console.log("ok");
