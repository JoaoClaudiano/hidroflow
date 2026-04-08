// ══════════════════════════════════════════
// DIMENSIONAMENTO + PARÂMETROS CUSTOM
// ══════════════════════════════════════════

// ── Manning — velocidade em conduto parcialmente cheio ─────────────────────
// v = (1/n) × Rh^(2/3) × S^(1/2)   [m/s]
// Rh = raio hidráulico (m), S = declividade (m/m), n = coef. Manning
// Retorna { v_m_s, v_min_ok, D_m, area_m2, Rh_m }
function calcManning(n_mann, D_m, S, laminaFrac){
  // laminaFrac = fração de lâmina d'água (0,5–0,75 típico para SES)
  const frac=Math.min(Math.max(laminaFrac??0.65,0.1),0.9);
  const theta=2*Math.acos(1-2*frac); // ângulo central em radianos
  const area=((theta-Math.sin(theta))/8)*D_m**2;
  const perimeter=(theta/2)*D_m;
  const Rh=perimeter>0?area/perimeter:D_m/4;
  const v_m_s=(1/n_mann)*Math.pow(Rh,2/3)*Math.pow(S,0.5);
  return{v_m_s,v_min_ok:v_m_s>=0.6,area_m2:area,Rh_m:Rh,theta};
}
function toggleCustomParams(){
  const show=document.getElementById('chk-custom').checked;
  document.getElementById('custom-params').style.display=show?'block':'none';
  renderDimensionamento();
}

// Coeficiente de ponta de esgoto pela Fórmula de Harmon (P em mil hab)
// M = 1 + 14/(4+√P) = (4+√P+14)/(4+√P) = (18+√P)/(4+√P)
function harmonPeakFactor(pop){
  const P=pop/1000;
  return(18+Math.sqrt(P))/(4+Math.sqrt(P));
}

function getParams(){
  const useCustom=document.getElementById('chk-custom').checked;
  const cp_agua=+document.getElementById('cp-agua').value;
  const cp_esgoto=+document.getElementById('cp-esgoto').value;
  const cp_res=+document.getElementById('cp-residuos').value;
  const cp_en=+document.getElementById('cp-energia').value;
  return{
    agua: useCustom&&cp_agua>0?cp_agua:+document.getElementById('sl-agua').value,
    ret:  useCustom&&cp_esgoto>0?cp_esgoto/100:+document.getElementById('sl-esgoto').value/100,
    res:  useCustom&&cp_res>0?cp_res:+document.getElementById('sl-residuos').value,
    en:   useCustom&&cp_en>0?cp_en:+document.getElementById('sl-energia').value,
    K1:   +(document.getElementById('k1').value)||1.2,
    K2:   +(document.getElementById('k2').value)||1.5,
    K3:   +(document.getElementById('k3').value)||0.5,
    extra1Nome: document.getElementById('cp-extra1-nome').value,
    extra1Val:  +document.getElementById('cp-extra1-val').value||0,
    custom: useCustom,
    useHarmon: !!(document.getElementById('chk-harmon')&&document.getElementById('chk-harmon').checked)
  };
}

function calcInfra(pop,p){
  const Qmed=pop*p.agua/86400;
  // NBR 12217: volume mínimo de regularização = 1/3 do volume do dia de maior consumo
  const vol_res_m3=Qmed*p.K1*86400/(3*1000);
  const K_harmon=harmonPeakFactor(pop);
  // Vazão de ponta de esgoto: K1 padrão ou Harmon (dependente da população)
  const QesgPonta=p.useHarmon?(Qmed*p.ret*K_harmon):(Qmed*p.ret*p.K1);
  // Vazão de hora de ponta de esgoto: K1×K2 (não-Harmon) ou Harmon (já inclui pico horário)
  const QesgK1K2=p.useHarmon?QesgPonta:(Qmed*p.ret*p.K1*p.K2);
  return{
    Qmed, QK1:Qmed*p.K1, QK2:Qmed*p.K1*p.K2, QK3:Qmed*p.K3,
    Qesg:Qmed*p.ret, QesgK1:QesgPonta, QesgK1K2,
    K_harmon, useHarmon:p.useHarmon,
    res_td:pop*p.res/1000, en_mwh:pop*p.en/1000,
    m3dia:pop*p.agua/1000,
    vol_res_m3,
    vol_eta_m3:Qmed*86400/1000,
    vol_ete_m3:Qmed*p.ret*86400*20/1000
  };
}

