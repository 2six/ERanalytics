document.addEventListener('DOMContentLoaded', function() {
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
        const minRP = Math.min(...rpGains);
        const maxRP = Math.max(...rpGains);

        // 그래프를 조금 더 보기 좋게 만들기 위해 여유값 설정
        const yMin = Math.floor(minRP - 1);
        const yMax = Math.ceil(maxRP + 1);

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
        
                    // 흰색 테두리 추가
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = 'white';
                    ctx.strokeText(실험체, x, y);
        
                    // 글씨 본체
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
                    data: data.map((item, index) => ({
                        x: pickRates[index],
                        y: rpGains[index],
                        label: labels[index],
                        승률: item["승률"]
                    })),
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

                        if (max승률 === min승률) return minPointSize;

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
                        min: yMin,
                        max: yMax,
                        ticks: {
                            stepSize: 1
                        }
                    }                    
                },
                tooltip: {
                    callbacks: {
                        title: () => '', // 타이틀 제거
                        label: (context) => {
                            const index = context.dataIndex;
                            const dataPoint = context.raw;
                            const label = context.chart.data.labels[index];
                
                            const 픽률 = (dataPoint.x * 100).toFixed(2);
                            const RP획득 = dataPoint.y;
                            const 승률 = (data[index]["승률"] * 100).toFixed(2);
                
                            return [
                                `실험체: ${label}`,
                                `픽률: ${픽률}%`,
                                `RP 획득: ${RP획득}`,
                                `승률: ${승률}%`
                            ];
                        }
                    }
                }
                       
            },
            plugins: [labelPlugin]
        });
    }
});
