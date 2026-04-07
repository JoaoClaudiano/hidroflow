/* avancados.js — Muskingum (flood routing) + Pump vs. System curve */

/* ─────────────────────────────────────────────
   MUSKINGUM — propagação de cheias
   Q_s(t+1) = C0·Q_e(t+1) + C1·Q_e(t) + C2·Q_s(t)
   C0 = (Δt - 2KX) / (2K(1-X) + Δt)
   C1 = (Δt + 2KX) / (2K(1-X) + Δt)
   C2 = (2K(1-X) - Δt) / (2K(1-X) + Δt)
   ───────────────────────────────────────────── */
function calcMuskingum() {
  var K   = parseFloat(document.getElementById('musk-K').value);
  var X   = parseFloat(document.getElementById('musk-X').value);
  var dt  = parseFloat(document.getElementById('musk-dt').value);
  var Q0s = parseFloat(document.getElementById('musk-Q0').value);
  var raw = document.getElementById('musk-inflow').value.trim().split('\n');
  var Qe  = raw.map(function(v){ return parseFloat(v.trim()); }).filter(function(v){ return !isNaN(v); });

  var resultEl = document.getElementById('musk-result');
  if (!K || !dt || Qe.length < 2) {
    resultEl.innerHTML = '<div class="alert alert-info">Preencha K, Δt e pelo menos 2 valores de Q entrada.</div>';
    return;
  }
  if (X < 0 || X > 0.5) {
    resultEl.innerHTML = '<div class="alert alert-info">X deve estar entre 0 e 0,5.</div>';
    return;
  }

  var denom = 2 * K * (1 - X) + dt;
  var C0 = (dt - 2 * K * X) / denom;
  var C1 = (dt + 2 * K * X) / denom;
  var C2 = (2 * K * (1 - X) - dt) / denom;

  var Qs = [Q0s];
  for (var i = 0; i < Qe.length - 1; i++) {
    var next = C0 * Qe[i + 1] + C1 * Qe[i] + C2 * Qs[i];
    Qs.push(Math.max(0, next));
  }

  var Qe_max   = Math.max.apply(null, Qe);
  var Qs_max   = Math.max.apply(null, Qs);
  var atten    = ((Qe_max - Qs_max) / Qe_max * 100).toFixed(1);
  var peak_e   = Qe.indexOf(Qe_max);
  var peak_s   = Qs.indexOf(Qs_max);
  var lag      = ((peak_s - peak_e) * dt).toFixed(1);

  resultEl.innerHTML =
    '<div class="alert alert-info" style="font-size:12px;font-family:var(--mono);">' +
    'C0 = ' + C0.toFixed(4) + ' &nbsp;|&nbsp; C1 = ' + C1.toFixed(4) + ' &nbsp;|&nbsp; C2 = ' + C2.toFixed(4) + '<br>' +
    'Q pico entrada: <strong>' + Qe_max.toFixed(1) + ' m³/s</strong> &nbsp;|&nbsp; ' +
    'Q pico saída: <strong>' + Qs_max.toFixed(2) + ' m³/s</strong><br>' +
    'Atenuação: <strong>' + atten + '%</strong> &nbsp;|&nbsp; Defasagem: <strong>' + lag + ' h</strong>' +
    '</div>';

  var labels = Qe.map(function(_, i){ return 't' + (i * dt) + 'h'; });
  if (state.charts.musk) state.charts.musk.destroy();
  state.charts.musk = new Chart(document.getElementById('chart-musk'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        { label: 'Q entrada (m³/s)', data: Qe, borderColor: '#4f7ef5', borderWidth: 2, pointRadius: 3, fill: false, tension: 0.2 },
        { label: 'Q saída Muskingum (m³/s)', data: Qs, borderColor: '#e24b4a', borderWidth: 2, pointRadius: 3, fill: false, tension: 0.2 }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' }, title: { display: true, text: 'Hidrogramas — Muskingum' } },
      scales: { y: { title: { display: true, text: 'Q (m³/s)' } }, x: { title: { display: true, text: 'Tempo' } } }
    }
  });
}

/* ─────────────────────────────────────────────
   CURVA SISTEMA vs. BOMBA
   H_sis(Q) = Hman + hf(Q) + hloc
   hf via Hazen-Williams: hf = 10.67 · L · Q^1.852 / (C^1.852 · D^4.87)
     Q em m³/s, D em m
   Curva bomba: interpolação cúbica (spline natural simplificada — Lagrange nos N pontos fornecidos)
   Ponto de operação: bissecção em H_bomba(Q) - H_sis(Q) = 0
   ───────────────────────────────────────────── */
