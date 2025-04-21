// script_statistics.js (공통 모듈 사용 + applyGradientColors 정의 포함)
document.addEventListener('DOMContentLoaded', function() {
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');

    let currentSortColumn = '점수';
    let currentSortAsc = false;
    let lastData = [];

    // 1) 공통 모듈 초기화
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
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

    // 2) 데이터 로드 및 처리
    function loadAndDisplay(tierConfig) {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`/data/${version}/${tier}.json`)
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
                console.error('데이터 로드 실패:', err);
                document.getElementById('data-container').innerText = '데이터를 불러오는데 실패했습니다.';
            });
    }

    // 3) 기간별 데이터 추출
    function extractPeriodEntries(history, period) {
        const keys = Object.keys(history).sort();
        const latestKey = keys[keys.length - 1];
        const latest = history[latestKey];
        if (period === 'latest') return latest;

        const days = period === '3day' ? 3 : 7;
        const latestDate = new Date(latestKey.replace(/_/g, ':').replace(/-/g, '/'));
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
        // 1) 테이블 HTML 생성 (화살표는 여기서 넣지 않고, 아래에서 처리)
        let html = '<table><thead><tr>';
        cols.forEach(c => {
          html += `<th data-col="${c}">${c}</th>`;
        });
        html += '</tr></thead><tbody>';
        data.forEach(row => {
          html += '<tr>';
          cols.forEach(c => {
            let v = row[c];
            if (['픽률','승률','TOP 3'].includes(c)) v = v.toFixed(2) + '%';
            html += `<td>${v}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table>';
      
        const container = document.getElementById('data-container');
        container.innerHTML = html;
      
        // 2) 헤더들에 화살표 표시 & 클릭 이벤트 바인딩
        const table = container.querySelector('table');
        const ths = table.querySelectorAll('th');
        ths.forEach(th => {
          const col = th.dataset.col;
          // 2-1) 화살표 표시
          th.textContent = col
            + (col === currentSortColumn
               ? (currentSortAsc ? ' ▲' : ' ▼')
               : '');
      
          // 2-2) '티어' 컬럼은 정렬 제외
          if (col === '티어') {
            th.style.cursor = 'default';
            return;
          }
      
          // 2-3) 나머지 컬럼은 클릭 시 정렬
          th.style.cursor = 'pointer';
          th.addEventListener('click', () => {
            if (currentSortColumn === col) currentSortAsc = !currentSortAsc;
            else {
              currentSortColumn = col;
              currentSortAsc = false;
            }
            const sorted = sortData(lastData, currentSortColumn, currentSortAsc);
            lastData = sorted;
            renderTable(sorted);
          });
        });
      
        // 3) 그라디언트 강조가 켜져 있으면…
        if (gradientCheckbox.checked) applyGradientColors();
    }
      

    // 5) 그라디언트 컬러 적용 (파랑-하양-빨강)
    const TIER_COLORS = {
        'S+': 'rgb(255,127,127)',
        'S':  'rgb(255,191,127)',
        'A':  'rgb(255,223,127)',
        'B':  'rgb(255,255,127)',
        'C':  'rgb(191,255,127)',
        'D':  'rgb(127,255,127)',
        'F':  'rgb(127,255,255)',
      };

    function applyGradientColors() {
        const table = document.querySelector('#data-container table');
        if (!table) return;
        const rows = [...table.querySelectorAll('tbody tr')];
        const headers = [...table.querySelectorAll('thead th')];
        const goodCols = ['점수','픽률','RP 획득','승률','TOP 3'];
        const badCols = ['평균 순위'];

        headers.forEach((th, i) => {
            const col = th.dataset.col;
            if (![...goodCols, ...badCols].includes(col)) return;
            const values = rows.map(r => parseFloat(r.children[i].textContent.replace('%','')));
            const avg = values.reduce((a,b)=>a+b,0)/values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            rows.forEach((r, idx) => {
                const v = values[idx];
                let ratio, color;
                const isBad = badCols.includes(col);
                if (!isBad) {
                    if (v >= avg) {
                        ratio = max===avg?0:(v-avg)/(max-avg);
                        color = interpolateColor([255,255,255],[230,124,115],ratio);
                    } else {
                        ratio = avg===min?0:(avg-v)/(avg-min);
                        color = interpolateColor([255,255,255],[164,194,244],ratio);
                    }
                } else {
                    if (v <= avg) {
                        ratio = avg===min?0:(avg-v)/(avg-min);
                        color = interpolateColor([255,255,255],[230,124,115],ratio);
                    } else {
                        ratio = max===avg?0:(v-avg)/(max-avg);
                        color = interpolateColor([255,255,255],[164,194,244],ratio);
                    }
                }
                r.children[i].style.backgroundColor = color;
            });
        });
        const tierColIndex = headers.findIndex(th => th.dataset.col === '티어');
        if (tierColIndex >= 0) {
            rows.forEach(tr => {
            const tierValue = tr.children[tierColIndex].textContent.trim();
            const color = TIER_COLORS[tierValue];
            if (color) {
                tr.children[tierColIndex].style.backgroundColor = color;
            }
            });
        }
    }

    // 6) 색상 보간 헬퍼
    function interpolateColor(start, end, ratio) {
        const t = Math.max(0, Math.min(1, ratio));
        const rgb = start.map((s,i) => Math.round(s + (end[i] - s) * t));
        return `rgb(${rgb.join(',')})`;
    }
});
