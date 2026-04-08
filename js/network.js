// ══════════════════════════════════════════
// REDE DE DISTRIBUIÇÃO — Editor + Hardy-Cross
// ══════════════════════════════════════════
const redeState = {
  map: null, nodes: [], pipes: [],
  tool: 'pan', nodeType: 'junction',
  pipeStart: null, selectedId: null,
  layers: { nodes: {}, pipes: {} },
  calculated: false
};

function initRede(){
  _initInfoTip();
  if(redeState.map){
    redeState.map.invalidateSize();
    if(state.municipioLat&&state.municipioLon){
      redeState.map.setView([state.municipioLat,state.municipioLon],14);
    }
    return;
  }
  const center = state.municipioLat&&state.municipioLon
    ? [state.municipioLat, state.municipioLon] : [-3.7172, -38.5433]; // Fortaleza default
  redeState.map = L.map('rede-map', {zoomControl:true}).setView(center, 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {attribution:'© OpenStreetMap', maxZoom:19}).addTo(redeState.map);
  redeState.map.on('click', onMapClick);
  redeState.map.on('mousemove', onMapMove);
  updateRedeStatus('Mapa pronto. Selecione uma ferramenta para começar.');
}

function setTool(tool, btn){
  redeState.tool = tool;
  redeState.pipeStart = null;
  redeState._measurePt1 = null; // reset measure state
  if(redeState._tempLine){ redeState._tempLine.remove(); redeState._tempLine = null; }
  if(redeState._measureMarker){ redeState._measureMarker.remove(); redeState._measureMarker = null; }
  document.querySelectorAll('.rede-toolbar .btn').forEach(b=>b.classList.remove('active-tool'));
  if(btn) btn.classList.add('active-tool');
  const cursor = tool==='pan'?'':'crosshair';
  if(redeState.map){
    redeState.map.getContainer().style.cursor = cursor;
    if(tool==='pan') redeState.map.dragging.enable();
    else redeState.map.dragging.disable();
  }
  const statusMsgs={
    pan:'Pan ativo — arraste o mapa',
    node:'Clique no mapa para adicionar um nó',
    pipe:'Clique no nó de origem do trecho',
    select:'Clique num nó ou trecho para editar',
    measure:'🔺 Clique no ponto 1 (origem) — distância Haversine + altimetria Open-Elevation'
  };
  updateRedeStatus(statusMsgs[tool]||'');
}

function setNodeType(type, btn){
  redeState.nodeType = type;
  document.querySelectorAll('.node-type-btn').forEach(b=>b.classList.remove('selected'));
  if(btn) btn.classList.add('selected');
}

function onMapClick(e){
  const tool = redeState.tool;
  if(tool === 'node') addNode(e.latlng);
  else if(tool === 'pipe') handlePipeClick(e.latlng);
  else if(tool === 'select'){
    const nearest = findNearestNode(e.latlng, 30);
    if(!nearest) showRedeToast('Clique diretamente sobre um nó ou trecho para selecionar.');
  } else if(tool === 'measure') handleMeasureClick(e.latlng);
}

function onMapMove(e){
  if(redeState.tool === 'pipe' && redeState.pipeStart){
    const start = redeState.nodes.find(n=>n.id===redeState.pipeStart);
    if(!start) return;
    if(redeState._tempLine) redeState._tempLine.remove();
    redeState._tempLine = L.polyline([[start.lat,start.lng],[e.latlng.lat,e.latlng.lng]],
      {color:'#888',weight:2,dashArray:'5,5',opacity:.6}).addTo(redeState.map);
  }
}

let _redeIdCounter = 1;
function uid(prefix){ return prefix + '_' + (_redeIdCounter++); }

function nodeIcon(type, color, selected){
  const colors = {reservoir:'#1a4fd6', tank:'#0e7490', junction:color||'#5a5a54'};
  const c = colors[type]||'#5a5a54';
  const border = selected ? '3px solid #f59e0b' : '2px solid #fff';
  const shadow = selected ? '0 0 0 2px #f59e0b, 0 2px 6px rgba(0,0,0,.5)' : '0 1px 4px rgba(0,0,0,.4)';
  return L.divIcon({
    html:`<div style="width:18px;height:18px;background:${c};border:${border};border-radius:${type==='junction'?'50%':'3px'};box-shadow:${shadow};display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700;">${type==='reservoir'?'R':type==='tank'?'T':''}</div>`,
    iconSize:[18,18], iconAnchor:[9,9], className:''
  });
}

function addNode(latlng){
  const id = uid('N');
  const node = {
    id, type: redeState.nodeType,
    lat: latlng.lat, lng: latlng.lng,
    elevation: 10, demand: 0, head: 0, pressure: 0,
    label: id
  };
  redeState.nodes.push(node);
  renderNode(node);
  redeState.calculated = false;
  updateRedeStatus(`Nó ${id} adicionado (${redeState.nodeType})`);
}

function renderNode(node){
  if(redeState.layers.nodes[node.id]) redeState.layers.nodes[node.id].remove();
  const color = node.calculated
    ? (node.pressure < 10 || node.pressure > 50 ? '#ef4444' : node.pressure > 40 ? '#f59e0b' : '#22c55e')
    : (node.type==='reservoir'?'#1a4fd6':node.type==='tank'?'#0e7490':'#5a5a54');
  const selected = redeState.selectedId?.type==='node' && redeState.selectedId?.id===node.id;
  const marker = L.marker([node.lat, node.lng], {
    icon: nodeIcon(node.type, color, selected), draggable: redeState.tool==='select'
  }).addTo(redeState.map);

  const popupContent = `<div style="font-family:monospace;font-size:11px;min-width:160px;">
    <strong>${node.label||node.id}</strong> — ${node.type}<br>
    Cota: ${node.elevation} m | Demanda: ${node.demand.toFixed(3)} L/s
    ${node.calculated?`<br><strong style="color:${color};">Pressão: ${node.pressure.toFixed(1)} mca</strong>`:''}
  </div>`;
  marker.bindPopup(popupContent, {maxWidth:220});
  marker.on('click', (ev)=>{
    if(redeState.tool==='pipe') handlePipeClick({lat:node.lat, lng:node.lng}, node.id);
    else if(redeState.tool==='select'){
      L.DomEvent.stopPropagation(ev);
      selectElement('node', node.id);
    }
  });
  marker.on('dragend', (ev)=>{
    const ll = ev.target.getLatLng();
    node.lat = ll.lat; node.lng = ll.lng;
    rerenderPipesForNode(node.id);
  });
  redeState.layers.nodes[node.id] = marker;
}

function handlePipeClick(latlng, nodeId){
  if(!redeState.pipeStart){
    const nearest = findNearestNode(latlng, 30);
    if(!nearest){ updateRedeStatus('Clique num nó existente para iniciar o trecho.'); return; }
    redeState.pipeStart = nearest.id;
    updateRedeStatus(`Trecho iniciado em ${nearest.id}. Clique no nó destino.`);
  } else {
    const nearest = findNearestNode(latlng, 30);
    if(!nearest){ updateRedeStatus('Clique num nó existente para terminar o trecho.'); return; }
    if(nearest.id === redeState.pipeStart){ updateRedeStatus('Selecione um nó diferente.'); return; }
    addPipe(redeState.pipeStart, nearest.id);
    redeState.pipeStart = null;
    if(redeState._tempLine){ redeState._tempLine.remove(); redeState._tempLine = null; }
  }
}

