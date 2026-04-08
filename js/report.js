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

function _buildPdfDoc(){
  const {jsPDF: JsPDF}=window.jspdf;
  const doc=new JsPDF({unit:'pt',format:'a4'});
  const content=document.getElementById('relatorio-content');
  const titulo=document.getElementById('print-titulo')?.textContent||'Memorial de Cálculo';
  const meta=document.getElementById('print-meta')?.textContent||'';
  const pageW=doc.internal.pageSize.getWidth();
  const margin=40;
  const maxW=pageW-margin*2;
  let y=48;

  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.setTextColor(26,79,214);
  const tituloLines=doc.splitTextToSize(titulo,maxW);
  doc.text(tituloLines,margin,y);
  y+=tituloLines.length*18+4;

  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(90,90,84);
  doc.text(meta,margin,y);
  y+=20;

  doc.setDrawColor(220,220,215);
  doc.line(margin,y,pageW-margin,y);
  y+=16;

  const sections=content?.querySelectorAll('.report-section')||[];
  doc.setFont('helvetica','normal');
  doc.setFontSize(10);
  doc.setTextColor(26,26,24);

  sections.forEach(sec=>{
    const titleEl=sec.querySelector('.report-title');
    if(titleEl){
      if(y>780){doc.addPage();y=48;}
      doc.setFont('helvetica','bold');
      doc.setFontSize(10);
      doc.setTextColor(26,79,214);
      const sLines=doc.splitTextToSize(titleEl.textContent||'',maxW);
      doc.text(sLines,margin,y);
      y+=sLines.length*14+6;
      doc.setFont('helvetica','normal');
      doc.setTextColor(26,26,24);
    }
    const rows=sec.querySelectorAll('tr');
    rows.forEach(row=>{
      if(y>790){doc.addPage();y=48;}
      const cells=Array.from(row.querySelectorAll('th,td')).map(c=>(c.textContent||'').trim());
      if(!cells.length)return;
      doc.setFontSize(9);
      const colW=maxW/Math.max(cells.length,1);
      cells.forEach((cell,i)=>{
        const cellLines=doc.splitTextToSize(cell,colW-4);
        doc.text(cellLines,margin+i*colW,y);
      });
      y+=13;
    });
    const formulas=sec.querySelectorAll('.formula');
    formulas.forEach(f=>{
      if(y>785){doc.addPage();y=48;}
      doc.setFontSize(8.5);
      doc.setTextColor(70,100,180);
      const fLines=doc.splitTextToSize(f.textContent||'',maxW-10);
      doc.setFillColor(232,238,251);
      doc.roundedRect(margin,y-10,maxW,fLines.length*12+6,2,2,'F');
      doc.text(fLines,margin+5,y);
      doc.setTextColor(26,26,24);
      y+=fLines.length*12+10;
    });
    y+=8;
  });
  return doc;
}

