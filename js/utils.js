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
  pvc_novo:   { label:'PVC / PEAD (novo)',            chw:150, n_mann:0.009, E_mpa:2800,   co2_kg_per_kg:2.7,  rho_kg_m3:1400 },
  pvc_uso:    { label:'PVC / PEAD (uso)',             chw:140, n_mann:0.010, E_mpa:2800,   co2_kg_per_kg:2.7,  rho_kg_m3:1400 },
  pead:       { label:'PEAD (DN ≥ 200 mm)',           chw:140, n_mann:0.009, E_mpa:1000,   co2_kg_per_kg:2.5,  rho_kg_m3:950  },
  ffd:        { label:'Ferro Fundido Dúctil (FFD)',   chw:130, n_mann:0.012, E_mpa:170000, co2_kg_per_kg:2.1,  rho_kg_m3:7200 },
  ffc:        { label:'Ferro Fundido Cinzento (FFC)', chw:120, n_mann:0.013, E_mpa:110000, co2_kg_per_kg:2.1,  rho_kg_m3:7200 },
  concreto_l: { label:'Concreto liso',                chw:110, n_mann:0.012, E_mpa:30000,  co2_kg_per_kg:0.35, rho_kg_m3:2400 },
  concreto_r: { label:'Concreto rugoso / Amianto',   chw:100, n_mann:0.014, E_mpa:30000,  co2_kg_per_kg:0.35, rho_kg_m3:2400 },
  aco:        { label:'Aço sem revestimento',         chw:90,  n_mann:0.011, E_mpa:210000, co2_kg_per_kg:1.85, rho_kg_m3:7850 },
};

