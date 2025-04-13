document.addEventListener('DOMContentLoaded', function() {
    fetch('data.json') // 데이터 파일 경로
        .then(response => response.json())
        .then(data => {
            displayDataSection1(data.section1);
            displayDataSection2(data.section2);
            displayDataSection3(data.section3);
        })
        .catch(error => {
            console.error('데이터를 불러오는 중 오류 발생:', error);
            document.getElementById('data-container-1').innerText = '데이터를 불러오는 데 실패했습니다.';
            document.getElementById('data-container-2').innerText = '데이터를 불러오는 데 실패했습니다.';
            document.getElementById('data-container-3').innerText = '데이터를 불러오는 데 실패했습니다.';
        });

    function displayDataSection1(data) {
        const container = document.getElementById('data-container-1');
        // 데이터를 HTML 요소로 만들어서 container에 추가하는 로직 (예: 표, 목록 등)
        let html = '<ul>';
        data.forEach(item => {
            html += `<li>${item.name}: ${item.value}</li>`;
        });
        html += '</ul>';
        container.innerHTML = html;
    }

    function displayDataSection2(data) {
        const container = document.getElementById('data-container-2');
        // 데이터를 HTML 요소로 만들어서 container에 추가하는 로직
        let html = '<table><thead><tr><th>이름</th><th>값</th></tr></thead><tbody>';
        data.forEach(item => {
            html += `<tr><td>${item.name}</td><td>${item.value}</td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function displayDataSection3(data) {
        const container = document.getElementById('data-container-3');
        // 데이터를 시각화 라이브러리 (Chart.js, D3.js 등)를 사용하여 차트로 표시하는 로직
        // 예시: Chart.js 사용법 (라이브러리 CDN 링크를 HTML에 추가해야 함)
        const labels = data.map(item => item.name);
        const values = data.map(item => item.value);
        new Chart(container.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '데이터 값',
                    data: values,
                    backgroundColor: 'rgba(54, 162, 235, 0.8)'
                }]
            },
            options: {}
        });
    }
});
