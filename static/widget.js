(async function () {
  const esc = (s) => String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Support multiple widgets on the same page
  const mounts = Array.from(document.querySelectorAll(".vimeo-latest"));
  if (!mounts.length) return;

  async function renderOne(mount) {
    const rawUser = (mount.dataset.user || "").trim();
    const limit = Math.max(1, Math.min(12, parseInt(mount.dataset.limit || "6", 10)));
    const cols = Math.max(1, Math.min(4, parseInt(mount.dataset.cols || "2", 10)));

    if (!rawUser) {
      mount.innerHTML = `<div class="vwError">Missing data-user.</div>`;
      return;
    }

    mount.style.setProperty("--cols", cols);
    mount.innerHTML = `<div class="vwShell"><div class="vwLoading">Loading…</div></div>`;

    try {
      const api = `${location.origin}/api/vimeo?user=${encodeURIComponent(rawUser)}&limit=${encodeURIComponent(limit)}`;
      const res = await fetch(api);
      const data = await res.json();

      if (!res.ok) {
        mount.innerHTML = `<div class="vwShell"><div class="vwError">
          <b>Error:</b> ${esc(data.error || "Unable to load feed")}<br/>
          <small>${esc(data.hint || "")}</small>
        </div></div>`;
        return;
      }

      const items = data.items || [];
      const channelName = items[0]?.user_name || data.user;
      const channelUrl = items[0]?.user_url || `https://vimeo.com/${encodeURIComponent(data.user)}`;
      const avatar = items[0]?.user_portrait || "";

      const cards = items.map(v => {
        const title = esc(v.title);
        const thumb = v.thumbnail
          ? `<img src="${v.thumbnail}" alt="${title}" loading="lazy">`
          : `<div class="vwThumbFallback">No thumbnail</div>`;

        return `
          <a class="vwCard" href="${v.url}" target="_blank" rel="noopener">
            <div class="vwThumb">${thumb}</div>
            <div class="vwTitle">${title}</div>
          </a>
        `;
      }).join("");

      mount.innerHTML = `
        <div class="vwShell">
          <div class="vwTop">
            <div class="vwProfile">
              ${avatar ? `<img class="vwAvatar" src="${avatar}" alt="" />` : `<div class="vwAvatar vwAvatarFallback"></div>`}
              <div class="vwMeta">
                <div class="vwName">${esc(channelName)}</div>
                <a class="vwLink" href="${channelUrl}" target="_blank" rel="noopener">View on Vimeo</a>
              </div>
            </div>
          </div>
          <div class="vwGrid">${cards}</div>
        </div>
      `;
    } catch (e) {
      mount.innerHTML = `<div class="vwShell"><div class="vwError"><b>Error:</b> ${esc(String(e))}</div></div>`;
    }
  }

  for (const m of mounts) {
    renderOne(m);
  }
})();
