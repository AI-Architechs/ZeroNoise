/**
 * Shared helpers for ZeroNoise site adapters. Loaded first so site scripts can use them.
 */
window.ZeroNoiseHelpers = (() => {
  function getExternalDomainFromLinks(el, blocklist = []) {
    const links = el.querySelectorAll("a[href^='http']");
    for (const link of links) {
      try {
        const host = new URL(link.href).hostname.toLowerCase().replace(/^www\./, "");
        const isBlocked = blocklist.some((x) => host === x || host.endsWith(`.${x}`));
        if (!isBlocked) return host;
      } catch {
        // ignore malformed URLs
      }
    }
    return "";
  }

  function getItemDomain(el) {
    const link = el.querySelector("a[href^='http']");
    if (!link) return "";
    try {
      const host = new URL(link.href).hostname.toLowerCase();
      return host.startsWith("www.") ? host.slice(4) : host;
    } catch {
      return "";
    }
  }

  return { getExternalDomainFromLinks, getItemDomain };
})();
