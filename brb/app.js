'use strict';
// BR-B · T10 실측값의 조건부 활용 · author: limheejae
(function () {
  const study = window.BRB_STUDY;
  const byId = (id) => document.getElementById(id);
  const form = byId('experiment-form');
  const sampleForm = byId('value-form');
  if (!form || !sampleForm) return;
  const positions = { absent: '없는 값', first: '첫 번째 값', last: '마지막 값' };
  const sizes = new Set([100, 1000, 10000]);
  const fmt = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });

  function showError(message) {
    byId('try-result').classList.add('error');
    byId('lookup-status').textContent = message;
    byId('lookup-detail').textContent = '정수 형식만 허용합니다. 입력 오류는 연구 수치나 앱 상태에 영향을 주지 않습니다.';
  }

  function getSelectedCase() {
    const n = Number(byId('size-select').value);
    const position = byId('position-select').value;
    if (!sizes.has(n) || !Object.hasOwn(positions, position)) return null;
    if (!study || !Array.isArray(study.cases)) return null;
    return study.cases.find((row) => row.size === n && row.position === position) || null;
  }

  function recommendation(row) {
    if (byId('order-check').checked) {
      return {
        title: '순서가 중요하다면 list가 적합합니다.',
        body: 'set은 리스트의 순서를 대체하지 못합니다. 반복 조회가 병목이라면 list와 보조 set을 함께 두는 방식을 검토할 수 있지만, 생성·유지 비용은 이 논문에서 측정하지 않았습니다.'
      };
    }
    if (row.position === 'first') {
      return {
        title: '첫 원소 조회는 우위가 뚜렷하지 않습니다.',
        body: '실험한 크기에서 list와 set의 중앙값이 근접했습니다. 이 조건만으로 변환을 권하지 않으며 순서, 중복 허용, 갱신 방식을 함께 고려해야 합니다.'
      };
    }
    return {
      title: '반복적인 존재 확인에는 set을 고려하세요.',
      body: '이 실험에서 ' + positions[row.position] + ' 조회는 set의 중앙값이 더 짧았습니다. 순서가 불필요하고 같은 컨테이너를 여러 번 조회한다면 유리할 수 있습니다. 생성시간과 다른 데이터 타입은 별도 측정이 필요합니다.'
    };
  }

  function renderResearch() {
    const row = getSelectedCase();
    if (!row) {
      byId('case-heading').textContent = '실측 자료를 찾을 수 없습니다.';
      byId('recommendation-title').textContent = 'T10 원자료를 확인해 주세요.';
      byId('recommendation-body').textContent = '지원하는 크기는 100·1,000·10,000개이며 부재·첫·마지막 위치만 비교합니다.';
      return false;
    }
    byId('case-heading').textContent = row.size.toLocaleString('ko-KR') + '개 · ' + positions[row.position];
    byId('list-value').textContent = fmt.format(row.list_median_ns);
    byId('set-value').textContent = fmt.format(row.set_median_ns);
    const ratio = row.list_median_ns / row.set_median_ns;
    byId('ratio-value').textContent = ratio >= 1 ? fmt.format(ratio) + '× (list/set)' : fmt.format(1 / ratio) + '× (set/list)';
    const maximum = Math.max(row.list_median_ns, row.set_median_ns);
    byId('list-bar').style.width = Math.max(2, row.list_median_ns / maximum * 100) + '%';
    byId('set-bar').style.width = Math.max(2, row.set_median_ns / maximum * 100) + '%';
    const guide = recommendation(row);
    byId('recommendation-title').textContent = guide.title;
    byId('recommendation-body').textContent = guide.body;
    byId('evidence-note').textContent = study.source_path + ' · ' + study.environment + ' · 각 조건 30블록 · 조회시간 중앙값';
    return true;
  }

  function renderSample() {
    const row = getSelectedCase();
    if (!row) {
      showError('연구 조건을 먼저 선택해 주세요.');
      return;
    }
    const input = byId('value-input');
    const raw = input.value.trim();
    if (!/^-?\d{1,12}$/.test(raw)) {
      input.setAttribute('aria-invalid', 'true');
      showError('정수 1~12자리를 입력해 주세요.');
      return;
    }
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) {
      input.setAttribute('aria-invalid', 'true');
      showError('처리할 수 없는 정수입니다.');
      return;
    }
    input.removeAttribute('aria-invalid');
    byId('try-result').classList.remove('error');
    const found = value >= 0 && value < row.size;
    byId('lookup-status').textContent = '값 ' + value.toLocaleString('ko-KR') + '은(는) ' + (found ? '존재합니다.' : '존재하지 않습니다.');
    let condition = '이번 논문에서 별도 측정하지 않은 조회 위치입니다.';
    if (value === -1) condition = 'T10의 부재(-1) 조회와 같은 입력입니다.';
    else if (value === 0) condition = 'T10의 첫 위치(0) 조회와 같은 입력입니다.';
    else if (value === row.size - 1) condition = 'T10의 마지막 위치(n-1) 조회와 같은 입력입니다.';
    byId('lookup-detail').textContent = '예시 목록: 0부터 ' + (row.size - 1).toLocaleString('ko-KR') + '까지. ' + condition + ' 이 판정은 JavaScript 예시이며 Python 실행시간을 새로 측정한 것이 아닙니다.';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!renderResearch()) return;
    const row = getSelectedCase();
    const example = row.position === 'absent' ? -1 : row.position === 'first' ? 0 : row.size - 1;
    byId('value-input').value = String(example);
    renderSample();
  });
  byId('order-check').addEventListener('change', renderResearch);
  sampleForm.addEventListener('submit', function (event) {
    event.preventDefault();
    renderSample();
  });

  renderResearch();
  renderSample();
})();
