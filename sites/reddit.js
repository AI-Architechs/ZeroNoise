/**
 * ZeroNoise — Reddit adapter.
 */
(function () {
  const H = window.ZeroNoiseHelpers || {};
  const getExternalDomainFromLinks = H.getExternalDomainFromLinks || (() => "");

  function extractRedditRaw(el) {
    const titleNode = el.querySelector("h1,h2,h3,a[data-click-id='body-title']");
    const title = (titleNode?.textContent || "").trim();
    const selfText = (
      el.querySelector("[data-click-id='text'],.md,[slot='text-body']")?.textContent || ""
    ).trim();
    const subreddit = (el.querySelector("a[href*='/r/']")?.textContent || "").trim();
    const author = (el.querySelector("a[href*='/user/']")?.textContent || "").trim();
    const text = [title, selfText, subreddit, author].filter(Boolean).join(" ");
    const domain = getExternalDomainFromLinks(el, ["reddit.com", "redd.it"]) || "reddit.com";
    return { text, title: title || text.slice(0, 120), domain, site: "reddit" };
  }

  const patterns = [
    [/aita|am i the asshole|relationship_advice|offmychest/gi, 1.2, "drama-heavy subreddit pattern"],
    [/my (boyfriend|girlfriend|husband|wife)|we broke up|my ex/gi, 1.0, "personal relationship framing"]
  ];

  window.ZeroNoiseSites = window.ZeroNoiseSites || [];
  window.ZeroNoiseSites.push({
    key: "reddit",
    selector: "shreddit-post,article[data-testid='post-container'],div[data-testid='post-container']",
    minTextLength: 35,
    extractRaw: extractRedditRaw,
    patterns
  });
})();
