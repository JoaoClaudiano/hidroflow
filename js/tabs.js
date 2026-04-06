// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════
function showTab(id,btn){
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('sec-'+id).classList.add('active');
  btn.classList.add('active');
  if(id==='projetos')renderProjetosSalvos();
  if(id==='relatorio')gerarRelatorio();
  if(id==='mapa')renderMapa();
  if(id==='dimensionamento')renderDimensionamento();
  if(id==='decisao')renderDecisao();
  if(id==='aducao')calcAducao();
  if(id==='rede')initRede();
}
