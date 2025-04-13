function createPickRateRPChart(data) {
    const ctx = document.getElementById('pickRateRPChart').getContext('2d');
    const labels = data.map(item => item["실험체"]);
    const pickRates = data.map(item => item["표본수"] / data.reduce((sum, i) => sum + i["표본수"], 0)); // 픽률 계산
    const rpGains = data.map(item => item["RP 획득"]);

    new Chart(ctx, {
        type: 'scatter',
        data: {
            labels: labels,
            datasets: [{
                label: '픽률 vs RP 획득',
                data: data.map((item, index) => ({ x: pickRates[index], y: rpGains[index], label: labels[index] })),
                backgroundColor: 'rgba(54, 162, 235, 0.8)',
                pointRadius: 5,
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
                },
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: (픽률: ${(context.parsed.x * 100).toFixed(2)}%, RP: ${context.parsed.y})`;
                        }
                    }
                }
            }
        });
    }
}