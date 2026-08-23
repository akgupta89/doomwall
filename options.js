const ta = document.getElementById("sites");
const STARTERS = ["x.com", "twitter.com", "instagram.com", "facebook.com", "tiktok.com", "reddit.com", "youtube.com", "linkedin.com", "threads.net", "snapchat.com"];
// empty list → prefill with common ones so they're right there to trim and save
chrome.storage.local.get("sites").then(({ sites = [] }) => ta.value = (sites.length ? sites : STARTERS).join("\n"));
document.getElementById("save").onclick = async () => {
  const sites = ta.value.split("\n").map(s => s.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "")).filter(Boolean);
  await chrome.storage.local.set({ sites });
  document.getElementById("msg").textContent = `Saved ${sites.length} sites`;
};
