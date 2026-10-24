const STATS = {
  "단도":   { hp: 1500, mp: 2000 },
  "협차":   { hp: 2000, mp: 2000 },
  "타도":   { hp: 2500, mp: 2000 },
  "태도":   { hp: 3000, mp: 2500 },
  "대태도": { hp: 4000, mp: 2000 },
  "창":     { hp: 3500, mp: 2500 },
  "치도":   { hp: 3000, mp: 3000 },
  "츠루기": { hp: 2500, mp: 4000 }
};

/* 카테고리별 소질 목록 */
const QUALITY_CATEGORIES = [
  {
    name: "성격",
    items: [
      [10, "소심함"], [11, "반항적"], [12, "기개"], [13, "솔직"],
      [14, "의젓함"], [15, "프라이드높음"], [16, "거만함"], [17, "프라이드낮음"],
      [20, "자제심"], [21, "충동적"], [22, "무관심"], [23, "호기심"],
      [24, "감정부족"], [25, "감정풍부"], [26, "낙관적"], [27, "비관적"],
      [28, "일선넘지않음"], [29, "눈에띄고싶어함"], [30, "정조관념"], [31, "정조관둔감"],
      [32, "억압"], [33, "해방"], [34, "수줍음"], [35, "수치심없음"],
      [36, "호색"], [37, "순진무구"], [38, "독설"], [39, "예의바름"],
      [44, "멘탈약함"], [45, "멘탈강함"], [46, "능청스러움"], [47, "도발에약함"],
      [48, "장난꾸러기"], [49, "자기혐오"], [63, "헌신적"], [65, "수동적"],
      [66, "노력파"], [67, "집요함"], [68, "느긋함"], [69, "쾌활함"],
      [80, "도착적"], [83, "새디스트"], [84, "신중"], [85, "성마름"],
      [86, "짓궂음"], [87, "상냥함"], [89, "광기"], [90, "카리스마"],
      [92, "친화력"], [93, "다가가기어려움"]
    ]
  },
  {
    name: "체질",
    items: [
      [40, "고통에 약함"], [41, "고통에 강함"], [42, "젖기 쉬움"], [43, "젖기 어려움"],
      [60, "자위하기 쉬움"], [61, "악취둔감"], [62, "악취민감"], [70, "쾌감에 솔직"],
      [71, "쾌감을 부정"], [77, "도Ｍ"], [113, "회복느림"], [123, "조루"], [124, "지루"],
      [125, "절륜"], [126, "정력박약"]
    ]
  },
  {
    name: "기술",
    items: [
      [50, "습득빠름"], [51, "습득느림"],
      [52, "혀놀림"], [53, "바늘다룸"], [54, "고양이혀"], [55, "조제지식"],
      [56, "약독내성"], [57, "손재주"], [58, "결박고수"], [59, "도구사용"]
    ]
  },
  {
    name: "가사",
    items: [
      [94, "요리못함"], [95, "요리잘함"], [96, "청소못함"], [97, "청소잘함"]
    ]
  },
  {
    name: "기타",
    items: [
      [64, "더러움무시"], [82, "동성혐오"], [88, "유치"], [91, "매혹"],
      [110, "작은 체형"], [111, "장신"], [112, "회복빠름"], [117, "치료"], 
      [130, "금단의 지식"], [132, "분위기 파악 능력"], [147, "헤이안"], [170, "이름끝에 받침"]
    ]
  }
];

/* 시스템 고정 자동 생성 소질 (1, 122 제외) */
const AUTO_QUALITIES = new Set([1, 122]);

const selectedQualities = new Set();
const buttonMap = new Map();
let generatedCsv = null;
let generatedFileName = null;

/* ===== 소질 버튼 생성 (카테고리별) ===== */
const catContainer = document.getElementById("quality-categories");