function findNearestNode(latlng, pixelThreshold){
  let best = null, bestDist = Infinity;
  redeState.nodes.forEach(n=>{
    const p = redeState.map.latLngToContainerPoint([n.lat,n.lng]);
    const q = redeState.map.latLngToContainerPoint(latlng);
    const d = Math.hypot(p.x-q.x, p.y-q.y);
    if(d < bestDist && d < pixelThreshold){ bestDist=d; best=n; }
  });
  return best;
}

function addPipe(fromId, toId){
  const existing = redeState.pipes.find(p=>(p.from===fromId&&p.to===toId)||(p.from===toId&&p.to===fromId));
  if(existing){ updateRedeStatus('Trecho já existe entre esses nós.'); return; }
  const id = uid('P');
  const nA = redeState.nodes.find(n=>n.id===fromId);
  const nB = redeState.nodes.find(n=>n.id===toId);
  const L_m = redeState.map.distance([nA.lat,nA.lng],[nB.lat,nB.lng]);
  const pipe = {
    id, from:fromId, to:toId,
    length: L_m, dn: +document.getElementById('pipe-dn-default').value,
    c: +document.getElementById('pipe-c-default').value,
    flow: 0, velocity: 0, headloss: 0, roughness: 0.1
  };
  redeState.pipes.push(pipe);
  renderPipe(pipe);
  redeState.calculated = false;
  updateRedeStatus(`Trecho ${id} adicionado: ${fromId}→${toId}, L=${L_m.toFixed(0)} m, DN${pipe.dn}`);
}

function pipeColor(pipe){
  if(!pipe.calculated) return '#94a3b8';
  const v = pipe.velocity;
  if(v < 0.6) return '#3b82f6';
  if(v <= 1.5) return '#22c55e';
  if(v <= 3.0) return '#f59e0b';
  return '#ef4444';
}

function renderPipe(pipe){
  if(redeState.layers.pipes[pipe.id]) redeState.layers.pipes[pipe.id].remove();
  const nA = redeState.nodes.find(n=>n.id===pipe.from);
  const nB = redeState.nodes.find(n=>n.id===pipe.to);
  if(!nA||!nB) return;
  const weight = pipe.dn<=100?3:pipe.dn<=200?4:5;
  const color = pipeColor(pipe);
  const selected = redeState.selectedId?.type==='pipe' && redeState.selectedId?.id===pipe.id;
  const lineOpts = selected
    ? {color:'#f59e0b', weight:weight+4, opacity:0.5}
    : null;
  // Draw selection halo first (below the main line)
  if(selected){
    L.polyline([[nA.lat,nA.lng],[nB.lat,nB.lng]], lineOpts).addTo(redeState.map);
  }
  const line = L.polyline([[nA.lat,nA.lng],[nB.lat,nB.lng]],
    {color, weight, opacity:0.85}).addTo(redeState.map);
  const popupContent = `<div style="font-family:monospace;font-size:11px;min-width:180px;">
    <strong>${pipe.label||pipe.id}</strong>: ${pipe.from} → ${pipe.to}<br>
    DN ${pipe.dn} mm | C=${pipe.c} | L=${pipe.length.toFixed(0)} m
    ${pipe.calculated?`<br>Q=${pipe.flow.toFixed(3)} L/s | v=<strong style="color:${color}">${pipe.velocity.toFixed(2)} m/s</strong> | Hf=${pipe.headloss.toFixed(3)} m`:''}
  </div>`;
  line.bindPopup(popupContent, {maxWidth:240});
  line.on('click', (ev)=>{
    L.DomEvent.stopPropagation(ev);
    if(redeState.tool==='select') selectElement('pipe', pipe.id);
  });
  const midLat = (nA.lat+nB.lat)/2, midLng = (nA.lng+nB.lng)/2;
  if(pipe.calculated){
    L.marker([midLat,midLng],{
      icon:L.divIcon({html:`<div style="font-size:9px;font-family:monospace;background:rgba(255,255,255,.85);padding:1px 4px;border-radius:3px;border:1px solid #ccc;white-space:nowrap;">DN${pipe.dn} | ${pipe.velocity.toFixed(2)} m/s</div>`,
      className:'',iconAnchor:[30,8]}),interactive:false
    }).addTo(redeState.map);
  }
  redeState.layers.pipes[pipe.id] = line;
}

function rerenderPipesForNode(nodeId){
  redeState.pipes.filter(p=>p.from===nodeId||p.to===nodeId).forEach(renderPipe);
}

