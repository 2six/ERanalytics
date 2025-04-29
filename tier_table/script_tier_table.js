document.addEventListener('DOMContentLoaded', function () {
    const versionSelect = document.getElementById('version-select');
    const tierSelect    = document.getElementById('tier-select');
    const periodSelect  = document.getElementById('period-select');
    const table         = document.getElementById('tier-table');
    const container     = document.getElementById('tier-table-container');

    // --- 수정: 비교 모드 관련 DOM 요소 ---
    const comparisonControlsDiv = document.getElementById('comparison-controls');
    const versionSelectCompare = document.getElementById('version-select-compare');
    const tierSelectCompare = document.getElementById('tier-select-compare');
    const periodSelectCompare = document.getElementById('period-select-compare');
    const compareModeLabel = document.getElementById('compare-mode-label');
    const compareCheckbox = document.getElementById('compare-checkbox'); // 비교 모드 체크박스 ID 변경
    // ------------------------------------


    // URL 파라미터 헬퍼
    const params = new URLSearchParams(window.location.search);
    function getParam(key, def) {
      return params.has(key) ? params.get(key) : def;
    }
    function setParam(key, val) {
      params.set(key, val);
      history.replaceState(null, '', '?' + params.toString());
    }

    let tierConfigGlobal = null;
    // --- 추가: 툴팁에 표시할 전체 캐릭터 데이터 (setupTooltipPositioning에서 사용) ---
    // loadAndRender에서 로드된 데이터를 여기에 저장합니다.
    let currentCharacterData = [];
    let currentIsCompareMode = false;
    // --------------------------------------------------------------------------


    // --- 수정: 비교 모드 상태 변수 (초기 로드 시 URL 파라미터로 설정) ---
    let isCompareMode = params.get('compare') === '1';
    // ---------------------------------

    // --- 수정: 현재 모드에 따라 body 클래스 추가/제거 (initDropdowns에서 처리) ---
    // 초기 body 클래스 설정은 initDropdowns 내부로 이동
    // -------------------------------------------------


    // 1) 설정 로드 & 드롭다운 초기화
    Promise.all([
        fetch('/config.ini').then(r => r.text()),
        fetch('/versions.json').then(r => r.json())
    ]).then(([iniString, versionList]) => {
        const config = parseINI(iniString);
        tierConfigGlobal = config.tiers;

        // --- 수정: initDropdowns에 versionList 전달 ---
        initDropdowns(versionList);
        // ------------------------------------------
        loadAndRender();
    }).catch(err => console.error('설정 로드 실패:', err));

    // 2) 드롭다운 초기화
    // --- 수정: versionList 인자 추가 ---
    function initDropdowns(versionList) {
        // 현재 비교 모드 상태에 따라 body 클래스 업데이트 /* 기존 유지 */
        if (isCompareMode) { /* 기존 유지 */
            document.body.classList.add('is-compare-mode'); /* 기존 유지 */
        } else { /* 기존 유지 */
            document.body.classList.remove('is-compare-mode'); /* 기존 유지 */
        } /* 기존 유지 */


        // 버전 /* 기존 유지 */
        versionSelect.innerHTML = ''; /* 기존 유지 */
        versionList.sort().reverse().forEach(v => { /* 기존 유지 */
            versionSelect.insertAdjacentHTML( /* 기존 유지 */
              'beforeend', /* 기존 유지 */
              `<option value="${v}">${v}</option>` /* 기존 유지 */
            ); /* 기존 유지 */
        }); /* 기존 유지 */
        // 티어 /* 기존 유지 */
        const tierMap = { /* 기존 유지 */
            platinum_plus: "플래티넘+", /* 기존 유지 */
            diamond_plus:  "다이아몬드+", /* 기존 유지 */
            meteorite_plus:"메테오라이트+", /* 기존 유지 */
            mithril_plus:  "미스릴+", /* 기존 유지 */
            in1000:        "in1000" /* 기존 유지 */
        }; /* 기존 유지 */
        tierSelect.innerHTML = ''; /* 기존 유지 */
        Object.entries(tierMap).forEach(([key,name]) => { /* 기존 유지 */
            tierSelect.insertAdjacentHTML( /* 기존 유지 */
              'beforeend', /* 기존 유지 */
              `<option value="${key}">${name}</option>` /* 기존 유지 */
            ); /* 기존 유지 */
        }); /* 기존 유지 */
        // 구간 /* 기존 유지 */
        periodSelect.innerHTML = ` /* 기존 유지 */
          <option value="latest">전체</option> /* 기존 유지 */
          <option value="3day">최근 3일</option> /* 기존 유지 */
          <option value="7day">최근 7일</option> /* 기존 유지 */
        `; /* 기존 유지 */

        // --- 수정: 비교 드롭다운 및 UI 초기화 --- /* 기존 유지 */
        // 비교 모드 체크박스 초기 상태 설정 /* 기존 유지 */
        compareCheckbox.checked = isCompareMode; /* 기존 유지 */

        if (isCompareMode) { /* 기존 유지 */
             // 비교 드롭다운도 채우기 /* 기존 유지 */
             versionSelectCompare.innerHTML = ''; // Clear before populating /* 기존 유지 */
             versionList.sort().reverse().forEach(v => { /* 기존 유지 */
                 versionSelectCompare.insertAdjacentHTML( /* 기존 유지 */
                   'beforeend', /* 기존 유지 */
                   `<option value="${v}">${v}</option>` /* 기존 유지 */
                 ); /* 기존 유지 */
             }); /* 기존 유지 */
             tierSelectCompare.innerHTML = ''; // Clear before populating /* 기존 유지 */
             Object.entries(tierMap).forEach(([key,name]) => { /* 기존 유지 */
                 tierSelectCompare.insertAdjacentHTML( /* 기존 유지 */
                   'beforeend', /* 기존 유지 */
                   `<option value="${key}">${name}</option>` /* 기존 유지 */
                 ); /* 기존 유지 */
             }); /* 기존 유지 */
             periodSelectCompare.innerHTML = ` /* 기존 유지 */
               <option value="latest">전체</option> /* 기존 유지 */
               <option value="3day">최근 3일</option> /* 기존 유지 */
               <option value="7day">최근 7일</option> /* 기존 유지 */
             `; /* 기존 유지 */

             // 비교 모드 UI 표시 /* 기존 유지 */
             // --- 수정 제안: display 값을 'table-row'에서 'flex'로 변경 ---
             comparisonControlsDiv.style.display = 'flex'; // 'table-row' 대신 'flex' 사용
             // ----------------------------------------------------
             compareModeLabel.style.display = 'inline'; /* 기존 유지 */

             // 색상 강조 체크박스 관련 로직 제거 /* 기존 유지 */

        } else { /* 기존 유지 */
             // 단일 모드 UI 숨김 /* 기존 유지 */
             comparisonControlsDiv.style.display = 'none'; /* 기존 유지 */
             compareModeLabel.style.display = 'none'; /* 기존 유지 */

             // 색상 강조 체크박스 관련 로직 제거 /* 기존 유지 */
        } /* 기존 유지 */
        // ------------------------------------ /* 기존 유지 */


        // URL → 드롭다운 값 복원 /* 기존 유지 */
        // versionList가 역순으로 정렬되어 있으므로 versionList[0]은 가장 최신 버전
        versionSelect.value = getParam('version', versionList[0]); /* 기존 유지 */
        tierSelect.value    = getParam('tier',    'diamond_plus'); /* 기존 유지 */
        periodSelect.value  = getParam('period',  'latest'); /* 기존 유지 */

        // --- 추가: 비교 드롭다운 URL 값 복원 --- /* 기존 유지 */
        if (isCompareMode) { /* 기존 유지 */
             versionSelectCompare.value = getParam('version2', versionList[0]); /* 기존 유지 */
             tierSelectCompare.value    = getParam('tier2',    'diamond_plus'); /* 기존 유지 */
             periodSelectCompare.value  = getParam('period2',  'latest'); /* 기존 유지 */
        } /* 기존 유지 */
        // ------------------------------------ /* 기존 유지 */


        // 변경 시 URL 갱신 + 재렌더 /* 기존 유지 */
        versionSelect.addEventListener('change', () => { /* 기존 유지 */
            // --- 수정: 비교 모드 여부에 따라 비교 파라미터 삭제 --- /* 기존 유지 */
            // 이 로직은 compareCheckbox change 이벤트 리스너로 옮겨졌으므로 여기서는 삭제
            // if (!compareCheckbox.checked) { // 체크박스가 꺼져있으면 (단일 모드 상태로 변경됐으면) /* 기존 유지 */
            //      params.delete('version2'); /* 기존 유지 */
            //      params.delete('tier2'); /* 기존 유지 */
            //      params.delete('period2'); /* 기존 유지 */
            //      params.delete('compare'); /* 기존 유지 */
            // } /* 기존 유지 */
            // ------------------------------------ /* 기존 유지 */
            setParam('version', versionSelect.value); /* 기존 유지 */
            loadAndRender(); /* 기존 유지 */
        }); /* 기존 유지 */
        tierSelect.addEventListener('change', () => { /* 기존 유지 */
            // --- 수정: 비교 모드 여부에 따라 비교 파라미터 삭제 --- /* 기존 유지 */
            // 이 로직은 compareCheckbox change 이벤트 리스너로 옮겨졌으므로 여기서는 삭제
            // if (!compareCheckbox.checked) { /* 기존 유지 */
            //      params.delete('version2'); /* 기존 유지 */
            //      params.delete('tier2'); /* 기존 유지 */
            //      params.delete('period2'); /* 기존 유지 */
            //      params.delete('compare'); /* 기존 유지 */
            // } /* 기존 유지 */
            // ------------------------------------ /* 기존 유지 */
            setParam('tier', tierSelect.value); /* 기존 유지 */
            loadAndRender(); /* 기존 유지 */
        }); /* 기존 유지 */
        periodSelect.addEventListener('change', () => { /* 기존 유지 */
            // --- 수정: 비교 모드 여부에 따라 비교 파라미터 삭제 --- /* 기존 유지 */
            // 이 로직은 compareCheckbox change 이벤트 리스너로 옮겨졌으므로 여기서는 삭제
            // if (!compareCheckbox.checked) { /* 기존 유지 */
            //      params.delete('version2'); /* 기존 유지 */
            //      params.delete('tier2'); /* 기존 유지 */
            //      params.delete('period2'); /* 기존 유지 */
            //      params.delete('compare'); /* 기존 유지 */
            // } /* 기존 유지 */
            // ------------------------------------ /* 기존 유지 */
            setParam('period', periodSelect.value); /* 기존 유지 */
            loadAndRender(); /* 기존 유지 */
        }); /* 기존 유지 */

        // --- 추가: 비교 드롭다운 변경 이벤트 리스너 --- /* 기존 유지 */
        // 비교 모드 체크박스 상태와 상관없이 리스너는 항상 부착합니다.
        // loadAndRender 내부에서 isCompareMode에 따라 로직이 분기됩니다.
        versionSelectCompare.addEventListener('change', () => { /* 기존 유지 */
            setParam('version2', versionSelectCompare.value); /* 기존 유지 */
            loadAndRender(); /* 기존 유지 */
        }); /* 기존 유지 */
        tierSelectCompare.addEventListener('change', () => { /* 기존 유지 */
            setParam('tier2', tierSelectCompare.value); /* 기존 유지 */
            loadAndRender(); /* 기존 유지 */
        }); /* 기존 유지 */
        periodSelectCompare.addEventListener('change', () => { /* 기존 유지 */
            setParam('period2', periodSelectCompare.value); /* 기존 유지 */
            loadAndRender(); /* 기존 유지 */
        }); /* 기존 유지 */
        // ---------------------------------------------------- /* 기존 유지 */

        // --- 추가: 비교 모드 체크박스 이벤트 리스너 --- /* 기존 유지 */
        compareCheckbox.addEventListener('change', () => { /* 기존 유지 */
             isCompareMode = compareCheckbox.checked; // 상태 업데이트 /* 기존 유지 */
             setParam('compare', isCompareMode ? '1' : '0'); // URL 업데이트 /* 기존 유지 */

             // 비교 모드가 꺼지면 비교 관련 파라미터 삭제 /* 기존 유지 */
             if (!isCompareMode) { /* 기존 유지 */
                 params.delete('version2'); /* 기존 유지 */
                 params.delete('tier2'); /* 기존 유지 */
                 params.delete('period2'); /* 기존 유지 */
             } /* 기존 유지 */
             history.replaceState(null, '', '?' + params.toString()); // URL 바로 반영 /* 기존 유지 */

             // UI 다시 초기화 및 데이터 재로드 /* 기존 유지 */
             initDropdowns(versionList); // 비교 드롭다운 표시/숨김, body 클래스 등 업데이트 /* 기존 유지 */
             loadAndRender(); // 데이터 재로드 /* 기존 유지 */
        }); /* 기존 유지 */
        // --------------------------------------------- /* 기존 유지 */
    }

    // 3) 데이터 로드 & 렌더
    function loadAndRender() {
        // --- 수정: currentIsCompareMode 업데이트 ---
        currentIsCompareMode = isCompareMode;
        // -----------------------------------------

        if (isCompareMode) {
            const version1 = versionSelect.value;
            const tier1 = tierSelect.value;
            const period1 = periodSelect.value;

            const version2 = versionSelectCompare.value;
            const tier2 = tierSelectCompare.value;
            const period2 = periodSelectCompare.value;

            if (version1 === version2 && tier1 === tier2 && period1 === period2) {
                 table.innerHTML = '<tr><td colspan="15">데이터 1과 데이터 2가 동일합니다.</td></tr>'; // colspan 조정 필요
                 // --- 수정: 데이터 없을 시 툴팁 위치 설정 호출 (빈 데이터 전달) ---
                 currentCharacterData = []; // 데이터 비어있음
                 setupTooltipPositioning(currentCharacterData, currentIsCompareMode); // 빈 데이터 전달
                 // -------------------------------------------------
                 setupTablePopup(); // 팝업 설정
                 return;
            }

            // >>> 수정 시작: '/data/' 폴더를 '/stats/' 폴더로 변경
            const url1 = `/stats/${version1}/${tier1}.json`;
            const url2 = `/stats/${version2}/${tier2}.json`;
            // >>> 수정 끝

            Promise.all([
                fetch(url1).then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url1}`);
                    return res.json();
                }).catch(err => { console.error(`Failed to fetch ${url1}:`, err); return null; }), // 에러 발생 시 null 반환
                fetch(url2).then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status} for ${url2}`);
                    return res.json();
                }).catch(err => { console.error(`Failed to fetch ${url2}:`, err); return null; }) // 에러 발생 시 null 반환
            ])
            .then(([json1, json2]) => {
                if (!json1 && !json2) {
                     table.innerHTML = '<tr><td colspan="15">두 데이터 모두 불러오는 데 실패했습니다.</td></tr>'; // colspan 조정 필요
                     // --- 수정: 데이터 없을 시 툴팁 위치 설정 호출 (빈 데이터 전달) ---
                     currentCharacterData = []; // 데이터 비어있음
                     setupTooltipPositioning(currentCharacterData, currentIsCompareMode); // 빈 데이터 전달
                     // -------------------------------------------------
                     setupTablePopup(); // 팝업 설정
                     return;
                }

                const history1 = json1 ? json1['통계'] : {};
                const history2 = json2 ? json2['통계'] : {};

                let entries1, entries2;

                // --- 수정 시작: 기간에 따라 common.js의 함수 호출 ---
                if (period1 === 'latest') {
                    // 데이터 1 기간이 'latest'이면 스냅샷 사용 (common.js의 extractPeriodEntries)
                    entries1 = commonExtractPeriodEntries(history1, period1);
                } else {
                    // 데이터 1 기간이 '3day' 또는 '7day'이면 델타 통계 사용 (common.js의 extractDeltaEntries)
                    entries1 = extractDeltaEntries(history1, period1);
                }

                if (period2 === 'latest') {
                     // 데이터 2 기간이 'latest'이면 스냅샷 사용 (common.js의 extractPeriodEntries)
                     entries2 = commonExtractPeriodEntries(history2, period2);
                } else {
                     // 데이터 2 기간이 '3day' 또는 '7day'이면 델타 통계 사용 (common.js의 extractDeltaEntries)
                     entries2 = extractDeltaEntries(history2, period2);
                }
                // --- 수정 끝

                // 각 데이터셋 별도로 가공 (점수, 티어, 픽률 계산)
                // calculateTiers는 common.js의 함수를 사용합니다.
                // entries1/entries2가 델타 데이터인 경우, calculateTiers는 해당 델타 데이터의 특성을 반영한 점수/티어를 계산합니다.
                const avgScore1 = calculateAverageScore(entries1);
                const stddev1 = calculateStandardDeviation(entries1, avgScore1);
                const scored1 = calculateTiers(entries1, avgScore1, stddev1, tierConfigGlobal);

                const avgScore2 = calculateAverageScore(entries2);
                const stddev2 = calculateStandardDeviation(entries2, avgScore2);
                const scored2 = calculateTiers(entries2, avgScore2, stddev2, tierConfigGlobal);


                // 두 데이터셋 병합 및 차이 계산 (common.js 함수 사용)
                const comparisonData = mergeDataForComparison(scored1, scored2);
                // --- 수정: currentCharacterData 업데이트 ---
                currentCharacterData = comparisonData;
                // -----------------------------------------

                // 병합 결과가 없으면 표시할 데이터가 없는 것임
                if (comparisonData.length === 0) {
                    table.innerHTML = '<tr><td colspan="15">선택한 조건에 해당하는 비교 데이터가 없습니다.</td></tr>'; // colspan 조정 필요
                    // --- 수정: 데이터 없을 시 툴팁 위치 설정 호출 (빈 데이터 전달) ---
                    setupTooltipPositioning(currentCharacterData, currentIsCompareMode); // 빈 데이터 전달
                    // -------------------------------------------------
                    setupTablePopup(); // 팝업 설정
                    return;
                }

                // displayTierTable에 병합된 데이터와 비교 모드 플래그 전달
                displayTierTable(comparisonData, isCompareMode);
                setupTablePopup(); // 팝업 설정
                // --- 추가: 툴팁 위치 설정 함수 호출 (데이터를 인자로 전달) ---
                setupTooltipPositioning(currentCharacterData, currentIsCompareMode); // 데이터와 모드를 인자로 전달
                // --------------------------------------------------

            })
            .catch(err => {
                console.error('비교 데이터 처리 실패:', err);
                table.innerHTML = `<tr><td colspan="15">데이터 처리 중 오류가 발생했습니다: ${err.message}</td></tr>`; // colspan 조정 필요
                 // --- 수정: 에러 발생 시 툴팁 위치 설정 호출 (빈 데이터 전달) ---
                currentCharacterData = []; // 데이터 비어있음
                setupTooltipPositioning(currentCharacterData, currentIsCompareMode); // 빈 데이터 전달
                // -------------------------------------------------
                setupTablePopup(); // 팝업 설정
            });

        } else {
            // --- 기존 단일 모드 로직 ---
            const version = versionSelect.value;
            const tier    = tierSelect.value;
            const period  = periodSelect.value;

            // >>> 수정 시작: '/data/' 폴더를 '/stats/' 폴더로 변경
            fetch(`/stats/${version}/${tier}.json`)
            // >>> 수정 끝
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                    return res.json();
                })
                .then(json => {
                    const history = json['통계'];
                    // 단일 모드는 latest/3day/7day 모두 기간의 '스냅샷' 데이터(common.js의 extractPeriodEntries)를 가져옵니다.
                    // 티어 테이블의 단일 모드 '최근 N일' 기간은 변화량 데이터를 보여주는 것이 아니라,
                    // 해당 시점의 전체 통계 데이터를 보여주는 것입니다. (script_statistics.js와 통일)
                    // 따라서 common.js의 extractPeriodEntries (스냅샷) 함수를 사용합니다.
                    const entries = commonExtractPeriodEntries(history, period);

                    const avgScore = calculateAverageScore(entries);
                    const stddev   = calculateStandardDeviation(entries, avgScore);
                    const scored   = calculateTiers(entries, avgScore, stddev, tierConfigGlobal);

                    // --- 수정: currentCharacterData 업데이트 ---
                    currentCharacterData = scored;
                    // -----------------------------------------


                    if (entries.length === 0) { // 기간에 해당하는 데이터가 아예 없는 경우
                         let message = '데이터가 없습니다.';
                         if (period !== 'latest') {
                              // latest가 아닌데 데이터가 없으면 기간 부족 메시지
                              message = '선택한 기간에 해당하는 데이터가 부족합니다.';
                         }
                         table.innerHTML = `<tr><td colspan="15">${message}</td></tr>`; // colspan 조정 필요

                         // --- 수정: 데이터 없을 시 툴팁 위치 설정 호출 (빈 데이터 전달) ---
                         currentCharacterData = []; // 데이터 비어있음
                         setupTooltipPositioning(currentCharacterData, currentIsCompareMode); // 빈 데이터 전달
                         // -------------------------------------------------
                         setupTablePopup(); // 팝업 설정
                         return;
                    }


                    // displayTierTable에 단일 데이터와 비교 모드 플래그 전달
                    displayTierTable(scored, isCompareMode);
                    setupTablePopup(); // 팝업 설정
                    // --- 추가: 툴팁 위치 설정 함수 호출 (데이터와 모드를 인자로 전달) ---
                    setupTooltipPositioning(currentCharacterData, currentIsCompareMode); // 데이터와 모드를 인자로 전달
                    // --------------------------------------------------
                })
                .catch(err => {
                    console.error('데이터 로드 실패:', err);
                    table.innerHTML = '<tr><td colspan="15">데이터를 불러오는 데 실패했습니다.</td></tr>'; // colspan 조정 필요
                     // --- 수정: 에러 발생 시 툴팁 위치 설정 호출 (빈 데이터 전달) ---
                    currentCharacterData = []; // 데이터 비어있음
                    setupTooltipPositioning(currentCharacterData, currentIsCompareMode); // 빈 데이터 전달
                    // -------------------------------------------------
                    setupTablePopup(); // 팝업 설정
                });
            // --------------------------
        }
        // ---------------------------------
    }

    // 4) 기간별 데이터 추출 (기존 로컬 함수 삭제됨)
    // 이 위치에 있던 extractPeriodEntries 함수는 삭제되었습니다.

    // 5) 티어별 테이블 렌더링 (기존 함수 유지하되 툴팁 생성 로직 제거) - 기존 유지
    // --- 수정: isCompareMode 인자 추가 및 비교 모드 처리 로직 추가 ---
    function displayTierTable(data, isCompareMode) {
        const tierLabels = {
          platinum_plus:  "플래티넘+",
          diamond_plus:   "다이아몬드+",
          meteorite_plus: "메테오라이트+",
          mithril_plus:  "미스릴+",
          in1000:         "in1000"
        };

        const versionLabel = versionSelect.value;
        const tierLabel    = tierLabels[tierSelect.value];

        const tiers = ['S+', 'S', 'A', 'B', 'C', 'D', 'F'];
        const groups = tiers.reduce((o, t) => (o[t] = [], o), groups); // groups 객체 초기화 오류 수정

        // --- 수정: 데이터 그룹화 로직 (비교 모드 고려) ---
        data.forEach(item => {
            // 비교 모드일 때는 '티어 (Ver1)' 기준으로 그룹화 (데이터 1 기준 표)
            // 단일 모드일 때는 '티어' 기준으로 그룹화
            const itemTier = isCompareMode ? item['티어 (Ver1)'] : item.티어;
            // 단일 모드 또는 비교 모드에서 Ver1 티어가 유효한 경우에만 그룹에 추가
            // Ver1에 없는 캐릭터 (신규)는 티어 테이블에 표시되지 않음 (기존 동작 유지)
            if (itemTier && groups[itemTier]) { // itemTier가 null이거나 undefined인 경우 방지
                 groups[itemTier].push(item);
            }
        });
        // ----------------------------------------------------

        // --- 수정: totalSample 계산 (단일 모드에서만 사용) - 이 계산은 displayTierTable에서 직접 사용되지 않으므로 유지 ---
        // 단일 모드: 현재 데이터의 표본수 합계
        // 비교 모드: 픽률은 개별 픽률 사용, 총 표본수는 필요 없음.
        const totalSample = isCompareMode
            ? 0 // 비교 모드에서는 총 표본수 합계 사용하지 않음
            : data.reduce((sum, i) => sum + (i['표본수'] || 0), 0);
        // ---------------------------------------------

        const perRow      = 15;
        let html = '';

        tiers.forEach(tier => {
          // 시작 태그: <tr><th>...
          html += `<tr class="tier-row tier-${tier}"><th>${tier}</th>`;

          // <td> 시작(첫 행이면 position:relative)
          if (tier === 'S+') {
            html += `<td style="position: relative;"><div class="tier-info" style="
                         position: absolute;
                         top: 4px;
                         right: 4px;
                         padding: 2px 6px;
                         background: rgba(255,255,255,0.8);
                         border-radius: 4px;
                         font-size: 0.85em;
                         font-weight: bold;
                         white-space: nowrap;
                      ">${versionLabel} | ${tierLabel}</div><div>`; // white-space: nowrap 추가
          } else {
            html += `<td><div>`;
          }

          // 슬롯들 렌더링
          // --- 수정: sortData 함수 사용 (비교 모드 고려) ---
          // common.js의 sortData 함수를 사용하여 '점수' 기준으로 내림차순 정렬
          // 비교 모드일 때는 '점수 (Ver1)' 기준으로 정렬
          // 단일 모드일 때는 '점수' 기준으로 정렬
          const sortKey = isCompareMode ? '점수 (Ver1)' : '점수';
          const sortMode = isCompareMode ? 'value1' : 'value'; // 비교 모드일 때는 value1 모드로 정렬
          const entries = sortData(groups[tier], sortKey, false, sortMode); // false: 내림차순 (좋은 것 위로)
          // -----------------------------

          if (entries.length === 0) {
            // 빈 슬롯 표시 (기존 이미지 사용)
            // 15개 모두 채워서 레이아웃 유지
             for (let i = 0; i < perRow; i++) {
                // --- 수정: placeholder 이미지에는 툴팁 관련 요소 생성 안함 (기존 유지) ---
                html += `<span class="tooltip-container">
                           <img src="/image/placeholder.png" alt="빈 슬롯" style="opacity:0;">
                         </span>`;
                // ---------------------------------------------------------------------
             }

          } else {
            entries.forEach((e) => { // i 변수 사용되지 않아 제거
              const imgName = convertExperimentNameToImageName(e.실험체).replace(/ /g,'_');
              // --- 수정: 툴팁 박스 div 생성 코드 제거. 툴팁 내용은 data 속성에 저장 ---
              // 툴팁 내용은 setupTooltipPositioning 함수에서 동적으로 생성하므로 여기서 HTML을 만들지 않습니다.
              // const tooltip = `<div class="tooltip-box">${tooltipContent}</div>`; // 이 줄 제거
              // -------------------------------------------------------------------

              // --- 순위 변동 표시 요소 (기존 수정된 내용 유지) ---
              let rankChangeOverlayHtml = '';
              if (isCompareMode) { /* ... 순위 변동 로직 ... */
                   const rankChangeValue = e['순위 변화값']; // 숫자 또는 string (이제 latest - past)
                   let rankChangeText = '';
                   let rankChangeClass = '';

                   if (typeof rankChangeValue === 'number') {
                        const absChange = Math.abs(rankChangeValue);
                        // --- 수정 시작: 순위 변화값 부호에 따른 ▲/▼ 기호 및 클래스 변경 ---
                        if (rankChangeValue < 0) { // 순위 숫자가 감소 (좋아짐): ▲
                            rankChangeText = `▲${absChange}`;
                            rankChangeClass = 'rank-change-down'; // 순위 번호는 내려감
                        } else if (rankChangeValue > 0) { // 순위 숫자가 증가 (나빠짐): ▼
                            rankChangeText = `▼${absChange}`;
                            rankChangeClass = 'rank-change-up'; // 순위 번호는 올라감
                        } else { // 순위 변화 없음
                            rankChangeText = `=`;
                            rankChangeClass = 'rank-change-same';
                        }
                        // --- 수정 끝
                   } else { // 문자열 ('신규 → ', '→ 삭제', '-')
                        if (rankChangeValue === '신규 → ') { rankChangeText = '신규'; rankChangeClass = 'rank-change-up'; }
                        else if (rankChangeValue === '→ 삭제') { rankChangeText = '삭제'; rankChangeClass = 'rank-change-down'; }
                        else { rankChangeText = '-'; rankChangeClass = 'rank-change-same'; } // '-' 또는 예상치 못한 값
                   }
                   // 텍스트가 '신규', '삭제', '=', '▲N', '▼N' 등 의미 있는 변화를 나타낼 때만 오버레이 표시
                   if (rankChangeText !== '-' && rankChangeText !== '') {
                        rankChangeOverlayHtml = `<div class="rank-change-overlay ${rankChangeClass}" data-text="${rankChangeText}">${rankChangeText}</div>`;
                   }
              }
              // -------------------------------------------------

              // --- 수정: 툴팁 컨테이너에 data-character-name 속성만 추가 ---
              // 툴팁 내용은 JS에서 데이터를 찾아 동적으로 생성합니다.
              html += `<span class="tooltip-container" data-character-name="${e.실험체}">
                         <img src="/image/tier_table/${imgName}.png" alt="${e.실험체}">
                         ${rankChangeOverlayHtml}
                       </span>`;
              // -----------------------------------------------------------
            });

            // perRow 개수 채우기 (기존 유지)
            const remainingSlots = perRow - (entries.length % perRow);
            if (remainingSlots > 0 && remainingSlots < perRow) {
                 for (let i = 0; i < remainingSlots; i++) {
                      // --- 수정: placeholder 이미지에는 툴팁 관련 요소 생성 안함 (기존 유지) ---
                      html += `<span class="tooltip-container">
                                 <img src="/image/placeholder.png" alt="빈 슬롯" style="opacity:0;">
                               </span>`;
                      // ---------------------------------------------------------------------
                 }
            }
          }

          html += `</div></td></tr>`; // 유지
        });

        table.innerHTML = html; // 유지

        // --- 색상 강조 적용 로직 제거 (기존 유지) ---
    }

    // --- 추가: 툴팁 위치를 동적으로 계산하여 설정하는 함수 --- - 기존 유지
    // 이 함수는 테이블이 렌더링된 후에 호출되며, 로드된 데이터와 비교 모드 상태를 인자로 받습니다.
    function setupTooltipPositioning(characterData, isCompareMode) {
        // 단 하나의 툴팁 요소를 관리합니다.
        let tooltipBox = document.getElementById('global-tooltip-box');
        if (!tooltipBox) {
            tooltipBox = document.createElement('div');
            tooltipBox.id = 'global-tooltip-box';
            tooltipBox.className = 'tooltip-box'; // 기존 CSS 스타일 재활용
            document.body.appendChild(tooltipBox);
        }

        // 툴팁 내용을 동적으로 찾기 위한 데이터 맵 생성
        // characterData가 빈 배열일 수도 있습니다.
        const characterDataMap = new Map((characterData || []).map(item => [item['실험체'], item]));

        // data-character-name 속성이 있는 컨테이너만 선택 (placeholder 제외)
        const tooltipContainers = table.querySelectorAll('.tooltip-container[data-character-name]');

        tooltipContainers.forEach(container => {
             // 기존 mouseover/mouseout 이벤트 리스너 제거 (중복 부착 방지)
             const oldMouseoverHandler = container._mouseoverHandler;
             const oldMouseoutHandler = container._mouseoutHandler;
             if (oldMouseoverHandler) {
                 container.removeEventListener('mouseover', oldMouseoverHandler);
             }
             if (oldMouseoutHandler) {
                 container.removeEventListener('mouseout', oldMouseoutHandler);
             }


            // 마우스 이벤트 리스너를 추가합니다.
            const mouseoverHandler = () => {
                const characterName = container.dataset.characterName;
                const character = characterDataMap.get(characterName); // 캐릭터 데이터 찾기

                if (!character) {
                    // 데이터가 없으면 툴팁 표시 안함
                    tooltipBox.style.visibility = 'hidden';
                    tooltipBox.style.opacity = '0';
                    return;
                }

                // 툴팁 내용 동적 생성 (단일/비교 모드에 따라 다르게)
                let tooltipContent;
                if (isCompareMode) {
                     // 비교 모드 툴팁 내용 형식 (요청대로: 값2 → 값1)
                     const pr1 = character['픽률 (Ver1)'] !== null && character['픽률 (Ver1)'] !== undefined ? (character['픽률 (Ver1)'] || 0).toFixed(2) + '%' : '-';
                     const pr2 = character['픽률 (Ver2)'] !== null && character['픽률 (Ver2)'] !== undefined ? (character['픽률 (Ver2)'] || 0).toFixed(2) + '%' : '-';
                     const rp1 = character['RP 획득 (Ver1)'] !== null && character['RP 획득 (Ver1)'] !== undefined ? (character['RP 획득 (Ver1)'] || 0).toFixed(1) : '-';
                     const rp2 = character['RP 획득 (Ver2)'] !== null && character['RP 획득 (Ver2)'] !== undefined ? (character['RP 획득 (Ver2)'] || 0).toFixed(1) : '-';
                     const win1 = character['승률 (Ver1)'] !== null && character['승률 (Ver1)'] !== undefined ? ((character['승률 (Ver1)'] || 0) * 100).toFixed(1) + '%' : '-';
                     const win2 = character['승률 (Ver2)'] !== null && character['승률 (Ver2)'] !== undefined ? ((character['승률 (Ver2)'] || 0) * 100).toFixed(1) + '%' : '-';
                     // --- 비교 모드 툴팁 내용 형식 (요청대로) ---
                     tooltipContent = `
                         ${character.실험체}<br>
                         픽률: ${pr2} → ${pr1}<br>
                         RP 획득: ${rp2} → ${rp1}<br>
                         승률: ${win2} → ${win1}
                     `;
                     // ----------------------------------------
                } else {
                     // --- 단일 모드 툴팁 내용 형식 (요청대로) ---
                     // 단일 모드에서는 totalSample 대신 해당 캐릭터의 픽률 값을 사용합니다.
                     const pickRate = character['픽률'] !== null && character['픽률'] !== undefined ? character['픽률'].toFixed(2) : '-';
                     const rp = character['RP 획득'] !== null && character['RP 획득'] !== undefined ? character['RP 획득'].toFixed(1) : '-';
                     const winRate = character['승률'] !== null && character['승률'] !== undefined ? (character['승률'] * 100).toFixed(1) : '-';
                     tooltipContent = `
                         ${character.실험체}<br>
                         픽률: ${pickRate}%<br>
                         RP: ${rp}<br>
                         승률: ${winRate}%
                     `;
                     // ---------------------------------------
                }

                tooltipBox.innerHTML = tooltipContent; // 툴팁 내용 설정

                // 툴팁을 보이게 하여 정확한 크기 계산 가능하도록 함
                tooltipBox.style.visibility = 'visible';
                tooltipBox.style.opacity = '1';
                // position: fixed; z-index: 9999; 는 CSS에 정의되어 있습니다.

                const containerRect = container.getBoundingClientRect();
                // 툴팁의 크기를 계산하기 위해 잠시 위치를 조정할 필요 없음 (CSS에 이미 fixed로 되어 있으므로)
                // 다만 내용이 업데이트 되었으니 크기 정보는 다시 가져와야 함
                const tooltipRect = tooltipBox.getBoundingClientRect(); // 툴팁의 현재 크기 및 뷰포트 위치 가져옴


                // 툴팁이 이미지 위에 나타나도록 위치 계산 (position: fixed 기준)
                // 툴팁 하단이 컨테이너 상단에서 5px 위로 떨어지도록 계산
                // window.scrollY를 더하여 페이지 스크롤 위치를 반영합니다.
                const desiredTooltipTop = containerRect.top + window.scrollY - tooltipRect.height - 5;
                // 툴팁 중앙이 컨테이너 중앙에 오도록 위치 계산
                const desiredTooltipLeft = containerRect.left + window.scrollX + containerRect.width / 2 - tooltipRect.width / 2;


                // 계산된 위치를 툴팁 요소의 인라인 스타일로 적용
                tooltipBox.style.top = `${desiredTooltipTop}px`;
                tooltipBox.style.left = `${desiredTooltipLeft}px`;

                // 기존 CSS에서 bottom, right, transform은 제거했으므로 여기서 설정하지 않아도 됩니다.
                tooltipBox.style.bottom = 'auto';
                tooltipBox.style.right = 'auto';
                tooltipBox.style.transform = 'none'; // translateX(-50%) 무시

                // 툴팁이 뷰포트 좌우 경계를 벗어나지 않도록 조정 (선택 사항)
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight; // 상단 경계 조정을 위해 필요

                // 좌측 경계 조정
                if (parseFloat(tooltipBox.style.left) < window.scrollX + 5) { // 뷰포트 좌측에서 5px 이내로 붙으면
                    tooltipBox.style.left = `${window.scrollX + 5}px`;
                     tooltipBox.style.transform = 'none'; // 재계산 시 transform 해제
                }
                // 우측 경계 조정
                if (parseFloat(tooltipBox.style.left) + tooltipRect.width > window.scrollX + viewportWidth - 5) { // 뷰포트 우측에서 5px 이내로 붙으면
                    tooltipBox.style.left = `${window.scrollX + viewportWidth - tooltipRect.width - 5}px`;
                     tooltipBox.style.transform = 'none'; // 재계산 시 transform 해제
                }
                 // 상단 경계 조정 (툴팁이 뷰포트 맨 위에 붙는 경우 방지)
                 if (parseFloat(tooltipBox.style.top) < window.scrollY + 5) {
                      tooltipBox.style.top = `${window.scrollY + 5}px`;
                 }

            };

            const mouseoutHandler = () => {
                // 툴팁 숨김
                tooltipBox.style.opacity = '0';
                // CSS transition 시간(0.3s) 후에 완전히 숨기도록 visibility를 변경합니다.
                tooltipBox.addEventListener('transitionend', function handler() {
                     if (tooltipBox.style.opacity === '0') {
                          tooltipBox.style.visibility = 'hidden';
                          // 이벤트 리스너 제거 (once: true 옵션 사용)
                     }
                }, { once: true }); // once: true 옵션을 사용하여 한 번만 실행 후 자동 제거

                 // 마우스 아웃 시 동적으로 설정된 위치 스타일을 제거하여 다음 마우스 오버 시 정확히 다시 계산되도록 합니다.
                 // CSS에 설정된 기본값 (position: fixed, z-index: 9999)은 유지됩니다.
                 tooltipBox.style.top = '';
                 tooltipBox.style.left = '';
                 tooltipBox.style.bottom = ''; // 기본값 auto
                 tooltipBox.style.right = '';   // 기본값 auto
                 tooltipBox.style.transform = ''; // 기본값 none
            };

            container.addEventListener('mouseover', mouseoverHandler);
            container.addEventListener('mouseout', mouseoutHandler);

             // 나중에 제거할 수 있도록 이벤트 리스너 참조 저장
             container._mouseoverHandler = mouseoverHandler;
             container._mouseoutHandler = mouseoutHandler;
        });
    }
    // -----------------------------------------------------


    // 6) 팝업 초기화 (기존 함수 유지)
    function setupTablePopup() {
        const popup = document.getElementById('image-popup');
        const popupImg = document.getElementById('popup-image');
        const popupTableButton = document.getElementById('popup-table-button');
        const targetTable = document.getElementById('tier-table'); // Use getElementById for clarity

        // 요소가 모두 존재하는지 확인
        if (!popupTableButton || !popup || !popupImg || !targetTable) {
             // console.error("Popup elements or target table not found."); // 디버그용
             // 테이블이 로드되기 전이나 에러 시에는 targetTable이 없을 수 있습니다.
             // 버튼만이라도 존재하면 이벤트 리스너를 붙입니다.
              if (popupTableButton && popup && popupImg) {
                   setupButtonListener(popupTableButton, popup, popupImg, container); // container 전체를 캡처 대상으로
              }
             return;
        }

        // targetTable이 로드된 경우에만 테이블 캡처 리스너를 붙입니다.
        setupButtonListener(popupTableButton, popup, popupImg, targetTable);

         // 팝업 닫기 버튼 이벤트 리스너 (한 번만 설정)
         const closeButton = popup.querySelector('.image-popup-close');
         if (closeButton && !closeButton.onclick) { // 이미 리스너가 없으면 추가
              closeButton.onclick = () => { popup.style.display = 'none'; };
         }
    }

    // 팝업 버튼 리스너 설정 헬퍼 함수 (targetElement를 캡처)
    function setupButtonListener(button, popup, popupImg, targetElement) {
         // 기존 클릭 이벤트 리스너가 있다면 제거 (중복 부착 방지)
         if (button.onclick) {
              button.onclick = null;
         }

         button.onclick = () => {
              // targetElement를 캡처 대상으로 지정
              html2canvas(targetElement, {
                   backgroundColor: null, // 배경 투명하게 캡처 (필요시)
                   // scale: 2 // 고해상도 캡처를 원하면 주석 해제
              })
                .then(canvas => {
                  popup.style.display = 'block';
                  popupImg.src = canvas.toDataURL();
                })
                .catch(err => {
                     console.error("Error capturing element:", err);
                     alert("이미지 캡처 중 오류가 발생했습니다.");
                     popup.style.display = 'none'; // 팝업 숨김
                });
         };
    }

    // 7) 페이지 특화 헬퍼: 이름→이미지 변환 (기존 함수 유지)
    function convertExperimentNameToImageName(name) {
        if (name==="글러브 리 다이린") return "리다이린-글러브";
        if (name==="쌍절곤 리 다이린") return "리다이린-쌍절곤";
        if (name.startsWith("리 다이린 ")) {
            const parts = name.slice(7).split(" ");
            return `리다이린-${parts.join("-")}`;
        }
        if (name.startsWith("돌격 소총 ")) {
            const parts = name.slice(6).split(" ");
            return `${parts.join("-")}-돌격소총`;
        }
        if (name.includes(" ")) {
            const parts = name.split(" ");
            if (parts.length>=2) return `${parts[1]}-${parts[0]}`;
        }
        return name;
    }

    // --- 추가: common.js의 extractPeriodEntries 함수를 로컬 변수로 저장 (기존 유지) ---
    // 티어 테이블의 단일 모드에서는 common.js의 extractPeriodEntries (스냅샷 추출) 사용
    // 티어 테이블의 비교 모드에서는 common.js의 extractPeriodEntries 또는 extractDeltaEntries 사용
    // 이 변수는 스크립트 파일 최상위 스코프에 한 번만 선언됩니다.
    const commonExtractPeriodEntries = window.extractPeriodEntries;
    // common.js에 새로 추가된 extractDeltaEntries 함수도 전역에서 접근 가능합니다.
    const commonExtractDeltaEntries = window.extractDeltaEntries;
    // -------------------------------------------------------------------

}); // DOMContentLoaded 끝