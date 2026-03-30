/**
 * layout.js
 * Injects the shared site header, nav, and footer into every page.
 * Call Layout.init() at the top of each page script.
 */

const Layout = (() => {

  const NAV_LINKS = [
    { href: "/index.html",            label: "Home" },
    { href: "/pages/notices.html",    label: "Notices" },
    { href: "/pages/events.html",     label: "Events" },
    { href: "/pages/calendar.html",   label: "Calendar" },
    { href: "/pages/projects.html",   label: "Projects" },
    { href: "/pages/minutes.html",    label: "Minutes" },
    { href: "/pages/community.html",  label: "Community" },
  ];

  function init() {
    _injectHeader();
    _injectFooter();
    _markActive();
  }

  function _injectHeader() {
    const el = document.getElementById("site-header");
    if (!el) return;
    const navHtml = NAV_LINKS.map(l =>
      `<a href="${l.href}">${l.label}</a>`
    ).join("");

    el.innerHTML = `
      <div class="header-inner">
        <div class="site-title">
          🔥 <span>${CONFIG.SITE.HALL_NAME}</span>
        </div>
        <nav>${navHtml}</nav>
      </div>
    `;
  }

  function _injectFooter() {
    const el = document.getElementById("site-footer");
    if (!el) return;
    el.innerHTML = `
      <div class="container">
        ${CONFIG.SITE.HALL_NAME} &nbsp;·&nbsp;
        ${CONFIG.SITE.ADDRESS} &nbsp;·&nbsp;
        <a href="tel:${CONFIG.SITE.PHONE}">${CONFIG.SITE.PHONE}</a> &nbsp;·&nbsp;
        <a href="mailto:${CONFIG.SITE.EMAIL}">${CONFIG.SITE.EMAIL}</a>
      </div>
    `;
  }

  function _markActive() {
    const path = window.location.pathname;
    document.querySelectorAll("#site-header nav a").forEach(a => {
      const href = a.getAttribute("href");
      const match = (href === "/index.html" || href === "/")
        ? (path === "/" || path.endsWith("index.html"))
        : path.includes(href.replace("/pages/", "").replace(".html", ""));
      if (match) a.classList.add("active");
    });
  }

  return { init };
})();
