/**
 * ZeroNoise — generic feed adapter (fallback for unsupported sites).
 */
(function () {
  const H = window.ZeroNoiseHelpers || {};
  const getItemDomain = H.getItemDomain || (() => "");

  function extractGenericRaw(el) {
    const text = (el.innerText || "").trim();
    const heading = el.querySelector("h1,h2,h3,h4,strong,b");
    const title = heading?.textContent?.trim() || text.slice(0, 120);
    const domain = getItemDomain(el);
    return { text, title, domain, site: "generic" };
  }

  window.ZeroNoiseSites = window.ZeroNoiseSites || [];
  window.ZeroNoiseSites.push({
    key: "generic",
    selector: "article,[role='article'],.feed-item,.post,.story,li",
    minTextLength: 80,
    extractRaw: extractGenericRaw,
    patterns: []
  });
})();
