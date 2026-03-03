const DATA_KEY = "znData";

const CATEGORY_TEMPLATES = {
  gossip: { name: "Gossip & Drama", description: "Celebrity gossip, relationship drama, feuds" },
  engagement_bait: { name: "Engagement Bait", description: "Clickbait, viral reactions, shocking headlines" },
  politics: { name: "Politics", description: "Political news and commentary" },
  sports: { name: "Sports", description: "Sports news, scores, and commentary" },
  crypto: { name: "Crypto/Finance", description: "Cryptocurrency and financial content" }
};

function qualityText(filtered) {
  if (filtered >= 20) return "Your feed stayed calm today.";
  if (filtered >= 8) return "You skipped a lot of noise.";
  if (filtered >= 1) return "Your feed is cleaner.";
  return "Quietly watching. Hide posts you don't want to train the filter.";
}

async function load() {
  const stored = await chrome.storage.local.get(DATA_KEY);
  const data = stored[DATA_KEY] || {};
  const stats = data.stats || {};
  const settings = data.settings || {};
  const learned = data.learned || {};

  const filtered = Number(stats.filteredToday || 0);
  document.getElementById("filteredCount").textContent = String(filtered);
  document.getElementById("qualityText").textContent = qualityText(filtered);
  document.getElementById("enabled").checked = settings.enabled !== false;

  // Show active categories
  const activeCategories = settings.activeCategories || [];
  const activeCategoriesEl = document.getElementById("activeCategories");
  const categoriesSection = document.getElementById("categoriesSection");

  if (activeCategories.length > 0) {
    categoriesSection.hidden = false;
    activeCategoriesEl.innerHTML = activeCategories
      .map(id => {
        const template = CATEGORY_TEMPLATES[id];
        return template ? `<div class="category-tag">${template.name}</div>` : '';
      })
      .join('');
  }

  // Show category stats
  const byCategory = stats.byCategory || {};
  const hideCategories = learned.hideCategories || {};
  const allCategories = new Set([...Object.keys(byCategory), ...Object.keys(hideCategories)]);

  if (allCategories.size > 0) {
    categoriesSection.hidden = false;
    const categoryStatsEl = document.getElementById("categoryStats");
    const sortedCategories = Array.from(allCategories)
      .map(cat => ({ name: cat, count: byCategory[cat] || 0, weight: hideCategories[cat] || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    categoryStatsEl.innerHTML = sortedCategories
      .map(cat => `<div class="stat-row"><span>${cat.name}</span><span>${cat.count} hidden</span></div>`)
      .join('');
  }
}

async function saveEnabled(enabled) {
  const stored = await chrome.storage.local.get(DATA_KEY);
  const data = stored[DATA_KEY] || {};
  data.settings = { ...(data.settings || {}), enabled };
  await chrome.storage.local.set({ [DATA_KEY]: data });
}

document.getElementById("enabled").addEventListener("change", async (event) => {
  await saveEnabled(Boolean(event.target.checked));
});

document.getElementById("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

load();
