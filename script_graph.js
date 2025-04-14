document.addEventListener('DOMContentLoaded', function () {
    let myChart;
    let chartData = [];

    const canvas = document.getElementById('pickRateRPChart');

    // ==================== 공통 플러그인 ====================
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

        // ✅ 픽률: xMin 고정 0, max는 0.25 단위 올림
        const xMin = xKey === "픽률" ? 0
            : isXPercent ? Math.floor(Math.min(...xValues) * 100) / 100
            : Math.floor(Math.min(...xValues)) - 1;
        const xMax = xKey === "픽률"
            ? Math.ceil(Math.max(...xValues) * 400) / 400  // 0.0025 단위 올림
            : isXPercent ? Math.ceil(Math.max(...xValues) * 100) / 100
            : Math.ceil(Math.max(...xValues)) + 1;

        const yMin = yKey === "픽률"
            ? 0
            : isYPercent ? Math.floor(Math.min(...yValues) * 100) / 100
            : Math.floor(Math.min(...yValues)) - 1;
        const yMax = yKey === "픽률"
            ? Math.ceil(Math.max(...yValues) * 400) / 400
            : isYPercent ? Math.ceil(Math.max(...yValues) * 100) / 100
            : Math.ceil(Math.max(...yValues)) + 1;

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
                        const 기준크기 = 20; // ✅ 원 크기 기준 확대
                        const 최소크기 = 4;

                        if (max === min) return 기준크기;
                        const 비율 = (val - min) / (max - min);
                        return 최소크기 + 비율 * (기준크기 - 최소크기);
                    },
                    pointHoverRadius: 8
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
                        title: {
                            display: true,
                            text: xKey
                        },
                        ticks: {
                            callback: value => isXPercent ? (value * 100).toFixed(1) + '%' : value,
                            stepSize: xKey === "픽률" ? 0.0025 : isXPercent ? 0.01 : 1 // ✅ 픽률 0.25%, 승률 1%
                        },
                        min: xMin,
                        max: xMax
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: yKey
                        },
                        ticks: {
                            callback: value => isYPercent ? (value * 100).toFixed(1) + '%' : value,
                            stepSize: yKey === "픽률" ? 0.0025 : isYPercent ? 0.01 : 1 // ✅ 픽률 0.25%, 승률 1%
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

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            chartData = data;
            setupGraphPopup();
            setupGraphTabs();
            document.querySelector('[data-type="pick-rp"]').click(); // 기본 그래프
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
        });
});
