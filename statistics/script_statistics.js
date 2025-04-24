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
    // --- 수정: compareCheckbox 변수 선언 추가 (ReferenceError 해결) ---
    const compareCheckbox = document.getElementById('compare-checkbox');
    // ---------------------------------------------

    // 상태
    let currentSortColumn = '점수';
    let currentSortAsc = false;
    let currentSortMode = 'value'; // 'value' (단일), 'value1', 'value2', 'delta'
    let lastData = []; // 로드된 원본 데이터 또는 병합된 비교 데이터
    let tierConfig = null; // config.ini에서 로드된 티어 설정
    let versionList = []; // versions.json에서 로드된 버전 목록 (Promise.all 내부에서 할당)


    // --- 수정 제안: attachSingleSortEventListeners 함수 정의를 이 위치로 이동 ---
    // 9) 단일 모드용 정렬 이벤트 리스너 부착
    function attachSingleSortEventListeners(ths, renderFunc) {
         ths.forEach(th => {
            const col = th.dataset.col;

            // data-nosort 속성이 있다면 정렬 제외 (실험체 컬럼)
            if (th.hasAttribute('data-nosort')) {
                 th.style.cursor = 'default';
                 th.setAttribute('data-arrow', '');
                 th.classList.remove('delta-sort-indicator');
                 th.onclick = null; // 기존 클릭 이벤트 제거
                 return; // 정렬 제외 컬럼
            }

            th.style.cursor = 'pointer'; // 정렬 가능 컬럼

            // 기존 이벤트 리스너가 있다면 제거 (중복 부착 방지)
            if (th.onclick) {
                 th.onclick = null;
            }

            th.setAttribute('data-arrow', ''); // 기존 화살표 리셋
            th.classList.remove('delta-sort-indicator'); // 델타 정렬 표시자 클래스 리셋

            // 현재 정렬 기준과 일치하면 화살표 표시
            if (currentSortColumn === col && currentSortMode === 'value') {
                th.setAttribute('data-arrow', currentSortAsc ? '▲' : '▼');
            }

            th.onclick = () => {
                // 단일 모드는 value 오름/내림차 순환만
                if (currentSortColumn === col) {
                     currentSortAsc = !currentSortAsc;
                } else {
                    currentSortColumn = col;
                    // 기본 정렬 방향 설정 (평균 순위는 오름차순, 나머지는 내림차순)
                    const isBetterWhenLower = (col === '평균 순위');
                    currentSortAsc = isBetterWhenLower ? true : false; // 평균 순위는 오름차순(작은 값 위로), 나머지는 내림차순(큰 값 위로)

                    // --- 확인: 티어 컬럼의 기본 정렬 방향 ---
                    // 티어 컬럼은 점수 기준으로 정렬되며, 점수는 클수록 좋으므로 기본 내림차순(false)이 맞습니다.
                    if (col === '티어') currentSortAsc = false;
                    // ------------------------------------

                    currentSortMode = 'value'; // 단일 모드는 value 고정
                }
                //console.log(`Single Sort: column=${currentSortColumn}, asc=${currentSortAsc}, mode=${currentSortMode}`); // 디버그
                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode);
                renderFunc(sortedData); // renderTable 호출
            };
        });
    }

    // --- 수정 제안: attachComparisonSortEventListeners 함수 정의를 이 위치로 이동 ---
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
                th.onclick = null; // 기존 클릭 이벤트 제거
                return;
            }
             th.style.cursor = 'pointer';

            // 기존 이벤트 리스너가 있다면 제거 (중복 부착 방지)
            if (th.onclick) {
                 th.onclick = null;
            }

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
                // --- 정렬 순환: Value1 ▼ -> Value1 ▲ -> Value2 ▼ -> Value2 ▲ -> Delta ▼ -> Delta ▲ -> Value1 ▼ ... ---
                // 사용자 요청: 내림차순 -> 오름차순 순환
                // 현재 코드의 modes와 directions 배열은 이미 내림차순(false) -> 오름차순(true) 순환을 구현하고 있습니다.
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
                    // 기본 정렬 방향 설정 (평균 순위는 오름차순, 나머지는 내림차순)
                    const isBetterWhenLower = (col === '평균 순위');
                    nextAsc = isBetterWhenLower ? true : false; // 평균 순위는 오름차순(작은 값 위로), 나머지는 내림차순(큰 값 위로)

                    // 예외 처리: 티어는 Value1 내림차순 시작 (S+ 위로)
                    // common.js sortData에서 '티어' Value1/Value2 정렬 시 '점수 (VerX)' 키를 사용하고, 점수는 클수록 좋음으로 처리합니다.
                    // 따라서 '점수 (VerX)' 기준 내림차순 (asc=false)일 때 S+가 위로 옵니다.
                    // 그래서 '티어' 컬럼 클릭 시 Value1 내림차순으로 시작하는 것이 맞습니다.
                    if (col === '티어') nextAsc = false;
                }

                currentSortMode = nextMode; // 현재 정렬 모드 업데이트
                currentSortAsc = nextAsc; // 현재 정렬 방향 업데이트

                //console.log(`Compare Sort: column=${currentSortColumn}, asc=${currentSortAsc}, mode=${currentSortMode}`); // 디버그

                // 업데이트된 정렬 상태를 바탕으로 데이터 정렬 및 테이블 다시 렌더링
                const sortedData = sortData(lastData, currentSortColumn, currentSortAsc, currentSortMode); // common.js의 sortData 함수 호출
                renderFunc(sortedData); // 테이블 렌더링 함수 호출 (renderComparisonTable)

                // URL 업데이트 (정렬 상태 포함)
                updateURL();

                // 화살표 및 델타 표시자는 renderFunc 호출 시 applyGradientColorsComparison 함수에 의해 업데이트됨
            };
        });
    }
    // ------------------------------------------------------------


    // URLSearchParams 인스턴스 생성
    const params = new URLSearchParams(location.search);
    let isCompareMode = params.get('compare') === '1'; // isCompareMode 변수를 let으로 선언하여 변경 가능하게 함

    // --- 추가: 현재 모드에 따라 body 클래스 추가/제거 ---
    if (isCompareMode) {
        document.body.classList.add('is-compare-mode');
    } else {
        document.body.classList.remove('is-compare-mode');
    }
    // -------------------------------------------------


    // 1) URL 파라미터 → 컨트롤에 반영
    // 이 함수는 versionList가 로드된 후에 호출되어야 합니다.
    function applyParamsToControls() {
        if (params.has('version')) versionSelect.value = params.get('version');
        if (params.has('tier')) tierSelect.value = params.get('tier');
        if (params.has('period')) periodSelect.value = params.get('period');

        // 색상 강조 체크박스 상태 로드 (비교 모드가 아닐 때만)
        if (!isCompareMode) {
            if (params.has('gradient')) {
                 gradientCheckbox.checked = params.get('gradient') === '1';
            } else {
                 // 단일 모드 기본값: 색상 강조 켜짐
                 gradientCheckbox.checked = true;
            }
            gradientCheckbox.disabled = false;
            gradientCheckbox.parentElement.style.opacity = '1';
        } else {
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

        // 비교 모드일 때 비교 드롭다운 채우기 (UI 표시 여부는 아래에서 제어)
        populateVersionDropdown(versionSelectCompare, versionList);
        populateTierDropdown(tierSelectCompare);
        populatePeriodDropdown(periodSelectCompare);


        // URL 파라미터로부터 컨트롤 상태 복원 (versionList 로드 후 호출)
        applyParamsToControls();

        // 변경 시 URL 갱신 + 데이터 갱신
        const reloadData = isCompareMode ? loadAndDisplayComparison : loadAndDisplaySingle;

        versionSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        tierSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        periodSelect.addEventListener('change', () => { updateURL(); reloadData(); });
        gradientCheckbox.addEventListener('change', () => {
            updateURL();
            // 단일 모드에서만 색상 강조 적용/해제
            if (!isCompareMode && lastData && lastData.length > 0) applyGradientColorsSingle(dataContainer.querySelector('table'));
            // 비교 모드는 renderComparisonTable에서 항상 색상 적용하므로 여기서는 단일 모드만 처리
        });

        if (isCompareMode) {
            versionSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            tierSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
            periodSelectCompare.addEventListener('change', () => { updateURL(); reloadData(); });
        }

        // 첫 로드
        reloadData();

        // --- 추가: 표 이미지 팝업 기능 설정 함수 호출 (초기 로드 시) ---
        // setupTablePopup(); // 테이블 로드 완료 후 호출되므로 여기서 호출할 필요 없음.
        // -----------------------------------------------------

    }).catch(err => {
        console.error('초기화 실패:', err);
        dataContainer.innerHTML = '초기 설정 로드에 실패했습니다.';
        // --- 추가: 팝업 기능도 설정하여 에러 메시지 캡처 가능하도록 함 ---
        setupTablePopup(); // 에러 메시지 캡처를 위해 에러 시에도 호출
        // ------------------------------------------------------
    });


    // 4) 단일 데이터 로드 ∙ 가공 ∙ 렌더
    function loadAndDisplaySingle() {
        if (isCompareMode) return; // 비교 모드에서는 실행되지 않음

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

                // --- 추가: 팝업 설정 함수 호출 (렌더링 완료 후) ---
                 setupTablePopup();
                // --------------------------------------------

            })
            .catch(err => {
                console.error('데이터 로드 실패:', err);
                dataContainer.innerHTML = `데이터를 불러오는 데 실패했습니다: ${err.message}`;
            });
    }

    // 5) 비교 데이터 로드 ∙ 가공 ∙ 렌더
    function loadAndDisplayComparison() {
        if (!isCompareMode) return; // 단일 모드에서는 실행되지 않음

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
        const url2 = `/data/${version2}/${tier2}.json`; // <-- 오타 수정 완료된 상태

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
                 dataContainer.innerHTML = '두 데이터 모두 불러오는 데 실패했습니다.';
                 lastData = [];
                 return;
            }

            const history1 = json1 ? json1['통계'] : {};
            const history2 = json2 ? json2['통계'] : {};

            // extractPeriodEntries는 이제 델타 계산 없이 해당 기간 데이터만 반환
            const entries1 = extractPeriodEntries(history1, period1);
            const entries2 = extractPeriodEntries(history2, period2);

            // 데이터가 하나라도 없으면 비교 불가
            if (entries1.length === 0 && entries2.length === 0) {
                 dataContainer.innerHTML = '선택한 기간에 해당하는 데이터가 없습니다.';
                 lastData = [];
                 return;
            }


            // 각 데이터셋 별도로 가공 (점수, 티어, 픽률 계산)
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

            // --- 추가: 팝업 설정 함수 호출 (렌더링 완료 후) ---
            setupTablePopup();
            // --------------------------------------------

        })
        .catch(err => {
            // Promise.all 내부에서 catch 했으므로 여기는 거의 오지 않음
            console.error('비교 데이터 처리 실패:', err);
            dataContainer.innerHTML = `데이터 처리 중 오류가 발생했습니다: ${err.message}`;
        });
    }

    // --- 추가: 표 이미지 팝업 기능 설정 함수 ---
    function setupTablePopup() {
        const popup = document.getElementById('image-popup');
        const popupImg = document.getElementById('popup-image');
        const popupTableButton = document.getElementById('popup-table-button');
        const targetTable = dataContainer.querySelector('table'); // dataContainer 내의 테이블 탐색

        // 요소가 모두 존재하는지 확인
        if (!popupTableButton || !popup || !popupImg || !targetTable) {
             // console.error("Popup elements or target table not found."); // 디버깅 로그 (반복 실행될 수 있어 주석 처리)
             // 테이블이 로드된 후에 setupTablePopup이 호출되도록 loadAndDisplaySingle/Comparison 끝에 호출합니다.
             // 따라서 이 시점에는 targetTable이 존재해야 합니다.
             // 초기 로드 실패 시 dataContainer에 테이블이 없을 수 있으므로, 그 경우는 감안합니다.
             return;
        }

        // 기존 클릭 이벤트 리스너가 있다면 제거 (중복 부착 방지)
         if (popupTableButton.onclick) {
              popupTableButton.onclick = null;
         }


        popupTableButton.onclick = () => {
             // 통계 페이지의 테이블 (#data-container 내의 table)을 캡처 대상으로 지정
             html2canvas(targetTable, {
                  backgroundColor: null // 배경 투명하게 캡처 (필요시)
             })
               .then(canvas => {
                 popup.style.display = 'block';
                 popupImg.src = canvas.toDataURL();
               });
        };

        // 팝업 닫기 버튼 이벤트 리스너
         const closeButton = popup.querySelector('.image-popup-close');
         if (closeButton) {
              // 기존 이벤트 리스너가 있다면 제거
              if (closeButton.onclick) {
                   closeButton.onclick = null;
              }
              closeButton.onclick = () => { popup.style.display = 'none'; };
         }

        // 팝업 외부 클릭 시 닫기 (선택 사항)
        // popup.onclick = (event) => {
        //     if (event.target === popup) {
        //         popup.style.display = 'none';
        //     }
        // };
    }
    // ------------------------------------------


