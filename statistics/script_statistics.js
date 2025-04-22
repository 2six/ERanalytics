// script_statistics.js
document.addEventListener('DOMContentLoaded', function() {
    // common.js에 정의된 함수/변수들은 이제 전역 스코프에 있으므로 바로 사용 가능합니다.

    // DOM 요소
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const gradientCheckbox = document.getElementById('gradient-checkbox');
    const dataContainer = document.getElementById('data-container');
    const compareModeLabel = document.getElementById('compare-mode-label');

    // 비교 모드 관련 요소
    const comparisonControlsDiv = document.getElementById('comparison-controls');
    const versionSelectCompare = document.getElementById('version-select-compare');
    const tierSelectCompare = document.getElementById('tier-select-compare');
    const periodSelectCompare = document.getElementById('period-select-compare');

    // 상태
    let currentSortColumn = '점수';
    let currentSortAsc = false;
    // 정렬 모드: 'value1' (Ver1 값), 'value2' (Ver2 값), 'delta' (변화량)
    let currentSortMode = 'value'; // 단일 모드는 'value' 고정, 비교 모드는 'value1', 'value2', 'delta'
    let lastData = [];
    let tierConfig = null;

    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);
    const isCompareMode = params.get('compare') === '1';

    // 1) URL 파라미터 → 컨트롤에 반영 (이전과 동일)
    function applyParamsToControls() {
        if (params.has('version')) versionSelect.value = params.get('version');
        if (params.has('tier')) tierSelect.value = params.get('tier');
        if (params.has('period')) periodSelect.value = params.get('period');
        if (!isCompareMode && params.has('gradient')) gradientCheckbox.checked = params.get('gradient') === '1';

        if (isCompareMode) {
            versionSelectCompare.value = params.get('version2') || versionSelect.value;
            tierSelectCompare.value = params.get('tier2') || tierSelect.value;
            periodSelectCompare.value = params.get('period2') || periodSelect.value;
            gradientCheckbox.checked = true;
            gradientCheckbox.disabled = true;
            gradientCheckbox.parentElement.style.opacity = '0.5';
        } else {
            gradientCheckbox.disabled = false;
            gradientCheckbox.parentElement.style.opacity = '1';
        }
    }

    // 2) 컨트롤 상태 → URL에 반영 (이전과 동일)
    function updateURL() {
        params.set('version', versionSelect.value);
        params.set('tier', tierSelect.value);
        params.set('period', periodSelect.value);
        if (!isCompareMode) {
            params.set('gradient', gradientCheckbox.checked ? '1' : '0');
            params.delete('version2');
            params.delete('tier2');
            params.delete('period2');
            params.delete('compare');
        } else {
            params.set('version2', versionSelectCompare.value);
            params.set('tier2', tierSelectCompare.value);
            params.set('period2', periodSelectCompare.value);
            params.set('compare', '1');
            params.delete('gradient');
        }
        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
    }

    // 3) 초기화 로직 (이전과 동일, 정렬 기본값 재조정)
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, versionList]) => {
        const config = parseINI(iniText);
        tierConfig = config.tiers;

        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        if (isCompareMode) {
            comparisonControlsDiv.style.display = 'flex';
            compareModeLabel.style.display = 'inline';
            populateVersionDropdown(versionSelectCompare, versionList);
            populateTierDropdown(tierSelectCompare);
            populatePeriodDropdown(periodSelectCompare);

            // 비교 모드 기본 정렬: 점수 Ver1 내림차순
            currentSortColumn = '점수';
            currentSortAsc = false;
            currentSortMode = 'value1'; // Ver1 기준 시작

        } else {
            // 단일 모드 기본 정렬: 점수 내림차순
            currentSortColumn = '점수';
            currentSortAsc = false;
            currentSortMode = 'value';
        }

        applyParamsToControls();

        const reloadData = isCompareMode ? loadAndDisplayComparison : loadAndDisplaySingle;

        versionSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        tierSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        periodSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        gradientCheckbox.addEventListener('change', () => {
            updateURL();
            if (!isCompareMode && lastData && lastData.length > 0) renderTable(lastData);
            // 비교 모드는 applyGradientColorsComparison가 renderComparisonTable에서 호출됨
        });

        if (isCompareMode) {
            versionSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            tierSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            periodSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
        }

        reloadData();

    }).catch(err => {
        console.error('초기화 실패:', err);
        dataContainer.innerHTML = '초기 설정 로드에 실패했습니다.';
    });

    // 4) 단일 데이터 로드 ∙ 가공 ∙ 렌더 (이전과 동일)
    function loadAndDisplaySingle() {
        dataContainer.innerHTML = '데이터 로딩 중...';
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`/data/${version}/${tier}.json`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
            .then(json => {
                const history = json['통계'];
                const entries = extractPeriodEntries(history, period);

                const avgScore = calculateAverageScore(entries);
                const stddev = calculateStandardDeviation(entries, avgScore);

                let scored = calculateTiers(entries, avgScore, stddev, tierConfig);
                currentSortMode = 'value'; // 단일 모드는 value 고정
                scored = sortData(scored, currentSortColumn, currentSortAsc, currentSortMode);

                lastData = scored;
                renderTable(scored); // 단일 모드 렌더링

            })
            .catch(err => {
                console.error('데이터 로드 실패:', err);
                dataContainer.innerHTML = `데이터를 불러오는 데 실패했습니다: ${err.message}`;
            });
    }

    // 5) 비교 데이터 로드 ∙ 가공 ∙ 렌더 (이전과 동일)
    function loadAndDisplayComparison() {
        dataContainer.innerHTML = '비교 데이터 로딩 중...';
        const version1 = versionSelect.value;
        const tier1 = tierSelect.value;
        const period1 = periodSelect.value;

        const version2 = versionSelectCompare.value;
        const tier2 = tierSelectCompare.value;
        const period2 = periodSelectCompare.value;

        if (version1 === version2 && tier1 === tier2 && period1 === period2) {
            dataContainer.innerHTML = '데이터 1과 데이터 2가 동일합니다.';
            lastData = [];
            return;
        }

        const url1 = `/data/${version1}/${tier1}.json`;
        const url2 = `/data/${version2}/${tier2}.json`;

        Promise.all([
            fetch(url1).then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            }),
            fetch(url2).then(res => {
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                return res.json();
            })
        ])
        .then(([json1, json2]) => {
            const history1 = json1['통계'];
            const history2 = json2['통계'];

            const entries1 = extractPeriodEntries(history1, period1);
            const entries2 = extractPeriodEntries(history2, period2);

            const avgScore1 = calculateAverageScore(entries1);
            const stddev1 = calculateStandardDeviation(entries1, avgScore1);
            const scored1 = calculateTiers(entries1, avgScore1, stddev1, tierConfig);

            const avgScore2 = calculateAverageScore(entries2);
            const stddev2 = calculateStandardDeviation(entries2, avgScore2);
            const scored2 = calculateTiers(entries2, avgScore2, stddev2, tierConfig);

            // 두 데이터셋 병합 및 차이 계산
            const comparisonData = mergeDataForComparison(scored1, scored2);

            // 정렬 (비교 모드에서는 병합된 데이터를 정렬)
            const sortedComparisonData = sortData(comparisonData, currentSortColumn, currentSortAsc, currentSortMode);

            lastData = sortedComparisonData; // 비교 데이터를 lastData에 저장
            renderComparisonTable(sortedComparisonData); // 비교 테이블 렌더링

        })
        .catch(err => {
            console.error('비교 데이터 로드 실패:', err);
            dataContainer.innerHTML = `데이터를 불러오는 데 실패했습니다: ${err.message}`;
        });
    }

    // 6) 두 데이터셋 병합 및 변화량 계산 (수정)
     function mergeDataForComparison(data1, data2) {
        const map1 = Object.fromEntries(data1.map(d => [d['실험체'], d]));
        const map2 = Object.fromEntries(data2.map(d => [d['실험체'], d]));

        const allCharacters = new Set([...Object.keys(map1), ...Object.keys(map2)]);
        const comparisonResult = [];

        const statsCols = ['점수', '픽률', 'RP 획득', '승률', 'TOP 3', '평균 순위', '표본수'];

        // 순위 계산을 위해 data1, data2를 점수 기준으로 미리 정렬합니다.
        const sortedData1 = [...data1].sort((a,b) => {
             if ((b['점수'] || 0) !== (a['점수'] || 0)) return (b['점수'] || 0) - (a['점수'] || 0);
             return String(a['실험체']).localeCompare(String(b['실험체']));
        });
         const sortedData2 = [...data2].sort((a,b) => {
             if ((b['점수'] || 0) !== (a['점수'] || 0)) return (b['점수'] || 0) - (a['점수'] || 0);
             return String(a['실험체']).localeCompare(String(b['실험체']));
        });

        const rankMap1 = Object.fromEntries(sortedData1.map((d, i) => [d['실험체'], i + 1])); // 1부터 시작하는 순위
        const rankMap2 = Object.fromEntries(sortedData2.map((d, i) => [d['실험체'], i + 1]));


        allCharacters.forEach(charName => {
            const d1 = map1[charName];
            const d2 = map2[charName];

            const result = { '실험체': charName };

            statsCols.forEach(col => {
                 const val1 = d1 ? d1[col] : null;
                 const val2 = d2 ? d2[col] : null;

                 result[`${col} (Ver1)`] = val1;
                 result[`${col} (Ver2)`] = val2;

                 if (typeof val1 === 'number' && typeof val2 === 'number') {
                      result[`${col} 변화량`] = val2 - val1;
                 } else {
                      result[`${col} 변화량`] = null;
                 }
            });

            // 티어 변화 계산
             const tier1 = d1 ? d1['티어'] : '삭제';
             const tier2 = d2 ? d2['티어'] : '삭제';

             if (!d1 && d2) {
                 result['티어 변화'] = `신규 → ${tier2}`;
             } else if (d1 && !d2) {
                 result['티어 변화'] = `${tier1} → 삭제`;
             } else if (d1 && d2) {
                 if (tier1 === tier2) {
                      result['티어 변화'] = tier1; // 티어 변화 없으면 현재 티어만 표시 (string)
                 } else {
                      result['티어 변화'] = `${tier1} → ${tier2}`; // 티어 변화 표시 (string)
                 }
             } else {
                 result['티어 변화'] = '-';
             }

            // 순위 변화 계산 (점수 기준)
            const rank1 = rankMap1[charName];
            const rank2 = rankMap2[charName];

            result['순위 (Ver1)'] = rank1;
            result['순위 (Ver2)'] = rank2;

            if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                 result['순위 변화값'] = rank2 - rank1; // 실제 변화량 (-10, +10 등)
            } else if (typeof rank1 === 'number') {
                 result['순위 변화값'] = '→ 삭제'; // string
            } else if (typeof rank2 === 'number') {
                 result['순위 변화값'] = '신규 → '; // string
            } else {
                 result['순위 변화값'] = '-'; // string
            }

            comparisonResult.push(result);
        });

        return comparisonResult;
    }

     // 7) 비교 테이블 렌더링 (수정)
    function renderComparisonTable(data) {
         if (!isCompareMode) return;

        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];

        let comparisonTableHtml = '<table><thead><tr>';
        cols.forEach(c => {
            // 티어 컬럼은 정렬 가능하도록 수정
            const sortable = true; // 모든 컬럼 정렬 가능

            // 티어 컬럼 정렬 제외 (이미지/텍스트 조합으로 복잡) -> common.js sortData에서 티어는 별도 처리
            // 요구사항: 티어 열도 정렬해야 함 (Ver1/Ver2/변화량)
            // 그러므로 티어 컬럼도 정렬 가능한 것으로 표시
            // const sortable = c !== '티어'; // 일단 티어 포함

            comparisonTableHtml += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
        });
        comparisonTableHtml += '</tr></thead><tbody>';

        data.forEach(row => {
            comparisonTableHtml += '<tr>';
            cols.forEach(col => {
                let displayVal = '-';
                let dataAttributes = '';

                 if (col === '실험체') {
                     displayVal = row['실험체'] || '-';

                     // 순위 변화 색상 강조를 위한 data 속성은 실험체 열에 붙입니다.
                      const rankChangeValue = row['순위 변화값']; // 숫자 또는 string
                      if (typeof rankChangeValue === 'number') {
                          dataAttributes += ` data-rankdelta="${rankChangeValue}"`;
                      } else if (rankChangeValue === '신규 → ') {
                          dataAttributes += ` data-rankdelta="new"`;
                      } else if (rankChangeValue === '→ 삭제') {
                          dataAttributes += ` data-rankdelta="removed"`;
                      } else {
                           dataAttributes += ` data-rankdelta="none"`;
                      }

                 } else if (col === '티어') {
                     // 티어 컬럼에는 티어 변화 정보와 순위 변화 정보를 함께 표시
                     const tierChange = row['티어 변화'] || '-'; // string
                     const rank1 = row['순위 (Ver1)']; // number 또는 undefined
                     const rank2 = row['순위 (Ver2)']; // number 또는 undefined
                     const rankChangeValue = row['순위 변화값']; // number 또는 string

                     let rankInfo = '';
                      if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                           const rankChangeFormatted = Math.abs(rankChangeValue);
                           // 순위 숫자가 작아지면 개선 (▼), 커지면 악화 (▲) -> 표시 기호 반전
                            rankInfo = `${rank1}위 → ${rank2}위 ${rankChangeValue < 0 ? `▲${rankChangeFormatted}` : (rankChangeValue > 0 ? `▼${rankChangeFormatted}` : '')}`;
                      } else if (rankChangeValue === '신규 → ') { // 이 경우는 rankMap에서 이미 '신규 → '로 처리됨
                           rankInfo = `(신규)`;
                      } else if (rankChangeValue === '→ 삭제') { // 이 경우는 rankMap에서 이미 '→ 삭제'로 처리됨
                           rankInfo = `(삭제)`;
                      } else if (typeof rank1 === 'number') { // Ver1에만 데이터 있고 Ver2에 없는 경우
                           rankInfo = `${rank1}위 → -`;
                      } else if (typeof rank2 === 'number') { // Ver2에만 데이터 있고 Ver1에 없는 경우
                           rankInfo = `- → ${rank2}위`;
                      } else {
                            // 둘 다 데이터가 없는 경우 (실험체 자체가 목록에 없는 경우) 또는 기타 경우
                            // mergeDataForComparison에서 allCharacters를 기준으로 하므로 이 경우는 발생하지 않아야 함
                            rankInfo = '-';
                      }


                     // 표시될 내용 조합: 티어 변화 + 순위 변화 정보 (함께 표시)
                     if (tierChange === '-') {
                          if (rankInfo === '-') displayVal = '-';
                          else displayVal = rankInfo; // 티어 정보는 없지만 순위 정보는 있는 경우
                     }
                     else {
                          displayVal = `${tierChange} ${rankInfo && rankInfo !== '-' ? `<span class="rank-info">(${rankInfo})</span>` : ''}`;
                     }


                     // 티어 변화 색상 강조를 위한 data 속성
                      if (tierChange.includes('→')) {
                           const tiers = tierChange.split('→').map(t => t.trim());
                           const tier1 = tiers[0];
                           const tier2 = tiers[1];
                           const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F', '삭제'];
                           const index1 = tierOrder.indexOf(tier1);
                           const index2 = tierOrder.indexOf(tier2);

                           if (tierChange.includes('신규 →')) {
                               dataAttributes += ` data-tierchange="new"`;
                           } else if (index1 >= 0 && index2 >= 0) {
                               if (index2 < index1) dataAttributes += ` data-tierchange="up"`; // 개선
                               else if (index2 > index1) dataAttributes += ` data-tierchange="down"`; // 악화
                               else dataAttributes += ` data-tierchange="same"`; // 동일
                           } else if (tierChange === '→ 삭제') {
                                dataAttributes += ` data-tierchange="removed"`;
                           }
                       } else if (tierChange === '-') {
                             dataAttributes += ` data-tierchange="none"`;
                       } else { // 티어 변화 없는 경우 (S+ 등)
                             // 단일 모드 티어 색상 사용을 위해 원본 티어 값 저장
                              dataAttributes += ` data-tier="${tierChange}"`;
                       }

                 } else if (col === '표본수') {
                      const val1 = row['표본수 (Ver1)'] !== null && row['표본수 (Ver1)'] !== undefined ? row['표본수 (Ver1)'] : '-';
                      const val2 = row['표본수 (Ver2)'] !== null && row['표본수 (Ver2)'] !== undefined ? row['표본수 (Ver2)'] : '-';
                      displayVal = `${val1} / ${val2}`;

                       // 표본수 변화량 색상 강조를 위한 data 속성 (값은 계산되어 mergeDataForComparison에 저장됨)
                       const delta = row['표본수 변화량'];
                       if (typeof delta === 'number') {
                            dataAttributes += ` data-delta="${delta}"`;
                       } else if (val1 === '-' && val2 !== '-') { // 신규 (표본수)
                            dataAttributes += ` data-delta="new"`;
                       } else if (val1 !== '-' && val2 === '-') { // 삭제 (표본수)
                            dataAttributes += ` data-delta="removed"`;
                       } else {
                           dataAttributes += ` data-delta="none"`;
                       }


                 } else { // 그 외 숫자 스탯 컬럼 (점수, 픽률 등)
                      const val1 = row[`${col} (Ver1)`];
                      const val2 = row[`${col} (Ver2)`];
                      const delta = row[`${col} 변화량`]; // 숫자 변화량

                      // 데이터 1 값이 기본 표시값
                      let valueText = (typeof val1 === 'number') ? val1.toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2) : '-';
                      if (['픽률', '승률', 'TOP 3'].includes(col) && typeof val1 === 'number') valueText += '%';

                       // 변화량 텍스트 ("→ ver2 ▲증감폭" 형태)
                      let deltaText = '';
                       if (typeof val2 === 'number') {
                            let val2Text = val2.toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2);
                             if (['픽률', '승률', 'TOP 3'].includes(col)) val2Text += '%';

                           if (typeof delta === 'number') {
                                const deltaFormatted = Math.abs(delta).toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2);
                                 // 증감폭 앞에 +-에 따라 화살표가 바뀜 (▲: 증가, ▼: 감소)
                                 deltaText = `${val2Text} ${delta > 0 ? `▲${deltaFormatted}` : (delta < 0 ? `▼${deltaFormatted}` : '')}`; // 변화량 0이면 빈 문자열
                           } else {
                                deltaText = `${val2Text}`; // 값만 표시
                           }
                           displayVal = `${valueText} → ${deltaText}`;

                       } else if (val1 !== null) { // 데이터 1은 있는데 데이터 2가 없는 경우 (삭제)
                            displayVal = `${valueText} → 삭제`;
                       } else if (val2 === null && val1 === null) { // 둘 다 없는 경우
                            displayVal = '-';
                       } else { // 데이터 2는 null인데 val1도 null이 아닌 경우 (발생하지 않아야 함)
                            displayVal = `${valueText}`;
                       }


                      // 색상 강조를 위해 변화량 값 또는 상태를 data-delta 속성으로 저장
                      if (typeof delta === 'number') {
                           dataAttributes += ` data-delta="${delta}"`;
                      } else if (val1 === null && val2 !== null) { // 신규
                            dataAttributes += ` data-delta="new"`;
                      } else if (val1 !== null && val2 === null) { // 삭제
                            dataAttributes += ` data-delta="removed"`;
                      } else {
                           dataAttributes += ` data-delta="none"`;
                      }
                 }

                 comparisonTableHtml += `<td data-col="${col}"${dataAttributes}>${displayVal}</td>`;
            });
            comparisonTableHtml += '</tr>';
        });
        comparisonTableHtml += '</tbody></table>';

        dataContainer.innerHTML = comparisonTableHtml;

        attachComparisonSortEventListeners(dataContainer.querySelectorAll('th'), renderComparisonTable); // 모든 th에 이벤트 부착 (티어 포함)
        applyGradientColorsComparison(dataContainer.querySelector('table'));
    }


    // 8) 테이블 렌더링 (기존 로직 - 단일 데이터용) - 이전과 동일
    function renderTable(data) {
         if (isCompareMode) return;

        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];

        let html = '<table><thead><tr>';
        cols.forEach(c => {
             // 단일 모드에서는 티어 정렬 제외 유지 (요구사항에 따라)
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
                 } else if (col === '승률' || col === 'TOP 3') {
                     val = typeof val === 'number' ? (val * 100).toFixed(2) + '%' : '-';
                 } else if (col === '픽률') {
                     val = typeof val === 'number' ? val.toFixed(2) + '%' : '-';
                 } else if (col === '점수' || col === 'RP 획득' || col === '평균 순위') {
                     val = typeof val === 'number' ? parseFloat(val).toFixed(2) : '-';
                 } else { // 실험체, 티어 등
                     val = val;
                 }

                html += `<td data-col="${col}">${val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table>';

        dataContainer.innerHTML = html;

        // 단일 모드용 정렬 이벤트 부착
        attachSingleSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable);
        // 색상 강조
        if (gradientCheckbox.checked) applyGradientColorsSingle(dataContainer.querySelector('table'));
    }

    // 9) 단일 모드용 정렬 이벤트 리스너 부착 (수정)
    function attachSingleSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
            const col = th.dataset.col;

            th.setAttribute('data-arrow', '');
            th.classList.remove('delta-sort-indicator'); // 혹시 모를 클래스 제거

            // 단일 모드 정렬은 항상 'value' 모드 기준
            if (currentSortColumn === col && currentSortMode === 'value') {
                th.setAttribute('data-arrow', currentSortAsc ? '▲' : '▼');
            }

            th.onclick = () => {
                // 단일 모드는 value 오름/내림차 순환만
                if (currentSortColumn === col) {
                     currentSortAsc = !currentSortAsc;
                } else {
                    currentSortColumn = col;
                    currentSortAsc = false; // 기본 내림차순
                    currentSortMode = 'value'; // 단일 모드는 value 고정
                }

                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode); // mode 인자 전달
                renderFunc(sortedData);
            };
        });
    }

    // 10) 비교 모드용 정렬 이벤트 리스너 부착 (수정)
     function attachComparisonSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
             const col = th.dataset.col;

             th.style.cursor = 'pointer'; // 모든 헤더 클릭 가능


             th.setAttribute('data-arrow', ''); // 기존 화살표 리셋
             th.classList.remove('delta-sort-indicator'); // 델타 정렬 표시자 리셋


             // 현재 정렬 기준과 일치하면 화살표 표시 및 델타 표시자 추가
             if (currentSortColumn === col) {
                 let arrow = '';
                 if (currentSortMode === 'value1') {
                     arrow = currentSortAsc ? '▲1' : '▼1'; // Ver1 기준 오름/내림차순
                 } else if (currentSortMode === 'value2') {
                     arrow = currentSortAsc ? '▲2' : '▼2'; // Ver2 기준 오름/내림차순
                 } else if (currentSortMode === 'delta') {
                       // common.js의 sortData 로직에 맞게 화살표 결정 (일반적인 오름/내림차 기호)
                       arrow = currentSortAsc ? '▲' : '▼'; // 일반적인 오름/내림차 기호

                       // 델타 정렬일 경우 표 헤드에 Δ 표시 추가
                       th.classList.add('delta-sort-indicator'); // CSS에서 ::after 등으로 Δ 표시
                 }
                 th.setAttribute('data-arrow', arrow);
             }

             // 클릭 이벤트 리스너 추가
             th.onclick = () => {
                 // 정렬 로직 순환: Value1 ▼ -> Value1 ▲ -> Value2 ▼ -> Value2 ▲ -> Delta ▼ -> Delta ▲ -> Value1 ▼ ...

                 if (currentSortColumn === col) {
                     // 같은 컬럼 다시 클릭 시 순환 로직
                     if (currentSortMode === 'value1' && !currentSortAsc) { // Value1 ▼ -> Value1 ▲
                         currentSortAsc = true;
                     } else if (currentSortMode === 'value1' && currentSortAsc) { // Value1 ▲ -> Value2 ▼
                          currentSortMode = 'value2';
                          currentSortAsc = false;
                     } else if (currentSortMode === 'value2' && !currentSortAsc) { // Value2 ▼ -> Value2 ▲
                          currentSortAsc = true;
                     } else if (currentSortMode === 'value2' && currentSortAsc) { // Value2 ▲ -> Delta ▼
                          currentSortMode = 'delta';
                          // common.js의 sortData 로직에 맞는 초기 방향 설정
                          // 순위 관련 (평균 순위, 실험체)는 asc=true가 좋아지는 순 (숫자 감소)
                          // 그 외 변화량은 asc=true가 나빠지는 순 (숫자 감소)
                          if (col === '평균 순위' || col === '실험체') currentSortAsc = true; // 평균 순위와 실험체(순위)는 오름차순이 좋아지는 순
                          else currentSortAsc = false; // 그 외 스탯은 내림차순이 좋아지는 순

                     } else if (currentSortMode === 'delta' && !currentSortAsc) { // Delta ▼ -> Delta ▲
                          // delta 모드에서 오름차순으로 전환
                         currentSortAsc = true;
                     }
                     else { // Delta ▲ -> Value1 ▼ (초기 상태로 회귀)
                          currentSortMode = 'value1';
                          currentSortAsc = false;
                     }
                 } else {
                     // 다른 컬럼 클릭 시
                     currentSortColumn = col; // 컬럼 변경
                     currentSortMode = 'value1'; // 기본은 value1 모드
                     currentSortAsc = false; // 기본은 내림차순

                     // 실험체 이름은 Value1 오름차순 시작
                     if (col === '실험체') {
                          currentSortAsc = true;
                     }
                 }

                 const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode);
                 renderFunc(sortedData);
             };
         });
     }
});