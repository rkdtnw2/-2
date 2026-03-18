const SHEET_ID = "1irp_D1Sd8b1CJees0iO6iIzw_92BX3v70mW4e2MCQzw";
const SOP_GID  = "655112432";

let sopData = [];
let currentChapter = "";
let currentTopic = "";

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeJs(value = "") {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n");
}

function safeText(v) {
  return v == null ? "" : String(v).trim();
}

function normalizeHeader(str = "") {
  return String(str).trim().toLowerCase().replace(/\s+/g, "");
}

function uniq(arr) {
  return [...new Set(arr)];
}

function slugify(str = "") {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^\w가-힣]+/g, "-");
}

function toArrayText(v) {
  if (!v) return [];
  return String(v)
    .split(/[,|#]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeDriveImageUrl(url = "") {
  const raw = safeText(url);
  if (!raw) return "";

  if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(raw)) return raw;

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

function mapSopRows(rows) {
  return rows.map(row => {
    const chapter = findValueByAliases(row, ["chapter", "챕터", "chaptertitle", "chaptername", "대분류"]);
    const topicTitle = findValueByAliases(row, ["topictitle", "topic", "주제", "주제명", "소분류", "title"]);
    const topicSummary = findValueByAliases(row, ["topicsummary", "summary", "내용", "설명", "content", "본문", "description"]);
    const detailText = findValueByAliases(row, ["detailtext", "slidetext", "contenttext", "text", "detail", "상세내용", "본문내용"]);
    const order = findValueByAliases(row, ["order", "순서", "번호", "no"]);
    const tags = findValueByAliases(row, ["tags", "tag", "태그", "연결태그"]);

    const imageKeys = Object.keys(row).filter(k =>
      /^image\d+$/i.test(k) ||
      /^img\d+$/i.test(k) ||
      normalizeHeader(k).startsWith("image")
    );

    const images = imageKeys.map(k => normalizeDriveImageUrl(row[k])).filter(Boolean);

    return {
      chapter,
      topicTitle,
      topicSummary,
      detailText,
      order: Number(order) || 0,
      tags: toArrayText(tags),
      images
    };
  }).filter(item => item.chapter || item.topicTitle || item.topicSummary || item.detailText);
}

function renderChapterList(data) {
  const list = document.getElementById("chapter-list");
  const chapters = uniq(data.map(item => item.chapter).filter(Boolean));

  if (!chapters.length) {
    list.innerHTML = `<div class="empty">챕터 데이터가 없습니다.</div>`;
    return;
  }

  if (!currentChapter || !chapters.includes(currentChapter)) {
    currentChapter = chapters[0];
  }

  list.innerHTML = chapters.map(ch => `
    <button class="chapter-btn ${currentChapter === ch ? "active" : ""}" onclick="selectChapter('${escapeJs(ch)}')">
      ${escapeHtml(ch)}
    </button>
  `).join("");
}

function renderTopicList(data) {
  const list = document.getElementById("topic-list");
  const topics = uniq(
    data.filter(item => item.chapter === currentChapter)
      .map(item => item.topicTitle)
      .filter(Boolean)
  );

  if (!topics.length) {
    currentTopic = "";
    list.innerHTML = `<div class="empty">주제 데이터가 없습니다.</div>`;
    return;
  }

  if (!currentTopic || !topics.includes(currentTopic)) {
    currentTopic = topics[0];
  }

  list.innerHTML = topics.map(tp => `
    <button class="topic-btn ${currentTopic === tp ? "active" : ""}" onclick="selectTopic('${escapeJs(tp)}')">
      ${escapeHtml(tp)}
    </button>
  `).join("");
}

function renderSopSlides(data) {
  const area = document.getElementById("sop-slide-area");
  const badge = document.getElementById("sop-count-badge");
  const info = document.getElementById("search-result-info");
  const keyword = safeText(document.getElementById("sop-search").value).toLowerCase();

  let filtered = [...data];

  if (keyword) {
    filtered = filtered.filter(item => {
      const joined = [
        item.chapter,
        item.topicTitle,
        item.topicSummary,
        item.detailText,
        ...(item.tags || [])
      ].join(" ").toLowerCase();
      return joined.includes(keyword);
    });

    info.textContent = filtered.length
      ? `"${keyword}" 검색 결과 ${filtered.length}개`
      : `"${keyword}" 검색 결과가 없습니다.`;
  } else {
    filtered = filtered.filter(item =>
      item.chapter === currentChapter &&
      (!currentTopic || item.topicTitle === currentTopic)
    );
    info.textContent = "";
  }

  filtered.sort((a,b) => a.order - b.order);
  badge.textContent = `${filtered.length}개 항목`;

  if (!filtered.length) {
    area.innerHTML = `<div class="empty">표시할 SOP 항목이 없습니다.</div>`;
    return;
  }

  area.innerHTML = filtered.map(item => `
    <article class="slide-card" id="topic-${slugify(item.topicTitle)}">
      <div class="slide-top">
        <div class="slide-meta">
          ${item.chapter ? `<span class="chip">${escapeHtml(item.chapter)}</span>` : ""}
          ${item.topicTitle ? `<span class="chip">${escapeHtml(item.topicTitle)}</span>` : ""}
          ${item.order ? `<span class="chip">순서 ${item.order}</span>` : ""}
        </div>

        <h3 class="slide-title">${escapeHtml(item.topicTitle || "제목 없음")}</h3>
        <p class="slide-summary">${escapeHtml(item.topicSummary || "내용이 없습니다.")}</p>

        ${item.detailText ? `
          <div class="slide-detail">${escapeHtml(item.detailText)}</div>
        ` : ""}

        ${(item.tags && item.tags.length) ? `
          <div class="tag-row">
            ${item.tags.map(tag => `
              <button class="tag-link" onclick="jumpToTopicTag('${escapeJs(tag)}')"># ${escapeHtml(tag)}</button>
            `).join("")}
          </div>
        ` : ""}
      </div>

      ${(item.images && item.images.length) ? `
        <div class="gallery">
          ${item.images.map(img => `
            <img
              src="${img}"
              alt="${escapeHtml(item.topicTitle || 'SOP 이미지')}"
              onclick="openLightbox('${img}')"
              onerror="this.style.display='none'"
            >
          `).join("")}
        </div>
      ` : ""}
    </article>
  `).join("");
}

function selectChapter(chapter) {
  currentChapter = chapter;
  currentTopic = "";
  renderSop();
}

function selectTopic(topic) {
  currentTopic = topic;
  renderSop();
}

function resetSopFilter() {
  document.getElementById("sop-search").value = "";
  currentChapter = uniq(sopData.map(v => v.chapter).filter(Boolean))[0] || "";
  currentTopic = "";
  renderSop();
}

function jumpToTopicTag(tag) {
  const matched = sopData.find(item =>
    safeText(item.topicTitle).toLowerCase() === safeText(tag).toLowerCase()
  );

  if (!matched) {
    alert("연결된 주제를 찾지 못했습니다. 태그명을 topicTitle과 동일하게 맞춰주세요.");
    return;
  }

  document.getElementById("sop-search").value = "";
  currentChapter = matched.chapter;
  currentTopic = matched.topicTitle;
  renderSop();

  setTimeout(() => {
    const target = document.getElementById(`topic-${slugify(matched.topicTitle)}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 120);
}

function renderSop() {
  renderChapterList(sopData);
  renderTopicList(sopData);
  renderSopSlides(sopData);
}

function openLightbox(src) {
  const box = document.getElementById("lightbox");
  const img = document.getElementById("lightbox-image");
  img.src = src;
  box.classList.add("show");
}

function closeLightbox(e) {
  if (e.target.id === "lightbox" || e.target.classList.contains("lightbox-close")) {
    document.getElementById("lightbox").classList.remove("show");
    document.getElementById("lightbox-image").src = "";
  }
}

async function initSopPage() {
  try {
    const rows = await fetchSheetRows(SOP_GID);
    sopData = mapSopRows(rows);

    currentChapter = uniq(sopData.map(v => v.chapter).filter(Boolean))[0] || "";
    currentTopic = "";

    renderSop();

    document.getElementById("sop-search").addEventListener("input", renderSop);
  } catch (error) {
    console.error(error);
    document.getElementById("sop-slide-area").innerHTML = `
      <div class="empty">SOP 시트를 불러오지 못했습니다.<br>시트 공유 설정과 컬럼명을 확인해주세요.</div>
    `;
  }
}

window.addEventListener("DOMContentLoaded", initSopPage);