function updateSlider(tipo){
  const sl=document.getElementById('sl-'+tipo),sv=document.getElementById('sv-'+tipo);
  if(tipo==='agua')sv.textContent=sl.value+' L/hab/dia';
  else if(tipo==='esgoto')sv.textContent=sl.value+'%';
  else if(tipo==='residuos')sv.textContent=(+sl.value).toFixed(2)+' kg/hab/dia';
  else if(tipo==='energia')sv.textContent=sl.value+' kWh/hab/mês';
  renderDimensionamento();
  if(state.projData?.length)calcAducao();
}

function renderAnaliseSensibilidade(popBase,p){
  var cenarios=[-0.2,-0.1,0,0.1,0.2];
  var rows=cenarios.map(function(delta){
    var pop=Math.round(popBase*(1+delta));
    var v=calcInfra(pop,p);
    var label=delta===0?'Base (0%)':'('+(delta>0?'+':'')+(delta*100).toFixed(0)+'%)';
    return '<tr'+(delta===0?' class="highlight"':'')+'><td>'+label+'</td><td>'+pop.toLocaleString('pt-BR')+'</td><td>'+(v.QK1).toFixed(2)+'</td><td>'+(v.QK2).toFixed(2)+'</td><td>'+Math.round(v.vol_res_m3).toLocaleString('pt-BR')+'</td><td>'+Math.round(v.m3dia).toLocaleString('pt-BR')+'</td></tr>';
  });
  return '<table class="tbl"><thead><tr><th>Cenario</th><th>Pop (hab)</th><th>QK1 (L/s)</th><th>QK2 (L/s)</th><th>Vol.Res (m3)</th><th>Demanda (m3/dia)</th></tr></thead><tbody>'+rows.join('')+'</tbody></table>';
}

function setInfraAno(idx,btn){
  state.infraAnoIdx=idx;
  document.querySelectorAll('#infra-anos .btn').forEach(b=>b.classList.remove('btn-primary'));
  btn.classList.add('btn-primary');
  renderDimensionamento();
}

function getPopForAno(ano){
  if(state.projData.length){const r=state.projData.find(x=>x.ano===ano);return r?r.pop:state.projData[state.projData.length-1].pop;}
  if(!state.censosRaw)return 120000;
  const d=state.censosRaw;
  return Math.round(d[0].pop*Math.pow(1+(state.coefs.i_geo||0.015),ano-d[0].ano));
}

