/* avancados.js — Muskingum (flood routing) + Pump vs. System curve
                  + Pump Library (Feature 3) + Rationing Slider (Feature 6) */

// ══════════════════════════════════════════
// BIBLIOTECA DE BOMBAS PADRÃO — curvas de referência para pré-dimensionamento
// ══════════════════════════════════════════
// Curvas representativas de bombas centrífugas para abastecimento de água.
// Geradas por similaridade hidráulica — NOTA: use apenas para dimensionamento
// preliminar. Consulte o catálogo do fabricante para seleção definitiva.
// Q em m³/h, H em m, NPSHr em m, pot_kw = potência nominal no eixo (kW).
// var (não const) para ser acessível em testes via vm.runInContext
var BOMBAS_PADRAO = [
  {
    id:'cat-a', label:'Cat. A — Pequeno Porte (Q≤50 m³/h · H≤65 m · 11 kW)',
    curva:[{q:0,h:65},{q:10,h:63},{q:20,h:58},{q:30,h:49},{q:40,h:35},{q:48,h:15},{q:50,h:0}],
    NPSHr:2.5, pot_kw:11, Q_bep_m3h:30, H_bep_m:49
  },
  {
    id:'cat-b', label:'Cat. B — Médio Porte (Q≤120 m³/h · H≤80 m · 37 kW)',
    curva:[{q:0,h:80},{q:25,h:78},{q:50,h:73},{q:75,h:63},{q:95,h:48},{q:110,h:28},{q:120,h:0}],
    NPSHr:3.5, pot_kw:37, Q_bep_m3h:75, H_bep_m:63
  },
  {
    id:'cat-c', label:'Cat. C — Grande Porte (Q≤350 m³/h · H≤65 m · 75 kW)',
    curva:[{q:0,h:65},{q:70,h:63},{q:140,h:59},{q:210,h:51},{q:280,h:38},{q:330,h:20},{q:350,h:0}],
    NPSHr:5.0, pot_kw:75, Q_bep_m3h:210, H_bep_m:51
  },
  {
    id:'cat-d', label:'Cat. D — Alta Pressão (Q≤90 m³/h · H≤120 m · 45 kW)',
    curva:[{q:0,h:120},{q:20,h:118},{q:40,h:111},{q:55,h:98},{q:70,h:76},{q:82,h:42},{q:90,h:0}],
    NPSHr:4.0, pot_kw:45, Q_bep_m3h:55, H_bep_m:98
  },
  {
    id:'cat-e', label:'Cat. E — Alta Vazão (Q≤600 m³/h · H≤45 m · 55 kW)',
    curva:[{q:0,h:45},{q:120,h:44},{q:240,h:41},{q:360,h:35},{q:480,h:24},{q:550,h:12},{q:600,h:0}],
    NPSHr:5.5, pot_kw:55, Q_bep_m3h:360, H_bep_m:35
  },
  {
    id:'cat-f', label:'Cat. F — Muito Grande Porte (Q≤1200 m³/h · H≤35 m · 110 kW)',
    curva:[{q:0,h:35},{q:200,h:34},{q:400,h:32},{q:600,h:28},{q:800,h:21},{q:1050,h:10},{q:1200,h:0}],
    NPSHr:7.0, pot_kw:110, Q_bep_m3h:600, H_bep_m:28
  }
];

/**
 * Interpola a curva de uma bomba para um dado Q (m³/h) e retorna H (m).
 * @param {Array<{q:number,h:number}>} curva
 * @param {number} Q - vazão em m³/h
 * @returns {number} altura manométrica em m
 */
function interpBombaCurva(curva, Q) {
  if(Q <= curva[0].q) return curva[0].h;
  if(Q >= curva[curva.length-1].q) return curva[curva.length-1].h;
  for(var i=0; i<curva.length-1; i++){
    if(Q >= curva[i].q && Q <= curva[i+1].q){
      var t = (Q - curva[i].q) / (curva[i+1].q - curva[i].q);
      return curva[i].h + t * (curva[i+1].h - curva[i].h);
    }
  }
  return curva[curva.length-1].h;
}

