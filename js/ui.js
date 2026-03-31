/**
 * ui.js
 * Shared rendering helpers — cards, file lists, error/loading states.
 */

const UI = (() => {

  // ─── Loading / Error states ───────────────────────────────────────────────

  function showLoading(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="loading"><span class="spinner"></span> Loading…</div>`;
  }

  function showError(containerId, message) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="error-msg">⚠️ ${message}</div>`;
  }

  function showEmpty(containerId, message = "Nothing to display at this time.") {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = `<div class="empty-msg">${message}</div>`;
  }

  // ─── Content cards ────────────────────────────────────────────────────────

  /**
   * Render a list of sheet rows as content cards.
   * Expected columns: title, body, author, start_date, category (all optional except title)
   */
  function renderCards(containerId, rows, options = {}) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!rows.length) { showEmpty(containerId, options.emptyMessage); return; }

    el.innerHTML = rows.map(row => `
      <article class="card ${options.cardClass || ''}">
        ${row.category ? `<span class="badge">${row.category}</span>` : ""}
        <h3 class="card-title">${escHtml(row.title || "Untitled")}</h3>
        ${row.body ? `<div class="card-body">${formatBody(row.body)}</div>` : ""}
        <footer class="card-meta">
          ${!options.hideAuthor  && row.author    ? `<span>${escHtml(row.author)}</span>` : ""}
          ${row.start_date? `<span>${formatDate(row.start_date)}</span>` : ""}
          ${!options.hideExpires && row.end_date  ? `<span class="expires">Expires ${formatDate(row.end_date)}</span>` : ""}
        </footer>
      </article>
    `).join("");
  }

  // ─── Drive file list ──────────────────────────────────────────────────────

  /**
   * Render a Google Drive file listing into a container.
   */
  function renderFileList(containerId, files) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!files.length) { showEmpty(containerId, "No documents uploaded yet."); return; }

    el.innerHTML = `<ul class="file-list">` + files.map(f => `
      <li class="file-item">
        <span class="file-icon">${GoogleAPI.mimeIcon(f.mimeType)}</span>
        <a class="file-name" href="${f.webViewLink}" target="_blank" rel="noopener">${escHtml(f.name)}</a>
        <span class="file-meta">
          ${f.size ? GoogleAPI.formatSize(f.size) : ""}
          &nbsp;·&nbsp;
          ${f.createdTime ? formatDate(f.createdTime.substring(0, 10)) : ""}
        </span>
      </li>
    `).join("") + `</ul>`;
  }

  // ─── Events table ─────────────────────────────────────────────────────────

  /**
   * Render Calendar API events as a table showing date, time, and title.
   */
  function renderEventsTable(containerId, events) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!events.length) { showEmpty(containerId, "No upcoming events."); return; }

    // Group events by date
    const groups = {};
    const dateKeys = [];
    events.forEach(ev => {
      const isAllDay = !!ev.start.date;
      const startDt  = isAllDay ? new Date(ev.start.date + "T00:00:00") : new Date(ev.start.dateTime);
      const endDt    = isAllDay ? null : new Date(ev.end.dateTime);
      const dateKey  = startDt.toLocaleDateString("en-CA", { weekday: "short", year: "numeric", month: "long", day: "numeric" });
      const timeStr  = isAllDay ? "All day" : `${_fmtTime(startDt)} – ${_fmtTime(endDt)}`;
      if (!groups[dateKey]) { groups[dateKey] = []; dateKeys.push(dateKey); }
      groups[dateKey].push({ timeStr, title: ev.summary || "Untitled" });
    });

    const rows = dateKeys.map(date => {
      const eventsForDay = groups[date];
      return eventsForDay.map((ev, i) => `<tr>
        ${i === 0 ? `<td class="ev-date" rowspan="${eventsForDay.length}">${date}</td>` : ""}
        <td class="ev-time">${ev.timeStr}</td>
        <td class="ev-title">${escHtml(ev.title)}</td>
      </tr>`).join("");
    }).join("");

    el.innerHTML = `<table class="events-table">
      <thead><tr><th>Date</th><th>Time</th><th>Event</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function _fmtTime(dt) {
    return dt.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
  }

  // ─── Google Calendar embed ────────────────────────────────────────────────

  /**
   * Inject a Google Calendar embed iframe.
   * mode: "MONTH" | "WEEK" | "AGENDA"
   */
  function renderCalendar(containerId, calendarId, mode = "MONTH") {
    const el = document.getElementById(containerId);
    if (!el) return;
    const src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calendarId)}&ctz=America%2FHalifax&mode=${mode}&showTitle=0&showNav=1&showDate=1&showPrint=0&showTabs=0&showCalendars=0`;
    el.innerHTML = `<iframe src="${src}" style="border:0;width:100%;height:600px;" frameborder="0" scrolling="no" allowfullscreen></iframe>`;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // Convert newlines to <br> and auto-link URLs
  function formatBody(text) {
    return escHtml(text)
      .replace(/\n/g, "<br>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00"); // force local time
    return d.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  }

  // ─── Dynamic config ───────────────────────────────────────────────────────

  /**
   * Apply values from the Config sheet to the page header and footer.
   */
  function applyConfig(cfg) {
    const phone = document.getElementById("footer-phone");
    const email = document.getElementById("footer-email");
    if (phone && cfg.Phone) {
      phone.href = "tel:" + cfg.Phone.replace(/\D/g, "");
      phone.textContent = cfg.Phone;
    }
    if (email && cfg.Email) {
      email.href = "mailto:" + cfg.Email;
      email.textContent = cfg.Email;
    }
    const hero = document.querySelector(".hero");
    if (hero) {
      const heroText = hero.querySelector(".hero-text");
      if (cfg.Header_Left_Image) {
        const img = document.createElement("img");
        img.src = _driveImgUrl(cfg.Header_Left_Image);
        img.className = "hero-img";
        img.alt = "";
        hero.insertBefore(img, heroText);
      }
      if (cfg.Header_Right_Image) {
        const img = document.createElement("img");
        img.src = _driveImgUrl(cfg.Header_Right_Image);
        img.className = "hero-img";
        img.alt = "";
        hero.appendChild(img);
      }
    }
  }

  // Convert any Google Drive sharing/view URL to the embeddable thumbnail URL
  function _driveImgUrl(url) {
    const match = url.match(/(?:[?&]id=|\/d\/)([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w300`;
    return url;
  }

  return { showLoading, showError, showEmpty, renderCards, renderEventsTable, renderFileList, renderCalendar, applyConfig, escHtml, formatDate };
})();
