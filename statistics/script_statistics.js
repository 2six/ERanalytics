// script_statistics.js (공통 모듈 사용 + applyGradientColors 정의 포함)
document.addEventListener('DOMContentLoaded', function() {
    // 기본 데이터 선택 드롭다운
    const versionSelect    = document.getElementById('version-select');
    const tierSelect       = document.getElementById('tier-select');
    const periodSelect     = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');
    const dataContainer    = document.getElementById('data-container');

    // 비교 모드 관련 요소
    const comparisonControlsDiv = document.getElementById('comparison-controls');
    const versionSelectCompare  = document.getElementById('version-select-compare');
    const tierSelectCompare     = document.getElementById('tier-select-compare');
    const periodSelectCompare   = document.getElementById('period-select-compare');

    let currentSortColumn = '점수'; // 기본 정렬 컬럼
    let currentSortAsc    = false;  // 기본 정렬 방향 (내림차순)
    let lastData          = [];     // 마지막으로 렌더링된 데이터 (비교 모드에서는 병합된 데이터)
    let tierConfig        = null;   // INI 파일에서 로드된 티어 설정

    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);
    // 비교 모드 활성화 여부 확인
    const isCompareMode = params.get('compare') === '1';

    // 1) URL 파라미터 → 컨트롤에 반영
    function applyParamsToControls() {
        if (params.has('version'))  versionSelect.value    = params.get('version');
        if (params.has('tier'))     tierSelect.value       = params.get('tier');
        if (params.has('period'))   periodSelect.value     = params.get('period');
        // 색상 강조는 기본 모드에서만 URL 적용, 비교 모드는 JS에서 강제 활성화
        if (!isCompareMode && params.has('gradient')) gradientCheckbox.checked = params.get('gradient') === '1';

        // 비교 모드일 경우, 비교 컨트롤의 파라미터도 반영
        if (isCompareMode) {
            // 기본값 설정 또는 URL 파라미터 반영
            versionSelectCompare.value = params.get('version2') || versionSelect.value; // version2 파라미터 사용
            tierSelectCompare.value    = params.get('tier2')    || tierSelect.value;    // tier2 파라미터 사용
            periodSelectCompare.value  = params.get('period2')  || periodSelect.value;  // period2 파라미터 사용
            gradientCheckbox.checked = true; // 비교 모드에서는 색상 강조 항상 켜짐
            gradientCheckbox.disabled = true; // 색상 강조 체크박스 비활성화
        }
    }

    // 2) 컨트롤 상태 → URL에 반영
    function updateURL() {
        params.set('version', versionSelect.value);
        params.set('tier',    tierSelect.value);
        params.set('period',  periodSelect.value);

        if (!isCompareMode) {
            // 기본 모드에서는 gradient 상태만 저장
            params.set('gradient', gradientCheckbox.checked ? '1' : '0');
            params.delete('version2'); // 비교 모드 파라미터 제거
            params.delete('tier2');
            params.delete('period2');
            params.delete('compare'); // 비교 모드 해제 파라미터 제거
        } else {
            // 비교 모드에서는 비교 컨트롤 상태도 저장
            params.set('version2', versionSelectCompare.value);
            params.set('tier2',    tierSelectCompare.value);
            params.set('period2',  periodSelectCompare.value);
            params.set('compare', '1'); // 비교 모드 파라미터 유지
            // gradient 파라미터는 비교 모드에서 사용되지 않으므로 제거하거나 무시
            params.delete('gradient');
        }

        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
    }

    // 3) 초기화 로직
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
        const config = parseINI(iniText);
        tierConfig   = config.tiers; // 전역 변수에 저장

        // common.js 에 정의된 함수들로 드롭다운 채우기
        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        // 비교 모드일 경우, 비교 드롭다운도 채우고 보이게 함
        if (isCompareMode) {
            comparisonControlsDiv.style.display = 'block';
            populateVersionDropdown(versionSelectCompare, versionList);
            populateTierDropdown(tierSelectCompare);
            populatePeriodDropdown(periodSelectCompare);

            // body에 클래스 추가 (HTML에서 못 하는 경우 대비)
            document.body.classList.add('compare-mode');
            // 제목 업데이트 (HTML에서 못 하는 경우 대비)
            document.querySelector('header h1').textContent = '실험체 통계 (비교 모드)';

            // 정렬 컬럼 기본값 변경 (비교 모드에서는 점수 차이 정렬이 유용)
            // currentSortColumn = '점수 차이'; // 비교 데이터 처리 후 컬럼명 확정 시 사용
            // currentSortAsc = false; // 내림차순
        }

        // URL 파라미터로부터 컨트롤 상태 복원
        applyParamsToControls();

        // 변경 시 URL 갱신 + 데이터 갱신
        const reloadData = isCompareMode ? loadAndDisplayComparison : loadAndDisplaySingle;

        versionSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        tierSelect.addEventListener('change',    () => { updateURL(); reloadData(); });
        periodSelect.addEventListener('change',  () => { updateURL(); reloadData(); });
        gradientCheckbox.addEventListener('change', () => {
            updateURL();
            // 기본 모드에서만 색상 강조 토글
            if (!isCompareMode) renderTable(lastData);
            // 비교 모드에서는 변경 불가 (항상 켜짐)
        });

        // 비교 모드일 경우, 비교 드롭다운 이벤트 리스너 추가
        if (isCompareMode) {
            versionSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            tierSelectCompare.addEventListener('change',    () => { updateURL(); reloadData(); });
            periodSelectCompare.addEventListener('change',  () => { updateURL(); reloadData(); });
        }


        // 첫 로드 (모드에 따라 다른 함수 호출)
        reloadData();

    }).catch(err => {
        console.error('초기화 실패:', err);
        dataContainer.innerText = '초기 설정 로드에 실패했습니다.';
    });

    // 4) 단일 데이터 로드 ∙ 가공 ∙ 렌더 (기존 로직)
    function loadAndDisplaySingle() {
        dataContainer.innerText = '데이터 로딩 중...'; // 로딩 메시지
        const version = versionSelect.value;
        const tier    = tierSelect.value;
        const period  = periodSelect.value;

        fetch(`/data/${version}/${tier}.json`)
            .then(res => {
                 if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                 return res.json();
            })
            .then(json => {
                const history = json['통계'];
                const entries = extractPeriodEntries(history, period); // common.js 함수

                const avgScore = calculateAverageScore(entries); // common.js 함수
                const stddev   = calculateStandardDeviation(entries, avgScore); // common.js 함수

                let scored = calculateTiers(entries, avgScore, stddev, tierConfig); // common.js 함수
                    scored = sortData(scored, currentSortColumn, currentSortAsc); // common.js 함수

                lastData = scored;
                renderTable(scored);
            })
            .catch(err => {
                console.error('데이터 로드 실패:', err);
                dataContainer.innerText = `데이터를 불러오는 데 실패했습니다: ${err.message}`;
            });
    }

    // 5) 비교 데이터 로드 ∙ 가공 ∙ 렌더 (새 로직)
    function loadAndDisplayComparison() {
        dataContainer.innerText = '비교 데이터 로딩 중...'; // 로딩 메시지
        const version1 = versionSelect.value;
        const tier1    = tierSelect.value;
        const period1  = periodSelect.value;

        const version2 = versionSelectCompare.value;
        const tier2    = tierSelectCompare.value;
        const period2  = periodSelectCompare.value;

        const url1 = `/data/${version1}/${tier1}.json`;
        const url2 = `/data/${version2}/${tier2}.json`;

        Promise.all([
            fetch(url1).then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url1}`);
                return res.json();
            }),
            fetch(url2).then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url2}`);
                return res.json();
            })
        ])
        .then(([json1, json2]) => {
            const history1 = json1['통계'];
            const history2 = json2['통계'];

            const entries1 = extractPeriodEntries(history1, period1);
            const entries2 = extractPeriodEntries(history2, period2);

            // 각 데이터셋에 대해 점수/티어 계산
            const avgScore1 = calculateAverageScore(entries1);
            const stddev1   = calculateStandardDeviation(entries1, avgScore1);
            const scored1   = calculateTiers(entries1, avgScore1, stddev1, tierConfig);

            const avgScore2 = calculateAverageScore(entries2);
            const stddev2   = calculateStandardDeviation(entries2, avgScore2);
            const scored2   = calculateTiers(entries2, avgScore2, stddev2, tierConfig);

            // 두 데이터셋 비교
            const comparisonData = compareData(scored1, scored2);

            // 비교 데이터 정렬 (기본은 점수 차이?)
            // 초기 정렬 컬럼을 '점수 차이'로 설정하고 싶다면 여기서 조정
            // currentSortColumn = '점수 차이'; // 필요에 따라
            // currentSortAsc = false; // 필요에 따라
            const sortedComparisonData = sortData(comparisonData, currentSortColumn, currentSortAsc); // common.js 함수 재사용

            lastData = sortedComparisonData; // 비교 데이터를 lastData에 저장
            renderComparisonTable(sortedComparisonData); // 비교 테이블 렌더링
        })
        .catch(err => {
            console.error('비교 데이터 로드 실패:', err);
            dataContainer.innerText = `비교 데이터를 불러오는 데 실패했습니다: ${err.message}`;
        });
    }

    // 6) 기간별 데이터 추출 (common.js에 있는 함수를 복사 또는 직접 사용)
    // common.js에 이미 있으므로 여기서 다시 정의하지 않아도 됩니다.
    // 만약 독립적으로 사용하려면 common.js에서 가져와야 합니다.
    // const extractPeriodEntries = window.extractPeriodEntries; // common.js가 window에 노출되어 있다면 이렇게 접근
    // 또는 script 태그 순서로 인해 바로 사용 가능

    // 7) 두 데이터셋 비교 로직 (새 함수)
    function compareData(data1, data2) {
        const map1 = Object.fromEntries(data1.map(d => [d['실험체'], d]));
        const map2 = Object.fromEntries(data2.map(d => [d['실험체'], d]));

        const allCharacters = new Set([...Object.keys(map1), ...Object.keys(map2)]);
        const comparisonResult = [];

        // 비교 대상 컬럼들
        const compareCols = ['점수', '티어', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위'];

        allCharacters.forEach(charName => {
            const d1 = map1[charName] || {}; // 첫 번째 데이터에 없으면 빈 객체
            const d2 = map2[charName] || {}; // 두 번째 데이터에 없으면 빈 객체

            const result = { '실험체': charName };

            compareCols.forEach(col => {
                const val1 = d1[col] !== undefined ? d1[col] : null;
                const val2 = d2[col] !== undefined ? d2[col] : null;

                // 컬럼별로 데이터 저장
                result[`${col} (Ver1)`] = val1;
                result[`${col} (Ver2)`] = val2;

                // '티어'를 제외한 숫자 컬럼은 차이 계산
                if (col !== '티어') {
                    // 둘 다 null이 아니면 차이 계산, 아니면 null
                    result[`${col} 차이`] = (val1 !== null && val2 !== null) ? (val2 - val1) : null;
                } else {
                    // 티어 차이는 문자열로 표시하거나 다르게 처리 가능
                    // 간단하게는 차이를 표시하지 않거나, 특정 포맷으로 표시
                    // 예: "S+ -> S"
                    if (val1 !== null && val2 !== null) {
                         result['티어 변화'] = `${val1} → ${val2}`;
                    } else if (val2 !== null) { // Ver1에는 없는데 Ver2에 생김
                         result['티어 변화'] = `신규 → ${val2}`;
                    } else if (val1 !== null) { // Ver1에는 있는데 Ver2에서 사라짐
                         result['티어 변화'] = `${val1} → 삭제`;
                    } else { // 둘 다 없음
                         result['티어 변화'] = '';
                    }
                }
            });
             // '표본수'는 차이보다는 각 버전에 대한 표본수를 보여주는 것이 나을 수 있음
             result['표본수 (Ver1)'] = d1['표본수'] !== undefined ? d1['표본수'] : 0;
             result['표본수 (Ver2)'] = d2['표본수'] !== undefined ? d2['표본수'] : 0;


            comparisonResult.push(result);
        });

        return comparisonResult;
    }


    // 8) 테이블 렌더링 (기존 로직 - 단일 데이터용)
    function renderTable(data) {
         // 이 함수는 단일 데이터 모드에서만 사용됩니다.
         // 비교 모드 렌더링 로직은 renderComparisonTable 함수에서 처리합니다.
        if (isCompareMode) return;

        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위', '표본수']; // 표본수 추가
        let html = '<table><thead><tr>';
        cols.forEach(c => {
            // 티어 컬럼은 정렬 제외
            const sortable = c !== '티어';
            html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            cols.forEach(col => {
                let val = row[col];
                // 값 포맷팅
                 if (val === undefined || val === null) {
                     val = '-'; // 데이터 없는 경우 하이픈 표시
                 } else if (col === '승률' || col === 'TOP 3' || col === '픽률') {
                     val = parseFloat(val).toFixed(2) + '%';
                 } else if (col === '점수' || col === 'RP 획득' || col === '평균 순위') {
                     val = parseFloat(val).toFixed(2);
                 }

                html += `<td>${val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        dataContainer.innerHTML = html;

        attachSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable); // 정렬 이벤트 붙이기
        if (gradientCheckbox.checked) applyGradientColorsSingle(dataContainer.querySelector('table')); // 색상 강조 적용
    }

    // 9) 비교 테이블 렌더링 (새 함수)
    function renderComparisonTable(data) {
        // 이 함수는 비교 모드에서만 사용됩니다.
         if (!isCompareMode) return;

        // 비교 테이블 컬럼 정의 (순서와 표시 방식)
        const cols = [
            '실험체',
            '점수 (Ver1)', '점수 (Ver2)', '점수 차이',
            '티어 변화', // 티어 변화 컬럼
            '픽률 (Ver1)', '픽률 (Ver2)', '픽률 차이',
            'RP 획득 (Ver1)', 'RP 획득 (Ver2)', 'RP 획득 차이',
            '승률 (Ver1)', '승률 (Ver2)', '승률 차이',
            'TOP 3 (Ver1)', 'TOP 3 (Ver2)', 'TOP 3 차이',
            '평균 순위 (Ver1)', '평균 순위 (Ver2)', '평균 순위 차이',
            '표본수 (Ver1)', '표본수 (Ver2)' // 표본수는 차이 대신 각 버전을 표시
        ];

        let html = '<table><thead><tr>';
        cols.forEach(c => {
            // 정렬 가능 여부 판단 (차이 컬럼 및 숫자 컬럼 위주)
            const sortable = c !== '실험체' && c !== '티어 변화'; // 실험체, 티어 변화는 문자열 정렬
            html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            cols.forEach(col => {
                let val = row[col];
                let displayVal = '-'; // 기본 표시값 (데이터 없을 때)

                if (val !== undefined && val !== null) {
                    // 값 포맷팅 (비교 테이블용)
                    if (col.includes('(Ver1)') || col.includes('(Ver2)')) {
                         // 원본 데이터 값
                         const originalCol = col.replace(' (Ver1)', '').replace(' (Ver2)', '');
                         if (originalCol === '승률' || originalCol === 'TOP 3' || originalCol === '픽률') {
                             displayVal = parseFloat(val).toFixed(2) + '%';
                         } else if (originalCol === '점수' || originalCol === 'RP 획득' || originalCol === '평균 순위') {
                              displayVal = parseFloat(val).toFixed(2);
                         } else if (originalCol === '표본수') {
                             displayVal = val.toString();
                         } else { // 티어, 실험체 등
                             displayVal = val;
                         }
                    } else if (col.includes(' 차이')) {
                        // 차이 값
                         if (val > 0) displayVal = `+${val.toFixed(2)}`;
                         else if (val < 0) displayVal = val.toFixed(2);
                         else displayVal = val.toFixed(2);
                    } else if (col === '티어 변화') {
                         displayVal = val;
                    } else { // 실험체
                         displayVal = val;
                    }
                }

                 html += `<td>${displayVal}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        dataContainer.innerHTML = html;

        // 비교 테이블용 정렬 이벤트 부착 (차이 컬럼도 포함)
        attachSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderComparisonTable);
        // 비교 모드 색상 강조 (차이 값에 적용)
        applyGradientColorsComparison(dataContainer.querySelector('table'));
    }

    // 10) 정렬 이벤트 리스너 부착 헬퍼 함수
    function attachSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
            const col = th.dataset.col;

            // ▶ data-arrow 리셋 (기존 HTML 함수에서 분리)
            th.setAttribute('data-arrow', '');

            if (col === currentSortColumn) {
                th.setAttribute('data-arrow', currentSortAsc ? '▲' : '▼');
            }

            // 기존 이벤트 리스너 제거 방지 또는 추가 방지 필요 (DOMContentLoaded 밖에서 호출되므로 주의)
            // 단순화 위해 매번 새로 붙이는 것으로 가정 (성능 최적화 필요 시 개선)
            th.onclick = () => {
                if (currentSortColumn === col) currentSortAsc = !currentSortAsc;
                else {
                    currentSortColumn = col;
                    // 차이 컬럼은 기본 내림차순 (값이 클수록 좋음)
                    if (col.includes(' 차이') && !col.includes('평균 순위')) { // 평균 순위 차이는 값이 작을수록 좋음
                         currentSortAsc = false;
                    } else if (col.includes(' 차이') && col.includes('평균 순위')) { // 평균 순위 차이는 값이 작을수록 좋음
                         currentSortAsc = true;
                    }
                     else if (col === '실험체' || col === '티어 변화') { // 문자열은 기본 오름차순
                        currentSortAsc = true;
                    }
                    else { // 나머지 (점수, 픽률, RP획득, 승률, TOP3)는 기본 내림차순
                        currentSortAsc = false;
                    }
                    currentSortColumn = col; // 정렬 컬럼 업데이트는 여기서
                }
                // lastData는 이미 calculateTiers나 compareData를 거친 원본 데이터
                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc); // common.js 함수
                renderFunc(sortedData); // 변경된 렌더링 함수 호출
            };
        });
    }


    // 11) 그라디언트 컬러 적용 (단일 데이터용) - 기존 함수에서 분리
    const TIER_COLORS = {
        'S+': 'rgba(255,127,127, 0.3)', // 연하게
        'S':  'rgba(255,191,127, 0.3)',
        'A':  'rgba(255,223,127, 0.3)',
        'B':  'rgba(255,255,127, 0.3)',
        'C':  'rgba(191,255,127, 0.3)',
        'D':  'rgba(127,255,127, 0.3)',
        'F':  'rgba(127,255,255, 0.3)',
    };
     // 색상 보간 헬퍼는 common에 두거나 여기에 둘 수 있음 (여기에 두는 걸로 가정)
     function interpolateColor(start, end, ratio) {
        const t = Math.max(0, Math.min(1, ratio));
        const rgb = start.map((s,i) => Math.round(s + (end[i] - s) * t));
        // 불투명도 추가
        return `rgba(${rgb.join(',')}, ${0.3 + 0.5 * t})`; // 중앙은 연하게, 극단값은 진하게
    }

    function applyGradientColorsSingle(table) {
        if (!table) return; // 테이블 요소 없으면 종료
        const rows = [...table.querySelectorAll('tbody tr')];
        const headers = [...table.querySelectorAll('thead th')];
        // 그라디언트 적용 대상 컬럼 (단일 모드)
        const goodCols = ['점수','픽률','RP 획득','승률','TOP 3']; // 높을수록 좋은 값
        const badCols = ['평균 순위']; // 낮을수록 좋은 값

        headers.forEach((th, i) => {
            const col = th.dataset.col;
            if (![...goodCols, ...badCols].includes(col)) return;

            const values = rows.map(r => {
                 const text = r.children[i].textContent.replace('%','');
                 const val = parseFloat(text);
                 return isNaN(val) ? null : val; // 숫자가 아니면 null 처리
            }).filter(v => v !== null); // null 값 제외하고 통계 계산

            if (values.length === 0) return; // 유효한 값이 없으면 색칠 안 함

            const avg = values.reduce((a,b)=>a+b,0)/values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);

            rows.forEach((r, idx) => {
                const cellText = r.children[i].textContent.replace('%','');
                const v = parseFloat(cellText);

                if (isNaN(v) || v === null) {
                     r.children[i].style.backgroundColor = ''; // 숫자가 아니면 배경색 제거
                     return;
                }

                let ratio, color;
                const isBad = badCols.includes(col); // 평균 순위

                if (!isBad) { // 높을수록 좋음 (점수, 픽률, RP획득, 승률, TOP3)
                    // avg를 기준으로 0.5 (중앙)
                    // min을 기준으로 0
                    // max를 기준으로 1
                    if (v >= avg) {
                        ratio = (max === avg) ? 0.5 : 0.5 + (v - avg) / (max - avg) * 0.5; // avg~max를 0.5~1 범위로 매핑
                    } else {
                         ratio = (avg === min) ? 0.5 : 0.5 - (avg - v) / (avg - min) * 0.5; // min~avg를 0~0.5 범위로 매핑
                    }
                    // 색상: 파랑(0)~하양(0.5)~빨강(1)
                    color = interpolateColor([164,194,244], [255,255,255], Math.max(0, ratio*2)) // 파랑 -> 하양 (0~0.5 범위)
                    if (ratio > 0.5) { // 하양 -> 빨강 (0.5~1 범위)
                         color = interpolateColor([255,255,255], [230,124,115], Math.max(0, (ratio-0.5)*2));
                    }

                } else { // 낮을수록 좋음 (평균 순위) - 색상 반전
                     if (v <= avg) {
                        ratio = (avg === min) ? 0.5 : 0.5 + (avg - v) / (avg - min) * 0.5; // min~avg를 0.5~1 범위로 매핑
                    } else {
                         ratio = (max === avg) ? 0.5 : 0.5 - (v - avg) / (max - avg) * 0.5; // avg~max를 0~0.5 범위로 매핑
                    }
                     // 색상: 빨강(0)~하양(0.5)~파랑(1)
                     color = interpolateColor([230,124,115], [255,255,255], Math.max(0, ratio*2)); // 빨강 -> 하양 (0~0.5 범위)
                     if (ratio > 0.5) { // 하양 -> 파랑 (0.5~1 범위)
                         color = interpolateColor([255,255,255], [164,194,244], Math.max(0, (ratio-0.5)*2));
                     }
                }
                 r.children[i].style.backgroundColor = color;
            });
        });

        // 티어 컬럼 색상 적용 (단일 모드)
        const tierColIndex = headers.findIndex(th => th.dataset.col === '티어');
        if (tierColIndex >= 0) {
            rows.forEach(tr => {
                const tierValue = tr.children[tierColIndex].textContent.trim();
                const color = TIER_COLORS[tierValue];
                if (color) {
                    tr.children[tierColIndex].style.backgroundColor = color;
                } else {
                    tr.children[tierColIndex].style.backgroundColor = ''; // 해당 티어 색상 없으면 제거
                }
            });
        }
    }


    // 12) 그라디언트 컬러 적용 (비교 데이터용) - 새 함수
     function applyGradientColorsComparison(table) {
         if (!table) return; // 테이블 요소 없으면 종료
         const rows = [...table.querySelectorAll('tbody tr')];
         const headers = [...table.querySelectorAll('thead th')];

         // 그라디언트 적용 대상 컬럼 (비교 모드 - 주로 차이 컬럼)
         // 값이 클수록 좋은 차이: 점수 차이, 픽률 차이, RP 획득 차이, 승률 차이, TOP 3 차이
         const goodDiffCols = ['점수 차이', '픽률 차이', 'RP 획득 차이', '승률 차이', 'TOP 3 차이'];
         // 값이 작을수록 좋은 차이: 평균 순위 차이
         const badDiffCols = ['평균 순위 차이'];
         // 티어 변화는 색상 코드 직접 적용

         headers.forEach((th, i) => {
             const col = th.dataset.col;

             const isGoodDiff = goodDiffCols.includes(col);
             const isBadDiff = badDiffCols.includes(col);

             if (!isGoodDiff && !isBadDiff && col !== '티어 변화') return; // 대상 컬럼 아니면 종료

             const values = rows.map(r => {
                 const text = r.children[i].textContent.replace('%','').replace('+',''); // + 기호 제거 후 파싱
                 const val = parseFloat(text);
                 return isNaN(val) ? null : val;
             }).filter(v => v !== null);

             if (values.length === 0) return;

             const min = Math.min(...values);
             const max = Math.max(...values);

             rows.forEach((r, idx) => {
                 const cellText = r.children[i].textContent.replace('%','').replace('+','');
                 const v = parseFloat(cellText);

                 if (isNaN(v) || v === null) {
                     if (col !== '티어 변화') r.children[i].style.backgroundColor = ''; // 숫자가 아니면 배경색 제거 (티어 변화는 제외)
                     return;
                 }

                 let ratio, color;

                 if (isGoodDiff) { // 차이가 양수일수록 좋음 (빨강/파랑)
                     // 음수 범위: min ~ 0 -> 파랑 계열
                     // 양수 범위: 0 ~ max -> 빨강 계열
                     if (v >= 0) {
                         ratio = (max === 0) ? 0 : v / max; // 0 ~ max를 0 ~ 1로 매핑
                         color = interpolateColor([255,255,255], [230,124,115], ratio); // 하양 -> 빨강
                     } else {
                         ratio = (min === 0) ? 0 : v / min; // min ~ 0을 1 ~ 0으로 매핑 (v가 음수, min도 음수)
                         color = interpolateColor([255,255,255], [164,194,244], 1 - ratio); // 하양 -> 파랑
                     }
                 } else if (isBadDiff) { // 차이가 음수일수록 좋음 (평균 순위 차이 - 빨강/파랑 반전)
                     // 양수 범위: 0 ~ max -> 파랑 계열 (나빠짐)
                     // 음수 범위: min ~ 0 -> 빨강 계열 (좋아짐)
                     if (v <= 0) {
                         ratio = (min === 0) ? 0 : v / min; // min ~ 0을 0 ~ 1로 매핑 (v가 음수, min도 음수)
                         color = interpolateColor([255,255,255], [230,124,115], ratio); // 하양 -> 빨강
                     } else {
                         ratio = (max === 0) ? 0 : v / max; // 0 ~ max를 1 ~ 0으로 매핑
                         color = interpolateColor([255,255,255], [164,194,244], 1 - ratio); // 하양 -> 파랑
                     }
                 }

                 r.children[i].style.backgroundColor = color;
             });
         });

         // 티어 변화 컬럼 색상 적용 (비교 모드)
         const tierChangeColIndex = headers.findIndex(th => th.dataset.col === '티어 변화');
         if (tierChangeColIndex >= 0) {
             rows.forEach(tr => {
                 const cell = tr.children[tierChangeColIndex];
                 const tierChange = cell.textContent.trim();
                 cell.style.backgroundColor = ''; // 기존 배경색 초기화

                 if (tierChange.includes('→')) {
                     const tiers = tierChange.split('→').map(t => t.trim());
                     const tier1 = tiers[0];
                     const tier2 = tiers[1];

                     // 티어 변화에 따른 색상 적용 (간단하게 개선/악화 여부로 색칠)
                     const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F', '삭제', '신규']; // 티어 순서 정의 (좋음 -> 나쁨)
                     const index1 = tierOrder.indexOf(tier1);
                     const index2 = tierOrder.indexOf(tier2);

                      if (index1 >= 0 && index2 >= 0) {
                          if (index2 < index1) { // 티어 개선 (예: B → A)
                              cell.style.backgroundColor = 'rgba(127, 255, 127, 0.3)'; // 연두색 (좋아짐)
                          } else if (index2 > index1) { // 티어 악화 (예: A → B)
                              cell.style.backgroundColor = 'rgba(255, 127, 127, 0.3)'; // 빨간색 (나빠짐)
                          }
                          // 같은 티어는 색칠 안 함
                      } else if (tierChange.includes('신규 →')) { // 신규 추가
                           cell.style.backgroundColor = 'rgba(127, 255, 255, 0.3)'; // 하늘색 (신규)
                      } else if (tierChange.includes('→ 삭제')) { // 삭제됨
                           cell.style.backgroundColor = 'rgba(200, 200, 200, 0.3)'; // 회색 (삭제)
                      }
                 }
             });
         }
     }

});