function renderDimensionamento(){
  if(!state.infraAnos.length)return;
  const ano=state.infraAnos[state.infraAnoIdx]||state.infraAnos[0];
  const pop=getPopForAno(ano);
  const p=getParams();
  const v=calcInfra(pop,p);
  const customTag=p.custom?`<span style="font-size:10px;background:var(--amber-bg);color:var(--amber);padding:1px 6px;border-radius:3px;font-family:var(--mono);margin-left:6px;">param. customizados</span>`:'';

  document.getElementById('infra-display').innerHTML=`
    <p style="font-size:12px;color:var(--text3);margin-bottom:16px;font-family:var(--mono);">
      Demanda projetada para <strong style="color:var(--text);">${ano}</strong> · população: <strong style="color:var(--text);">${pop.toLocaleString('pt-BR')} hab</strong>${customTag}
    </p>
    <div class="infra-section-title">Sistema de abastecimento de água</div>
    <div class="infra-grid">
      <div class="infra-card">${ic(SVG_WATER)}<div class="infra-title">Qméd — Vazão diária</div><div class="infra-value">${v.Qmed.toFixed(2)}</div><div class="infra-unit">L/s</div><div class="infra-unit" style="margin-top:3px;">${v.m3dia.toFixed(0)} m³/dia</div></div>
      <div class="infra-card">${ic(SVG_FLOW)}<div class="infra-title">Q·K1 — Dia de maior consumo</div><div class="infra-value">${v.QK1.toFixed(2)}</div><div class="infra-unit">L/s</div><div class="infra-ponta">K1 = ${p.K1.toFixed(2)}</div></div>
      <div class="infra-card red">${ic(SVG_FLOW,'red')}<div class="infra-title">Q·K1·K2 — Hora de ponta</div><div class="infra-value">${v.QK2.toFixed(2)}</div><div class="infra-unit">L/s</div><div class="infra-ponta">K1·K2 = ${(p.K1*p.K2).toFixed(2)}</div></div>
    </div>
    <div class="infra-section-title">Sistema de esgotamento sanitário</div>
    <div class="infra-grid">
      <div class="infra-card teal">${ic(SVG_SEWER,'teal')}<div class="infra-title">Qesg médio</div><div class="infra-value">${v.Qesg.toFixed(2)}</div><div class="infra-unit">L/s</div><div class="infra-unit" style="margin-top:3px;">Ret. ${(p.ret*100).toFixed(0)}%</div></div>
      <div class="infra-card teal">${ic(SVG_FLOW,'teal')}<div class="infra-title">Qesg dia de maior consumo</div><div class="infra-value">${v.QesgK1.toFixed(2)}</div><div class="infra-unit">L/s</div><div class="infra-ponta">${v.useHarmon?`Harmon K=${v.K_harmon.toFixed(2)}`:`K1 = ${p.K1.toFixed(2)}`}</div></div>
      <div class="infra-card red">${ic(SVG_FLOW,'red')}<div class="infra-title">Qesg hora de ponta</div><div class="infra-value">${v.QesgK1K2.toFixed(2)}</div><div class="infra-unit">L/s</div><div class="infra-ponta">${v.useHarmon?`Harmon K=${v.K_harmon.toFixed(2)}`:`K1·K2 = ${(p.K1*p.K2).toFixed(2)}`}</div></div>
      <div class="infra-card">${ic(SVG_FLOW)}<div class="infra-title">Q mínima noturna</div><div class="infra-value">${v.QK3.toFixed(2)}</div><div class="infra-unit">L/s</div><div class="infra-ponta">K3 = ${p.K3.toFixed(2)}</div></div>
    </div>
    <div class="infra-section-title">Resíduos e energia</div>
    <div class="infra-grid-4">
      <div class="infra-card amber">${ic(SVG_WASTE,'amber')}<div class="infra-title">Resíduos sólidos</div><div class="infra-value">${v.res_td.toFixed(1)}</div><div class="infra-unit">ton/dia</div><div class="infra-unit" style="margin-top:3px;">${(v.res_td*365).toFixed(0)} ton/ano</div></div>
      <div class="infra-card amber">${ic(SVG_ENERGY,'amber')}<div class="infra-title">Energia elétrica</div><div class="infra-value">${v.en_mwh.toFixed(0)}</div><div class="infra-unit">MWh/mês</div><div class="infra-unit" style="margin-top:3px;">${(v.en_mwh*12).toLocaleString('pt-BR')} MWh/ano</div></div>
      ${p.extra1Nome&&p.extra1Val>0?`<div class="infra-card green">${ic(SVG_FLOW,'green')}<div class="infra-title">${p.extra1Nome}</div><div class="infra-value">${p.extra1Val.toFixed(2)}</div><div class="infra-unit">L/s (fixo)</div></div>`:''}
    </div>`;

  var sensEl=document.getElementById('sensibilidade-table');
  if(sensEl)sensEl.innerHTML=renderAnaliseSensibilidade(pop,p);
  renderObras(pop,v,p,ano);
  renderChartDemanda(p);
  agendarAutoSave();
  atualizarProgressoFluxo();
}

