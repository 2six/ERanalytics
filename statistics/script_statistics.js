// script_statistics.js
document.addEventListener('DOMContentLoaded', function() {
    // common.js에 정의된 함수/변수들은 전역 스코프에 있으므로 바로 사용 가능합니다.

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
    let currentSortMode = 'value'; // 'value' (단일), 'value1', 'value2', 'delta'
    let lastData = []; // 로드된 원본 데이터 또는 병합된 비교 데이터
    let tierConfig = null; // config.ini에서 로드된 티어 설정
    let versionList = []; // versions.json에서 로드된 버전 목록 (Promise.all 내부에서 할당)


    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);
    const isCompareMode = params.get('compare') === '1';

    // 1) URL 파라미터 → 컨트롤에 반영
    // 이 함수는 versionList가 로드된 후에 호출되어야 합니다.
    function applyParamsToControls() {
        if (params.has('version')) versionSelect.value = params.get('version');
        if (params.has('tier')) tierSelect.value = params.get('tier');
        if (params.has('period')) periodSelect.value = params.get('period');

        // 색상 강조 체크박스 상태 로드 (비교 모드가 아닐 때만)
        if (!isCompareMode && params.has('gradient')) {
            gradientCheckbox.checked = params.get('gradient') === '1';
        } else if (isCompareMode) {
             // 비교 모드에서는 색상 강조 항상 켜짐 및 비활성화
             gradientCheckbox.checked = true;
             gradientCheckbox.disabled = true;
             gradientCheckbox.parentElement.style.opacity = '0.5';
        }


        if (isCompareMode) {
            comparisonControlsDiv.style.display = 'flex';
            compareModeLabel.style.display = 'inline';

            // 비교 드롭다운 값 설정
            if (params.has('version2')) versionSelectCompare.value = params.get('version2');
            if (params.has('tier2')) tierSelectCompare.value = params.get('tier2');
            if (params.has('period2')) periodSelectCompare.value = params.get('period2');


            // URL에서 정렬 상태 복원 시도 (비교 모드에서만)
            if (params.has('sortCol') && params.has('sortAsc') && params.has('sortMode')) {
                 currentSortColumn = params.get('sortCol');
                 currentSortAsc = params.get('sortAsc') === 'true';
                 currentSortMode = params.get('sortMode');
            } else {
                // URL 파라미터 없으면 비교 모드 기본 정렬 (점수 Ver1 내림차순)
                currentSortColumn = '점수';
                currentSortAsc = false;
                currentSortMode = 'value1';
            }

        } else {
            // 단일 모드에서는 비활성화 해제 및 투명도 복원
            gradientCheckbox.disabled = false;
            gradientCheckbox.parentElement.style.opacity = '1';
            // 단일 모드 기본 정렬 (점수 내림차순)
            currentSortColumn = '점수';
            currentSortAsc = false;
            currentSortMode = 'value';
        }
    }

    // 2) 컨트롤 상태 → URL에 반영 (정렬 상태 저장 추가)
    function updateURL() {
        params.set('version', versionSelect.value);
        params.set('tier', tierSelect.value);
        params.set('period', periodSelect.value);

        if (!isCompareMode) {
            params.set('gradient', gradientCheckbox.checked ? '1' : '0');
            // 비교 모드 관련 파라미터 제거
            params.delete('version2');
            params.delete('tier2');
            params.delete('period2');
            params.delete('compare');
            // 정렬 상태 파라미터도 제거 (단일 모드는 URL에 저장 안 함)
            params.delete('sortCol');
            params.delete('sortAsc');
            params.delete('sortMode');

        } else {
            // 비교 모드 관련 파라미터 저장
            params.set('version2', versionSelectCompare.value);
            params.set('tier2', tierSelectCompare.value);
            params.set('period2', periodSelectCompare.value);
            params.set('compare', '1');
            // gradient 파라미터 제거
            params.delete('gradient');

            // 비교 모드에서는 정렬 상태 URL 저장
            params.set('sortCol', currentSortColumn);
            params.set('sortAsc', currentSortAsc);
            params.set('sortMode', currentSortMode);
        }

        const newUrl = `${location.pathname}?${params.toString()}`;
        history.replaceState(null, '', newUrl);
    }

    // 3) 초기화 로직
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniText, loadedVersionList]) => {
        // 데이터 로드 성공 후 versionList와 tierConfig 설정
        versionList = loadedVersionList; // 전역 versionList에 할당
        const config = parseINI(iniText);
        tierConfig = config.tiers;

        // common.js 에 정의된 함수들로 드롭다운 채우기
        populateVersionDropdown(versionSelect, versionList);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        if (isCompareMode) {
            comparisonControlsDiv.style.display = 'flex';
            compareModeLabel.style.display = 'inline';
            // 비교 드롭다운도 채우기
            populateVersionDropdown(versionSelectCompare, versionList);
            populateTierDropdown(tierSelectCompare);
            populatePeriodDropdown(periodSelectCompare);
        }

        // URL 파라미터로부터 컨트롤 상태 복원 (versionList 로드 후 호출)
        applyParamsToControls();

        // 변경 시 URL 갱신 + 데이터 갱신
        const reloadData = isCompareMode ? loadAndDisplayComparison : loadAndDisplaySingle;

        versionSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        tierSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        periodSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        gradientCheckbox.addEventListener('change', () => {
            updateURL();
            if (!isCompareMode && lastData && lastData.length > 0) renderTable(lastData);
        });

        if (isCompareMode) {
            versionSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            tierSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            periodSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
        }

        // 첫 로드
        reloadData();

    }).catch(err => {
        console.error('초기화 실패:', err);
        dataContainer.innerHTML = '초기 설정 로드에 실패했습니다.';
    });


    // 4) 단일 데이터 로드 ∙ 가공 ∙ 렌더
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

    // 5) 비교 데이터 로드 ∙ 가공 ∙ 렌더
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

    // 6) 두 데이터셋 병합 및 변화량 계산
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
             const tier1 = d1 ? d1['티어'] : '삭제'; // 데이터 1에 없으면 '삭제'로 간주
             const tier2 = d2 ? d2['티어'] : '삭제'; // 데이터 2에 없으면 '삭제'로 간주

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

     // 7) 비교 테이블 렌더링
    function renderComparisonTable(data) {
         if (!isCompareMode) return;

        // 기존 테이블 컬럼 목록
        // 요구사항 반영: '표본수' 열 제거
        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위']; // 표본수 제거

        let comparisonTableHtml = '<table><thead><tr>';
        cols.forEach(c => {
            // 실험체 컬럼은 비교 모드에서 정렬 제외 유지
            const sortable = c !== '실험체';

            comparisonTableHtml += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
        });
        comparisonTableHtml += '</tr></thead><tbody>';

        data.forEach(row => {
            comparisonTableHtml += '<tr>';
            cols.forEach(col => {
                let displayVal = '-';
                let dataAttributes = ''; // data-delta, data-rankdelta 등을 저장할 문자열

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
                     // 티어 컬럼에는 티어 변화 정보만 표시
                     const tierChange = row['티어 변화'] || '-'; // string
                     const rank1 = row['순위 (Ver1)']; // number 또는 undefined
                     const rank2 = row['순위 (Ver2)']; // number 또는 undefined
                     const rankChangeValue = row['순위 변화값']; // number 또는 string

                     let rankInfo = '';
                      if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                           const rankChangeFormatted = Math.abs(rankChangeValue);
                           // 순위 숫자가 작아지면 개선 (▼), 커지면 악화 (▲) -> 표시 기호 반전
                           // 요구사항에 따라 순위 숫자 감소 (좋아짐)는 ▲, 순위 숫자 증가 (나빠짐)는 ▼ 사용
                            rankInfo = `${rank1}위 → ${rank2}위 ${rankChangeValue < 0 ? `▲${rankChangeFormatted}` : (rankChangeValue > 0 ? `▼${rankChangeFormatted}` : '')}`;
                      } else if (rankChangeValue === '신규 → ') {
                           rankInfo = `(신규)`;
                      } else if (rankChangeValue === '→ 삭제') {
                           rankInfo = `(삭제)`;
                      } else if (typeof rank1 === 'number') { // Ver1에만 데이터 있고 Ver2에 없는 경우
                           rankInfo = `${rank1}위 → -`;
                      } else if (typeof rank2 === 'number') { // Ver2에만 데이터 있고 Ver1에 없는 경우
                           rankInfo = `- → ${rank2}위`;
                      } else {
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
                              dataAttributes += ` data-tier="${tierChange}"`;
                       }

                 } else if (col === '표본수') {
                      // 요구사항 반영: 표본수 열 제거 -> 이 else if 블록은 실행되지 않음.
                      // 다만 데이터 구조에는 '표본수 (Ver1)', '표본수 (Ver2)', '표본수 변화량' 키가 존재할 수 있음.
                      const val1 = row['표본수 (Ver1)'] !== null && row['표본수 (Ver1)'] !== undefined ? row['표본수 (Ver1)'] : '-';
                      const val2 = row['표본수 (Ver2)'] !== null && row['표본수 (Ver2)'] !== undefined ? row['표본수 (Ver2)'] : '-';
                      displayVal = `${val1} / ${val2}`; // 이 내용은 표본수 열이 없을 때 표시되지 않음

                       const delta = row['표본수 변화량'];
                       if (typeof delta === 'number') {
                            dataAttributes += ` data-delta="${delta}"`;
                       } else if (val1 === '-' && val2 !== '-') {
                            dataAttributes += ` data-delta="new"`;
                       } else if (val1 !== '-' && val2 === '-') {
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
                                 deltaText = `${val2Text} ${delta > 0 ? `▲${deltaFormatted}` : (delta < 0 ? `▼${deltaFormatted}` : '')}`;
                           } else {
                                deltaText = `${val2Text}`; // 값만 표시
                           }
                           displayVal = `${valueText} → ${deltaText}`;

                       } else if (val1 !== null) {
                            displayVal = `${valueText} → 삭제`;
                       } else if (val2 === null && val1 === null) {
                            displayVal = '-';
                       } else {
                            displayVal = `${valueText}`;
                       }


                      // 색상 강조를 위해 변화량 값 또는 상태를 data-delta 속성으로 저장
                      if (typeof delta === 'number') {
                           dataAttributes += ` data-delta="${delta}"`;
                      } else if (val1 === null && val2 !== null) {
                            dataAttributes += ` data-delta="new"`;
                      } else if (val1 !== null && val2 === null) {
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

        attachComparisonSortEventListeners(dataContainer.querySelectorAll('th'), renderComparisonTable); // 모든 th에 이벤트 부착
        applyGradientColorsComparison(dataContainer.querySelector('table'), currentSortMode, currentSortColumn); // 색상 적용 함수 호출 시 정렬 모드와 컬럼 전달
    }


    // 8) 테이블 렌더링 (기존 로직 - 단일 데이터용)
    function renderTable(data) {
         if (isCompareMode) return;

        const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];

        let html = '<table><thead><tr>';
        cols.forEach(c => {
             // 단일 모드에서는 실험체 정렬 제외, 티어 정렬 포함
            const sortable = c !== '실험체';
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

        attachSingleSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable); // data-nosort 없는 th에만 부착
        if (gradientCheckbox.checked) applyGradientColorsSingle(dataContainer.querySelector('table'));
    }

    // 9) 단일 모드용 정렬 이벤트 리스너 부착
    function attachSingleSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
            const col = th.dataset.col;

            // data-nosort 속성이 있다면 정렬 제외
            if (th.hasAttribute('data-nosort')) {
                 th.style.cursor = 'default';
                 th.setAttribute('data-arrow', '');
                 th.classList.remove('delta-sort-indicator');
                 return; // 정렬 제외 컬럼
            }

            th.style.cursor = 'pointer'; // 정렬 가능 컬럼

            th.setAttribute('data-arrow', '');
            th.classList.remove('delta-sort-indicator');

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
                //console.log(`Single Sort: column=${currentSortColumn}, asc=${currentSortAsc}, mode=${currentSortMode}`); // 디버그
                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode);
                renderFunc(sortedData);
            };
        });
    }

    // 10) 비교 모드 테이블 헤더에 정렬 이벤트 리스너 부착
    function attachComparisonSortEventListeners(ths, renderFunc) {
        ths.forEach(th => {
            const col = th.dataset.col;

            // 실험체 컬럼은 비교 모드에서 정렬 제외
            if (col === '실험체') {
                th.style.cursor = 'default';
                th.setAttribute('data-arrow', '');
                th.classList.remove('delta-sort-indicator'); // 혹시 모를 클래스 제거
                th.setAttribute('data-nosort', 'true'); // 정렬 불가 명시
                return;
            }
             th.style.cursor = 'pointer';


            th.setAttribute('data-arrow', ''); // 기존 화살표 리셋
            th.classList.remove('delta-sort-indicator'); // 델타 정렬 표시자 클래스 리셋


            // 현재 정렬 기준과 일치하면 화살표 및 기호 표시
            if (currentSortColumn === col) {
                let arrow = '';
                if (currentSortMode === 'value1') {
                    arrow = currentSortAsc ? '▲1' : '▼1'; // Ver1 기준 오름/내림차순 기호
                } else if (currentSortMode === 'value2') {
                    arrow = currentSortAsc ? '▲2' : '▼2'; // Ver2 기준 오름/내림차순 기호
                } else if (currentSortMode === 'delta') {
                      // 요구사항 반영: 델타 정렬 기호 ▲Δ 또는 ▼Δ
                      arrow = currentSortAsc ? '▲Δ' : '▼Δ';
                      // 델타 정렬일 경우 헤더에 델타 표시 클래스 추가
                      th.classList.add('delta-sort-indicator');
                }
                th.setAttribute('data-arrow', arrow); // 헤더의 data-arrow 속성에 설정
            }

            // 클릭 이벤트 리스너 추가
            th.onclick = () => {
                // 정렬 순환: Value1 ▼ -> Value1 ▲ -> Value2 ▼ -> Value2 ▲ -> Delta ▼ -> Delta ▲ -> Value1 ▼ ...
                const modes = ['value1', 'value1', 'value2', 'value2', 'delta', 'delta']; // 6단계 순환 모드
                const directions = [false, true, false, true, false, true]; // 각 단계의 오름차순 여부 (false: 내림차순, true: 오름차순)

                let currentCycleIndex = -1;
                // 현재 상태에 해당하는 순환 단계 찾기
                for(let i = 0; i < modes.length; i++) {
                    // 현재 컬럼이 정렬 기준 컬럼이고, 현재 모드와 방향이 순환 단계와 일치하는 경우
                    if(currentSortColumn === col && currentSortMode === modes[i] && currentSortAsc === directions[i]) {
                        currentCycleIndex = i;
                        break;
                    }
                }

                let nextMode, nextAsc;

                if (currentCycleIndex !== -1) {
                    // 같은 컬럼을 다시 클릭한 경우, 순환의 다음 단계로 이동
                    let nextCycleIndex = (currentCycleIndex + 1) % modes.length;
                    nextMode = modes[nextCycleIndex];
                    nextAsc = directions[nextCycleIndex];

                } else {
                    // 다른 컬럼을 처음 클릭한 경우, 해당 컬럼의 Value1 내림차순 정렬로 시작
                    currentSortColumn = col; // 정렬 기준 컬럼을 클릭된 컬럼으로 변경
                    nextMode = 'value1'; // 다음 모드는 Value1
                    nextAsc = false; // 기본은 내림차순

                    // 예외 처리: 평균 순위는 Value1 오름차순이 좋아지는 순서 (값이 작을수록 좋음)
                    if (col === '평균 순위') nextAsc = true;
                    // 예외 처리: 티어는 Value1 오름차순이 나쁜 순서 (F 위로) -> common.js sortData가 점수 기준으로 정렬하므로, 점수는 클수록 좋음 (내림차순). 따라서 티어 Value1 정렬 시 점수 내림차순이 되어야 S+이 위로 옴.
                    // common.js sortData에서 '티어' Value1/Value2 정렬 시 '점수 (VerX)' 키를 사용하고, 점수는 클수록 좋음으로 처리합니다.
                    // 따라서 '점수 (VerX)' 기준 내림차순 (asc=false)일 때 S+가 위로 옵니다.
                    // 그래서 '티어' 컬럼 클릭 시 Value1 내림차순으로 시작하는 것이 맞습니다.
                    if (col === '티어') nextAsc = false; // 티어 Value1 내림차순 시작 (S+ 위로)
                }

                currentSortMode = nextMode; // 현재 정렬 모드 업데이트
                currentSortAsc = nextAsc; // 현재 정렬 방향 업데이트

                //console.log(`Compare Sort: column=${currentSortColumn}, asc=${currentSortAsc}, mode=${currentSortMode}`); // 디버그

                // 업데이트된 정렬 상태를 바탕으로 데이터 정렬 및 테이블 다시 렌더링
                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode); // common.js의 sortData 함수 호출
                renderFunc(sortedData); // 테이블 렌더링 함수 호출 (renderComparisonTable)

                // 화살표 및 델타 표시자는 다음 renderFunc 호출 시 applyGradientColorsComparison 함수에 의해 업데이트됨
            };
        });
    }
});