function selectElement(type, id){
  const prev = redeState.selectedId;
  redeState.selectedId = {type, id};
  // Re-render previously selected element to remove highlight
  if(prev){
    if(prev.type==='node'){const n=redeState.nodes.find(x=>x.id===prev.id);if(n)renderNode(n);}
    else{const p=redeState.pipes.find(x=>x.id===prev.id);if(p)renderPipe(p);}
  }
  // Re-render newly selected element to show highlight
  if(type==='node'){const n=redeState.nodes.find(x=>x.id===id);if(n)renderNode(n);}
  else{const p=redeState.pipes.find(x=>x.id===id);if(p)renderPipe(p);}

  const panel = document.getElementById('rede-edit-panel');
  const title = document.getElementById('rede-edit-title');
  const fields = document.getElementById('rede-edit-fields');
  panel.style.display = 'block';
  if(type==='node'){
    const n = redeState.nodes.find(x=>x.id===id);
    title.textContent = `Nó ${n.label||id} (${n.type})`;
    const color = n.calculated
      ? (n.pressure < 10 || n.pressure > 50 ? '#ef4444' : n.pressure > 40 ? '#f59e0b' : '#22c55e')
      : '';
    const miniCard = `<table class="rede-mini-card"><tbody>
      <tr><td>Cota</td><td data-tip="Cota altimétrica do nó (m). Usada para calcular a pressão disponível: P = H − Z.">${n.elevation} m</td></tr>
      <tr><td>Demanda</td><td data-tip="Demanda de água no nó (L/s). Deve refletir o consumo per capita × população da área atendida.">${n.demand.toFixed(3)} L/s</td></tr>
      ${n.type==='reservoir'?`<tr><td>Nível</td><td data-tip="Nível piezométrico fixo do reservatório (m). Define a carga de pressão disponível para toda a rede.">${n.head||50} m</td></tr>`:''}
      ${n.calculated?`<tr><td>Pressão</td><td data-tip="Pressão hidráulica disponível (mca). NBR 12218: mín. 10 mca e máx. 50 mca. Valor = Carga piezométrica − Cota." style="color:${color};font-weight:600;">${n.pressure.toFixed(1)} mca</td></tr>`:''}
    </tbody></table>`;
    fields.innerHTML = miniCard + `
      <div style="margin-bottom:8px;"><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">Rótulo</label>
      <input type="text" id="edit-label" value="${n.label||n.id}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);"></div>
      <div style="margin-bottom:8px;"><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">Cota (m)</label>
      <input type="number" id="edit-elevation" value="${n.elevation}" step="0.1" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);"></div>
      <div style="margin-bottom:8px;"><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">Demanda base (L/s)</label>
      <input type="number" id="edit-demand" value="${n.demand}" step="0.001" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);"></div>
      ${n.type==='reservoir'?`<div><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">Nível fixo (m)</label>
      <input type="number" id="edit-head" value="${n.head||50}" step="0.1" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);"></div>`:''}
    `;
  } else {
    const p = redeState.pipes.find(x=>x.id===id);
    title.textContent = `Trecho ${p.label||id}`;
    const bresseD = Math.sqrt(p.flow/1000)*1.5*1000; // mm, Bresse formula
    const miniCard = `<table class="rede-mini-card"><tbody>
      <tr><td>De → Para</td><td data-tip="Sentido original do trecho (pode ser invertido pelo solvedor Hardy-Cross se a vazão ficar negativa).">${p.from} → ${p.to}</td></tr>
      <tr><td>DN</td><td data-tip="Diâmetro Nominal da tubulação (mm). Afeta diretamente velocidade e perda de carga por Hazen-Williams.">${p.dn} mm</td></tr>
      <tr><td>Comprimento</td><td data-tip="Comprimento real do trecho (m). Calculado automaticamente pela distância geográfica entre os nós.">${p.length.toFixed(0)} m</td></tr>
      ${p.calculated?`<tr><td>Vazão</td><td data-tip="Vazão convergida pelo Hardy-Cross (L/s). Valor negativo indica escoamento no sentido inverso ao cadastrado.">${p.flow.toFixed(3)} L/s</td></tr>`:''}
      ${p.calculated?`<tr><td>Velocidade</td><td data-tip="Velocidade média de escoamento v = Q/A (m/s). NBR 12218 recomenda 0,6–3,0 m/s. Abaixo: risco de deposição; acima: risco de erosão.">${p.velocity.toFixed(3)} m/s</td></tr>`:''}
      ${p.calculated?`<tr><td>DN Bresse</td><td data-tip="Diâmetro econômico de Bresse: D = 1,5·√Q (m³/s). Sugere o DN mais eficiente para a vazão calculada.">${bresseD.toFixed(0)} mm</td></tr>`:''}
    </tbody></table>`;
    fields.innerHTML = miniCard + `
      <div style="margin-bottom:8px;"><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">Rótulo</label>
      <input type="text" id="edit-label" value="${p.label||p.id}" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);"></div>
      <div style="margin-bottom:8px;"><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">DN (mm)</label>
      <select id="edit-dn" style="width:100%;padding:6px 8px;font-size:12px;font-family:var(--mono);border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);">
        ${[50,75,100,125,150,200,250,300,350,400].map(d=>`<option value="${d}" ${p.dn===d?'selected':''}>${d} mm</option>`).join('')}
      </select></div>
      <div style="margin-bottom:8px;"><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">C Hazen-Williams</label>
      <select id="edit-c" style="width:100%;padding:6px 8px;font-size:12px;font-family:var(--mono);border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);">
        ${[[150,'PVC novo'],[140,'PVC uso'],[130,'FFD'],[120,'FFC'],[100,'Concreto']].map(([v,l])=>`<option value="${v}" ${p.c===v?'selected':''}>${v} — ${l}</option>`).join('')}
      </select></div>
      <div><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">Comprimento (m)</label>
      <input type="number" id="edit-length" value="${p.length.toFixed(1)}" step="1" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);"></div>
    `;
  }
}

function applyEdit(){
  if(!redeState.selectedId) return;
  const {type, id} = redeState.selectedId;
  const wasCalc = redeState.calculated;
  if(type==='node'){
    const n = redeState.nodes.find(x=>x.id===id);
    n.label = document.getElementById('edit-label').value.trim();
    n.elevation = +document.getElementById('edit-elevation').value;
    n.demand = +document.getElementById('edit-demand').value;
    if(n.type==='reservoir') n.head = +document.getElementById('edit-head').value||50;
    renderNode(n);
  } else {
    const p = redeState.pipes.find(x=>x.id===id);
    p.label = document.getElementById('edit-label').value.trim();
    p.dn = +document.getElementById('edit-dn').value;
    p.c = +document.getElementById('edit-c').value;
    p.length = +document.getElementById('edit-length').value;
    renderPipe(p);
  }
  redeState.calculated = false;
  if(wasCalc){
    updateRedeStatus('Propriedades atualizadas — recalculando...');
    runHardyCross();
  } else {
    updateRedeStatus('Propriedades atualizadas. Clique em Calcular para processar a rede.');
  }
}

function deleteSelected(){
  if(!redeState.selectedId) return;
  const {type, id} = redeState.selectedId;
  redeState.selectedId = null;
  if(type==='node'){
    redeState.pipes.filter(p=>p.from===id||p.to===id).forEach(p=>{
      if(redeState.layers.pipes[p.id]) redeState.layers.pipes[p.id].remove();
    });
    redeState.pipes = redeState.pipes.filter(p=>p.from!==id&&p.to!==id);
    if(redeState.layers.nodes[id]) redeState.layers.nodes[id].remove();
    redeState.nodes = redeState.nodes.filter(n=>n.id!==id);
  } else {
    if(redeState.layers.pipes[id]) redeState.layers.pipes[id].remove();
    redeState.pipes = redeState.pipes.filter(p=>p.id!==id);
  }
  redeState.selectedId = null;
  document.getElementById('rede-edit-panel').style.display='none';
  updateRedeStatus('Elemento removido.');
}

function clearRede(){
  if(!confirm('Limpar toda a rede?')) return;
  redeState.nodes.forEach(n=>{if(redeState.layers.nodes[n.id])redeState.layers.nodes[n.id].remove();});
  redeState.pipes.forEach(p=>{if(redeState.layers.pipes[p.id])redeState.layers.pipes[p.id].remove();});
  redeState.nodes=[]; redeState.pipes=[]; redeState.layers={nodes:{},pipes:{}};
  redeState.calculated=false;
  document.getElementById('rede-results-full').style.display='none';
  document.getElementById('rede-results-panel').style.display='none';
  updateRedeStatus('Rede limpa.');
}

// ── HARDY-CROSS SOLVER ──────────────────────────────────────────────────────────
function hwResistance(pipe){
  const D = pipe.dn / 1000;
  return 10.643 * pipe.length / (Math.pow(pipe.c, 1.852) * Math.pow(D, 4.87));
}

function hwHeadloss(R, Q){
  return R * Math.sign(Q) * Math.pow(Math.abs(Q), 1.852);
}

function runHardyCross(){
  const nodes = redeState.nodes;
  const pipes = redeState.pipes;

  if(nodes.length < 2){ alert('Adicione pelo menos 2 nós.'); return; }
  if(pipes.length < 1){ alert('Adicione pelo menos 1 trecho.'); return; }

  const reservoirs = nodes.filter(n=>n.type==='reservoir'||n.type==='tank');
  if(reservoirs.length === 0){ alert('Adicione pelo menos 1 reservatório ou tanque como fonte.'); return; }

  pipes.forEach(p=>{ p.flow = p.flow||0.001; });

  const totalDemand = nodes.filter(n=>n.type==='junction').reduce((s,n)=>s+n.demand, 0);
  if(totalDemand <= 0){
    const pop = state.projData.length ? state.projData[state.projData.length-1].pop : 10000;
    const p_params = getParams();
    const Qmed_Ls = pop * p_params.agua / 86400;
    const junctions = nodes.filter(n=>n.type==='junction');
    if(junctions.length > 0){
      const qPerNode = Qmed_Ls / junctions.length;
      junctions.forEach(n=>{ n.demand = +qPerNode.toFixed(4); });
      updateRedeStatus(`Demanda distribuída automaticamente: ${Qmed_Ls.toFixed(3)} L/s total (${junctions.length} nós × ${qPerNode.toFixed(3)} L/s)`);
    }
  }

  initFlows(nodes, pipes, reservoirs[0]);

  const loops = findLoops(nodes, pipes);

  let maxDQ = Infinity;
  let iter = 0;
  const MAX_ITER = 100;
  const TOL = 0.0001;

  while(maxDQ > TOL && iter < MAX_ITER){
    maxDQ = 0;
    if(loops.length > 0){
      loops.forEach(loop=>{
        let sumHF = 0, sumHFQ = 0;
        loop.forEach(({pipe, dir})=>{
          const Q_m3s = pipe.flow / 1000;
          const R = hwResistance(pipe);
          const hf = hwHeadloss(R, Q_m3s * dir);
          sumHF += hf;
          sumHFQ += 1.852 * R * Math.pow(Math.abs(Q_m3s), 0.852);
        });
        const dQ = sumHFQ > 0 ? -(sumHF / (2 * sumHFQ)) * 1000 : 0;
        loop.forEach(({pipe, dir})=>{ pipe.flow += dQ * dir; });
        maxDQ = Math.max(maxDQ, Math.abs(dQ));
      });
    } else {
      break;
    }
    iter++;
  }

  calcPressures(nodes, pipes, reservoirs[0]);

  pipes.forEach(p=>{
    const D = p.dn / 1000;
    const A = Math.PI * (D/2)**2;
    p.velocity = Math.abs(p.flow/1000) / A;
    const R = hwResistance(p);
    p.headloss = Math.abs(hwHeadloss(R, p.flow/1000));
    p.calculated = true;
  });
  nodes.forEach(n=>{ n.calculated = true; });
  redeState.calculated = true;

  redeState.nodes.forEach(renderNode);
  redeState.pipes.forEach(renderPipe);
  renderRedeResults(iter, loops.length);
  addAudit(`Hardy-Cross: ${pipes.length} trechos, ${nodes.length} nós, ${iter} iter`);
}

function initFlows(nodes, pipes, source){
  // Build undirected adjacency
  const adj = {};
  nodes.forEach(n=>{ adj[n.id]=[]; });
  pipes.forEach(p=>{
    if(adj[p.from]) adj[p.from].push({to:p.to, pipe:p});
    if(adj[p.to])   adj[p.to].push({to:p.from, pipe:p});
  });

  // BFS spanning tree from source
  const pred = {}; // child -> { parent: id, pipe }
  const visited = new Set([source.id]);
  const bfsOrder = [source.id];
  const queue = [source.id];
  const treeEdgeIds = new Set();

  while(queue.length){
    const u = queue.shift();
    for(const {to:v, pipe} of (adj[u]||[])){
      if(!visited.has(v)){
        visited.add(v);
        pred[v] = {parent:u, pipe};
        treeEdgeIds.add(pipe.id);
        bfsOrder.push(v);
        queue.push(v);
      }
    }
  }

  // Initialise all flows to minimum
  pipes.forEach(p=>{ p.flow = 0.001; });

  // Accumulate downstream demand (leaves → source) and set tree-edge flows
  const demand = {};
  nodes.forEach(n=>{ demand[n.id] = n.demand || 0; });

  for(let i = bfsOrder.length - 1; i >= 1; i--){
    const v = bfsOrder[i];
    const {parent:u, pipe} = pred[v];
    const flow = Math.max(demand[v], 0.001);
    // Positive direction = from parent toward child.
    // pipe.flow unit is L/s throughout the network solver.
    pipe.flow = pipe.from === u ? flow : -flow;
    demand[u] = (demand[u]||0) + demand[v];
  }
  // Non-tree edges keep the small initial flow (0.001) set above
}

function findLoops(nodes, pipes){
  if(!nodes.length || !pipes.length) return [];

  // Build undirected adjacency list
  const adj = {};
  nodes.forEach(n=>{ adj[n.id]=[]; });
  pipes.forEach(p=>{
    if(adj[p.from]) adj[p.from].push({to:p.to, pipe:p});
    if(adj[p.to])   adj[p.to].push({to:p.from, pipe:p});
  });

  const loops = [];
  const globalVisited = new Set();

  for(const startNode of nodes){
    if(globalVisited.has(startNode.id)) continue;

    // BFS spanning tree for this connected component
    const pred = {}; // child -> { parent: id, pipe }
    const visited = new Set([startNode.id]);
    const queue = [startNode.id];
    const treeEdgeIds = new Set();

    while(queue.length){
      const u = queue.shift();
      for(const {to:v, pipe} of (adj[u]||[])){
        if(!visited.has(v)){
          visited.add(v);
          pred[v] = {parent:u, pipe};
          treeEdgeIds.add(pipe.id);
          queue.push(v);
        }
      }
    }
    visited.forEach(id=>globalVisited.add(id));

    // Helper: path from a node to the BFS-tree root as an array of node IDs
    const pathToRoot = nodeId => {
      const path = [nodeId];
      let cur = nodeId;
      while(pred[cur]){ cur = pred[cur].parent; path.push(cur); }
      return path; // [nodeId, ..., root]
    };

    // Each non-tree (co-tree) edge defines one fundamental cycle
    for(const p of pipes){
      if(treeEdgeIds.has(p.id)) continue;
      if(!visited.has(p.from) || !visited.has(p.to)) continue;

      // Find LCA of p.from and p.to in the spanning tree
      const ancestorsA = pathToRoot(p.from); // [p.from, …, root]
      const setA = new Map(ancestorsA.map((n,i)=>[n,i]));

      const ancestorsB = [];
      for(const n of pathToRoot(p.to)){
        ancestorsB.push(n);
        if(setA.has(n)) break;
      }
      const lca = ancestorsB[ancestorsB.length-1];
      if(!setA.has(lca)) continue;

      const lcaIdxA = setA.get(lca); // # of nodes in segA before LCA

      // cycleNodes: p.from → (up tree) → LCA → (down tree) → p.to
      const segA = ancestorsA.slice(0, lcaIdxA);          // [p.from, …, node just before LCA]
      const segB = ancestorsB.slice(0, -1).reverse();      // [node just after LCA, …, p.to]
      const cycleNodes = [...segA, lca, ...segB];

      if(cycleNodes[cycleNodes.length-1] !== p.to) continue;

      const loop = [];

      // Tree-path edges
      for(let i = 0; i < cycleNodes.length-1; i++){
        const nA = cycleNodes[i], nB = cycleNodes[i+1];
        let tp = null;
        if(pred[nB] && pred[nB].parent === nA) tp = pred[nB].pipe;
        else if(pred[nA] && pred[nA].parent === nB) tp = pred[nA].pipe;
        if(!tp) continue;
        loop.push({pipe:tp, dir: tp.from===nA ? 1 : -1});
      }

      // Co-tree edge closes the cycle (p.to → p.from = reverse of p)
      loop.push({pipe:p, dir:-1});

      loops.push(loop);
    }
  }

  return loops;
}

function calcPressures(nodes, pipes, source){
  const headMap = {};
  const srcHead = (source.type==='reservoir'||source.type==='tank')
    ? (source.head || source.elevation + 20) : source.elevation + 20;
  headMap[source.id] = srcHead;
  const queue = [source.id];
  const visited = new Set([source.id]);

  while(queue.length){
    const curr = queue.shift();
    const hCurr = headMap[curr];
    pipes.filter(p=>p.from===curr||p.to===curr).forEach(p=>{
      const next = p.from===curr ? p.to : p.from;
      if(!visited.has(next)){
        visited.add(next);
        queue.push(next);
        const dir = p.from===curr ? 1 : -1;
        const R = hwResistance(p);
        const hf = hwHeadloss(R, p.flow/1000 * dir);
        headMap[next] = hCurr - hf;
      }
    });
  }

  nodes.forEach(n=>{
    const h = headMap[n.id] || n.elevation + 10;
    n.pressure = h - n.elevation;
    if(n.pressure < 0) n.pressure = 0;
  });
}

function renderRedeResults(iters, nLoops){
  const pipes = redeState.pipes;
  const nodes = redeState.nodes;

  const okP = nodes.filter(n=>n.type==='junction'&&n.pressure>=10&&n.pressure<=40).length;
  const warnP = nodes.filter(n=>n.type==='junction'&&n.pressure>40&&n.pressure<=50).length;
  const critP = nodes.filter(n=>n.type==='junction'&&(n.pressure<10||n.pressure>50)).length;
  const okV = pipes.filter(p=>p.velocity>=0.6&&p.velocity<=3.0).length;
  const critV = pipes.filter(p=>p.velocity<0.6||p.velocity>3.0).length;

  document.getElementById('rede-results-panel').style.display='block';
  document.getElementById('rede-results-summary').innerHTML=`
    <div style="font-size:11px;font-family:var(--mono);line-height:1.8;">
      <div>Iterações H-C: <strong data-tip="Número de iterações até convergência (tolerância 0,0001 L/s). Redes mais complexas exigem mais iterações.">${iters}</strong> | Anéis: <strong data-tip="Número de anéis (malhas) independentes detectados pelo método da árvore geradora. Cada anel gera uma equação de Hardy-Cross.">${nLoops}</strong></div>
      <div>Nós OK (10–40 mca): <span class="status-ok" data-tip="Pressão dentro do intervalo ótimo NBR 12218 (10–40 mca).">${okP}</span> | Atenção: <span class="status-warn" data-tip="Pressão entre 40–50 mca — acima do recomendado, mas ainda dentro do limite máximo NBR 12218.">${warnP}</span> | Crítico: <span class="status-crit" data-tip="Pressão fora dos limites NBR 12218 (&lt;10 ou &gt;50 mca). Requer intervenção: redimensionamento ou VRP.">${critP}</span></div>
      <div>Trechos v OK: <span class="status-ok" data-tip="Velocidade dentro do intervalo recomendado NBR 12218 (0,6–3,0 m/s).">${okV}</span> | Fora NBR: <span class="status-crit" data-tip="Velocidade fora do intervalo NBR 12218. Abaixo de 0,6 m/s: risco de deposição; acima de 3,0 m/s: risco de erosão e golpe de aríete.">${critV}</span></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:6px;">
      <button class="btn btn-sm" style="flex:1;" onclick="aplicarBresse()" title="Aplica D = 1,5 × √Q (Bresse) como DN sugerido">⚙ DN Econômico (Bresse)</button>
      <button class="btn btn-sm" style="flex:1;" onclick="exportRedeXLSX()" title="Exportar resultados para planilha Excel (.xlsx)">
        <svg class="icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg> Excel
      </button>
    </div>`;

  document.getElementById('rede-results-full').style.display='block';
  document.getElementById('rede-pipe-table').innerHTML=`<table class="rede-results-table">
    <thead><tr>
      <th data-tip="Identificador do trecho (ID interno).">ID</th>
      <th data-tip="Nós de origem e destino do trecho.">De→Para</th>
      <th data-tip="Diâmetro Nominal da tubulação (mm). Afeta velocidade e perda de carga.">DN (mm)</th>
      <th data-tip="Diâmetro econômico de Bresse: D = 1,5·√Q (m³/s). Referência para escolha do DN mais eficiente.">DN Bresse</th>
      <th data-tip="Comprimento real do trecho (m).">L (m)</th>
      <th data-tip="Vazão calculada pelo Hardy-Cross (L/s). Negativo = sentido invertido.">Q (L/s)</th>
      <th data-tip="Velocidade de escoamento v = Q/A (m/s). NBR 12218 recomenda 0,6–3,0 m/s.">v (m/s)</th>
      <th data-tip="Perda de carga distribuída (Hazen-Williams, m). Indica energia dissipada ao longo do trecho.">Hf (m)</th>
      <th data-tip="Verificação NBR 12218: velocidade dentro dos limites recomendados.">Status</th>
    </tr></thead>
    <tbody>${pipes.map(p=>{
      const vCls = p.velocity<0.6||p.velocity>3?'status-crit':p.velocity>1.5?'status-warn':'status-ok';
      const vLabel = p.velocity<0.6?'⚠ deposição':p.velocity>3?'⚠ erosão':'✅ OK';
      const bresseD = (Math.sqrt(Math.abs(p.flow)/1000)*1.5*1000).toFixed(0); // Bresse: D(m)=1.5√Q(m³/s), Q_m³/s = Q_L/s / 1000
      return `<tr>
        <td title="${p.id}">${p.label||p.id}</td><td style="font-size:10px;">${p.from}→${p.to}</td>
        <td>${p.dn}</td><td style="color:var(--text3)" data-tip="Bresse: D=1,5·√Q → ${bresseD} mm">${bresseD}</td>
        <td>${p.length.toFixed(0)}</td>
        <td>${p.flow.toFixed(3)}</td>
        <td class="${vCls}" data-tip="v = Q/A = ${p.velocity.toFixed(3)} m/s. ${p.velocity<0.6?'Abaixo de 0,6: risco de deposição (NBR 12218).':p.velocity>3?'Acima de 3,0: risco de erosão e golpe de aríete (NBR 12218).':'Dentro do intervalo recomendado 0,6–3,0 m/s (NBR 12218).'}">${p.velocity.toFixed(3)}</td>
        <td data-tip="Perda de carga = R·Q^1,852 pelo método Hazen-Williams.">${p.headloss.toFixed(4)}</td>
        <td class="${vCls}">${vLabel}</td>
      </tr>`;
    }).join('')}</tbody></table>`;

  document.getElementById('rede-node-table').innerHTML=`<table class="rede-results-table">
    <thead><tr>
      <th data-tip="Identificador do nó (ID interno).">ID</th>
      <th data-tip="Tipo do nó: junction (consumo), reservoir (fonte de pressão fixa) ou tank (caixa d'água).">Tipo</th>
      <th data-tip="Cota altimétrica do nó (m). Usada para calcular a pressão disponível: P = H − Z.">Cota (m)</th>
      <th data-tip="Demanda de água no nó (L/s). Deve refletir o consumo per capita × população da área atendida.">Demanda (L/s)</th>
      <th data-tip="Pressão hidráulica disponível (mca). NBR 12218: mín. 10 mca e máx. 50 mca. Valor = Carga piezométrica − Cota.">Pressão (mca)</th>
      <th data-tip="Verificação NBR 12218: pressão dentro dos limites (10–50 mca).">Status</th>
    </tr></thead>
    <tbody>${nodes.map(n=>{
      const pCls = n.type!=='junction'?'':n.pressure<10||n.pressure>50?'status-crit':n.pressure>40?'status-warn':'status-ok';
      const pLabel = n.type!=='junction'?'fonte':n.pressure<10?'⚠ baixa':n.pressure>50?'⚠ muito alta':n.pressure>40?'⚠ alta':'✅ OK';
      return `<tr>
        <td title="${n.id}">${n.label||n.id}</td><td>${n.type}</td>
        <td><input type="number" class="rede-inline-input" value="${n.elevation}" step="0.1" title="Editar cota de ${n.label||n.id}" onchange="_updateNodeElevation('${n.id}',+this.value)"></td><td>${n.demand.toFixed(3)}</td>
        <td class="${pCls}" data-tip="Pressão = ${n.pressure.toFixed(1)} mca. ${n.type!=='junction'?'Fonte de pressão (reservatório/tanque).':n.pressure<10?'Abaixo do mínimo NBR 12218 (10 mca) — risco de falta d\'água.':n.pressure>50?'Acima do máximo NBR 12218 (50 mca) — instalar VRP.':n.pressure>40?'Entre 40–50 mca — atenção: dentro do limite, mas elevado.':'Pressão OK — dentro do intervalo NBR 12218 (10–50 mca).'}">${n.pressure.toFixed(1)}</td>
        <td class="${pCls}">${pLabel}</td>
      </tr>`;
    }).join('')}</tbody></table>`;

  const nbrIssues = [];
  nodes.filter(n=>n.type==='junction').forEach(n=>{
    if(n.pressure < 10) nbrIssues.push(`🔴 Nó ${n.id}: pressão ${n.pressure.toFixed(1)} mca < 10 mca (mínimo NBR 12218)`);
    if(n.pressure > 50) nbrIssues.push(`🔴 Nó ${n.id}: pressão ${n.pressure.toFixed(1)} mca > 50 mca (instalar VRP — NBR 12218)`);
    else if(n.pressure > 40) nbrIssues.push(`🟡 Nó ${n.id}: pressão ${n.pressure.toFixed(1)} mca entre 40–50 mca (atenção)`);
  });
  pipes.forEach(p=>{
    if(p.velocity < 0.6) nbrIssues.push(`🟡 Trecho ${p.id}: v = ${p.velocity.toFixed(2)} m/s < 0,6 m/s — risco de deposição`);
    if(p.velocity > 3.0) nbrIssues.push(`🔴 Trecho ${p.id}: v = ${p.velocity.toFixed(2)} m/s > 3,0 m/s — risco de erosão e aríete`);
  });
  document.getElementById('rede-nbr-check').innerHTML = nbrIssues.length === 0
    ? '<div class="alert alert-success" style="margin:0;">✅ Todos os nós e trechos dentro dos limites da NBR 12218.</div>'
    : `<div class="decision-items">${nbrIssues.map(msg=>`<div class="decision-item ${msg.startsWith('🔴')?'crit':'warn'}" style="padding:8px 12px;">${msg}</div>`).join('')}</div>`;
}

// ── INLINE ELEVATION EDIT ────────────────────────────────────────────────────────
function _updateNodeElevation(nodeId, value){
  const n = redeState.nodes.find(x=>x.id===nodeId);
  if(!n || isNaN(value)) return;
  n.elevation = value;
  renderNode(n);
  runHardyCross();
  addAudit(`Cota de ${n.label||n.id} alterada para ${value} m — rede recalculada`);
}

// ── BRESSE ECONOMIC DIAMETERS ────────────────────────────────────────────────────
const _bresseDNs = [50,75,100,125,150,200,250,300,350,400];
function aplicarBresse(){
  if(!redeState.calculated){ alert('Calcule a rede primeiro.'); return; }
  let count = 0;
  redeState.pipes.forEach(p=>{
    const D_mm = Math.sqrt(Math.abs(p.flow)/1000)*1.5*1000; // Bresse: D(m)=1.5√Q(m³/s), Q_m³/s=Q_L/s/1000
    // Round up to nearest standard DN
    const dn = _bresseDNs.find(d=>d>=D_mm) || _bresseDNs[_bresseDNs.length-1];
    if(dn !== p.dn){ p.dn = dn; p.calculated = false; count++; }
  });
  redeState.calculated = false;
  redeState.pipes.forEach(renderPipe);
  updateRedeStatus(`DN Bresse aplicado a ${count} trecho(s). Clique em Calcular para recalcular.`);
  addAudit(`DN Bresse aplicado — ${count} trechos alterados`);
}

// ── IMPORT .INP ──────────────────────────────────────────────────────────────────
function triggerImportINP(){
  document.getElementById('inp-file-input').click();
}

function importINP(fileInput){
  const file = fileInput.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => _parseAndLoadINP(e.target.result);
  reader.readAsText(file);
  fileInput.value = ''; // reset so same file can be re-imported
}

function _parseAndLoadINP(text){
  const lines = text.split(/\r?\n/);
  let section = '';
  const junctions = {}, reservoirs = {}, tanks = {}, pipes = [], coords = {};

  for(const raw of lines){
    const line = raw.trim();
    if(!line || line.startsWith(';')) continue;
    if(line.startsWith('[')){
      section = line.replace(/[\[\]]/g,'').toUpperCase();
      continue;
    }
    const parts = line.split(/\s+/);
    if(section==='JUNCTIONS' && parts.length>=2){
      junctions[parts[0]] = {elevation:+parts[1], demand:+(parts[2]||0)};
    } else if(section==='RESERVOIRS' && parts.length>=2){
      reservoirs[parts[0]] = {head:+parts[1]};
    } else if(section==='TANKS' && parts.length>=2){
      tanks[parts[0]] = {elevation:+parts[1]};
    } else if(section==='PIPES' && parts.length>=5){
      pipes.push({id:parts[0], from:parts[1], to:parts[2],
        length:+parts[3], dn:Math.round(+parts[4]), c:+(parts[5]||140)});
    } else if(section==='COORDINATES' && parts.length>=3){
      coords[parts[0]] = {x:+parts[1], y:+parts[2]};
    }
  }

  // Build node list
  const nodes = [];
  const addN = (id, type, elev, demand, head) => {
    const c = coords[id];
    if(!c){ console.warn('INP import: sem coordenadas para', id); return; }
    // HidroFlow's exportINP writes coordinates as lat/lng × 10000, so we divide by 10000
    // to recover geographic coordinates. Files exported by the EPANET desktop app use
    // projected coordinates; those networks may need manual repositioning after import.
    const lat = c.y / 10000, lng = c.x / 10000;
    nodes.push({id, type, lat, lng, elevation:elev, demand:demand||0, head:head||0, pressure:0, label:id});
  };
  Object.entries(junctions).forEach(([id,v])=>addN(id,'junction',v.elevation,v.demand,0));
  Object.entries(reservoirs).forEach(([id,v])=>addN(id,'reservoir',0,0,v.head));
  Object.entries(tanks).forEach(([id,v])=>addN(id,'tank',v.elevation,0,0));

  if(!nodes.length){ alert('Não foi possível importar: nenhum nó com coordenadas encontrado no arquivo.'); return; }

  if(redeState.map && nodes.length){
    const lats = nodes.map(n=>n.lat), lngs = nodes.map(n=>n.lng);
    const minLat=Math.min(...lats),maxLat=Math.max(...lats);
    const minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
    if(maxLat-minLat < 10 && maxLng-minLng < 10){
      // Coordinates look like real lat/lng
      redeState.map.fitBounds([[minLat,minLng],[maxLat,maxLng]], {padding:[30,30]});
    }
  }

  // Clear and reload
  redeState.nodes.forEach(n=>{if(redeState.layers.nodes[n.id])redeState.layers.nodes[n.id].remove();});
  redeState.pipes.forEach(p=>{if(redeState.layers.pipes[p.id])redeState.layers.pipes[p.id].remove();});
  redeState.nodes=[]; redeState.pipes=[]; redeState.layers={nodes:{},pipes:{}};
  redeState.calculated=false;
  document.getElementById('rede-results-full').style.display='none';
  document.getElementById('rede-results-panel').style.display='none';

  nodes.forEach(n=>{ redeState.nodes.push(n); renderNode(n); });

  const nodeIds = new Set(nodes.map(n=>n.id));
  pipes.forEach(p=>{
    if(!nodeIds.has(p.from)||!nodeIds.has(p.to)) return;
    const pipe = {id:p.id||uid('P'), from:p.from, to:p.to,
      length:p.length, dn:p.dn||100, c:p.c||140,
      flow:0, velocity:0, headloss:0};
    redeState.pipes.push(pipe);
    renderPipe(pipe);
  });

  updateRedeStatus(`Importado: ${redeState.nodes.length} nós, ${redeState.pipes.length} trechos.`);
  addAudit(`INP importado — ${redeState.nodes.length} nós, ${redeState.pipes.length} trechos`);
}

// ── EXPORT .INP ─────────────────────────────────────────────────────────────────
function exportINP(){
  const nodes = redeState.nodes;
  const pipes = redeState.pipes;
  if(!nodes.length){ alert('Adicione nós primeiro.'); return; }

  const ts = new Date().toLocaleString('pt-BR');
  const name = state.municipioNome || 'Municipio';

  let inp = `[TITLE]
