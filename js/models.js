// ══════════════════════════════════════════
// BEST FIT — 4 modelos + LOO cross-validation
// ══════════════════════════════════════════
function calcR2(yReal,yPred){
  const mean=yReal.reduce((a,b)=>a+b,0)/yReal.length;
  const ss_tot=yReal.reduce((s,y)=>s+(y-mean)**2,0);
  const ss_res=yReal.reduce((s,y,i)=>s+(y-yPred[i])**2,0);
  return ss_tot===0?1:Math.max(0,1-ss_res/ss_tot);
}

function calcRMSE(yReal,yPred){
  const n=yReal.length;
  const sse=yReal.reduce((s,y,i)=>s+(y-yPred[i])**2,0);
  return Math.sqrt(sse/n);
}

// Quantil t de Student bicaudal 95% (df = n − 2 para regressão simples)
// Tabela embutida para df 1..30; df≥30 usa z=1.96 (normal)
const T_STUDENT_95=[
  12.706,4.303,3.182,2.776,2.571, // df 1–5
   2.447,2.365,2.306,2.262,2.228, // df 6–10
   2.201,2.179,2.160,2.145,2.131, // df 11–15
   2.120,2.110,2.101,2.093,2.086, // df 16–20
   2.080,2.074,2.069,2.064,2.060, // df 21–25
   2.056,2.052,2.048,2.045,2.042  // df 26–30
];
function tQuantile95(n){
  // n = número de censos; df = n − 2 (regressão linear simples)
  const df=Math.max(1,n-2);
  if(df>=30||df>=T_STUDENT_95.length)return 1.96;
  return T_STUDENT_95[df-1];
}

// Intervalo de confiança bootstrap simplificado por RMSE do ajuste.
// Usa t de Student quando n < 32 (df < 30) para refletir incerteza de pequenas amostras.
function calcCI(pred,rmse,dtExtrap,n){
  const growth=Math.sqrt(Math.max(1,dtExtrap));
  const critValue=tQuantile95(n||32); // valor crítico: z (normal) ou t (Student) conforme n
  const margin=critValue*rmse*growth;
  return{lower:Math.round(pred-margin),upper:Math.round(pred+margin),margin,z:critValue};
}

// Leave-One-Out cross-validation — RMSE normalizado
function calcLOO(anos,pops,modeloFn){
  if(pops.length<3)return null;
  let sumSqErr=0,count=0;
  for(let omit=1;omit<pops.length-1;omit++){
    const anosT=anos.filter((_,i)=>i!==omit);
    const popsT=pops.filter((_,i)=>i!==omit);
    try{
      const pred=modeloFn(anosT,popsT,anos[omit]);
      if(isFinite(pred)&&pred>0){sumSqErr+=(pops[omit]-pred)**2;count++;}
    }catch(_){}
  }
  if(!count)return null;
  const rmse=Math.sqrt(sumSqErr/count);
  return rmse/(pops.reduce((a,b)=>a+b,0)/pops.length);
}

// Holt com otimização de alpha/beta por grid search (minimiza RMSE)
function holtFit(pops,anos){
  let bestAlpha=0.5,bestBeta=0.3,bestRMSE=Infinity;
  for(let a=0.1;a<=0.9;a+=0.1){
    for(let b=0.05;b<=0.5;b+=0.05){
      const pred=_holtPredict(pops,anos,a,b);
      const rmse=calcRMSE(pops,pred);
      if(rmse<bestRMSE){bestRMSE=rmse;bestAlpha=+a.toFixed(2);bestBeta=+b.toFixed(2);}
    }
  }
  const pred=_holtPredict(pops,anos,bestAlpha,bestBeta);
  const res=_holtState(pops,anos,bestAlpha,bestBeta);
  return{pred:pred.map(x=>Math.round(x)),L:res.L,T:res.T,alpha:bestAlpha,beta:bestBeta};
}

function _holtPredict(pops,anos,alpha,beta){
  let L=pops[0],T=pops.length>1?pops[1]-pops[0]:0;
  const out=[pops[0]];
  for(let i=1;i<pops.length;i++){
    const dt=anos[i]-anos[i-1];
    for(let t=0;t<dt;t++){const Lp=L,Tp=T;L=alpha*pops[i]+(1-alpha)*(Lp+Tp);T=beta*(L-Lp)+(1-beta)*Tp;}
    out.push(L);
  }
  return out;
}

