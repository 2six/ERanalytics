// ✅ script_common.js

/**
 * 버전 목록을 받아서 드롭다운에 추가하는 함수
 * @param {HTMLElement} selectElement - 버전 select 요소
 * @param {string[]} versions - 버전 목록 배열
 */
function populateVersionDropdown(selectElement, versions) {
    versions.sort().reverse().forEach(version => {
        const option = document.createElement("option");
        option.value = version;
        option.textContent = version;
        selectElement.appendChild(option);
    });
}

/**
 * 티어 목록을 select 요소에 추가
 * @param {HTMLElement} selectElement - 티어 select 요소
 */
function populateTierDropdown(selectElement) {
    const tierMap = {
        "platinum_plus": "플래티넘+",
        "diamond_plus": "다이아몬드+",
        "meteorite_plus": "메테오라이트+",
        "mithril_plus": "미스릴+",
        "in1000": "in1000"
    };
    Object.entries(tierMap).forEach(([val, name]) => {
        const option = document.createElement("option");
        option.value = val;
        option.textContent = name;
        selectElement.appendChild(option);
    });
}

/**
 * 구간(전체/3일/7일) select 요소를 초기화
 * @param {HTMLElement} selectElement - 구간 select 요소
 */
function populatePeriodDropdown(selectElement) {
    selectElement.innerHTML = `
        <option value="latest">전체</option>
        <option value="3day">최근 3일</option>
        <option value="7day">최근 7일</option>
    `;
}

/**
 * 점수 계산 함수
 * @param {number} rp - RP 획득
 * @param {number} pickRate - 픽률
 * @param {number} winRate - 승률
 * @param {number} top3 - Top3 비율
 * @param {number} avgRank - 평균 순위
 * @returns {number} 최종 점수
 */
function calculateScore(rp, pickRate, winRate, top3, avgRank) {
    let rpScore = rp >= 0 ? rp : -Math.log(-rp + 1) * 2;

    const pickMultiplier = pickRate < 0.01
        ? pickRate / 0.01
        : pickRate < 0.02
            ? 1
            : pickRate < 0.04
                ? 1.02
                : 1.04;

    const score = (
        (rpScore * 0.4) +
        (winRate * 100 * 0.2) +
        (top3 * 100 * 0.2) +
        ((7 - avgRank) * 10 * 0.2)
    ) * pickMultiplier;

    return Math.round(score * 10) / 10;
}
