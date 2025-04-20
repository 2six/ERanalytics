// script_graph.js (공통 모듈 + totalSample 수정 적용 버전)
document.addEventListener('DOMContentLoaded', function () {
    let myChart;
    let chartData = [];
    let filteredData = [];

    const canvas = document.getElementById('graph-canvas');
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const lowPickrateCheckbox = document.getElementById('filter-low-pickrate');
    const highPickrateCheckbox = document.getElementById('filter-high-pickrate');
    let currentTab = 'pick-rp';

    // 1) 드롭다운 초기화
    fetch('versions.json').then(res => res.json()).then(versions => {
        populateVersionDropdown(versionSelect, versions);
        populateTierDropdown(tierSelect);
        populatePeriodDropdown(periodSelect);

        versionSelect.addEventListener('change', loadData);
        tierSelect.addEventListener('change', loadData);
        periodSelect.addEventListener('change', loadData);

        loadData();
    });

    // 2) 탭 및 필터 셋업
    function setupGraphTabsAndFilters() {
        document.querySelectorAll('.graph-tab').forEach(button => {
            button.addEventListener('click', () => {
                currentTab = button.dataset.type;
                applyFilters();
                createGraph(currentTab);
            });
        });
        lowPickrateCheckbox.addEventListener('change', () => document.querySelector(`[data-type="${currentTab}"]`).click());
        highPickrateCheckbox.addEventListener('change', () => document.querySelector(`[data-type="${currentTab}"]`).click());
    }

    // 3) 데이터 로드
    function loadData() {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json['통계'];
                chartData = extractPeriodEntries(history, period);
                setupGraphTabsAndFilters();
                document.querySelector('[data-type="pick-rp"]').click();
            })
            .catch(err => console.error('데이터 로드 실패:', err));
    }

    // 4) 기간별 추출 공통 로직
    function extractPeriodEntries(history, period) {
        const keys = Object.keys(history).sort();
        const latestKey = keys[keys.length - 1];
        const latestData = history[latestKey];
        if (period === 'latest') return latestData;

        const days = period === '3day' ? 3 : 7;
        const latestDate = new Date(latestKey.replace(/_/g, ':').replace(/-/g, '/'));
        const cutoff = new Date(latestDate);
        cutoff.setDate(cutoff.getDate() - days);

        const pastKey = keys.slice().reverse().find(k => new Date(k.replace(/_/g, ':').replace(/-/g, '/')) <= cutoff);
        if (!pastKey) return latestData;

        const prevData = history[pastKey];
        const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
        const prevMap = Object.fromEntries(prevData.map(d => [d.실험체, d]));
        const delta = [];

        for (const name in currMap) {
            const c = currMap[name];
            const p = prevMap[name];
            if (!p) continue;
            const diff = c['표본수'] - p['표본수'];
            if (diff <= 0) continue;
            delta.push({
                '실험체': name,
                '표본수': diff,
                'RP 획득': (c['RP 획득'] * c['표본수'] - p['RP 획득'] * p['표본수']) / diff,
                '승률': (c['승률'] * c['표본수'] - p['승률'] * p['표본수']) / diff,
                'TOP 3': (c['TOP 3'] * c['표본수'] - p['TOP 3'] * p['표본수']) / diff,
                '평균 순위': (c['평균 순위'] * c['표본수'] - p['평균 순위'] * p['표본수']) / diff
            });
        }
        return delta;
    }

    // 5) 필터 적용
    function applyFilters() {
        const totalSample = chartData.reduce((sum, d) => sum + d['표본수'], 0);
        const avgPickRate = chartData.reduce((acc, d) => acc + d['표본수'] / totalSample, 0) / chartData.length;
        filteredData = chartData.filter(d => {
            const pr = d['표본수'] / totalSample;
            if (lowPickrateCheckbox.checked && pr < avgPickRate / 4) return false;
            if (highPickrateCheckbox.checked && pr > avgPickRate * 5) return false;
            return true;
        });
    }

    // 6) 그래프 생성
    function createGraph(type) {
        const mappings = {
            'pick-rp': { xKey: '픽률', yKey: 'RP 획득', radiusKey: '승률', title: '픽률 / RP 획득' },
            'pick-win': { xKey: '픽률', yKey: '승률', radiusKey: 'RP 획득', title: '픽률 / 승률' },
            'rp-win'  : { xKey: 'RP 획득', yKey: '승률', radiusKey: '픽률', title: 'RP 획득 / 승률' }
        };
        const { xKey, yKey, radiusKey, title } = mappings[type];

        const totalSample = chartData.reduce((sum, d) => sum + d['표본수'], 0);
        const avgPickRate = chartData.reduce((sum, d) => sum + d['표본수'] / totalSample, 0) / chartData.length;
        const weightedRP = chartData.reduce((sum, d) => sum + d['RP 획득'] * (d['표본수'] / totalSample), 0);
        const weightedWin = chartData.reduce((sum, d) => sum + d['승률'] * (d['표본수'] / totalSample), 0);

        const labels = filteredData.map(d => d['실험체']);
        const xValues = filteredData.map(d => xKey === '픽률' ? d['표본수'] / totalSample : d[xKey]);
        const yValues = filteredData.map(d => yKey === '픽률' ? d['표본수'] / totalSample : d[yKey]);
        const rValues = filteredData.map(d => radiusKey === '픽률' ? d['표본수'] / totalSample : d[radiusKey]);

        if (myChart) myChart.destroy();
        const ctx = canvas.getContext('2d');

        // 등록할 플러그인 정의
const labelPlugin = {
    id: 'labelPlugin',
    afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        const dataPoints = meta.data;
        const labels = chart.data.labels;
        ctx.save();
        dataPoints.forEach((point, index) => {
            const x = point.x;
            const y = point.y;
            const label = labels[index];
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'white';
            ctx.strokeText(label, x, y);
            ctx.fillStyle = 'black';
            ctx.fillText(label, x, y);
        });
        ctx.restore();
    }
};