ProjecaoPop v5 — Rede de Distribuição
${name} — Gerado em ${ts}

[JUNCTIONS]
;ID              Elev        Demand      Pattern
`;
  nodes.filter(n=>n.type==='junction').forEach(n=>{
    inp += `${n.id.padEnd(16)}${String(n.elevation).padEnd(12)}${n.demand.toFixed(5).padEnd(12)};
`;
  });

  inp += `
[RESERVOIRS]
;ID              Head        Pattern
`;
  nodes.filter(n=>n.type==='reservoir').forEach(n=>{
    inp += `${n.id.padEnd(16)}${String(n.head||50).padEnd(12)};
`;
  });

  inp += `
[TANKS]
;ID       Elevation  InitLevel  MinLevel  MaxLevel  Diameter  MinVol  VolCurve
`;
  nodes.filter(n=>n.type==='tank').forEach(n=>{
    inp += `${n.id.padEnd(10)}${n.elevation}  10  2  15  10  0  ;
`;
  });

  inp += `
[PIPES]
;ID              Node1           Node2           Length      Diameter    Roughness   MinorLoss   Status
`;
  pipes.forEach(p=>{
    inp += `${p.id.padEnd(16)}${p.from.padEnd(16)}${p.to.padEnd(16)}${p.length.toFixed(1).padEnd(12)}${String(p.dn).padEnd(12)}${String(p.c).padEnd(12)}0           Open
