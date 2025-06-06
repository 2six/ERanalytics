// script_graph.js
document.addEventListener('DOMContentLoaded', function () {
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
    let chartData    = [];
    let filteredData = [];
    let myChart      = null;
    // 탭 파라미터로 초기화
    let currentTab   = getParam('tab', 'pick-rp');

    // 초기화
    fetch('/versions.json')
      .then(r => r.json())
      .then(versions => {
        // 드롭다운 채우기
        populateVersionDropdown(versionSelect, versions);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        // URL → 초기 상태
        versionSelect.value = getParam('version', versions.sort().reverse()[0]);
        tierSelect.value    = getParam('tier', 'diamond_plus');
        periodSelect.value  = getParam('period', 'latest');
        lowPickrateCheckbox.checked  = getParam('lowPickrate', 'false') === 'true';
        highPickrateCheckbox.checked = getParam('highPickrate', 'false') === 'true';

        // 드롭다운 변경
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

        // 체크박스 변경
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
      .catch(err => console.error('초기화 실패:', err));

    // 탭 클릭 처리 & URL 반영
    function setupGraphTabs() {
      document.querySelectorAll('.graph-tab').forEach(btn => {
        btn.addEventListener('click', () => {
          currentTab = btn.dataset.type;
          setParam('tab', currentTab);
          applyFilters();
          createGraph(currentTab);
        });
      });
    }

    // 데이터 로드 → 필터 → 차트
    function loadData() {
      const version = versionSelect.value;
      const tier    = tierSelect.value;
      const period  = periodSelect.value;

      // >>> 수정 시작: '/data/' 폴더를 '/stats/' 폴더로 변경
      fetch(`/stats/${version}/${tier}.json`)
      // >>> 수정 끝
        .then(r => r.json())
        .then(json => {
          const history = json['통계'];
          let entries;

          // --- 수정 시작: 기간에 따라 common.js의 함수 호출 ---
          if (period === 'latest') {
            // 'latest' 기간은 스냅샷 사용 (common.js의 extractPeriodEntries)
            entries = extractPeriodEntries(history, period);
          } else {
            // '3day' 또는 '7day' 기간은 델타 통계 사용 (common.js의 extractDeltaEntries)
            entries = extractDeltaEntries(history, period);
          }
          // --- 수정 끝

          chartData = entries; // 추출된 데이터를 chartData에 할당
          applyFilters();
          // URL 파라미터에 있는 탭 클릭
          const initialBtn = document.querySelector(`.graph-tab[data-type="${currentTab}"]`);
          if (initialBtn) {
            initialBtn.click();
          } else {
            // 기본 탭
            document.querySelector('.graph-tab[data-type="pick-rp"]').click();
          }
        })
        .catch(err => console.error('데이터 로드 실패:', err));
    }

    // 체크박스 필터 적용
    function applyFilters() {
      const totalSample = chartData.reduce((s, d) => s + d['표본수'], 0);
      const avgPickRate = chartData.reduce((s, d) => s + d['표본수']/totalSample, 0) / chartData.length;
      filteredData = chartData.filter(d => {
        const pr = d['표본수']/totalSample;
        if (lowPickrateCheckbox.checked  && pr < avgPickRate/4) return false;
        if (highPickrateCheckbox.checked && pr > avgPickRate*5) return false;
        return true;
      });
    }

    // 그래프 생성
    function createGraph(type) {
      const maps = {
        'pick-rp': { xKey:'픽률',    yKey:'RP 획득', radiusKey:'승률',    title:'픽률 / RP 획득' },
        'pick-win':{ xKey:'픽률',    yKey:'승률',    radiusKey:'RP 획득',title:'픽률 / 승률' },
        'rp-win':  { xKey:'RP 획득', yKey:'승률',    radiusKey:'픽률',   title:'RP 획득 / 승률' }
      };
      const { xKey,yKey,radiusKey,title } = maps[type];
      const totalSample = chartData.reduce((s, d) => s + d['표본수'], 0);
      const avgPickRate = chartData.reduce((s, d) => s + d['표본수']/totalSample, 0) / chartData.length;
      const wRP  = chartData.reduce((s, d) => s + d['RP 획득']*(d['표본수']/totalSample), 0);
      const wWin = chartData.reduce((s, d) => s + d['승률']    *(d['표본수']/totalSample), 0);

      const labels  = filteredData.map(d => d['실험체']);
      const xValues = filteredData.map(d => xKey==='픽률'?d['표본수']/totalSample:d[xKey]);
      const yValues = filteredData.map(d => yKey==='픽률'?d['표본수']/totalSample:d[yKey]);
      const rValues = filteredData.map(d => radiusKey==='픽률'?d['표본수']/totalSample:d[radiusKey]);

      if (myChart) myChart.destroy();
      const ctx = canvas.getContext('2d');
      Chart.register(labelPlugin, cornerTextPlugin, window['chartjs-plugin-annotation']);

      myChart = new Chart(ctx, {
        type: 'scatter',
        data: {
          labels,
          datasets: [{
            data: filteredData.map((d,i)=>({x:xValues[i],y:yValues[i],label:d['실험체']})),
            backgroundColor: ctx => {
              const hue = (ctx.dataIndex*360/filteredData.length)%360;
              return `hsl(${hue},60%,70%,0.8)`;
            },
            pointRadius:  ctx => {
              const v=rValues[ctx.dataIndex],mn=Math.min(...rValues),mx=Math.max(...rValues);
              return mn===mx?15:6+((v-mn)/(mx-mn))*24;
            },
            pointHoverRadius: ctx => {
              const v=rValues[ctx.dataIndex],mn=Math.min(...rValues),mx=Math.max(...rValues);
              return mn===mx?15:6+((v-mn)/(mx-mn))*24;
            }
          }]
        },
        options: {
          responsive:false,
          maintainAspectRatio:false,
          plugins:{
            legend:{display:false},
            tooltip:{
              callbacks:{
                title:()=>'',
                label:ctx=>{
                  const d=filteredData[ctx.dataIndex];
                  return [
                    d['실험체'],
                    `픽률: ${(d['표본수']/totalSample*100).toFixed(2)}%`,
                    `RP 획득: ${d['RP 획득'].toFixed(2)}`,
                    `승률: ${(d['승률']*100).toFixed(2)}%`
                  ];
                }
              }
            },
            annotation:{
              annotations:[
                {
                  type:'line', scaleID:'x',
                  value: xKey==='픽률'?avgPickRate:(xKey==='승률'?wWin:wRP),
                  borderColor:'#ffac2b', borderWidth:2, borderDash:[5,5]
                },
                {
                  type:'line', scaleID:'y',
                  value: yKey==='픽률'?avgPickRate:(yKey==='승률'?wWin:wRP),
                  borderColor:'#ffac2b', borderWidth:2, borderDash:[5,5]
                }
              ]
            }
          },
          scales:{
            x:{
              title:{display:true,text:xKey},
              // --- 수정: RP 획득 축의 단계와 픽률/승률 축의 콜백 형식 변경 ---
              min: xKey==='픽률'?0:undefined, // 픽률은 최소값 0 유지
              max: xKey==='픽률'?Math.ceil(Math.max(...xValues)*500)/500:undefined, // 픽률 최대값 유지
              ticks:{
                callback: v => {
                  if (xKey === '픽률' || xKey === '승률') {
                    return `${(v*100).toFixed(1)}%`; // 픽률과 승률은 백분율로 표시, 소수점 첫째 자리까지
                  }
                  if (xKey === 'RP 획득') {
                      // RP 획득은 소수점 첫째 자리까지 표시
                      return v.toFixed(1);
                  }
                  return v; // 그 외는 기본값
                },
                stepSize: xKey === 'RP 획득' ? 1 : (xKey === '픽률' ? 0.002 : undefined) // RP 획득 단계 1, 픽률 단계 0.002 유지
              }
              // ---------------------------------------------------------
            },
            y:{
              title:{display:true,text:yKey},
               // --- 수정: RP 획득 축의 단계와 픽률/승률 축의 콜백 형식 변경 ---
              min: yKey==='픽률'?0:undefined, // 픽률은 최소값 0 유지
              max: yKey==='픽률'?Math.ceil(Math.max(...yValues)*500)/500:undefined, // 픽률 최대값 유지
              ticks:{
                callback: v => {
                   if (yKey === '픽률' || yKey === '승률') {
                    return `${(v*100).toFixed(1)}%`; // 픽률과 승률은 백분율로 표시, 소수점 첫째 자리까지
                   }
                   if (yKey === 'RP 획득') {
                       // RP 획득은 소수점 첫째 자리까지 표시
                       return v.toFixed(1);
                   }
                   return v; // 그 외는 기본값
                 },
                 stepSize: yKey === 'RP 획득' ? 1 : (yKey === '픽률' ? 0.002 : undefined) // RP 획득 단계 1, 픽률 단계 0.002 유지
              }
              // ---------------------------------------------------------
            }
          }
        }
      });

      // 메타데이터
      myChart.config._제목        = title;
      myChart.config._평균픽률    = avgPickRate;
      myChart.config._가중평균RP  = wRP;
      myChart.config._가중평균승률 = wWin;
      myChart.config._version     = versionSelect.value;
      myChart.config._tier        = tierSelect.value;
    }

    // 레이블 플러그인
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

    // 코너 텍스트 플러그인
    // 티어 코드 → 한글 레이블 맵
    const tierLabels = {
        platinum_plus: "플래티넘+",
        diamond_plus:  "다이아몬드+",
        meteorite_plus:"메테오라이트+",
        mithril_plus:  "미스릴+",
        in1000:        "in1000"
    };
    
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
          const humanTier    = tierLabels[chart.config._tier] || chart.config._tier;
          const versionTier  = `${chart.config._version} | ${humanTier}`;
          ctx.fillText(versionTier, centerX, chartArea.top + 28);
      
          // 우측 상단 평균데이터 (값이 있을 때만)
          const avgPick = chart.config._평균픽률;
          const avgRP   = chart.config._가중평균RP;
          const avgWin  = chart.config._가중평균승률;
      
          ctx.textAlign = 'right';
          ctx.font      = '14px sans-serif';
      
          if (typeof avgPick === 'number') {
            ctx.fillText(
              `평균 픽률: ${(avgPick * 100).toFixed(2)}%`,
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
              `평균 승률: ${(avgWin * 100).toFixed(2)}%`,
              chartArea.right - 10,
              chartArea.top + 48
            );
          }
      
          ctx.restore();
        }
    };
});
