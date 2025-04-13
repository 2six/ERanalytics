document.addEventListener('DOMContentLoaded', function() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            createBasicChart(data);
        })
        .catch(error => {
            console.error('Error loading data.json:', error);
            const chartContainer = document.getElementById('pickRateRPChart');
            if (chartContainer) {
                chartContainer.innerText = 'Failed to load data for the chart.';
            }
        });

    function createBasicChart(data) {
        const ctx = document.getElementById('pickRateRPChart').getContext('2d');
        const labels = data.map(item => item["실험체"]);
        const pickRates = data.map(item => item["표본수"] / data.reduce((sum, i) => sum + i["표본수"], 0));
        const rpGains = data.map(item => item["RP 획득"]);

        new Chart(ctx, {
            type: 'scatter',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Pick Rate vs RP Gain',
                    data: data.map((item, index) => ({ x: pickRates[index], y: rpGains[index] })),
                    backgroundColor: 'rgba(54, 162, 235, 0.8)',
                    pointRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            body: function(context) {
                                if (!context || !context[0] || !context[0].dataPoint) {
                                    return [];
                                }
                                const dataPoint = context[0].dataPoint;
                                const index = context[0].dataIndex;
                                const 실험체 = chart.data.labels[index];
                                const 픽률 = (dataPoint.x * 100).toFixed(2);
                                const RP획득 = dataPoint.y;
                                const 승률 = (chart.data.datasets[0].data[index].승률 * 100).toFixed(2);
            
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
                }
            }
        });
    }
});