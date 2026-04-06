// ══════════════════════════════════════════
// UTILITIES — helpers compartilhados
// ══════════════════════════════════════════
function addAudit(action){
  const time=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  state.auditLog.push({time,action});
  if(state.auditLog.length>100)state.auditLog.shift();
}

function removeAcentos(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
// escHtml escapes characters used in inline HTML event attribute strings (onclick="...('value')")
function escHtml(s){return s.replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
// safeHtml escapes HTML meta-characters for safe insertion into innerHTML
function safeHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function setStatus(el,msg,cls){el.textContent=msg;el.className='sidra-status'+(cls?' '+cls:'');}

// ── SVG ICONS ────────────────────────────────────────────────────────────────
const SVG_WATER=`<svg class="infra-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
const SVG_FLOW=`<svg class="infra-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`;
const SVG_SEWER=`<svg class="infra-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`;
const SVG_WASTE=`<svg class="infra-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const SVG_TANK=`<svg class="infra-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M3 11l4-8h10l4 8"/><line x1="12" y1="11" x2="12" y2="22"/><line x1="3" y1="16" x2="21" y2="16"/></svg>`;
const SVG_PLANT=`<svg class="infra-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
const SVG_PIPE=`<svg class="infra-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12h20"/><path d="M2 12a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4"/><path d="M2 12a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4"/></svg>`;
const SVG_ENERGY=`<svg class="infra-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

function ic(svg,cls=''){return svg.replace('class="infra-icon"',`class="infra-icon ${cls}"`);}

// ══════════════════════════════════════════
// BIBLIOTECA DE MATERIAIS HIDRÁULICOS
// ══════════════════════════════════════════
// Cada entrada: { label, chw, n_mann, E_mpa, co2_kg_per_kg }
//   chw         = Coeficiente Hazen-Williams C
//   n_mann      = Coeficiente de Manning n (adimensional)
//   E_mpa       = Módulo de elasticidade (MPa) — para golpe de aríete
//   co2_kg_per_kg = Pegada de carbono (kg CO₂e / kg de material)
// var (não const) para ser acessível em testes via vm.runInContext
var MATERIAIS_HIDRO = {
  pvc_novo:   { label:'PVC / PEAD (novo)',            chw:150, n_mann:0.009, E_mpa:2800,   co2_kg_per_kg:2.7  },
  pvc_uso:    { label:'PVC / PEAD (uso)',             chw:140, n_mann:0.010, E_mpa:2800,   co2_kg_per_kg:2.7  },
  pead:       { label:'PEAD (DN ≥ 200 mm)',           chw:140, n_mann:0.009, E_mpa:1000,   co2_kg_per_kg:2.5  },
  ffd:        { label:'Ferro Fundido Dúctil (FFD)',   chw:130, n_mann:0.012, E_mpa:170000, co2_kg_per_kg:2.1  },
  ffc:        { label:'Ferro Fundido Cinzento (FFC)', chw:120, n_mann:0.013, E_mpa:110000, co2_kg_per_kg:2.1  },
  concreto_l: { label:'Concreto liso',                chw:110, n_mann:0.012, E_mpa:30000,  co2_kg_per_kg:0.35 },
  concreto_r: { label:'Concreto rugoso / Amianto',   chw:100, n_mann:0.014, E_mpa:30000,  co2_kg_per_kg:0.35 },
  aco:        { label:'Aço sem revestimento',         chw:90,  n_mann:0.011, E_mpa:210000, co2_kg_per_kg:1.85 },
};

/** Preenche automaticamente os campos de material no módulo de adução */
function applyMaterialAducao(key){
  const mat=MATERIAIS_HIDRO[key];
  if(!mat)return;
  // Actualiza o campo oculto que calcAducao() lê
  const chwEl=document.getElementById('ad-chw');
  if(chwEl){chwEl.value=mat.chw;}
  const eTubo=document.getElementById('ad-e-tubo');
  if(eTubo){eTubo.value=mat.E_mpa;}
  state._materialKey=key;
  calcAducao();
  addAudit(`Material: ${mat.label} (C=${mat.chw}, n=${mat.n_mann}, E=${mat.E_mpa} MPa)`);
}

/** Opções <option> para os selects de material */
function materialOptions(selectedChw){
  return Object.entries(MATERIAIS_HIDRO).map(([k,m])=>
    `<option value="${k}" ${m.chw===selectedChw?'selected':''}>${m.chw} — ${m.label}</option>`
  ).join('');
}
