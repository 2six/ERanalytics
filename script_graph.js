document.addEventListener('DOMContentLoaded', function () {
    let myChart;

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            createPickRateRPChart(data);
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
        });

    function createPickRateRPChart(data) {
        const ctx = document.getElementById('pickRateRPChart').getContext('2d');
        const labels = data.map(item => item["실험체"]);
        const pickRates = data.map(item => item["표본수"] / data.reduce((sum, i) => sum + i["표본수"], 0));
        const rpGains = data.map(item => item["RP 획득"]);

        let 가중치합 = 0;
        let 가중픽률합 = 0;
        let 가중RP합 = 0;

        data.forEach(item => {
            가중치합 += item["표본수"];
            가중픽률합 += (item["표본수"] / data.reduce((sum, i) => sum + i["표본수"], 0)) * item["표본수"];
            가중RP합 += item["RP 획득"] * item["표본수"];
        });

        const 가중평균픽률 = 가중픽률합 / 가중치합;
        const 가중평균RP = 가중RP합 / 가중치합;

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

                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = 'white';
                    ctx.strokeText(실험체, x, y);

                    ctx.fillStyle = 'black';
                    ctx.fillText(실험체, x, y);
                });
                ctx.restore();
            }
        };

        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: labels,
                datasets: [{
                    label: '픽률 vs RP 획득',
                    data: data.map((item, index) => ({ x: pickRates[index], y: rpGains[index], 승률: item["승률"] })),
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
                        const 전체승률합 = data.reduce((sum, item) => sum + item["승률"], 0);
                        const 승률평균 = 전체승률합 / data.length;
                        const 기준크기 = 15;
                        const 크기조정비율 = 35;
                        const 최소크기 = 2;

                        const 승률차이 = (승률 - 승률평균) * 100;
                        let 원크기 = 기준크기 + 승률차이 * 크기조정비율 / 10;

                        if (원크기 < 최소크기) {
                            원크기 = 최소크기;
                        }
                        return 원크기;
                    },
                    pointHoverRadius: function (context) {
                        const index = context.dataIndex;
                        const 승률 = data[index]["승률"];
                        const 전체승률합 = data.reduce((sum, item) => sum + item["승률"], 0);
                        const 승률평균 = 전체승률합 / data.length;
                        const 기준크기 = 15;
                        const 크기조정비율 = 35;
                        const 최소크기 = 2;

                        const 승률차이 = (승률 - 승률평균) * 100;
                        let 원크기 = 기준크기 + 승률차이 * 크기조정비율 / 10;

                        if (원크기 < 최소크기) {
                            원크기 = 최소크기;
                        }
                        return 원크기;
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
                        min: Math.min(...rpGains) - 1,
                        max: Math.max(...rpGains) + 1
                    }
                },
                plugins: {
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            title: function () {
                                return '';
                            },
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
                        annotations: [{
                            type: 'line',
                            borderColor: 'yellow',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            xScaleID: 'x',
                            value: 가중평균픽률,
                            label: {
                                enabled: true,
                                content: `가중평균 픽률: ${(가중평균픽률 * 100).toFixed(1)}%`,
                                position: 'top'
                            }
                        }, {
                            type: 'line',
                            borderColor: 'yellow',
                            borderWidth: 2,
                            borderDash: [5, 5],
                            yScaleID: 'y',
                            value: 가중평균RP,
                            label: {
                                enabled: true,
                                content: `가중평균 RP: ${가중평균RP.toFixed(1)}`,
                                position: 'right'
                            }
                        }]
                    }
                },
                plugins: [labelPlugin]
            }
        });
    }
});
