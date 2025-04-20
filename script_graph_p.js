document.addEventListener('DOMContentLoaded', function () {
    let myChart;
    let chartData = [];

    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');
    const canvas = document.getElementById('graph-canvas');

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
                const 실험체 = chartLabels[index];

                ctx.font = '10px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.lineWidth = 2;
                ctx.strokeStyle = 'white';
                ctx.strokeText(실험체, x, y);

                ctx.fillStyle = 'black';
                ctx.fillText(실험체, x, y);
            });
            ctx.restore();
        }
    };

    const cornerTextPlugin = {
        id: 'cornerTextPlugin',
        afterDraw(chart) {
            const { ctx, chartArea } = chart;
            const left = chartArea.left;
            const top = chartArea.top;
            const right = chartArea.right;

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

    function setupGraphPopup() {
        const popup = document.getElementById('image-popup');
        const popupImage = document.getElementById('popup-image');
        const closeButton = document.querySelector('.image-popup-close');
        const popupGraphButton = document.getElementById('popup-graph-button');

        if (popupGraphButton && popup && popupImage && closeButton) {
            popupGraphButton.addEventListener('click', function () {
                html2canvas(canvas).then(canvas => {
                    popup.style.display = 'block';
                    popupImage.src = canvas.toDataURL();
                });
            });

            closeButton.addEventListener('click', function () {
                popup.style.display = 'none';
            });

            window.addEventListener('click', function (event) {
                if (event.target === popup) {
                    popup.style.display = 'none';
                }
            });
        }
    }

    function createGraph({ xKey, yKey, radiusKey, title }) {
        if (myChart) {
            myChart.destroy();
        }

        const ctx = canvas.getContext('2d');
        const labels = chartData.map(d => d["실험체"]);
        const 전체표본수 = chartData.reduce((sum, d) => sum + d["표본수"], 0);

        const xValues = chartData.map(d =>
            xKey === "픽률" ? d["표본수"] / 전체표본수 : d[xKey]
        );
        const yValues = chartData.map(d =>
            yKey === "픽률" ? d["표본수"] / 전체표본수 : d[yKey]
        );
        const radiusValues = chartData.map(d =>
            radiusKey === "픽률" ? d["표본수"] / 전체표본수 : d[radiusKey]
        );

        const 평균픽률 = chartData.reduce((acc, d) => acc + (d["표본수"] / 전체표본수), 0) / chartData.length;
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
                    data: chartData.map((item, i) => ({
                        x: xValues[i],
                        y: yValues[i],
                        label: item["실험체"],
                        승률: item["승률"]
                    })),
                    backgroundColor: function (context) {
                        const index = context.dataIndex;
                        const hue = (index * 360 / chartData.length) % 360;
                        return `hsl(${hue}, 60%, 70%, 0.8)`;
                    },
                    pointRadius: function (context) {
                        const val = radiusValues[context.dataIndex];
                        const min = Math.min(...radiusValues);
                        const max = Math.max(...radiusValues);
                        const 기준크기 = 30;
                        const 최소크기 = 6;

                        if (max === min) return 기준크기;
                        const 비율 = (val - min) / (max - min);
                        return 최소크기 + 비율 * (기준크기 - 최소크기);
                    },
                    pointHoverRadius: function(context) {
                        const val = radiusValues[context.dataIndex];
                        const min = Math.min(...radiusValues);
                        const max = Math.max(...radiusValues);
                        const 기준크기 = 30;
                        const 최소크기 = 6;

                        if (max === min) return 기준크기;
                        const 비율 = (val - min) / (max - min);
                        return 최소크기 + 비율 * (기준크기 - 최소크기);
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
                            label: function (context) {
                                const index = context.dataIndex;
                                const label = chartData[index]["실험체"];
                                const 픽률 = ((chartData[index]["표본수"] / 전체표본수) * 100).toFixed(2);
                                const RP획득 = chartData[index]["RP 획득"];
                                const 승률 = (chartData[index]["승률"] * 100).toFixed(2);

                                return [
                                    `${label}`,
                                    `픽률: ${픽률}%`,
                                    `RP 획득: ${RP획득}`,
                                    `승률: ${승률}%`
                                ];
                            }
                        }
                    },
                    annotation: {
                        annotations: [
                            {
                                type: 'line',
                                borderColor: '#ffac2b',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                scaleID: 'x',
                                value: xKey === "픽률" ? 평균픽률 : (xKey === "RP 획득" ? 가중평균RP : 가중평균승률),
                                label: { display: false }
                            },
                            {
                                type: 'line',
                                borderColor: '#ffac2b',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                scaleID: 'y',
                                value: yKey === "픽률" ? 평균픽률 : (yKey === "RP 획득" ? 가중평균RP : 가중평균승률),
                                label: { display: false }
                            }
                        ]
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: { display: true, text: xKey },
                        ticks: {
                            callback: value => isXPercent ? (value * 100).toFixed(1) + '%' : value,
                            stepSize: xKey === "픽률" ? 0.002 : isXPercent ? 0.01 : 1
                        },
                        min: xMin,
                        max: xMax
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: yKey },
                        ticks: {
                            callback: value => isYPercent ? (value * 100).toFixed(1) + '%' : value,
                            stepSize: yKey === "픽률" ? 0.002 : isYPercent ? 0.01 : 1
                        },
                        min: yMin,
                        max: yMax
                    }
                }
            }
        });

        myChart.config._제목 = title;
        myChart.config._평균픽률 = 평균픽률;
        myChart.config._가중평균RP = 가중평균RP;
        myChart.config._가중평균승률 = 가중평균승률;
    }

    function setupGraphTabs() {
        document.querySelectorAll('.graph-tab').forEach(button => {
            button.addEventListener('click', () => {
                const type = button.getAttribute('data-type');
                if (type === 'pick-rp') {
                    createGraph({ xKey: "픽률", yKey: "RP 획득", radiusKey: "승률", title: "픽률 / RP 획득" });
                } else if (type === 'pick-win') {
                    createGraph({ xKey: "픽률", yKey: "승률", radiusKey: "RP 획득", title: "픽률 / 승률" });
                } else if (type === 'rp-win') {
                    createGraph({ xKey: "RP 획득", yKey: "승률", radiusKey: "픽률", title: "RP 획득 / 승률" });
                }
            });
        });
    }

    Promise.all([
        fetch('versions.json').then(res => res.json()),
        fetch('data/latest/in1000.json').then(res => res.json()) // 기본값
    ]).then(([versions, defaultJson]) => {
        const versionDropdown = document.getElementById('version-select');
        versions.sort().reverse().forEach(v => {
            versionDropdown.innerHTML += `<option value="${v}">${v}</option>`;
        });

        versionDropdown.addEventListener('change', loadData);
        tierSelect.addEventListener('change', loadData);
        periodSelect.addEventListener('change', loadData);

        window.dataset = defaultJson;
        loadData();
    });

    function loadData() {
        const version = versionSelect.value;
        const tier = tierSelect.value;
        const period = periodSelect.value;

        fetch(`data/${version}/${tier}.json`)
            .then(res => res.json())
            .then(json => {
                const history = json["통계"];
                const timestamps = Object.keys(history).sort();
                const latest = history[timestamps[timestamps.length - 1]];
                if (period === 'latest') {
                    chartData = latest;
                } else {
                    const days = period === '3day' ? 3 : 7;
                    const 기준일 = new Date(timestamps[timestamps.length - 1]);
                    기준일.setDate(기준일.getDate() - days);
                    const 과거키 = timestamps.reverse().find(ts => new Date(ts) <= 기준일);

                    if (과거키) {
                        const 이전 = history[과거키];
                        const latestMap = Object.fromEntries(latest.map(d => [d.실험체, d]));
                        const prevMap = Object.fromEntries(이전.map(d => [d.실험체, d]));

                        const delta = [];
                        for (const name in latestMap) {
                            const curr = latestMap[name];
                            const prev = prevMap[name];
                            if (!prev) continue;
                            const diff = curr["표본수"] - prev["표본수"];
                            if (diff <= 0) continue;
                            delta.push({
                                "실험체": name,
                                "표본수": diff,
                                "RP 획득": (curr["RP 획득"] * curr["표본수"] - prev["RP 획득"] * prev["표본수"]) / diff,
                                "승률": (curr["승률"] * curr["표본수"] - prev["승률"] * prev["표본수"]) / diff,
                                "TOP 3": (curr["TOP 3"] * curr["표본수"] - prev["TOP 3"] * prev["표본수"]) / diff,
                                "평균 순위": (curr["평균 순위"] * curr["표본수"] - prev["평균 순위"] * prev["표본수"]) / diff
                            });
                        }

                        chartData = delta;
                    } else {
                        chartData = latest;
                    }
                }

                setupGraphPopup();
                setupGraphTabs();
                document.querySelector('[data-type="pick-rp"]').click();
            });
    }
});
