document.addEventListener('DOMContentLoaded', function () {
    let myChart;
    let chartData = [];

    const canvas = document.getElementById('graph-canvas');
    const versionSelect = document.getElementById('version-select');
    const tierSelect = document.getElementById('tier-select');
    const periodSelect = document.getElementById('period-select');

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
        if (myChart) myChart.destroy();

        const ctx = canvas.getContext('2d');
        const labels = chartData.map(d => d["실험체"]);
        const 전체표본수 = chartData.reduce((sum, d) => sum + d["표본수"], 0);

        const xValues = chartData.map(d => xKey === "픽률" ? d["표본수"] / 전체표본수 : d[xKey]);
        const yValues = chartData.map(d => yKey === "픽률" ? d["표본수"] / 전체표본수 : d[yKey]);
        const radiusValues = chartData.map(d => radiusKey === "픽률" ? d["표본수"] / 전체표본수 : d[radiusKey]);

        const 평균픽률 = chartData.reduce((acc, d) => acc + (d["표본수"] / 전체표본수), 0) / chartData.length;
        const 가중평균RP = chartData.reduce((acc, d) => acc + d["RP 획득"] * (d["표본수"] / 전체표본수), 0);
        const 가중평균승률 = chartData.reduce((acc, d) => acc + d["승률"] * (d["표본수"] / 전체표본수), 0);

        const isXPercent = xKey === "픽률" || xKey === "승률";
        const isYPercent = yKey === "픽률" || yKey === "승률";

        const xMin = isXPercent ? 0 : Math.floor(Math.min(...xValues));
        const xMax = isXPercent ? Math.ceil(Math.max(...xValues) * 100) / 100 : Math.ceil(Math.max(...xValues));
        const yMin = isYPercent ? 0 : Math.floor(Math.min(...yValues));
        const yMax = isYPercent ? Math.ceil(Math.max(...yValues) * 100) / 100 : Math.ceil(Math.max(...yValues));

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
                    backgroundColor: (context) => {
                        const index = context.dataIndex;
                        const hue = (index * 360 / chartData.length) % 360;
                        return `hsl(${hue}, 60%, 70%, 0.8)`;
                    },
                    pointRadius: (context) => {
                        const val = radiusValues[context.dataIndex];
                        const min = Math.min(...radiusValues);
                        const max = Math.max(...radiusValues);
                        const 기준크기 = 30;
                        const 최소크기 = 6;
                        if (max === min) return 기준크기;
                        const 비율 = (val - min) / (max - min);
                        return 최소크기 + 비율 * (기준크기 - 최소크기);
                    },
                    pointHoverRadius: (context) => {
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
                            label: (context) => {
                                const i = context.dataIndex;
                                return [
                                    `${chartData[i]["실험체"]}`,
                                    `픽률: ${(chartData[i]["표본수"] / 전체표본수 * 100).toFixed(2)}%`,
                                    `RP 획득: ${chartData[i]["RP 획득"]}`,
                                    `승률: ${(chartData[i]["승률"] * 100).toFixed(2)}%`
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
                                value: xKey === "픽률" ? 평균픽률 : (xKey === "RP 획득" ? 가중평균RP : 가중평균승률)
                            },
                            {
                                type: 'line',
                                borderColor: '#ffac2b',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                scaleID: 'y',
                                value: yKey === "픽률" ? 평균픽률 : (yKey === "RP 획득" ? 가중평균RP : 가중평균승률)
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
                            stepSize: isXPercent ? 0.01 : 1
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
                            stepSize: isYPercent ? 0.01 : 1
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
                const latest = history[latestKey];
                if (period === 'latest') {
                    chartData = latest;
                } else {
                    const days = period === '3day' ? 3 : 7;
                    const latestDate = new Date(latestKey);
                    const pastDate = new Date(latestDate);
                    pastDate.setDate(latestDate.getDate() - days);
                    const pastKey = timestamps.reverse().find(k => new Date(k) <= pastDate);
                    if (!pastKey || !history[pastKey]) {
                        chartData = latest;
                    } else {
                        const currMap = Object.fromEntries(latest.map(d => [d.실험체, d]));
                        const prevMap = Object.fromEntries(history[pastKey].map(d => [d.실험체, d]));
                        chartData = Object.keys(currMap).map(name => {
                            const curr = currMap[name];
                            const prev = prevMap[name];
                            if (!prev) return null;
                            const diffSample = curr["표본수"] - prev["표본수"];
                            if (diffSample <= 0) return null;
                            return {
                                "실험체": name,
                                "표본수": diffSample,
                                "RP 획득": (curr["RP 획득"] * curr["표본수"] - prev["RP 획득"] * prev["표본수"]) / diffSample,
                                "승률": (curr["승률"] * curr["표본수"] - prev["승률"] * prev["표본수"]) / diffSample,
                                "TOP 3": (curr["TOP 3"] * curr["표본수"] - prev["TOP 3"] * prev["표본수"]) / diffSample
                            };
                        }).filter(Boolean);
                    }
                }
                document.querySelector('[data-type="pick-rp"]').click();
            });
    }

    fetch("versions.json").then(res => res.json()).then(versionList => {
        versionList.sort().reverse().forEach(v => {
            versionSelect.innerHTML += `<option value="${v}">${v}</option>`;
        });

        const tierMap = {
            "platinum_plus": "플래티넘+",
            "diamond_plus": "다이아몬드+",
            "meteorite_plus": "메테오라이트+",
            "mithril_plus": "미스릴+",
            "in1000": "in1000"
        };
        Object.entries(tierMap).forEach(([key, val]) => {
            tierSelect.innerHTML += `<option value="${key}">${val}</option>`;
        });

        periodSelect.innerHTML = `
            <option value="latest">전체</option>
            <option value="3day">최근 3일</option>
            <option value="7day">최근 7일</option>
        `;

        versionSelect.addEventListener('change', loadData);
        tierSelect.addEventListener('change', loadData);
        periodSelect.addEventListener('change', loadData);

        setupGraphPopup();
        setupGraphTabs();
        loadData();
    });
});
