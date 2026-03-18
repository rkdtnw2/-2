const SHEET_ID = "1irp_D1Sd8b1CJees0iO6iIzw_92BX3v70mW4e2MCQzw";
const EDU_GID  = "153482899";
const TEST_GID = "790084243";

let eduData = [];
let testData = [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeHeader(str = "") {
  return String(str).trim().toLowerCase().replace(/\s+/g, "");
}

function safeText(v) {
  return v == null ? "" : String(v).trim();
}

function normalizeDriveImageUrl(url = "") {
  const raw = safeText(url);
  if (!raw) return "";

  if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(raw)) {
    return raw;
  }

  if (raw.includes("drive.google.com")) {
    const fileMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) return `https://drive.google.com/thumbnail?id=${fileMatch[1]}&sz=w2000`;

    const openMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch?.[1]) return `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w2000`;

    const ucMatch = raw.match(/uc\?export=(?:view|download)&id=([a-zA-Z0-9_-]+)/);
    if (ucMatch?.[1]) return `https://drive.google.com/thumbnail?id=${ucMatch[1]}&sz=w2000`;
  }

  return raw;
}

function gvizUrl(gid) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${gid}&tqx=out:json`;
}

async function fetchSheetRows(gid) {
  const res = await fetch(gvizUrl(gid));
  const text = await res.text();

  const jsonText = text
    .replace(/^\/\*O_o\*\/\s*google\.visualization\.Query\.setResponse\(/, "")
    .replace(/\);\s*$/, "");

  const json = JSON.parse(jsonText);
  const table = json.table;
  const cols = table.cols.map(c => safeText(c.label || c.id));
  const rows = table.rows || [];

  return rows.map(row => {
    const obj = {};
    cols.forEach((col, i) => {
      const cell = row.c?.[i];
      obj[col] = cell?.f ?? cell?.v ?? "";
    });
    return obj;
  });
}

function findValueByAliases(row, aliases = []) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const found = entries.find(([k]) => normalizeHeader(k) === normalizeHeader(alias));
    if (found) return safeText(found[1]);
  }
  return "";
}

function openLightbox(src) {
  const box = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-image");
  if (!box || !img) return;
  img.src = src;
  box.classList.add("show");
}

function closeLightbox(e) {
  if (e.target.id === "lightbox" || e.target.classList.contains("lightbox-close")) {
    document.getElementById("lightbox").classList.remove("show");
    document.getElementById("lightbox-image").src = "";
  }
}

function setMainView(view) {
  const home = document.getElementById("home-view");
  const edu = document.getElementById("edu-view");
  const test = document.getElementById("test-view");

  home.classList.add("hidden-view");
  edu.classList.add("hidden-view");
  test.classList.add("hidden-view");

  document.getElementById("nav-home")?.classList.remove("active");
  document.getElementById("nav-edu")?.classList.remove("active");
  document.getElementById("nav-test")?.classList.remove("active");

  if (view === "edu") {
    edu.classList.remove("hidden-view");
    document.getElementById("nav-edu")?.classList.add("active");
    history.replaceState(null, "", "#edu");
  } else if (view === "test") {
    test.classList.remove("hidden-view");
    document.getElementById("nav-test")?.classList.add("active");
    history.replaceState(null, "", "#test");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setHomeView() {
  document.getElementById("home-view").classList.remove("hidden-view");
  document.getElementById("edu-view").classList.add("hidden-view");
  document.getElementById("test-view").classList.add("hidden-view");

  document.getElementById("nav-home")?.classList.add("active");
  document.getElementById("nav-edu")?.classList.remove("active");
  document.getElementById("nav-test")?.classList.remove("active");

  history.replaceState(null, "", "index.html");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function mapEduRows(rows) {
  return rows.map(row => {
    const category = findValueByAliases(row, ["category", "카테고리", "분류", "group"]);
    const title = findValueByAliases(row, ["title", "상품명", "제목", "name"]);
    const description = findValueByAliases(row, ["description", "summary", "설명", "내용", "desc"]);
    const point1 = findValueByAliases(row, ["point1", "포인트1", "핵심1"]);
    const point2 = findValueByAliases(row, ["point2", "포인트2", "핵심2"]);
    const point3 = findValueByAliases(row, ["point3", "포인트3", "핵심3"]);
    const point4 = findValueByAliases(row, ["point4", "포인트4", "핵심4"]);

    const imageKeys = Object.keys(row).filter(k => /^image\d+$/i.test(k) || /^img\d+$/i.test(k) || normalizeHeader(k).startsWith("image"));
    const images = imageKeys.map(k => normalizeDriveImageUrl(row[k])).filter(Boolean);

    return {
      category,
      title,
      description,
      points: [point1, point2, point3, point4].filter(Boolean),
      images
    };
  }).filter(item => item.category || item.title || item.description);
}

function renderEdu(data) {
  const area = document.getElementById("edu-content-area");
  const badge = document.getElementById("edu-count-badge");
  if (!area || !badge) return;

  badge.textContent = `${data.length}개 항목`;

  if (!data.length) {
    area.innerHTML = `<div class="empty">등록된 상품자료가 없습니다.</div>`;
    return;
  }

  area.innerHTML = data.map(item => `
    <article class="edu-card">
      ${item.images[0] ? `
        <img
          class="edu-thumb"
          src="${item.images[0]}"
          alt="${escapeHtml(item.title || '상품자료 이미지')}"
          onclick="openLightbox('${item.images[0]}')"
          onerror="this.outerHTML='<div class=&quot;edu-thumb&quot; style=&quot;display:grid;place-items:center;color:#94a5c8;font-weight:700;&quot;>이미지 없음</div>'"
        >
      ` : `
        <div class="edu-thumb" style="display:grid;place-items:center;color:#94a5c8;font-weight:700;">이미지 없음</div>
      `}

      <div class="edu-body">
        ${item.category ? `<div class="edu-cat">${escapeHtml(item.category)}</div>` : ""}
        <h3 class="edu-title">${escapeHtml(item.title || "제목 없음")}</h3>
        <p class="edu-desc">${escapeHtml(item.description || "설명이 없습니다.")}</p>

        ${item.points.length ? `
          <ul class="point-list">
            ${item.points.map(point => `<li>${escapeHtml(point)}</li>`).join("")}
          </ul>
        ` : ""}
      </div>
    </article>
  `).join("");
}

async function initMainPage() {
  try {
    const eduRows = await fetchSheetRows(EDU_GID);
    eduData = mapEduRows(eduRows);
    renderEdu(eduData);

    const hash = location.hash.replace("#", "");
    if (hash === "edu") {
      setMainView("edu");
    } else if (hash === "test") {
      setMainView("test");
    } else {
      setHomeView();
    }
  } catch (error) {
    console.error(error);
    const area = document.getElementById("edu-content-area");
    if (area) {
      area.innerHTML = `<div class="empty">상품자료 시트를 불러오지 못했습니다.</div>`;
    }
  }
}

window.addEventListener("DOMContentLoaded", initMainPage);
function syncHeaderHeight() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;
  const h = topbar.offsetHeight;
  document.documentElement.style.setProperty("--header-height", `${h}px`);
}

window.addEventListener("load", syncHeaderHeight);
window.addEventListener("resize", syncHeaderHeight);
window.addEventListener("DOMContentLoaded", syncHeaderHeight);