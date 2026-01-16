(async function () {
  const script = document.currentScript;
  if (!script) return;

  const url = new URL(script.src);

  const user = (url.searchParams.get("user") || "").trim();
  const limit = Math.max(1, Math.min(16, parseInt(url.searchParams.get("limit") || "6", 10)));
  const cols = Math.max(1, Math.min(4, parseInt(url.searchParams.get("cols") || "3", 10)));

  const mount = document.querySelector(".vimeo-latest-widget");
  if (!mount) return;

  if (!user) {
    mount.innerHTML = `<div style="padding:12px;border:1px solid #ddd;border-radius:10px;">Missing Vimeo username/profile URL.</div>`;
    return;
  }

  mount.style.setProperty("--cols", cols);

  const esc = (s) => String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  try {
    const api = `${url.origin}/api/vimeo?user=${encodeURIComponent(user)}&limit=${encodeURIComponent(limit)}`;
    const res = await fetch(api);
    const data = await res.json();

    if (!res.ok) {
      mount.innerHTML = `<div style="padding:12px;border:1px solid #ddd;border-radius:10px;">
        <b>Error:</b> ${esc(data.error || "Unable to load feed")}<br/>
        <small>${esc(data.hint || "")}</small>
      </div>`;
      return;
    }

    const items = data.items || [];

    const cards = items.map(v => {
      const title = esc(v.title);
      const thumbHtml = v.thumbnail
        ? `<img src="${v.thumbnail}" alt="${title}" loading="lazy">`
        : `<div class="thumb-fallback">No thumbnail</div>`;

      return `
        <a class="vw-card" href="${v.url}" target="_blank" rel="noopener">
          <div class="vw-thumb">${thumbHtml}</div>
          <div class="vw-title">${title}</div>
        </a>
      `;
    }).join("");

    mount.innerHTML = `
      <div class="vw-wrap">
        <div class="vw-top">
          <div class="vw-head">Vimeo · @${esc(data.user)}</div>
          <a class="vw-more" href="https://vimeo.com/${encodeURIComponent(data.user)}" target="_blank" rel="noopener">View profile</a>
        </div>
        <div class="vw-grid">${cards}</div>
      </div>
    `;
  } catch (e) {
    mount.innerHTML = `<div style="padding:12px;border:1px solid #ddd;border-radius:10px;">
      <b>Error:</b> ${esc(String(e))}
    </div>`;
  }
})();