function renderObras(pop,v,p,ano){
  const diam_adut=Math.sqrt((4*(v.QK1/1000))/(Math.PI*1.5))*1000;
  const diam_rede=Math.sqrt((4*(v.QK2/0.7)/1000)/(Math.PI*2.0))*1000;
  const vol_res=v.vol_res_m3;
  const area_eta=v.m3dia/600;
  const vol_ete=v.vol_ete_m3;
  const area_lagoa=vol_ete/(3.5);

  // Reservação de incêndio (NBR 13714)
  const V_incendio=Math.max(12,Math.min(108,pop*0.0008));
  const vol_res_total=vol_res+V_incendio;

  // Rede de distribuição — diâmetros por trecho típico
  const series_dn_rede=[50,75,100,125,150,200,250,300,350,400];
  const DN_rede=series_dn_rede.find(d=>d>=diam_rede)||series_dn_rede[series_dn_rede.length-1];
  const DN_adut=Math.ceil(diam_adut/25)*25;
  const v_adut_real=(v.QK1/1000)/(Math.PI*(DN_adut/2000)**2);
  const v_rede_real=(v.QK2/1000)/(Math.PI*(DN_rede/2000)**2);
  const warnAdut=v_adut_real>3?`<div style="margin-top:4px;color:var(--red);font-family:var(--mono);font-size:10px;">⚠ Velocidade real ${v_adut_real.toFixed(2)} m/s &gt; 3,0 m/s — risco de erosão. Considere aumentar o DN.</div>`:'';
  const warnRede=v_rede_real>3?`<div style="margin-top:4px;color:var(--red);font-family:var(--mono);font-size:10px;">⚠ Velocidade real ${v_rede_real.toFixed(2)} m/s &gt; 3,0 m/s — risco de erosão. Considere aumentar o DN.</div>`:'';

  // ── Estimativa de custos CAPEX/OPEX ─────────────────────────────────────────
  // Comprimento da adutora: lê do módulo de Adução se disponível, ou usa padrão de 5 km
  const L_adutora=+(document.getElementById('ad-comp')?.value)||5000;
  const L_adutora_km=(L_adutora/1000).toFixed(1);
  // Estimativa de comprimento da rede: ~8 m de rede por habitante (típico Brasil)
  const L_rede=pop*8;
  const capex_res=vol_res_total*TABELA_CUSTOS.reservatorio_m3;
  const capex_adut=estimarCustoAdutora(DN_adut,L_adutora);
  const capex_rede=estimarCustoRede(DN_rede,L_rede);
  const capex_eta=area_eta*TABELA_CUSTOS.eta_m2;
  const capex_ete=vol_ete*TABELA_CUSTOS.ete_m3;
  const opex_pct=TABELA_CUSTOS.opex_pct;
  const opexLabel=(capex)=>`OPEX/ano ≈ ${formatBRL(capex*opex_pct)}`;
  const custoTag=(capex,extra='')=>`
    <div style="margin-top:8px;padding:6px 10px;background:var(--green-bg);border-radius:var(--radius);font-size:11px;font-family:var(--mono);">
      💰 CAPEX estimado: <strong>${formatBRL(capex)}</strong> · ${opexLabel(capex)}${extra}
      <span style="color:var(--text3);display:block;margin-top:2px;font-size:10px;">Ref: SINAPI 2024 — apenas para estudo de viabilidade</span>
    </div>`;

  document.getElementById('dim-display').innerHTML=`
    <p style="font-size:12px;color:var(--text3);font-family:var(--mono);margin-bottom:14px;">Dimensionamento de obras para <strong style="color:var(--text);">${pop.toLocaleString('pt-BR')} hab</strong> em <strong style="color:var(--text);">${ano}</strong></p>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_TANK)} Reservatório de distribuição</div>
        <div><div class="dim-result">${vol_res_total.toFixed(0)}</div><div class="dim-unit">m³ (regularização + incêndio)</div></div>
      </div>
      <div class="dim-detail">Volume de regularização (1/3 do volume do dia de maior consumo, NBR 12217) + reserva de incêndio NBR 13714 (${V_incendio.toFixed(0)} m³). Ref: NBR 12217 / FUNASA.</div>
      <div class="dim-formula">V_reg = (1/3) × Q·K1 × 86.400 / 1.000 = ${vol_res.toFixed(0)} m³ · V_inc = ${V_incendio.toFixed(0)} m³ → <strong>V_total = ${vol_res_total.toFixed(0)} m³</strong></div>
      ${custoTag(capex_res,' · R$1.800/m³ concreto armado')}
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_PIPE)} Adutora principal</div>
        <div><div class="dim-result">${DN_adut}</div><div class="dim-unit">mm (DN nominal)</div></div>
      </div>
      <div class="dim-detail">Diâmetro calculado para conduzir Q·K1 com velocidade de 1,5 m/s. DN nominal arredondado para cima (série ABNT). Velocidade real no DN ${DN_adut} mm: ${v_adut_real.toFixed(2)} m/s.</div>
      <div class="dim-formula">D = √(4·Q / π·v) = ${diam_adut.toFixed(0)} mm calc. → DN ${DN_adut} mm · v = ${v_adut_real.toFixed(2)} m/s</div>
      ${warnAdut}
      ${custoTag(capex_adut,` · ${L_adutora_km} km (comprimento do módulo Adução)`)}
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_PIPE)} Rede de distribuição — tronco principal</div>
        <div><div class="dim-result">DN ${DN_rede}</div><div class="dim-unit">mm (tronco)</div></div>
      </div>
      <div class="dim-detail">Diâmetro para conduzir Q·K1·K2 (hora de ponta) com velocidade de 2,0 m/s no tronco. Derivações secundárias: DN 75–100 mm. Velocidade real no tronco: ${v_rede_real.toFixed(2)} m/s. NBR 12218.</div>
      <div class="dim-formula">D_rede = √(4·Q·K1·K2 / (π·v)) = ${diam_rede.toFixed(0)} mm calc. → DN ${DN_rede} mm · v = ${v_rede_real.toFixed(2)} m/s</div>
      ${warnRede}
      ${custoTag(capex_rede,` · L≈${(L_rede/1000).toFixed(1)} km estimada (~8 m/hab)`)}
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_PLANT)} ETA — Estação de Tratamento de Água</div>
        <div><div class="dim-result">${area_eta.toFixed(0)}</div><div class="dim-unit">m² área de filtração</div></div>
      </div>
      <div class="dim-detail">Área de leito filtrante para taxa de filtração de 600 m³/m²/dia (filtro rápido pressão). Capacidade de tratamento: ${v.m3dia.toFixed(0)} m³/dia.</div>
      <div class="dim-formula">A_ETA = Q / τ = ${v.m3dia.toFixed(0)} m³/dia ÷ 600 m³/m²/dia = ${area_eta.toFixed(0)} m²</div>
      ${custoTag(capex_eta,' · R$8.500/m² filtração')}
      ${renderETAAvancadaCard(v)}
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_SEWER)} ETE — Lagoa Facultativa (TDH 20 dias)</div>
        <div><div class="dim-result">${(vol_ete/1000).toFixed(1)}</div><div class="dim-unit">mil m³ (volume útil)</div></div>
      </div>
      <div class="dim-detail">Lagoa facultativa com tempo de detenção hidráulica de <strong>20 dias</strong> (Von Sperling 2002 / FUNASA — clima tropical). Profundidade útil: 3,5 m. Área da lagoa: ${area_lagoa.toFixed(0)} m² = ${(area_lagoa/10000).toFixed(2)} ha. Vazão afluente: ${v.Qesg.toFixed(2)} L/s. <em>Nota: TDH de 2 dias é adequado para reatores UASB, não para lagoa facultativa.</em></div>
      <div class="dim-formula">V_ETE = Q_esg × 86.400 × TDH(20d) / 1.000 = ${v.Qesg.toFixed(2)} L/s × 86.400 × 20 / 1.000 = ${vol_ete.toFixed(0)} m³</div>
      ${custoTag(capex_ete,' · R$95/m³ lagoa facultativa')}
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_WASTE,'amber')} Aterro sanitário / Galpão de triagem</div>
        <div><div class="dim-result">${(v.res_td*365*20/1000).toFixed(1)}</div><div class="dim-unit">mil ton (20 anos)</div></div>
      </div>
      <div class="dim-detail">Geração de ${v.res_td.toFixed(1)} ton/dia. Volume de aterro necessário para 20 anos: ${(v.res_td*365*20/0.8).toFixed(0)} m³ (densidade 0,8 t/m³).</div>
      <div class="dim-formula">V_aterro = ${v.res_td.toFixed(1)} × 365 × 20 / 0,8 = ${(v.res_td*365*20/0.8).toFixed(0)} m³</div>
    </div>

    <div class="dim-card" style="background:var(--green-bg);">
      <div class="dim-header">
        <div class="dim-title">💰 Resumo CAPEX/OPEX estimado</div>
        <div><div class="dim-result" style="font-size:20px;">${formatBRL(capex_res+capex_adut+capex_eta+capex_ete)}</div><div class="dim-unit">CAPEX total (sem rede)</div></div>
      </div>
      <div class="dim-detail" style="font-family:var(--mono);font-size:11px;">
        Reservatório: ${formatBRL(capex_res)} · Adutora (${L_adutora_km} km): ${formatBRL(capex_adut)} · ETA: ${formatBRL(capex_eta)} · ETE: ${formatBRL(capex_ete)}<br>
        Rede de distribuição (${(L_rede/1000).toFixed(1)} km estimada): ${formatBRL(capex_rede)}<br>
        OPEX anual estimado: ${formatBRL((capex_res+capex_adut+capex_eta+capex_ete+capex_rede)*opex_pct)}
      </div>
      <div class="dim-formula" style="color:var(--text3);font-size:10px;">Ref: SINAPI / SABESP 2024 · Valores médios Nordeste/Sudeste · Não inclui desapropriações, projetos, LI/LP/LO<br><strong>Rede de distribuição:</strong> extensão estimada em ~8 m/hab — CAPEX da rede deve ser interpretado como ordem de grandeza. Use o módulo Rede de Distribuição (Hardy-Cross + EPANET) para quantificação detalhada.</div>
    </div>
    ${renderManningCard(v,p,pop)}`;
}

