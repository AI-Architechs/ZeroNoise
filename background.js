const DEFAULT_DATA = {
  version: 1,
  settings: {
    enabled: true,
    softThreshold: 2.2,
    hardThreshold: 4.2
  },
  stats: {
    date: "",
    filteredToday: 0,
    blurredToday: 0,
    hiddenToday: 0
  },
  learned: {
    hidePhrases: {},
    hideDomains: {},
    hideNames: {},
    hideStyles: {},
    showPhrases: {},
    showDomains: {},
    showNames: {},
    showStyles: {}
  },
  recentFeedback: []
};

const DATA_KEY = "znData";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function getData() {
  const stored = await chrome.storage.local.get(DATA_KEY);
  const current = stored[DATA_KEY];
  if (!current) {
    return { ...DEFAULT_DATA, stats: { ...DEFAULT_DATA.stats, date: todayIso() } };
  }
  return {
    ...DEFAULT_DATA,
    ...current,
    settings: { ...DEFAULT_DATA.settings, ...(current.settings || {}) },
    stats: { ...DEFAULT_DATA.stats, ...(current.stats || {}) },
    learned: { ...DEFAULT_DATA.learned, ...(current.learned || {}) },
    recentFeedback: Array.isArray(current.recentFeedback) ? current.recentFeedback : []
  };
}

async function setData(data) {
  await chrome.storage.local.set({ [DATA_KEY]: data });
}

async function init() {
  const data = await getData();
  if (!data.stats.date) {
    data.stats.date = todayIso();
  }
  await setData(data);
}

function updateBadge(filteredCount) {
  const text = filteredCount > 0 ? String(Math.min(filteredCount, 99)) : "";
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#5d7c6f" });
}

chrome.runtime.onInstalled.addListener(async () => {
  await init();
});

chrome.runtime.onStartup.addListener(async () => {
  await init();
  const data = await getData();
  if (data.stats.date !== todayIso()) {
    data.stats = { ...DEFAULT_DATA.stats, date: todayIso() };
    await setData(data);
  }
  updateBadge(data.stats.filteredToday);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "zn:badge") {
    updateBadge(Number(message.filteredToday || 0));
    sendResponse({ ok: true });
  }
});
