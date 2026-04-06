// ══════════════════════════════════════════
// PROJETOS SALVOS
// ══════════════════════════════════════════

// ── localStorage quota helpers ────────────────────────────────────────────────
const _PROJ_PREFIX = 'projecaopop_';
const _QUOTA_WARN_BYTES = 4 * 1024 * 1024; // warn at ~4 MB used

/** Estimate current localStorage usage in bytes. */
function _lsUsedBytes() {
  let total = 0;
  for (const k of Object.keys(localStorage)) {
    total += (localStorage.getItem(k) || '').length * 2; // UTF-16
  }
  return total;
}

/**
 * Safe localStorage setter with quota detection.
 * Returns true on success, false on QuotaExceededError (alerts the user).
 */
function _lsSet(key, value) {
  try {
    localStorage.setItem(key, value);
    const used = _lsUsedBytes();
    if (used > _QUOTA_WARN_BYTES) {
      const usedMB = (used / 1024 / 1024).toFixed(1);
      console.warn(`localStorage: ~${usedMB} MB usado. Considere excluir projetos antigos.`);
    }
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      alert('Armazenamento local cheio. Por favor, exclua projetos antigos antes de salvar novos.');
    } else {
      alert('Erro ao salvar: ' + e.message);
    }
    return false;
  }
}

function salvarProjeto(){
  const nome=state.municipioNome+' — '+new Date().toLocaleDateString('pt-BR');
  const snap={nome,ts:Date.now(),municipioNome:state.municipioNome,municipioCod:state.municipioCod,municipioUF:state.municipioUF,municipioLat:state.municipioLat,municipioLon:state.municipioLon,censosData:state.censosData,bestModel:state.bestModel,r2:state.r2,loo:state.loo,coefs:state.coefs,projData:state.projData,censosRaw:state.censosRaw,K:state.K,config:state.config,infraAnos:state.infraAnos};
  if(_lsSet(_PROJ_PREFIX+Date.now(),JSON.stringify(snap))){
    addAudit('Projeto salvo: '+nome);
    alert('Projeto salvo!');
    renderProjetosSalvos();
  }
}

function renderProjetosSalvos(){
  const container=document.getElementById('proj-list-container');
  const keys=Object.keys(localStorage).filter(k=>k.startsWith(_PROJ_PREFIX)).sort((a,b)=>b.localeCompare(a));

  if(!keys.length){container.innerHTML='<div class="alert alert-info">Nenhum projeto salvo ainda.</div>';}
  else{
    const items=[];
    const corrupt=[];
    keys.forEach(k=>{
      let p=null;
      try{p=JSON.parse(localStorage.getItem(k));}catch(e){corrupt.push(k);}
      if(!p)return;
      items.push(`<div class="proj-item"><div><div class="proj-item-name">${safeHtml(p.nome||p.municipioNome)}</div><div class="proj-item-meta">${safeHtml(new Date(p.ts).toLocaleString('pt-BR'))} · ${p.censosData?.length||0} censos · ${safeHtml(modelLabel[p.bestModel]||p.bestModel)}</div></div><button class="btn btn-sm btn-primary" onclick="carregarProjeto('${escHtml(k)}')">Carregar</button><button class="btn btn-sm btn-danger" onclick="excluirProjeto('${escHtml(k)}')">✕</button></div>`);
    });
    let html='<div class="proj-list">'+items.join('')+'</div>';
    if(corrupt.length){
      html+=`<div class="alert alert-warning" style="margin-top:8px;font-size:12px;">⚠ ${corrupt.length} projeto(s) corrompido(s) encontrado(s) e ignorado(s). <button class="btn btn-sm" onclick="limparProjetosCorretos()">Remover corrompidos</button></div>`;
      // Store corrupt keys on the container for the cleanup handler
      container.dataset.corrupt=JSON.stringify(corrupt);
    }
    container.innerHTML=html;
    // Quota warning
    const usedMB=(_lsUsedBytes()/1024/1024).toFixed(1);
    if(_lsUsedBytes()>_QUOTA_WARN_BYTES){
      container.insertAdjacentHTML('beforeend',`<div class="alert alert-warning" style="margin-top:8px;font-size:12px;">⚠ Armazenamento local: ~${usedMB} MB usado. Exclua projetos antigos para liberar espaço.</div>`);
    }
  }

  const auditEl=document.getElementById('audit-log');
  const userShort=safeHtml(state.config.responsavel?.split(' ')[0]||'—');
  auditEl.innerHTML=state.auditLog.length?state.auditLog.slice().reverse().map(l=>`<div class="audit-row"><span class="audit-time">${safeHtml(l.time)}</span><span class="audit-action">${safeHtml(l.action)}</span><span class="audit-user">${userShort}</span></div>`).join(''):'<div style="font-size:12px;color:var(--text3);font-family:var(--mono);">Nenhuma ação registrada.</div>';
}

