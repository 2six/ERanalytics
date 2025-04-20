// script_statistics.js (공통 모듈 사용 + 공통 티어 로직 호출 버전)
document.addEventListener('DOMContentLoaded', function() {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');

    let currentSortColumn = '점수';
    let currentSortAsc = false;
    let lastData = [];

    // 1) 공통 모듈 로드
    Promise.all([
        fetch('config.ini').then(r => r.text()),
        fetch('versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
        const config = parseINI(iniText);
        const tierConfig = config.tiers;

        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        versionSelect.addEventListener('change', () => loadAndDisplay(tierConfig));
        tierSelect.addEventListener('change', () => loadAndDisplay(tierConfig));
        periodSelect.addEventListener('change', () => loadAndDisplay(tierConfig));
        gradientCheckbox.addEventListener('change', () => renderTable(lastData));

        loadAndDisplay(tierConfig);
    });

    // 2) 데이터 로드 및 표시
    function loadAndDisplay(tierConfig) {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json['통계'];
                const entries = extractPeriodEntries(history, period);

                const avgScore = calculateAverageScore(entries);
                const stddev = calculateStandardDeviation(entries, avgScore);

                let scored = calculateTiers(entries, avgScore, stddev, tierConfig);
                scored = sortData(scored, currentSortColumn, currentSortAsc);

                lastData = scored;
                renderTable(scored);
            })
            .catch(err => {
                console.error(err);
                document.getElementById('data-container').innerText = '데이터를 불러오는데 실패했습니다.';
            });
    }

    // 3) 추출: period 기준으로 데이터
    function extractPeriodEntries(history, period) {
        const keys = Object.keys(history).sort();
        const latest = history[keys[keys.length - 1]];
        if (period === 'latest') return latest;

        const days = period === '3day' ? 3 : 7;
        const latestDate = new Date(keys[keys.length - 1].replace(/_/g, ':').replace(/-/g, '/'));
        const cutoff = new Date(latestDate);
        cutoff.setDate(cutoff.getDate() - days);

        const pastKey = keys.slice().reverse().find(k => new Date(k.replace(/_/g, ':').replace(/-/g, '/')) <= cutoff);
        if (!pastKey) return latest;

        const prev = history[pastKey];
        const currMap = Object.fromEntries(latest.map(d => [d.실험체, d]));
        const prevMap = Object.fromEntries(prev.map(d => [d.실험체, d]));
        const delta = [];

        for (const name in currMap) {
            const c = currMap[name];
            const p = prevMap[name];
            if (!p) continue;
            const diff = c['표본수'] - p['표본수'];
            if (diff <= 0) continue;
            delta.push({
                '실험체': name,
                '표본수': diff,
                'RP 획득': (c['RP 획득'] * c['표본수'] - p['RP 획득'] * p['표본수']) / diff,
                '승률': (c['승률'] * c['표본수'] - p['승률'] * p['표본수']) / diff,
                'TOP 3': (c['TOP 3'] * c['표본수'] - p['TOP 3'] * p['표본수']) / diff,
                '평균 순위': (c['평균 순위'] * c['표본수'] - p['평균 순위'] * p['표본수']) / diff
            });
        }
        return delta;
    }

    // 4) 테이블 렌더링
    function renderTable(data) {
        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];
        let html = '<table><thead><tr>';
        cols.forEach(col => html += `<th data-col="${col}" style="cursor:pointer">${col}</th>`);
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            cols.forEach(col => {
                let val = row[col];
                if (['픽률','승률','TOP 3'].includes(col)) val = val.toFixed(2) + '%';
                html += `<td>${val}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table>';
        document.getElementById('data-container').innerHTML = html;

        document.querySelectorAll('#data-container th').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (currentSortColumn === col) currentSortAsc = !currentSortAsc;
                else { currentSortColumn = col; currentSortAsc = false; }
                const sorted = sortData(lastData, currentSortColumn, currentSortAsc);
                lastData = sorted;
                renderTable(sorted);
            });
        });

        if (gradientCheckbox.checked) applyGradientColors();
    }
});
