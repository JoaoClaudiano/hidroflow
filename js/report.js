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
  document.getElementById('print-footer').textContent=`HidroFlow v5.0 · ${state.config.responsavel||'—'} · ${state.config.empresa||'—'} · ${state.config.revisao} · ${dataGer}`;

  const sNome=safeHtml(state.municipioNome),sUF=safeHtml(state.municipioUF),sCod=safeHtml(state.municipioCod||'—');
  const sResp=safeHtml(state.config.responsavel||'—'),sEmp=safeHtml(state.config.empresa||''),sRev=safeHtml(state.config.revisao);
  const sObs=safeHtml(state.config.obs||'');
  let sectionNum=0;
  const sec=(title)=>`<div class="report-section"><div class="report-title">${++sectionNum}. ${title}</div>`;
  document.getElementById('relatorio-content').innerHTML=`
    ${sec('Identificação')}
      <table class="tbl"><tbody>
        <tr><td style="color:var(--text3);width:180px;">Município</td><td><strong>${sNome}</strong>${sUF?' — '+sUF:''}</td></tr>
        <tr><td style="color:var(--text3);">Código IBGE</td><td>${sCod}</td></tr>
        <tr><td style="color:var(--text3);">Responsável técnico</td><td>${sResp}</td></tr>
        <tr><td style="color:var(--text3);">Empresa/órgão</td><td>${sEmp||'—'}</td></tr>
        <tr><td style="color:var(--text3);">Revisão</td><td>${sRev}</td></tr>
        <tr><td style="color:var(--text3);">Data de geração</td><td>${safeHtml(dataGer)} ${safeHtml(hora)}</td></tr>
        <tr><td style="color:var(--text3);">Horizonte de projeto</td><td>${safeHtml(horizonte)}</td></tr>
        ${popH?`<tr><td style="color:var(--text3);">Pop. projetada (${safeHtml(horizonte)})</td><td><strong>${popH.toLocaleString('pt-BR')} hab</strong></td></tr>`:''}
        ${sObs?`<tr><td style="color:var(--text3);">Observações</td><td>${sObs}</td></tr>`:''}
        ${p.custom?`<tr><td style="color:var(--text3);">Parâmetros</td><td>Customizados (fora intervalo padrão)</td></tr>`:''}
      </tbody></table>
    </div>
    ${sec('Dados históricos (IBGE/SIDRA)')}
      <table class="tbl"><thead><tr><th>Ano</th><th>Pop. recenseada (hab)</th><th>Fonte</th></tr></thead>
      <tbody>${d.map(x=>`<tr><td>${x.ano}</td><td>${x.pop.toLocaleString('pt-BR')}</td><td>IBGE — Censo ${x.ano}</td></tr>`).join('')}</tbody></table>
    </div>
    ${sec('Análise de aderência — R² e validação cruzada (LOO)')}
      <table class="tbl"><thead><tr><th>Modelo</th><th>R²</th><th>LOO RMSE/μ</th><th>Confiabilidade</th></tr></thead>
      <tbody>${['aritmetico','geometrico','logistico','holt'].map(m=>{
        const conf=confiabilidadeLabel(state.r2[m],state.loo[m]);
        return `<tr ${m===best?'class="highlight"':''}><td>${modelLabel[m]}${m===best?' ←':''}</td><td>${(state.r2[m]*100).toFixed(2)}%</td><td>${state.loo[m]!==null?(state.loo[m]*100).toFixed(1)+'%':'—'}</td><td>${conf.label}</td></tr>`;
      }).join('')}</tbody></table>
    </div>
    ${sec(`Modelo selecionado: ${modelLabel[best]} (R² = ${(state.r2[best]*100).toFixed(2)}%)`)}
      ${best==='aritmetico'?`<div class="formula">P(t) = ka·t + b | Regressão OLS em todos os censos</div><div class="formula">ka = ${state.coefs.ka.toFixed(2)} hab/ano | b = ${state.coefs.b_arit.toFixed(0)} | Eq: P(t) = ${state.coefs.ka.toFixed(2)}·t + ${state.coefs.b_arit.toFixed(0)}</div>`:''}
      ${best==='geometrico'?`<div class="formula">P(t) = exp(a + b·t) | Regressão log-linear OLS (todos os censos)</div><div class="formula">i = ${(state.coefs.i_geo*100).toFixed(4)}% a.a. | a = ${(state.coefs.a_geo||0).toFixed(6)} | b = ${(state.coefs.b_geo||0).toFixed(6)}</div>`:''}
      ${best==='logistico'?`<div class="formula">P(t) = K / [1 + ((K − P₀) / P₀) · e^(−r·(t−t₀))]</div><div class="formula">K = ${state.coefs.K.toLocaleString('pt-BR')} hab | r = ${state.coefs.k_log.toFixed(6)} | P₀ = ${d[0].pop.toLocaleString('pt-BR')} hab</div>`:''}
      ${best==='holt'?`<div class="formula">Holt: L(t) = α·P(t) + (1−α)·[L(t−1)+T(t−1)] | T(t) = β·[L(t)−L(t−1)]+(1−β)·T(t−1)</div><div class="formula">α = ${state.coefs.holt.alpha} | β = ${state.coefs.holt.beta} (otimizados por grid search — minimização RMSE)</div>`:''}
      <div class="formula" style="border-left-color:var(--amber);">Score composto seleção: R²×0,6 + (1−LOO)×0,4 = ${((state.scores&&state.scores[best]||0)*100).toFixed(1)}% | RMSE ajuste = ${(state.rmse&&state.rmse[best]||0).toFixed(0)} hab</div>
    </div>
    ${sec(`Parâmetros de dimensionamento${p.custom?' (customizados)':''}`)}
      <table class="tbl"><tbody>
        <tr><td style="color:var(--text3);">Consumo per capita</td><td>${p.agua} L/hab/dia${p.custom&&+document.getElementById('cp-agua').value>0?' (customizado)':''}</td></tr>
        <tr><td style="color:var(--text3);">Coef. retorno esgoto</td><td>${(p.ret*100).toFixed(0)}%</td></tr>
        <tr><td style="color:var(--text3);">K1 — dia maior consumo</td><td>${p.K1}</td></tr>
        <tr><td style="color:var(--text3);">K2 — hora maior consumo</td><td>${p.K2}</td></tr>
        <tr><td style="color:var(--text3);">K3 — hora menor consumo</td><td>${p.K3}</td></tr>
        <tr><td style="color:var(--text3);">Norma referência</td><td>NBR 12.211, NBR 9.649, FUNASA Manual Saneamento</td></tr>
      </tbody></table>
    </div>
    ${popH?`${sec(`Síntese do dimensionamento para ${safeHtml(horizonte)}`)}
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
    ${sec('Log de auditoria')}
      <table class="tbl"><thead><tr><th>Horário</th><th>Ação</th></tr></thead>
      <tbody>${state.auditLog.slice(-10).map(l=>`<tr><td>${safeHtml(l.time)}</td><td>${safeHtml(l.action)}</td></tr>`).join('')}</tbody></table>
    </div>`;
}

function imprimirRelatorio(){gerarRelatorio();setTimeout(()=>window.print(),200);}
function copiarRelatorio(){navigator.clipboard.writeText(document.getElementById('relatorio-content').innerText).then(()=>alert('Texto copiado!'));}
function exportarCSV(){
  if(!state.projData.length){alert('Calcule e projete a população primeiro.');return;}
  const censosAnos=state.censosRaw?state.censosRaw.map(x=>x.ano):[];
  const linhas=['Ano,Populacao_hab,Tipo,Municipio'];
  state.projData.forEach(r=>linhas.push(`${r.ano},${r.pop},${censosAnos.includes(r.ano)?'historico':'projetado'},${state.municipioNome}`));
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([linhas.join('\n')],{type:'text/csv;charset=utf-8;'}));
  a.download=`projecao_${(state.municipioNome||'municipio').replace(/\s+/g,'_')}_${new Date().getFullYear()}.csv`;
  a.click();
  addAudit('CSV exportado');
}

function exportarExcel(){
  if(typeof XLSX==='undefined'){alert('SheetJS não carregado. Verifique a conexão com internet e recarregue a página.');return;}
  if(!state.projData.length){alert('Calcule e projete a população primeiro.');return;}
  const wb=XLSX.utils.book_new();

  // Sheet 1: Histórico + projeção
  const censosAnos=state.censosRaw?state.censosRaw.map(x=>x.ano):[];
  const projRows=[['Ano','Populacao (hab)','Tipo']];
  state.projData.forEach(r=>projRows.push([r.ano,r.pop,censosAnos.includes(r.ano)?'historico':'projetado']));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(projRows),'Projeção');

  // Sheet 2: Dimensionamento
  const p=getParams();
  const popH=state.projData.length?state.projData[state.projData.length-1].pop:0;
  const horizonte=document.getElementById('ano-horizonte')?.value||'—';
  const dimRows=[['Parâmetro','Valor']];
  if(popH){
    const v=calcInfra(popH,p);
    dimRows.push(
      ['Horizonte',horizonte],['População projetada (hab)',popH],
      ['Consumo per capita (L/hab/dia)',p.agua],['K1',p.K1],['K2',p.K2],['K3',p.K3],
      ['Q·K1 adução (L/s)',+v.QK1.toFixed(3)],['Q·K1·K2 ponta (L/s)',+v.QK2.toFixed(3)],
      ['Volume reservatório (m³)',+v.vol_res_m3.toFixed(0)],['ETA (m³/dia)',+v.m3dia.toFixed(0)],
      ['Vazão esgoto K1 (L/s)',+v.QesgK1.toFixed(3)],['Volume ETE (m³)',+v.vol_ete_m3.toFixed(0)],
    );
  }
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dimRows),'Dimensionamento');

  // Sheet 3: Rede (if calculated)
  if(typeof redeState!=='undefined'&&redeState.calculated&&redeState.pipes.length){
    const pipeRows=[['ID','De','Para','DN (mm)','L (m)','Q (L/s)','v (m/s)','Hf (m)']];
    redeState.pipes.forEach(pp=>pipeRows.push([pp.id,pp.from,pp.to,pp.dn,+pp.length.toFixed(0),+pp.flow.toFixed(3),+pp.velocity.toFixed(3),+pp.headloss.toFixed(4)]));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(pipeRows),'Rede-Trechos');
    const nodeRows=[['ID','Tipo','Cota (m)','Demanda (L/s)','Pressão (mca)']];
    redeState.nodes.forEach(n=>nodeRows.push([n.id,n.type,n.elevation,+n.demand.toFixed(3),+n.pressure.toFixed(1)]));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(nodeRows),'Rede-Nós');
  }

  XLSX.writeFile(wb,`hidroflow_${(state.municipioNome||'municipio').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
  addAudit('Excel exportado');
}
