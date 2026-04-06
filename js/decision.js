// ══════════════════════════════════════════
// DIAGNÓSTICO & DECISÃO AUTOMÁTICA
// ══════════════════════════════════════════
function renderDecisao(){
  if(!state.censosRaw||!state.projData.length){
    document.getElementById('decisao-empty').style.display='block';
    document.getElementById('decisao-content').style.display='none';
    return;
  }
  document.getElementById('decisao-empty').style.display='none';
  document.getElementById('decisao-content').style.display='block';

  const d=state.censosRaw;
  const p=getParams();
  const horizonte=+document.getElementById('ano-horizonte').value;
  const aBase=d[d.length-1].ano;
  const popBase=d[d.length-1].pop;
  const anoAtual=new Date().getFullYear();
  const modelo=state.bestModel;

  const vBase=calcInfra(popBase,p);

  const acharAno=(testFn)=>{
    for(const r of state.projData){
      if(r.ano<anoAtual)continue;
      if(testFn(r.pop))return r.ano;
    }
    return null;
  };

  const rmseModel=state.rmse&&state.rmse[modelo]?state.rmse[modelo]:0;
  const dtH=horizonte-aBase;

  const popH=state.projData[state.projData.length-1].pop;
  const crescPct=((popH/popBase-1)*100).toFixed(1);

  const anoAmpl20=acharAno(pop=>pop>popBase*1.20);
  const anoAmpl40=acharAno(pop=>pop>popBase*1.40);
  const anoAmpl60=acharAno(pop=>pop>popBase*1.60);

  const extrapRatio=dtH/Math.max(1,d[d.length-1].ano-d[0].ano);
  const confiancaTexto=dtH<=10?'Alta (≤10 anos)':dtH<=20?'Média (11–20 anos)':dtH<=30?'Baixa (21–30 anos)':'Muito baixa (>30 anos)';
  const confiancaCls=dtH<=10?'conf-high':dtH<=20?'conf-high':dtH<=30?'conf-med':'conf-low';

  const alertas=[];

  if(extrapRatio>2){
    alertas.push({tipo:'warn',icon:'⚠️',titulo:`Extrapolação elevada (${extrapRatio.toFixed(1)}× série histórica)`,
      texto:`O horizonte de ${horizonte} representa ${dtH} anos de projeção sobre ${d[d.length-1].ano-d[0].ano} anos de dados históricos. Incerteza muito alta. Resultados devem ser tratados como cenário indicativo.`});
  }

  if(d.length<3){
    alertas.push({tipo:'warn',icon:'📊',titulo:'Série histórica insuficiente',
      texto:`Apenas ${d.length} censo(s) disponível(is). Mínimo recomendado: 3 censos para validação cruzada confiável. LOO não calculável — margem de erro pode ser subestimada.`});
  }

  if(modelo==='logistico'&&state.coefs.K){
    const satPct=(popH/state.coefs.K*100).toFixed(0);
    if(popH>state.coefs.K*0.80){
      alertas.push({tipo:'crit',icon:'🚨',titulo:`Município próximo à saturação logística (${satPct}% de K)`,
        texto:`A população projetada em ${horizonte} (${popH.toLocaleString('pt-BR')} hab) atinge ${satPct}% da capacidade de saturação K = ${state.coefs.K.toLocaleString('pt-BR')} hab. Revise o valor de K no Plano Diretor.`});
    }
  }

  if(state.r2[modelo]<0.95){
    alertas.push({tipo:'warn',icon:'📉',titulo:`Aderência estatística limitada (R² = ${(state.r2[modelo]*100).toFixed(1)}%)`,
      texto:`O modelo ${modelLabel[modelo]} apresenta R² abaixo de 95%. A série histórica pode ter quebras de tendência. Verifique a aba "Quebras de Tendência" para modelar eventos demográficos específicos.`});
  }

  if(p.K1>1.5){alertas.push({tipo:'warn',icon:'🔧',titulo:`K1 = ${p.K1} fora do intervalo NBR (1,0–1,5)`,texto:'O coeficiente de dia de maior consumo excede o limite superior da NBR 12.211. Justifique no memorial técnico.'});}
  if(p.K2>2.0){alertas.push({tipo:'warn',icon:'🔧',titulo:`K2 = ${p.K2} fora do intervalo NBR (1,0–2,0)`,texto:'O coeficiente de hora de maior consumo excede o limite da NBR 12.211. Justifique no memorial técnico.'});}

  if(!alertas.length){
    alertas.push({tipo:'ok',icon:'✅',titulo:'Sem alertas críticos',texto:'Parâmetros dentro dos limites normativos. Série histórica adequada para o horizonte selecionado.'});
  }

  document.getElementById('dp-alertas-items').innerHTML=alertas.map(a=>`
    <div class="decision-item ${a.tipo}">
      <span class="decision-icon">${a.icon}</span>
      <div class="decision-text"><strong>${a.titulo}</strong>${a.texto}</div>
    </div>`).join('');

  const sistemas=[];

  if(anoAmpl20){
    const dtAmpl=anoAmpl20-anoAtual;
    const urgencia=dtAmpl<=5?'crit':dtAmpl<=10?'warn':'ok';
    const urg_txt=dtAmpl<=5?'URGENTE — janela ≤5 anos':dtAmpl<=10?'Atenção — planejar expansão':' Sistema adequado no curto prazo';
    sistemas.push({tipo:urgencia,icon:'💧',titulo:`SAA — Sistema de Abastecimento de Água`,
      texto:`Sistema atual dimensionado para ${popBase.toLocaleString('pt-BR')} hab. Ampliação de 20% necessária em ${anoAmpl20} (${dtAmpl} anos). ${urg_txt}.`,
      detalhe:`Q·K1 atual: ${vBase.QK1.toFixed(2)} L/s | Demanda em ${anoAmpl20}: ${calcInfra(state.projData.find(r=>r.ano===anoAmpl20)?.pop||popBase,p).QK1.toFixed(2)} L/s`});
  } else {
    sistemas.push({tipo:'ok',icon:'💧',titulo:'SAA — Sistema atende o horizonte completo',
      texto:`Crescimento de ${crescPct}% até ${horizonte} não exige ampliação de 20% da capacidade atual neste horizonte.`,
      detalhe:`Q·K1 em ${horizonte}: ${calcInfra(popH,p).QK1.toFixed(2)} L/s`});
  }

  const volResBase=vBase.vol_res_m3;
  const volResH=calcInfra(popH,p).vol_res_m3;
  const anoRes20=acharAno(pop=>calcInfra(pop,p).vol_res_m3>volResBase*1.20);
  if(anoRes20){
    sistemas.push({tipo:anoRes20-anoAtual<=8?'crit':'warn',icon:'🏗️',titulo:'Reservatório — Ampliação necessária',
      texto:`Volume de regularização atual: ${volResBase.toFixed(0)} m³. Necessita ampliação em ${anoRes20} (${anoRes20-anoAtual} anos). Volume no horizonte: ${volResH.toFixed(0)} m³.`,
      detalhe:'Método: 12h × Q·K1 (NBR 12.218)'});
  } else {
    sistemas.push({tipo:'ok',icon:'🏗️',titulo:'Reservatório — Adequado no horizonte',
      texto:`Reservatório atual (${volResBase.toFixed(0)} m³) suporta crescimento projetado sem ampliação de 20%.`,detalhe:''});
  }

  const volEteBase=vBase.vol_ete_m3;
  const anoEte20=acharAno(pop=>calcInfra(pop,p).vol_ete_m3>volEteBase*1.20);
  if(anoEte20){
    sistemas.push({tipo:anoEte20-anoAtual<=8?'crit':'warn',icon:'♻️',titulo:'ETE — Lagoa facultativa: ampliação necessária',
      texto:`Volume útil atual da lagoa: ${(volEteBase/1000).toFixed(1)} mil m³ (TDH 20d). Capacidade excedida em ${anoEte20} (${anoEte20-anoAtual} anos). Considerar novo módulo ou tecnologia complementar.`,
      detalhe:`Qesg em ${anoEte20}: ${calcInfra(state.projData.find(r=>r.ano===anoEte20)?.pop||popH,p).Qesg.toFixed(2)} L/s`});
  } else {
    sistemas.push({tipo:'ok',icon:'♻️',titulo:'ETE — Lagoa facultativa atende o horizonte',
      texto:`Capacidade atual (${(volEteBase/1000).toFixed(1)} mil m³) não exige ampliação de 20% no horizonte selecionado.`,detalhe:''});
  }

  const resBase=vBase.res_td;
  const anoRes=acharAno(pop=>calcInfra(pop,p).res_td>resBase*1.25);
  if(anoRes){
    sistemas.push({tipo:anoRes-anoAtual<=8?'warn':'info',icon:'🗑️',titulo:'Resíduos sólidos — Planejar expansão',
      texto:`Geração atual: ${resBase.toFixed(1)} ton/dia. Capacidade de 25% excedida em ${anoRes} (${anoRes-anoAtual} anos). Geração em ${horizonte}: ${calcInfra(popH,p).res_td.toFixed(1)} ton/dia.`,detalhe:''});
  } else {
    sistemas.push({tipo:'ok',icon:'🗑️',titulo:'Resíduos sólidos — Adequado no horizonte',
      texto:`Geração em ${horizonte}: ${calcInfra(popH,p).res_td.toFixed(1)} ton/dia (+${crescPct}%). Sistema atual suporta o crescimento projetado.`,detalhe:''});
  }

  const intervencoes=[];
  if(anoAmpl20)intervencoes.push({ano:anoAmpl20,acao:'Iniciar projeto de ampliação SAA',urgencia:anoAmpl20-anoAtual<=5?'crit':'warn'});
  if(anoRes20)intervencoes.push({ano:anoRes20,acao:'Ampliar reservatório de distribuição',urgencia:anoRes20-anoAtual<=8?'crit':'warn'});
  if(anoEte20)intervencoes.push({ano:anoEte20,acao:'Ampliar ETE (novo módulo de lagoa)',urgencia:anoEte20-anoAtual<=8?'crit':'warn'});
  if(anoRes)intervencoes.push({ano:anoRes,acao:'Ampliar capacidade de destinação de RSU',urgencia:'warn'});
  intervencoes.sort((a,b)=>a.ano-b.ano);

  if(intervencoes.length){
    sistemas.push({tipo:'info',icon:'📅',titulo:'Cronograma indicativo de intervenções',
      texto:intervencoes.map(i=>`${i.ano}: ${i.acao}`).join(' · '),detalhe:''});
  }

  document.getElementById('dp-cenarios-items').innerHTML=sistemas.map(s=>`
    <div class="decision-item ${s.tipo}">
      <span class="decision-icon">${s.icon}</span>
      <div class="decision-text"><strong>${s.titulo}</strong>${s.texto}${s.detalhe?`<span class="decision-year"> | ${s.detalhe}</span>`:''}</div>
    </div>`).join('');

  const ciH=calcCI(popH,rmseModel,dtH);
  document.getElementById('dp-confianca').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;">
      <div class="metric-card"><div class="metric-label">Confiança horizonte</div><div class="metric-value" style="font-size:15px;">${confiancaTexto.split(' ')[0]}</div><div class="metric-sub">${confiancaTexto}</div></div>
      <div class="metric-card accent"><div class="metric-label">IC 95% em ${horizonte}</div><div class="metric-value" style="font-size:13px;">[${Math.max(0,ciH.lower).toLocaleString('pt-BR')}–${ciH.upper.toLocaleString('pt-BR')}]</div><div class="metric-sub">±${(ciH.margin/popH*100).toFixed(1)}% da projeção central</div></div>
      <div class="metric-card"><div class="metric-label">RMSE ajuste histórico</div><div class="metric-value" style="font-size:15px;">${rmseModel.toFixed(0)}</div><div class="metric-sub">hab · Modelo: ${modelLabel[modelo]}</div></div>
    </div>
    <div class="alert alert-info" style="margin-bottom:0;font-family:var(--mono);font-size:12px;">
      <strong>Como interpretar:</strong> O IC 95% indica que, mantidas as tendências históricas, a população real em ${horizonte} estará entre 
      ${Math.max(0,ciH.lower).toLocaleString('pt-BR')} e ${ciH.upper.toLocaleString('pt-BR')} hab com 95% de probabilidade estatística. 
      ${extrapRatio>1.5?`⚠️ Projeção é ${extrapRatio.toFixed(1)}× maior que a série histórica — o IC real pode ser mais amplo.`:'A série histórica é adequada para este horizonte.'}
    </div>`;

  const scores=state.scores||{};
  document.getElementById('dp-score-modelos').innerHTML=`
    <div style="margin-bottom:10px;font-size:11px;font-family:var(--mono);color:var(--text3);">Score composto = R²×60% + (1−LOO_RMSE/μ)×40%. Modelo recomendado destacado. Clique em "Usar" para substituir manualmente.</div>
    ${['aritmetico','geometrico','logistico','holt'].map(m=>{
      const score=scores[m]||0;
      const r2=(state.r2[m]*100);
      const rmse_m=state.rmse&&state.rmse[m]?state.rmse[m]:null;
      const loo=state.loo[m];
      const looScore=loo!==null?Math.max(0,(1-loo)*100):null;
      const isBest=m===state.bestModel;
      const isOverride=state.bestModelOverride===m;
      return `<div class="score-row" style="${isBest?'background:var(--bg2);border-radius:var(--radius);padding-left:8px;':''}">
        <span class="score-name" style="${isBest?'font-weight:700;color:var(--accent);':''}">
          ${isBest?'★ ':''}${modelLabel[m]}
        </span>
        <div class="score-bars">
          <div class="score-bar-wrap"><span class="score-bar-label">R²</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${r2.toFixed(0)}%;background:${modelColors[m]};"></div></div><span style="font-size:10px;font-family:var(--mono);color:var(--text2);min-width:38px;">${r2.toFixed(1)}%</span></div>
          ${looScore!==null?`<div class="score-bar-wrap"><span class="score-bar-label">LOO</span><div class="score-bar-track"><div class="score-bar-fill" style="width:${looScore.toFixed(0)}%;background:${modelColors[m]};opacity:.5;"></div></div><span style="font-size:10px;font-family:var(--mono);color:var(--text2);min-width:38px;">${looScore.toFixed(1)}%</span></div>`:''}
          ${rmse_m!==null?`<div class="score-bar-wrap"><span class="score-bar-label" style="width:34px;">RMSE</span><span style="font-size:10px;font-family:var(--mono);color:var(--text2);">${rmse_m.toFixed(0)} hab</span></div>`:''}
        </div>
        <span class="score-chip ${score>=0.90?'a':score>=0.75?'b':'c'}">${(score*100).toFixed(0)}pts</span>
        ${isBest?'<span class="rec-badge">Selecionado</span>':'<button class="btn btn-sm" style="font-size:10px;padding:2px 8px;" onclick="overrideModel(\''+m+'\')">Usar</button>'}
      </div>`;
    }).join('')}`;
}

function overrideModel(m){
  state.bestModel=m;
  state.bestModelOverride=m;
  addAudit(`Modelo overridden manualmente: ${modelLabel[m]}`);
  renderDecisao();
}