function _holtState(pops,anos,alpha,beta){
  let L=pops[0],T=pops.length>1?pops[1]-pops[0]:0;
  for(let i=1;i<pops.length;i++){
    const dt=anos[i]-anos[i-1];
    for(let t=0;t<dt;t++){const Lp=L,Tp=T;L=alpha*pops[i]+(1-alpha)*(Lp+Tp);T=beta*(L-Lp)+(1-beta)*Tp;}
  }
  return{L,T};
}

function holtProject(L,T,anoBase,anoTarget){return Math.round(L+T*(anoTarget-anoBase));}

// Retorna true quando a série tem crescimento negativo (decrescente em algum ponto)
function hasNegativeGrowth(pops){
  for(let i=1;i<pops.length;i++){if(pops[i]<pops[i-1])return true;}
  return false;
}

// Geométrico por regressão log-linear (OLS em ln(P) vs t)
// Guard: populações ≤ 0 tornam ln indefinido; são substituídas pelo valor válido anterior.
function calcGeoLogLinear(anos,pops){
  const n=anos.length;
  const safePops=[];
  for(let i=0;i<pops.length;i++){
    if(pops[i]>0){safePops.push(pops[i]);}
    else{safePops.push(safePops.length>0&&safePops[safePops.length-1]>0?safePops[safePops.length-1]:1);}
  }
  const lnP=safePops.map(p=>Math.log(p));
  let sX=0,sY=0,sXX=0,sXY=0;
  for(let i=0;i<n;i++){sX+=anos[i];sY+=lnP[i];sXX+=anos[i]*anos[i];sXY+=anos[i]*lnP[i];}
  const den=n*sXX-sX*sX;
  const b_geo=den!==0?(n*sXY-sX*sY)/den:0;
  const a_geo=sY/n-b_geo*(sX/n);
  const i_geo=Math.exp(b_geo)-1;
  const P0_geo=Math.exp(a_geo+b_geo*anos[0]);
  return{i_geo,a_geo,b_geo,P0_geo};
}

// Score composto: 60% R² + 40% (1 - LOO normalizado)
function calcCompositeScore(r2,loo){
  if(loo===null)return r2*0.8;
  const looScore=Math.max(0,1-loo);
  return 0.6*r2+0.4*looScore;
}

