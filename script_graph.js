document.addEventListener('DOMContentLoaded', function () {
    let myChart;

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            createPickRateRPChart(data);
            setupGraphPopup(); // 그래프 생성 후 팝업 기능 연결
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
        });

    // 원 위에 실험체 이름 표시 플러그인
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

    function createPickRateRPChart(data) {
        const ctx = document.getElementById('pickRateRPChart').getContext('2d');

        const labels = data.map(item => item["실험체"]);
        const 전체표본수 = data.reduce((sum, i) => sum + i["표본수"], 0);
        const pickRates = data.map(item => item["표본수"] / 전체표본수);
        const rpGains = data.map(item => item["RP 획득"]);
        const 승률List = data.map(item => item["승률"]);

        // 가중 평균 픽률 계산
        const 가중평균픽률 = data.reduce((acc, item) => acc + (item["표본수"] / 전체표본수) * (item["표본수"] / 전체표본수), 0);

        // 가중 평균 RP 획득
        const 가중평균RP = data.reduce((acc, item) => acc + item["RP 획득"] * (item["표본수"] / 전체표본수), 0);

        // 평균 승률 (단순 평균)
        const 평균승률 = 승률List.reduce((sum, rate) => sum + rate, 0) / 승률List.length;

        Chart.register(labelPlugin, window['chartjs-plugin-annotation']);

        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: labels,
                datasets: [{
                    label: '실험체 데이터', // 툴팁에 사용될 데이터셋 라벨 (숨길 예정)
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
                        const 평균승률 = 승률List.reduce((sum, item) => sum + item, 0) / 승률List.length;
                        const 기준크기 = 15;
                        const 승률차이 = (승률 - 평균승률) * 100;
                        let 크기 = 기준크기 + 승률차이 * 3.5;
                        return Math.max(크기, 2);
                    },
                    pointHoverRadius: function (context) {
                        const index = context.dataIndex;
                        const 승률 = data[index]["승률"];
                        const 평균승률 = 승률List.reduce((sum, item) => sum + item, 0) / 승률List.length;
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
                    legend: {
                        display: false // 기존 라벨 (픽률 vs RP 획득) 숨기기
                    },
                    title: {
                        display: true,
                        text: '픽률 / RP 획득', // 좌상단 텍스트
                        align: 'start',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: {
                            top: 10,
                            bottom: 10
                        }
                    },
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
                                value: 가중평균픽률,
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
                            },
                            {
                                type: 'label',
                                position: 'top-end',
                                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                borderColor: 'rgba(0, 0, 0, 0.8)',
                                borderWidth: 1,
                                borderRadius: 5,
                                color: 'black',
                                padding: 5,
                                text: [
                                    `평균 픽률: ${(가중평균픽률 * 100).toFixed(2)}%`,
                                    `평균 RP: ${가중평균RP.toFixed(2)}`,
                                    `평균 승률: ${(평균승률 * 100).toFixed(2)}%`
                                ],
                                font: {
                                    size: 12
                                },
                                textAlign: 'right',
                                xPadding: 10,
                                yPadding: 10,
                                x: 'chartArea.right', // 명시적으로 x 좌표 설정
                                y: 'chartArea.top'    // 명시적으로 y 좌표 설정
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