function calcPumpCurve() {
  var Hman  = parseFloat(document.getElementById('pump-Hman').value);
  var L     = parseFloat(document.getElementById('pump-L').value);
  var Dmm   = parseFloat(document.getElementById('pump-D').value);
  var C     = parseFloat(document.getElementById('pump-C').value);
  var hloc  = parseFloat(document.getElementById('pump-hloc').value) || 0;
  var rawCurve = document.getElementById('pump-curve').value.trim().split('\n');

  var resultEl = document.getElementById('pump-result');

  var pumpPts = [];
  for (var i = 0; i < rawCurve.length; i++) {
    var parts = rawCurve[i].trim().split(/[;,\t ]+/);
    if (parts.length < 2) continue;
    var q = parseFloat(parts[0]);
    var h = parseFloat(parts[1]);
    if (!isNaN(q) && !isNaN(h)) pumpPts.push({ q: q, h: h });
  }
  pumpPts.sort(function(a, b){ return a.q - b.q; });

  if (pumpPts.length < 2) {
    resultEl.innerHTML = '<div class="alert alert-info">Informe pelo menos 2 pares Q;H para a curva da bomba.</div>';
    return;
  }
  if ([Hman, L, Dmm, C].some(isNaN) || Dmm <= 0 || C <= 0 || L <= 0) {
    resultEl.innerHTML = '<div class="alert alert-info">Preencha todos os parâmetros do sistema.</div>';
    return;
  }

  var D_m = Dmm / 1000;

  // H_sis(Q) — Q em m³/h → converter para m³/s internamente
  function H_sis(Q_m3h) {
    var Q_m3s = Q_m3h / 3600;
    var hf = 10.67 * L * Math.pow(Q_m3s, 1.852) / (Math.pow(C, 1.852) * Math.pow(D_m, 4.87));
    return Hman + hf + hloc;
  }

  // H_bomba(Q) — interpolação linear por partes (entre pontos tabelados)
  function H_pump(Q) {
    if (Q <= pumpPts[0].q) return pumpPts[0].h;
    if (Q >= pumpPts[pumpPts.length - 1].q) return pumpPts[pumpPts.length - 1].h;
    for (var j = 0; j < pumpPts.length - 1; j++) {
      if (Q >= pumpPts[j].q && Q <= pumpPts[j + 1].q) {
        var t = (Q - pumpPts[j].q) / (pumpPts[j + 1].q - pumpPts[j].q);
        return pumpPts[j].h + t * (pumpPts[j + 1].h - pumpPts[j].h);
      }
    }
    return pumpPts[pumpPts.length - 1].h;
  }

  // Bissecção para encontrar interseção H_pump(Q) = H_sis(Q)
  var Q_max_pump = pumpPts[pumpPts.length - 1].q;
  var f = function(Q){ return H_pump(Q) - H_sis(Q); };
  var a = 0, b = Q_max_pump;
  var Q_op = null;
  if (f(a) * f(b) > 0) {
    // Procura um zero dentro do intervalo
    var found = false;
    for (var k = 1; k <= 200; k++) {
      var qa = Q_max_pump * k / 200;
      var qb = Q_max_pump * (k + 1) / 200;
      if (f(qa) * f(qb) <= 0) { a = qa; b = qb; found = true; break; }
    }
    if (!found) {
      resultEl.innerHTML = '<div class="alert alert-info">Sem interseção no intervalo da curva da bomba. Verifique os parâmetros.</div>';
      return;
    }
  }
  for (var iter = 0; iter < 60; iter++) {
    var mid = (a + b) / 2;
    if (f(a) * f(mid) <= 0) b = mid; else a = mid;
    if (b - a < 1e-6) break;
  }
  Q_op = (a + b) / 2;
  var H_op = H_pump(Q_op);

  resultEl.innerHTML =
    '<div class="alert alert-info" style="font-size:12px;font-family:var(--mono);">' +
    '⚙ Ponto de operação: <strong>Q = ' + Q_op.toFixed(2) + ' m³/h</strong> &nbsp;|&nbsp; ' +
    '<strong>H = ' + H_op.toFixed(2) + ' m</strong><br>' +
    'Vazão: ' + (Q_op / 3.6).toFixed(2) + ' L/s &nbsp;|&nbsp; ' +
    (Q_op / 60).toFixed(3) + ' m³/min' +
    '</div>';

  // Gera pontos para os gráficos
  var N = 120;
  var qArr = [], hSisArr = [], hPumpArr = [];
  for (var n = 0; n <= N; n++) {
    var qv = Q_max_pump * n / N;
    qArr.push(qv.toFixed(2));
    hSisArr.push(H_sis(qv).toFixed(3));
    hPumpArr.push(H_pump(qv).toFixed(3));
  }

  if (state.charts.pump) state.charts.pump.destroy();
  state.charts.pump = new Chart(document.getElementById('chart-pump'), {
    type: 'line',
    data: {
      labels: qArr,
      datasets: [
        { label: 'Curva da Bomba (m)', data: hPumpArr, borderColor: '#4f7ef5', borderWidth: 2.5, pointRadius: 0, fill: false, tension: 0.3 },
        { label: 'Curva do Sistema (m)', data: hSisArr, borderColor: '#e24b4a', borderWidth: 2.5, pointRadius: 0, fill: false, tension: 0.3 },
        { label: 'Ponto de Operação', data: qArr.map(function(q, i){
            var diff = Math.abs(parseFloat(q) - Q_op);
            return diff < Q_max_pump / N * 1.5 ? H_op.toFixed(3) : null;
          }),
          borderColor: '#1D9E75', backgroundColor: '#1D9E75',
          pointRadius: qArr.map(function(q){ return Math.abs(parseFloat(q) - Q_op) < Q_max_pump / N * 1.5 ? 8 : 0; }),
          type: 'scatter', showLine: false }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'top' }, title: { display: true, text: 'Curva da Bomba × Curva do Sistema' } },
      scales: {
        y: { title: { display: true, text: 'H (m)' } },
        x: { title: { display: true, text: 'Q (m³/h)' }, ticks: { maxTicksLimit: 10 } }
      }
    }
  });
}
