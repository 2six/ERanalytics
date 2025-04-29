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
    let chartData    = []; // getProcessedStatsForPeriod 결과 저장 (RP/AvgRank/SampleSize 값 그대로, Win/TOP3/Pick 0-1)
    let filteredData = []; // 필터링된 데이터
    let myChart      = null;
    let tierConfig   = null; // config.ini에서 로드된 티어 설정
    // 탭 파라미터로 초기화
    let currentTab   = getParam('tab', 'pick-rp');


    // --- Chart.js 플러그인 정의를 등록 전에 위치 (ReferenceError 해결) ---
    // 레이블 플러그인 정의
    const labelPlugin = {
      id:'labelPlugin',
      afterDatasetsDraw(chart){
        // Chart 객체가 유효할 때만 호출된다고 가정하지만, 혹시 모를 상황 대비 ctx 접근 안전화
        const ctx = chart && chart.ctx;
        if (!ctx) return; // ctx가 없으면 그리지 않음

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

    // 코너 텍스트 플러그인 정의
    const cornerTextPlugin = {
        id: 'cornerTextPlugin',
        afterDraw(chart) {
          // Chart 객체가 유효할 때만 호출된다고 가정하지만, 혹시 모를 상황 대비 ctx 접근 안전화
          const ctx = chart && chart.ctx;
          if (!ctx) return; // ctx가 없으면 그리지 않음

          const { chartArea } = chart;
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
          // chart.config에 저장된 평균값들은 getProcessedStatsForPeriod 결과의 스케일을 따릅니다.
          // RP/AvgRank 값 그대로, Win/TOP3/Pick 0-1 스케일
          const avgPick = chart.config._평균픽률;
          const avgRP   = chart.config._가중평균RP;
          const avgWin  = chart.config._가중평균승률;

          ctx.textAlign = 'right';
          ctx.font      = '14px sans-serif';

          // typeof check에 isNaN 체크 추가하여 유효한 숫자만 표시
          if (typeof avgPick === 'number' && !isNaN(avgPick)) {
            ctx.fillText(
              `평균 픽률: ${(avgPick * 100).toFixed(2)}%`, // 0-1 스케일 평균에 100 곱해서 표시
              chartArea.right - 10,
              chartArea.top + 8
            );
          }
          if (typeof avgRP === 'number' && !isNaN(avgRP)) {
            ctx.fillText(
              `평균 RP: ${avgRP.toFixed(1)}`, // 값 그대로 표시
              chartArea.right - 10,
              chartArea.top + 28
            );
          }
          if (typeof avgWin === 'number' && !isNaN(avgWin)) {
            ctx.fillText(
              `평균 승률: ${(avgWin * 100).toFixed(2)}%`, // 0-1 스케일 평균에 100 곱해서 표시
              chartArea.right - 10,
              chartArea.top + 48
            );
          }

          ctx.restore();
        }
    };
    // -------------------------------------------------------------


    // --- Chart.js 라이브러리 로드 확인 및 플러그인 등록 (정의 아래로 이동) ---
    // Chart 객체가 window에 정의되어 있고 null이 아닌지 확인합니다.
    if (typeof window.Chart === 'undefined' || window.Chart === null) {
        console.error("Chart.js 라이브러리 (전역 'Chart' 변수)를 찾을 수 없거나 초기화되지 않았습니다. 플러그인을 등록할 수 없습니다.");
        // canvas를 비우고 오류 메시지 표시
        const ctx = canvas.getContext('2d');
        if (ctx) { // ctx가 유효한 경우만 그립니다.
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             ctx.font = '20px sans-serif';
             ctx.textAlign = 'center';
             ctx.fillStyle = 'red';
             ctx.fillText('Chart.js 라이브러리 로드 실패.', canvas.width / 2, canvas.height / 2);
        }


        // 그래프 관련 UI 요소 비활성화 (존재하는지 확인 후)
        if (popupButton) popupButton.disabled = true;
        if (versionSelect) versionSelect.disabled = true;
        if (tierSelect) tierSelect.disabled = true;
        if (periodSelect) periodSelect.disabled = true;
        if (lowPickrateCheckbox) lowPickrateCheckbox.disabled = true;
        if (highPickrateCheckbox) highPickrateCheckbox.disabled = true;
        document.querySelectorAll('.graph-tab').forEach(btn => btn.disabled = true);

        // 이후 초기화 및 데이터 로드 로직을 중단합니다.
        return;
    }

    // Chart.js 플러그인 등록 (Chart가 유효한 것이 확인된 후 플러그인 정의 아래에서 한 번만)
    Chart.register(labelPlugin, cornerTextPlugin, window['chartjs-plugin-annotation']);

    // -------------------------------------------------------------


    // 초기화
    Promise.all([
        // config.ini 로드 추가 (getProcessedStatsForPeriod 호출에 필요)
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
        tierSelect.value = getParam('tier', 'diamond_plus');
        periodSelect.value = getParam('period', 'latest');
        lowPickrateCheckbox.checked = getParam('lowPickrate', 'false') === 'true';
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
        if (popupButton) { // 버튼 존재 확인 후 이벤트 리스너 추가
          popupButton.addEventListener('click', () => {
            // html2canvas는 head.html에서 로드됨
            html2canvas(canvas).then(c => {
              if (popup && popupImage) {
                  popup.style.display = 'block';
                  popupImage.src = c.toDataURL();
                }
            });
          });
        }
        if (popupClose) { // 닫기 버튼 존재 확인 후 이벤트 리스너 추가
          popupClose.addEventListener('click', () => {
             if (popup) popup.style.display = 'none';
          });
        }


        // 최초 로드
        loadData();
      })
      .catch(err => {
          console.error('초기 설정 로드 실패:', err);
          const ctx = canvas.getContext('2d');
          if (ctx) { // ctx가 유효한 경우만 그립니다.
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.font = '20px sans-serif';
              ctx.textAlign = 'center';
              ctx.fillStyle = 'red';
              ctx.fillText('초기 설정 로드 실패.', canvas.width / 2, canvas.height / 2);
          }
          // UI 비활성화 (이미 초기 Chart.js 로드 실패에서 처리했지만, 여기서도 안전하게)
          if (popupButton) popupButton.disabled = true;
          if (versionSelect) versionSelect.disabled = true;
          if (tierSelect) tierSelect.disabled = true;
          if (periodSelect) periodSelect.disabled = true;
          if (lowPickrateCheckbox) lowPickrateCheckbox.disabled = true;
          if (highPickrateCheckbox) highPickrateCheckbox.disabled = true;
          document.querySelectorAll('.graph-tab').forEach(btn => btn.disabled = true);
      });

    // 탭 클릭 처리 & URL 반영
    function setupGraphTabs() {
      document.querySelectorAll('.graph-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTab = btn.dataset.type;
          setParam('tab', currentTab);
          // 탭 변경 시 필터 상태를 유지한 채 그래프만 다시 그림
          applyFilters(); // 현재 필터 상태를 filteredData에 갱신
          createGraph(currentTab); // 갱신된 filteredData로 그래프를 그림
        });
      });
    }

    // 데이터 로드 → 가공 → 필터 → 차트
    function loadData() {
      // tierConfig가 아직 로드되지 않은 경우는 오류 (실제로는 Promise.all에서 로드 보장)
      if (!tierConfig) {
           console.error("loadData 호출 전 tierConfig 로드되지 않음.");
            const ctx = canvas.getContext('2d');
            if (ctx) { // ctx가 유효한 경우만 그립니다.
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = '20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'red';
                ctx.fillText('설정 로드 대기 중 오류 발생.', canvas.width / 2, canvas.height / 2);
            }
           return;
      }


      const version = versionSelect.value;
      const tier = tierSelect.value;
      const period = periodSelect.value;

      // canvas 비우고 로딩 메시지 표시
      const ctx = canvas.getContext('2d');
      if (ctx) { // ctx가 유효한 경우만 그립니다.
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = '20px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#888';
          ctx.fillText('데이터 로딩 중...', canvas.width / 2, canvas.height / 2);
      }


      // >>> 수정 시작: '/data/' 폴더를 '/stats/' 폴더로 변경
      fetch(`/stats/${version}/${tier}.json`)
      // >>> 수정 끝
        .then(r => {
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            return r.json();
        })
        .then(json => {
          const history = json['통계'];
          // common.js에서 getProcessedStatsForPeriod 함수를 사용하여 최종 데이터셋 계산
          // getProcessedStatsForPeriod 결과의 승률/TOP3/픽률은 0-1 스케일입니다.
          chartData = getProcessedStatsForPeriod(history, period, tierConfig); // common.js 함수

          // 데이터가 없는 경우 (getProcessedStatsForPeriod 결과 빈 배열) 처리
          if (!chartData || chartData.length === 0) {
               console.warn("선택한 기간에 해당하는 데이터가 없습니다.");
               if (myChart) myChart.destroy(); // 기존 그래프 파괴
               const ctx = canvas.getContext('2d'); // 다시 ctx 가져옴
               if (ctx) { // ctx가 유효한 경우만 그립니다.
                   ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 초기화
                   ctx.font = '20px sans-serif';
                   ctx.textAlign = 'center';
                   ctx.fillStyle = '#888';
                   ctx.fillText('선택한 조건에 해당하는 데이터가 없습니다.', canvas.width / 2, canvas.height / 2);
               }
               filteredData = []; // 필터된 데이터도 비워줌
               return; // 이후 로직 중단
          }


          applyFilters(); // 로드된 데이터에 필터 적용

          // URL 파라미터에 있는 탭을 클릭하여 그래프 그림
          // initialBtn이 null인 경우에 대비하여 기본 탭 클릭 로직 추가
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
            const ctx = canvas.getContext('2d'); // 다시 ctx 가져옴
            if (ctx) { // ctx가 유효한 경우만 그립니다.
                ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 초기화
                ctx.font = '20px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'red';
                ctx.fillText(`데이터 로드/처리 실패: ${err.message}`, canvas.width / 2, canvas.height / 2);
            }
            filteredData = []; // 필터된 데이터도 비워줌
        });
    }

    // 체크박스 필터 적용
    function applyFilters() {
        if (!chartData || chartData.length === 0) {
             filteredData = [];
             return;
        }
      // 픽률 フィルタ 기준은 chartData (getProcessedStatsForPeriod 結果)의 픽률 平均値입니다.
      // getProcessedStatsForPeriod 결과에는 '픽률' 필드가 0-1 값으로 포함되어 있습니다.
      const pickRateValuesInChartData = chartData.map(d => d['픽률']).filter(pr => typeof pr === 'number' && pr >= 0); // 0 이상인 픽률 값만
      const avgPickRateChartData = pickRateValuesInChartData.length === 0 ? 0 : pickRateValuesInChartData.reduce((s, pr) => s + pr, 0) / pickRateValuesInChartData.length; // 0-1 평균 픽률

      filteredData = chartData.filter(d => {
        const pr = d['픽률'] || 0; // 캐릭터의 픽률 (0-1)
        // 픽률 기준은 전체 데이터셋 (chartData)의 평균 픽률을 사용합니다.
        // 平均픽률이0인 경우는フィルタリング 로직을 건너뛰지 않습니다. pr < 0 / 4 (0) または pr > 0 * 5 (0) 比較は可能です。
        if (lowPickrateCheckbox.checked && pr < avgPickRateChartData / 4) return false; // avgPickRateChartData가 0이면 pr<0 비교
        if (highPickrateCheckbox.checked && pr > avgPickRateChartData * 5) return false; // avgPickRateChartData가 0이면 pr>0 비교
        return true;
      });
    }

    // グラフ生成
    function createGraph(type) {
      if (!filteredData || filteredData.length === 0) {
           console.warn("표시할 그래프 데이터가 없습니다.");
           if (myChart) myChart.destroy(); // 기존 그래프 파괴
           const ctx = canvas.getContext('2d'); // 다시 ctx 가져옴
           if (ctx) { // ctx가 유효한 경우만 그립니다.
               ctx.clearRect(0, 0, canvas.width, canvas.height); // 캔버스 초기화
               ctx.font = '20px sans-serif';
               ctx.textAlign = 'center';
               ctx.fillStyle = '#888';
               ctx.fillText('그래프를 표시할 데이터가 없습니다.', canvas.width / 2, canvas.height / 2);
           }
           return; // 그래프 생성 중단
      }

      const maps = {
        'pick-rp': { xKey:'픽률',    yKey:'RP 획득', radiusKey:'승률',    title:'픽률 / RP 획득' },
        'pick-win':{ xKey:'픽률',    yKey:'승률',    radiusKey:'RP 획득',title:'픽률 / 승률' },
        'rp-win':  { xKey:'RP 획득', yKey:'승률',    radiusKey:'픽률',   title:'RP 획득 / 승률' }
      };
      const { xKey,yKey,radiusKey,title } = maps[type];

      // 평균값 계산 (ChartData 기준, annotation 라인에 사용)
      // getProcessedStatsForPeriod 결과에는 'RP 획득', '승률', 'TOP 3', '픽률', '표본수', '평균 순위' 필드가 있습니다.
      // '승률', 'TOP 3', '픽률'은 0-1 스케일, 'RP 획득', '평균 순위', '표본수'는 값 그대로.
      // 이전 코드의 가중 평균 RP/승률 계산 로직을 유지하되, chartData (getProcessedStatsForPeriod 결과)를 사용합니다.
      // 평균픽률 (0-1)
      const pickRateValuesInChartData = chartData.map(d => d['픽률']).filter(pr => typeof pr === 'number' && pr >= 0); // 0 이상인 픽률 값만
      const avgPickRateChartData = pickRateValuesInChartData.length === 0 ? 0 : pickRateValuesInChartData.reduce((s, pr) => s + pr, 0) / pickRateValuesInChartData.length; // 0-1 평균 픽률

       // 가중 평균 RP 획득, 승률, 픽률 계산 (chartData 기준, 표본수 가중치 사용)
       // chartData의 '승률', 'TOP 3', '픽률'은 0-1 스케일로 저장되어 있다고 가정
       let wRP_sum = 0, wWin_sum = 0, wPick_sum = 0, totalWeight_chartData = 0;
       chartData.forEach(d => {
           const weight = d['표본수'] || 0; // getProcessedStatsForPeriod 결과에 포함된 표본수를 가중치로 사용
           if (weight > 0) {
               wRP_sum += (d['RP 획득'] || 0) * weight; // getProcessedStatsForPeriod 결과의 RP 획득 값 사용
               wWin_sum += (d['승률'] || 0) * weight;   // getProcessedStatsForPeriod 결과의 승률 값 사용 (0-1 스케일)
               wPick_sum += (d['픽률'] || 0) * weight;  // getProcessedStatsForPeriod 결과의 픽률 값 사용 (0-1 스케일)
               totalWeight_chartData += weight;
           }
       });
       const wRP_chartData = totalWeight_chartData === 0 ? 0 : wRP_sum / totalWeight_chartData; // 값 그대로
       const wWin_chartData = totalWeight_chartData === 0 ? 0 : wWin_sum / totalWeight_chartData; // 값 0-1
       const wPick_chartData = totalWeight_chartData === 0 ? 0 : wPick_sum / totalWeight_chartData; // 값 0-1


      const labels  = filteredData.map(d => d['실험체']);
      // 픽률 및 승률 값은 Chart.js가 기대하는 스케일로 변환하여 플로팅
      // getProcessedStatsForPeriod 결과 데이터는 RP/평균 순위 값 그대로, 승률/TOP3/픽률 0-1 스케일입니다.
      // Chart.js 플로팅 데이터는 일반적으로 RP/평균 순위 값 그대로, 승률/TOP3/픽률 0-1 스케일로 맞춥니다.
      const xValues = filteredData.map(d => (d[xKey] || 0)); // 승률/TOP3/픽률은 0-1이므로 그대로 사용. RP/평균 순위도 값 그대로 사용.
      const yValues = filteredData.map(d => (d[yKey] || 0)); // 승률/TOP3/픽률은 0-1이므로 그대로 사용. RP/평균 순위도 값 그대로 사용.
      const rValues = filteredData.map(d => (d[radiusKey] || 0)); // 승률/TOP3/픽률은 0-1이므로 그대로 사용. RP/평균 순위도 값 그대로 사용.


      if (myChart) myChart.destroy(); // 기존 Chart 인스턴스 파괴

      const ctx = canvas.getContext('2d'); // 다시 ctx 가져옴

      myChart = new Chart(ctx, {
        type: 'scatter',
        data: {
          labels,
          datasets: [{
            data: filteredData.map((d,i)=>({x:xValues[i],y:yValues[i],label:d['실험체']})),
            backgroundColor: ctx => {
              // 각 데이터 포인트에 고유 색 적용 (HSV 색 공간 사용)
              // ctx.dataIndex가 undefined일 경우를 대비한 안전 장치 추가
              const dataIndex = ctx && ctx.dataIndex !== undefined ? ctx.dataIndex : i; // Fallback to outer loop index if needed
              const hue = (dataIndex * 360 / filteredData.length) % 360;
              return `hsl(${hue}, 60%, 70%, 0.8)`; // 0.8 투명도
            },
            pointRadius:  ctx => {
              const v = rValues[ctx && ctx.dataIndex !== undefined ? ctx.dataIndex : i]; // 0-1 스케일 값 또는 값 그대로, 안전 장치 추가
              // rValues가 모두 동일한 값일 경우 (예: 데이터가 1개) 반경 15 고정
              // 아니면 6 ~ 30 사이 스케일링
              const mn = Math.min(...rValues), mx = Math.max(...rValues);
              // min/max가 같으면 나누기 0 되므로 예외 처리
              if (mn === mx) return 15;
              // v를 0-1에 정규화하여 스케일링에 사용. v의 스케일에 따라 정규화 방식 변경 필요
              let normalizedV;
              if (radiusKey === 'RP 획득' || radiusKey === '평균 순위' || radiusKey === '표본수') { // 값 그대로인 경우
                   normalizedV = (v - mn) / (mx - mn); // Standard normalization to 0-1
              } else { // 승률/TOP3/픽률 (0-1 스케일로 플로팅 데이터)
                   // 이미 0-1 스케일이므로 min, max도 그 스케일에서 계산됨
                   normalizedV = (v - mn) / (mx - mn); // Already 0-1, but normalize within the range of rValues
              }
              // 정규화 결과를 0-1 범위에 clamp
              normalizedV = Math.max(0, Math.min(1, normalizedV));
              return 6 + normalizedV * 24; // 6 ~ 30 사이
            },
            pointHoverRadius: ctx => {
               const v = rValues[ctx && ctx.dataIndex !== undefined ? ctx.dataIndex : i]; // 0-1 스케일 값 또는 값 그대로, 안전 장치 추가
               const mn = Math.min(...rValues), mx = Math.max(...rValues);
               if (mn === mx) return 15;
               let normalizedV;
               if (radiusKey === 'RP 획득' || radiusKey === '평균 순위' || radiusKey === '표본수') { // 값 그대로인 경우
                    normalizedV = (v - mn) / (mx - mn); // Standard normalization to 0-1
               } else { // 승률/TOP3/픽률 (0-1 스케일로 플로팅 데이터)
                    normalizedV = (v - mn) / (mx - mn); // Already 0-1, but normalize within the range of rValues
               }
               normalizedV = Math.max(0, Math.min(1, normalizedV));
               return 6 + normalizedV * 24; // 마우스 오버 시 같은 반경 유지
            }
          }]
        },
        // --- Chart options 복원 ---
        options: {
          responsive:false,
          maintainAspectRatio:false,
          plugins:{
            legend:{display:false},
            tooltip:{
              callbacks:{
                title:()=>'',
                label:ctx=>{
                  // ctx.dataIndex가 undefined일 경우를 대비한 안전 장치 추가
                  const dataIndex = ctx && ctx.dataIndex !== undefined ? ctx.dataIndex : 0; // Default to 0
                  const d = filteredData[dataIndex]; // 해당 데이터 포인트 원본 객체 (getProcessedStatsForPeriod 결과)
                  if (!d) return ''; // 데이터가 없으면 빈 문자열 반환

                  // getProcessedStatsForPeriod 결과 값의 원래 스케일(RP/평균 순위/표본수 값 그대로, 승률/TOP3/픽률 0-1)에 맞춰 포맷팅
                  return [
                    d['실험체'] || '-', // 실험체 이름
                    `픽률: ${typeof d['픽률'] === 'number' && !isNaN(d['픽률']) ? (d['픽률'] * 100).toFixed(2) + '%' : '-'}`, // 0-1 -> 0-100%
                    `RP 획득: ${typeof d['RP 획득'] === 'number' && !isNaN(d['RP 획득']) ? d['RP 획득'].toFixed(2) : '-'}`, // 값 그대로
                    `승률: ${typeof d['승률'] === 'number' && !isNaN(d['승률']) ? (d['승률'] * 100).toFixed(2) + '%' : '-'}` // 0-1 -> 0-100%
                  ];
                }
              }
            },
            annotation:{
              annotations:[
                {
                  type:'line', scaleID:'x',
                  // annotation 라인 값은 ChartData에서 가져온 평균값의 원래 스케일을 사용합니다.
                  // chartData에서 계산된 평균값 (wRP_chartData, wWin_chartData, wPick_chartData)은 getProcessedStatsForPeriod 결과의 스케일을 따릅니다.
                  // RP 값 그대로, 승률/TOP3/픽률 0-1 스케일.
                  // annotation의 value는 축의 스케일에 맞춰야 합니다. 플로팅 데이터는 RP/평균 순위 값 그대로, 승률/TOP3/픽률 0-1 스케일입니다.
                  value: xKey==='RP 획득' || xKey==='평균 순위' || xKey==='표본수' ? wRP_chartData : // xKey가 값 그대로인 경우, 평균RP 사용
                         xKey==='승률' || xKey==='TOP 3' || xKey==='픽률' ? wPick_chartData : // xKey가 0-1인 경우, 평균픽률 사용 (JSON 예시 픽률 스케일 반영)
                         undefined, // 알 수 없는 xKey
                  borderColor:'#ffac2b', borderWidth:2, borderDash:[5,5]
                },
                {
                  type:'line', scaleID:'y',
                   // annotation 라인 값은 ChartData에서 가져온 평균값의 원래 스케일を使用합니다.
                   value: yKey==='RP 획득' || yKey==='평균 순위' || yKey==='표본수' ? wRP_chartData : // yKey가 값 그대로인 경우, 평균RP 사용
                          yKey==='승률' || yKey==='TOP 3' || yKey==='픽률' ? wWin_chartData : // yKey가 0-1인 경우, 평균승률 사용 (JSON 예시 승률 スケール 반영)
                          undefined, // 알 수 없는 yKey
                  borderColor:'#ffac2b', borderWidth:2, borderDash:[5,5]
                }
              ]
            }
          },
          scales:{
            x:{
              title:{display:true,text:xKey},
              // 픽률, 승률, TOP 3 축의 min 설정 (0-1 스케일) - plotting data와 맞춰야 함
              // 원본 코드 그대로 유지.
              min: xKey==='픽률'?0:undefined, // 픽률 축만 0
              max: xKey==='픽률'?Math.ceil(Math.max(...xValues)*500)/500:undefined, // 원본 로직 유지 (픽률 축만 max 설정)
              ticks:{
                callback: v => {
                  // v는 Chart.js의 스케일 값 (plotting data 스케일)。 여기서 표시될 텍스트 포맷팅。
                  // v는 플로팅 데이터 스케일 (RP/평균 순위 값 그대로, 승률/TOP3/픽률 0-1)
                  if (xKey === '픽률' || xKey === '승률' || xKey === 'TOP 3') {
                      // v가 0-1 스케일로 들어오므로 100 곱해서 %로 표시
                      return `${(v * 100).toFixed(1)}%`;
                  }
                   if (xKey === 'RP 획득') {
                       // v는 값 그대로 들어옴
                       return typeof v === 'number' && !isNaN(v) ? v.toFixed(1) : '-'; // 유효한 숫자만 표시
                   }
                  // 평균 순위 등 다른 값
                  return typeof v === 'number' && !isNaN(v) ? v.toFixed(1) : '-'; // 다른 숫자도 소수점 첫째 자리까지 표시
                },
                 stepSize: xKey === 'RP 획득' ? 1 : (xKey === '픽률' || xKey === '승률' || xKey === 'TOP 3' ? 0.002 : undefined) // 원본 로직 유지
              }
            },
            y:{
              title:{display:true,text:yKey},
               // 픽률, 승률, TOP 3 축의 min 설정 (0-1 스케일) - plotting data와 맞춰야 함
               // 원본 코드 그대로 유지.
              min: yKey==='픽률'?0:undefined, // 픽률 축만 0
              max: yKey==='픽률'?Math.ceil(Math.max(...yValues)*500)/500:undefined, // 원본 로직 유지 (픽률 축만 max 설정)
              ticks:{
                callback: v => {
                   // v는 Chart.js의 스케일 값 (plotting data 스케일)。 여기서 표시될 텍스트 포맷팅。
                   // v는 플로팅 데이터 스케일 (RP/평균 순위 값 그대로, 승률/TOP3/픽률 0-1)
                   if (yKey === '픽률' || yKey === '승률' || yKey === 'TOP 3') {
                       // v가0-1 스케일로 입력되므로 100 곱해서 %로 표시
                       return `${(v * 100).toFixed(1)}%`;
                   }
                    if (yKey === 'RP 획득') {
                        // v는 값 그대로 입력된다
                        return typeof v === 'number' && !isNaN(v) ? v.toFixed(1) : '-'; // 유효한 숫자만 표시
                    }
                   // 평균 순위 등 다른 값
                   return typeof v === 'number' && !isNaN(v) ? v.toFixed(1) : '-'; // 다른 숫자도 소수점 첫째 자리까지 표시
                 },
                  stepSize: yKey === 'RP 획득' ? 1 : (yKey === '픽률' || yKey === '승률' || yKey === 'TOP 3' ? 0.002 : undefined) // 원본 로직 유지
              }
            }
          }
        }
        // --- Chart options 복원 끝 ---
      });

      // 메타데이터 (common.js의 tierMap 사용)
      // chartData에서 계산된 평균값 (wRP_chartData, wWin_chartData, wPick_chartData)는 getProcessedStatsForPeriod 결과의 스케일을 따릅니다.
      // RP 값 그대로, 승률/TOP3/픽률 0-1 스케일.
      myChart.config._제목 = title;
      myChart.config._평균픽률 = wPick_chartData * 100; // 0-1 스케일이므로 100 곱해서 저장 (코너 텍스트 표시용)
      myChart.config._가중평균RP = wRP_chartData; // 값 그대로 저장
      myChart.config._가중평균승률 = wWin_chartData * 100; // 0-1 스케일이므로 100 곱해서 저장 (코너 텍스트 표시용)
      myChart.config._version = versionSelect.value;
      myChart.config._tier = tierSelect.value; // 코드 (예: diamond_plus)
    }


    // 레이블 플러그인 정의 (위로 이동)
    // 코너 텍스트 플러그인 정의 (위로 이동)

    // NOTE: extractPeriodEntries 함수는 getProcessedStatsForPeriod 등의 함수에 의해 대체되어 제거되었습니다.
});