document.addEventListener('DOMContentLoaded', () => {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox'); // ✅ ID 일치 확인
    const container = document.getElementById('data-container');

    let currentSortColumn = "점수";
    let currentSortAsc = false;
    let lastSortedData = [];

    let tierConfig = null;

    // ✅ config.ini와 versions.json 병렬 로드
    Promise.all([
        fetch('config.ini').then(r => r.text()),
        fetch('versions.json').then(r => r.json())
    ]).then(([iniText, versions]) => {
        tierConfig = parseINI(iniText).tiers;
        initializeDropdowns(versionSelect, tierSelect, periodSelect, triggerLoad);
    });

    // ✅ INI 파서 유지
    function parseINI(iniString) {
        const config = {};
        let currentSection = null;
        iniString.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) return;
            const section = trimmed.match(/^\[(.*)\]$/);
            if (section) {
                currentSection = section[1];
                config[currentSection] = {};
                return;
            }
            const kv = trimmed.match(/^([^=]+)=(.*)$/);
            if (kv) config[currentSection][kv[1].trim()] = kv[2].trim();
        });
        return config;
    }

    function triggerLoad() {
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

                let data = [];
                if (period === 'latest') {
                    data = latestData;
                } else {
                    const days = period === '3day' ? 3 : 7;
                    const latestDate = new Date(latestKey.replace(/_/g, ':').replace(/-/g, '/'));
                    const pastDate = new Date(latestDate);
                    pastDate.setDate(pastDate.getDate() - days);

                    const pastKey = timestamps.slice().reverse().find(ts => {
                        const d = new Date(ts.replace(/_/g, ':').replace(/-/g, '/'));
                        return d <= pastDate;
                    });

                    if (!pastKey || !history[pastKey]) {
                        data = latestData;
                    } else {
                        const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
                        const prevMap = Object.fromEntries(history[pastKey].map(d => [d.실험체, d]));

                        data = [];
                        for (const name in currMap) {
                            const curr = currMap[name];
                            const prev = prevMap[name];
                            if (!prev) continue;
                            const diffSample = curr["표본수"] - prev["표본수"];
                            if (diffSample <= 0) continue;

                            data.push({
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

                const total = data.reduce((sum, d) => sum + d["표본수"], 0);
                data.forEach(row => {
                    row["픽률"] = row["표본수"] / total;
                });

                const result = calculateScore(data); // ✅ 공통 모듈 사용
                const sorted = sortData(data, currentSortColumn, currentSortAsc);
                displayTable(sorted);
            });
    }

    function sortData(data, column, asc) {
        return [...data].sort((a, b) => {
            const va = a[column], vb = b[column];
            if (typeof va === 'number') return asc ? va - vb : vb - va;
            return asc ? va.localeCompare(vb) : vb.localeCompare(va);
        });
    }

    function displayTable(data) {
        lastSortedData = data;
        const columns = ["실험체", "점수", "픽률", "RP 획득", "승률", "TOP 3", "평균 순위"];
        let html = `<table id="data-table"><thead><tr>`;

        columns.forEach(col => {
            html += `<th style="cursor:pointer;" data-column="${col}">${col}</th>`;
        });
        html += `</tr></thead><tbody>`;

        data.forEach(row => {
            html += `<tr>`;
            html += `<td>${row["실험체"]}</td>`;
            html += `<td data-value="${row["점수"]}">${row["점수"].toFixed(1)}</td>`;
            html += `<td data-value="${row["픽률"]}">${(row["픽률"] * 100).toFixed(2)}%</td>`;
            html += `<td data-value="${row["RP 획득"]}">${row["RP 획득"].toFixed(1)}</td>`;
            html += `<td data-value="${row["승률"]}">${(row["승률"] * 100).toFixed(2)}%</td>`;
            html += `<td data-value="${row["TOP 3"]}">${(row["TOP 3"] * 100).toFixed(2)}%</td>`;
            html += `<td data-value="${row["평균 순위"]}">${row["평균 순위"].toFixed(2)}</td>`;
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

        document.querySelectorAll('#data-table thead th').forEach((th, i) => {
            th.addEventListener('click', () => {
                const col = th.dataset.column;
                if (currentSortColumn === col) currentSortAsc = !currentSortAsc;
                else {
                    currentSortColumn = col;
                    currentSortAsc = false;
                }
                const sorted = sortData(lastSortedData, currentSortColumn, currentSortAsc);
                displayTable(sorted);
            });
        });

        if (gradientCheckbox.checked) applyGradientColors();
    }

    function applyGradientColors() {
        const table = document.querySelector('#data-table');
        const rows = [...table.querySelectorAll('tbody tr')];
        const headers = [...table.querySelectorAll('thead th')];

        const goodCols = ["점수", "픽률", "RP 획득", "승률", "TOP 3"];
        const badCols = ["평균 순위"];

        headers.forEach((th, i) => {
            const col = th.dataset.column;
            if (![...goodCols, ...badCols].includes(col)) return;

            const values = rows.map(row => parseFloat(row.children[i].dataset.value));
            const average = values.reduce((a, b) => a + b, 0) / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            rows.forEach((row, idx) => {
                const val = values[idx];
                const cell = row.children[i];
                let ratio, color;

                const isBad = badCols.includes(col);

                if ((isBad && val <= average) || (!isBad && val >= average)) {
                    ratio = isBad ? (average - val) / (average - min || 1) : (val - average) / (max - average || 1);
                    color = getGradientColor(ratio, false);
                } else {
                    ratio = isBad ? (val - average) / (max - average || 1) : (average - val) / (average - min || 1);
                    color = getGradientColor(ratio, true);
                }

                ratio = Math.max(0, Math.min(1, ratio));
                cell.style.backgroundColor = color;
            });
        });
    }

    function getGradientColor(ratio, isBad) {
        const start = isBad ? [230, 240, 255] : [255, 255, 255];
        const end = isBad ? [164, 194, 244] : [230, 124, 115];
        const rgb = start.map((s, i) => Math.round(s + (end[i] - s) * ratio));
        return `rgb(${rgb.join(',')})`;
    }
});
