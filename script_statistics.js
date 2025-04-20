document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');
    const container = document.getElementById('data-container');

    let currentSortColumn = "점수";
    let currentSortAsc = false;
    let lastSortedData = [];

    // ✅ 드롭다운 초기화 (공통 모듈 사용)
    initializeDropdowns(versionSelect, tierSelect, periodSelect, () => {
        const tierNameMap = getTierNameMap(); // ✅ 공통 티어 이름 매핑 함수 사용
        triggerLoad(tierNameMap);
    });

    // ✅ 로딩 및 점수 계산 + 테이블 출력
    function triggerLoad(tierNameMap) {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`data/${version}/${tier}.json`)
            .then(r => r.json())
            .then(json => {
                const history = json["통계"];
                const timestamps = Object.keys(history).sort();
                const latestKey = timestamps[timestamps.length - 1];
                const latestData = history[latestKey];

                let baseData = [];

                if (period === "latest") {
                    baseData = JSON.parse(JSON.stringify(latestData));
                } else {
                    const days = period === "3day" ? 3 : 7;
                    const latestDate = new Date(latestKey.replace(/_/g, ":").replace(/-/g, "/"));
                    const pastDate = new Date(latestDate);
                    pastDate.setDate(pastDate.getDate() - days);

                    const pastKey = timestamps.slice().reverse().find(ts => {
                        const d = new Date(ts.replace(/_/g, ":").replace(/-/g, "/"));
                        return d <= pastDate;
                    });

                    if (!pastKey || !history[pastKey]) {
                        baseData = JSON.parse(JSON.stringify(latestData));
                    } else {
                        const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
                        const prevMap = Object.fromEntries(history[pastKey].map(d => [d.실험체, d]));

                        baseData = [];
                        for (const name in currMap) {
                            const curr = currMap[name];
                            const prev = prevMap[name];
                            if (!prev) continue;

                            const diffSample = curr["표본수"] - prev["표본수"];
                            if (diffSample <= 0) continue;

                            baseData.push({
                                "실험체": name,
                                "표본수": diffSample,
                                "RP 획득": (curr["RP 획득"] * curr["표본수"] - prev["RP 획득"] * prev["표본수"]) / diffSample,
                                "승률": (curr["승률"] * curr["표본수"] - prev["승률"] * prev["표본수"]) / diffSample,
                                "TOP 3": (curr["TOP 3"] * curr["표본수"] - prev["TOP 3"] * prev["표본수"]) / diffSample,
                                "평균 순위": (curr["평균 순위"] * curr["표본수"] - prev["평균 순위"] * prev["표본수"]) / diffSample
                            });
                        }
                    }
                }

                const 전체표본수 = baseData.reduce((sum, d) => sum + d["표본수"], 0);
                baseData.forEach(d => {
                    d["픽률"] = d["표본수"] / 전체표본수;
                });

                const result = calculateScore(baseData);
                lastSortedData = baseData;
                renderTable(baseData, result.weightedAverage);
            });
    }

    // ✅ 동적으로 테이블 생성
    function renderTable(data, weightedAvg) {
        container.innerHTML = ''; // 기존 테이블 제거

        const table = document.createElement('table');
        table.id = 'data-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const headers = ["실험체", "점수", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];
        headers.forEach(title => {
            const th = document.createElement('th');
            th.textContent = title;
            th.addEventListener('click', () => {
                if (currentSortColumn === title) {
                    currentSortAsc = !currentSortAsc;
                } else {
                    currentSortColumn = title;
                    currentSortAsc = true;
                }
                sortTableByColumn(table, headers.indexOf(currentSortColumn), currentSortAsc);
            });
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        data.forEach(row => {
            const tr = document.createElement('tr');
            const rowData = [
                row["실험체"],
                row["점수"].toFixed(1),
                (row["픽률"] * 100).toFixed(2) + "%",
                row["RP 획득"].toFixed(2),
                (row["승률"] * 100).toFixed(2) + "%",
                (row["TOP 3"] * 100).toFixed(2) + "%",
                row["평균 순위"].toFixed(2)
            ];
            rowData.forEach((text, i) => {
                const td = document.createElement('td');
                td.innerHTML = text;
                if (i > 0) td.dataset.value = parseFloat(text);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        container.appendChild(table);

        if (gradientCheckbox.checked) applyGradientColors();
    }

    // ✅ 색상 강조
    function applyGradientColors() {
        const table = document.getElementById("data-table");
        if (!table || !gradientCheckbox.checked) return;

        const columns = ["점수", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];
        const colIndexMap = {};
        const ths = table.querySelectorAll("thead th");

        columns.forEach(name => {
            for (let i = 0; i < ths.length; i++) {
                if (ths[i].textContent === name) {
                    colIndexMap[name] = i;
                    break;
                }
            }
        });

        const rows = table.querySelectorAll("tbody tr");
        columns.forEach(col => {
            const idx = colIndexMap[col];
            const values = Array.from(rows).map(r => parseFloat(r.cells[idx].dataset.value || r.cells[idx].textContent));
            const min = Math.min(...values);
            const max = Math.max(...values);
            rows.forEach(row => {
                const td = row.cells[idx];
                const value = parseFloat(td.dataset.value || td.textContent);
                const ratio = (value - min) / (max - min);
                const r = Math.round(255 - ratio * 255);
                const b = Math.round(ratio * 255);
                td.style.background = `rgb(${r}, 255, ${b})`;
            });
        });
    }

    gradientCheckbox.addEventListener('change', applyGradientColors);
});
