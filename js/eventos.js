// ══════════════════════════════════════════
// QUEBRAS DE TENDÊNCIA (EVENTOS)
// ══════════════════════════════════════════
function renderEventoRows(){
  document.getElementById('eventos-rows').innerHTML=eventos.map((e,i)=>`
    <div class="event-row">
      <input type="number" value="${e.ano}" onchange="eventos[${i}].ano=+this.value" placeholder="Ano">
      <input type="text" value="${e.desc}" onchange="eventos[${i}].desc=this.value" placeholder="Descrição">
      <select onchange="eventos[${i}].delta=+this.value">
        <option value="5"   ${e.delta===5?'selected':''}>+5% moderado</option>
        <option value="10"  ${e.delta===10?'selected':''}>+10% forte</option>
        <option value="15"  ${e.delta===15?'selected':''}>+15% excepcional</option>
        <option value="-5"  ${e.delta===-5?'selected':''}>−5% negativo</option>
        <option value="-10" ${e.delta===-10?'selected':''}>−10% crítico</option>
      </select>
      <button class="btn btn-sm btn-danger" onclick="eventos.splice(${i},1);renderEventoRows();">✕</button>
    </div>`).join('');
}
function addEvento(){eventos.push({ano:2030,desc:'',delta:5});renderEventoRows();}

function projetarComEventos(){
  if(!state.censosRaw){alert('Calcule o Best Fit primeiro.');return;}
  const d=state.censosRaw,horizonte=d[d.length-1].ano+20;
  const anos=[];for(let a=d[0].ano;a<=horizonte;a++)anos.push(a);
  const P0=d[0].pop,a0=d[0].ano;
  const base=anos.map(a=>Math.round(P0*Math.pow(1+(state.coefs.i_geo||0.015),a-a0)));
  let proj=[...base];
  eventos.sort((a,b)=>a.ano-b.ano).forEach(ev=>{
    const idx=anos.indexOf(ev.ano);
    if(idx<0)return;
    for(let j=idx;j<proj.length;j++)proj[j]=Math.round(proj[j]*(1+ev.delta/100));
  });
  if(state.charts.eventos)state.charts.eventos.destroy();
  state.charts.eventos=new Chart(document.getElementById('chart-eventos'),{
    type:'line',
    data:{labels:anos,datasets:[
      {label:'Sem eventos',data:base,borderColor:'#888780',borderDash:[5,3],pointRadius:0,fill:false,tension:0},
      {label:'Com eventos',data:proj,borderColor:'#4f7ef5',borderWidth:2.5,pointRadius:0,fill:false,tension:0},
      ...eventos.map(ev=>({label:`${ev.desc||'Evento'} (${ev.ano})`,data:anos.map(a=>a===ev.ano?proj[anos.indexOf(a)]:null),borderColor:ev.delta>0?'#1D9E75':'#E24B4A',pointRadius:7,type:'scatter',showLine:false}))
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11},boxWidth:20}}},
      scales:{y:{ticks:{callback:v=>v>=1e3?`${(v/1e3).toFixed(0)}k`:v}}}}
  });
  addAudit(`Simulação com ${eventos.length} evento(s)`);
}
