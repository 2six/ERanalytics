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
                maintainAspectRatio: false
            }
        });
    }
});