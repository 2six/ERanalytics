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
        const cols   = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];
        // px 기준 너비 합 = 180+60+50+70+70+60+60+70 = 620
        // 각 열 너비를 퍼센트로 환산 (px/620*100)
        const widths = [
          '29.03%',  // 180/620
          '9.68%',   // 60/620
          '8.06%',   // 50/620
          '11.29%',  // 70/620
          '11.29%',  // 70/620
          '9.68%',   // 60/620
          '9.68%',   // 60/620
          '11.29%'   // 70/620
        ];
      
        // 1) 테이블 HTML 생성
        let html = '<table><thead><tr>';
        cols.forEach(c => {
          html += `<th data-col="${c}">${c}</th>`;
        });
        html += '</tr></thead><tbody>';
      
        data.forEach(row => {
          html += '<tr>';
          cols.forEach(c => {
            let v = row[c];
            if (c === '픽률' || c === '승률' || c === 'TOP 3') {
              v = v.toFixed(2) + '%';
            }
            html += `<td>${v}</td>`;
          });
          html += '</tr>';
        });
      
        html += '</tbody></table>';
      
        // 2) container에 삽입
        const container = document.getElementById('data-container');
        container.innerHTML = html;
      
        // 3) 고정 폭 & 반응형 layout 설정
        const table = container.querySelector('table');
        table.style.cssText = 'width:100%; table-layout:fixed; margin:0 auto;';
      
        // 4) 헤더 <th> 에 퍼센트 폭, 스타일 적용 & 정렬 이벤트 바인딩
        table.querySelectorAll('th').forEach((th, i) => {
          th.style.cssText = `
            width:${widths[i]};
            overflow:hidden;
            white-space:nowrap;
            text-overflow:ellipsis;
            cursor:pointer;
          `;
          th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (currentSortColumn === col) {
              currentSortAsc = !currentSortAsc;
            } else {
              currentSortColumn = col;
              currentSortAsc = false;
            }
            const sorted = sortData(lastData, currentSortColumn, currentSortAsc);
            lastData = sorted;
            renderTable(sorted);
          });
        });
      
        // 5) 본문 <td> 에도 동일한 폭 & 스타일 적용
        table.querySelectorAll('td').forEach((td, idx) => {
          const colIndex = idx % cols.length;
          td.style.cssText = `
            width:${widths[colIndex]};
            overflow:hidden;
            white-space:nowrap;
            text-overflow:ellipsis;
          `;
        });
      
        // 6) 그라디언트 컬러 옵션이 체크되어 있으면 적용
        if (gradientCheckbox.checked) {
          applyGradientColors();
        }
    }

    // 5) 그라디언트 컬러 적용 (파랑-하양-빨강)
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
    }

    // 6) 색상 보간 헬퍼
    function interpolateColor(start, end, ratio) {
        const t = Math.max(0, Math.min(1, ratio));
        const rgb = start.map((s,i) => Math.round(s + (end[i] - s) * t));
        return `rgb(${rgb.join(',')})`;
    }
});
