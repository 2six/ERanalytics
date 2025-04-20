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

    const labelPlugin = {
        id: 'labelPlugin',
        afterDatasetsDraw(chart) {
            const ctx = chart.ctx;
            const meta = chart.getDatasetMeta(0);
            const dataPoints = meta.data;
            const chartLabels = chart.data.labels;

            ctx.save();
            dataPoints.forEach((point, index) => {
                const x = point.x;
                const y = point.y;
                const label = chartLabels[index];

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
            ctx.fillText(`평균 픽률: ${(chart.config._평균픽률 * 100).toFixed(2)}%`, right - 10, top + 20);
            ctx.fillText(`평균 RP: ${chart.config._가중평균RP.toFixed(1)}`, right - 10, top + 40);
            ctx.fillText(`평균 승률: ${(chart.config._가중평균승률 * 100).toFixed(2)}%`, right - 10, top + 60);

            ctx.restore();
        }
    };

    function applyFilters() {
        const 전체표본수 = chartData.reduce((sum, d) => sum + d["표본수"], 0);
        const 평균픽률 = chartData.reduce((acc, d) => acc + (d["표본수"] / 전체표본수), 0) / chartData.length;

        filteredData = chartData.filter(d => {
            const 픽률 = d["표본수"] / 전체표본수;
            if (lowPickrateCheckbox.checked && 픽률 < 평균픽률 / 4) return false;
            if (highPickrateCheckbox.checked && 픽률 > 평균픽률 * 5) return false;
            return true;
        });
    }

    function setupGraphTabs() {
        document.querySelectorAll('.graph-tab').forEach(button => {
            button.addEventListener('click', () => {
                applyFilters();
                const type = button.dataset.type;
                if (type === 'pick-rp') {
                    createGraph({ xKey: "픽률", yKey: "RP 획득", radiusKey: "승률", title: "픽률 / RP 획득" });
                } else if (type === 'pick-win') {
                    createGraph({ xKey: "픽률", yKey: "승률", radiusKey: "RP 획득", title: "픽률 / 승률" });
                } else if (type === 'rp-win') {
                    createGraph({ xKey: "RP 획득", yKey: "승률", radiusKey: "픽률", title: "RP 획득 / 승률" });
                }
            });
        });

        lowPickrateCheckbox.addEventListener('change', () => {
            document.querySelector('.graph-tab.active')?.click();
        });

        highPickrateCheckbox.addEventListener('change', () => {
            document.querySelector('.graph-tab.active')?.click();
        });
    }

    function createGraph({ xKey, yKey, radiusKey, title }) {
        if (myChart) myChart.destroy();

        const ctx = canvas.getContext('2d');
        const labels = filteredData.map(d => d["실험체"]);
        const 전체표본수 = filteredData.reduce((sum, d) => sum + d["표본수"], 0);

        const getValue = (key, d) => key === "픽률" ? d["표본수"] / 전체표본수 : d[key];

        const xValues = filteredData.map(d => getValue(xKey, d));
        const yValues = filteredData.map(d => getValue(yKey, d));
        const radiusValues = filteredData.map(d => getValue(radiusKey, d));

        const 평균픽률 = chartData.reduce((acc, d) => acc + (d["표본수"] / chartData.reduce((s, d) => s + d["표본수"], 0)), 0) / chartData.length;
        const 가중평균RP = chartData.reduce((acc, d) => acc + d["RP 획득"] * (d["표본수"] / 전체표본수), 0);
        const 가중평균승률 = chartData.reduce((acc, d) => acc + d["승률"] * (d["표본수"] / 전체표본수), 0);

        const isXPercent = xKey === "픽률" || xKey === "승률";
        const isYPercent = yKey === "픽률" || yKey === "승률";

        const xMin = xKey === "픽률" ? 0 : isXPercent ? Math.floor(Math.min(...xValues) * 100) / 100 : Math.floor(Math.min(...xValues));
        const xMax = xKey === "픽률" ? Math.ceil(Math.max(...xValues) * 500) / 500 : isXPercent ? Math.ceil(Math.max(...xValues) * 100) / 100 : Math.ceil(Math.max(...xValues));
        const yMin = yKey === "픽률" ? 0 : isYPercent ? Math.floor(Math.min(...yValues) * 100) / 100 : Math.floor(Math.min(...yValues));
        const yMax = yKey === "픽률" ? Math.ceil(Math.max(...yValues) * 500) / 500 : isYPercent ? Math.ceil(Math.max(...yValues) * 100) / 100 : Math.ceil(Math.max(...yValues));

        Chart.register(labelPlugin, cornerTextPlugin, window['chartjs-plugin-annotation']);

        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: labels,
                datasets: [{
                    data: filteredData.map((d, i) => ({
                        x: xValues[i],
                        y: yValues[i],
                        label: d["실험체"]
                    })),
                    backgroundColor: (ctx) => {
                        const index = ctx.dataIndex;
                        const hue = (index * 360 / filteredData.length) % 360;
                        return `hsl(${hue}, 60%, 70%, 0.8)`;
                    },
                    pointRadius: (ctx) => {
                        const v = radiusValues[ctx.dataIndex];
                        const min = Math.min(...radiusValues);
                        const max = Math.max(...radiusValues);
                        return min === max ? 15 : 6 + ((v - min) / (max - min)) * 24;
                    },
                    pointHoverRadius: (ctx) => {
                        const v = radiusValues[ctx.dataIndex];
                        const min = Math.min(...radiusValues);
                        const max = Math.max(...radiusValues);
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
                            title: () => '',
                            label: (context) => {
                                const index = context.dataIndex;
                                const d = filteredData[index];
                                return [
                                    `${d["실험체"]}`,
                                    `픽률: ${(d["표본수"] / 전체표본수 * 100).toFixed(2)}%`,
                                    `RP 획득: ${d["RP 획득"]}`,
                                    `승률: ${(d["승률"] * 100).toFixed(2)}%`
                                ];
                            }
                        }
                    },
                    annotation: {
                        annotations: [
                            {
                                type: 'line',
                                scaleID: 'x',
                                borderColor: '#ffac2b',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                value: xKey === "픽률" ? 평균픽률 : xKey === "승률" ? 가중평균승률 : 가중평균RP
                            },
                            {
                                type: 'line',
                                scaleID: 'y',
                                borderColor: '#ffac2b',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                value: yKey === "픽률" ? 평균픽률 : yKey === "승률" ? 가중평균승률 : 가중평균RP
                            }
                        ]
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: xKey },
                        min: xMin,
                        max: xMax,
                        ticks: {
                            callback: v => isXPercent ? (v * 100).toFixed(1) + '%' : v,
                            stepSize: isXPercent ? 0.01 : 1
                        }
                    },
                    y: {
                        title: { display: true, text: yKey },
                        min: yMin,
                        max: yMax,
                        ticks: {
                            callback: v => isYPercent ? (v * 100).toFixed(1) + '%' : v,
                            stepSize: isYPercent ? 0.01 : 1
                        }
                    }
                }
            }
        });

        myChart.config._제목 = title;
        myChart.config._평균픽률 = 평균픽률;
        myChart.config._가중평균RP = 가중평균RP;
        myChart.config._가중평균승률 = 가중평균승률;
    }

    function loadData() {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`data/${version}/${tier}.json`)
            .then(r => r.json())
            .then(json => {
                const history = json["통계"];
                const timestamps = Object.keys(history).sort();
                const latestKey = timestamps[timestamps.length - 1];
                const latestData = history[latestKey];

                if (period === 'latest') {
                    chartData = latestData;
                    document.querySelector('[data-type="pick-rp"]').click();
                    return;
                }

                const days = period === '3day' ? 3 : 7;
                const latestDate = new Date(latestKey.replace(/_/g, ':').replace(/-/g, '/'));
                const pastDate = new Date(latestDate);
                pastDate.setDate(pastDate.getDate() - days);

                const pastKey = timestamps.slice().reverse().find(ts => {
                    const d = new Date(ts.replace(/_/g, ':').replace(/-/g, '/'));
                    return d <= pastDate;
                });

                if (!pastKey || !history[pastKey]) {
                    chartData = latestData;
                    document.querySelector('[data-type="pick-rp"]').click();
                    return;
                }

                const currMap = Object.fromEntries(latestData.map(d => [d.실험체, d]));
                const prevMap = Object.fromEntries(history[pastKey].map(d => [d.실험체, d]));

                const delta = [];
                for (const name in currMap) {
                    const curr = currMap[name];
                    const prev = prevMap[name];
                    if (!prev) continue;
                    const diffSample = curr["표본수"] - prev["표본수"];
                    if (diffSample <= 0) continue;

                    delta.push({
                        "실험체": name,
                        "표본수": diffSample,
                        "RP 획득": (curr["RP 획득"] * curr["표본수"] - prev["RP 획득"] * prev["표본수"]) / diffSample,
                        "승률": (curr["승률"] * curr["표본수"] - prev["승률"] * prev["표본수"]) / diffSample,
                        "TOP 3": (curr["TOP 3"] * curr["표본수"] - prev["TOP 3"] * prev["표본수"]) / diffSample,
                        "평균 순위": (curr["평균 순위"] * curr["표본수"] - prev["평균 순위"] * prev["표본수"]) / diffSample
                    });
                }

                chartData = delta;
                document.querySelector('[data-type="pick-rp"]').click();
            });
    }

    Promise.all([
        fetch('versions.json').then(r => r.json())
    ]).then(([versions]) => {
        versions.sort().reverse().forEach(v => {
            versionSelect.innerHTML += `<option value="${v}">${v}</option>`;
        });

        const tierMap = {
            "platinum_plus": "플래티넘+",
            "diamond_plus": "다이아몬드+",
            "meteorite_plus": "메테오라이트+",
            "mithril_plus": "미스릴+",
            "in1000": "in1000"
        };
        Object.entries(tierMap).forEach(([val, name]) => {
            tierSelect.innerHTML += `<option value="${val}">${name}</option>`;
        });

        periodSelect.innerHTML = `
            <option value="latest">전체</option>
            <option value="3day">최근 3일</option>
            <option value="7day">최근 7일</option>
        `;

        versionSelect.addEventListener('change', loadData);
        tierSelect.addEventListener('change', loadData);
        periodSelect.addEventListener('change', loadData);

        loadData();
    });

    setupGraphTabs();
    setupGraphPopup();
});
