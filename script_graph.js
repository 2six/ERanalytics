document.addEventListener('DOMContentLoaded', function() {
    let myChart; // Declare a variable to hold the chart instance

    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            createPickRateRPChart(data);
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
            const chartContainer = document.getElementById('pickRateRPChart');
            if (chartContainer) {
                chartContainer.innerText = '데이터를 불러오는 데 실패하여 그래프를 표시할 수 없습니다.';
            }
        });

    function createPickRateRPChart(data) {
        const ctx = document.getElementById('pickRateRPChart').getContext('2d');
        const labels = data.map(item => item["실험체"]);
        const pickRates = data.map(item => item["표본수"] / data.reduce((sum, i) => sum + i["표본수"], 0));
        const rpGains = data.map(item => item["RP 획득"]);

        myChart = new Chart(ctx, { // Assign the chart instance to myChart
            type: 'scatter',
            data: {
                labels: labels,
                datasets: [{
                    label: '픽률 vs RP 획득',
                    data: data.map((item, index) => ({ x: pickRates[index], y: rpGains[index], label: labels[index] })),
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
                        callbacks: {
                            body: function(context) {
                                if (!context || !context[0] || !context[0].dataPoint) {
                                    return [];
                                }
                                const dataPoint = context[0].dataPoint;
                                const index = context[0].dataIndex;
                                const 실험체 = chart.data.labels[index]; // chart 객체 사용
                                const 픽률 = (dataPoint.x * 100).toFixed(2);
                                const RP획득 = dataPoint.y;
                                const 승률 = (chart.data.datasets[0].data[index].승률 * 100).toFixed(2); // chart 객체 사용
                
                                return [
                                    `실험체: ${실험체}`,
                                    `픽률: ${픽률}%`,
                                    `RP 획득: ${RP획득}`,
                                    `승률: ${승률}%`
                                ];
                            },
                            title: function() {
                                return ''; // 타이틀 제거
                            },
                            label: function() {
                                return ''; // 기본 label은 숨김
                            }
                        }
                    }
                },
                // Chart.js v3 이상에서 사용
                afterDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    const data = chart.data.datasets[0].data;
                    const labels = chart.data.labels; // 레이블 배열 직접 접근
                    const meta = chart.getDatasetMeta(0);
                
                    meta.data.forEach((point, index) => {
                        const x = point.x;
                        const y = point.y;
                        const 실험체 = labels[index]; // 레이블 배열에서 실험체 이름 가져오기
                
                        ctx.font = '10px sans-serif';
                        ctx.fillStyle = 'black';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(실험체, x, y);
                    });
                }
                // Chart.js v2에서 사용
                /*
                draw: function(chartInstance) {
                    var ctx = chartInstance.chart.ctx;
                    chartInstance.data.datasets.forEach(function (dataset, i) {
                        var meta = chartInstance.getDatasetMeta(i);
                        meta.data.forEach(function (point, index) {
                            var x = point.getCenterPoint().x;
                            var y = point.getCenterPoint().y;
                            var 실험체 = data[index]["실험체"];

                            ctx.font = '10px sans-serif';
                            ctx.fillStyle = 'black';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(실험체, x, y);
                        });
                    });
                }
                */
            }
        });
    }
});