/** Preenche automaticamente os campos de material no módulo de adução */
function applyMaterialAducao(key){
  const mat=MATERIAIS_HIDRO[key];
  if(!mat)return;
  // Atualiza o campo oculto que calcAducao() lê
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

// ══════════════════════════════════════════
// TABELA DE CUSTOS ESTIMADOS — SINAPI / SABESP 2024
// ══════════════════════════════════════════
// Custos unitários de referência (material + assentamento/instalação).
// Fonte: SINAPI / SABESP / FUNASA — valores médios para Nordeste/Sudeste 2024.
// NOTA: apenas para estimativa de viabilidade — consultar orçamentista para projeto.
// var (não const) para ser acessível em testes via vm.runInContext
var TABELA_CUSTOS = {
  // Adutora — custo por metro (R$/m) por DN nominal (mm).
  // Inclui: material PVC/PEAD, escavação, assentamento, reaterro e berço de areia.
  adutora_rm: {
    50:180, 75:230, 100:290, 125:360, 150:450, 200:570,
    250:720, 300:910, 350:1140, 400:1420, 450:1750, 500:2130,
    600:3000, 700:4050, 800:5300, 900:6750, 1000:8400
  },
  // Rede de distribuição — custo por metro (R$/m) por DN nominal (mm)
  rede_rm: {
    50:160, 75:200, 100:260, 125:325, 150:405,
    200:510, 250:645, 300:810, 350:995, 400:1200
  },
  // Reservatório de concreto armado elevado/apoiado — R$/m³ de volume
  reservatorio_m3: 1800,
  // ETA filtro rápido — R$/m² de área de filtração
  eta_m2: 8500,
  // ETE lagoa facultativa — R$/m³ de volume útil
  ete_m3: 95,
  // OPEX como fração do CAPEX por ano (tipicamente 3–5%)
  opex_pct: 0.04,
};

/**
 * Estima o custo total da adutora (material + assentamento).
 * @param {number} DN_mm  - Diâmetro nominal (mm)
 * @param {number} L_m    - Comprimento (m)
 * @returns {number} custo em R$
 */
function estimarCustoAdutora(DN_mm, L_m) {
  var tbl = TABELA_CUSTOS.adutora_rm;
  var dnsDisp = Object.keys(tbl).map(Number).sort(function(a,b){return a-b;});
  var dnKey = dnsDisp.find(function(d){return d>=DN_mm;}) || dnsDisp[dnsDisp.length-1];
  return tbl[dnKey] * L_m;
}

/**
 * Estima o custo total da rede de distribuição (material + assentamento).
 * @param {number} DN_mm  - Diâmetro nominal (mm)
 * @param {number} L_m    - Comprimento (m)
 * @returns {number} custo em R$
 */
function estimarCustoRede(DN_mm, L_m) {
  var tbl = TABELA_CUSTOS.rede_rm;
  var dnsDisp = Object.keys(tbl).map(Number).sort(function(a,b){return a-b;});
  var dnKey = dnsDisp.find(function(d){return d>=DN_mm;}) || dnsDisp[dnsDisp.length-1];
  return tbl[dnKey] * L_m;
}

/**
 * Formata valor em R$ com sufixo Mi / mil.
 * @param {number} val - valor em R$
 * @returns {string}
 */
function formatBRL(val) {
  if(val >= 1e9) return 'R$ ' + (val/1e9).toFixed(2).replace('.',',') + ' Bi';
  if(val >= 1e6) return 'R$ ' + (val/1e6).toFixed(2).replace('.',',') + ' Mi';
  if(val >= 1e3) return 'R$ ' + (val/1e3).toFixed(0) + ' mil';
  return 'R$ ' + Math.round(val).toLocaleString('pt-BR');
}

/**
 * Calcula pressões estáticas em pontos extremos da rede de distribuição (Pré-EPANET).
 * P_baixo = cota_reservatório − cota_ponto_mais_baixo  (pressão estática máxima)
 * P_alto  = cota_reservatório − cota_ponto_mais_alto − Hf (pressão residual mínima)
 * @param {number}      cotaRes   - Cota do nível do reservatório (m)
 * @param {number|null} cotaBaixo - Cota do ponto mais baixo da rede (m), null se não informado
 * @param {number|null} cotaAlto  - Cota do ponto mais alto da rede (m), null se não informado
 * @param {number}      Hf        - Perda de carga total na adutora (m) — usada como estimativa conservadora
 * @returns {{ P_baixo: number|null, P_alto: number|null }}
 */
function calcPressaoRede(cotaRes, cotaBaixo, cotaAlto, Hf) {
  var P_baixo = cotaBaixo !== null ? cotaRes - cotaBaixo : null;
  var P_alto  = cotaAlto  !== null ? cotaRes - cotaAlto - Hf : null;
  return { P_baixo: P_baixo, P_alto: P_alto };
}

/**
 * Calcula o tempo de esvaziamento do reservatório em cenário de racionamento.
 * @param {number} V_m3          - Volume útil do reservatório (m³)
 * @param {number} Q_captacao_ls - Vazão captável com a restrição aplicada (L/s)
 * @param {number} Q_consumo_ls  - Vazão de consumo máximo no período (L/s)
 * @returns {number} tempo de esvaziamento em horas (Infinity se captação ≥ consumo)
 */
function calcTempoEsvaziamento(V_m3, Q_captacao_ls, Q_consumo_ls) {
  var deficit_ls = Q_consumo_ls - Q_captacao_ls;
  if(deficit_ls <= 0) return Infinity;
  // T_h = V(m³) × 1000(L/m³) / (déficit(L/s) × 3600(s/h))
  return (V_m3 * 1000) / (deficit_ls * 3600);
}

function validarCampoNumerico(el,min,max,unidade){
  var v=parseFloat(el.value);
  el.classList.remove('input-error','input-ok');
  var msg=el.nextElementSibling;
  if(!msg||!msg.classList.contains('campo-hint')){
    msg=document.createElement('span');
    msg.className='campo-hint';
    el.parentNode.insertBefore(msg,el.nextSibling);
  }
  if(isNaN(v)){el.classList.add('input-error');msg.textContent='Valor invalido';msg.style.color='var(--red)';return false;}
  if(min!==null&&v<min){el.classList.add('input-error');msg.textContent='Min: '+min+(unidade?' '+unidade:'');msg.style.color='var(--red)';return false;}
  if(max!==null&&v>max){el.classList.add('input-error');msg.textContent='Max: '+max+(unidade?' '+unidade:'');msg.style.color='var(--red)';return false;}
  el.classList.add('input-ok');msg.textContent='';return true;
}
