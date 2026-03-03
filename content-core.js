window.ZeroNoiseCore = (() => {
  const DATA_KEY = "znData";
  const MAX_RECENT_FEEDBACK = 60;

  const STOPWORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "has",
    "he", "her", "his", "i", "in", "is", "it", "its", "of", "on", "or", "she",
    "that", "the", "their", "them", "they", "this", "to", "was", "were", "will", "with"
  ]);

  // Category templates for optional starter patterns
  const CATEGORY_TEMPLATES = {
    gossip: {
      name: "Gossip & Drama",
      description: "Celebrity gossip, relationship drama, feuds",
      patterns: [
        [/broke up|split up|divorce|dating|ex[- ]?boyfriend|ex[- ]?girlfriend/gi, 1.5, "relationship drama"],
        [/rumor|gossip|tea|feud|beef|clapback|exposed/gi, 1.6, "gossip-style language"],
        [/who wore|red carpet|paparazzi|spotted with|private life/gi, 1.2, "personal-life tracking"]
      ]
    },
    engagement_bait: {
      name: "Engagement Bait",
      description: "Clickbait, viral reactions, shocking headlines",
      patterns: [
        [/internet reacts|fans shocked|went viral|you won't believe|meltdown/gi, 1.8, "engagement bait phrasing"],
        [/comment section|social media is divided|people are saying/gi, 1.1, "reaction-driven framing"],
        [/the truth|what really happened|shocking/gi, 1.1, "clickbait framing"]
      ]
    },
    politics: {
      name: "Politics",
      description: "Political news and commentary",
      patterns: [
        [/democrat|republican|biden|trump|congress|senate|election/gi, 1.2, "political content"],
        [/liberal|conservative|left-wing|right-wing/gi, 1.0, "political ideology"]
      ]
    },
    sports: {
      name: "Sports",
      description: "Sports news, scores, and commentary",
      patterns: [
        [/nfl|nba|mlb|nhl|soccer|football|basketball|baseball/gi, 1.2, "sports content"],
        [/game|match|score|playoff|championship/gi, 0.8, "sports events"]
      ]
    },
    crypto: {
      name: "Crypto/Finance",
      description: "Cryptocurrency and financial content",
      patterns: [
        [/bitcoin|crypto|ethereum|blockchain|nft/gi, 1.2, "cryptocurrency content"],
        [/stock|trading|invest|portfolio/gi, 0.9, "financial content"]
      ]
    }
  };

  function createRuntime(adapterPack) {
    const runtimeState = {
      data: null,
      adapter: null,
      itemState: new WeakMap(),
      saveTimer: null,
      processTimer: null
    };

    async function getData() {
      const stored = await chrome.storage.local.get(DATA_KEY);
      const base = {
        version: 2,
        settings: {
          enabled: true,
          softThreshold: 2.2,
          hardThreshold: 4.2,
          customTags: [] // User-defined custom filter tags
        },
        stats: {
          date: isoDay(),
          filteredToday: 0,
          blurredToday: 0,
          hiddenToday: 0,
          byCategory: {} // Track stats by category
        },
        learned: {
          hidePhrases: {},
          hideDomains: {},
          hideNames: {},
          hideStyles: {},
          hideCategories: {}, // New: track learned patterns by category
          showPhrases: {},
          showDomains: {},
          showNames: {},
          showStyles: {}
        },
        recentFeedback: []
      };
      const current = stored[DATA_KEY] || {};
      return {
        ...base,
        ...current,
        settings: { ...base.settings, ...(current.settings || {}) },
        stats: { ...base.stats, ...(current.stats || {}) },
        learned: { ...base.learned, ...(current.learned || {}) },
        recentFeedback: Array.isArray(current.recentFeedback) ? current.recentFeedback : []
      };
    }

    function scheduleSave() {
      clearTimeout(runtimeState.saveTimer);
      runtimeState.saveTimer = setTimeout(async () => {
        await chrome.storage.local.set({ [DATA_KEY]: runtimeState.data });
        chrome.runtime.sendMessage({
          type: "zn:badge",
          filteredToday: runtimeState.data.stats.filteredToday
        });
      }, 200);
    }

    function isoDay() {
      return new Date().toISOString().slice(0, 10);
    }

    function ensureCurrentDayStats() {
      const today = isoDay();
      if (runtimeState.data.stats.date !== today) {
        runtimeState.data.stats = {
          date: today,
          filteredToday: 0,
          blurredToday: 0,
          hiddenToday: 0
        };
        scheduleSave();
      }
    }

    function normalize(text) {
      return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
    }

    function tokenize(text) {
      return normalize(text).split(/[^a-z0-9]+/).filter((t) => t && !STOPWORDS.has(t) && t.length > 2);
    }

    function extractNames(text) {
      const names = new Set();
      const matches = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g) || [];
      for (const m of matches) {
        if (m.length > 2 && m.length < 40) {
          names.add(m);
        }
        if (names.size >= 8) break;
      }
      return Array.from(names).filter((name) => name !== "YouTube");
    }

    function extractPhrases(text) {
      const words = tokenize(text);
      const score = new Map();
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        if (phrase.length > 6) {
          score.set(phrase, (score.get(phrase) || 0) + 1);
        }
      }
      return Array.from(score.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map((x) => x[0]);
    }

    function styleFlags(text) {
      const flags = [];
      if (/\!{2,}/.test(text)) flags.push("multi_exclaim");
      if ((text.match(/[A-Z]{4,}/g) || []).length >= 2) flags.push("all_caps");
      if (/(\?\s*){2,}/.test(text)) flags.push("multi_question");
      return flags;
    }

    function hash(str) {
      let h = 5381;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) + h) ^ str.charCodeAt(i);
      }
      return (h >>> 0).toString(36);
    }

    function buildMetaFromRaw(raw) {
      if (!raw?.text || raw.text.length > 12000) return null;
      const cleanTitle = raw.title || raw.text.slice(0, 120);
      const cleanDomain = raw.domain || "";
      const cleanSite = raw.site || "generic";
      return {
        text: raw.text,
        title: cleanTitle,
        domain: cleanDomain,
        site: cleanSite,
        names: extractNames(raw.text),
        phrases: extractPhrases(`${cleanTitle} ${raw.text.slice(0, 600)}`),
        styles: styleFlags(raw.text.slice(0, 350)),
        key: hash(`${cleanSite}|${normalize(cleanTitle)}|${normalize(raw.text.slice(0, 260))}|${cleanDomain}`)
      };
    }

    function extractItemMeta(el) {
      const raw = runtimeState.adapter.extractRaw(el);
      const meta = buildMetaFromRaw(raw);
      if (!meta) return null;
      if (meta.text.length < runtimeState.adapter.minTextLength) return null;
      return meta;
    }

    function scoreCategoryTemplates(meta) {
      let score = 0;
      const reasons = [];
      const activeCategories = runtimeState.data.settings.activeCategories || [];

      for (const categoryId of activeCategories) {
        const template = CATEGORY_TEMPLATES[categoryId];
        if (!template) continue;

        for (const [regex, weight, reason] of template.patterns) {
          if (regex.test(meta.text)) {
            score += weight;
            reasons.push(`${template.name}: ${reason}`);
          }
          regex.lastIndex = 0;
        }
      }
      return { score, reasons };
    }

    function scoreSitePatterns(meta) {
      const patterns = adapterPack.SITE_PATTERNS[meta.site] || [];
      let score = 0;
      const reasons = [];
      for (const [regex, weight, reason] of patterns) {
        if (regex.test(meta.text)) {
          score += weight;
          reasons.push(reason);
        }
        regex.lastIndex = 0;
      }
      return { score, reasons };
    }


    function scoreFromMap(entries, map, mult, reasons, label) {
      let score = 0;
      for (const value of entries) {
        const w = map[value];
        if (w) {
          score += w * mult;
          if (reasons && label) reasons.push(`${label}: ${value}`);
        }
      }
      return score;
    }

    function scoreCustomTags(meta) {
      const customTags = runtimeState.data.settings.customTags || [];
      let score = 0;
      const reasons = [];

      for (const tag of customTags) {
        const tagLower = tag.toLowerCase();
        const textLower = meta.text.toLowerCase();

        // Check if the tag appears in the content
        if (textLower.includes(tagLower)) {
          score += 1.3; // Significant weight for custom tags
          reasons.push(`custom tag: ${tag}`);
        }
      }

      return { score, reasons };
    }

    function classify(meta) {
      const learned = runtimeState.data.learned;
      const reasons = [];
      const matchedCategories = new Set();

      // Score from custom tags
      const customTagScores = scoreCustomTags(meta);
      let hideScore = customTagScores.score;
      reasons.push(...customTagScores.reasons);

      // Score from site-specific patterns
      const siteSignals = scoreSitePatterns(meta);
      hideScore += siteSignals.score;
      reasons.push(...siteSignals.reasons);

      // Score from learned patterns
      hideScore += scoreFromMap(meta.phrases, learned.hidePhrases, 1.1, reasons, "phrase you hid");
      hideScore += scoreFromMap(meta.names, learned.hideNames, 0.9, reasons, "name you hid");
      hideScore += scoreFromMap(meta.styles, learned.hideStyles, 0.8, reasons, "style you hid");

      // Score from learned categories
      const hideCategories = learned.hideCategories || {};
      for (const [category, weight] of Object.entries(hideCategories)) {
        const categoryMatches = checkCategoryMatch(meta, category);
        if (categoryMatches) {
          hideScore += weight;
          reasons.push(`category you hid: ${category}`);
          matchedCategories.add(category);
        }
      }

      if (meta.domain) {
        const exact = learned.hideDomains[meta.domain] || 0;
        hideScore += exact * 1.2;
        if (exact > 0) reasons.push(`source you hid: ${meta.domain}`);
      }

      // Score from always-show patterns
      let showScore = 0;
      showScore += scoreFromMap(meta.phrases, learned.showPhrases, 1.1);
      showScore += scoreFromMap(meta.names, learned.showNames, 0.9);
      showScore += scoreFromMap(meta.styles, learned.showStyles, 0.8);
      if (meta.domain) showScore += (learned.showDomains[meta.domain] || 0) * 1.2;

      if (showScore >= hideScore + 1.1) {
        return { decision: "show", score: hideScore, showScore, reasons: ["matches your always-show signals"], categories: Array.from(matchedCategories) };
      }

      if (hideScore >= runtimeState.data.settings.hardThreshold) {
        return { decision: "hide", score: hideScore, showScore, reasons, categories: Array.from(matchedCategories) };
      }
      if (hideScore >= runtimeState.data.settings.softThreshold) {
        return { decision: "blur", score: hideScore, showScore, reasons, categories: Array.from(matchedCategories) };
      }
      return { decision: "show", score: hideScore, showScore, reasons, categories: Array.from(matchedCategories) };
    }

    function checkCategoryMatch(meta, category) {
      // Simple category matching - checks if any phrases/names match the category
      const categoryKey = category.toLowerCase();
      return meta.phrases.some(p => p.includes(categoryKey)) ||
             meta.names.some(n => n.toLowerCase().includes(categoryKey));
    }

    function friendlyReason(result, meta) {
      if (!result.reasons || !result.reasons.length) {
        return "No filtering patterns matched this post.";
      }

      const details = [];

      // Show score breakdown
      details.push(`Hide score: ${result.score.toFixed(1)} (threshold: ${runtimeState.data.settings.softThreshold}/${runtimeState.data.settings.hardThreshold})`);
      details.push(`Show score: ${result.showScore.toFixed(1)}`);

      // Show categories
      if (result.categories && result.categories.length > 0) {
        details.push(`Categories: ${result.categories.join(", ")}`);
      }

      // Show matched signals (limit to 5)
      const signals = result.reasons.slice(0, 5);
      details.push(`Matched signals: ${signals.join(" • ")}`);

      // Show matched names (if any)
      if (meta && meta.names && meta.names.length > 0) {
        details.push(`Names detected: ${meta.names.slice(0, 3).join(", ")}`);
      }

      // Show matched phrases (if any)
      if (meta && meta.phrases && meta.phrases.length > 0) {
        details.push(`Key phrases: ${meta.phrases.slice(0, 3).join(", ")}`);
      }

      return details.join("\n");
    }

    function applyDecision(el, meta, result) {
      el.classList.remove("zn-blur", "zn-hide");
      if (result.decision === "blur") el.classList.add("zn-blur");
      if (result.decision === "hide") el.classList.add("zn-hide");

      const oldState = runtimeState.itemState.get(el);
      if (!oldState?.counted && (result.decision === "blur" || result.decision === "hide")) {
        ensureCurrentDayStats();
        runtimeState.data.stats.filteredToday += 1;
        if (result.decision === "blur") runtimeState.data.stats.blurredToday += 1;
        if (result.decision === "hide") runtimeState.data.stats.hiddenToday += 1;
        scheduleSave();
        runtimeState.itemState.set(el, { counted: true, lastFeedbackId: oldState?.lastFeedbackId || null });
      }

      attachControls(el, meta, result);
    }

    function clearFiltering(el) {
      el.classList.remove("zn-blur", "zn-hide", "zn-hover");
      const controls = el.querySelector(":scope > .zn-controls");
      if (controls) controls.remove();
      const next = el.nextElementSibling;
      if (next && next.classList.contains("zn-hidden-bar")) {
        next.remove();
      }
      if (el.dataset.znPositionAdjusted === "1") {
        el.style.position = "";
        delete el.dataset.znPositionAdjusted;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function buildPatternSelector(meta) {
      const sections = [];

      // Phrases section
      if (meta.phrases && meta.phrases.length > 0) {
        const phraseItems = meta.phrases.slice(0, 5).map((phrase, i) =>
          `<label class="zn-pattern-item">
            <input type="checkbox" name="phrase" value="${escapeHtml(phrase)}" checked />
            <span>${escapeHtml(phrase)}</span>
          </label>`
        ).join('');
        sections.push(`<div class="zn-pattern-group">
          <div class="zn-pattern-group-header">💬 Phrases</div>
          ${phraseItems}
        </div>`);
      }

      // Names section
      if (meta.names && meta.names.length > 0) {
        const nameItems = meta.names.slice(0, 4).map((name, i) =>
          `<label class="zn-pattern-item">
            <input type="checkbox" name="name" value="${escapeHtml(name)}" checked />
            <span>${escapeHtml(name)}</span>
          </label>`
        ).join('');
        sections.push(`<div class="zn-pattern-group">
          <div class="zn-pattern-group-header">👤 Names</div>
          ${nameItems}
        </div>`);
      }

      // Domain section
      if (meta.domain) {
        sections.push(`<div class="zn-pattern-group">
          <div class="zn-pattern-group-header">🌐 Source</div>
          <label class="zn-pattern-item">
            <input type="checkbox" name="domain" value="${escapeHtml(meta.domain)}" checked />
            <span>${escapeHtml(meta.domain)}</span>
          </label>
        </div>`);
      }

      // Styles section
      if (meta.styles && meta.styles.length > 0) {
        const styleLabels = {
          'multi_exclaim': 'Multiple exclamation marks!!!',
          'all_caps': 'ALL CAPS text',
          'multi_question': 'Multiple question marks???'
        };
        const styleItems = meta.styles.slice(0, 3).map((style, i) =>
          `<label class="zn-pattern-item">
            <input type="checkbox" name="style" value="${style}" checked />
            <span>${styleLabels[style] || style}</span>
          </label>`
        ).join('');
        sections.push(`<div class="zn-pattern-group">
          <div class="zn-pattern-group-header">🎨 Styles</div>
          ${styleItems}
        </div>`);
      }

      // Custom tag input
      sections.push(`<div class="zn-pattern-group">
        <div class="zn-pattern-group-header">🏷️ Custom Tag (Optional)</div>
        <input type="text" class="zn-category-custom" placeholder="e.g., influencer, gossip, sports" />
        <p class="zn-hint">Add a tag to categorize this type of content</p>
      </div>`);

      return sections.join('');
    }

    function attachControls(el, meta, result) {
      let controls = el.querySelector(":scope > .zn-controls");
      if (!controls) {
        controls = document.createElement("div");
        controls.className = "zn-controls";

        const patternSelector = buildPatternSelector(meta);

        controls.innerHTML = `
          <div class="zn-controls-row">
            <button class="zn-btn" data-action="hide_more">Hide more like this</button>
            <button class="zn-btn" data-action="always_show">Always show this</button>
            <button class="zn-btn zn-undo" data-action="undo">Undo</button>
            <button class="zn-btn zn-why" data-action="why">Why?</button>
          </div>
          <div class="zn-pattern-selector" hidden>
            <div class="zn-pattern-selector-header">
              <strong>Choose patterns to learn from:</strong>
              <p class="zn-hint">Select which patterns should be used to identify similar content</p>
            </div>
            <div class="zn-pattern-list">
              ${patternSelector}
            </div>
            <div class="zn-category-actions">
              <button class="zn-btn" data-action="confirm_hide">Confirm Hide</button>
              <button class="zn-btn" data-action="cancel_hide">Cancel</button>
            </div>
          </div>
          <div class="zn-why-panel" hidden></div>
        `;
        controls.addEventListener("click", async (event) => {
          const button = event.target.closest("button[data-action]");
          if (!button) return;
          event.preventDefault();
          event.stopPropagation();
          const action = button.dataset.action;

          if (action === "why") {
            const panel = controls.querySelector(".zn-why-panel");
            panel.hidden = !panel.hidden;
            return;
          }

          if (action === "undo") {
            await undoLastFeedback(el);
            processItem(el);
            return;
          }

          if (action === "hide_more") {
            // Show pattern selector
            const selector = controls.querySelector(".zn-pattern-selector");
            const row = controls.querySelector(".zn-controls-row");
            selector.hidden = false;
            row.hidden = true;
            return;
          }

          if (action === "cancel_hide") {
            // Hide pattern selector
            const selector = controls.querySelector(".zn-pattern-selector");
            const row = controls.querySelector(".zn-controls-row");
            selector.hidden = true;
            row.hidden = false;
            return;
          }

          if (action === "confirm_hide") {
            // Collect selected patterns
            const selectedPatterns = {
              phrases: [],
              names: [],
              domains: [],
              styles: []
            };

            // Get all checked checkboxes
            const checkedPhrases = controls.querySelectorAll('input[name="phrase"]:checked');
            const checkedNames = controls.querySelectorAll('input[name="name"]:checked');
            const checkedDomains = controls.querySelectorAll('input[name="domain"]:checked');
            const checkedStyles = controls.querySelectorAll('input[name="style"]:checked');

            checkedPhrases.forEach(cb => selectedPatterns.phrases.push(cb.value));
            checkedNames.forEach(cb => selectedPatterns.names.push(cb.value));
            checkedDomains.forEach(cb => selectedPatterns.domains.push(cb.value));
            checkedStyles.forEach(cb => selectedPatterns.styles.push(cb.value));

            // Get custom tag if entered
            const customInput = controls.querySelector(".zn-category-custom");
            const customTag = customInput.value.trim();

            await learnFromIntent(el, meta, "hide_more", selectedPatterns, customTag);
            processItem(el);

            // Hide selector
            const selector = controls.querySelector(".zn-pattern-selector");
            const row = controls.querySelector(".zn-controls-row");
            selector.hidden = true;
            row.hidden = false;
            return;
          }

          if (action === "always_show") {
            await learnFromIntent(el, meta, action, null, null);
            processItem(el);
          }
        });

        if (getComputedStyle(el).position === "static") {
          el.dataset.znPositionAdjusted = "1";
          el.style.position = "relative";
        }
        el.appendChild(controls);

        const adapter = runtimeState.adapter;
        if (!adapter?.getHoverRootSelector) {
          const hoverRoot = (adapter && adapter.getHoverRoot) ? adapter.getHoverRoot(el) : el;
          const onEnter = () => el.classList.add("zn-hover");
          const onLeave = () => el.classList.remove("zn-hover");
          hoverRoot.addEventListener("mouseenter", onEnter);
          hoverRoot.addEventListener("mouseleave", onLeave);
        }
      }

      const whyPanel = controls.querySelector(".zn-why-panel");
      whyPanel.style.whiteSpace = "pre-line"; // Support multi-line text
      if (result.decision === "show" && result.score === 0) {
        whyPanel.textContent = "No filtering patterns matched this post.";
      } else {
        whyPanel.textContent = friendlyReason(result, meta);
      }
      controls.querySelector(".zn-undo").disabled = !runtimeState.itemState.get(el)?.lastFeedbackId;

      let bar = el.nextElementSibling;
      if (!bar || !bar.classList.contains("zn-hidden-bar")) {
        bar = document.createElement("div");
        bar.className = "zn-hidden-bar";
        bar.innerHTML = `
          <span>ZeroNoise hid a likely low-value item.</span>
          <button class="zn-link" data-action="undo">Undo</button>
          <button class="zn-link" data-action="why">Why?</button>
          <span class="zn-hidden-why" hidden></span>
        `;
        bar.addEventListener("click", async (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const action = target.dataset.action;
          if (action === "undo") {
            await undoLastFeedback(el);
            processItem(el);
          }
          if (action === "why") {
            const detail = bar.querySelector(".zn-hidden-why");
            detail.hidden = !detail.hidden;
          }
        });
        el.insertAdjacentElement("afterend", bar);
      }
      const hiddenWhy = bar.querySelector(".zn-hidden-why");
      hiddenWhy.style.whiteSpace = "pre-line";
      hiddenWhy.textContent = friendlyReason(result, meta);
      bar.style.display = result.decision === "hide" ? "flex" : "none";
    }

    function addToWeightedMap(map, key, delta) {
      if (!key) return;
      map[key] = Number((map[key] || 0) + delta).toFixed(2);
      map[key] = Number(map[key]);
      if (map[key] <= 0.05) {
        delete map[key];
      }
    }

    function buildLearningDelta(meta, mode, selectedPatterns, customTag) {
      const target = mode === "hide_more" ? "hide" : "show";
      const delta = {
        [`${target}Phrases`]: {},
        [`${target}Domains`]: {},
        [`${target}Names`]: {},
        [`${target}Styles`]: {},
        [`${target}Categories`]: {},
        category: customTag || null
      };

      // Only learn from patterns that were explicitly selected
      if (selectedPatterns) {
        // Add selected phrases
        for (const phrase of selectedPatterns.phrases || []) {
          delta[`${target}Phrases`][phrase] = 0.9;
        }

        // Add selected names
        for (const name of selectedPatterns.names || []) {
          delta[`${target}Names`][name] = 0.8;
        }

        // Add selected domains
        for (const domain of selectedPatterns.domains || []) {
          delta[`${target}Domains`][domain] = 1.4;
        }

        // Add selected styles
        for (const style of selectedPatterns.styles || []) {
          delta[`${target}Styles`][style] = 0.7;
        }
      } else {
        // Fallback for "always_show" - use all detected patterns
        for (const phrase of meta.phrases.slice(0, 5)) delta[`${target}Phrases`][phrase] = 0.9;
        for (const name of meta.names.slice(0, 4)) delta[`${target}Names`][name] = 0.8;
        for (const st of meta.styles.slice(0, 3)) delta[`${target}Styles`][st] = 0.7;
        if (meta.domain) delta[`${target}Domains`][meta.domain] = 1.4;
      }

      // If a custom tag is specified, add it
      if (customTag) {
        delta[`${target}Categories`][customTag] = 1.5;
      }

      return delta;
    }

    function applyDelta(delta, direction) {
      const learned = runtimeState.data.learned;
      for (const [bucket, entries] of Object.entries(delta)) {
        const map = learned[bucket];
        if (!map) continue;
        for (const [key, value] of Object.entries(entries)) {
          addToWeightedMap(map, key, value * direction);
        }
      }
    }

    async function learnFromIntent(el, meta, action, selectedPatterns, customTag) {
      const delta = buildLearningDelta(meta, action, selectedPatterns, customTag);
      applyDelta(delta, 1);

      // Update category stats if custom tag is provided
      if (customTag) {
        ensureCurrentDayStats();
        const byCategory = runtimeState.data.stats.byCategory || {};
        byCategory[customTag] = (byCategory[customTag] || 0) + 1;
        runtimeState.data.stats.byCategory = byCategory;
      }

      const feedback = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        key: meta.key,
        delta,
        category: customTag || null,
        selectedPatterns: selectedPatterns || null,
        at: Date.now()
      };
      runtimeState.data.recentFeedback.unshift(feedback);
      runtimeState.data.recentFeedback = runtimeState.data.recentFeedback.slice(0, MAX_RECENT_FEEDBACK);
      runtimeState.itemState.set(el, { ...(runtimeState.itemState.get(el) || {}), lastFeedbackId: feedback.id });
      scheduleSave();
    }

    async function undoLastFeedback(el) {
      const st = runtimeState.itemState.get(el);
      const lastFeedbackId = st?.lastFeedbackId;
      if (!lastFeedbackId) return;
      const idx = runtimeState.data.recentFeedback.findIndex((x) => x.id === lastFeedbackId);
      if (idx === -1) return;
      const [feedback] = runtimeState.data.recentFeedback.splice(idx, 1);
      applyDelta(feedback.delta, -1);
      runtimeState.itemState.set(el, { ...(st || {}), lastFeedbackId: null });
      scheduleSave();
    }

    function processItem(el) {
      if (!runtimeState.data?.settings?.enabled) {
        clearFiltering(el);
        return;
      }
      const meta = extractItemMeta(el);
      if (!meta) {
        clearFiltering(el);
        return;
      }
      const result = classify(meta);
      applyDecision(el, meta, result);
    }

    function queueProcess(root) {
      clearTimeout(runtimeState.processTimer);
      runtimeState.processTimer = setTimeout(() => {
        const container = root && root.nodeType === 1 ? root : document.body;
        processContainer(container);
      }, 120);
    }

    function queueProcessNearestItem(node) {
      if (!node) return;
      const itemSelector = runtimeState.adapter?.selector || adapterPack.ADAPTERS.generic.selector;
      if (!(node instanceof Element)) {
        queueProcess(document.body);
        return;
      }
      const candidate = node.closest(itemSelector) || node;
      queueProcess(candidate);
    }

    function processContainer(root) {
      const itemSelector = runtimeState.adapter?.selector || adapterPack.ADAPTERS.generic.selector;
      const minTextLength = runtimeState.adapter?.minTextLength || adapterPack.ADAPTERS.generic.minTextLength;
      const candidates = [];
      if (root.matches?.(itemSelector)) candidates.push(root);
      candidates.push(...root.querySelectorAll?.(itemSelector) || []);

      for (const el of candidates) {
        if (!(el instanceof HTMLElement)) continue;
        const text = (el.innerText || "").trim();
        if (text.length < minTextLength) continue;

        const textSig = hash(normalize(text.slice(0, 260)));
        const alreadyProcessed = el.dataset.nfProcessed === "1" || el.dataset.znProcessed === "1";
        const sameContent = el.dataset.nfTextSig === textSig;
        const hasControls = Boolean(el.querySelector(":scope > .zn-controls"));
        const needsProcessing = !alreadyProcessed || !sameContent || !hasControls;
        if (!needsProcessing) continue;

        el.dataset.nfProcessed = "1";
        el.dataset.nfTextSig = textSig;
        // Also mark with the public-facing processed flag used by CSS and hover handling
        el.dataset.znProcessed = "1";
        processItem(el);
      }
    }

    function watchDom() {
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "characterData") {
            queueProcessNearestItem(mutation.target.parentElement);
            continue;
          }

          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) {
              queueProcessNearestItem(node);
            } else if (node.nodeType === Node.TEXT_NODE) {
              queueProcessNearestItem(node.parentElement);
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, characterData: true, subtree: true });
    }

    function reprocessAll() {
      const nodes = document.querySelectorAll("[data-nf-processed='1'],[data-zn-processed='1']");
      for (const el of nodes) {
        if (el instanceof HTMLElement) {
          processItem(el);
        }
      }
    }

    function setupHoverDelegation() {
      function findHoveredItem(target) {
        const adapter = runtimeState.adapter;
        if (!adapter || !(target instanceof Element)) return null;

        if (adapter.getHoverRootSelector) {
          const root = target.closest(adapter.getHoverRootSelector());
          if (!root) return null;

          const closestProcessed = target.closest("[data-zn-processed='1']");
          if (closestProcessed && root.contains(closestProcessed)) {
            return closestProcessed;
          }
          if (root.matches("[data-zn-processed='1']")) return root;
          return root.querySelector("[data-zn-processed='1']");
        }

        return target.closest("[data-zn-processed='1']");
      }

      const onEnter = (e) => {
        const item = findHoveredItem(e.target);
        if (item) item.classList.add("zn-hover");
      };
      const onLeave = (e) => {
        const item = findHoveredItem(e.target);
        if (item) item.classList.remove("zn-hover");
      };
      document.documentElement.addEventListener("mouseenter", onEnter, true);
      document.documentElement.addEventListener("mouseleave", onLeave, true);
    }

    async function init() {
      runtimeState.adapter = adapterPack.detectAdapter(location.hostname);
      runtimeState.data = await getData();
      ensureCurrentDayStats();
      processContainer(document.body);
      watchDom();
      setupHoverDelegation();
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local" || !changes[DATA_KEY]) return;
        runtimeState.data = changes[DATA_KEY].newValue || runtimeState.data;
        reprocessAll();
      });
    }

    return { init };
  }

  return { createRuntime };
})();