// ── Lei de Stokes — velocidade de sedimentação (decantadores) ───────────────
// v_s = g × (ρ_p − ρ_w) × d² / (18 × μ)
// Retorna { v_s_m_s, Re_stokes, stokes_ok, A_dec_m2, Q_m3s }
// Válido para Re < 0,5 (regime laminar de sedimentação)
function calcStokes(d_mm, rho_p_kg_m3, temp_C, Q_m3s){
  const g=9.81;
  const rho_w=1000;
  // Viscosidade dinâmica da água em função da temperatura (Poiseuille approx.)
  const mu=0.001002*Math.exp(-0.025*(temp_C-20)); // Pa·s (~1,002e-3 a 20°C)
  const d=d_mm/1000; // m
  const v_s=g*(rho_p_kg_m3-rho_w)*d*d/(18*mu);
  const Re=rho_w*v_s*d/mu;
  const stokes_ok=Re<0.5;
  // Área superficial mínima do decantador: A = Q / v_s
  const A_dec=v_s>0?Q_m3s/v_s:0;
  return{v_s_m_s:v_s,Re_stokes:Re,stokes_ok,A_dec_m2:A_dec,Q_m3s};
}

// ── Calha Parshall — vazão em função da carga hidráulica H_a ─────────────────
// Q = K × H_a^n  (Q em m³/s, H_a em m)
// Coeficientes per NBR 9281 / FUNASA / AWWA — garganta em metros
var PARSHALL_COEFS = [
  {W_m:0.076, label:'3" (0,076 m)',  K:0.0342, n:1.547},
  {W_m:0.152, label:'6" (0,152 m)',  K:0.0703, n:1.547},
  {W_m:0.229, label:'9" (0,229 m)',  K:0.1225, n:1.547},
  {W_m:0.305, label:'12" (0,305 m)', K:0.1771, n:1.547},
  {W_m:0.457, label:'18" (0,457 m)', K:0.3066, n:1.547},
  {W_m:0.610, label:'24" (0,610 m)', K:0.4376, n:1.547},
  {W_m:0.914, label:'36" (0,914 m)', K:0.6955, n:1.566},
  {W_m:1.219, label:'48" (1,219 m)', K:0.9632, n:1.578},
  {W_m:1.524, label:'60" (1,524 m)', K:1.2278, n:1.587},
];

