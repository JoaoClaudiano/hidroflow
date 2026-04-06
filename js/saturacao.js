// ══════════════════════════════════════════
// SATURAÇÃO
// ══════════════════════════════════════════
function calcSaturacao(){
  const area=+document.getElementById('area-total').value,pct=+document.getElementById('pct-urban').value/100;
  const dens=+document.getElementById('densidade').value,coef=+document.getElementById('coef-aprov').value;
  const aUrban=area*pct,hect=aUrban*100,bruta=hect*dens,K=Math.round(bruta*coef);
  state.K=K;
  document.getElementById('sat-area').textContent=aUrban.toFixed(1);
  document.getElementById('sat-bruta').textContent=bruta.toLocaleString('pt-BR');
  document.getElementById('sat-k').textContent=K.toLocaleString('pt-BR');
  document.getElementById('sat-alert').textContent=`K = ${K.toLocaleString('pt-BR')} hab. Retorne a "Dados & Best Fit" e recalcule para aplicar.`;
  document.getElementById('sat-result').style.display='block';
  addAudit(`Saturação K = ${K.toLocaleString('pt-BR')} hab`);
}
