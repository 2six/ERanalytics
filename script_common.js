// ✅ script_common.js

/**
 * 공통 드롭다운 초기화 함수
 * statistics.html, tier_table.html, graph.html 등에서 사용 가능
 * 
 * @param {HTMLElement} versionSelect - 버전 선택 select 요소
 * @param {HTMLElement} tierSelect - 티어 선택 select 요소
 * @param {HTMLElement} periodSelect - 구간 선택 select 요소
 * @param {Function} callback - 드롭다운 변경 시 호출될 콜백 함수
 */
function initializeDropdowns(versionSelect, tierSelect, periodSelect, callback) {
    fetch('versions.json').then(r => r.json()).then(versions => {
        versions.sort().reverse().forEach(v => {
            const option = document.createElement("option");
            option.value = v;
            option.textContent = v;
            versionSelect.appendChild(option);
        });

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
            tierSelect.appendChild(option);
        });

        periodSelect.innerHTML = `
            <option value="latest">전체</option>
            <option value="3day">최근 3일</option>
            <option value="7day">최근 7일</option>
        `;

        versionSelect.addEventListener('change', callback);
        tierSelect.addEventListener('change', callback);
        periodSelect.addEventListener('change', callback);

        callback(); // 초기 로딩
    });
}


/**
 * 실험체 점수 계산 함수
 * statistics.js, tier_table.js에서 동일하게 사용
 * 
 * @param {Array<Object>} data - 실험체 통계 데이터 배열
 * @returns {Object} - { weightedAverage: number }
 */
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


/**
 * 테이블 정렬 함수
 * 각 표의 열 클릭 시 정렬용으로 사용
 * 
 * @param {HTMLTableElement} table - 정렬 대상 테이블
 * @param {number} columnIndex - 정렬할 열 인덱스
 * @param {boolean} ascending - 오름차순 여부 (기본 true)
 */
function sortTableByColumn(table, columnIndex, ascending = true) {
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);

    rows.sort((a, b) => {
        const valA = parseFloat(a.cells[columnIndex].dataset.value || a.cells[columnIndex].textContent) || 0;
        const valB = parseFloat(b.cells[columnIndex].dataset.value || b.cells[columnIndex].textContent) || 0;
        return ascending ? valA - valB : valB - valA;
    });

    rows.forEach(row => tbody.appendChild(row));
}