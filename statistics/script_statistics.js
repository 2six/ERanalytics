// script_statistics.js
document.addEventListener('DOMContentLoaded', function() {
    // common.js에 정의된 함수/변수들은 이제 전역 스코프에 있으므로 바로 사용 가능합니다.
    // 예: parseINI, populateVersionDropdown, calculateTiers, sortData 등

    // DOM 요소
    const versionSelect         = document.getElementById('version-select');
    const tierSelect            = document.getElementById('tier-select');
    const periodSelect          = document.getElementById('period-select');
    const gradientCheckbox      = document.getElementById('gradient-checkbox');
    const dataContainer         = document.getElementById('data-container');
    const compareModeLabel      = document.getElementById('compare-mode-label'); // 비교 모드 레이블

    // 비교 모드 관련 요소
    const comparisonControlsDiv = document.getElementById('comparison-controls');
    const versionSelectCompare  = document.getElementById('version-select-compare');
    const tierSelectCompare     = document.getElementById('tier-select-compare');
    const periodSelectCompare   = document.getElementById('period-select-compare');

    // 상태
    let currentSortColumn = '점수';      // 기본 정렬 컬럼 (단일 모드)
    let currentSortAsc    = false;       // 기본 정렬 방향 (내림차순)
    let currentSortMode   = 'value';     // 'value', 'delta' 정렬 모드 추가
    let lastData          = [];          // 마지막으로 렌더링된 데이터 (비교 모드에서는 병합된 데이터)
    let tierConfig        = null;        // INI 파일에서 로드된 티어 설정

    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);
    // 비교 모드 활성화 여부 확인
    const isCompareMode = params.get('compare') === '1';

    // 1) URL 파라미터 → 컨트롤에 반영 (이전과 동일)
    function applyParamsToControls() {
        // 기본 데이터 선택
        if (params.has('version'))  versionSelect.value    = params.get('version');
        if (params.has('tier'))     tierSelect.value       = params.get('tier');
        if (params.has('period'))   periodSelect.value     = params.get('period');

        // 색상 강조 (기본 모드에서만 URL 적용, 비교 모드는 JS에서 강제 활성화 및 URL 미저장)
        if (!isCompareMode && params.has('gradient')) gradientCheckbox.checked = params.get('gradient') === '1';

        // 비교 모드일 경우, 비교 컨트롤의 파라미터도 반영
        if (isCompareMode) {
            // 기본값 설정 또는 URL 파라미터 반영
            // version2, tier2, period2 파라미터 사용
            versionSelectCompare.value = params.get('version2') || versionSelect.value;
            tierSelectCompare.value    = params.get('tier2')    || tierSelect.value;
            periodSelectCompare.value  = params.get('period2')  || periodSelect.value;

            // 비교 모드에서는 색상 강조 항상 켜짐 및 체크박스 비활성화
            gradientCheckbox.checked = true;
            gradientCheckbox.disabled = true;
            gradientCheckbox.parentElement.style.opacity = '0.5'; // 비활성 시 시각적 표시
        } else {
             // 비교 모드가 아닐 때는 비활성화 해제 및 투명도 복원
             gradientCheckbox.disabled = false;
             gradientCheckbox.parentElement.style.opacity = '1';
        }
    }

    // 2) 컨트롤 상태 → URL에 반영 (이전과 동일)
    function updateURL() {
        // 기본 데이터 상태 저장
        params.set('version', versionSelect.value);
        params.set('tier',    tierSelect.value);
        params.set('period',  periodSelect.value);

        if (!isCompareMode) {
            // 기본 모드에서는 gradient 상태만 저장
            params.set('gradient', gradientCheckbox.checked ? '1' : '0');
            // 비교 모드 파라미터 제거
            params.delete('version2');
            params.delete('tier2');
            params.delete('period2');
            params.delete('compare');
        } else {
            // 비교 모드에서는 비교 컨트롤 상태도 저장
            params.set('version2', versionSelectCompare.value);
            params.set('tier2',    tierSelectCompare.value);
            params.set('period2',  periodSelectCompare.value);
            params.set('compare', '1'); // 비교 모드 파라미터 유지

            // gradient 파라미터는 비교 모드에서 사용되지 않으므로 제거
            params.delete('gradient');
        }

        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
    }

    // 3) 초기화 로직 (이전과 동일, 정렬 기본값 변경)
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
        const config = parseINI(iniText); // common.js 함수 사용
        tierConfig   = config.tiers; // 전역 변수에 저장

        // common.js 에 정의된 함수들로 드롭다운 채우기
        populateVersionDropdown(versionSelect, versionList); // common.js 함수 사용
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        // 비교 모드일 경우, 비교 드롭다운도 채우고 보이게 함
        if (isCompareMode) {
            comparisonControlsDiv.style.display = 'flex'; // flex로 변경
            compareModeLabel.style.display = 'inline'; // 레이블 표시
            populateVersionDropdown(versionSelectCompare, versionList);
            populateTierDropdown(tierSelectCompare);
            populatePeriodDropdown(periodSelectCompare);

            // 비교 모드 기본 정렬 컬럼/모드 설정 (변화량 기준으로 시작)
            currentSortColumn = '점수'; // 점수 컬럼에서 변화량 정렬 시작
            currentSortAsc = false; // 초기 방향은 중요치 않음 (mode가 delta로 시작하므로)
            currentSortMode = 'delta'; // 변화량 기준 정렬로 시작
        } else {
             // 단일 모드 기본 정렬 (기존과 동일)
             currentSortColumn = '점수';
             currentSortAsc = false;
             currentSortMode = 'value';
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
            if (!isCompareMode && lastData && lastData.length > 0) renderTable(lastData);
        });

        if (isCompareMode) {
            versionSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            tierSelectCompare.addEventListener('change',    () => { updateURL(); reloadData(); });
            periodSelectCompare.addEventListener('change',  () => { updateURL(); reloadData(); });
        }

        // 첫 로드
        reloadData();

    }).catch(err => {
        console.error('초기화 실패:', err);
        dataContainer.innerHTML = '초기 설정 로드에 실패했습니다.';
    });

    // 4) 단일 데이터 로드 ∙ 가공 ∙ 렌더 (이전과 동일)
    function loadAndDisplaySingle() {
        dataContainer.innerHTML = '데이터 로딩 중...'; // 로딩 메시지
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
                const entries = extractPeriodEntries(history, period); // common.js 함수 사용

                const avgScore = calculateAverageScore(entries); // common.js 함수 사용
                const stddev   = calculateStandardDeviation(entries, avgScore); // common.js 함수 사용

                let scored = calculateTiers(entries, avgScore, stddev, tierConfig); // common.js 함수 사용
                // 단일 모드 정렬은 항상 'value' 모드
                currentSortMode = 'value'; // 단일 모드임을 명시적으로 설정
                scored = sortData(scored, currentSortColumn, currentSortAsc); // common.js 함수 사용

                lastData = scored;
                renderTable(scored);
            })
            .catch(err => {
                console.error('데이터 로드 실패:', err);
                dataContainer.innerHTML = `데이터를 불러오는 데 실패했습니다: ${err.message}`;
            });
    }

    // 5) 비교 데이터 로드 ∙ 가공 ∙ 렌더 (수정 필요)
    function loadAndDisplayComparison() {
        dataContainer.innerHTML = '비교 데이터 로딩 중...'; // 로딩 메시지
        const version1 = versionSelect.value;
        const tier1    = tierSelect.value;
        const period1  = periodSelect.value; // 데이터 1의 기간

        const version2 = versionSelectCompare.value;
        const tier2    = tierSelectCompare.value;
        const period2  = periodSelectCompare.value; // 데이터 2의 기간

        // URL이 동일하면 데이터 1과 데이터 2가 같으므로 비교 의미 없음
        if (version1 === version2 && tier1 === tier2 && period1 === period2) {
             dataContainer.innerHTML = '데이터 1과 데이터 2가 동일합니다.';
             lastData = [];
             return;
        }

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

            // 각 데이터셋에 대해 선택된 기간의 데이터 추출 (common.js 함수 사용)
            const entries1 = extractPeriodEntries(history1, period1);
            const entries2 = extractPeriodEntries(history2, period2);

             // 각 데이터셋에 대해 점수/티어 계산 (common.js 함수 사용)
            const avgScore1 = calculateAverageScore(entries1);
            const stddev1   = calculateStandardDeviation(entries1, avgScore1);
            const scored1   = calculateTiers(entries1, avgScore1, stddev1, tierConfig);

            const avgScore2 = calculateAverageScore(entries2);
            const stddev2   = calculateStandardDeviation(entries2, avgScore2);
            const scored2   = calculateTiers(entries2, avgScore2, stddev2, tierConfig);

            // 두 데이터셋 병합 및 차이 계산 (새로운 병합 함수 호출)
            const comparisonData = mergeDataForComparison(scored1, scored2);

             // 정렬 (비교 모드에서는 병합된 데이터를 정렬)
             // currentSortColumn, currentSortAsc, currentSortMode 상태 사용
            const sortedComparisonData = sortData(comparisonData, currentSortColumn, currentSortAsc, currentSortMode); // common.js 함수 사용


            lastData = sortedComparisonData; // 비교 데이터를 lastData에 저장
            renderComparisonTable(sortedComparisonData); // 비교 테이블 렌더링
        })
        .catch(err => {
            console.error('비교 데이터 로드 실패:', err);
            dataContainer.innerHTML = `비교 데이터를 불러오는 데 실패했습니다: ${err.message}`;
        });
    }

    // 6) 두 데이터셋 병합 및 변화량 계산 (수정된 병합 함수)
    function mergeDataForComparison(data1, data2) {
        // 데이터 1과 데이터 2를 '실험체' 이름 기준으로 맵으로 만듭니다.
        const map1 = Object.fromEntries(data1.map(d => [d['실험체'], d]));
        const map2 = Object.fromEntries(data2.map(d => [d['실험체'], d]));

        // 두 데이터셋에 등장하는 모든 실험체 이름을 모읍니다.
        const allCharacters = new Set([...Object.keys(map1), ...Object.keys(map2)]);
        const comparisonResult = [];

        // 순위 계산을 위해 data1, data2를 점수 기준으로 미리 정렬합니다. (동점 시 이름순)
        const sortedData1 = [...data1].sort((a,b) => {
             if (b['점수'] !== a['점수']) return b['점수'] - a['점수'];
             return String(a['실험체']).localeCompare(String(b['실험체']));
        });
         const sortedData2 = [...data2].sort((a,b) => {
             if (b['점수'] !== a['점수']) return b['점수'] - a['점수'];
             return String(a['실험체']).localeCompare(String(b['실험체']));
        });

        const rankMap1 = Object.fromEntries(sortedData1.map((d, i) => [d['실험체'], i + 1])); // 1부터 시작하는 순위
        const rankMap2 = Object.fromEntries(sortedData2.map((d, i) => [d['실험체'], i + 1]));


        allCharacters.forEach(charName => {
            const d1 = map1[charName]; // 데이터 1의 정보
            const d2 = map2[charName]; // 데이터 2의 정보

            const result = { '실험체': charName };

            // 각 스탯별 값과 변화량을 저장
            const statsCols = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수']; // 순위는 별도 계산

            statsCols.forEach(col => {
                 const val1 = d1 ? d1[col] : null;
                 const val2 = d2 ? d2[col] : null;

                 // 결과 객체에 데이터 1 값과 데이터 2 값을 모두 저장 (렌더링 시 필요)
                 result[`${col} (Ver1)`] = val1;
                 result[`${col} (Ver2)`] = val2;

                 // 변화량 계산 (둘 다 숫자인 경우)
                 if (typeof val1 === 'number' && typeof val2 === 'number') {
                      result[`${col} 변화량`] = val2 - val1; // 예: 점수 변화량, 픽률 변화량
                 } else {
                      result[`${col} 변화량`] = null; // 비교 불가
                 }
            });

            // 티어 변화 계산
             const tier1 = d1 ? d1['티어'] : '삭제'; // 데이터 1에 없으면 '삭제'로 간주
             const tier2 = d2 ? d2['티어'] : '삭제'; // 데이터 2에 없으면 '삭제'로 간주

             if (!d1 && d2) { // 데이터 1에 없고 데이터 2에만 있음 -> 신규
                 result['티어 변화'] = `신규 → ${tier2}`;
             } else if (d1 && !d2) { // 데이터 1에만 있고 데이터 2에 없음 -> 삭제
                 result['티어 변화'] = `${tier1} → 삭제`;
             } else if (d1 && d2) { // 둘 다 있음
                 if (tier1 === tier2) {
                      result['티어 변화'] = tier1; // 티어 변화 없으면 현재 티어만 표시
                 } else {
                      result['티어 변화'] = `${tier1} → ${tier2}`; // 티어 변화 표시
                 }
             } else { // 둘 다 없음 (발생하지 않아야 함)
                 result['티어 변화'] = '-';
             }

            // 순위 변화 계산 (점수 기준)
            const rank1 = rankMap1[charName]; // undefined 또는 숫자
            const rank2 = rankMap2[charName]; // undefined 또는 숫자

            result['순위 (Ver1)'] = rank1;
            result['순위 (Ver2)'] = rank2;

            if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                result['순위 변화'] = rank2 - rank1; // 예: 10위 -> 8위 -> -2
            } else if (typeof rank1 === 'number') {
                 result['순위 변화'] = `→ 삭제`; // 데이터 2에서 삭제됨
            } else if (typeof rank2 === 'number') {
                 result['순위 변화'] = `신규 → `; // 데이터 1에 없었는데 신규 추가됨
            } else {
                 result['순위 변화'] = '-'; // 둘 다 순위 정보 없음
            }

            comparisonResult.push(result);
        });

        return comparisonResult;
    }

     // 7) 비교 테이블 렌더링 (수정된 렌더링 함수)
    function renderComparisonTable(data) {
         if (!isCompareMode) return;

        // 단일 모드와 동일한 컬럼 목록 사용
        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위', '표본수'];

        let html = '<table><thead><tr>';
        cols.forEach(c => {
            // 티어 컬럼은 정렬 제외 (티어 변화는 순위 변화와 함께 따로 처리)
            const sortable = c !== '티어';
            // data-col 속성에는 원래 컬럼 이름 사용 ('점수', '픽률' 등)
            html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            cols.forEach(col => {
                let displayVal = '-'; // 기본 표시값
                let cellClasses = []; // 셀에 추가할 클래스 (색상 강조용)

                // 각 컬럼에 대해 데이터 1의 값과 변화량을 조합하여 표시
                 if (col === '실험체') {
                     displayVal = row['실험체'] || '-';
                 } else if (col === '티어') {
                     // 티어 컬럼에는 티어 변화 정보 표시
                     displayVal = row['티어 변화'] || '-';
                     // 티어 변화에 따른 클래스 추가 (applyGradientColorsComparison에서 색칠)
                 } else if (col === '표본수') {
                      // 표본수는 Ver1 값과 Ver2 값을 나란히 표시
                      const val1 = row['표본수 (Ver1)'] !== null && row['표본수 (Ver1)'] !== undefined ? row['표본수 (Ver1)'] : '-';
                      const val2 = row['표본수 (Ver2)'] !== null && row['표본수 (Ver2)'] !== undefined ? row['표본수 (Ver2)'] : '-';
                      displayVal = `${val1} / ${val2}`; // 예: 100 / 120
                 } else { // 그 외 숫자 스탯 컬럼 (점수, 픽률 등)
                      const val1 = row[`${col} (Ver1)`]; // 데이터 1의 값
                      const val2 = row[`${col} (Ver2)`]; // 데이터 데이터 2의 값
                      const delta = row[`${col} 변화량`]; // 변화량

                      // 데이터 1 값이 기본 표시값
                      let valueText = (typeof val1 === 'number') ? val1.toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2) : '-';
                      if (['픽률', '승률', 'TOP 3'].includes(col) && typeof val1 === 'number') valueText += '%';

                       // 변화량 텍스트
                      let deltaText = '';
                      if (typeof delta === 'number') {
                          const deltaFormatted = Math.abs(delta).toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2);
                           if (delta > 0) deltaText = `▲+${deltaFormatted}`;
                           else if (delta < 0) deltaText = `▼${deltaFormatted}`;
                           else deltaText = '0.00'; // 변화 없으면 0.00
                      } else {
                           // 둘 중 하나라도 데이터가 없거나 변화량 계산 불가 시
                           if (val1 === null && val2 !== null) deltaText = '신규'; // 데이터 1에 없었는데 데이터 2에 생김
                           else if (val1 !== null && val2 === null) deltaText = '삭제'; // 데이터 1에 있었는데 데이터 2에 사라짐
                           else deltaText = '-'; // 둘 다 없음 또는 기타 불가

                      }

                       // 최종 표시될 내용 조합
                       if (deltaText === '-' && valueText === '-') {
                           displayVal = '-'; // 둘 다 데이터 없고 변화량도 없으면 하이픈
                       } else if (deltaText === '신규' || deltaText === '삭제') {
                            displayVal = `${valueText} (${deltaText})`; // 예: - (신규) 또는 10.5 (삭제)
                       } else {
                            displayVal = `${valueText} ${deltaText}`; // 예: 11.2 ▼0.8
                       }


                      // 색상 강조를 위해 변화량 값 또는 상태를 data-delta 속성으로 저장 (applyGradientColorsComparison에서 사용)
                      // 숫자 변화량은 data-delta에 숫자 값 저장
                      // 신규/삭제는 data-delta에 문자열 저장
                      if (typeof delta === 'number') {
                           cell.dataset.delta = delta;
                      } else if (deltaText === '신규' || deltaText === '삭제') {
                            cell.dataset.delta = deltaText;
                      } else {
                           cell.dataset.delta = 'none'; // 변화량 정보 없음
                      }
                 }

                 // 순위 변화는 '평균 순위' 컬럼에 함께 표시하거나, '티어' 컬럼 옆에 '순위' 컬럼 추가 가능
                 // 여기서는 '티어' 컬럼 옆에 '순위' 컬럼을 추가하는 것이 더 명확할 것 같습니다.
                 // 하지만 요구사항은 "기존 테이블 구조 유지"였으므로, 일단 '티어' 컬럼이나 다른 컬럼에 통합하지 않고 순위 변화 컬럼을 분리해서 생각해 봅니다.
                 // 요구사항을 충족시키기 위해 '티어' 컬럼에 '티어 변화'를, '평균 순위' 컬럼에 '평균 순위'와 '순위 변화'를 함께 표시하는 방식도 고려할 수 있습니다.
                 // 예: 평균 순위 열: 4.5 ▼0.2 (10위 → 12위 ▼2)
                 // 이 방식은 복잡하므로, 우선은 각 컬럼에 해당 스탯의 변화량만 표시하고, 순위 변화는 '실험체' 옆에 '순위 변화' 컬럼으로 분리하거나, 아니면 툴팁에 포함시키는 것을 고려해봅시다.
                 // 요구사항대로 "기존 테이블 각 컨텐츠 끝에 상승/하락폭 기재" 하려면, '점수' 컬럼 끝에 점수 변화량, '픽률' 컬럼 끝에 픽률 변화량 ... 이렇게 가는 것이 맞습니다.

                 // 실험체 이름 옆에 순위(ver1)와 순위 변화를 표시하는 것이 자연스러울 수 있습니다.
                 // 예: 실험체 (10위 ▼2)
                 if (col === '실험체') {
                     const charName = row['실험체'] || '-';
                     const rank1 = row['순위 (Ver1)'];
                     const rankChange = row['순위 변화'];

                     let rankText = '';
                      if (typeof rank1 === 'number') {
                          rankText = `${rank1}위`;
                           if (typeof rankChange === 'number' && rankChange !== 0) {
                               const rankChangeFormatted = Math.abs(rankChange);
                                rankText += rankChange < 0 ? ` ▼${rankChangeFormatted}` : ` ▲+${rankChangeFormatted}`; // 순위 숫자가 작아지면 개선 (▼), 커지면 악화 (▲)
                           } else if (rankChange === '→ 삭제') {
                                rankText += ` (삭제)`;
                           }
                      } else if (rankChange === '신규 → ') {
                           rankText = `(신규)`;
                      } else {
                           rankText = ''; // 순위 정보 없음
                      }


                     displayVal = `${charName} ${rankText ? `(${rankText})` : ''}`;

                      // 순위 변화 색상 강조를 위해 data-rank-delta 속성 사용 (applyGradientColorsComparison에서 사용)
                      if (typeof rankChange === 'number') {
                          cell.dataset.rankdelta = rankChange;
                      } else if (rankChange === '신규 → ') {
                          cell.dataset.rankdelta = 'new';
                      } else if (rankChange === '→ 삭제') {
                          cell.dataset.rankdelta = 'removed';
                      } else {
                          cell.dataset.rankdelta = 'none';
                      }


                 }


                 html += `<td data-col="${col}">${displayVal}</td>`; // data-col 속성 추가
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        dataContainer.innerHTML = html;

        // 비교 테이블용 정렬 이벤트 부착
        attachComparisonSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderComparisonTable);
        // 비교 모드 색상 강조
        applyGradientColorsComparison(dataContainer.querySelector('table')); // common.js 함수 사용
    }


    // 8) 테이블 렌더링 (기존 로직 - 단일 데이터용) - 이전 코드와 동일, 함수 호출 방식만 변경
    function renderTable(data) {
         if (isCompareMode) return;

        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위', '표본수'];
        let html = '<table><thead><tr>';
        cols.forEach(c => {
            const sortable = c !== '티어';
            html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
        });
        html += '</tr></thead><tbody>';

        data.forEach(row => {
            html += '<tr>';
            cols.forEach(col => {
                let val = row[col];
                 if (val === undefined || val === null) {
                     val = '-';
                 } else if (col === '승률' || col === 'TOP 3' || col === '픽률') {
                     val = parseFloat(val).toFixed(2) + '%';
                 } else if (col === '점수' || col === 'RP 획득' || col === '평균 순위') {
                     val = parseFloat(val).toFixed(2);
                 } else if (col === '표본수') {
                     val = val !== null && val !== undefined ? val.toString() : '-';
                 } else {
                     val = val;
                 }

                html += `<td data-col="${col}">${val}</td>`; // data-col 속성 추가
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        dataContainer.innerHTML = html;

        // 단일 모드용 정렬 이벤트 부착
        attachSingleSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable);
        // 색상 강조
        if (gradientCheckbox.checked) applyGradientColorsSingle(dataContainer.querySelector('table')); // common.js 함수 사용
    }

    // 9) 단일 모드용 정렬 이벤트 리스너 부착 (이전 코드와 동일, 함수 호출 방식만 변경)
    function attachSingleSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
            const col = th.dataset.col;

            th.setAttribute('data-arrow', '');

            if (currentSortColumn === col && currentSortMode === 'value') {
                th.setAttribute('data-arrow', currentSortAsc ? '▲' : '▼');
            }

            th.onclick = () => {
                if (currentSortColumn === col) {
                     currentSortAsc = !currentSortAsc;
                } else {
                    currentSortColumn = col;
                    currentSortAsc = false;
                    currentSortMode = 'value';
                }

                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc); // common.js 함수 사용
                renderFunc(sortedData);
            };
        });
    }

    // 10) 비교 모드용 정렬 이벤트 리스너 부착 (수정 필요)
     function attachComparisonSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
             const col = th.dataset.col; // 이 값은 '점수', '픽률' 등 원래 컬럼 이름

             // 티어 컬럼은 정렬에서 제외 (티어 변화는 따로 정렬)
             if (col === '티어') {
                  th.style.cursor = 'default';
                  th.setAttribute('data-arrow', ''); // 화살표 제거
                  return;
             }
              th.style.cursor = 'pointer';


             // ▶ data-arrow 리셋
             th.setAttribute('data-arrow', '');

             // 현재 정렬 기준과 일치하면 화살표 표시
             if (currentSortColumn === col) {
                 let arrow = '';
                 if (currentSortMode === 'value') {
                     arrow = currentSortAsc ? '▲' : '▼'; // 값 기준 오름/내림차순
                 } else if (currentSortMode === 'delta') {
                     // 순위 변화는 숫자가 작아지는게 좋은 변화 (-값) 이므로 △/▽ 기호 반전
                     const isRankDelta = col === '평균 순위'; // 평균 순위 컬럼에서 순위 변화 정렬 시
                      if (isRankDelta) {
                          arrow = currentSortAsc ? '▼' : '▲'; // 순위 오름차 = 값이 작아짐 (▼), 순위 내림차 = 값이 커짐 (▲)
                      } else {
                           arrow = currentSortAsc ? '△' : '▽'; // 변화량 오름/내림차순 (다른 기호 사용)
                      }

                 }
                 th.setAttribute('data-arrow', arrow);
             }

             // 클릭 이벤트 리스너 추가
             th.onclick = () => {
                 // 정렬 로직 순환:
                 // 현재 컬럼 클릭 시:
                 // value 내림차순 (▼) -> value 오름차순 (▲) -> delta 내림차순 (▽) -> delta 오름차순 (△) -> value 내림차순 (▼) ...
                 // 다른 컬럼 클릭 시: 해당 컬럼의 value 내림차순 (▼)으로 시작

                 // '실험체' 컬럼은 value 오름/내림차순만 지원 (변화량 정렬 없음)
                  if (col === '실험체') {
                       if (currentSortColumn === col) {
                           currentSortAsc = !currentSortAsc;
                       } else {
                           currentSortColumn = col;
                           currentSortMode = 'value';
                           currentSortAsc = true; // 이름은 기본 오름차순
                       }
                  }
                  // '평균 순위' 컬럼은 value 오름/내림차순, 순위 변화(delta) 오름/내림차순 지원
                   else if (col === '평균 순위') {
                        if (currentSortColumn === col) {
                            if (currentSortMode === 'value' && !currentSortAsc) { // value ▼ -> value ▲
                                currentSortAsc = true;
                            } else if (currentSortMode === 'value' && currentSortAsc) { // value ▲ -> delta ▼ (순위 변화 내림차)
                                currentSortMode = 'delta';
                                currentSortAsc = true; // 순위 변화는 숫자가 작아지는게 좋아지는 것이므로, 오름차순이 좋아지는 순서
                            } else if (currentSortMode === 'delta' && currentSortAsc) { // delta ▼ -> delta ▲ (순위 변화 오름차)
                                currentSortAsc = false; // 순위 변화 숫자가 커지는 순서
                            } else { // delta ▲ -> value ▼ (초기 상태)
                                currentSortMode = 'value';
                                currentSortAsc = false;
                            }
                        } else {
                            currentSortColumn = col;
                            currentSortMode = 'value';
                            currentSortAsc = false; // 평균 순위는 숫자가 작을수록 좋으므로 기본 오름차순? (아니면 테이블 표시 순서대로?) -> 일단 내림차순으로
                        }
                   }
                  // 그 외 숫자 스탯 컬럼 ('점수', '픽률', 'RP 획득', '승률', 'TOP 3', '표본수')
                   else {
                        if (currentSortColumn === col) {
                            if (currentSortMode === 'value' && !currentSortAsc) { // value ▼ -> value ▲
                                currentSortAsc = true;
                            } else if (currentSortMode === 'value' && currentSortAsc) { // value ▲ -> delta ▽ (변화량 내림차)
                                currentSortMode = 'delta';
                                currentSortAsc = false; // 변화량은 클수록 좋으므로 기본 내림차순 (좋아지는 변화가 위로)
                            } else if (currentSortMode === 'delta' && !currentSortAsc) { // delta ▽ -> delta △ (변화량 오름차)
                                currentSortAsc = true;
                            } else { // delta △ -> value ▼ (초기 상태)
                                currentSortMode = 'value';
                                currentSortAsc = false;
                            }
                        } else {
                            currentSortColumn = col; // 컬럼 변경
                            currentSortMode = 'value'; // 기본은 value 모드
                            currentSortAsc = false; // 기본은 내림차순 (점수 등)
                        }
                   }


                 // 데이터 정렬
                 // sortData 함수는 common.js에 있습니다.
                 // sortData(data, column, asc, mode) 형태로 호출하도록 수정했습니다.
                 // column: 원래 컬럼 이름 ('점수', '픽률' 등)
                 // asc: 오름차순 여부 (true/false)
                 // mode: 'value' 또는 'delta'

                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode); // mode 인자 추가

                renderFunc(sortedData); // 렌더링 함수 호출 (renderComparisonTable)
             };
         });
     }
});