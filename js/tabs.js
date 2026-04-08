// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════
function showTab(id,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>{t.classList.remove('active');t.setAttribute('aria-selected','false');});
  document.getElementById('sec-'+id).classList.add('active');
  btn.classList.add('active');
  btn.setAttribute('aria-selected','true');
  btn.setAttribute('aria-controls','sec-'+id);
  if(id==='projetos')renderProjetosSalvos();
  if(id==='relatorio')gerarRelatorio();
  if(id==='mapa')renderMapa();
  if(id==='dimensionamento')renderDimensionamento();
  if(id==='decisao')renderDecisao();
  if(id==='aducao')calcAducao();
  if(id==='rede')initRede();
}
