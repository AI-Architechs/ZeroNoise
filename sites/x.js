/**
 * ZeroNoise — X (Twitter) adapter.
 * Uses a hover root so the whole tweet cell shows controls on hover, not just the article.
 */
(function () {
  const H = window.ZeroNoiseHelpers || {};
  const getExternalDomainFromLinks = H.getExternalDomainFromLinks || (() => "");

  function extractXRaw(el) {
    const textNode = el.querySelector("[data-testid='tweetText']");
    let text = (textNode?.innerText || "").trim();
    if (!text) {
      const langText = Array.from(el.querySelectorAll("div[lang]"))
        .map((node) => node.innerText.trim())
        .filter(Boolean)
        .join(" ");
      text = langText.trim();
    }
    if (!text) {
      text = (el.innerText || "").trim();
    }

    const author = (
      el.querySelector("[data-testid='User-Name']")?.innerText ||
      el.querySelector("a[href^='/'][role='link'] span")?.innerText ||
      ""
    ).trim();

    const textWithAuthor = [author, text].filter(Boolean).join(" ");
    const domain = getExternalDomainFromLinks(el, ["x.com", "twitter.com", "t.co"]) || "x.com";
    return {
      text: textWithAuthor,
      title: text.slice(0, 120) || author,
      domain,
      site: "x"
    };
  }

  /** Whole tweet cell so hover anywhere on the card shows controls. */
  function getHoverRoot(el) {
    return el.closest("div[data-testid='cellInnerDiv']") || el;
  }

  /** Selector for event delegation: hover works even when X recycles DOM nodes. */
  function getHoverRootSelector() {
    return "div[data-testid='cellInnerDiv']";
  }

  const patterns = [
    [/\binternet is in shambles\b|\beveryone is saying\b|\bthis aged badly\b/gi, 1.2, "reaction-bait phrasing"],
    [/\b(stans|stan twitter|ratioed)\b/gi, 1.0, "social reaction language"]
  ];

  window.ZeroNoiseSites = window.ZeroNoiseSites || [];
  window.ZeroNoiseSites.push({
    key: "x",
    selector: "article[data-testid='tweet'],div[data-testid='cellInnerDiv'] article[role='article']",
    minTextLength: 35,
    extractRaw: extractXRaw,
    getHoverRoot,
    getHoverRootSelector,
    patterns
  });
})();
