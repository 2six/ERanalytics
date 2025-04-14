function exportChartToImage() {
    const chartCanvas = document.getElementById('pickRateRPChart');
    if (!chartCanvas) {
        console.error('캔버스 요소를 찾을 수 없습니다.');
        return;
    }

    const imageDataURL = chartCanvas.toDataURL('image/png'); // PNG 형식으로 이미지 데이터 URL 생성

    const newWindow = window.open('', '_blank'); // 새 창 열기

    if (newWindow) {
        newWindow.document.write('<img src="' + imageDataURL + '"/>'); // 새 창에 이미지 표시
    } else {
        alert('팝업 차단 기능이 활성화되어 있어 새 창을 열 수 없습니다.');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const exportButton = document.createElement('button');
    exportButton.textContent = '이미지로 내보내기';
    exportButton.addEventListener('click', exportChartToImage);
    document.body.appendChild(exportButton); // 버튼을 body에 추가 (원하는 위치에 추가하세요)

    let myChart;

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            createPickRateRPChart(data);
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

        // 평균 픽률 (단순 평균)
        const 평균픽률 = pickRates.reduce((sum, rate) => sum + rate, 0) / pickRates.length;

        // 가중평균 RP 획득
        const 가중평균RP = data.reduce((acc, item) => acc + item["RP 획득"] * (item["표본수"] / 전체표본수), 0);

        Chart.register(labelPlugin, window['chartjs-plugin-annotation']);

        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: labels,
                datasets: [{
                    label: '픽률 vs RP 획득',
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
                            stepSize: 0.002
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
                },
                plugins: {
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
                }
            }
        });
    }
});