QUALITY_CATEGORIES.forEach((cat) => {
  const catEl = document.createElement("div");
  catEl.className = "quality-category";

  const header = document.createElement("div");
  header.className = "quality-category-header";
  header.innerHTML =
    '<span>' + cat.name + '</span>' +
    '<span class="cat-count">' + cat.items.length + '개</span>';
  header.addEventListener("click", () => {
    catEl.classList.toggle("collapsed");
  });

  const body = document.createElement("div");
  body.className = "quality-category-body";

  const grid = document.createElement("div");
  grid.className = "qualities";

  cat.items.forEach(([num, label]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = num + ". " + label;
    btn.dataset.num = num;
    btn.addEventListener("click", () => {
      if (selectedQualities.has(num)) {
        selectedQualities.delete(num);
        btn.classList.remove("active");
      } else {
        selectedQualities.add(num);
        btn.classList.add("active");
      }
      invalidateDownload();
    });
    grid.appendChild(btn);
    buttonMap.set(num, btn);
  });

  body.appendChild(grid);
  catEl.appendChild(header);
  catEl.appendChild(body);
  catContainer.appendChild(catEl);
});

function setQualityActive(num, active) {
  const btn = buttonMap.get(num);
  if (!btn) return;
  if (active) {
    selectedQualities.add(num);
    btn.classList.add("active");
  } else {
    selectedQualities.delete(num);
    btn.classList.remove("active");
  }
}

/* 도종 변경 시 110, 111, 112 소질 제어 */
function applyWeaponDefaultQualities(weapon, isManualChange = false) {
  if (isManualChange) {
    setQualityActive(110, false);
    setQualityActive(111, false);
    setQualityActive(112, false);

    if (weapon === "단도") {
      setQualityActive(110, true);
      setQualityActive(112, true);
    } else if (weapon === "협차") {
      setQualityActive(112, true);
    } else if (weapon === "대태도" || weapon === "창" || weapon === "치도") {
      setQualityActive(111, true);
    }
  }
}

document.getElementById("weapon").addEventListener("change", (e) => {
  applyWeaponDefaultQualities(e.target.value, true);
  invalidateDownload();
});

function hasBatchim(str) {
  if (!str) return false;
  const ch = str.charAt(str.length - 1);
  const code = ch.charCodeAt(0);
  if (code < 0xAC00 || code > 0xD7A3) return false;
  return (code - 0xAC00) % 28 !== 0;
}

function buildCsv(num, name, weapon) {
  const s = STATS[weapon];
  const lines = [];

  lines.push("番号," + num + ",");
  lines.push("名前," + name + ",");
  lines.push("呼び名," + name + ",");
  lines.push("基礎,0," + s.hp + ",");
  lines.push("基礎,1," + s.mp + ",");
  lines.push(";(기본)동정");
  lines.push("素質,1,");
  lines.push(";(120번대)남자");
  lines.push("素質,122,");

  // 이름끝에 받침이 있고 사용자가 수동으로 체크하지 않았더라도 170번 자동 추가를 지원하되 중복을 방지하기 위해 집합에 통합
  const finalQualities = new Set(selectedQualities);
  if (hasBatchim(name)) {
    finalQualities.add(170);
  }

  // 필수 기본 소질(1, 122)과 중복되지 않도록 제외 처리
  finalQualities.delete(1);
  finalQualities.delete(122);

  const sorted = Array.from(finalQualities).sort((a, b) => a - b);
  sorted.forEach(q => {
    if (q === 170) {
      lines.push(";(이름끝에 받침)");
    }
    lines.push("素質," + q + ",");
  });

  return lines.join("\r\n") + "\r\n";
}

function invalidateDownload() {
  generatedCsv = null;
  generatedFileName = null;
  document.getElementById("dlBtn").disabled = true;
}

