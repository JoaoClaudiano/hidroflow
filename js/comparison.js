// ══════════════════════════════════════════
// COMPARAÇÃO DE MUNICÍPIOS
// ══════════════════════════════════════════
function renderComparacao(){
  if(!state.censosRaw||!state.cmpB)return;
  const dA=state.censosRaw,dB=state.cmpB.censos;
  const todosAnos=[...new Set([...dA.map(x=>x.ano),...dB.map(x=>x.ano)])].sort((a,b)=>a-b);
  if(state.charts.comparacao)state.charts.comparacao.destroy();
  state.charts.comparacao=new Chart(document.getElementById('chart-comparacao'),{
    type:'line',
    data:{labels:todosAnos,datasets:[
      {label:state.municipioNome,data:todosAnos.map(a=>{const r=dA.find(x=>x.ano===a);return r?r.pop:null;}),borderColor:'#4f7ef5',borderWidth:2.5,pointRadius:5,fill:false,tension:0},
      {label:state.cmpB.nome,data:todosAnos.map(a=>{const r=dB.find(x=>x.ano===a);return r?r.pop:null;}),borderColor:'#E24B4A',borderWidth:2.5,pointRadius:5,fill:false,tension:0}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{font:{size:12},boxWidth:20}}},
      scales:{y:{ticks:{callback:v=>v>=1e6?`${(v/1e6).toFixed(2)}M`:v>=1e3?`${(v/1e3).toFixed(0)}k`:v}}}}
  });
  const calcTx=d=>{if(d.length<2)return 0;const dt=d[d.length-1].ano-d[0].ano;return dt>0?(Math.pow(d[d.length-1].pop/d[0].pop,1/dt)-1)*100:0;};
  document.getElementById('cmp-tabela').innerHTML=`<table class="tbl">
    <thead><tr><th>Indicador</th><th>${state.municipioNome}</th><th>${state.cmpB.nome}</th></tr></thead>
    <tbody>
      <tr><td>Pop. inicial</td><td>${dA[0].pop.toLocaleString('pt-BR')} (${dA[0].ano})</td><td>${dB[0].pop.toLocaleString('pt-BR')} (${dB[0].ano})</td></tr>
      <tr><td>Pop. mais recente</td><td>${dA[dA.length-1].pop.toLocaleString('pt-BR')} (${dA[dA.length-1].ano})</td><td>${dB[dB.length-1].pop.toLocaleString('pt-BR')} (${dB[dB.length-1].ano})</td></tr>
      <tr><td>Crescimento total</td><td>+${((dA[dA.length-1].pop/dA[0].pop-1)*100).toFixed(1)}%</td><td>+${((dB[dB.length-1].pop/dB[0].pop-1)*100).toFixed(1)}%</td></tr>
      <tr><td>Taxa geométrica média</td><td>${calcTx(dA).toFixed(3)}% a.a.</td><td>${calcTx(dB).toFixed(3)}% a.a.</td></tr>
      <tr><td>Censos disponíveis</td><td>${dA.length}</td><td>${dB.length}</td></tr>
    </tbody></table>`;
  document.getElementById('cmp-result').style.display='block';
}
