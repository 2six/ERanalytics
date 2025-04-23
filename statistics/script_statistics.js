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

        // 색상 강조 체크박스 상태 로드 (비교 모드 여부와 상관없이 파라미터 반영)
        // URL 파라미터가 없으면 브라우저 기억 상태 사용
        if (params.has('gradient')) {
             gradientCheckbox.checked = params.get('gradient') === '1';
        }
        // 기존의 '비교 모드에서는 색상 강조 항상 켜짐 및 비활성화' 로직을 제거했습니다.


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
            // 단일 모드에서는 비교 모드 컨트롤 숨김
            comparisonControlsDiv.style.display = 'none';
            compareModeLabel.style.display = 'none';
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

        // 색상 강조 상태는 비교 모드 여부와 상관없이 저장 (요청 사항 반영)
        params.set('gradient', gradientCheckbox.checked ? '1' : '0');


        if (isCompareMode) {
            // 비교 모드 관련 파라미터 저장
            params.set('version2', versionSelectCompare.value);
            params.set('tier2', tierSelectCompare.value);
            params.set('period2', periodSelectCompare.value);
            params.set('compare', '1');
            // 기존의 gradient 파라미터 제거 로직을 제거했습니다. (이미 위에서 설정)

            // 비교 모드에서는 정렬 상태 URL 저장
            params.set('sortCol', currentSortColumn);
            params.set('sortAsc', currentSortAsc);
            params.set('sortMode', currentSortMode);
        } else {
            // 단일 모드에서는 비교 모드 관련 파라미터 제거
            params.delete('version2');
            params.delete('tier2');
            params.delete('period2');
            params.delete('compare');
            // 단일 모드는 정렬 상태 URL에 저장 안 함 (원본 유지)
            params.delete('sortCol');
            params.delete('sortAsc');
            params.delete('sortMode');
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
            updateURL(); // URL에 상태 저장
            if (lastData && lastData.length > 0) {
                // 현재 모드에 맞는 렌더링 함수 호출 (색상만 다시 적용)
                if (isCompareMode) {
                     // renderComparisonTable 함수 호출 시 체크박스 상태 전달
                     renderComparisonTable(lastData); // renderComparisonTable 내부에서 체크박스 상태 확인
                } else {
                     // renderTable 함수 호출 시 체크박스 상태 전달
                     renderTable(lastData); // renderTable 내부에서 체크박스 상태 확인
                }
            } else if (!gradientCheckbox.checked) {
                 // 색상 강조 해제했는데 데이터가 없으면 (예: 로딩 실패 메시지 등)
                 // 테이블이 있다면 배경색 초기화 (혹시 모르니 안전 장치)
                 dataContainer.querySelectorAll('td').forEach(td => td.style.backgroundColor = '');
            }
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
    function renderComparisonTable(data) { // data 인자는 정렬된 데이터 배열입니다.
        if (!isCompareMode) return;

       // 기존 테이블 컬럼 목록
       // '표본수' 컬럼 제거
       const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위']; // 표본수 제외

       let comparisonTableHtml = '<table><thead><tr>';
       cols.forEach(c => {
           // 실험체 컬럼은 비교 모드에서 정렬 제외 유지
           const sortable = c !== '실험체';

           comparisonTableHtml += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
       });
       comparisonTableHtml += '</tr></thead><tbody>';

       data.forEach((row, rowIndex) => { // rowIndex 추가
           comparisonTableHtml += '<tr>';
           cols.forEach(col => {
               let displayVal = '-';
               // 변수명 변경: dataAttributes -> cellAttributes
               let cellAttributes = ''; // data-delta, data-rankdelta 등을 저장할 문자열

                if (col === '실험체') {
                    displayVal = row['실험체'] || '-';

                    // 순위 정보 표시 (이전 수정에서 가져옴)
                     const rank1 = row['순위 (Ver1)'];
                     const rank2 = row['순위 (Ver2)'];
                     const rankChangeValue = row['순위 변화값']; // number 또는 string

                    let rankInfo = '';
                     if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                          const rankChangeFormatted = Math.abs(rankChangeValue || 0);
                          // 순위 숫자가 작아지면 개선 (▲), 커지면 악화 (▼)
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


                    displayVal = `${row['실험체']} ${rankInfo && rankInfo !== '-' ? `<span class="rank-info">(${rankInfo})</span>` : ''}`;


                    // 순위 변화 색상 강조를 위한 data 속성 (실험체 열에만 붙임)
                     const rankChangeNumeric = row['순위 변화값']; // number 또는 string
                     if (typeof rankChangeNumeric === 'number') {
                         // 변수명 변경: dataAttributes += -> cellAttributes +=
                         cellAttributes += ` data-rankdelta-numeric="${rankChangeNumeric}"`; // 숫자값 그대로 저장
                     } else { // string 값인 경우 상태 저장
                          if (rankChangeNumeric === '신규 → ') {
                               // 변수명 변경: dataAttributes += -> cellAttributes +=
                               cellAttributes += ` data-rankdelta-status="new"`;
                          } else if (rankChangeNumeric === '→ 삭제') {
                                // 변수명 변경: dataAttributes += -> cellAttributes +=
                                cellAttributes += ` data-rankdelta-status="removed"`;
                          } else {
                                // 변수명 변경: dataAttributes += -> cellAttributes +=
                                cellAttributes += ` data-rankdelta-status="none"`; // '-' 또는 기타
                          }
                     }


                } else if (col === '티어') {
                    // 티어 컬럼에는 티어 변화 정보만 표시
                    const tierChange = row['티어 변화'] || '-'; // string
                    displayVal = tierChange;

                    // 티어 변화 색상 강조를 위한 data 속성 (JS에서 색칠 시 사용) (요청 사항 반영)
                     if (tierChange.includes('→')) {
                          if (tierChange.includes('신규 →')) {
                              // 변수명 변경: dataAttributes += -> cellAttributes +=
                              cellAttributes += ` data-tierchange="new"`;
                          } else if (tierChange.includes('→ 삭제')) {
                               // 변수명 변경: dataAttributes += -> cellAttributes +=
                               cellAttributes += ` data-tierchange="removed"`;
                          } else { // S+ -> S 등 실제 티어 변화
                               const tiers = tierChange.split('→').map(t => t.trim());
                               const tier1 = tiers[0];
                               const tier2 = tiers[1];
                               const tierOrder = ['S+', 'S', 'A', 'B', 'C', 'D', 'F']; // 좋음 -> 나쁨 순서
                               const index1 = tierOrder.indexOf(tier1);
                               const index2 = tierOrder.indexOf(tier2);

                               if (index1 >= 0 && index2 >= 0) {
                                   // 인덱스 비교로 개선/악화/동일 판단
                                   if (index2 < index1) cellAttributes += ` data-tierchange="up"`; // 개선
                                   else if (index2 > index1) cellAttributes += ` data-tierchange="down"`; // 악화
                                   else cellAttributes += ` data-tierchange="same"`; // 동일
                               } else {
                                   cellAttributes += ` data-tierchange="unknown"`; // 알 수 없는 티어 변화
                               }
                           }
                      } else if (tierChange === '-') {
                            cellAttributes += ` data-tierchange="none"`; // 둘 다 없음
                      } else { // 티어 변화 없음 (S+ 등) - 단일 티어 표시
                             // 티어 등급 자체를 속성으로 저장
                             cellAttributes += ` data-tier-single="${tierChange}"`;
                      }

                     // 티어 컬럼의 델타 모드 색칠을 위해 순위 변화값도 data 속성에 저장 (숫자만) (요청 사항 반영)
                     const rankChangeValue = row['순위 변화값'];
                     if (typeof rankChangeValue === 'number') {
                          // 변수명 변경: dataAttributes += -> cellAttributes +=
                          cellAttributes += ` data-rankdelta-numeric="${rankChangeValue}"`;
                     }

                } else { // Other numeric stat columns
                     const val1 = row[`${col} (Ver1)`];
                     const val2 = row[`${col} (Ver2)`];
                     const delta = row[`${col} 변화량`]; // Numeric delta value

                     // Display Ver1 value → Ver2 value Delta format (이전 수정에서 가져옴)
                     let value1Text = (typeof val1 === 'number') ? val1.toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2) : '-';
                     if (['픽률', '승률', 'TOP 3'].includes(col) && typeof val1 === 'number') value1Text += '%';
                     else if (col === '평균 순위' && typeof val1 === 'number') value1Text = parseFloat(val1).toFixed(2);
                     else if (col === '표본수' && typeof val1 === 'number') value1Text = Math.round(val1).toLocaleString(); // 표본수는 정수, 쉼표 포맷

                      let value2Text = (typeof val2 === 'number') ? val2.toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2) : '-';
                      if (['픽률', '승률', 'TOP 3'].includes(col) && typeof val2 === 'number') value2Text += '%';
                      else if (col === '평균 순위' && typeof val2 === 'number') value2Text = parseFloat(val2).toFixed(2);
                      else if (col === '표본수' && typeof val2 === 'number') value2Text = Math.round(val2).toLocaleString(); // 표본수는 정수, 쉼표 포맷


                      let deltaText = '';
                      if (typeof delta === 'number') {
                           const deltaFormatted = Math.abs(delta).toFixed(['픽률', '승률', 'TOP 3'].includes(col) ? 2 : 2);
                            if (col === '평균 순위') deltaFormatted = Math.abs(delta).toFixed(2);
                            else if (col === '표본수') deltaFormatted = Math.round(Math.abs(delta)).toLocaleString();


                           deltaText = `${value2Text} ${delta > 0 ? `▲${deltaFormatted}` : (delta < 0 ? `▼${deltaFormatted}` : '')}`;
                      } else if (typeof val2 === 'number') {
                           deltaText = `${value2Text}`; // Delta is null, but Ver2 has value
                      } else if (typeof val1 === 'number' && typeof val2 !== 'number') {
                           deltaText = '삭제'; // Ver1 exists, Ver2 doesn't
                      } else if (typeof val1 !== 'number' && typeof val2 === 'number') {
                           deltaText = '신규'; // Ver2 exists, Ver1 doesn't
                      } else {
                            deltaText = '-'; // Neither exists
                      }

                    if (value1Text === '-') { // Ver1 데이터가 없을 때
                         displayVal = deltaText; // 신규/삭제/값2 만 표시
                     } else { // Ver1 데이터가 있을 때
                         displayVal = `${value1Text} → ${deltaText}`;
                     }


                     // Store delta value for color grading (요청 사항 반영)
                     if (typeof delta === 'number') {
                          // 변수명 변경: dataAttributes += -> cellAttributes +=
                          cellAttributes += ` data-delta-numeric="${delta}"`; // 숫자값 그대로 저장
                     } else {
                          // 숫자 변화량이 아닌 경우 상태 저장 ('new', 'removed', 'none')
                           if (typeof val1 !== 'number' && typeof val2 === 'number') { // 신규
                                // 변수명 변경: dataAttributes += -> cellAttributes +=
                                cellAttributes += ` data-delta-status="new"`;
                           } else if (typeof val1 === 'number' && typeof val2 !== 'number') { // 삭제
                                // 변수명 변경: dataAttributes += -> cellAttributes +=
                                cellAttributes += ` data-delta-status="removed"`;
                           } else { // 둘 다 없음, 변화 없음 등
                                // 변수명 변경: dataAttributes += -> cellAttributes +=
                                cellAttributes += ` data-delta-status="none"`;
                           }
                     }
                }

                // 변수명 변경: dataAttributes 사용 -> cellAttributes 사용
                comparisonTableHtml += `<td data-col="${col}"${cellAttributes}>${displayVal}</td>`;
           });
           comparisonTableHtml += '</tr>';
       });
       comparisonTableHtml += '</tbody></table>';

       dataContainer.innerHTML = comparisonTableHtml;

       attachComparisonSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderComparisonTable); // data-nosort 없는 th에만 부착

       // 색상 강조가 체크된 경우에만 색상 적용 함수 호출 (요청 사항 반영)
       // applyGradientColorsComparison 함수는 common.js에 정의되어 있으며 gradientEnabled 인자를 받음
       // data 대신 lastData 사용 (현재 정렬된 데이터)
       // renderComparisonTable 함수의 data 인자는 이미 정렬된 데이터이므로 data 대신 data를 전달합니다.
       applyGradientColorsComparison(dataContainer.querySelector('table'), data, currentSortMode, currentSortColumn, gradientCheckbox.checked);
    }

    // 8) 테이블 렌더링 (기존 로직 - 단일 데이터용)
    function renderTable(data) {
        if (isCompareMode) return; // 비교 모드일 때는 이 함수 실행 안 함

       const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];

       let html = '<table><thead><tr>';
       cols.forEach(c => {
            // 단일 모드에서는 실험체 정렬 제외, 나머지 포함 (원본 유지)
           const sortable = c !== '실험체';
           html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`;
       });
       html += '</tr></thead><tbody>';

       data.forEach(row => {
           html += '<tr>';
           cols.forEach(col => {
               let val = row[col];
                // 원본 코드와 동일하게 undefined/null 체크
                if (val === undefined || val === null) {
                    val = '-';
                } else if (col === '승률' || col === 'TOP 3' || col === '픽률') {
                    val = typeof val === 'number' ? (val * 100).toFixed(2) + '%' : '-';
                } else if (col === '점수' || col === 'RP 획득' || col === '평균 순위') {
                    val = typeof val === 'number' ? parseFloat(val).toFixed(2) : '-';
                } else { // 실험체, 티어 등 (문자열)
                    val = val;
                }

               html += `<td data-col="${col}">${val}</td>`;
           });
           html += '</tr>';
       });
       html += '</tbody></table>';

       dataContainer.innerHTML = html;

       attachSingleSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable); // data-nosort 없는 th에만 부착

       // 색상 강조가 체크된 경우에만 색상 적용 함수 호출 (원본 유지)
       // applyGradientColorsSingle 함수에 체크박스 상태를 인자로 전달하도록 수정했습니다.
       // 이렇게 하면 applyGradientColorsSingle 함수 내부에서 색상 적용/해제 로직을 처리합니다.
       applyGradientColorsSingle(dataContainer.querySelector('table'), gradientCheckbox.checked);
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
                    arrow = currentSortAsc ? '1▲' : '1▼'; // Ver1 기준 오름/내림차순 기호
                } else if (currentSortMode === 'value2') {
                    arrow = currentSortAsc ? '2▲' : '2▼'; // Ver2 기준 오름/내림차순 기호
                } else if (currentSortMode === 'delta') {
                      arrow = currentSortAsc ? 'Δ▲' : 'Δ▼';
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