document.getElementById("genBtn").addEventListener("click", () => {
  const num = document.getElementById("num").value.trim();
  const name = document.getElementById("name").value.trim();
  const weapon = document.getElementById("weapon").value;
  const status = document.getElementById("status");
  const result = document.getElementById("result");
  const dlBtn = document.getElementById("dlBtn");

  invalidateDownload();

  if (!num || !name) {
    status.className = "error";
    status.textContent = "번호와 이름을 모두 입력해 주세요.";
    result.textContent = "";
    return;
  }

  const csv = buildCsv(num, name, weapon);
  result.textContent = csv;

  generatedCsv = csv;
  generatedFileName = "Chara" + num + "_" + name + ".csv";

  status.className = "";
  status.textContent = "CSV 생성 완료. 내용을 확인 후 다운로드하세요.";
  dlBtn.disabled = false;
});

document.getElementById("dlBtn").addEventListener("click", () => {
  if (!generatedCsv) return;

  const bom = "\uFEFF";
  const blob = new Blob([bom + generatedCsv], { type: "text/csv;charset=utf-8;" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = generatedFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
});

["num", "name"].forEach(id => {
  document.getElementById(id).addEventListener("input", invalidateDownload);
});

/* ---------- CSV 로드 ---------- */
document.getElementById("fileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Chara0_ 로 시작하는 파일 차단
  if (file.name.startsWith("Chara0_") || file.name === "Chara0.csv") {
    alert("플레이어 소질은 게임 내에서 직접 설정만 가능합니다");
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const text = String(reader.result).replace(/^\uFEFF/, "");
    loadCsv(text, file.name);
    e.target.value = "";
  };
  reader.readAsText(file, "utf-8");
});

function parseCsvLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cells.push(cur); cur = ""; }
      else cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

function loadCsv(text, fileName) {
  const status = document.getElementById("status");
  const result = document.getElementById("result");

  const lines = text.split(/\r?\n/);

  let num = "";
  let name = "";
  let hp = null;
  let mp = null;
  const loadedQualities = new Set();

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    if (rawLine.trimStart().startsWith(";")) continue;

    const cells = parseCsvLine(rawLine);
    const key = (cells[0] || "").trim();

    if (key === "番号") {
      num = (cells[1] || "").trim();
    } else if (key === "名前") {
      name = (cells[1] || "").trim();
    } else if (key === "基礎") {
      const idx = (cells[1] || "").trim();
      const val = Number((cells[2] || "").trim());
      if (idx === "0") hp = val;
      else if (idx === "1") mp = val;
    } else if (key === "素質") {
      const q = Number((cells[1] || "").trim());
      if (!isNaN(q)) loadedQualities.add(q);
    }
  }

  // 내부 데이터 번호가 0인 경우 차단
  if (num === "0") {
    alert("플레이어 소질은 플레이어 설정에서 직접 관리해야 합니다.");
    return;
  }

  result.textContent = text;
  document.getElementById("num").value = num;
  document.getElementById("name").value = name;

  let matchedWeapon = "";
  if (hp !== null && mp !== null) {
    for (const [w, s] of Object.entries(STATS)) {
      if (s.hp === hp && s.mp === mp) { matchedWeapon = w; break; }
    }
    if (!matchedWeapon) {
      for (const [w, s] of Object.entries(STATS)) {
        if (s.hp === hp) { matchedWeapon = w; break; }
      }
    }
  }
  if (matchedWeapon) {
    document.getElementById("weapon").value = matchedWeapon;
  }

  // 선택 소질 초기화 후 파일 데이터 반영
  selectedQualities.clear();
  buttonMap.forEach((btn) => btn.classList.remove("active"));

  loadedQualities.forEach((q) => {
    if (AUTO_QUALITIES.has(q)) return; // 1, 122 제외하고 170 등은 정상 반영
    if (buttonMap.has(q)) setQualityActive(q, true);
  });

  invalidateDownload();

  status.className = "";
  status.textContent = "CSV를 불러왔습니다. (번호: " + (num || "-") + ", 이름: " + (name || "-") +
    (matchedWeapon ? ", 도종 추정: " + matchedWeapon : "") + ")";
}

/* 최초 페이지 로드 시 기본 도종("단도") 설정 및 소질 적용 */
applyWeaponDefaultQualities(document.getElementById("weapon").value, true);