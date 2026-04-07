// ══════════════════════════════════════════
// COMPARAÇÃO DE MUNICÍPIOS
// ══════════════════════════════════════════
function renderComparacao(){
  if(!state.censosRaw||!state.cmpB)return;
  const dA=state.censosRaw,dB=state.cmpB.censos;
  const todosAnos=[...new Set([...dA.map(x=>x.ano),...dB.map(x=>x.ano)])].sort((a,b)=>a-b);

  // ── Método Comparativo: projeta A usando a taxa geométrica de B ────────────
  // i_B calculado por regressão log-linear (todos os censos de B)
  const calcTxGeo=d=>{
    if(d.length<2)return 0;
    const dt=d[d.length-1].ano-d[0].ano;
    return dt>0?(Math.pow(d[d.length-1].pop/d[0].pop,1/dt)-1):0;
  };
  const i_B=calcTxGeo(dB);
  const popAbase=dA[dA.length-1].pop;
  const anoAbase=dA[dA.length-1].ano;
  const horizonte=+document.getElementById('ano-horizonte')?.value||anoAbase+20;
  // Série futura de projeção comparativa (a partir do ano base de A até horizonte)
  const anosProj=[];
  for(let a=anoAbase;a<=horizonte;a+=1)anosProj.push(a);
  const projComp=anosProj.map(a=>Math.round(popAbase*Math.pow(1+i_B,a-anoAbase)));

  const todosAnosSet=new Set(todosAnos);
  if(state.charts.comparacao)state.charts.comparacao.destroy();
  state.charts.comparacao=new Chart(document.getElementById('chart-comparacao'),{
    type:'line',
    data:{labels:[...todosAnos,...anosProj.filter(a=>!todosAnosSet.has(a))].sort((a,b)=>a-b),datasets:[
      {label:state.municipioNome+' (histórico)',data:todosAnos.map(a=>{const r=dA.find(x=>x.ano===a);return r?r.pop:null;}),borderColor:'#4f7ef5',borderWidth:2.5,pointRadius:5,fill:false,tension:0},
      {label:state.cmpB.nome+' (histórico)',data:todosAnos.map(a=>{const r=dB.find(x=>x.ano===a);return r?r.pop:null;}),borderColor:'#E24B4A',borderWidth:2.5,pointRadius:5,fill:false,tension:0},
      {label:`${state.municipioNome} — Proj. Comparativa (i=${(i_B*100).toFixed(3)}% a.a. de ${state.cmpB.nome})`,
        data:[...todosAnos,...anosProj.filter(a=>!todosAnosSet.has(a))].sort((a,b)=>a-b).map(a=>{
          if(a<anoAbase)return null;
          return Math.round(popAbase*Math.pow(1+i_B,a-anoAbase));
        }),
        borderColor:'#7c3aed',borderWidth:2,borderDash:[6,3],pointRadius:0,fill:false,tension:0}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{font:{size:12},boxWidth:20}}},
      scales:{y:{ticks:{callback:v=>v>=1e6?`${(v/1e6).toFixed(2)}M`:v>=1e3?`${(v/1e3).toFixed(0)}k`:v}}}}
  });

  const calcTx=d=>{if(d.length<2)return 0;const dt=d[d.length-1].ano-d[0].ano;return dt>0?(Math.pow(d[d.length-1].pop/d[0].pop,1/dt)-1)*100:0;};
  const popCompHorizonte=Math.round(popAbase*Math.pow(1+i_B,horizonte-anoAbase));
  const popBestFitHorizonte=state.projData.length?state.projData[state.projData.length-1].pop:null;

  document.getElementById('cmp-tabela').innerHTML=`<table class="tbl">
    <thead><tr><th>Indicador</th><th>${state.municipioNome}</th><th>${state.cmpB.nome}</th></tr></thead>
    <tbody>
      <tr><td>Pop. inicial</td><td>${dA[0].pop.toLocaleString('pt-BR')} (${dA[0].ano})</td><td>${dB[0].pop.toLocaleString('pt-BR')} (${dB[0].ano})</td></tr>
      <tr><td>Pop. mais recente</td><td>${dA[dA.length-1].pop.toLocaleString('pt-BR')} (${dA[dA.length-1].ano})</td><td>${dB[dB.length-1].pop.toLocaleString('pt-BR')} (${dB[dB.length-1].ano})</td></tr>
      <tr><td>Crescimento total</td><td>+${((dA[dA.length-1].pop/dA[0].pop-1)*100).toFixed(1)}%</td><td>+${((dB[dB.length-1].pop/dB[0].pop-1)*100).toFixed(1)}%</td></tr>
      <tr><td>Taxa geométrica média</td><td>${calcTx(dA).toFixed(3)}% a.a.</td><td>${calcTx(dB).toFixed(3)}% a.a.</td></tr>
      <tr><td>Censos disponíveis</td><td>${dA.length}</td><td>${dB.length}</td></tr>
    </tbody></table>
    <div style="margin-top:14px;padding:12px 14px;background:var(--accent-bg);border-left:4px solid var(--accent);border-radius:var(--radius);font-size:12px;font-family:var(--mono);line-height:1.7;">
      <strong>🔵 Método dos Municípios Comparativos</strong><br>
      Projeta <strong>${state.municipioNome}</strong> usando a taxa geométrica histórica de <strong>${state.cmpB.nome}</strong> (i = ${(i_B*100).toFixed(3)}% a.a.).<br>
      População estimada em ${horizonte}: <strong>${popCompHorizonte.toLocaleString('pt-BR')} hab</strong>
      ${popBestFitHorizonte?` · Best Fit próprio: ${popBestFitHorizonte.toLocaleString('pt-BR')} hab · Diferença: ${Math.abs(popCompHorizonte-popBestFitHorizonte).toLocaleString('pt-BR')} hab (${(Math.abs(popCompHorizonte-popBestFitHorizonte)/popBestFitHorizonte*100).toFixed(1)}%)`:''}
      <br><span style="color:var(--text3);font-size:10px;">Uso recomendado: quando ${state.municipioNome} tem poucos dados históricos e ${state.cmpB.nome} possui perfil socioeconômico similar (porte, região, IDH). Ref: FUNASA Manual de Saneamento.</span>
    </div>`;
  document.getElementById('cmp-result').style.display='block';
}
