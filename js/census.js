// ══════════════════════════════════════════
// CENSO ROWS
// ══════════════════════════════════════════
function renderCensusRows(){
  document.getElementById('census-rows').innerHTML=state.censosData.map((d,i)=>`
    <div class="census-row">
      <div class="census-year">${d.ano}</div>
      <input type="number" value="${d.pop}" onchange="state.censosData[${i}].pop=+this.value">
      <button class="btn btn-sm btn-danger" onclick="removeCensus(${i})">✕</button>
    </div>`).join('');
}
function addCensusRow(){const last=state.censosData.length?state.censosData[state.censosData.length-1].ano+10:2022;state.censosData.push({ano:last,pop:0});renderCensusRows();}
function removeCensus(i){state.censosData.splice(i,1);renderCensusRows();}
function resetDados(){
  state.censosData=[{ano:1991,pop:78420},{ano:2000,pop:95310},{ano:2010,pop:108760},{ano:2022,pop:127500}];
  state.municipioNome='Município Exemplo';state.municipioCod='';state.municipioUF='';state.municipioLat=null;state.municipioLon=null;
  renderCensusRows();
  document.getElementById('ibge-status').textContent='';
  document.getElementById('ibge-cod').value='';
  document.getElementById('mun-busca').value='';
}