/** Remove corrupted project entries detected during the last renderProjetosSalvos(). */
function limparProjetosCorretos(){
  const container=document.getElementById('proj-list-container');
  let corrupt=[];
  try{corrupt=JSON.parse(container.dataset.corrupt||'[]');}catch(_){}
  if(!corrupt.length){renderProjetosSalvos();return;}
  if(!confirm(`Remover ${corrupt.length} entrada(s) corrompida(s)? Esta ação não pode ser desfeita.`))return;
  corrupt.forEach(k=>localStorage.removeItem(k));
  renderProjetosSalvos();
}

function carregarProjeto(key){
  let raw=null;
  try{raw=localStorage.getItem(key);}catch(e){alert('Erro ao ler projeto: '+e.message);return;}
  if(!raw){alert('Projeto não encontrado.');return;}
  let p=null;
  try{p=JSON.parse(raw);}catch(e){
    alert('Projeto corrompido e não pode ser carregado. Exclua-o e tente novamente.');
    return;
  }
  try{
    Object.assign(state,{censosData:p.censosData,municipioNome:p.municipioNome,municipioCod:p.municipioCod,municipioUF:p.municipioUF,municipioLat:p.municipioLat||null,municipioLon:p.municipioLon||null,bestModel:p.bestModel,r2:p.r2,rmse:p.rmse||{aritmetico:0,geometrico:0,logistico:0,holt:0},scores:p.scores||{aritmetico:0,geometrico:0,logistico:0,holt:0},loo:p.loo||{aritmetico:null,geometrico:null,logistico:null,holt:null},coefs:p.coefs,projData:p.projData,censosRaw:p.censosRaw,K:p.K,config:p.config||state.config,infraAnos:p.infraAnos||state.infraAnos});
    renderCensusRows();
    if(state.censosRaw){
      const d=state.censosRaw,anos=d.map(x=>x.ano),pops=d.map(x=>x.pop),P0=pops[0];
      const pa=anos.map(a=>Math.round(state.coefs.b_arit+state.coefs.ka*a));
      const pg=anos.map(a=>Math.round(P0*Math.pow(1+state.coefs.i_geo,a-anos[0])));
      const K=state.coefs.K||P0*2.5;
      const pl=anos.map(a=>Math.round(K/(1+((K-P0)/P0)*Math.exp(-state.coefs.k_log*(a-anos[0])))));
      const ph=state.coefs.holt?state.coefs.holt.pred:pops;
      renderBestFit(d,pa,pg,pl,ph);
      document.getElementById('bestfit-result').style.display='block';
    }
    if(state.config.responsavel)document.getElementById('responsavel-badge').textContent='Resp.: '+state.config.responsavel.split('—')[0].trim();
    document.getElementById('infra-anos').innerHTML=state.infraAnos.map((a,i)=>`<button class="btn btn-sm ${i===0?'btn-primary':''}" onclick="setInfraAno(${i},this)">${a}</button>`).join('');
    addAudit('Projeto carregado: '+p.nome);
    alert('Projeto carregado: '+p.nome);
    showTab('dados',document.querySelectorAll('.tab')[1]);
  }catch(e){alert('Erro ao restaurar projeto: '+e.message);}
}

function excluirProjeto(key){if(!confirm('Excluir este projeto?'))return;localStorage.removeItem(key);renderProjetosSalvos();}
