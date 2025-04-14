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

            // 좌상단
            ctx.textAlign = 'left';
            ctx.fillText(chart.config._제목 || '', left + 10, top + 20);

            // 우상단
            ctx.textAlign = 'right';
            ctx.fillText(`평균 픽률: ${(chart.config._평균픽률 * 100).toFixed(2)}%`, right - 10, top + 20);
            ctx.fillText(`평균 RP: ${chart.config._가중평균RP.toFixed(1)}`, right - 10, top + 40);
            ctx.fillText(`평균 승률: ${(chart.config._가중평균승률 * 100).toFixed(2)}%`, right - 10, top + 60);

            ctx.restore();
        }
    };

    // ==================== 공통 팝업 기능 ====================
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

    // ==================== 그래프 생성 공통 함수 ====================
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
        const yValues = chartData.map(d => d[yKey]);
        const radiusValues = chartData.map(d =>
            radiusKey === "픽률" ? d["표본수"] / 전체표본수 : d[radiusKey]
        );

        const 평균픽률 = chartData.reduce((acc, d) => acc + (d["표본수"] / 전체표본수), 0) / chartData.length;
        const 가중평균RP = chartData.reduce((acc, d) => acc + d["RP 획득"] * (d["표본수"] / 전체표본수), 0);
        const 가중평균승률 = chartData.reduce((acc, d) => acc + d["승률"] * (d["표본수"] / 전체표본수), 0);

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
                        const 기준크기 = 15;
                        const min크기 = 2;

                        if (max === min) return 기준크기;
                        const 비율 = (val - min) / (max - min);
                        return min크기 + 비율 * (기준크기 - min크기);
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
                                const dataPoint = context.raw;
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
                            callback: value => xKey === "픽률" ? (value * 100).toFixed(1) + '%' : value,
                            stepSize: 0.005
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: yKey
                        },
                        ticks: {
                            callback: value => yKey === "픽률" ? (value * 100).toFixed(1) + '%' : value,
                            stepSize: 1
                        },
                        min: Math.floor(Math.min(...yValues)) - 1,
                        max: Math.ceil(Math.max(...yValues)) + 1
                    }
                }
            }
        });

        myChart.config._제목 = title;
        myChart.config._평균픽률 = 평균픽률;
        myChart.config._가중평균RP = 가중평균RP;
        myChart.config._가중평균승률 = 가중평균승률;
    }

    // ==================== 탭 이벤트 ====================
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

    // ==================== 초기화 ====================
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