`;
  });

  inp += `
[COORDINATES]
;Node            X-Coord         Y-Coord
`;
  nodes.forEach(n=>{
    inp += `${n.id.padEnd(16)}${(n.lng*10000).toFixed(2).padEnd(16)}${(n.lat*10000).toFixed(2)}
`;
  });

  inp += `
[OPTIONS]
Units            LPS
Headloss         H-W
Accuracy         0.001
Trials           40
Duration         0
Pattern          1

[REPORT]
Status           Full
Summary          Yes
Energy           No
Nodes            All
Links            All

[END]
`;

  const blob = new Blob([inp], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rede_${name.replace(/\s+/g,'_')}.inp`;
  a.click();
  addAudit('Exportado .INP — ' + pipes.length + ' trechos');
}

// ── EXAMPLE NETWORK ─────────────────────────────────────────────────────────────
function loadExampleNet(){
  if(!redeState.map) initRede();
  if(!redeState.map) return;
  // whenReady fires immediately if the map is already initialised, or after
  // the first 'load' event — avoiding the old fragile setTimeout approach.
  redeState.map.whenReady(_buildExampleNet);
}

function _buildExampleNet(){
  // Clear silently (no confirm dialog) before loading the example
  redeState.nodes.forEach(n=>{if(redeState.layers.nodes[n.id])redeState.layers.nodes[n.id].remove();});
  redeState.pipes.forEach(p=>{if(redeState.layers.pipes[p.id])redeState.layers.pipes[p.id].remove();});
  redeState.nodes=[]; redeState.pipes=[]; redeState.layers={nodes:{},pipes:{}};
  redeState.calculated=false;
  document.getElementById('rede-results-full').style.display='none';
  document.getElementById('rede-results-panel').style.display='none';
  const center = redeState.map.getCenter();
  const lat = center.lat, lng = center.lng;
  const d = 0.003;
  const positions = [
    ['R1','reservoir', lat+d*2, lng,      15, 0,    60],
    ['N1','junction',  lat+d,   lng,      12, 2.5,  0],
    ['N2','junction',  lat,     lng+d,    10, 2.0,  0],
    ['N3','junction',  lat,     lng-d,    10, 1.8,  0],
    ['N4','junction',  lat-d,   lng+d,    8,  1.5,  0],
    ['N5','junction',  lat-d,   lng-d,    8,  1.2,  0],
    ['N6','junction',  lat-d,   lng,      9,  1.0,  0],
  ];
  positions.forEach(([id,type,lt,ln,elev,dem,head])=>{
    const node = {id, type, lat:lt, lng:ln, elevation:elev, demand:dem, head:head, pressure:0, label:id};
    redeState.nodes.push(node);
    renderNode(node);
  });
  [['R1','N1',100],['N1','N2',150],['N1','N3',150],
   ['N2','N4',100],['N3','N5',100],['N4','N6',100],
   ['N5','N6',100],['N2','N3',200]].forEach(([f,t,dn])=>{
    const id = uid('P');
    const nA = redeState.nodes.find(n=>n.id===f);
    const nB = redeState.nodes.find(n=>n.id===t);
    const L_m = redeState.map.distance([nA.lat,nA.lng],[nB.lat,nB.lng]);
    const pipe = {id, from:f, to:t, length:L_m, dn, c:140, flow:0, velocity:0, headloss:0};
    redeState.pipes.push(pipe);
    renderPipe(pipe);
  });
  updateRedeStatus('Rede exemplo carregada. Clique em Calcular para rodar Hardy-Cross.');
}

