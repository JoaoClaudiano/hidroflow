// ══════════════════════════════════════════
// RELATÓRIO
// ══════════════════════════════════════════
function gerarRelatorio(){
  if(!state.r2||!state.censosRaw)return;
  const best=state.bestModel,d=state.censosRaw;
  const dataGer=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
  const hora=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const popH=state.projData.length?state.projData[state.projData.length-1].pop:null;
  const horizonte=document.getElementById('ano-horizonte')?.value||'—';
  const p=getParams();
  document.getElementById('print-titulo').textContent=`Memorial de Cálculo — Projeção Populacional — ${state.municipioNome}`;
  document.getElementById('print-meta').textContent=`${state.config.empresa||''} · Resp.: ${state.config.responsavel||'—'} · ${state.config.revisao} · ${dataGer} ${hora}`;
  document.getElementById('print-footer').textContent=`ProjeçãoPop v5.0 · ${state.config.responsavel||'—'} · ${state.config.empresa||'—'} · ${state.config.revisao} · ${dataGer}`;

  document.getElementById('relatorio-content').innerHTML=`
    <div class="report-section">
      <div class="report-title">1. Identificação</div>
      <table class="tbl"><tbody>
        <tr><td style="color:var(--text3);width:180px;">Município</td><td><strong>${state.municipioNome}</strong>${state.municipioUF?' — '+state.municipioUF:''}</td></tr>
        <tr><td style="color:var(--text3);">Código IBGE</td><td>${state.municipioCod||'—'}</td></tr>
        <tr><td style="color:var(--text3);">Responsável técnico</td><td>${state.config.responsavel||'—'}</td></tr>
        <tr><td style="color:var(--text3);">Empresa/órgão</td><td>${state.config.empresa||'—'}</td></tr>
        <tr><td style="color:var(--text3);">Revisão</td><td>${state.config.revisao}</td></tr>
        <tr><td style="color:var(--text3);">Data de geração</td><td>${dataGer} ${hora}</td></tr>
        <tr><td style="color:var(--text3);">Horizonte de projeto</td><td>${horizonte}</td></tr>
        ${popH?`<tr><td style="color:var(--text3);">Pop. projetada (${horizonte})</td><td><strong>${popH.toLocaleString('pt-BR')} hab</strong></td></tr>`:''}
        ${state.config.obs?`<tr><td style="color:var(--text3);">Observações</td><td>${state.config.obs}</td></tr>`:''}
        ${p.custom?`<tr><td style="color:var(--text3);">Parâmetros</td><td>Customizados (fora intervalo padrão)</td></tr>`:''}
      </tbody></table>
    </div>
    <div class="report-section">
      <div class="report-title">2. Dados históricos (IBGE/SIDRA)</div>
      <table class="tbl"><thead><tr><th>Ano</th><th>Pop. recenseada (hab)</th><th>Fonte</th></tr></thead>
      <tbody>${d.map(x=>`<tr><td>${x.ano}</td><td>${x.pop.toLocaleString('pt-BR')}</td><td>IBGE — Censo ${x.ano}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="report-section">
      <div class="report-title">3. Análise de aderência — R² e validação cruzada (LOO)</div>
      <table class="tbl"><thead><tr><th>Modelo</th><th>R²</th><th>LOO RMSE/μ</th><th>Confiabilidade</th></tr></thead>
      <tbody>${['aritmetico','geometrico','logistico','holt'].map(m=>{
        const conf=confiabilidadeLabel(state.r2[m],state.loo[m]);
        return `<tr ${m===best?'class="highlight"':''}><td>${modelLabel[m]}${m===best?' ←':''}</td><td>${(state.r2[m]*100).toFixed(2)}%</td><td>${state.loo[m]!==null?(state.loo[m]*100).toFixed(1)+'%':'—'}</td><td>${conf.label}</td></tr>`;
      }).join('')}</tbody></table>
    </div>
    <div class="report-section">
      <div class="report-title">4. Modelo selecionado: ${modelLabel[best]} (R² = ${(state.r2[best]*100).toFixed(2)}%)</div>
      ${best==='aritmetico'?`<div class="formula">P(t) = ka·t + b | Regressão OLS em todos os censos</div><div class="formula">ka = ${state.coefs.ka.toFixed(2)} hab/ano | b = ${state.coefs.b_arit.toFixed(0)} | Eq: P(t) = ${state.coefs.ka.toFixed(2)}·t + ${state.coefs.b_arit.toFixed(0)}</div>`:''}
      ${best==='geometrico'?`<div class="formula">P(t) = exp(a + b·t) | Regressão log-linear OLS (todos os censos)</div><div class="formula">i = ${(state.coefs.i_geo*100).toFixed(4)}% a.a. | a = ${(state.coefs.a_geo||0).toFixed(6)} | b = ${(state.coefs.b_geo||0).toFixed(6)}</div>`:''}
      ${best==='logistico'?`<div class="formula">P(t) = K / [1 + ((K − P₀) / P₀) · e^(−r·(t−t₀))]</div><div class="formula">K = ${state.coefs.K.toLocaleString('pt-BR')} hab | r = ${state.coefs.k_log.toFixed(6)} | P₀ = ${d[0].pop.toLocaleString('pt-BR')} hab</div>`:''}
      ${best==='holt'?`<div class="formula">Holt: L(t) = α·P(t) + (1−α)·[L(t−1)+T(t−1)] | T(t) = β·[L(t)−L(t−1)]+(1−β)·T(t−1)</div><div class="formula">α = ${state.coefs.holt.alpha} | β = ${state.coefs.holt.beta} (otimizados por grid search — minimização RMSE)</div>`:''}
      <div class="formula" style="border-left-color:var(--amber);">Score composto seleção: R²×0,6 + (1−LOO)×0,4 = ${((state.scores&&state.scores[best]||0)*100).toFixed(1)}% | RMSE ajuste = ${(state.rmse&&state.rmse[best]||0).toFixed(0)} hab</div>
    </div>
    <div class="report-section">
      <div class="report-title">5. Parâmetros de dimensionamento${p.custom?' (customizados)':''}</div>
      <table class="tbl"><tbody>
        <tr><td style="color:var(--text3);">Consumo per capita</td><td>${p.agua} L/hab/dia${p.custom&&+document.getElementById('cp-agua').value>0?' (customizado)':''}</td></tr>
        <tr><td style="color:var(--text3);">Coef. retorno esgoto</td><td>${(p.ret*100).toFixed(0)}%</td></tr>
        <tr><td style="color:var(--text3);">K1 — dia maior consumo</td><td>${p.K1}</td></tr>
        <tr><td style="color:var(--text3);">K2 — hora maior consumo</td><td>${p.K2}</td></tr>
        <tr><td style="color:var(--text3);">K3 — hora menor consumo</td><td>${p.K3}</td></tr>
        <tr><td style="color:var(--text3);">Norma referência</td><td>NBR 12.211, NBR 9.649, FUNASA Manual Saneamento</td></tr>
      </tbody></table>
    </div>
    ${popH?`<div class="report-section">
      <div class="report-title">6. Síntese do dimensionamento para ${horizonte}</div>
      <table class="tbl"><thead><tr><th>Obra / Sistema</th><th>Parâmetro de projeto</th><th>Valor</th></tr></thead>
      <tbody>${(()=>{const pop=popH,v=calcInfra(pop,p);return[
        ['SAA — Adutora principal','Vazão Q·K1',v.QK1.toFixed(2)+' L/s'],
        ['SAA — Hora de ponta','Vazão Q·K1·K2',v.QK2.toFixed(2)+' L/s'],
        ['SAA — Reservatório','Vol. regularização (12h × Q·K1)',v.vol_res_m3.toFixed(0)+' m³'],
        ['ETA','Capacidade de tratamento',v.m3dia.toFixed(0)+' m³/dia'],
        ['SES — Rede coletora','Vazão Q·K1 esgoto',v.QesgK1.toFixed(2)+' L/s'],
        ['ETE — Lagoa facultativa','Volume útil (TDH 20d)',(v.vol_ete_m3/1000).toFixed(1)+' mil m³'],
        ['Resíduos sólidos','Geração diária',v.res_td.toFixed(1)+' ton/dia'],
        ['Energia elétrica','Consumo mensal',v.en_mwh.toFixed(0)+' MWh/mês'],
      ].map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td><strong>${r[2]}</strong></td></tr>`).join('');})()}</tbody></table>
    </div>`:''}
    <div class="report-section">
      <div class="report-title">${popH?'7':'6'}. Log de auditoria</div>
      <table class="tbl"><thead><tr><th>Horário</th><th>Ação</th></tr></thead>
      <tbody>${state.auditLog.slice(-10).map(l=>`<tr><td>${l.time}</td><td>${l.action}</td></tr>`).join('')}</tbody></table>
    </div>`;
}

function imprimirRelatorio(){gerarRelatorio();setTimeout(()=>window.print(),200);}
function copiarRelatorio(){navigator.clipboard.writeText(document.getElementById('relatorio-content').innerText).then(()=>alert('Texto copiado!'));}
function exportarCSV(){
  if(!state.projData.length){alert('Calcule e projete a população primeiro.');return;}
  const cenosAnos=state.censosRaw?state.censosRaw.map(x=>x.ano):[];
  const linhas=['Ano,Populacao_hab,Tipo,Municipio'];
  state.projData.forEach(r=>linhas.push(`${r.ano},${r.pop},${cenosAnos.includes(r.ano)?'historico':'projetado'},${state.municipioNome}`));
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([linhas.join('\n')],{type:'text/csv;charset=utf-8;'}));
  a.download=`projecao_${(state.municipioNome||'municipio').replace(/\s+/g,'_')}_${new Date().getFullYear()}.csv`;
  a.click();
  addAudit('CSV exportado');
}
