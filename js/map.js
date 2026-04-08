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

// ══════════════════════════════════════════
// PAINEL PÚBLICO — Mapa de Infraestrutura (Blob URL + Leaflet)
// ══════════════════════════════════════════
function gerarPainelPublico(){
  const lat=state.municipioLat||-3.7172;
  const lon=state.municipioLon||-38.5433;
  const nome=state.municipioNome||'Município';
  const ad=state._aducaoResult||{};
  const DN=ad.DN||'—';
  const Vtot=ad.V_total?ad.V_total.toLocaleString('pt-BR')+' m³':'—';
  const L=ad.L||3500;
  const Hman=ad.Hman?ad.Hman.toFixed(1)+' m.c.a.':'—';
  const popUlt=state.projData&&state.projData.length?state.projData[state.projData.length-1].pop:0;
  const volEte_m3=popUlt>0?Math.round(popUlt*170*0.8*20/1000):0;
  const volEte=volEte_m3>0?(volEte_m3/1000).toFixed(0)+' mil m³':'—';

  // Posições esquemáticas em torno do centroide do município
  // Grau ≈ 111 km; deslocamentos em km para cada elemento
  const deg_per_m=1/111000;
  const latRes=+(lat+(L/2)*deg_per_m).toFixed(6);
  const lonRes=+(lon).toFixed(6);
  const latCap=+(lat-(L/2)*deg_per_m).toFixed(6);
  const lonCap=+(lon+0.005).toFixed(6);
  const latEte=+(lat-0.008).toFixed(6);
  const lonEte=+(lon-0.015).toFixed(6);
  const radRes=Math.max(60,Math.sqrt(ad.V_total||1000)*3.5);

  const html=`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Painel Público — ${nome}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
#hdr{padding:14px 20px;background:#1e293b;border-bottom:2px solid #334155;display:flex;align-items:center;gap:16px}
#hdr h1{font-size:18px;color:#38bdf8;white-space:nowrap}
#hdr p{font-size:11px;color:#94a3b8}
#map{height:calc(100vh - 56px)}
.leg{position:absolute;bottom:28px;right:10px;z-index:1000;background:rgba(15,23,42,.92);color:#e2e8f0;padding:12px 16px;border-radius:8px;font-size:12px;font-family:monospace;min-width:210px;border:1px solid #334155}
.leg strong{display:block;margin-bottom:8px;font-size:13px;color:#38bdf8}
.leg div{margin:4px 0;display:flex;align-items:center;gap:8px}
.dot{width:12px;height:12px;border-radius:50%;flex-shrink:0}
.line{width:24px;height:4px;border-radius:2px;flex-shrink:0}
.nota{margin-top:10px;font-size:10px;color:#64748b;border-top:1px solid #334155;padding-top:8px}
</style>
</head><body>
<div id="hdr">
  <div>
    <h1>🏙️ ${nome} — Infraestrutura Hídrica</h1>
    <p>Gerado por HidroFlow · ${new Date().toLocaleDateString('pt-BR')} · Visualização pública para audiências e captação de recursos</p>
  </div>
</div>
<div id="map"></div>
<div class="leg">
  <strong>Legenda</strong>
  <div><span class="dot" style="background:#3b82f6"></span>Reservatório de Distribuição — ${Vtot}</div>
  <div><span class="line" style="background:#2563eb"></span>Adutora Principal — DN ${DN}mm · ${(L/1000).toFixed(1)} km</div>
  <div><span class="dot" style="background:#60a5fa;border-radius:3px"></span>Captação / Manancial</div>
  <div><span class="dot" style="background:#22c55e"></span>ETE — Lagoa Facultativa — ${volEte}</div>
  <div class="nota">⚠️ Posicionamento esquemático<br>Ref: HidroFlow / IBGE / OpenStreetMap<br>Coordenadas reais a confirmar em campo</div>
</div>
<script>
var map=L.map('map').setView([${lat},${lon}],13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://openstreetmap.org">OpenStreetMap</a>',maxZoom:19}).addTo(map);
// Município
L.marker([${lat},${lon}]).bindPopup('<b>📍 ${nome}</b>').addTo(map).openPopup();
// Reservatório
L.circle([${latRes},${lonRes}],{radius:${radRes},color:'#2563eb',fillColor:'#3b82f6',fillOpacity:0.55,weight:2}).bindPopup('<b>🏗️ Reservatório de Distribuição</b><br>Volume: ${Vtot}<br>Hman: ${Hman}').addTo(map);
// Adutora (linha captação → reservatório)
L.polyline([[${latCap},${lonCap}],[${latRes},${lonRes}]],{color:'#2563eb',weight:6,opacity:0.85,dashArray:null}).bindPopup('<b>🔧 Adutora Principal</b><br>DN ${DN} mm · ${(L/1000).toFixed(1)} km<br>Hman: ${Hman}').addTo(map);
// Captação
L.circleMarker([${latCap},${lonCap}],{radius:9,color:'#1d4ed8',fillColor:'#60a5fa',fillOpacity:0.9,weight:2}).bindPopup('<b>💧 Ponto de Captação / Manancial</b>').addTo(map);
// ETE Lagoa
var areaEte=${volEte_m3>0?volEte_m3*1000:50000};
L.circle([${latEte},${lonEte}],{radius:Math.sqrt(areaEte/Math.PI)*5,color:'#16a34a',fillColor:'#22c55e',fillOpacity:0.4,weight:2}).bindPopup('<b>♻️ ETE — Lagoa Facultativa</b><br>Volume: ${volEte}').addTo(map);
<\/script>
</body></html>`;

  const blob=new Blob([html],{type:'text/html'});
  const url=URL.createObjectURL(blob);
  window.open(url,'_blank','noopener');
}
