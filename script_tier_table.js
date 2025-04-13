document.addEventListener('DOMContentLoaded', function() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            const tierGroups = {};

            data.forEach(item => {
                const tier = item["티어"];
                if (!tierGroups[tier]) {
                    tierGroups[tier] = [];
                }
                tierGroups[tier].push(item["실험체"]);
            });

            const container = document.getElementById('tier-table-container');
            let html = '';

            for (const tier in tierGroups) {
                html += `<h2>${tier} 티어</h2><table><tr>`;
                tierGroups[tier].forEach((experiment) => {
                    // 이미지 파일 이름 변환 로직
                    const imageName = convertExperimentNameToImageName(experiment);
                    html += `<td><img src="image/${imageName}.png" alt="${experiment}" width="100"></td>`;
                });
                html += '</tr></table>';
            }

            container.innerHTML = html;
        })
        .catch(error => {
            console.error('data.json 파일을 불러오는 중 오류 발생:', error);
            document.getElementById('tier-table-container').innerText = '데이터를 불러오는 데 실패했습니다.';
        });

    // 실험체 이름 -> 이미지 파일 이름 변환 함수
    function convertExperimentNameToImageName(experimentName) {
        // "저격총 버니스" -> "버니스-저격총"
        if (experimentName.includes(" ")) {
            const parts = experimentName.split(" ");
            if (parts.length >= 2) {
                return `${parts[1]}-${parts[0]}`;
            }
        }
        // 다른 변환 규칙이 필요하다면 여기에 추가
        return experimentName; // 기본적으로는 그대로 반환
    }
});