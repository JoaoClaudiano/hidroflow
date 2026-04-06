// ══════════════════════════════════════════
// CONFIGURAÇÕES
// ══════════════════════════════════════════
function abrirConfiguracoes(){
  document.getElementById('cfg-responsavel').value=state.config.responsavel;
  document.getElementById('cfg-empresa').value=state.config.empresa;
  document.getElementById('cfg-revisao').value=state.config.revisao;
  document.getElementById('cfg-obs').value=state.config.obs;
  document.getElementById('modal-config').classList.add('open');
}
function fecharModal(id){document.getElementById(id).classList.remove('open');}
function salvarConfiguracoes(){
  state.config.responsavel=document.getElementById('cfg-responsavel').value;
  state.config.empresa=document.getElementById('cfg-empresa').value;
  state.config.revisao=document.getElementById('cfg-revisao').value;
  state.config.obs=document.getElementById('cfg-obs').value;
  document.getElementById('responsavel-badge').textContent=state.config.responsavel?'Resp.: '+state.config.responsavel.split('—')[0].trim():'Responsável: —';
  fecharModal('modal-config');
  addAudit('Configurações atualizadas');
}
