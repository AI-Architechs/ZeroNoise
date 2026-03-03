/**
 * ZeroNoise — YouTube adapter.
 */
(function () {
  function extractYouTubeRaw(el) {
    const title = (
      el.querySelector("#video-title,#video-title-link,#title-wrapper h3,#title")?.textContent || ""
    ).trim();
    const channel = (
      el.querySelector("#channel-name a,ytd-channel-name a,#text-container #text")?.textContent || ""
    ).trim();
    const metaLine = (el.querySelector("#metadata-line,#metadata")?.textContent || "").trim();
    const text = [title, channel, metaLine].filter(Boolean).join(" ");
    return { text, title: title || text.slice(0, 120), domain: "youtube.com", site: "youtube" };
  }

  const patterns = [
    [/\b(apology|response|exposed|drama|beef|breakup|tea)\b/gi, 1.3, "creator-drama pattern"],
    [/\b(the truth|what really happened|shocking)\b/gi, 1.1, "clickbait framing"]
  ];

  window.ZeroNoiseSites = window.ZeroNoiseSites || [];
  window.ZeroNoiseSites.push({
    key: "youtube",
    selector: "ytd-rich-item-renderer,ytd-video-renderer,ytd-grid-video-renderer,ytd-compact-video-renderer,ytd-playlist-video-renderer",
    minTextLength: 20,
    extractRaw: extractYouTubeRaw,
    patterns
  });
})();