/**
 * Sugere bombas adequadas para os parâmetros de operação (H_req, Q_req).
 * Retorna array de matches com o desvio relativo de H no ponto Q_req.
 * @param {number} H_req  - Altura manométrica requerida (m)
 * @param {number} Q_req  - Vazão requerida (m³/h)
 * @param {number} [tol]  - Tolerância relativa em H (padrão 0.20 = ±20%)
 * @returns {Array<{bomba:object, H_na_Qreq:number, desvio_pct:number}>}
 */
function sugerirBomba(H_req, Q_req, tol) {
  var tolerancia = (tol !== undefined) ? tol : 0.20;
  var matches = [];
  for(var i=0; i<BOMBAS_PADRAO.length; i++){
    var b = BOMBAS_PADRAO[i];
    var H_na_Q = interpBombaCurva(b.curva, Q_req);
    var desvio = (H_na_Q - H_req) / H_req;
    if(Math.abs(desvio) <= tolerancia){
      matches.push({bomba:b, H_na_Qreq:H_na_Q, desvio_pct:desvio*100});
    }
  }
  matches.sort(function(a,b){return Math.abs(a.desvio_pct)-Math.abs(b.desvio_pct);});
  return matches;
}

/** Sugere bomba automaticamente com base nos dados do módulo de Adução. */
function sugerirBombaAuto(){
  var resultEl=document.getElementById('pump-sugestao');
  if(!resultEl) return;
  var ad=state._aducaoResult;
  if(!ad||!ad.Hman){
    resultEl.innerHTML='<div class="alert alert-info">Execute o módulo de Adução para gerar sugestão automática.</div>';
    return;
  }
  var Q_m3h=ad.Qb*3.6; // L/s → m³/h
  var H_req=ad.Hman;
  var matches=sugerirBomba(H_req,Q_m3h);
  if(!matches.length){
    resultEl.innerHTML='<div class="alert alert-info">Nenhum modelo do catálogo cobre Q='+Q_m3h.toFixed(1)+' m³/h, H='+H_req.toFixed(1)+' m. Consulte fabricante.</div>';
    return;
  }
  var html='<div class="alert alert-info" style="font-size:12px;font-family:var(--mono);margin-bottom:8px;">Sugestão para Q='+Q_m3h.toFixed(1)+' m³/h, H='+H_req.toFixed(1)+' m (Hman da adução):</div>'
    +'<div style="display:flex;flex-direction:column;gap:6px;">';
  matches.forEach(function(m){
    var sinal=m.desvio_pct>=0?'+':'';
    var cls=Math.abs(m.desvio_pct)<10?'btn-primary':'btn';
    html+='<button class="btn btn-sm '+cls+'" onclick="carregarBombaModelo(\''+m.bomba.id+'\')">'
      +m.bomba.label+' — H@Q='+m.H_na_Qreq.toFixed(1)+'m ('+sinal+m.desvio_pct.toFixed(1)+'%) · NPSHr='+m.bomba.NPSHr+'m'
      +'</button>';
  });
  html+='</div>';
  resultEl.innerHTML=html;
}

/** Carrega a curva de um modelo da biblioteca no campo pump-curve. */
function carregarBombaModelo(id){
  var bomba=BOMBAS_PADRAO.find(function(b){return b.id===id;});
  if(!bomba) return;
  var textarea=document.getElementById('pump-curve');
  if(textarea) textarea.value=bomba.curva.map(function(p){return p.q+';'+p.h;}).join('\n');
  // Preenche parâmetros do sistema a partir da adução
  var ad=state._aducaoResult;
  if(ad){
    var fields={
      'pump-Hman':ad.Hman?ad.Hman.toFixed(1):null,
      'pump-L':ad.L||null,
      'pump-D':ad.DN||null
    };
    Object.keys(fields).forEach(function(id){
      var el=document.getElementById(id);
      if(el&&fields[id]!==null) el.value=fields[id];
    });
  }
  // NPSH check
  var npshEl=document.getElementById('pump-npsh-result');
  if(npshEl){
    npshEl.innerHTML='<div style="margin-top:6px;font-size:11px;font-family:var(--mono);color:var(--text3);">NPSHr do modelo: <strong>'+bomba.NPSHr+' m</strong> — verifique se NPSH disponível (módulo Adução) &gt; '+bomba.NPSHr+' m</div>';
  }
  addAudit('Bomba selecionada: '+bomba.label);
}

