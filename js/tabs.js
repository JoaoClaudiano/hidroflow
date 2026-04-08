// ══════════════════════════════════════════
// TABS
// ══════════════════════════════════════════

// Maps each tab id to its accordion group id
var TAB_GROUP_MAP = {
  'decisao':'diagnostico','dados':'diagnostico','projecao':'diagnostico','comparacao':'diagnostico',
  'dimensionamento':'hidraulica','aducao':'hidraulica','rede':'hidraulica','saturacao':'hidraulica',
  'avancados':'avancado','eventos':'avancado','mapa':'avancado',
  'relatorio':'saidas','projetos':'saidas'
};

function showTabGroup(groupId, btn) {
  document.querySelectorAll('.tab-items').forEach(function(el){el.classList.remove('open');});
  document.querySelectorAll('.tab-grp').forEach(function(b){b.classList.remove('active-grp');});
  var groupEl = document.getElementById('tg-'+groupId);
  if(groupEl) groupEl.classList.add('open');
  if(btn) btn.classList.add('active-grp');
}

function showTab(id,btn){
  // Ensure the correct group is expanded
  var groupId = TAB_GROUP_MAP[id];
  if(groupId){
    var groupBtn = document.getElementById('tg-btn-'+groupId);
    showTabGroup(groupId, groupBtn);
  }
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

// Navigate to a tab by id without needing a button reference
function showTabById(id){
  var allTabs=document.querySelectorAll('.tab');
  for(var i=0;i<allTabs.length;i++){
    var oc=allTabs[i].getAttribute('onclick')||'';
    if(oc.indexOf("'"+id+"'")!==-1){showTab(id,allTabs[i]);return;}
  }
}