async function compartilharRelatorio(){
  const btn=document.getElementById('btnCompartilhar');
  const statusEl=document.getElementById('share-status');

  if(!state.r2||!state.censosRaw){
    statusEl.style.color='var(--amber)';
    statusEl.textContent='Execute o Best Fit e a Projeção antes de compartilhar o relatório.';
    return;
  }
  if(typeof window.jspdf==='undefined'||typeof window.jspdf.jsPDF==='undefined'){
    statusEl.style.color='var(--red)';
    statusEl.textContent='jsPDF não carregado. Verifique a conexão e recarregue a página.';
    return;
  }

  gerarRelatorio();

  try{
    btn.classList.add('btn-loading');
    btn.disabled=true;
    statusEl.style.color='var(--text2)';
    statusEl.textContent='Gerando PDF…';

    const doc=_buildPdfDoc();
    const nomeMun=(state.municipioNome||'Município').replace(/\s+/g,'_');
    const fileName=`Memorial_Descritivo_HidroFlow_${nomeMun}.pdf`;

    const shareTitle=`Memorial de Cálculo — ${state.municipioNome||'Município'}`;
    const shareText='Memorial de cálculo gerado pelo HidroFlow v5.0 — Dimensionamento de Sistemas de Abastecimento de Água.';

    if(navigator.share && navigator.canShare){
      const blob=new Blob([doc.output('arraybuffer')],{type:'application/pdf'});
      const file=new File([blob],fileName,{type:'application/pdf'});
      if(navigator.canShare({files:[file]})){
        statusEl.textContent='Abrindo compartilhamento…';
        await navigator.share({files:[file],title:shareTitle,text:shareText});
        statusEl.style.color='var(--green)';
        statusEl.textContent='✓ Compartilhado com sucesso.';
        addAudit('Relatório compartilhado via Web Share API');
        return;
      }
    }

    doc.save(fileName);
    statusEl.style.color='var(--green)';
    statusEl.textContent='✓ PDF baixado com sucesso.';
    addAudit('Relatório PDF baixado');
  }catch(err){
    if(err.name==='AbortError'){
      statusEl.style.color='var(--text3)';
      statusEl.textContent='Compartilhamento cancelado.';
    }else{
      console.error('Erro ao gerar PDF:',err);
      statusEl.style.color='var(--red)';
      statusEl.textContent='Erro ao gerar o PDF: '+err.message;
    }
  }finally{
    btn.classList.remove('btn-loading');
    btn.disabled=false;
  }
}
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
  try{
    const wb=XLSX.utils.book_new();

    // Sheet 1: Histórico + projeção
    const censosAnos=state.censosRaw?state.censosRaw.map(x=>x.ano):[];
    const projRows=[['Ano','Populacao (hab)','Tipo']];
    state.projData.forEach(r=>projRows.push([r.ano,r.pop,censosAnos.includes(r.ano)?'historico':'projetado']));
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(projRows),'Projecao');

    // Sheet 2: Dimensionamento
    const p=getParams();
    const popH=state.projData.length?state.projData[state.projData.length-1].pop:0;
    const horizonte=document.getElementById('ano-horizonte')?.value||'';
    const dimRows=[['Parametro','Valor']];
    if(popH){
      const v=calcInfra(popH,p);
      dimRows.push(
        ['Horizonte',horizonte],['Populacao projetada (hab)',popH],
        ['Consumo per capita (L/hab/dia)',p.agua],['K1',p.K1],['K2',p.K2],['K3',p.K3],
        ['Q*K1 aducao (L/s)',+v.QK1.toFixed(3)],['Q*K1*K2 ponta (L/s)',+v.QK2.toFixed(3)],
        ['Volume reservatorio (m3)',+v.vol_res_m3.toFixed(0)],['ETA (m3/dia)',+v.m3dia.toFixed(0)],
        ['Vazao esgoto K1 (L/s)',+v.QesgK1.toFixed(3)],['Volume ETE (m3)',+v.vol_ete_m3.toFixed(0)],
      );
    }
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(dimRows),'Dimensionamento');

    // Sheet 3: Rede (if calculated)
    if(typeof redeState!=='undefined'&&redeState.calculated&&redeState.pipes.length){
      const pipeRows=[['ID','De','Para','DN (mm)','L (m)','Q (L/s)','v (m/s)','Hf (m)']];
      redeState.pipes.forEach(pp=>pipeRows.push([
        pp.id,pp.from,pp.to,pp.dn,
        +(pp.length||0).toFixed(0),+(pp.flow||0).toFixed(3),
        +(pp.velocity||0).toFixed(3),+(pp.headloss||0).toFixed(4)
      ]));
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(pipeRows),'Rede-Trechos');
      const nodeRows=[['ID','Tipo','Cota (m)','Demanda (L/s)','Pressao (mca)']];
      redeState.nodes.forEach(n=>nodeRows.push([
        n.id,n.type,n.elevation,
        +(n.demand||0).toFixed(3),+(n.pressure||0).toFixed(1)
      ]));
      XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(nodeRows),'Rede-Nos');
    }

    const fileName=`hidroflow_${(state.municipioNome||'municipio').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
    const wbOut=XLSX.write(wb,{bookType:'xlsx',type:'array'});
    const blob=new Blob([wbOut],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);
    addAudit('Excel exportado');
  }catch(err){
    console.error('Erro ao gerar Excel:',err);
    alert('Erro ao gerar o arquivo Excel: '+err.message);
  }
}

function gerarURLCompartilhamento(){
  var data={municipioNome:state.municipioNome,municipioCod:state.municipioCod,municipioUF:state.municipioUF,censosRaw:state.censosRaw,bestModel:state.bestModel,r2:state.r2,coefs:state.coefs,projData:state.projData,config:state.config};
  try{
    var json=JSON.stringify(data);
    var encoded=btoa(unescape(encodeURIComponent(json)));
    window.location.hash='share='+encoded;
    var url=window.location.href;
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(url).then(function(){alert('Link copiado para a area de transferencia!\n\n'+url);}).catch(function(){alert('Link gerado:\n\n'+url);});
    } else {
      alert('Link gerado:\n\n'+url);
    }
  }catch(e){alert('Erro ao gerar link: '+e.message);}
}

function carregarDeURL(){
  var hash=window.location.hash;
  if(!hash||hash.indexOf('share=')!==1)return;
  var encoded=hash.slice(7);
  if(!encoded)return;
  try{
    var json=decodeURIComponent(escape(atob(encoded)));
    var data=JSON.parse(json);
    if(data.municipioNome)Object.assign(state,{municipioNome:data.municipioNome,municipioCod:data.municipioCod||'',municipioUF:data.municipioUF||'',censosRaw:data.censosRaw||null,bestModel:data.bestModel||'geometrico',r2:data.r2||state.r2,coefs:data.coefs||state.coefs,projData:data.projData||[],config:data.config||state.config});
  }catch(e){console.warn('carregarDeURL: parse error',e);}
}
