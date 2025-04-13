document.addEventListener('DOMContentLoaded', function() {
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

        new Chart(ctx, {
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
                        const minPointSize = 5;
                        const maxPointSize = 15;
                
                        if (max승률 === min승률) {
                            return minPointSize; // 모든 승률이 같으면 최소 크기 반환
                        }
                
                        // 승률을 0~1 범위로 정규화
                        const normalized승률 = (승률 - min승률) / (max승률 - min승률);
                
                        // 정규화된 승률을 점 크기 범위에 매핑
                        return minPointSize + normalized승률 * (maxPointSize - minPointSize);
                    },
                    pointHoverRadius: 8
                }]
            },
            options: {
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
                            label: function(context) {
                                const index = context.dataIndex;
                                const 실험체 = data[index]["실험체"];
                                const 픽률 = (context.parsed.x * 100).toFixed(2);
                                const RP획득 = context.parsed.y;
                                const 승률 = (data[index]["승률"] * 100).toFixed(2);
                                return `실험체: ${실험체}<br>픽률: ${픽률}%<br>RP 획득: ${RP획득}<br>승률: ${승률}%`;
                            }
                        }
                    }
                }
            }
        });
    }
});