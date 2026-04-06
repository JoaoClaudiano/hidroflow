// ══════════════════════════════════════════
// UTILITIES — helpers compartilhados
// ══════════════════════════════════════════
function addAudit(action){
  const time=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  state.auditLog.push({time,action});
  if(state.auditLog.length>100)state.auditLog.shift();
}

function removeAcentos(s){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function escHtml(s){return s.replace(/'/g,"\\'");}
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
