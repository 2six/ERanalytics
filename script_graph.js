document.addEventListener('DOMContentLoaded', function() {
    let myChart; // Declare a variable to hold the chart instance

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            createPickRateRPChart(data);
        })
        .catch(error => {
            console.error('Error loading data.json:', error);
            const chartContainer = document.getElementById('pickRateRPChart');
            if (chartContainer) {
                chartContainer.innerText = 'Failed to load data for the chart.';
            }
        });

    function createPickRateRPChart(data) {
        const ctx = document.getElementById('pickRateRPChart').getContext('2d');
        const labels = data.map(item => item["실험체"]);
        const pickRates = data.map(item => item["표본수"] / data.reduce((sum, i) => sum + i["표본수"], 0));
        const rpGains = data.map(item => item["RP 획득"]);

        myChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pick Rate vs RP Gain',
                    data: data.map((item, index) => ({ x: pickRates[index], y: rpGains[index], 승률: item["승률"] })), // 승률 데이터 포함
                    backgroundColor: function(context) {
                        const index = context.dataIndex;
                        const colors = ['rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)', 'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)'];
                        return colors[index % colors.length];
                    },
                    pointRadius: function(context) {
                        const index = context.dataIndex;
                        const 승률 = data[index]["승률"];
                        const min승률 = Math.min(...data.map(item => item["승률"]));
                        const max승률 = Math.max(...data.map(item => item["승률"]));
                        const minPointSize = 10;
                        const maxPointSize = 25;

                        if (max승률 === min승률) {
                            return minPointSize;
                        }

                        const normalized승률 = (승률 - min승률) / (max승률 - min승률);
                        return minPointSize + normalized승률 * (maxPointSize - minPointSize);
                    },
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'nearest',
                    intersect: true,
                    axis: 'xy'
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
                            format: {
                                style: 'percent'
                            },
                            stepSize: 0.005
                        },
                        minor: {
                            display: true,
                            grid: {
                                drawTicks: true
                            },
                            ticks: {
                                stepSize: 0.0025
                            }
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
                            stepSize: 5
                        },
                        minor: {
                            display: true,
                            grid: {
                                drawTicks: true
                            },
                            ticks: {
                                stepSize: 1
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            body: function(context) {
                                if (!context || !context[0] || !context[0].dataPoint) {
                                    return [];
                                }
                                const dataPoint = context[0].dataPoint;
                                const index = context[0].dataIndex;
                                const 실험체 = myChart.data.labels[index];
                                const 픽률 = (dataPoint.x * 100).toFixed(2);
                                const RP획득 = dataPoint.y;
                                const 승률 = (myChart.data.datasets[0].data[index].승률 * 100).toFixed(2);

                                return [
                                    `실험체: ${실험체}`,
                                    `픽률: ${픽률}%`,
                                    `RP 획득: ${RP획득}`,
                                    `승률: ${승률}%`
                                ];
                            },
                            title: function() {
                                return '';
                            },
                            label: function() {
                                return '';
                            }
                        }
                    }
                },
                afterRender: chart => {
                    chart.update(); // 렌더링 후 업데이트
                }
            }
        });
    }
});