function calcularBestFit(){
  const d=state.censosData.filter(x=>x.pop>0).sort((a,b)=>a.ano-b.ano);
  if(d.length<2){alert('Insira pelo menos 2 censos com população > 0.');return;}
  for(let i=1;i<d.length;i++){
    if(d[i].pop<=d[i-1].pop*0.5){
      const ok=confirm(`Queda brusca entre ${d[i-1].ano} e ${d[i].ano}. Possível erro de digitação. Continuar?`);
      if(!ok)return;
    }
  }
  const n=d.length,anos=d.map(x=>x.ano),pops=d.map(x=>x.pop);
  const dt=anos[n-1]-anos[0],P0=pops[0],Pn=pops[n-1];

  // ── Alerta de crescimento negativo ────────────────────────────────────────
  if(hasNegativeGrowth(pops)){
    // Encontra todos os intervalos decrescentes para informar o usuário
    const decr=[];
    for(let i=1;i<d.length;i++){
      if(d[i].pop<d[i-1].pop)decr.push(`${d[i-1].ano}→${d[i].ano} (${d[i-1].pop.toLocaleString('pt-BR')}→${d[i].pop.toLocaleString('pt-BR')} hab)`);
    }
    const msgDecr=`⚠ Crescimento negativo detectado:\n${decr.join('\n')}\n\nO modelo Geométrico (log) e o Logístico podem produzir resultados distorcidos com populações decrescentes. O Aritmético e o Holt são mais robustos neste caso.\n\nDeseja continuar mesmo assim?`;
    const ok=confirm(msgDecr);
    if(!ok)return;
  }

  // Aritmético — OLS
  let sX=0,sY=0,sXX=0,sXY=0;
  for(let i=0;i<n;i++){sX+=anos[i];sY+=pops[i];sXX+=anos[i]*anos[i];sXY+=anos[i]*pops[i];}
  const den=n*sXX-sX*sX;
  const ka=den!==0?(n*sXY-sX*sY)/den:(Pn-P0)/dt;
  const b_arit=sY/n-ka*(sX/n);
  const predArit=anos.map(a=>Math.round(b_arit+ka*a));
  state.coefs.ka=ka;state.coefs.b_arit=b_arit;

  // Geométrico — regressão log-linear (todos os censos)
  const geoReg=calcGeoLogLinear(anos,pops);
  const i_geo=geoReg.i_geo;
  const a_geo=geoReg.a_geo,b_geo=geoReg.b_geo;
  const predGeo=anos.map(a=>Math.round(Math.exp(a_geo+b_geo*a)));
  state.coefs.i_geo=i_geo;state.coefs.a_geo=a_geo;state.coefs.b_geo=b_geo;state.coefs.P0_geo=geoReg.P0_geo;

  // Logístico
  // Guard: K deve ser maior que Pn para que o modelo seja válido
  const K=state.K&&state.K>Pn?state.K:Pn*2.5;
  if(state.K&&state.K<=Pn){
    console.warn(`Saturação K=${state.K} ≤ Pn=${Pn}. Usando K=${Pn*2.5} (padrão 2,5×Pn).`);
  }
  let k_log=0.02;
  try{const v=(Pn*(K-P0))/(P0*(K-Pn));if(v>0)k_log=(1/dt)*Math.log(v);if(!isFinite(k_log)||k_log<=0)k_log=0.02;}catch(_){}
  const predLog=anos.map(a=>Math.round(K/(1+((K-P0)/P0)*Math.exp(-k_log*(a-anos[0])))));
  state.coefs.k_log=k_log;state.coefs.K=K;state.coefs.P0=P0;

  // Holt — parâmetros otimizados por grid search
  const holt=holtFit(pops,anos);
  state.coefs.holt=holt;
  const predHolt=holt.pred;

  state.r2={aritmetico:calcR2(pops,predArit),geometrico:calcR2(pops,predGeo),logistico:calcR2(pops,predLog),holt:calcR2(pops,predHolt)};
  state.rmse={aritmetico:calcRMSE(pops,predArit),geometrico:calcRMSE(pops,predGeo),logistico:calcRMSE(pops,predLog),holt:calcRMSE(pops,predHolt)};

  // LOO cross-validation
  state.loo={
    aritmetico:calcLOO(anos,pops,(at,pt,ao)=>{let sx=0,sy=0,sxx=0,sxy=0;for(let i=0;i<pt.length;i++){sx+=at[i];sy+=pt[i];sxx+=at[i]*at[i];sxy+=at[i]*pt[i];}const d2=pt.length*sxx-sx*sx;const k2=d2!==0?(pt.length*sxy-sx*sy)/d2:(pt[pt.length-1]-pt[0])/(at[at.length-1]-at[0]);const b2=sy/pt.length-k2*(sx/pt.length);return b2+k2*ao;}),
    geometrico:calcLOO(anos,pops,(at,pt,ao)=>{const gr=calcGeoLogLinear(at,pt);return Math.exp(gr.a_geo+gr.b_geo*ao);}),
    logistico:calcLOO(anos,pops,(at,pt,ao)=>{const K2=K;let kl=0.02;try{const v2=(pt[pt.length-1]*(K2-pt[0]))/(pt[0]*(K2-pt[pt.length-1]));if(v2>0)kl=(1/(at[at.length-1]-at[0]))*Math.log(v2);if(!isFinite(kl)||kl<=0)kl=0.02;}catch(_){}return K2/(1+((K2-pt[0])/pt[0])*Math.exp(-kl*(ao-at[0])));}),
    holt:calcLOO(anos,pops,(at,pt,ao)=>{const h=holtFit(pt,at);return holtProject(h.L,h.T,at[at.length-1],ao);})
  };

  // Score composto (R² 60% + LOO 40%)
  state.scores={};
  ['aritmetico','geometrico','logistico','holt'].forEach(m=>{
    state.scores[m]=calcCompositeScore(state.r2[m],state.loo[m]);
  });

  state.censosRaw=d;
  state.bestModel=Object.entries(state.scores).sort((a,b)=>b[1]-a[1])[0][0];

  const anoFinal=anos[n-1];
  state.infraAnos=[anoFinal+3,anoFinal+8,anoFinal+13,anoFinal+20];
  document.getElementById('infra-anos').innerHTML=state.infraAnos.map((a,i)=>`<button class="btn btn-sm ${i===0?'btn-primary':''}" onclick="setInfraAno(${i},this)">${a}</button>`).join('');

  renderBestFit(d,predArit,predGeo,predLog,predHolt);
  document.getElementById('bestfit-result').style.display='block';
  document.getElementById('cmp-a-nome').textContent=state.municipioNome;
  document.getElementById('cmp-a-pop').textContent=`Pop. ${d[d.length-1].ano}: ${d[d.length-1].pop.toLocaleString('pt-BR')} hab`;
  addAudit(`Best Fit: ${modelLabel[state.bestModel]} R²=${(state.r2[state.bestModel]*100).toFixed(1)}%`);
  agendarAutoSave();
  atualizarProgressoFluxo();
}