function updateRedeStatus(msg){
  const el = document.getElementById('rede-status');
  if(el) el.textContent = msg;
}

// ── INFORMATIVE TOOLTIP ──────────────────────────────────────────────────────
function _initInfoTip(){
  if(document.getElementById('rede-infotip')) return;
  const tip = document.createElement('div');
  tip.id = 'rede-infotip';
  tip.className = 'rede-infotip';
  document.body.appendChild(tip);
  document.addEventListener('mouseover', function(e){
    const el = e.target.closest('[data-tip]');
    if(!el){ tip.style.display='none'; return; }
    tip.textContent = el.getAttribute('data-tip');
    tip.style.display = 'block';
    const rect = el.getBoundingClientRect();
    const tipW = 250;
    tip.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - tipW - 4)) + 'px';
    tip.style.top = (rect.bottom + 6) + 'px';
  });
  document.addEventListener('mouseout', function(e){
    if(e.target.closest('[data-tip]')) tip.style.display='none';
  });
}

// ── EXPORT EXCEL (.xlsx) ─────────────────────────────────────────────────────
function exportRedeXLSX(){
  if(!redeState.calculated){ alert('Calcule a rede primeiro.'); return; }
  const wb = XLSX.utils.book_new();

  const pipeRows = [['ID','Rótulo','De','Para','DN (mm)','L (m)','Q (L/s)','v (m/s)','Hf (m)','Status']];
  redeState.pipes.forEach(p=>{
    const vLabel = p.velocity<0.6?'Deposição':p.velocity>3?'Erosão':'OK';
    pipeRows.push([p.id, p.label||p.id, p.from, p.to, p.dn,
      +(p.length||0).toFixed(0), +(p.flow||0).toFixed(3),
      +(p.velocity||0).toFixed(3), +(p.headloss||0).toFixed(4), vLabel]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(pipeRows), 'Trechos');

  const nodeRows = [['ID','Rótulo','Tipo','Cota (m)','Demanda (L/s)','Pressão (mca)','Status']];
  redeState.nodes.forEach(n=>{
    const pLabel = n.type!=='junction'?'fonte':n.pressure<10?'Baixa':n.pressure>50?'Muito alta':n.pressure>40?'Alta':'OK';
    nodeRows.push([n.id, n.label||n.id, n.type, n.elevation,
      +(n.demand||0).toFixed(3), +(n.pressure||0).toFixed(1), pLabel]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(nodeRows), 'Nós');

  const name = (typeof state!=='undefined'&&state.municipioNome) ? state.municipioNome : 'rede';
  const fileName = `rede_${name.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`;
  const wbOut = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const blob = new Blob([wbOut], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
  addAudit(`Excel rede exportado — ${redeState.pipes.length} trechos, ${redeState.nodes.length} nós`);
}

let _toastTimer = null;
function showRedeToast(msg){
  let toast = document.getElementById('rede-toast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'rede-toast';
    toast.className = 'rede-toast';
    document.getElementById('rede-map')?.parentNode?.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('rede-toast-visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>toast.classList.remove('rede-toast-visible'), 2500);
}

// ── FERRAMENTA DE MEDIÇÃO DE DISTÂNCIA + ALTIMETRIA ─────────────────────────

// Haversine — distância em metros entre dois pontos lat/lng
function haversineDistance(lat1, lng1, lat2, lng2){
  const R=6371000; // raio médio da Terra (m)
  const phi1=lat1*Math.PI/180, phi2=lat2*Math.PI/180;
  const dphi=(lat2-lat1)*Math.PI/180, dlam=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dphi/2)**2+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dlam/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

function handleMeasureClick(latlng){
  if(!redeState._measurePt1){
    // Primeiro clique — marca ponto 1
    redeState._measurePt1 = latlng;
    if(redeState._measureMarker) redeState._measureMarker.remove();
    redeState._measureMarker = L.circleMarker([latlng.lat,latlng.lng],{radius:6,color:'#f59e0b',fillColor:'#f59e0b',fillOpacity:0.8}).addTo(redeState.map);
    updateRedeStatus('📍 Ponto 1 marcado. Clique no ponto 2 (destino).');
  } else {
    // Segundo clique — calcula distância e busca altimetria
    const p1=redeState._measurePt1, p2=latlng;
    const dist_m=haversineDistance(p1.lat,p1.lng,p2.lat,p2.lng);
    // Desenha linha de medição
    if(redeState._tempLine) redeState._tempLine.remove();
    redeState._tempLine = L.polyline([[p1.lat,p1.lng],[p2.lat,p2.lng]],
      {color:'#f59e0b',weight:3,dashArray:'8,4',opacity:0.9}).addTo(redeState.map);
    // Preenche campo de comprimento na aba de adução
    const adComp=document.getElementById('ad-comp');
    if(adComp){adComp.value=Math.round(dist_m);if(typeof calcAducao==='function')calcAducao();}
    updateRedeStatus(`📏 Distância: ${(dist_m/1000).toFixed(3)} km (${Math.round(dist_m)} m) → preenchido em Comprimento da adutora. Buscando altimetria...`);
    redeState._measurePt1 = null;
    if(redeState._measureMarker){ redeState._measureMarker.remove(); redeState._measureMarker=null; }
    // Consulta Open-Elevation (SRTM-90, NASA)
    _fetchOpenElevation(p1.lat,p1.lng,p2.lat,p2.lng);
  }
}

async function _fetchOpenElevation(lat1,lng1,lat2,lng2){
  try{
    const url=`https://api.open-elevation.com/api/v1/lookup?locations=${lat1},${lng1}|${lat2},${lng2}`;
    const resp=await fetch(url,{signal:AbortSignal.timeout(8000)});
    if(!resp.ok)throw new Error('HTTP '+resp.status);
    const data=await resp.json();
    const elev=data.results;
    if(!elev||elev.length<2){updateRedeStatus('⚠️ Altimetria indisponível (sem dados SRTM para esta região).'); return;}
    const z1=elev[0].elevation, z2=elev[1].elevation;
    const dz=z2-z1;
    // Preenche cotas na aba de adução
    const cap=document.getElementById('ad-cota-cap'),res=document.getElementById('ad-cota-res');
    if(cap)cap.value=z1.toFixed(1);
    if(res)res.value=z2.toFixed(1);
    if(typeof calcAducao==='function')calcAducao();
    updateRedeStatus(`⛰️ Altimetria SRTM: Z₁=${z1.toFixed(1)} m, Z₂=${z2.toFixed(1)} m, ΔZ=${dz.toFixed(1)} m → cotas preenchidas.`);
    showRedeToast(`Cotas atualizadas: Z₁=${z1.toFixed(0)} m, Z₂=${z2.toFixed(0)} m`);
    addAudit(`Medição de distância: ${haversineDistance(lat1,lng1,lat2,lng2).toFixed(0)} m · Cotas SRTM: ${z1.toFixed(1)}→${z2.toFixed(1)} m`);
  }catch(err){
    // Graceful degradation — a API pode estar indisponível
    updateRedeStatus(`📏 Distância OK. Altimetria não disponível (${err.message}). Preencha as cotas manualmente.`);
  }
}
