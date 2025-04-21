// script_statistics.js (공통 모듈 사용 + applyGradientColors 정의 포함)
document.addEventListener('DOMContentLoaded', function() {
    const versionSelect    = document.getElementById('version-select');
    const tierSelect       = document.getElementById('tier-select');
    const periodSelect     = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');

    let currentSortColumn = '점수';
    let currentSortAsc    = false;
    let lastData          = [];

    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);

    // 1) URL 파라미터 → 컨트롤에 반영
    function applyParamsToControls() {
        if (params.has('version'))  versionSelect.value    = params.get('version');
        if (params.has('tier'))     tierSelect.value       = params.get('tier');
        if (params.has('period'))   periodSelect.value     = params.get('period');
        if (params.has('gradient')) gradientCheckbox.checked = params.get('gradient') === '1';
    }

    // 2) 컨트롤 상태 → URL에 반영
    function updateURL() {
        params.set('version', versionSelect.value);
        params.set('tier',    tierSelect.value);
        params.set('period',  periodSelect.value);
        params.set('gradient', gradientCheckbox.checked ? '1' : '0');
        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
    }

    // 3) 공통 모듈 초기화 + 상태 복원
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
        const config     = parseINI(iniText);
        const tierConfig = config.tiers;

        // common.js 에 정의된 함수들
        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        // URL 파라미터로부터 복원
        applyParamsToControls();

        // 변경 시 URL 갱신 + 데이터 갱신
        versionSelect.addEventListener('change', () => { updateURL(); loadAndDisplay(tierConfig); });
        tierSelect.addEventListener('change',    () => { updateURL(); loadAndDisplay(tierConfig); });
        periodSelect.addEventListener('change',  () => { updateURL(); loadAndDisplay(tierConfig); });
        gradientCheckbox.addEventListener('change', () => {
            updateURL();
            renderTable(lastData);
        });

        // 첫 로드
        loadAndDisplay(tierConfig);
    }).catch(err => console.error('초기화 실패:', err));


    // 4) 데이터 로드 ∙ 가공 ∙ 렌더
    function loadAndDisplay(tierConfig) {
        const version = versionSelect.value;
        const tier    = tierSelect.value;
        const period  = periodSelect.value;

        fetch(`/data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json['통계'];
                const entries = extractPeriodEntries(history, period);

                const avgScore = calculateAverageScore(entries);
                const stddev   = calculateStandardDeviation(entries, avgScore);

                let scored = calculateTiers(entries, avgScore, stddev, tierConfig);
                    scored = sortData(scored, currentSortColumn, currentSortAsc);

                lastData = scored;
                renderTable(scored);
            })
            .catch(err => {
                console.error('데이터 로드 실패:', err);
                document.getElementById('data-container')
                        .innerText = '데이터를 불러오는 데 실패했습니다.';
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
        // 1) 테이블 HTML 생성
        let html = '<table><thead><tr>';
        cols.forEach(c => html += `<th data-col="${c}">${c}</th>`);
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
      
        // 2) 헤더에 클릭 이벤트 및 data-arrow 적용
        const ths = container.querySelectorAll('th');
        ths.forEach(th => {
          const col = th.dataset.col;
      
          // ▶ data-arrow 리셋
          th.setAttribute('data-arrow', '');
      
          if (col === currentSortColumn) {
            // 오름차순 ▲, 내림차순 ▼
            th.setAttribute('data-arrow', currentSortAsc ? '▲' : '▼');
          }
      
          // 티어 컬럼은 정렬 대상에서 제외
          if (col === '티어') {
            th.style.cursor = 'default';
            return;
          }
      
          th.style.cursor = 'pointer';
          th.onclick = () => {
            if (currentSortColumn === col) currentSortAsc = !currentSortAsc;
            else {
              currentSortColumn = col;
              currentSortAsc = false;
            }
            lastData = sortData(lastData, currentSortColumn, currentSortAsc);
            renderTable(lastData);
          };
        });
      
        // 3) 색상 강조
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