const cornerTextPlugin = {
    id: 'cornerTextPlugin',
    afterDraw(chart) {
        const { ctx, chartArea } = chart;
        const left = chartArea.left;
        const right = chartArea.right;
        const top = chartArea.top;
        ctx.save();
        ctx.font = '14px sans-serif';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'left';
        ctx.fillText(chart.config._제목 || '', left + 10, top + 20);
        ctx.textAlign = 'right';
        ctx.fillText(`평균 픽률: ${(chart.config._평균픽률*100).toFixed(2)}%`, right - 10, top + 20);
        ctx.fillText(`평균 RP: ${chart.config._가중평균RP.toFixed(1)}`, right - 10, top + 40);
        ctx.fillText(`평균 승률: ${(chart.config._가중평균승률*100).toFixed(2)}%`, right - 10, top + 60);
        ctx.restore();
    }
};

Chart.register(labelPlugin, cornerTextPlugin, window['chartjs-plugin-annotation']);
        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels,
                datasets: [{
                    data: filteredData.map((d, i) => ({ x: xValues[i], y: yValues[i], label: d['실험체'] })),
                    backgroundColor: ctx => {
                        const idx = ctx.dataIndex;
                        const hue = (idx * 360 / filteredData.length) % 360;
                        return `hsl(${hue},60%,70%,0.8)`;
                    },
                    pointRadius: ctx => {
                        const v = rValues[ctx.dataIndex];
                        const min = Math.min(...rValues);
                        const max = Math.max(...rValues);
                        return min === max ? 15 : 6 + ((v - min) / (max - min)) * 24;
                    },
                    pointHoverRadius: ctx => {
                        const v = rValues[ctx.dataIndex];
                        const min = Math.min(...rValues);
                        const max = Math.max(...rValues);
                        return min === max ? 15 : 6 + ((v - min) / (max - min)) * 24;
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            // 툴팁 콜백
                        }
                    },
                    annotation: {
                        annotations: [
                            {
                                type: 'line',
                                scaleID: 'x',
                                borderColor: '#ffac2b',    // 노란 점선
                                borderDash: [5, 5],
                                value: xKey === "픽률" ? 평균픽률
                                      : xKey === "승률" ? 가중평균승률
                                      : 가중평균RP
                            },
                            {
                                type: 'line',
                                scaleID: 'y',
                                borderColor: '#ffac2b',
                                borderDash: [5, 5],
                                value: yKey === "픽률" ? 평균픽률
                                      : yKey === "승률" ? 가중평균승률
                                      : 가중평균RP
                            }
                        ]
                    }
                },    // 여기까지 plugins
                scales: {
                    x: {
                        title: { display: true, text: xKey },
                        min: xMin,
                        max: xMax,
                        ticks: { /* … */ }
                    },
                    y: {
                        title: { display: true, text: yKey },
                        min: yMin,
                        max: yMax,
                        ticks: { /* … */ }
                    }
                }
            }
        });

        myChart.config._제목 = title;
        myChart.config._평균픽률 = avgPickRate;
        myChart.config._가중평균RP = weightedRP;
        myChart.config._가중평균승률 = weightedWin;
    }
});
