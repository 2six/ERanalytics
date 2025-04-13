document.addEventListener('DOMContentLoaded', function() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            calculateAndDisplayScores(data);
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
            document.getElementById('data-container').innerText = '데이터를 불러오는 데 실패했습니다.';
        });

    function calculateAndDisplayScores(data) {
        const container = document.getElementById('data-container');
        const totalSampleCount = data.reduce((sum, item) => sum + item["표본수"], 0);
        const averagePickRate = totalSampleCount > 0 ? (data.reduce((sum, item) => sum + item["표본수"] / totalSampleCount, 0) / data.length) : 0;

        // 가중 평균 RP 획득, 승률, Top 3 계산
        let weightedSumRP = 0;
        let weightedSumWinRate = 0;
        let weightedSumTop3 = 0;

        data.forEach(item => {
            weightedSumRP += item["RP 획득"] * (item["표본수"] / totalSampleCount);
            weightedSumWinRate += item["승률"] * (item["표본수"] / totalSampleCount);
            weightedSumTop3 += item["TOP 3"] * (item["표본수"] / totalSampleCount);
        });

        const averageRP = weightedSumRP;
        const averageWinRate = weightedSumWinRate;
        const averageTop3 = weightedSumTop3;

        const averageScore = (Math.log(averageRP + 1) * 3) + (averageWinRate * 9) + (averageTop3 * 3);

        const k = 1.5;

        let html = '<table>';
        html += '<thead><tr><th>실험체</th><th>픽률</th><th>점수</th></tr></thead><tbody>';

        data.forEach(item => {
            const pickRate = (item["표본수"] / totalSampleCount);
            const r = pickRate / averagePickRate;

            const 원점반영 = r <= 1/3 ?
                (0.6 + 0.2 * (1 - Math.exp(-k * 3 * r)) / (1 - Math.exp(-k))) :
                (0.8 + 0.2 * (1 - Math.exp(-k * 1.5 * (r - 1/3))) / (1 - Math.exp(-k)));

            const 평균반영 = 1 - 원점반영;

            const 픽률보정계수 = 0.85 + 0.15 * (1 - Math.exp(-k * r)) / (1 - Math.exp(-k));

            let 보정점수;
            if (item["표본수"] < totalSampleCount * averagePickRate) {
                보정점수 = (
                    (Math.log(item["RP 획득"] + 1) * 3) + (item["승률"] * 9) + (item["TOP 3"] * 3)
                ) * (원점반영 + 평균반영 * Math.min(1, pickRate / averagePickRate)) +
                averageScore * 평균반영 * (1 - Math.min(1, pickRate / averagePickRate));
                보정점수 *= 픽률보정계수;
            } else {
                보정점수 = ((Math.log(item["RP 획득"] + 1) * 3) + (item["승률"] * 9) + (item["TOP 3"] * 3)) * 픽률보정계수;
            }

            html += `<tr><td>${item["실험체"]}</td><td>${(pickRate * 100).toFixed(2)}%</td><td>${보정점수.toFixed(2)}</td></tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }
});