// Retorna { Q_m3s, H_min_m, H_max_m, W_label }
// Modo direto: dado Q, encontra o menor W que opere dentro da faixa livre
// Modo inverso: dado H_a e W, calcula Q
function calcParshall(Q_ls, W_idx){
  const Q_m3s=Q_ls/1000;
  const coef=PARSHALL_COEFS[Math.min(Math.max(0,W_idx),PARSHALL_COEFS.length-1)];
  // H_a a partir de Q: H = (Q/K)^(1/n)
  const H_a=Q_m3s>0?Math.pow(Q_m3s/coef.K,1/coef.n):0;
  // Faixas típicas de H_a por tamanho: 0,03–0,75 m (AWWA M22)
  const H_min=0.03,H_max=0.75;
  const in_range=H_a>=H_min&&H_a<=H_max;
  return{Q_m3s,H_a_m:H_a,in_range,H_min,H_max,W_label:coef.label,K:coef.K,n:coef.n};
}

// Retorna o menor índice de garganta em PARSHALL_COEFS que mantém H_a dentro da
// faixa de escoamento livre (0,03 m ≤ H_a ≤ 0,75 m) para a vazão Q_ls (L/s).
// Retorna -1 se nenhuma garganta disponível for adequada (vazão acima do catálogo).
function autoParshallIdx(Q_ls){
  const H_min=0.03,H_max=0.75;
  const Q_m3s=Q_ls/1000;
  for(let i=0;i<PARSHALL_COEFS.length;i++){
    const c=PARSHALL_COEFS[i];
    const H_a=Q_m3s>0?Math.pow(Q_m3s/c.K,1/c.n):0;
    if(H_a>=H_min&&H_a<=H_max)return i;
  }
  return -1;
}

