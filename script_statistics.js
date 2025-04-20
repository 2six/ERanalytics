document.addEventListener('DOMContentLoaded', () => {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-toggle');
    const tableBody = document.querySelector('#data-table tbody');

    let originalData = [];
    let currentData = [];
    let sortColumnIndex = -1;
    let ascending = true;

    // ✅ 공통 모듈의 initializeDropdowns 사용
    initializeDropdowns(versionSelect, tierSelect, periodSelect, () => triggerLoad(tierConfig));

    // ✅ 점수 계산 함수는 공통 모듈에서 가져옴

    function applyGradientColors() {
        if (!gradientCheckbox.checked) {
            document.querySelectorAll('#data-table td').forEach(td => td.style.background = '');
            return;
        }

        const columns = ["점수", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];
        const colIndexMap = {};
        const ths = document.querySelectorAll('#data-table thead th');
        columns.forEach(name => {
            for (let i = 0; i < ths.length; i++) {
                if (ths[i].textContent === name) {
                    colIndexMap[name] = i;
                    break;
                }
            }
        });

        columns.forEach(col => {
            const index = colIndexMap[col];
            const values = Array.from(tableBody.rows).map(row => parseFloat(row.cells[index].dataset.value || row.cells[index].textContent));
            const min = Math.min(...values);
            const max = Math.max(...values);

            Array.from(tableBody.rows).forEach(row => {
                const td = row.cells[index];
                const value = parseFloat(td.dataset.value || td.textContent);
                const ratio = (value - min) / (max - min);
                const r = Math.round(255 - ratio * 255);
                const b = Math.round(ratio * 255);
                td.style.background = `rgb(${r}, 255, ${b})`;
            });
        });
    }

    function triggerLoad(tierConfig) {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        const filePath = `data/${version}/${tier}.json`;
        fetch(filePath)
            .then(res => res.json())
            .then(json => {
                const statHistory = json["통계"];
                const timestamps = Object.keys(statHistory).sort();
                const latestKey = timestamps[timestamps.length - 1];

                if (period === 'latest') {
                    currentData = JSON.parse(JSON.stringify(statHistory[latestKey]));
                } else {
                    const days = period === '3day' ? 3 : 7;
                    const latestDate = new Date(latestKey.replace(/_/g, ':').replace(/-/g, '/'));
                    const pastDate = new Date(latestDate);
                    pastDate.setDate(pastDate.getDate() - days);

                    const pastKey = timestamps.slice().reverse().find(ts => {
                        const d = new Date(ts.replace(/_/g, ':').replace(/-/g, '/'));
                        return d <= pastDate;
                    });

                    if (!pastKey || !statHistory[pastKey]) {
                        currentData = JSON.parse(JSON.stringify(statHistory[latestKey]));
                    } else {
                        const currMap = Object.fromEntries(statHistory[latestKey].map(d => [d.실험체, d]));
                        const prevMap = Object.fromEntries(statHistory[pastKey].map(d => [d.실험체, d]));

                        currentData = [];
                        for (const name in currMap) {
                            const curr = currMap[name];
                            const prev = prevMap[name];
                            if (!prev) continue;
                            const diffSample = curr["표본수"] - prev["표본수"];
                            if (diffSample <= 0) continue;

                            currentData.push({
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

                const 전체표본수 = currentData.reduce((sum, d) => sum + d["표본수"], 0);
                currentData.forEach(row => {
                    row["픽률"] = row["표본수"] / 전체표본수;
                });

                // ✅ 점수 계산
                const result = calculateScore(currentData);
                const weightedAvg = result.weightedAverage;

                originalData = JSON.parse(JSON.stringify(currentData));

                renderTable(currentData, weightedAvg);
            });
    }

    function renderTable(data, weightedAvg) {
        tableBody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');

            const columns = [
                row["실험체"],
                row["점수"].toFixed(1),
                (row["픽률"] * 100).toFixed(2) + '%',
                row["RP 획득"].toFixed(2),
                (row["승률"] * 100).toFixed(2) + '%',
                (row["TOP 3"] * 100).toFixed(2) + '%',
                row["평균 순위"].toFixed(2)
            ];

            columns.forEach((text, i) => {
                const td = document.createElement('td');
                td.innerHTML = text;
                if (i > 0) td.dataset.value = parseFloat(text);
                tr.appendChild(td);
            });

            tableBody.appendChild(tr);
        });

        applyGradientColors();
    }

    // ✅ 헤더 클릭 정렬
    document.querySelectorAll('#data-table thead th').forEach((th, idx) => {
        th.addEventListener('click', () => {
            if (sortColumnIndex === idx) {
                ascending = !ascending;
            } else {
                sortColumnIndex = idx;
                ascending = true;
            }

            sortTableByColumn(document.getElementById('data-table'), idx, ascending);
        });
    });

    // ✅ 색상 강조 체크박스 이벤트
    gradientCheckbox.addEventListener('change', applyGradientColors);
});
