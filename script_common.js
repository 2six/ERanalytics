// ✅ script_common.js

// ✅ 버전 드롭다운 초기화
function populateVersionDropdown(selectElement, versions) {
    versions.sort().reverse().forEach(version => {
        const option = document.createElement("option");
        option.value = version;
        option.textContent = version;
        selectElement.appendChild(option);
    });
}

// ✅ 티어 이름 매핑
const tierNameMap = {
    "platinum_plus": "플래티넘+",
    "diamond_plus": "다이아몬드+",
    "meteorite_plus": "메테오라이트+",
    "mithril_plus": "미스릴+",
    "in1000": "in1000"
};

// ✅ 티어 드롭다운 초기화
function populateTierDropdown(selectElement) {
    Object.entries(tierNameMap).forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        selectElement.appendChild(option);
    });
}

// ✅ 티어 코드 → 이름 변환
function getTierName(code) {
    return tierNameMap[code] || code;
}

// ✅ 티어 전체 매핑 객체 반환 (getTierNameMap 호출용)
function getTierNameMap() {
    return tierNameMap; // 기존 tierNameMap 객체 그대로 반환
}

// ✅ 구간 드롭다운 초기화
function populatePeriodDropdown(selectElement) {
    selectElement.innerHTML = `
        <option value="latest">전체</option>
        <option value="3day">최근 3일</option>
        <option value="7day">최근 7일</option>
    `;
}

// ✅ 드롭다운 통합 초기화
function initializeDropdowns(versionSelect, tierSelect, periodSelect, callback) {
    fetch('versions.json').then(r => r.json()).then(versions => {
        populateVersionDropdown(versionSelect, versions);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        versionSelect.addEventListener('change', callback);
        tierSelect.addEventListener('change', callback);
        periodSelect.addEventListener('change', callback);

        callback();
    });
}

// ✅ 점수 계산
function calculateScore(data) {
    let totalSample = 0;
    let totalWeight = 0;

    for (const row of data) {
        const pickRate = row["픽률"];
        const winRate = row["승률"];
        const top3 = row["TOP 3"];
        const avgRank = row["평균 순위"];
        const rp = row["RP 획득"];

        const winScore = winRate * 100;
        const top3Score = top3 * 100;
        const rankScore = 8 - avgRank;
        const rpScore = rp >= 0 ? rp : -Math.log(-rp + 1) * 2;

        const score = winScore * 0.3 + top3Score * 0.25 + rankScore * 5 + rpScore * 1.5;

        row["점수"] = score;
        totalSample += row["표본수"];
        totalWeight += row["표본수"] * score;
    }

    return { weightedAverage: totalWeight / totalSample };
}