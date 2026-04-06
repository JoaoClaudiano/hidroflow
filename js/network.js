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
  document.querySelectorAll('.rede-toolbar .btn').forEach(b=>b.classList.remove('active-tool'));
  if(btn) btn.classList.add('active-tool');
  const cursor = tool==='pan'?'':'crosshair';
  if(redeState.map){
    redeState.map.getContainer().style.cursor = cursor;
    if(tool==='pan') redeState.map.dragging.enable();
    else redeState.map.dragging.disable();
  }
  updateRedeStatus(tool==='pan'?'Pan ativo — arraste o mapa':tool==='node'?'Clique no mapa para adicionar um nó':tool==='pipe'?'Clique no nó de origem do trecho':tool==='select'?'Clique num nó ou trecho para editar':'');
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

function nodeIcon(type, color){
  const colors = {reservoir:'#1a4fd6', tank:'#0e7490', junction:color||'#5a5a54'};
  const c = colors[type]||'#5a5a54';
  return L.divIcon({
    html:`<div style="width:18px;height:18px;background:${c};border:2px solid #fff;border-radius:${type==='junction'?'50%':'3px'};box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:700;">${type==='reservoir'?'R':type==='tank'?'T':''}</div>`,
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
  const marker = L.marker([node.lat, node.lng], {
    icon: nodeIcon(node.type, color), draggable: redeState.tool==='select'
  }).addTo(redeState.map);

  const popupContent = `<div style="font-family:monospace;font-size:11px;min-width:160px;">
    <strong>${node.id}</strong> — ${node.type}<br>
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
  const line = L.polyline([[nA.lat,nA.lng],[nB.lat,nB.lng]],
    {color, weight, opacity:0.85}).addTo(redeState.map);
  const popupContent = `<div style="font-family:monospace;font-size:11px;min-width:180px;">
    <strong>${pipe.id}</strong>: ${pipe.from} → ${pipe.to}<br>
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
  redeState.selectedId = {type, id};
  const panel = document.getElementById('rede-edit-panel');
  const title = document.getElementById('rede-edit-title');
  const fields = document.getElementById('rede-edit-fields');
  panel.style.display = 'block';
  if(type==='node'){
    const n = redeState.nodes.find(x=>x.id===id);
    title.textContent = `Nó ${id} (${n.type})`;
    fields.innerHTML = `
      <div style="margin-bottom:8px;"><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">Cota (m)</label>
      <input type="number" id="edit-elevation" value="${n.elevation}" step="0.1" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);"></div>
      <div style="margin-bottom:8px;"><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">Demanda base (L/s)</label>
      <input type="number" id="edit-demand" value="${n.demand}" step="0.001" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);"></div>
      ${n.type==='reservoir'?`<div><label style="font-size:10px;font-family:var(--mono);color:var(--text3);text-transform:uppercase;">Nível fixo (m)</label>
      <input type="number" id="edit-head" value="${n.head||50}" step="0.1" style="width:100%;padding:6px 8px;font-size:12px;border:1px solid var(--border2);border-radius:var(--radius);background:var(--bg);color:var(--text);"></div>`:''}
    `;
  } else {
    const p = redeState.pipes.find(x=>x.id===id);
    title.textContent = `Trecho ${id}`;
    fields.innerHTML = `
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
  if(type==='node'){
    const n = redeState.nodes.find(x=>x.id===id);
    n.elevation = +document.getElementById('edit-elevation').value;
    n.demand = +document.getElementById('edit-demand').value;
    if(n.type==='reservoir') n.head = +document.getElementById('edit-head').value||50;
    renderNode(n);
  } else {
    const p = redeState.pipes.find(x=>x.id===id);
    p.dn = +document.getElementById('edit-dn').value;
    p.c = +document.getElementById('edit-c').value;
    p.length = +document.getElementById('edit-length').value;
    renderPipe(p);
  }
  redeState.calculated = false;
  updateRedeStatus('Propriedades atualizadas.');
}

function deleteSelected(){
  if(!redeState.selectedId) return;
  const {type, id} = redeState.selectedId;
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
  const visited = new Set([source.id]);
  const queue = [source.id];
  pipes.forEach(p=>p.flow=0);

  while(queue.length){
    const curr = queue.shift();
    const connected = pipes.filter(p=>p.from===curr||p.to===curr);
    connected.forEach(p=>{
      const next = p.from===curr ? p.to : p.from;
      if(!visited.has(next)){
        visited.add(next);
        queue.push(next);
        const downstreamDemand = nodes.find(n=>n.id===next)?.demand || 0.001;
        p.flow = downstreamDemand + 0.001;
        if(p.to===curr) p.flow = -p.flow;
      }
    });
  }

  pipes.forEach(p=>{ if(Math.abs(p.flow)<0.0005) p.flow = 0.001; });
}

function findLoops(nodes, pipes){
  const loops = [];
  const visited = new Set();

  const adj = {};
  nodes.forEach(n=>{ adj[n.id]=[]; });
  pipes.forEach(p=>{
    adj[p.from].push({to:p.to, pipe:p});
    adj[p.to].push({to:p.from, pipe:p});
  });

  const dfs = (node, parentId, path, pathPipes) => {
    visited.add(node);
    for(const {to, pipe} of adj[node]||[]){
      if(to === parentId) continue;
      if(visited.has(to)){
        const loopStart = path.indexOf(to);
        if(loopStart >= 0){
          const loopNodes = path.slice(loopStart);
          const loopPipes = pathPipes.slice(loopStart);
          const loop = loopPipes.map((lp,i)=>{
            const nA = loopNodes[i], nB = loopNodes[(i+1)%loopNodes.length];
            return {pipe:lp, dir: lp.from===nA ? 1 : -1};
          });
          const closingDir = pipe.from === loopNodes[loopNodes.length-1] ? 1 : -1;
          loop.push({pipe, dir: closingDir});
          loops.push(loop);
        }
      } else {
        path.push(to);
        pathPipes.push(pipe);
        dfs(to, node, path, pathPipes);
        path.pop();
        pathPipes.pop();
      }
    }
  };

  nodes.forEach(n=>{ if(!visited.has(n.id)) dfs(n.id, null, [n.id], []); });
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
      <div>Iterações H-C: <strong>${iters}</strong> | Anéis: <strong>${nLoops}</strong></div>
      <div>Nós OK (10–40 mca): <span class="status-ok">${okP}</span> | Atenção: <span class="status-warn">${warnP}</span> | Crítico: <span class="status-crit">${critP}</span></div>
      <div>Trechos v OK: <span class="status-ok">${okV}</span> | Fora NBR: <span class="status-crit">${critV}</span></div>
    </div>`;

  document.getElementById('rede-results-full').style.display='block';
  document.getElementById('rede-pipe-table').innerHTML=`<table class="rede-results-table">
    <thead><tr><th>ID</th><th>De→Para</th><th>DN (mm)</th><th>L (m)</th><th>Q (L/s)</th><th>v (m/s)</th><th>Hf (m)</th><th>Status</th></tr></thead>
    <tbody>${pipes.map(p=>{
      const vCls = p.velocity<0.6||p.velocity>3?'status-crit':p.velocity>1.5?'status-warn':'status-ok';
      const vLabel = p.velocity<0.6?'⚠ deposição':p.velocity>3?'⚠ erosão':'✅ OK';
      return `<tr>
        <td>${p.id}</td><td style="font-size:10px;">${p.from}→${p.to}</td>
        <td>${p.dn}</td><td>${p.length.toFixed(0)}</td>
        <td>${p.flow.toFixed(3)}</td>
        <td class="${vCls}">${p.velocity.toFixed(3)}</td>
        <td>${p.headloss.toFixed(4)}</td>
        <td class="${vCls}">${vLabel}</td>
      </tr>`;
    }).join('')}</tbody></table>`;

  document.getElementById('rede-node-table').innerHTML=`<table class="rede-results-table">
    <thead><tr><th>ID</th><th>Tipo</th><th>Cota (m)</th><th>Demanda (L/s)</th><th>Pressão (mca)</th><th>Status</th></tr></thead>
    <tbody>${nodes.map(n=>{
      const pCls = n.type!=='junction'?'':n.pressure<10||n.pressure>50?'status-crit':n.pressure>40?'status-warn':'status-ok';
      const pLabel = n.type!=='junction'?'fonte':n.pressure<10?'⚠ baixa':n.pressure>50?'⚠ muito alta':n.pressure>40?'⚠ alta':'✅ OK';
      return `<tr>
        <td>${n.id}</td><td>${n.type}</td>
        <td>${n.elevation}</td><td>${n.demand.toFixed(3)}</td>
        <td class="${pCls}">${n.pressure.toFixed(1)}</td>
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
  if(!redeState.map){ initRede(); setTimeout(loadExampleNet, 500); return; }
  clearRede();
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