// 7) 비교 테이블 렌더링
function renderComparisonTable(data) { // data 인자는 정렬된 데이터 배열입니다.
    if (!isCompareMode) return;

    // 기존 테이블 컬럼 목록
    // '표본수' 컬럼 제거
    const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위']; // 표본수 제거

    let comparisonTableHtml = '<table id="stats-table"><thead><tr>'; // 테이블 ID 추가
    cols.forEach(c => {
        // 실험체 컬럼은 비교 모드에서 정렬 제외 유지
        const sortable = c !== '실험체';

        comparisonTableHtml += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`; // 닫는 태그 </th> 추가
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
                const rank1 = row['순위 (Ver1)'] !== null && row['순위 (Ver1)'] !== undefined ? row['순위 (Ver1)'] : '-'; // number 또는 '-'
                const rank2 = row['순위 (Ver2)'] !== null && row['순위 (Ver2)'] !== undefined ? row['순위 (Ver2)'] : '-'; // number 또는 '-'
                const rankChangeValue = row['순위 변화값']; // number or string

                let rankInfoText = '';
                    if (typeof rank1 === 'number' && typeof rank2 === 'number') {
                        const rankChangeFormatted = Math.abs(rankChangeValue);
                        // 순위 숫자가 작아지면 개선 (▲), 커지면 악화 (▼)
                        rankInfoText = `${rank1}위 → ${rank2}위 ${rankChangeValue < 0 ? `▲${rankChangeFormatted}` : (rankChangeValue > 0 ? `▼${rankChangeFormatted}` : '')}`;
                    } else if (rankChangeValue === '신규 → ') {
                        rankInfoText = `(신규)`;
                    } else if (rankChangeValue === '→ 삭제') {
                        rankInfoText = `(삭제)`;
                    } else if (rank1 !== '-') { // Ver1에만 데이터 있고 Ver2에 없는 경우
                        rankInfoText = `${rank1}위 → -`;
                    } else if (rank2 !== '-') { // Ver2에만 데이터 있고 Ver1에 없는 경우
                        rankInfoText = `- → ${rank2}위`;
                    } else {
                        rankInfoText = '-';
                    }


                // Construct the final cell HTML with spans wrapped in a div
                let innerContentHtml = '';
                if (tierChange !== '-') {
                        innerContentHtml += `<span class="tier-value-or-change">${tierChange}</span>`;
                } else {
                        // 티어 변화 정보가 없으면 빈 스팬 또는 '-' 표시 스팬 추가 (레이아웃 유지를 위해)
                        innerContentHtml += `<span class="tier-value-or-change">-</span>`;
                }

                if (rankInfoText !== '-') { // Only add rank info span if there's rank info
                        innerContentHtml += `<span class="rank-info">${rankInfoText}</span>`;
                }

                // Wrap the content in a div, but only if there's actual content
                if (tierChange === '-' && rankInfoText === '-') {
                        displayVal = '-'; // No content at all
                } else {
                        displayVal = `<div class="cell-content-wrapper">${innerContentHtml}</div>`;
                }


                // 티어 변화 색상 강조를 위한 data 속성 (CSS에서 사용하지 않더라도 JS에서 필요할 수 있음)
                // 이 속성들은 이전 상태 그대로 유지합니다.
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

            } else { // Other numeric stat columns
                    const val1 = row[`${col} (Ver1)`];
                    const val2 = row[`${col} (Ver2)`];
                    const delta = row[`${col} 변화량`]; // Numeric delta value

                    // Display Ver1 value → Ver2 value Delta format
                    let valueText1;
                    if (typeof val1 === 'number') {
                        if (col === '승률' || col === 'TOP 3') {
                            valueText1 = (val1 * 100).toFixed(2) + '%'; // 100 곱하고 % 추가
                        } else if (col === '픽률') {
                            valueText1 = val1.toFixed(2) + '%'; // 픽률은 이미 %
                        } else if (col === '평균 순위') {
                            valueText1 = val1.toFixed(2) + '위'; // 평균 순위는 '위' 추가
                        } else { // 점수, RP 획득, 표본수
                            valueText1 = val1.toFixed(2); // 소수점 둘째 자리까지
                        }
                    } else {
                        valueText1 = '-';
                    }

                    let valueText2;
                    if (typeof val2 === 'number') {
                        if (col === '승률' || col === 'TOP 3') {
                            valueText2 = (val2 * 100).toFixed(2) + '%'; // 100 곱하고 % 추가
                        } else if (col === '픽률') {
                            valueText2 = val2.toFixed(2) + '%'; // 픽률은 이미 %
                        } else if (col === '평균 순위') {
                            valueText2 = val2.toFixed(2) + '위'; // 평균 순위는 '위' 추가
                        } else { // 점수, RP 획득, 표본수
                            valueText2 = val2.toFixed(2); // 소수점 둘째 자리까지
                        }
                    } else {
                        valueText2 = '-';
                    }


                    let verValuesHtml;
                    let deltaHtml = '';

                    if (typeof val1 === 'number' && typeof val2 === 'number') {
                        verValuesHtml = `${valueText1} → ${valueText2}`;
                        if (typeof delta === 'number') {
                            // --- 수정: 승률과 TOP 3 변화량은 100을 곱하고 %는 붙이지 않음 ---
                            let deltaValueForFormatting = delta;
                            if (col === '승률' || col === 'TOP 3') {
                                deltaValueForFormatting = delta * 100; // 100 곱함
                            }
                            const deltaFormatted = Math.abs(deltaValueForFormatting).toFixed(2); // 소수점 둘째 자리까지 표시
                            deltaHtml = `${delta > 0 ? `▲${deltaFormatted}` : (delta < 0 ? `▼${deltaFormatted}` : '')}`; // % 기호는 붙이지 않음
                            // ----------------------------------------------------------
                        }
                    } else if (typeof val1 === 'number' && (val2 === null || val2 === undefined)) { // Only Ver1 data exists (removed)
                        verValuesHtml = `${valueText1} → 삭제`;
                    } else if ((val1 === null || val1 === undefined) && typeof val2 === 'number') { // Only Ver2 data exists (new)
                        verValuesHtml = `신규 → ${valueText2}`;
                    } else { // Neither has data
                        verValuesHtml = '-';
                    }


                // Construct the final cell HTML with spans wrapped in a div
                let innerContentHtml = `<span class="ver-values">${verValuesHtml}</span>`;
                if (deltaHtml) { // Only add delta span if there's a numeric delta
                        innerContentHtml += `<span class="delta-value">${deltaHtml}</span>`;
                }
                // Wrap the content in a div
                displayVal = `<div class="cell-content-wrapper">${innerContentHtml}</div>`;


                    // Store delta value for color grading (numeric delta or status string)
                    if (typeof delta === 'number') {
                        dataAttributes += ` data-delta="${delta}"`;
                    } else if ((val1 === null || val1 === undefined) && (val2 !== null && val2 !== undefined)) { // New
                        dataAttributes += ` data-delta="new"`;
                    } else if ((val1 !== null && val1 !== undefined) && (val2 === null || val2 === undefined)) { // Removed
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

    // Attach sort event listeners to headers (excluding '실험체')
    attachComparisonSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderComparisonTable);
    // Apply gradient colors if checkbox is checked
    if (gradientCheckbox.checked) applyGradientColorsComparison(dataContainer.querySelector('table'), data, currentSortMode, currentSortColumn);
    // --- 추가: 팝업 설정 함수 호출 (렌더링 완료 후) ---
    setupTablePopup();
    // --------------------------------------------
}

function renderTable(data) {
    if (isCompareMode) return; // 비교 모드에서는 실행되지 않음

   const cols = ['실험체','점수','티어','픽률','RP 획득','승률','TOP 3','평균 순위'];

   let html = '<table><thead><tr>';
   cols.forEach(c => {
        // 단일 모드에서는 실험체 정렬 제외, 티어 정렬 포함
       const sortable = c !== '실험체';
       html += `<th data-col="${c}" ${sortable ? '' : 'data-nosort="true"'}>${c}</th>`; // 닫는 태그 </th> 추가
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

   // Attach sort event listeners to headers (excluding '실험체')
   attachSingleSortEventListeners(dataContainer.querySelectorAll('th:not([data-nosort])'), renderTable);
   // Apply gradient colors if checkbox is checked
   if (gradientCheckbox.checked) applyGradientColorsSingle(dataContainer.querySelector('table'));
    // --- 추가: 팝업 설정 함수 호출 (렌더링 완료 후) ---
   setupTablePopup();
   // --------------------------------------------
}

}); // DOMContentLoaded 끝