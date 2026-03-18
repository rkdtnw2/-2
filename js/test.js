let dynamicAnswerKey = {};

function findValueByAliases(row, aliases = []) {
  const entries = Object.entries(row);
  for (const alias of aliases) {
    const found = entries.find(([k]) => normalizeHeader(k) === normalizeHeader(alias));
    if (found) return safeText(found[1]);
  }
  return "";
}

function mapTestRows(rows) {
  return rows.map((row, idx) => {
    const order = findValueByAliases(row, ["order", "순서", "번호", "no"]);
    const title = findValueByAliases(row, ["title", "question", "문항", "문제"]);
    const choice1 = findValueByAliases(row, ["choice1", "보기1", "선택1"]);
    const choice2 = findValueByAliases(row, ["choice2", "보기2", "선택2"]);
    const choice3 = findValueByAliases(row, ["choice3", "보기3", "선택3"]);
    const choice4 = findValueByAliases(row, ["choice4", "보기4", "선택4"]);
    const answer = findValueByAliases(row, ["answer", "정답"]);
    const explanation = findValueByAliases(row, ["explanation", "해설", "설명"]);

    return {
      order: Number(order) || idx + 1,
      title,
      choice1,
      choice2,
      choice3,
      choice4,
      answer: String(answer).trim(),
      explanation
    };
  }).filter(item => item.title);
}

function renderTest(data) {
  const area = document.getElementById("test-question-area");
  const badge = document.getElementById("test-count-badge");
  if (!area || !badge) return;

  badge.textContent = `${data.length}문항`;

  if (!data.length) {
    area.innerHTML = `<div class="empty">등록된 테스트 문항이 없습니다.</div>`;
    return;
  }

  const sorted = [...data].sort((a,b) => a.order - b.order);
  dynamicAnswerKey = {};

  area.innerHTML = sorted.map((q, index) => {
    const no = index + 1;
    dynamicAnswerKey[`q${no}`] = {
      answer: q.answer,
      explanation: q.explanation,
      title: q.title
    };

    const choices = [q.choice1, q.choice2, q.choice3, q.choice4].filter(Boolean);

    return `
      <div class="question">
        <h4>${no}. ${escapeHtml(q.title)}</h4>
        <div class="options">
          ${choices.map((choice, i) => `
            <label class="option">
              <input type="radio" name="q${no}" value="${i + 1}">
              <span>${escapeHtml(choice)}</span>
            </label>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  document.getElementById("test-result-box").style.display = "none";
}

function submitTest() {
  const total = Object.keys(dynamicAnswerKey).length;
  if (!total) return;

  let correct = 0;
  const wrongList = [];

  for (let i = 1; i <= total; i++) {
    const selected = document.querySelector(`input[name="q${i}"]:checked`);
    const picked = selected ? selected.value : "";
    const answer = dynamicAnswerKey[`q${i}`]?.answer || "";

    if (String(picked) === String(answer)) {
      correct++;
    } else {
      wrongList.push({
        no: i,
        title: dynamicAnswerKey[`q${i}`]?.title || "",
        answer,
        explanation: dynamicAnswerKey[`q${i}`]?.explanation || "해설 없음"
      });
    }
  }

  const score = Math.round((correct / total) * 100);
  const resultBox = document.getElementById("test-result-box");
  const titleEl = document.getElementById("test-result-title");
  const descEl = document.getElementById("test-result-desc");

  titleEl.textContent = `결과: ${correct} / ${total} 정답 (${score}점)`;

  if (!wrongList.length) {
    descEl.textContent = "전부 정답입니다. 아주 좋습니다.";
  } else {
    descEl.textContent =
      "오답 문항\n\n" +
      wrongList.map(item =>
        `${item.no}번. ${item.title}\n정답: ${item.answer}번\n해설: ${item.explanation}`
      ).join("\n\n");
  }

  resultBox.style.display = "block";
  resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetTest() {
  document.querySelectorAll('#test-question-area input[type="radio"]').forEach(input => {
    input.checked = false;
  });
  document.getElementById("test-result-box").style.display = "none";
}

async function initTest() {
  try {
    const rows = await fetchSheetRows(TEST_GID);
    testData = mapTestRows(rows);
    renderTest(testData);
  } catch (error) {
    console.error(error);
    const area = document.getElementById("test-question-area");
    if (area) {
      area.innerHTML = `<div class="empty">테스트 시트를 불러오지 못했습니다.</div>`;
    }
  }
}

window.addEventListener("DOMContentLoaded", initTest);
