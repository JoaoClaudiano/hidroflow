// ══════════════════════════════════════════
// PROJEÇÃO + ENVELOPE
// ══════════════════════════════════════════
function projectModel(modelo,anos,d){
  if(modelo==='aritmetico')return anos.map(a=>Math.round(state.coefs.b_arit+state.coefs.ka*a));
  if(modelo==='geometrico')return anos.map(a=>Math.round(Math.exp(state.coefs.a_geo+state.coefs.b_geo*a)));
  if(modelo==='logistico')return anos.map(a=>Math.round(state.coefs.K/(1+((state.coefs.K-state.coefs.P0)/state.coefs.P0)*Math.exp(-state.coefs.k_log*(a-d[0].ano)))));
  if(modelo==='holt'){const{L,T}=state.coefs.holt;const lastAno=d[d.length-1].ano;return anos.map(a=>Math.max(0,holtProject(L,T,lastAno,a)));}
  return[];
}

function projetarEEnvelope(){
  if(!state.censosRaw){alert('Calcule o Best Fit primeiro.');return;}
  const d=state.censosRaw;
  const horizonte=+document.getElementById('ano-horizonte').value;
  const sel=document.getElementById('modelo-sel').value;
  const modelo=sel==='auto'?state.bestModel:sel;
  const pess=+document.getElementById('env-pess').value/100;
  const prov=+document.getElementById('env-prov').value/100;
  const otim=+document.getElementById('env-otim').value/100;
  const anos=[];for(let a=d[0].ano;a<=horizonte;a++)anos.push(a);
  const proj=projectModel(modelo,anos,d);
  state.projData=anos.map((a,i)=>({ano:a,pop:proj[i]}));
  const aBase=d[d.length-1].ano,pBase=d[d.length-1].pop;
  const anosEnv=anos.filter(a=>a>=aBase);
  const pP=anosEnv.map(a=>Math.round(pBase*Math.pow(1+pess,a-aBase)));
  const pO=anosEnv.map(a=>Math.round(pBase*Math.pow(1+otim,a-aBase)));
  const anoAtual=new Date().getFullYear();
  const idxAtual=anos.indexOf(anoAtual)>=0?anos.indexOf(anoAtual):anos.length-1;
  const popAtual=proj[idxAtual],popH=proj[proj.length-1];

  const rmseModel=state.rmse&&state.rmse[modelo]?state.rmse[modelo]:0;
  const dtH=horizonte-aBase;
  const ciH=calcCI(popH,rmseModel,dtH);
  const ciAtual=calcCI(popAtual,rmseModel,Math.max(0,anoAtual-aBase));

  const spanHistorico=d[d.length-1].ano-d[0].ano;
  const extrapRatio=dtH/Math.max(1,spanHistorico);
  const extrapWarnEl=document.getElementById('extrap-warning');
  if(extrapRatio>1){
    extrapWarnEl.style.display='flex';
    extrapWarnEl.innerHTML=`<div class="extrap-warn">⚠️ Extrapolação de ${dtH} anos além do último censo — ${extrapRatio.toFixed(1)}× a série histórica (${spanHistorico} anos). Incerteza elevada. Avaliação de confiabilidade: ${dtH<=15?'Moderada':dtH<=25?'Baixa':'Muito baixa'}.</div>`;
  } else {
    extrapWarnEl.style.display='none';
  }

  document.getElementById('ci-summary').innerHTML=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 14px;font-size:12px;font-family:var(--mono);">
    <span style="font-weight:600;color:var(--text);">Intervalo de confiança 95% (RMSE do ajuste × crescimento temporal)</span><br>
    <span style="color:var(--text3);">Pop. ${horizonte}: </span><span style="color:var(--text);">${popH.toLocaleString('pt-BR')} hab</span>
    <span style="color:var(--text3);"> · IC 95%: </span><span style="color:var(--accent);">[${Math.max(0,ciH.lower).toLocaleString('pt-BR')} — ${ciH.upper.toLocaleString('pt-BR')}]</span>
    <span style="color:var(--text3);"> · RMSE ajuste: </span><span style="color:var(--text2);">${rmseModel.toFixed(0)} hab</span>
    ${rmseModel===0?'<br><span style="color:var(--amber);font-size:11px;">⚠ RMSE = 0 (≤2 pontos). IC não calculável com precisão. Adicione mais censos.</span>':''}
  </div>`;

  document.getElementById('proj-cards').innerHTML=[
    {label:`Pop. estimada (${anoAtual})`,val:popAtual.toLocaleString('pt-BR'),sub:`IC: [${Math.max(0,ciAtual.lower).toLocaleString('pt-BR')}–${ciAtual.upper.toLocaleString('pt-BR')}]`,cls:'accent'},
    {label:`Pop. em ${horizonte}`,val:popH.toLocaleString('pt-BR'),sub:`Modelo ${modelLabel[modelo]}`,cls:'green'},
    {label:'Crescimento total',val:`+${((popH/popAtual-1)*100).toFixed(1)}%`,sub:`${anoAtual}→${horizonte}`,cls:'amber'},
    {label:'Modelo',val:modelLabel[modelo],sub:`R²=${(state.r2[modelo]*100).toFixed(0)}% Score=${((state.scores&&state.scores[modelo]||0)*100).toFixed(0)}%`,cls:''},
  ].map(c=>`<div class="metric-card ${c.cls}"><div class="metric-label">${c.label}</div><div class="metric-value">${c.val}</div><div class="metric-sub">${c.sub}</div></div>`).join('');

  const conf_label=dtH<=15?{t:'Alta confiabilidade',c:'conf-high'}:dtH<=25?{t:'Confiabilidade média',c:'conf-med'}:{t:'Baixa confiabilidade — cenário especulativo',c:'conf-low'};
  document.getElementById('conf-horizonte').innerHTML=`<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:12px;color:var(--text2);font-family:var(--mono);">Horizonte ${horizonte} (${dtH} anos além do último censo):</span><span class="conf-badge ${conf_label.c}">${conf_label.t}</span></div>`;

  const ciUpper=anosEnv.map((a,i)=>{const dt2=a-aBase;const ci=calcCI(proj[anos.indexOf(a)],rmseModel,dt2);return Math.min(ci.upper,state.coefs.K?state.coefs.K*1.05:ci.upper);});
  const ciLower=anosEnv.map((a,i)=>{const dt2=a-aBase;const ci=calcCI(proj[anos.indexOf(a)],rmseModel,dt2);return Math.max(0,ci.lower);});

  if(state.charts.projecao)state.charts.projecao.destroy();
  state.charts.projecao=new Chart(document.getElementById('chart-projecao'),{
    type:'line',
    data:{labels:anos,datasets:[
      {label:'IC 95% — superior',data:anos.map(a=>{const j=anosEnv.indexOf(a);return j>=0?ciUpper[j]:null;}),borderColor:'rgba(79,126,245,0.25)',borderWidth:1,borderDash:[2,3],pointRadius:0,fill:'+1',backgroundColor:'rgba(79,126,245,0.07)',tension:0},
      {label:'IC 95% — inferior',data:anos.map(a=>{const j=anosEnv.indexOf(a);return j>=0?ciLower[j]:null;}),borderColor:'rgba(79,126,245,0.25)',borderWidth:1,borderDash:[2,3],pointRadius:0,fill:false,tension:0},
      {label:'Otimista',data:anos.map(a=>{const j=anosEnv.indexOf(a);return j>=0?pO[j]:null;}),borderColor:'#E24B4A',borderWidth:1,borderDash:[4,2],pointRadius:0,fill:false,tension:0},
      {label:'Pessimista',data:anos.map(a=>{const j=anosEnv.indexOf(a);return j>=0?pP[j]:null;}),borderColor:'#888780',borderWidth:1,borderDash:[4,2],pointRadius:0,fill:false,tension:0},
      {label:`Projetado — ${modelLabel[modelo]}`,data:anos.map((a,i)=>anosEnv.indexOf(a)>=0?proj[i]:null),borderColor:'#4f7ef5',borderWidth:2.5,pointRadius:0,fill:false,tension:0},
      {label:'Histórico IBGE',data:anos.map(a=>{const r=d.find(x=>x.ano===a);return r?r.pop:null;}),borderColor:'#1a1a18',backgroundColor:'#1a1a18',borderWidth:1.5,pointRadius:6,showLine:true,fill:false,tension:0},
      {label:'Ajuste histórico',data:anos.map((a,i)=>anosEnv.indexOf(a)<0?proj[i]:null),borderColor:'#4f7ef5',borderWidth:1.5,borderDash:[4,2],pointRadius:0,fill:false,tension:0},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11},boxWidth:20}}},
      scales:{y:{ticks:{callback:v=>v>=1e6?`${(v/1e6).toFixed(2)}M`:v>=1e3?`${(v/1e3).toFixed(0)}k`:v}},x:{ticks:{maxRotation:45}}}}
  });

  const anosT2=Array.from(new Set(anos.filter(a=>a%5===0||a===horizonte||a===aBase||a===anoAtual))).sort((a,b)=>a-b);
  document.getElementById('proj-table').innerHTML=`<table class="tbl">
    <thead><tr><th>Ano</th><th>Projetado (hab)</th><th>IC 95% — Inferior</th><th>IC 95% — Superior</th><th>Pessimista</th><th>Otimista</th></tr></thead>
    <tbody>${anosT2.map((a,ti)=>{
      const idx=anos.indexOf(a),pop=proj[idx]||0;
      const jEnv=anosEnv.indexOf(a);
      const dt2=a-aBase;
      const ci2=calcCI(pop,rmseModel,Math.max(0,dt2));
      const pessV=jEnv>=0?pP[jEnv].toLocaleString('pt-BR'):'–';
      const otimV=jEnv>=0?pO[jEnv].toLocaleString('pt-BR'):'–';
      return `<tr ${a===horizonte?'class="highlight"':''}><td>${a}</td><td>${pop.toLocaleString('pt-BR')}</td><td>${jEnv>=0?Math.max(0,ci2.lower).toLocaleString('pt-BR'):'–'}</td><td>${jEnv>=0?ci2.upper.toLocaleString('pt-BR'):'–'}</td><td>${pessV}</td><td>${otimV}</td></tr>`;
    }).join('')}</tbody></table>`;

  document.getElementById('proj-result').style.display='block';
  renderDimensionamento();
  renderDecisao();
  gerarRelatorio();
  addAudit(`Projeção: ${modelLabel[modelo]} até ${horizonte}, pop=${popH.toLocaleString('pt-BR')} hab`);
}
