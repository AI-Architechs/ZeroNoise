/**
 * ZeroNoise — composes adapters from site modules and exposes detection.
 * Depends on: lib/helpers.js, then sites/generic.js, sites/reddit.js, sites/x.js, sites/youtube.js
 */
window.ZeroNoiseAdapters = (() => {
  const sites = window.ZeroNoiseSites || [];
  const SITE_PATTERNS = {};
  const ADAPTERS = {};

  for (const site of sites) {
    const key = site.key;
    SITE_PATTERNS[key] = site.patterns || [];
    ADAPTERS[key] = {
      key,
      selector: site.selector,
      minTextLength: site.minTextLength,
      extractRaw: site.extractRaw,
      getHoverRoot: site.getHoverRoot || null,
      getHoverRootSelector: site.getHoverRootSelector || null
    };
  }
  if (!ADAPTERS.generic) {
    const H = window.ZeroNoiseHelpers || {};
    const getItemDomain = H.getItemDomain || (() => "");
    ADAPTERS.generic = {
      key: "generic",
      selector: "article,[role='article'],.feed-item,.post,.story,li",
      minTextLength: 80,
      extractRaw: (el) => {
        const text = (el.innerText || "").trim();
        const heading = el.querySelector("h1,h2,h3,h4,strong,b");
        const title = heading?.textContent?.trim() || text.slice(0, 120);
        return { text, title: title || text.slice(0, 120), domain: getItemDomain(el), site: "generic" };
      },
      getHoverRoot: null
    };
    SITE_PATTERNS.generic = [];
  }

  function detectAdapter(hostname) {
    const host = (hostname || "").toLowerCase().replace(/^www\./, "");
    if (host === "reddit.com" || host.endsWith(".reddit.com")) return ADAPTERS.reddit || ADAPTERS.generic;
    if (host === "x.com" || host.endsWith(".x.com") || host === "twitter.com" || host.endsWith(".twitter.com")) {
      return ADAPTERS.x || ADAPTERS.generic;
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") {
      return ADAPTERS.youtube || ADAPTERS.generic;
    }
    return ADAPTERS.generic;
  }

  return {
    SITE_PATTERNS,
    ADAPTERS,
    detectAdapter
  };
})();