// ── ETA avançada: Decantador (Stokes) + Calha Parshall ──────────────────────
function renderETAAvancadaCard(v){
  const d_mm=+(document.getElementById('eta-d-particula')?.value||0.05);
  const rho_p=+(document.getElementById('eta-rho-particula')?.value||2650);
  const temp_eta=+(document.getElementById('eta-temperatura')?.value||25);
  const w_idx=+(document.getElementById('eta-parshall-w')?.value??2);

  const Q_m3s=v.Qmed/1000; // Qmed L/s → m³/s
  const Q_m3d=v.m3dia; // m³/dia

  const stokes=calcStokes(d_mm,rho_p,temp_eta,Q_m3s);
  const parsh=calcParshall(v.Qmed,w_idx);

  // Decantador: dimensionamento prático com L/W=4 e profundidade 3,5 m
  const A_dec=stokes.A_dec_m2;
  const L_dec=Math.sqrt(A_dec*4);   // L = 4W
  const W_dec=L_dec/4;
  const prof_dec=3.5;
  const V_dec=A_dec*prof_dec;
  const TDH_dec_h=Q_m3s>0?V_dec/Q_m3s/3600:0; // horas

  const stokesOk=stokes.stokes_ok;
  const parshOk=parsh.in_range;

  // Recomendação automática da menor garganta adequada para a vazão
  const recIdx=autoParshallIdx(v.Qmed);
  const parshRec=recIdx>=0?PARSHALL_COEFS[recIdx]:null;
  const parshRecLabel=parshRec?parshRec.label:'nenhuma disponível (considere medidor eletromagnético)';
  const parshWarnMsg=parshOk?'✅ (dentro da faixa 3–75 cm)'
    :`⚠ fora da faixa recomendada — <strong>garganta sugerida: ${parshRecLabel}</strong>`;

  return `<details class="advanced-opts" style="margin-top:10px;border-top:1px solid var(--border);padding-top:8px;">
    <summary style="font-size:11px;font-weight:600;font-family:var(--mono);color:var(--text2);text-transform:uppercase;letter-spacing:.05em;cursor:pointer;">
      ⚗ Dimensionamento avançado ETA — Decantador (Stokes) &amp; Calha Parshall
    </summary>
    <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--text2);font-family:var(--mono);margin-bottom:6px;text-transform:uppercase;">Decantador — Lei de Stokes</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.7;font-family:var(--mono);">
          d = ${d_mm} mm · ρ_p = ${rho_p} kg/m³ · T = ${temp_eta}°C<br>
          v_s = <strong>${(stokes.v_s_m_s*1000).toFixed(4)} mm/s</strong> ${stokesOk?'✅ (Stokes válido, Re='+stokes.Re_stokes.toFixed(3)+')':'⚠ Re='+stokes.Re_stokes.toFixed(2)+' > 0,5 (usar Newton/Allen)'}<br>
          A_dec = Q / v_s = <strong>${A_dec.toFixed(1)} m²</strong><br>
          L=${L_dec.toFixed(1)} m · W=${W_dec.toFixed(1)} m · Prof.=${prof_dec} m<br>
          TDH = <strong>${TDH_dec_h.toFixed(2)} h</strong> (Vol=${V_dec.toFixed(0)} m³)
        </div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:4px;border-top:1px solid var(--border);padding-top:4px;">
          v_s = g·(ρ_p−ρ_w)·d²/(18·μ) = 9,81×(${rho_p}−1000)×${(d_mm/1000).toFixed(5)}²/(18×μ(${temp_eta}°C))
        </div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:600;color:var(--text2);font-family:var(--mono);margin-bottom:6px;text-transform:uppercase;">Calha Parshall — Mistura rápida</div>
        <div style="font-size:11px;color:var(--text2);line-height:1.7;font-family:var(--mono);">
          Garganta: <strong>${parsh.W_label}</strong> · Q = ${v.Qmed.toFixed(2)} L/s<br>
          H_a calculado = <strong>${(parsh.H_a_m*100).toFixed(1)} cm</strong> ${parshWarnMsg}<br>
          Q = K·H_a^n = ${parsh.K}×(${parsh.H_a_m.toFixed(4)})^${parsh.n} = ${v.Qmed.toFixed(2)} L/s
        </div>
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono);margin-top:4px;border-top:1px solid var(--border);padding-top:4px;">
          Ref: NBR 9281 / AWWA M22. Faixa: 0,03 ≤ H_a ≤ 0,75 m.<br>
          <em>Nota: a garganta sugerida acima é a menor dimensão que mantém escoamento livre (H_a ≤ 0,75 m) para a vazão informada.</em>
        </div>
      </div>
    </div>
  </details>`;
}

