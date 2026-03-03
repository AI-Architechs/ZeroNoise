const DATA_KEY = "znData";

// Utility functions
function getTodayISO() {
  return new Date().toISOString().split('T')[0];
}

function exportLearnedPatterns(data) {
  const exportData = {
    version: 1,
    exportDate: new Date().toISOString(),
    learned: data.learned,
    settings: data.settings,
  };
  return JSON.stringify(exportData, null, 2);
}

function importLearnedPatterns(jsonString) {
  try {
    const imported = JSON.parse(jsonString);
    if (!imported.version || !imported.learned) {
      throw new Error('Invalid backup file structure');
    }
    return {
      learned: imported.learned,
      settings: imported.settings || {},
      valid: true,
    };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

function mergeLearnedPatterns(existing, imported, strategy = 'average') {
  const merged = {
    hidePhrases: {},
    hideNames: {},
    hideDomains: {},
    hideStyles: {},
    showPhrases: {},
    showNames: {},
    showDomains: {},
    showStyles: {},
  };

  for (const category of Object.keys(merged)) {
    const existingPatterns = existing[category] || {};
    const importedPatterns = imported[category] || {};
    const allKeys = new Set([...Object.keys(existingPatterns), ...Object.keys(importedPatterns)]);

    for (const key of allKeys) {
      const existingWeight = existingPatterns[key] || 0;
      const importedWeight = importedPatterns[key] || 0;

      let finalWeight;
      switch (strategy) {
        case 'max':
          finalWeight = Math.max(existingWeight, importedWeight);
          break;
        case 'add':
          finalWeight = existingWeight + importedWeight;
          break;
        case 'average':
        default:
          finalWeight = (existingWeight + importedWeight) / (existingWeight && importedWeight ? 2 : 1);
      }

      if (finalWeight > 0) {
        merged[category][key] = finalWeight;
      }
    }
  }

  return merged;
}

function topEntries(map, n = 12) {
  return Object.entries(map || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function renderGroupedList(el, groupedData, type) {
  el.textContent = "";

  const groups = [
    { key: 'phrases', label: 'Phrases', icon: '💬' },
    { key: 'names', label: 'Names', icon: '👤' },
    { key: 'domains', label: 'Domains', icon: '🌐' },
    { key: 'styles', label: 'Styles', icon: '🎨' }
  ];

  let hasAnyPatterns = false;

  for (const group of groups) {
    const patterns = groupedData[group.key] || [];
    if (patterns.length === 0) continue;

    hasAnyPatterns = true;

    // Create group header
    const groupHeader = document.createElement("div");
    groupHeader.className = "pattern-group-header";
    groupHeader.innerHTML = `<span>${group.icon} ${group.label}</span>`;
    el.appendChild(groupHeader);

    // Create patterns list
    const patternsList = document.createElement("ul");
    patternsList.className = "patterns-list";

    for (const [key, score] of patterns) {
      const li = document.createElement("li");
      li.className = "pattern-item";

      const textSpan = document.createElement("span");
      textSpan.className = "pattern-text";
      textSpan.textContent = key;

      const scoreSpan = document.createElement("span");
      scoreSpan.className = "pattern-score";
      scoreSpan.textContent = score.toFixed(1);

      const removeBtn = document.createElement("button");
      removeBtn.className = "pattern-remove";
      removeBtn.innerHTML = "×";
      removeBtn.title = "Remove this pattern";
      removeBtn.dataset.type = type;
      removeBtn.dataset.category = group.key;
      removeBtn.dataset.pattern = key;

      li.appendChild(textSpan);
      li.appendChild(scoreSpan);
      li.appendChild(removeBtn);
      patternsList.appendChild(li);
    }

    el.appendChild(patternsList);
  }

  if (!hasAnyPatterns) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "empty-message";
    emptyMsg.textContent = "No learned signals yet.";
    el.appendChild(emptyMsg);
  }
}

async function getData() {
  const stored = await chrome.storage.local.get(DATA_KEY);
  return stored[DATA_KEY] || {};
}

async function setData(data) {
  await chrome.storage.local.set({ [DATA_KEY]: data });
}

function collectSignals(learned) {
  const hidden = {
    phrases: topEntries(learned.hidePhrases),
    domains: topEntries(learned.hideDomains),
    names: topEntries(learned.hideNames),
    styles: topEntries(learned.hideStyles)
  };
  const shown = {
    phrases: topEntries(learned.showPhrases),
    domains: topEntries(learned.showDomains),
    names: topEntries(learned.showNames),
    styles: topEntries(learned.showStyles)
  };
  return { hidden, shown };
}

function renderCustomTags(tags) {
  const container = document.getElementById("customTags");
  container.innerHTML = "";

  if (!tags || tags.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "tags-empty";
    emptyMsg.textContent = "No custom tags added yet.";
    container.appendChild(emptyMsg);
    return;
  }

  tags.forEach(tag => {
    const tagEl = document.createElement("div");
    tagEl.className = "tag-item";

    const textSpan = document.createElement("span");
    textSpan.className = "tag-text";
    textSpan.textContent = tag;

    const removeBtn = document.createElement("button");
    removeBtn.className = "tag-remove";
    removeBtn.innerHTML = "×";
    removeBtn.title = "Remove this tag";
    removeBtn.dataset.tag = tag;

    tagEl.appendChild(textSpan);
    tagEl.appendChild(removeBtn);
    container.appendChild(tagEl);
  });
}

async function addCustomTag() {
  const input = document.getElementById("tagInput");
  const tag = input.value.trim();

  if (!tag) {
    setStatus("Please enter a tag.");
    return;
  }

  const data = await getData();
  const customTags = new Set(data.settings?.customTags || []);

  if (customTags.has(tag)) {
    setStatus("This tag already exists.");
    return;
  }

  customTags.add(tag);
  data.settings = { ...(data.settings || {}), customTags: Array.from(customTags) };
  await setData(data);

  input.value = "";
  renderCustomTags(Array.from(customTags));
  setStatus(`Added tag: "${tag}"`);
}

async function removeCustomTag(tag) {
  const data = await getData();
  const customTags = new Set(data.settings?.customTags || []);

  customTags.delete(tag);
  data.settings = { ...(data.settings || {}), customTags: Array.from(customTags) };
  await setData(data);

  renderCustomTags(Array.from(customTags));
  setStatus(`Removed tag: "${tag}"`);
}

async function load() {
  const data = await getData();
  const settings = data.settings || {};
  const learned = data.learned || {};

  // Render custom tags
  renderCustomTags(settings.customTags || []);

  // Add tag button event listener
  document.getElementById("addTag").addEventListener("click", addCustomTag);

  // Tag input enter key support
  document.getElementById("tagInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addCustomTag();
    }
  });

  // Tag removal event listener
  document.getElementById("customTags").addEventListener("click", (e) => {
    if (e.target.classList.contains("tag-remove")) {
      const tag = e.target.dataset.tag;
      removeCustomTag(tag);
    }
  });

  document.getElementById("softThreshold").value = settings.softThreshold ?? 2.2;
  document.getElementById("hardThreshold").value = settings.hardThreshold ?? 4.2;

  const signals = collectSignals({
    hidePhrases: learned.hidePhrases || {},
    hideDomains: learned.hideDomains || {},
    hideNames: learned.hideNames || {},
    hideStyles: learned.hideStyles || {},
    showPhrases: learned.showPhrases || {},
    showDomains: learned.showDomains || {},
    showNames: learned.showNames || {},
    showStyles: learned.showStyles || {}
  });

  const hiddenEl = document.getElementById("hiddenSignals");
  const shownEl = document.getElementById("shownSignals");

  renderGroupedList(hiddenEl, signals.hidden, 'hide');
  renderGroupedList(shownEl, signals.shown, 'show');

  // Add event listeners for remove buttons
  hiddenEl.addEventListener('click', handlePatternRemove);
  shownEl.addEventListener('click', handlePatternRemove);
}

async function handlePatternRemove(e) {
  if (!e.target.classList.contains('pattern-remove')) return;

  const { type, category, pattern } = e.target.dataset;

  if (!confirm(`Remove "${pattern}" from ${type === 'hide' ? 'hidden' : 'always-show'} patterns?`)) {
    return;
  }

  const data = await getData();
  const learned = data.learned || {};

  // Build the key name: e.g., 'hidePhrases', 'showDomains'
  const categoryKey = type + category.charAt(0).toUpperCase() + category.slice(1);

  if (learned[categoryKey] && learned[categoryKey][pattern] !== undefined) {
    delete learned[categoryKey][pattern];
    data.learned = learned;
    await setData(data);
    await load();
    setStatus(`Removed "${pattern}" from learned patterns.`);
  }
}

function setStatus(text) {
  document.getElementById("status").textContent = text;
}

document.getElementById("saveThresholds").addEventListener("click", async () => {
  const soft = Number(document.getElementById("softThreshold").value);
  const hard = Number(document.getElementById("hardThreshold").value);
  if (!Number.isFinite(soft) || !Number.isFinite(hard) || soft <= 0 || hard <= soft) {
    setStatus("Use valid thresholds, with strong threshold higher than soft threshold.");
    return;
  }
  const data = await getData();
  data.settings = { ...(data.settings || {}), softThreshold: soft, hardThreshold: hard };
  await setData(data);
  setStatus("Thresholds saved.");
});

document.getElementById("resetLearning").addEventListener("click", async () => {
  if (!confirm('Are you sure you want to reset all learned patterns? This cannot be undone.')) {
    return;
  }

  const data = await getData();
  data.learned = {
    hidePhrases: {},
    hideDomains: {},
    hideNames: {},
    hideStyles: {},
    showPhrases: {},
    showDomains: {},
    showNames: {},
    showStyles: {}
  };
  data.recentFeedback = [];
  await setData(data);
  await load();
  setStatus("Learned patterns reset.");
});

// Export patterns
document.getElementById("exportPatterns").addEventListener("click", async () => {
  try {
    const data = await getData();
    const exportData = exportLearnedPatterns(data);

    // Create download
    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zeronoise-backup-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus('Patterns exported successfully.');
  } catch (error) {
    setStatus('Error exporting patterns. Please try again.');
  }
});

// Import patterns
document.getElementById("importPatterns").addEventListener("click", () => {
  document.getElementById("importFile").click();
});

document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const imported = importLearnedPatterns(text);

    if (!imported.valid) {
      setStatus(`Import failed: ${imported.error}`);
      return;
    }

    // Ask user how to merge
    const strategy = confirm(
      'How should we handle conflicts?\n\n' +
      'OK = Average weights (recommended)\n' +
      'Cancel = Keep higher weights'
    ) ? 'average' : 'max';

    const data = await getData();
    const existingLearned = data.learned || {};

    // Merge patterns
    data.learned = mergeLearnedPatterns(existingLearned, imported.learned, strategy);

    // Optionally import settings
    if (imported.settings && confirm('Also import threshold settings?')) {
      data.settings = { ...data.settings, ...imported.settings };
    }

    await setData(data);
    await load();
    const totalPatterns = Object.values(data.learned).reduce((sum, map) => sum + Object.keys(map).length, 0);
    setStatus(`Import successful! Imported ${totalPatterns} patterns.`);
  } catch (error) {
    setStatus('Error importing patterns. Please check the file format.');
  } finally {
    // Reset file input
    e.target.value = '';
  }
});

load();
