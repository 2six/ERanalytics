document.addEventListener('DOMContentLoaded', function () {
    let myChart;

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            createPickRateRPChart(data);
            setupGraphPopup();
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
        });

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

            // 좌상단 텍스트
            ctx.textAlign = 'left';
            ctx.fillText('픽률 / RP 획득', left + 10, top + 20);

            // 우상단 텍스트
            const 평균픽률퍼센트 = (chart.config._평균픽률 * 100).toFixed(2);
            const 평균RP = chart.config._가중평균RP.toFixed(1);
            const 평균승률퍼센트 = (chart.config._가중평균승률 * 100).toFixed(2);

            ctx.textAlign = 'right';
            ctx.fillText(`평균 픽률: ${평균픽률퍼센트}%`, right - 10, top + 20);
            ctx.fillText(`평균 RP: ${평균RP}`, right - 10, top + 40);
            ctx.fillText(`평균 승률: ${평균승률퍼센트}%`, right - 10, top + 60);

            ctx.restore();
        }
    };

    function createPickRateRPChart(data) {
        const ctx = document.getElementById('pickRateRPChart').getContext('2d');

        const labels = data.map(item => item["실험체"]);
        const 전체표본수 = data.reduce((sum, i) => sum + i["표본수"], 0);
        const pickRates = data.map(item => item["표본수"] / 전체표본수);
        const rpGains = data.map(item => item["RP 획득"]);

        const 평균픽률 = pickRates.reduce((sum, rate) => sum + rate, 0) / pickRates.length;
        const 가중평균RP = data.reduce((acc, item) => acc + item["RP 획득"] * (item["표본수"] / 전체표본수), 0);
        const 가중평균승률 = data.reduce((acc, item) => acc + item["승률"] * (item["표본수"] / 전체표본수), 0);

        Chart.register(labelPlugin, cornerTextPlugin, window['chartjs-plugin-annotation']);

        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: labels,
                datasets: [{
                    data: data.map((item, index) => ({
                        x: pickRates[index],
                        y: rpGains[index],
                        승률: item["승률"]
                    })),
                    backgroundColor: function (context) {
                        const index = context.dataIndex;
                        const totalDataPoints = context.chart.data.datasets[0].data.length;
                        const hue = (index * (360 / totalDataPoints)) % 360;
                        const saturation = 50 + (index % 3) * 15;
                        const lightness = 60 + (index % 2) * 20;
                        return `hsl(${hue}, ${saturation}%, ${lightness}%, 0.8)`;
                    },
                    pointRadius: function (context) {
                        const index = context.dataIndex;
                        const 승률 = data[index]["승률"];
                        const 평균승률 = data.reduce((sum, item) => sum + item["승률"], 0) / data.length;
                        const 기준크기 = 15;
                        const 승률차이 = (승률 - 평균승률) * 100;
                        let 크기 = 기준크기 + 승률차이 * 3.5;
                        return Math.max(크기, 2);
                    },
                    pointHoverRadius: function (context) {
                        const index = context.dataIndex;
                        const 승률 = data[index]["승률"];
                        const 평균승률 = data.reduce((sum, item) => sum + item["승률"], 0) / data.length;
                        const 기준크기 = 15;
                        const 승률차이 = (승률 - 평균승률) * 100;
                        let 크기 = 기준크기 + 승률차이 * 3.5;
                        return Math.max(크기, 2);
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            title: () => '',
                            label: function (context) {
                                const index = context.dataIndex;
                                const dataPoint = context.raw;
                                const label = context.chart.data.labels[index];
                                const 픽률 = (dataPoint.x * 100).toFixed(2);
                                const RP획득 = dataPoint.y;
                                const 승률 = (data[index]["승률"] * 100).toFixed(2);

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
                                value: 평균픽률,
                                label: {
                                    display: false
                                }
                            },
                            {
                                type: 'line',
                                borderColor: '#ffac2b',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                scaleID: 'y',
                                value: 가중평균RP,
                                label: {
                                    display: false
                                }
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
                            text: '픽률'
                        },
                        ticks: {
                            callback: value => (value * 100).toFixed(1) + '%',
                            stepSize: 0.005
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'RP 획득'
                        },
                        ticks: {
                            stepSize: 1
                        },
                        min: Math.floor(Math.min(...rpGains)) - 1,
                        max: Math.ceil(Math.max(...rpGains)) + 1
                    }
                }
            }
        });

        // 평균값 전달 (커스텀 config용)
        myChart.config._평균픽률 = 평균픽률;
        myChart.config._가중평균RP = 가중평균RP;
        myChart.config._가중평균승률 = 가중평균승률;
    }

    function setupGraphPopup() {
        const popup = document.getElementById('image-popup');
        const popupImage = document.getElementById('popup-image');
        const closeButton = document.querySelector('.image-popup-close');
        const graphCanvas = document.getElementById('pickRateRPChart');
        const popupGraphButton = document.getElementById('popup-graph-button');

        if (popupGraphButton && graphCanvas && popup && popupImage && closeButton) {
            popupGraphButton.addEventListener('click', function () {
                html2canvas(graphCanvas, {
                    width: graphCanvas.offsetWidth,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: graphCanvas.offsetWidth,
                    windowHeight: graphCanvas.offsetHeight
                }).then(canvas => {
                    popup.style.display = 'block';
                    popupImage.src = canvas.toDataURL();
                    popupImage.alt = '그래프 이미지';
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
});
