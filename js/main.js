// ══════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════
renderCensusRows();
addEvento();
document.getElementById('infra-anos').innerHTML=state.infraAnos.map((a,i)=>`<button class="btn btn-sm ${i===0?'btn-primary':''}" onclick="setInfraAno(${i},this)">${a}</button>`).join('');
renderDimensionamento();
addAudit('Aplicação iniciada (v5.0)');
