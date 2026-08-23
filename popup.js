const t = document.getElementById("toggle");
const show = on => t.classList.toggle("on", on);
chrome.storage.local.get("on").then(({ on = true }) => show(on));
t.onclick = async () => {
  const { on = true } = await chrome.storage.local.get("on");
  await chrome.storage.local.set({ on: !on });
  show(!on);
};
document.getElementById("opts").onclick = e => { e.preventDefault(); chrome.runtime.openOptionsPage(); };
