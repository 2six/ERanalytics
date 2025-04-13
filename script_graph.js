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
        const totalSamples = data.reduce((sum, i) => sum + i["표본수"], 0);
        const pickRates = data.map(item => item["표본수"] / totalSamples);
        const rpGains = data.map(item => item["RP 획득"]);

        // 가중 평균 계산
        let weightedPickRateSum = 0;
        let weightedRPSum = 0;

        data.forEach(item => {
            const weight = item["표본수"];
            weightedPickRateSum += (item["표본수"] / totalSamples) * weight;
            weightedRPSum += item["RP 획득"] * weight;
        });

        const weightedAveragePickRate = weightedPickRateSum / totalSamples;
        const weightedAverageRP = weightedRPSum / totalSamples;

        // 실험체 이름 텍스트 플러그인
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

                    // 흰색 테두리
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'white';
                    ctx.strokeText(label, x, y);

                    // 검은색 본문
                    ctx.fillStyle = 'black';
                    ctx.fillText(label, x, y);
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
                    data: data.map((item, index) => ({
                        x: pickRates[index],
                        y: rpGains[index],
                        승률: item["승률"]
                    })),
                    backgroundColor: function (context) {
                        const index = context.dataIndex;
                        const hue = (index * 20) % 360;
                        return `hsl(${hue}, 70%, 60%, 0.8)`;
                    },
                    pointRadius: function (context) {
                        const 승률 = data[context.dataIndex]["승률"];
                        const 평균 = data.reduce((sum, i) => sum + i["승률"], 0) / data.length;
                        const 기준크기 = 15;
                        const 크기 = 기준크기 + (승률 - 평균) * 350;
                        return Math.max(크기, 2);
                    },
                    pointHoverRadius: function (context) {
                        const 승률 = data[context.dataIndex]["승률"];
                        const 평균 = data.reduce((sum, i) => sum + i["승률"], 0) / data.length;
                        const 기준크기 = 15;
                        const 크기 = 기준크기 + (승률 - 평균) * 350;
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
                            callback: value => (value * 100).toFixed(1) + '%'
                        }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'RP 획득'
                        },
                        min: Math.min(...rpGains) - 1,
                        max: Math.max(...rpGains) + 1,
                        ticks: {
                            stepSize: 1
                        }
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
                        annotations: {
                            avgPickRateLine: {
                                type: 'line',
                                xMin: weightedAveragePickRate,
                                xMax: weightedAveragePickRate,
                                borderColor: 'yellow',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: `가중평균 픽률 ${(weightedAveragePickRate * 100).toFixed(1)}%`,
                                    position: 'start'
                                }
                            },
                            avgRPLine: {
                                type: 'line',
                                yMin: weightedAverageRP,
                                yMax: weightedAverageRP,
                                borderColor: 'yellow',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                label: {
                                    display: true,
                                    content: `가중평균 RP ${weightedAverageRP.toFixed(1)}`,
                                    position: 'end'
                                }
                            }
                        }
                    }
                },
                // label plugin 등록
                plugins: [labelPlugin]
            },
            plugins: [Chart.registry.getPlugin('annotation'), labelPlugin]
        });
    }
});
