document.addEventListener('DOMContentLoaded', function() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            calculateAndDisplayPickRates(data);
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
            document.getElementById('data-container').innerText = '데이터를 불러오는 데 실패했습니다.';
        });

    function calculateAndDisplayPickRates(data) {
        const container = document.getElementById('data-container');
        const totalSampleCount = data.reduce((sum, item) => sum + item["표본수"], 0);

        let html = '<table>';

        // 테이블 헤더 생성
        if (data.length > 0) {
            html += '<thead><tr>';
            for (const key in data[0]) {
                if (key === "표본수") {
                    html += `<th>픽률</th>`; // 표본수 대신 픽률 헤더 표시
                } else {
                    html += `<th>${key}</th>`;
                }
            }
            html += '</tr></thead>';
        }

        // 테이블 바디 생성
        html += '<tbody>';
        data.forEach(item => {
            html += '<tr>';
            for (const key in item) {
                if (key === "표본수") {
                    const pickRate = (item["표본수"] / totalSampleCount) * 100;
                    html += `<td>${pickRate.toFixed(2)}%</td>`; // 픽률 계산 및 백분율 형식으로 표시
                } else {
                    html += `<td>${item[key]}</td>`;
                }
            }
            html += '</tr>';
        });
        html += '</tbody></table>';

        container.innerHTML = html;
    }
});
