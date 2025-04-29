// script_graph.js
document.addEventListener('DOMContentLoaded', function () {
    // common.js에 정의된 함수/변수들은 전역 스코프에 있으므로 바로 사용 가능합니다.

    // DOM 요소
    const canvas               = document.getElementById('graph-canvas');
    const versionSelect        = document.getElementById('version-select');
    const tierSelect           = document.getElementById('tier-select');
    const periodSelect         = document.getElementById('period-select');
    const lowPickrateCheckbox  = document.getElementById('filter-low-pickrate');
    const highPickrateCheckbox = document.getElementById('filter-high-pickrate');
    const popupButton          = document.getElementById('popup-graph-button');
    const popup                = document.getElementById('image-popup');
    const popupImage           = document.getElementById('popup-image');
    const popupClose           = document.querySelector('.image-popup-close');

    // URL 파라미터 헬퍼
    const params = new URLSearchParams(window.location.search);
    function getParam(key, def) {
      return params.has(key) ? params.get(key) : def;
    }
    function setParam(key, val) {
      params.set(key, val);
      history.replaceState(null, '', '?' + params.toString());
    }

    // 상태
    let chartData    = []; // calculateFinalStatsForPeriod 결과 저장
    let filteredData = []; // 필터링된 데이터
    let myChart      = null;
    let tierConfig   = null; // config.ini에서 로드된 티어 설정
    // 탭 파라미터로 초기화
    let currentTab   = getParam('tab', 'pick-rp');

    // --- 오류 수정: Chart.js 라이브러리 로드 확인 및 플러그인 등록 ---
    // Chart 객체가 window에 정의되어 있고 null이 아닌지 확인합니다.
    if (typeof window.Chart === 'undefined' || window.Chart === null) {
        console.error("Chart.js library (global 'Chart' variable) not found or not initialized. Cannot register plugins.");
        // canvas를 비우고 오류 메시지 표시
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'red';
        ctx.fillText('Chart.js 라이브러리 로드 실패.', canvas.width / 2, canvas.height / 2);

        // 그래프 관련 UI 요소 비활성화
        if (popupButton) popupButton.disabled = true;
        versionSelect.disabled = true;
        tierSelect.disabled = true;
        periodSelect.disabled = true;
        lowPickrateCheckbox.disabled = true;
        highPickrateCheckbox.disabled = true;
        document.querySelectorAll('.graph-tab').forEach(btn => btn.disabled = true);

        // 이후 초기화 및 데이터 로드 로직을 중단합니다.
        return;
    }

    // Chart.js 플러그인 등록 (페이지 로드 시 Chart가 유효한 것이 확인된 후 한 번만)
    // 'window.Chart' 대신 'Chart'로 접근해도 무방하지만, 명확성을 위해 'window.Chart'를 사용했습니다.
    // 원본 코드에서는 'Chart'를 사용했으므로 'Chart'로 되돌립니다.
    Chart.register(labelPlugin, cornerTextPlugin, window['chartjs-plugin-annotation']); // Line 37

    // -------------------------------------------------------------


    // 초기화
    Promise.all([
        // config.ini 로드 추가 (calculateFinalStatsForPeriod 호출에 필요)
        fetch('/config.ini').then(r => r.text()).then(iniText => parseINI(iniText).tiers), // common.js의 parseINI 사용
        fetch('/versions.json').then(r => r.json())
    ])
      .then(([loadedTierConfig, versions]) => { // Promise.all 결과 받기
        // 데이터 로드 성공 후 tierConfig 및 versionList 설정
        tierConfig = loadedTierConfig; // 전역 tierConfig에 할당

        // 드롭다운 채우기 (common.js 함수 사용)
        populateVersionDropdown(versionSelect, versions); // common.js 함수
        populateTierDropdown(tierSelect);         // common.js 함수
        populatePeriodDropdown(periodSelect);       // common.js 함수

        // URL → 초기 상태
        versionSelect.value = getParam('version', versions.length > 0 ? versions.sort().reverse()[0] : ''); // versionList 비어있을 경우 대비
        tierSelect.value    = getParam('tier', 'diamond_plus');
        periodSelect.value  = getParam('period', 'latest');
        lowPickrateCheckbox.checked  = getParam('lowPickrate', 'false') === 'true';
        highPickrateCheckbox.checked = getParam('highPickrate', 'false') === 'true';

        // 드롭다운 변경 시 데이터 재로드
        versionSelect.addEventListener('change', () => {
          setParam('version', versionSelect.value);
          loadData();
        });
        tierSelect.addEventListener('change', () => {
          setParam('tier', tierSelect.value);
          loadData();
        });
        periodSelect.addEventListener('change', () => {
          setParam('period', periodSelect.value);
          loadData();
        });

        // 체크박스 변경 시 필터 재적용 및 그래프 재생성
        lowPickrateCheckbox.addEventListener('change', () => {
          setParam('lowPickrate', lowPickrateCheckbox.checked);
          applyFilters();
          createGraph(currentTab);
        });
        highPickrateCheckbox.addEventListener('change', () => {
          setParam('highPickrate', highPickrateCheckbox.checked);
          applyFilters();
          createGraph(currentTab);
        });

        // 탭 및 팝업 셋업
        setupGraphTabs();
        popupButton.addEventListener('click', () => {
          // html2canvas는 head.html에서 로드됨
          html2canvas(canvas).then(c => {
            popup.style.display = 'block';
            popupImage.src = c.toDataURL();
          });
        });
        popupClose.addEventListener('click', () => {
          popup.style.display = 'none';
        });

        // 최초 로드
        loadData();
      })
      .catch(err => {
          console.error('초기 설정 로드 실패:', err);
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = '20px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'red';
          ctx.fillText('초기 설정 로드 실패.', canvas.width / 2, canvas.height / 2);
          // UI 비활성화
          if (popupButton) popupButton.disabled = true;
          versionSelect.disabled = true;
          tierSelect.disabled = true;
          periodSelect.disabled = true;
          lowPickrateCheckbox.disabled = true;
          highPickrateCheckbox.disabled = true;
          document.querySelectorAll('.graph-tab').forEach(btn => btn.disabled = true);
      });

    // 탭 클릭 처리 & URL 반영
    function setupGraphTabs() {
      document.querySelectorAll('.graph-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTab = btn.dataset.type;
          setParam('tab', currentTab);
          // 탭 변경 시 필터 상태를 유지한 채 그래프만 다시 그림
          applyFilters(); // 현재 필터 상태로 filteredData 갱신
          createGraph(currentTab); // 갱신된 filteredData로 그래프 그림
        });
      });
    }

    // 데이터 로드 → 가공 → 필터 → 차트
    function loadData() {
      // tierConfig가 아직 로드되지 않았으면 대기
      if (!tierConfig) {
          console.warn("tierConfig not loaded yet, waiting...");
          // tierConfig 로드 완료 후 loadData 재실행하도록 로직 수정 필요 (현재는 초기 로드 시에만 Promise.all 내부에서 호출)
          // 또는 Promise.all 체인 안으로 loadData 호출을 옮겨야 함. 현재 구조는 이미 Promise.all 안에 loadData 호출이 있습니다.
          // 따라서 이 경고는 발생하지 않아야 하지만, 혹시 다른 경로로 loadData가 호출될 경우를 대비합니다.
          // 실제로는 Promise.all .then 블록 안에서만 호출되므로 tierConfig는 보장됩니다.
      }

      const version = versionSelect.value;
      const tier    = tierSelect.value;
      const period  = periodSelect.value;

      // >>> 수정 시작: '/data/' 폴더를 '/stats/' 폴더로 변경
      fetch(`/stats/${version}/${tier}.json`)
      // >>> 수정 끝
        .then(r => {
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            return r.json();
        })
        .then(json => {
          const history = json['통계'];
          // common.js에서 calculateFinalStatsForPeriod 함수를 사용하여 최종 데이터셋 계산
          // 이 함수가 period에 따라 누적 스냅샷 또는 기간 역산 데이터를 가져와 calculateTiers까지 수행합니다.
          // tierConfig는 초기화 시 로드된 것을 사용합니다.
          chartData = calculateFinalStatsForPeriod(history, period, tierConfig); // common.js 함수

          // 데이터가 없는 경우 (calculateFinalStatsForPeriod 결과 빈 배열) 처리
          if (!chartData || chartData.length === 0) {
               console.warn("No data found for selected period.");
               if (myChart) myChart.destroy(); // 기존 그래프 파괴
               const ctx = canvas.getContext('2d');
               ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 초기화
               ctx.font = '20px sans-serif';
               ctx.textAlign = 'center';
               ctx.fillStyle = '#888';
               ctx.fillText('선택한 조건에 해당하는 데이터가 없습니다.', canvas.width / 2, canvas.height / 2);
               filteredData = []; // 필터된 데이터도 비워줌
               return; // 이후 로직 중단
          }


          applyFilters(); // 로드된 데이터에 필터 적용

          // URL 파라미터에 있는 탭 클릭하여 그래프 그림
          // initialBtn이 없을 경우를 대비하여 기본 탭 클릭 로직 추가
          const initialBtn = document.querySelector(`.graph-tab[data-type="${currentTab}"]`);
          if (initialBtn) {
            initialBtn.click(); // 클릭 이벤트 트리거 (applyFilters -> createGraph 호출)
          } else {
            // 기본 탭 ('pick-rp') 클릭
            currentTab = 'pick-rp'; // currentTab 상태 업데이트
            const defaultTabBtn = document.querySelector(`.graph-tab[data-type="${currentTab}"]`);
            if(defaultTabBtn) defaultTabBtn.click();
          }
        })
        .catch(err => {
            console.error('데이터 로드 또는 가공 실패:', err);
            if (myChart) myChart.destroy(); // 기존 그래프 파괴
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 초기화
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'red';
            ctx.fillText(`데이터 로드/처리 실패: ${err.message}`, canvas.width / 2, canvas.height / 2);
            filteredData = []; // 필터된 데이터도 비워줌
        });
    }

    // 체크박스 필터 적용
    function applyFilters() {
        if (!chartData || chartData.length === 0) {
             filteredData = [];
             return;
        }
      // 픽률 필터 기준은 chartData (calculateFinalStatsForPeriod 결과)의 픽률 평균입니다.
      // calculateFinalStatsForPeriod 결과에는 '픽률' 필드가 이미 0-100% 값으로 포함되어 있습니다.
      const pickRateValuesInChartData = chartData.map(d => d['픽률']).filter(pr => typeof pr === 'number' && pr >= 0); // 0 이상인 픽률 값만
      const avgPickRateChartData = pickRateValuesInChartData.length === 0 ? 0 : pickRateValuesInChartData.reduce((s, pr) => s + pr, 0) / pickRateValuesInChartData.length; // 0-100% 평균 픽률

      filteredData = chartData.filter(d => {
        const pr = d['픽률'] || 0; // 캐릭터의 픽률 (0-100%)
        // 픽률 기준은 전체 데이터셋 (chartData)의 평균 픽률을 사용합니다.
        if (lowPickrateCheckbox.checked  && avgPickRateChartData > 0 && pr < avgPickRateChartData / 4) return false; // 평균 픽률이 0보다 클 때만 필터 적용
        if (highPickrateCheckbox.checked && avgPickRateChartData > 0 && pr > avgPickRateChartData * 5) return false; // 평균 픽률이 0보다 클 때만 필터 적용
        return true;
      });
    }

    // 그래프 생성
    function createGraph(type) {
      if (!filteredData || filteredData.length === 0) {
           console.warn("No data to display graph.");
           if (myChart) myChart.destroy(); // 기존 그래프 파괴
           const ctx = canvas.getContext('2d');
           ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 초기화
           ctx.font = '20px sans-serif';
           ctx.textAlign = 'center';
           ctx.fillStyle = '#888';
           ctx.fillText('그래프를 표시할 데이터가 없습니다.', canvas.width / 2, canvas.height / 2);
           return; // 그래프 생성 중단
      }

      const maps = {
        'pick-rp': { xKey:'픽률',    yKey:'RP 획득', radiusKey:'승률',    title:'픽률 / RP 획득' },
        'pick-win':{ xKey:'픽률',    yKey:'승률',    radiusKey:'RP 획득',title:'픽률 / 승률' },
        'rp-win':  { xKey:'RP 획득', yKey:'승률',    radiusKey:'픽률',   title:'RP 획득 / 승률' }
      };
      const { xKey,yKey,radiusKey,title } = maps[type];

      // 평균값 계산 (ChartData 기준, annotation 라인에 사용)
      // calculateFinalStatsForPeriod 결과에는 'RP 획득', '승률', 'TOP 3', '픽률' 필드가 있습니다.
      // 이 값들은 이미 calculateFinalStatsForPeriod 계산 시 해당 기간/스냅샷의 평균값입니다.
      // calculateAverageScore 결과 (이 데이터셋의 평균 점수) 와는 다릅니다.
      // 이전 코드의 가중 평균 RP/승률 계산 로직을 유지하되, chartData (calculateFinalStatsForPeriod 결과)를 사용합니다.
      const totalSamplesInChartData = chartData.reduce((s, d) => s + (d['표본수'] || 0), 0);
       // 평균 픽률 (0-100%)
      const pickRateValuesInChartData = chartData.map(d => d['픽률']).filter(pr => typeof pr === 'number' && pr >= 0); // 0 이상인 픽률 값만
      const avgPickRateChartData = pickRateValuesInChartData.length === 0 ? 0 : pickRateValuesInChartData.reduce((s, pr) => s + pr, 0) / pickRateValuesInChartData.length;

       // 가중 평균 RP 획득, 승률 계산 (chartData 기준, 표본수 가중치 사용)
       let wRP_sum = 0, wWin_sum = 0, totalWeight_chartData = 0;
       chartData.forEach(d => {
           const weight = d['표본수'] || 0; // calculateFinalStatsForPeriod 결과에 포함된 표본수를 가중치로 사용
           if (weight > 0) {
               wRP_sum += (d['RP 획득'] || 0) * weight; // calculateFinalStatsForPeriod 결과의 RP 획득 값 사용
               wWin_sum += (d['승률'] || 0) * weight;   // calculateFinalStatsForPeriod 결과의 승률 값 사용
               totalWeight_chartData += weight;
           }
       });
       const wRP_chartData = totalWeight_chartData === 0 ? 0 : wRP_sum / totalWeight_chartData;
       const wWin_chartData = totalWeight_chartData === 0 ? 0 : wWin_sum / totalWeight_chartData; // 0-1 스케일

      const labels  = filteredData.map(d => d['실험체']);
      // 픽률 및 승률 값은 100으로 나누어 0-1 스케일로 플로팅
      const xValues = filteredData.map(d => {
           const val = d[xKey] || 0; // calculateFinalStatsForPeriod 결과에서 해당 키 값 가져옴
           if (xKey === '픽률' || xKey === '승률' || xKey === 'TOP 3') return val / 100; // 0-100% 값을 0-1 스케일로
           return val; // 그 외 값 (RP 획득 등)은 그대로
      });
      const yValues = filteredData.map(d => {
           const val = d[yKey] || 0; // calculateFinalStatsForPeriod 결과에서 해당 키 값 가져옴
           if (yKey === '픽률' || yKey === '승률' || yKey === 'TOP 3') return val / 100; // 0-100% 값을 0-1 스케일로
           return val; // 그 외 값은 그대로
      });
       // 반지름 기준 값도 100으로 나누어 0-1 스케일로 변환하여 사용 (픽률, 승률, TOP 3만 해당)
      const rValues = filteredData.map(d => {
           const val = d[radiusKey] || 0; // calculateFinalStatsForPeriod 결과에서 해당 키 값 가져옴
           if (radiusKey === '픽률' || radiusKey === '승률' || radiusKey === 'TOP 3') return val / 100; // 0-100% 값을 0-1 스케일로
           return val; // 그 외 값은 그대로
      });


      if (myChart) myChart.destroy(); // 기존 차트 인스턴스 파괴

      // ctx는 DOMContentLoaded 시작 시 canvas가 존재하는 것이 보장되므로 문제 없습니다.

      myChart = new Chart(ctx, {
        type: 'scatter',
        data: {
          labels,
          datasets: [{
            data: filteredData.map((d,i)=>({x:xValues[i],y:yValues[i],label:d['실험체']})),
            backgroundColor: ctx => {
              // 각 데이터 포인트에 고유한 색상 적용 (HSV 색 공간 사용)
              const hue = (ctx.dataIndex * 360 / filteredData.length) % 360;
              return `hsl(${hue}, 60%, 70%, 0.8)`; // 0.8 투명도
            },
            pointRadius:  ctx => {
              const v = rValues[ctx.dataIndex]; // 이미 0-1 스케일 값
              // rValues가 모두 동일한 값일 경우 (예: 데이터가 1개) 반지름 15 고정
              // 아니면 6 ~ 30 사이 스케일링
              const mn = Math.min(...rValues), mx = Math.max(...rValues);
              // min/max가 같으면 나누기 0 되므로 예외 처리
              return mn === mx ? 15 : 6 + ((v - mn) / (mx - mn)) * 24;
            },
            pointHoverRadius: ctx => {
              const v = rValues[ctx.dataIndex]; // 이미 0-1 스케일 값
              // rValues가 모두 동일한 값일 경우 (예: 데이터가 1개) 반지름 15 고정
              // 아니면 6 ~ 30 사이 스케일링 (마우스 오버 시 반지름 동일하게 유지)
               const mn = Math.min(...rValues), mx = Math.max(...rValues);
              return mn === mx ? 15 : 6 + ((v - mn) / (mx - mn)) * 24;
            }
          }]
        },
        options: {
          responsive:false, // canvas 엘리먼트 자체 크기 조절은 하지 않음
          maintainAspectRatio:false, // 비율 유지 안 함 (width/height 속성 사용)
          plugins:{
            legend:{display:false}, // 범례 숨김
            tooltip:{
              callbacks:{
                title:()=>'', // 툴팁 제목 없음
                label:ctx=>{
                  const d = filteredData[ctx.dataIndex]; // 해당 데이터 포인트 원본 객체 (calculateFinalStatsForPeriod 결과)
                  return [
                    d['실험체'], // 실험체 이름
                    // 툴팁에서 % 값 표시 수정 (calculateFinalStatsForPeriod 결과 값은 이미 0-100% 또는 RP/평균순위 등 형태)
                    `픽률: ${d['픽률'] !== undefined && d['픽률'] !== null ? d['픽률'].toFixed(2) + '%' : '-'}`,
                    `RP 획득: ${d['RP 획득'] !== undefined && d['RP 획득'] !== null ? d['RP 획득'].toFixed(2) : '-'}`, // RP는 % 아님
                    `승률: ${d['승률'] !== undefined && d['승률'] !== null ? (d['승률'] * 100).toFixed(2) + '%' : '-'}` // 승률은 0-1 비율로 저장되었을 수 있으므로 100 곱함 (calculateTiers에서 0-1 비율 저장)
                  ];
                }
              }
            },
            annotation:{
              annotations:[
                {
                  type:'line', scaleID:'x',
                  // 평균 픽률 및 승률도 100으로 나누어 0-1 스케일로 annotation 라인 표시
                  value: xKey==='픽률' ? avgPickRateChartData / 100 : (xKey==='승률' || xKey === 'TOP 3' ? wWin_chartData : wRP_chartData), // 승률/TOP3는 wWin_chartData (0-1)
                   // RP 획득은 wRP_chartData (값 그대로)
                  borderColor:'#ffac2b', borderWidth:2, borderDash:[5,5]
                },
                {
                  type:'line', scaleID:'y',
                   // 평균 픽률 및 승률도 100으로 나누어 0-1 스케일로 annotation 라인 표시
                  value: yKey==='픽률' ? avgPickRateChartData / 100 : (yKey==='승률' || yKey === 'TOP 3' ? wWin_chartData : wRP_chartData), // 승률/TOP3는 wWin_chartData (0-1)
                   // RP 획득은 wRP_chartData (값 그대로)
                  borderColor:'#ffac2b', borderWidth:2, borderDash:[5,5]
                }
              ]
            }
          },
          scales:{
            x:{
              title:{display:true,text:xKey}, // x축 제목
              // 픽률, 승률, TOP 3 축의 min 설정 (0-1 스케일)
              min: (xKey === '픽률' || xKey === '승률' || xKey === 'TOP 3') ? 0 : undefined,
              // 최대값은 데이터의 최대값 + 약간 여유 (Chart.js가 적절히 자동 스케일링하도록 max는 undefined로 두는 것이 일반적입니다.)
              ticks:{
                callback: v => {
                  // v는 Chart.js의 스케일 값 (0-1 또는 RP 값 등)
                  if (xKey === '픽률' || xKey === '승률' || xKey === 'TOP 3') {
                      // 0-1 스케일 값을 100 곱하여 %로 표시, 소수점 첫째 자리까지
                      return `${(v * 100).toFixed(1)}%`;
                  }
                   if (xKey === 'RP 획득') {
                       // RP 획득은 값 그대로 표시 (calculateFinalStatsForPeriod에서 이미 평균)
                       return v.toFixed(1); // 소수점 첫째 자리까지 표시 유지
                   }
                  // 그 외는 기본값 (평균 순위 등)
                  return v.toFixed(1); // 다른 숫자 값도 소수점 첫째 자리까지 표시
                },
                // stepSize 설정 (Chart.js가 자동 계산하도록 undefined가 보통 좋음)
                // stepSize: xKey === 'RP 획득' ? 1 : (xKey === '픽률' ? 0.002 : undefined) // 이전 로직 유지
              }
            },
            y:{
              title:{display:true,text:yKey}, // y축 제목
               // 픽률, 승률, TOP 3 축의 min 설정 (0-1 스케일)
              min: (yKey === '픽률' || yKey === '승률' || yKey === 'TOP 3') ? 0 : undefined,
              // max: (yKey === '픽률' || yKey === '승률') ? Math.ceil(Math.max(...yValues)*100*1.1)/1000 : undefined, // 이전 로직의 최대값 계산 참고
              ticks:{
                callback: v => {
                   // v는 Chart.js의 스케일 값 (0-1 또는 RP 값 등)
                   if (yKey === '픽률' || yKey === '승률' || yKey === 'TOP 3') {
                       // 0-1 스케일 값을 100 곱하여 %로 표시, 소수점 첫째 자리까지
                       return `${(v * 100).toFixed(1)}%`;
                   }
                    if (yKey === 'RP 획득') {
                        // RP 획득은 값 그대로 표시
                        return v.toFixed(1); // 소수점 첫째 자리까지 표시 유지
                    }
                   // 그 외는 기본값 (평균 순위 등)
                   return v.toFixed(1); // 다른 숫자 값도 소수점 첫째 자리까지 표시
                 },
                 // stepSize 설정
                 // stepSize: yKey === 'RP 획률' ? 1 : (yKey === '픽률' ? 0.002 : undefined) // 이전 로직 유지
              }
            }
          }
        }
      });

      // 메타데이터 (common.js의 tierMap 사용)
      myChart.config._제목        = title;
      myChart.config._평균픽률    = avgPickRateChartData; // 0-100%
      myChart.config._가중평균RP  = wRP_chartData;
      myChart.config._가중평균승률 = wWin_chartData * 100; // 0-1 비율이므로 100 곱해서 저장
      myChart.config._version     = versionSelect.value;
      myChart.config._tier        = tierSelect.value; // 코드 (예: diamond_plus)
    }


    // 레이블 플러그인 (기존 플러그인 정의 유지)
    const labelPlugin = {
      id:'labelPlugin',
      afterDatasetsDraw(chart){
        const ctx=chart.ctx;
        chart.getDatasetMeta(0).data.forEach((pt,i)=>{
          const x=pt.x,y=pt.y,l=chart.data.labels[i];
          ctx.save();
          ctx.font='10px sans-serif';
          ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.lineWidth=2;ctx.strokeStyle='white';
          ctx.strokeText(l,x,y);
          ctx.fillStyle='black';ctx.fillText(l,x,y);
          ctx.restore();
        });
      }
    };

    // 코너 텍스트 플러그인 (common.js의 tierMap 사용)
    const cornerTextPlugin = {
        id: 'cornerTextPlugin',
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          const centerX = (chartArea.left + chartArea.right) / 2;

          // 중앙 상단 2줄
          ctx.save();
          ctx.textAlign    = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle    = 'black';

          ctx.font = 'bold 16px sans-serif';
          ctx.fillText(chart.config._제목 || '', centerX, chartArea.top + 8);

          ctx.font = '14px sans-serif';
          // common.js의 tierMap 사용
          const humanTier    = tierMap[chart.config._tier] || chart.config._tier; // tierMap은 common.js에서 가져옴
          const versionTier  = `${chart.config._version} | ${humanTier}`;
          ctx.fillText(versionTier, centerX, chartArea.top + 28);

          // 우측 상단 평균데이터 (값이 있을 때만)
          const avgPick = chart.config._평균픽률; // 0-100%
          const avgRP   = chart.config._가중평균RP;
          const avgWin  = chart.config._가중평균승률; // 0-100%

          ctx.textAlign = 'right';
          ctx.font      = '14px sans-serif';

          if (typeof avgPick === 'number') {
            ctx.fillText(
              `평균 픽률: ${avgPick.toFixed(2)}%`, // 이미 0-100% 값
              chartArea.right - 10,
              chartArea.top + 8
            );
          }
          if (typeof avgRP === 'number') {
            ctx.fillText(
              `평균 RP: ${avgRP.toFixed(1)}`,
              chartArea.right - 10,
              chartArea.top + 28
            );
          }
          if (typeof avgWin === 'number') {
            ctx.fillText(
              `평균 승률: ${avgWin.toFixed(2)}%`, // 이미 0-100% 값
              chartArea.right - 10,
              chartArea.top + 48
            );
          }

          ctx.restore();
        }
    };
});