function confiabilidadeLabel(r2,loo){
  if(r2>=0.995&&(loo===null||loo<0.03))return{label:'Muito alta',cls:'conf-high'};
  if(r2>=0.98&&(loo===null||loo<0.06))return{label:'Alta',cls:'conf-high'};
  if(r2>=0.95&&(loo===null||loo<0.10))return{label:'Média',cls:'conf-med'};
  return{label:'Baixa — usar com cautela',cls:'conf-low'};
}

function renderBestFit(d,pa,pg,pl,ph){
  const best=state.bestModel;
  const scores=state.scores||{};
  document.getElementById('model-rows').innerHTML=['aritmetico','geometrico','logistico','holt'].map(m=>{
    const r2pct=(state.r2[m]*100).toFixed(1);
    const loo=state.loo[m];
    const score=scores[m]||0;
    const conf=confiabilidadeLabel(state.r2[m],loo);
    const looBar=loo!==null?Math.max(0,Math.round((1-loo)*100)):null;
    return `<div class="score-row">
      <span class="score-name">${modelLabel[m]}</span>
      <div class="score-bars">
        <div class="score-bar-wrap"><span class="score-bar-label">R²</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${r2pct}%;background:${modelColors[m]};"></div></div><span style="font-size:10px;font-family:var(--mono);color:var(--text2);min-width:38px;">${r2pct}%</span></div>
        ${looBar!==null?`<div class="score-bar-wrap"><span class="score-bar-label">LOO</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${looBar}%;background:${modelColors[m]};opacity:.55;"></div></div><span style="font-size:10px;font-family:var(--mono);color:var(--text2);min-width:38px;">${(loo*100).toFixed(1)}%</span></div>`:''}
      </div>
      <span class="conf-badge ${conf.cls}">${conf.label}</span>
      ${m===best?'<span class="rec-badge">Recomendado</span>':''}
    </div>`;
  }).join('');
  document.getElementById('rec-alert').textContent=`${state.municipioNome}: ${modelLabel[best]} com R²=${(state.r2[best]*100).toFixed(1)}% e score composto ${((scores[best]||0)*100).toFixed(1)}% — recomendado.`;

  const n=d.length;
  const horizon_conf=n>=4?'Alta confiabilidade até '+(d[d.length-1].ano+15)+', média até '+(d[d.length-1].ano+25)+', baixa além disso.':
    n===3?'Confiabilidade média até '+(d[d.length-1].ano+10)+'. Adicione mais censos para melhorar.':
    'Poucos dados — confiabilidade limitada. Mínimo recomendado: 3 censos.';
  document.getElementById('conf-analysis').innerHTML=`<div class="alert alert-warning" style="margin-bottom:0;">${horizon_conf}</div>`;

  if(state.charts.bestfit)state.charts.bestfit.destroy();
  state.charts.bestfit=new Chart(document.getElementById('chart-bestfit'),{
    type:'line',
    data:{
      labels:d.map(x=>x.ano),
      datasets:[
        {label:'Histórico IBGE',data:d.map(x=>x.pop),borderColor:'#1a1a18',backgroundColor:'#1a1a18',borderWidth:2,pointRadius:6,pointBackgroundColor:'#1a1a18',showLine:true,fill:false,tension:0},
        {label:'Aritmético',data:pa,borderColor:modelColors.aritmetico,borderDash:[4,3],pointRadius:0,fill:false,tension:0},
        {label:'Geométrico',data:pg,borderColor:modelColors.geometrico,borderWidth:2.5,pointRadius:0,fill:false,tension:0},
        {label:'Logístico',data:pl,borderColor:modelColors.logistico,borderDash:[2,2],pointRadius:0,fill:false,tension:0},
        {label:'Holt',data:ph,borderColor:modelColors.holt,borderDash:[6,2],pointRadius:0,fill:false,tension:0}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11},boxWidth:20,usePointStyle:true}}},
      scales:{y:{ticks:{callback:v=>v>=1e6?`${(v/1e6).toFixed(2)}M`:v>=1e3?`${(v/1e3).toFixed(0)}k`:v}}}}
  });
}