// ══════════════════════════════════════════
// SIMULAÇÃO DE RACIONAMENTO — Resiliência Hídrica
// ══════════════════════════════════════════
/** Recalcula o tempo de esvaziamento do reservatório para o percentual de vazão selecionado. */
function calcRacionamento(){
  var pctEl=document.getElementById('rac-pct');
  var lblEl=document.getElementById('rac-pct-label');
  var resultEl=document.getElementById('rac-result');
  if(!pctEl||!resultEl) return;
  var pct=+(pctEl.value)/100;
  if(lblEl) lblEl.textContent=Math.round(pct*100)+'%';
  var ad=state._aducaoResult;
  if(!ad||!ad.V_total){
    resultEl.innerHTML='<div class="alert alert-info">Execute o módulo de Adução para habilitar a simulação de racionamento.</div>';
    return;
  }
  var Q_captacao_ls=ad.Qmed*pct;
  var Q_consumo_ls=ad.QK1;
  var T_h=calcTempoEsvaziamento(ad.V_total,Q_captacao_ls,Q_consumo_ls);
  var cls=T_h===Infinity?'alert-success':T_h>=24?'alert-success':T_h>=12?'alert-warning':'alert-danger';
  var icone=T_h===Infinity?'✅':T_h>=24?'✅':T_h>=12?'⚠️':'🚨';
  var suficiente=T_h===Infinity?'Sistema equilibrado — captação supre demanda'
    :T_h>=24?'Suficiente (≥ 24h de autonomia)'
    :T_h>=12?'Atenção (12–24h — monitorar manancial)'
    :'Insuficiente (< 12h — acionar plano de contingência)';
  var T_text=T_h===Infinity?'indefinido (captação ≥ consumo)':(T_h.toFixed(1)+' horas');
  resultEl.innerHTML=`<div class="alert ${cls}" style="font-family:var(--mono);font-size:12px;">
    ${icone} Com <strong>${Math.round(pct*100)}%</strong> da vazão normal (${Q_captacao_ls.toFixed(1)} L/s captado) e consumo máximo K1 (${Q_consumo_ls.toFixed(1)} L/s), o reservatório de <strong>${ad.V_total.toLocaleString('pt-BR')} m³</strong> garante <strong>${T_text}</strong> de abastecimento sem nova captação.<br>
    <strong>${suficiente}</strong>
    </div>
    <div class="hyd-formula" style="margin-top:6px;font-size:10px;">
      T = V × 1000 / ((Q_consumo − Q_captacao) × 3600) = ${ad.V_total.toLocaleString('pt-BR')} × 1000 / ((${Q_consumo_ls.toFixed(1)} − ${Q_captacao_ls.toFixed(1)}) × 3600)${T_h!==Infinity?' = '+T_h.toFixed(1)+' h':' → sem déficit (T = ∞)'}
    </div>`;
}

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
  // Stability conditions: C0 ≥ 0 requires Δt ≥ 2KX; C2 ≥ 0 requires 2K(1−X) ≥ Δt
  if (dt < 2 * K * X) {
    resultEl.innerHTML = '<div class="alert alert-warning">⚠ Instabilidade numérica: Δt (' + dt + 'h) &lt; 2KX (' + (2*K*X).toFixed(2) + 'h) — C0 negativo. Aumente Δt ou reduza K ou X.</div>';
    return;
  }
  if (2 * K * (1 - X) < dt) {
    resultEl.innerHTML = '<div class="alert alert-warning">⚠ Instabilidade numérica: 2K(1−X) (' + (2*K*(1-X)).toFixed(2) + 'h) &lt; Δt (' + dt + 'h) — C2 negativo. Reduza Δt ou aumente K.</div>';
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
   hf via Hazen-Williams: hf = 10.643 · L · Q^1.852 / (C^1.852 · D^4.87)
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
    var hf = 10.643 * L * Math.pow(Q_m3s, 1.852) / (Math.pow(C, 1.852) * Math.pow(D_m, 4.87));
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
