// ══════════════════════════════════════════
// MAPA & DENSIDADE (Leaflet)
// ══════════════════════════════════════════
function renderMapa(){
  if(!state.municipioLat||!state.municipioLon){
    document.getElementById('mapa-info').textContent='Coordenadas não disponíveis. Carregue os dados do município pela busca SIDRA para ativar o mapa.';
    return;
  }
  const lat=state.municipioLat,lon=state.municipioLon;
  const mapaEl=document.getElementById('mapa-municipio');

  if(state.mapaL){state.mapaL.remove();state.mapaL=null;}
  const map=L.map(mapaEl).setView([lat,lon],11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);
  L.marker([lat,lon]).addTo(map).bindPopup(`<b>${state.municipioNome}</b><br>${state.municipioUF}`).openPopup();
  state.mapaL=map;

  const d=state.censosRaw||state.censosData.filter(x=>x.pop>0).sort((a,b)=>a.ano-b.ano);
  const popRec=d[d.length-1];
  const areaInput=+document.getElementById('area-total').value||null;

  document.getElementById('mapa-info').innerHTML=`
    <strong>${state.municipioNome} — ${state.municipioUF}</strong> · Código IBGE: ${state.municipioCod||'—'}<br>
    Coordenadas: ${lat.toFixed(4)}, ${lon.toFixed(4)} · Pop. ${popRec.ano}: ${popRec.pop.toLocaleString('pt-BR')} hab
    ${areaInput?`· Área informada: ${areaInput} km²`:''}`;

  const dens=areaInput&&popRec?popRec.pop/areaInput:null;
  document.getElementById('densidade-cards').innerHTML=[
    {label:`Pop. ${popRec.ano}`,val:popRec.pop.toLocaleString('pt-BR'),sub:'habitantes',cls:'accent'},
    {label:'Densidade atual',val:dens?dens.toFixed(1):'—',sub:'hab/km² '+(areaInput?'':'(informe área na aba Saturação)'),cls:'green'},
    {label:'Crescimento geométrico',val:state.coefs.i_geo?(+(state.coefs.i_geo*100).toFixed(3))+'% a.a.':'—',sub:'taxa anual',cls:'amber'},
    {label:'Ano último censo',val:String(popRec.ano),sub:'fonte: IBGE/SIDRA',cls:''},
  ].map(c=>`<div class="metric-card ${c.cls}"><div class="metric-label">${c.label}</div><div class="metric-value">${c.val}</div><div class="metric-sub">${c.sub}</div></div>`).join('');

  if(areaInput&&d.length>1){
    if(state.charts.densidade)state.charts.densidade.destroy();
    state.charts.densidade=new Chart(document.getElementById('chart-densidade'),{
      type:'line',
      data:{labels:d.map(x=>x.ano),datasets:[{label:'Densidade (hab/km²)',data:d.map(x=>+(x.pop/areaInput).toFixed(1)),borderColor:'#1D9E75',borderWidth:2.5,pointRadius:5,fill:false,tension:0}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:'hab/km²',font:{size:11}}}}}
    });
  }
}
