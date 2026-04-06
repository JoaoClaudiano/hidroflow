// ══════════════════════════════════════════
// SATURAÇÃO
// ══════════════════════════════════════════
function calcSaturacao(){
  const area=+document.getElementById('area-total').value;
  const pctRaw=+document.getElementById('pct-urban').value;
  const dens=+document.getElementById('densidade').value;
  const coef=+document.getElementById('coef-aprov').value;

  // ── Validation ──────────────────────────────────────────────────────────────
  const errors=[];
  if(!area||area<=0)errors.push('Área total deve ser maior que zero.');
  if(isNaN(pctRaw)||pctRaw<=0||pctRaw>100)errors.push('Taxa de urbanização deve ser maior que 0 e até 100%.');
  if(!dens||dens<=0)errors.push('Densidade habitacional deve ser maior que zero.');
  if(!coef||coef<=0||coef>1)errors.push('Coeficiente de aproveitamento deve estar entre 0 e 1.');

  if(errors.length){
    const alertEl=document.getElementById('sat-alert');
    if(alertEl){alertEl.textContent='Erro: '+errors.join(' ');}
    document.getElementById('sat-result').style.display='block';
    return;
  }

  const pct=pctRaw/100;
  const aUrban=area*pct,hect=aUrban*100,bruta=hect*dens,K=Math.round(bruta*coef);
  state.K=K;
  if(state.coefs)state.coefs.K=K;
  document.getElementById('sat-area').textContent=aUrban.toFixed(1);
  document.getElementById('sat-bruta').textContent=bruta.toLocaleString('pt-BR');
  document.getElementById('sat-k').textContent=K.toLocaleString('pt-BR');
  addAudit(`Saturação K = ${K.toLocaleString('pt-BR')} hab`);
  if(state.censosRaw){
    calcBestFit();
    document.getElementById('sat-alert').textContent=`K = ${K.toLocaleString('pt-BR')} hab aplicado — Best Fit recalculado automaticamente.`;
  } else {
    document.getElementById('sat-alert').textContent=`K = ${K.toLocaleString('pt-BR')} hab. Retorne a "Dados & Best Fit" e calcule para aplicar.`;
  }
  document.getElementById('sat-result').style.display='block';
}
