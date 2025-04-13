document.addEventListener('DOMContentLoaded', function() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            displayExperimentStats(data); // 수정됨: 제공해주신 JSON 구조에 맞는 함수 호출
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
            document.getElementById('data-container').innerText = '데이터를 불러오는 데 실패했습니다.'; // 수정됨: 오류 메시지 표시 위치
        });

    function displayExperimentStats(data) {
        const container = document.getElementById('data-container'); // 수정됨: 데이터를 표시할 컨테이너
        let html = '<table>';

        // 테이블 헤더 생성
        if (data.length > 0) {
            html += '<thead><tr>';
            for (const key in data[0]) {
                html += `<th>${key}</th>`;
            }
            html += '</tr></thead>';
        }

        // 테이블 바디 생성
        html += '<tbody>';
        data.forEach(item => {
            html += '<tr>';
            for (const key in item) {
                html += `<td>${item[key]}</td>`;
            }
            html += '</tr>';
        });
        html += '</tbody></table>';

        container.innerHTML = html;
    }
});
