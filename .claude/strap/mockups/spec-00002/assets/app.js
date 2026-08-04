/* ============================================================================
   jeffgoji.com V2 — Mockup runtime (vanilla, offline-safe)
   Renders the shared shell (nav + footer) and page behaviours so the mockup is
   interactive from file://. In production these map to React-Bootstrap
   components; see the Wiring Guide in the Spec.
   ============================================================================ */

/* ---- Offline SVG placeholder (stands in for webp <img srcset>) ---- */
const PH_LIBRARY = {
  "na-headunit": "NA · New head unit"
};
function ph(label, w = 1600, h = 1000, opts = {}) {
  const text = PH_LIBRARY[label] || label || "IMAGE";
  const hue = opts.red ? "#E10600" : "#1D1D20";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>
    <rect width='100%' height='100%' fill='#0A0A0C'/>
    <rect width='100%' height='100%' fill='url(#g)' opacity='0.9'/>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='#161618'/><stop offset='1' stop-color='#050506'/>
    </linearGradient></defs>
    <g fill='${hue}'>
      <rect x='0' y='0' width='${w}' height='6'/>
      <rect x='0' y='${h - 6}' width='${w}' height='6'/>
    </g>
    <g opacity='0.14' fill='#F6F6F4'>
      ${Array.from({ length: 8 }).map((_, i) => `<rect x='${(w) - 140 + (i % 4) * 34}' y='${16 + Math.floor(i / 4) * 34}' width='34' height='34' fill='${i % 2 ? "#F6F6F4" : "#E10600"}'/>`).join("")}
    </g>
    <text x='50%' y='50%' fill='#F6F6F4' font-family='Archivo, Arial, sans-serif' font-weight='800'
      font-size='${Math.round(w / 22)}' text-anchor='middle' dominant-baseline='middle' letter-spacing='2'>${text}</text>
    <text x='50%' y='${h / 2 + w / 20}' fill='#7C7C79' font-family='Space Mono, monospace'
      font-size='${Math.round(w / 55)}' text-anchor='middle'>jeffgoji.com · V2 mockup placeholder</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

/* ---- Inline logo lockup (matches assets/logo.svg) ---- */
const LOGO_SVG = `
<svg viewBox="0 0 236 44" role="img" aria-label="JEFFGOJI — The Goji Line">
  <defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#FF1A0E"/><stop offset="1" stop-color="#B00500"/></linearGradient></defs>
  <g fill="none" stroke="url(#gr)" stroke-width="5.5" stroke-linecap="round">
    <path d="M39 11 A16 16 0 1 0 39 33"/><path d="M39 22 H27"/>
  </g>
  <circle cx="22" cy="7.5" r="3.2" fill="#F6F6F4"/>
  <text x="52" y="24" font-family="Archivo, sans-serif" font-size="21" font-weight="800" letter-spacing="0.5" fill="#F6F6F4">JEFF<tspan fill="#E10600">GOJI</tspan></text>
  <text x="53" y="38" font-family="'Space Mono', monospace" font-size="7.5" letter-spacing="3" fill="#7C7C79">THE GOJI LINE</text>
</svg>`;

/* ---- Primary nav model (source of truth = App.jsx routes) ---- */
const NAV_ITEMS = [
  { key: "home",    label: "Home",       href: "home.html" },
  { key: "garage",  label: "Car Blogs",  href: "garage.html" },
  { key: "videos",  label: "Videos",     href: "home.html#videos" },
  { key: "gallery", label: "Galleries",  href: "gallery.html" },
  { key: "whatsnew", label: "What's New", href: "whats-new.html", flag: true }
];

function renderShell(activeKey) {
  const nav = document.querySelector("[data-nav]");
  if (nav) {
    nav.innerHTML = `
      <div class="nav__inner">
        <a class="logo" href="index.html" aria-label="jeffgoji.com home">${LOGO_SVG}</a>
        <button class="nav__toggle" aria-label="Toggle menu" aria-expanded="false"><span></span></button>
        <div class="nav__links" data-navlinks>
          ${NAV_ITEMS.map(i => `<a class="nav__link ${i.flag ? "nav__link--flag" : ""} ${i.key === activeKey ? "is-active" : ""}" href="${i.href}">${i.label}</a>`).join("")}
        </div>
      </div>`;
    const toggle = nav.querySelector(".nav__toggle");
    const links = nav.querySelector("[data-navlinks]");
    toggle.addEventListener("click", () => {
      const open = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  const footer = document.querySelector("[data-footer]");
  if (footer) {
    footer.innerHTML = `
      <div class="checker-strip"></div>
      <div class="footer__inner">
        <div>
          <a class="logo" href="index.html" style="margin-bottom:1rem">${LOGO_SVG}</a>
          <p style="color:var(--text-lo);max-width:42ch;font-size:var(--fs-sm)">
            A single-driver garage log — Miata NA/MSM/ND, Corvette C8, autocross and great drives.
            Built by Jeff "Goji" Anderson-Lester.</p>
        </div>
        <div>
          <h4>Garage</h4>
          <a href="garage.html">Car Blogs</a>
          <a href="blog.html">NA6 · Miyoshi</a>
          <a href="blog.html">ND RF · Kasumi</a>
          <a href="blog.html">C8 Z51 · Panda</a>
        </div>
        <div>
          <h4>More</h4>
          <a href="gallery.html">Galleries</a>
          <a href="home.html#videos">Videos</a>
          <a href="whats-new.html">What's New</a>
          <a href="design-system.html">Design System</a>
        </div>
      </div>
      <div class="footer__bottom">© ${new Date().getFullYear()} jeffgoji.com — no cookies, no nonsense. Analytics: cookieless.</div>`;
  }
}

/* ---- Mini markdown (mirrors react-markdown + remark-gfm p/img/a renderers) ---- */
function renderMarkdown(md) {
  return md.split(/\n\n+/).map(block => {
    const imgMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const [, alt, src] = imgMatch;
      const url = /^https?:|^data:|^assets\//.test(src) ? src : ph(src, 1200, 750);
      return `<div style="text-align:center"><img src="${url}" alt="${alt}" loading="lazy"></div>`;
    }
    const withLinks = block.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return `<p>${withLinks}</p>`;
  }).join("");
}

/* ---- Blog pagination (3/page, sort by id desc — matches production) ---- */
function mountBlog(mountSel, posts, title) {
  const mount = document.querySelector(mountSel);
  const PER = 3;
  const sorted = [...posts].sort((a, b) => b.id - a.id);
  const pages = Math.max(1, Math.ceil(sorted.length / PER));
  let page = 1;

  function draw() {
    const slice = sorted.slice((page - 1) * PER, page * PER);
    mount.innerHTML = `
      <div class="section-head">
        <div class="eyebrow">Build log</div>
        <h2>${title}</h2>
      </div>
      ${slice.map(p => `
        <article class="post">
          <div class="post__media media--editorial"><img src="${p.picture || ph(p.label, 1280, 720)}" alt="${p.label}" loading="lazy"></div>
          <div class="post__body">
            <div class="spec-row post__specs">
              <span class="chip">DATE <b>${p.date}</b></span>
              <span class="chip">MILEAGE <b>${p.mileage} mi</b></span>
              <span class="chip chip--cost">COST <b>${p.cost}</b></span>
            </div>
            <div class="post__entry">${renderMarkdown(p.entry)}</div>
          </div>
        </article>`).join("")}
      <div class="pager">
        <button class="btn btn--ghost btn--sm" data-prev ${page === 1 ? "disabled" : ""}>‹ Prev</button>
        <span class="pager__count">PAGE ${page} / ${pages}</span>
        <button class="btn btn--ghost btn--sm" data-next ${page === pages ? "disabled" : ""}>Next ›</button>
      </div>`;
    mount.querySelector("[data-prev]").addEventListener("click", () => { if (page > 1) { page--; draw(); window.scrollTo({ top: 0 }); } });
    mount.querySelector("[data-next]").addEventListener("click", () => { if (page < pages) { page++; draw(); window.scrollTo({ top: 0 }); } });
  }
  draw();
}

/* ---- Gallery grid + lightbox (mirrors react-image-gallery behaviour) ---- */
function mountGallery(gridSel, items) {
  const grid = document.querySelector(gridSel);
  grid.innerHTML = items.map((it, i) =>
    `<button class="thumb media--editorial" data-i="${i}" aria-label="Open image ${i + 1}">
       <span class="thumb__idx">${String(i + 1).padStart(2, "0")}</span>
       <img src="${it.thumbnail || ph(it.label, 480, 480)}" alt="${it.thumbnailAlt || it.label}" loading="lazy">
     </button>`).join("");

  const box = document.querySelector("[data-lightbox]");
  const stage = box.querySelector(".lightbox__stage");
  const cap = box.querySelector(".lightbox__cap");
  let idx = 0;

  function show(i) {
    idx = (i + items.length) % items.length;
    const it = items[idx];
    stage.innerHTML = `<div class="media--editorial media--editorial--soft" style="position:relative;display:inline-block;line-height:0;border-radius:var(--radius);overflow:hidden"><img src="${it.original || ph(it.label, 1600, 1000)}" alt="${it.originalAlt || it.label}"></div>`;
    cap.textContent = `${String(idx + 1).padStart(2, "0")} / ${items.length}  ·  ${it.label}`;
  }
  function open(i) { show(i); box.classList.add("is-open"); document.body.style.overflow = "hidden"; }
  function close() { box.classList.remove("is-open"); document.body.style.overflow = ""; }

  grid.querySelectorAll(".thumb").forEach(t => t.addEventListener("click", () => open(+t.dataset.i)));
  box.querySelector("[data-close]").addEventListener("click", close);
  box.querySelector("[data-prev]").addEventListener("click", () => show(idx - 1));
  box.querySelector("[data-next]").addEventListener("click", () => show(idx + 1));
  box.addEventListener("click", e => { if (e.target === box) close(); });
  document.addEventListener("keydown", e => {
    if (!box.classList.contains("is-open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(idx - 1);
    if (e.key === "ArrowRight") show(idx + 1);
  });
}

window.GOJI = { ph, renderShell, renderMarkdown, mountBlog, mountGallery };