// ── Dimensionamento de coletores de esgoto — Manning + infiltração ──────────
function renderManningCard(v,p,pop){
  // Parâmetros lidos do HTML (com defaults conservadores)
  const n_mann=+(document.getElementById('ses-n-mann')?.value||0.013);
  const S_oo=+(document.getElementById('ses-decl')?.value||0.5)/100; // convert % → m/m
  const D_col_mm=+(document.getElementById('ses-dn-coletor')?.value||200);
  const D_col=D_col_mm/1000;
  const lamina_frac=+(document.getElementById('ses-lamina')?.value||65)/100; // convert % → fraction
  const taxa_inf=+(document.getElementById('ses-taxa-infiltracao')?.value||0.1); // L/(s·km)
  const ext_rede_km=+(document.getElementById('ses-ext-rede')?.value||5); // km
  const Q_inf=taxa_inf*ext_rede_km; // L/s

  const mann=calcManning(n_mann,D_col,S_oo,lamina_frac);
  const Q_mann_ls=mann.area_m2*mann.v_m_s*1000; // L/s
  const Q_design=v.QesgK1K2+Q_inf; // L/s total (K1·K2 hora de ponta + infiltração)
  const capacOk=Q_mann_ls>=Q_design;
  const vMin_ok=mann.v_min_ok;

  return `<div class="dim-card">
    <div class="dim-header">
      <div class="dim-title">${ic(SVG_SEWER,'teal')} SES — Coletor de Esgoto (Manning)</div>
      <div><div class="dim-result" style="color:${capacOk?'var(--green)':'var(--red)'};">${capacOk?'OK':'INSUF.'}</div><div class="dim-unit">DN ${D_col_mm} mm</div></div>
    </div>
    <div class="dim-detail">
      Manning n=${n_mann} · S=${(S_oo*100).toFixed(2)}% · Lâmina ${(lamina_frac*100).toFixed(0)}% · DN ${D_col_mm} mm<br>
      v=${mann.v_m_s.toFixed(3)} m/s ${vMin_ok?'✅':'⚠ abaixo de 0,6 m/s (auto-limpeza)'} · Q_coletor=${Q_mann_ls.toFixed(2)} L/s<br>
      Q_infiltração=${Q_inf.toFixed(3)} L/s (taxa ${taxa_inf} L/s·km × ${ext_rede_km} km) · Q_design (K1·K2)=${Q_design.toFixed(2)} L/s
    </div>
    <div class="dim-formula">
      v = (1/n)·Rh^2/3·S^1/2 = (1/${n_mann})×${mann.Rh_m.toFixed(4)}^0,667×${(S_oo*100).toFixed(2)}%^0,5 = ${mann.v_m_s.toFixed(3)} m/s
      Q_inf = ${taxa_inf} × ${ext_rede_km} = ${Q_inf.toFixed(3)} L/s → Q_total (K1·K2+inf) = ${Q_design.toFixed(2)} L/s
    </div>
  </div>`;
}

function renderChartDemanda(p){
  if(!state.projData.length)return;
  const anos5=state.projData.filter(x=>x.ano%5===0);
  const labels=anos5.map(x=>x.ano);
  const agua_ls=anos5.map(x=>+(x.pop*p.agua*p.K1/86400).toFixed(2));
  const esg_ls=anos5.map(x=>+(x.pop*p.agua*p.ret*p.K1/86400).toFixed(2));
  const res_td=anos5.map(x=>+(x.pop*p.res/1000).toFixed(1));
  if(state.charts.demanda)state.charts.demanda.destroy();
  state.charts.demanda=new Chart(document.getElementById('chart-demanda'),{
    type:'line',
    data:{labels,datasets:[
      {label:'Água Q·K1 (L/s)',data:agua_ls,borderColor:'#4f7ef5',borderWidth:2,pointRadius:3,fill:false,tension:0,yAxisID:'y'},
      {label:'Esgoto Q·K1 (L/s)',data:esg_ls,borderColor:'#0e7490',borderWidth:2,pointRadius:3,fill:false,tension:0,yAxisID:'y'},
      {label:'Resíduos (ton/dia)',data:res_td,borderColor:'#e09000',borderWidth:2,pointRadius:3,borderDash:[4,3],fill:false,tension:0,yAxisID:'y2'},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11},boxWidth:20}}},
      scales:{
        y:{type:'linear',position:'left',title:{display:true,text:'L/s',font:{size:11}},ticks:{font:{size:11}}},
        y2:{type:'linear',position:'right',title:{display:true,text:'ton/dia',font:{size:11}},grid:{drawOnChartArea:false},ticks:{font:{size:11}}}
      }}
  });
}
