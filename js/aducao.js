// ══════════════════════════════════════════
// ADUÇÃO & ELEVATÓRIAS
// ══════════════════════════════════════════

// Curva de consumo horária típica (fração do consumo diário, soma=1)
const CURVA_CONSUMO_HORARIA=[
  0.022,0.018,0.015,0.014,0.016,0.024, // 0h–5h
  0.034,0.048,0.056,0.058,0.054,0.050, // 6h–11h
  0.052,0.050,0.048,0.046,0.044,0.046, // 12h–17h
  0.058,0.052,0.046,0.040,0.034,0.026  // 18h–23h
];

// ── Swamee-Jain — fator de atrito de Darcy-Weisbach (explícita, sem iteração) ──
// ε = rugosidade absoluta (m), D = diâmetro (m), Re = número de Reynolds
// Faixa válida: 10⁻⁶ ≤ ε/D ≤ 10⁻²  e  5000 ≤ Re ≤ 10⁸
function calcSwameeJain(eps_m, D_m, Re){
  if(Re<=0||D_m<=0)return 0.02;
  const rel=eps_m/D_m;
  const arg=rel/3.7+5.74/Math.pow(Re,0.9);
  if(arg<=0)return 0.02;
  const f=0.25/Math.pow(Math.log10(arg),2);
  return Math.max(0.008,f);
}

// ── Darcy-Weisbach — perda de carga unitária J (m/m) ─────────────────────────
function calcDarcyWeisbach(Q_m3s, D_m, eps_m, nu_m2s){
  if(Q_m3s<=0||D_m<=0)return 0;
  const A=Math.PI*(D_m/2)**2;
  const v=Q_m3s/A;
  const Re=v*D_m/nu_m2s;
  const f=calcSwameeJain(eps_m,D_m,Re);
  return f*(v**2)/(2*9.81*D_m);
}

// ── Pressão de vapor saturada pela fórmula de Antoine (kPa) ─────────────────
// Válida de 1°C a 100°C — Antoine constants for water (Buck equation)
function calcPvapor(temp_C){
  return 0.61121*Math.exp((18.678-temp_C/234.5)*(temp_C/(257.14+temp_C)));
}

// ── NPSH disponível ────────────────────────────────────────────────────────
// NPSH_d = Patm/ρg - Pv/ρg - Hs - hf_suc
// Patm = 101.325 kPa, ρ = 1000 kg/m³, g = 9.81 m/s²
function calcNPSH(Hs_m, hf_suc_m, temp_C){
  const Patm=101.325; // kPa
  const rho=1000,g=9.81;
  const Pv=calcPvapor(temp_C);
  const NPSH_d=(Patm-Pv)*1000/(rho*g)-Hs_m-hf_suc_m;
  return NPSH_d;
}

function presetCagece(){
  document.getElementById('ad-horas').value='18';
  document.getElementById('ad-eta').value='72';
  document.getElementById('ad-chw').value='140';
  if(document.getElementById('ad-material'))document.getElementById('ad-material').value='pvc_uso';
  document.getElementById('ad-k-bresse').value='auto';
  document.getElementById('ad-esp').value='8';
  const sa=document.getElementById('sl-agua');
  if(sa){sa.value='165';document.getElementById('sv-agua').textContent='165 L/hab/dia';}
  const k1=document.getElementById('k1');if(k1)k1.value='1.20';
  const k2=document.getElementById('k2');if(k2)k2.value='1.50';
  calcAducao();addAudit('Preset CAGECE aplicado');
}
function presetFunasa(){
  document.getElementById('ad-horas').value='16';document.getElementById('ad-eta').value='70';
  document.getElementById('ad-chw').value='140';document.getElementById('ad-k-bresse').value='1.2';
  document.getElementById('ad-esp').value='8';
  const sa=document.getElementById('sl-agua');if(sa){sa.value='150';document.getElementById('sv-agua').textContent='150 L/hab/dia';}
  calcAducao();addAudit('Preset FUNASA aplicado');
}
function presetConservador(){
  document.getElementById('ad-horas').value='12';document.getElementById('ad-eta').value='65';
  document.getElementById('ad-chw').value='120';document.getElementById('ad-k-bresse').value='1.4';
  document.getElementById('ad-esp').value='10';
  const sa=document.getElementById('sl-agua');if(sa){sa.value='200';document.getElementById('sv-agua').textContent='200 L/hab/dia';}
  calcAducao();addAudit('Preset Conservador aplicado');
}

function calcAducao(){
  const emptyEl=document.getElementById('ad-empty');
  const resultEl=document.getElementById('ad-result');
  if(!state.projData.length||!state.censosRaw){emptyEl.style.display='block';resultEl.style.display='none';return;}
  emptyEl.style.display='none';
  resultEl.style.display='block';

  if(!document.getElementById('ad-infra-anos').children.length){
    document.getElementById('ad-infra-anos').innerHTML=state.infraAnos.map((a,i)=>
      `<button class="btn btn-sm ${i===0?'btn-primary':''}" onclick="setAdAno(${i},this)">${a}</button>`).join('');
  }

  const p=getParams();
  const adAnoIdx=state.adAnoIdx??0;
  const ano=state.infraAnos[adAnoIdx]||state.infraAnos[0];
  const pop=getPopForAno(ano);
  const Qmed=pop*p.agua/86400;
  const QK1=Qmed*p.K1;
  const QK2=QK1*p.K2;

  const cotaCap=+document.getElementById('ad-cota-cap').value||10;
  const cotaRes=+document.getElementById('ad-cota-res').value||85;
  const L=+document.getElementById('ad-comp').value||3500;
  const C=+document.getElementById('ad-chw').value||140;
  const N=Math.max(1,Math.min(24,+document.getElementById('ad-horas').value||16));
  const eta=(+document.getElementById('ad-eta').value||72)/100;
  const e_mm=+document.getElementById('ad-esp').value||8;

  // Mapa de pressões — campos opcionais
  const cotaPontoBaixoEl=document.getElementById('ad-cota-ponto-baixo');
  const cotaPontoBaixo=cotaPontoBaixoEl&&cotaPontoBaixoEl.value.trim()?+cotaPontoBaixoEl.value:null;
  const cotaPontoAltoEl=document.getElementById('ad-cota-ponto-alto');
  const cotaPontoAlto=cotaPontoAltoEl&&cotaPontoAltoEl.value.trim()?+cotaPontoAltoEl.value:null;

  const Qb=QK1*(24/N);

  const kBresseInput=document.getElementById('ad-k-bresse').value;
  const K_bresse=kBresseInput==='auto'?1.3*Math.pow(N/24,0.25):+kBresseInput;
  const D_bresse=K_bresse*Math.sqrt(Qb/1000);
  const series_dn=[50,75,100,125,150,200,250,300,350,400,450,500,600,700,800,900,1000];
  const D_mm_calc=D_bresse*1000;
  const DN=series_dn.find(d=>d>=D_mm_calc)||series_dn[series_dn.length-1];
  const D_real=DN/1000;
  const v_real=(Qb/1000)/(Math.PI*(D_real/2)**2);

  // ── Método hidráulico: Hazen-Williams ou Darcy-Weisbach ─────────────────
  const metodoDW=document.querySelector('input[name="metodo-hidra"]:checked')?.value==='dw';
  const dwFieldsEl=document.getElementById('dw-fields');
  if(dwFieldsEl)dwFieldsEl.style.display=metodoDW?'block':'none';
  let J,Hf,metodoLabel;
  if(metodoDW){
    const eps_mm=+document.getElementById('ad-rugosidade')?.value||0.1;
    const eps_m=eps_mm/1000;
    const nu=1e-6; // viscosidade cinemática da água a ~20°C (m²/s)
    J=calcDarcyWeisbach(Qb/1000,D_real,eps_m,nu);
    metodoLabel=`Darcy-Weisbach + Swamee-Jain (ε=${eps_mm} mm)`;
  }else{
    J=10.643*Math.pow(Qb/1000,1.852)/(Math.pow(C,1.852)*Math.pow(D_real,4.87));
    metodoLabel=`Hazen-Williams (C=${C})`;
  }
  Hf=J*L;
  const Hloc=Hf*0.10;

  // ── C futuro — envelhecimento da tubulação ───────────────────────────────
  const C_futuro_input=+document.getElementById('ad-chw-futuro')?.value||0;
  let Hf_futuro=null,J_futuro=null;
  if(C_futuro_input>0&&!metodoDW){
    // Horizonte de projeto: diferença entre ano atual e ano selecionado
    const anoBase=state.censosRaw?state.censosRaw[state.censosRaw.length-1].ano:new Date().getFullYear();
    const anosDecorridos=Math.max(0,(state.infraAnos[state.adAnoIdx||0]||anoBase+20)-anoBase);
    const horizonte_max=20;
    const C_interp=anosDecorridos>=horizonte_max?C_futuro_input:
      C+(C_futuro_input-C)*(anosDecorridos/horizonte_max);
    J_futuro=10.643*Math.pow(Qb/1000,1.852)/(Math.pow(C_interp,1.852)*Math.pow(D_real,4.87));
    Hf_futuro=J_futuro*L;
  }

  const Hgeo=cotaRes-cotaCap;
  const Hman=Hgeo+Hf+Hloc;

  const Pot_cv=(1000*(Qb/1000)*Hman)/(75*eta);
  const Pot_kw=Pot_cv*0.7355;
  const potMotor=[5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110,132,160,200,250,315];
  const Pot_motor_kw=potMotor.find(pw=>pw>=Pot_kw)||potMotor[potMotor.length-1];
  const Pot_motor_cv=Math.round(Pot_motor_kw/0.7355);

  // Fator de serviço de catálogo (opcional)
  const useFatorServico=document.getElementById('ad-fator-servico')&&document.getElementById('ad-fator-servico').checked;
  let Pot_motor_kw_fs=Pot_motor_kw,Pot_motor_cv_fs=Pot_motor_cv,fatorServico=1;
  if(useFatorServico){
    if(Pot_cv<=2)fatorServico=1.50;
    else if(Pot_cv<=5)fatorServico=1.20;
    else if(Pot_cv<=20)fatorServico=1.15;
    else fatorServico=1.10;
    const Pot_kw_fs=Pot_kw*fatorServico;
    Pot_motor_kw_fs=potMotor.find(pw=>pw>=Pot_kw_fs)||potMotor[potMotor.length-1];
    Pot_motor_cv_fs=Math.round(Pot_motor_kw_fs/0.7355);
  }

  // Golpe de Aríete — Joukowsky ou Michaud (se T_c fornecido)
  // E_tubo estimado pelo material selecionado (biblioteca) ou pelo C H-W
  let E_tubo=2800;
  const matKey=state._materialKey;
  if(matKey&&typeof MATERIAIS_HIDRO!=='undefined'&&MATERIAIS_HIDRO[matKey]){
    E_tubo=MATERIAIS_HIDRO[matKey].E_mpa;
  }else{
    const C_val=+document.getElementById('ad-chw').value||140;
    if(C_val>=130&&C_val<140)E_tubo=170000;
    else if(C_val>=120&&C_val<130)E_tubo=170000;
    else if(C_val<120)E_tubo=30000;
  }
  const eTuboInput=document.getElementById('ad-e-tubo');
  const eTuboUser=eTuboInput&&eTuboInput.value.trim()?+eTuboInput.value:0;
  const eTuboSource=eTuboUser>0?'fabricante':'estimado pelo C H-W';
  if(eTuboUser>0)E_tubo=eTuboUser;
  const E_agua=2100;
  const rho=1000;
  const e_m=e_mm/1000;
  const a_celer=Math.sqrt((E_agua*1e6/rho)/(1+(D_real*E_agua)/(e_m*E_tubo)));
  const g=9.81;
  // T_c — tempo de fechamento da válvula (opcional)
  const tcInput=document.getElementById('ad-tc');
  const T_c=tcInput&&tcInput.value.trim()?+tcInput.value:0;
  const T_critico=2*L/a_celer; // 2L/a — limiar de fechamento lento
  let delta_H,formulaAriete;
  if(T_c>0&&T_c>T_critico){
    delta_H=(2*L*v_real)/(g*T_c); // Michaud
    formulaAriete=`Michaud (T_c=${T_c}s > 2L/a=${T_critico.toFixed(1)}s) · ΔH = 2L·v/(g·T_c)`;
  }else{
    delta_H=(a_celer*v_real)/g; // Joukowsky
    formulaAriete=T_c>0&&T_c<=T_critico
      ?`Joukowsky (T_c=${T_c}s ≤ 2L/a=${T_critico.toFixed(1)}s — fechamento rápido) · ΔH = a·v/g`
      :'Joukowsky (fechamento instantâneo) · ΔH = a·v/g';
  }
  const P_max=Hman+delta_H;
  const pn_series=[60,80,100,125,160,200,250,315];
  const PN_rec=pn_series.find(pn=>pn>=P_max*1.2)||pn_series[pn_series.length-1];
  const risco_ariete=delta_H>Hman*0.5?'crit':delta_H>Hman*0.25?'warn':'ok';

  // ── NPSH — verificação anti-cavitação ────────────────────────────────────
  const npshHs=+document.getElementById('ad-npsh-hs')?.value||3;
  const npshReq=+document.getElementById('ad-npsh-req')?.value||4;
  const npshTemp=+document.getElementById('ad-npsh-temp')?.value||25;
    const hf_suc=Hf*0.05; // estimativa: 5% Hf como perda na linha de sucção
  const NPSH_d=calcNPSH(npshHs,hf_suc,npshTemp);
  const npshMargem=0.5; // margem de segurança mínima
  const npshOk=NPSH_d>=(npshReq+npshMargem);
  const npshEl=document.getElementById('ad-npsh-result');
  if(npshEl){
    const npshCls=npshOk?'var(--green)':'var(--red)';
    const npshIcon=npshOk?'✅':'🚨';
    npshEl.innerHTML=`<span style="color:${npshCls};">${npshIcon} NPSH disponível = <strong>${NPSH_d.toFixed(2)} m</strong> | NPSH requerido = ${npshReq} m | Margem = ${(NPSH_d-npshReq).toFixed(2)} m${npshOk?'':' — <strong>RISCO DE CAVITAÇÃO</strong>'}</span>`;
  }

  // ── Estimativa de pegada de carbono ──────────────────────────────────────
  // Emissão da tubulação: peso estimado × fator CO₂ do material
  // Peso tubulação: π × D × e × ρ_mat × L (kg), ρ estimado por material
  let co2_pipe=0,co2_energy=0,co2_total=0,co2Label='';
  const matKeyC=state._materialKey;
  const matC=matKeyC&&typeof MATERIAIS_HIDRO!=='undefined'?MATERIAIS_HIDRO[matKeyC]:null;
  if(matC){
    const rho_mat=matC.rho_kg_m3||1400;
    const peso_tubo=Math.PI*D_real*(e_mm/1000)*rho_mat*L; // kg
    co2_pipe=peso_tubo*matC.co2_kg_per_kg/1000; // ton CO₂e
    const Pot_kw_real=(1000*(Qb/1000)*Hman)/(75*eta)*0.7355;
    const fator_grid=0.088; // kg CO₂e/kWh — fator médio SIN (EPE 2023)
    const kwh_ano=Pot_kw_real*(N*365);
    co2_energy=kwh_ano*fator_grid/1000; // ton CO₂e/ano
    co2_total=co2_pipe+co2_energy*20; // 20 anos de operação
    co2Label=matC.label;
  }

  // Rippl
  const Qdiario=Qmed*86400;
  const consumo_h=CURVA_CONSUMO_HORARIA.map(f=>f*Qdiario);
  const horas_idx=Array.from({length:24},(_,i)=>i);
  const horas_sorted=[...horas_idx].sort((a2,b2)=>consumo_h[a2]-consumo_h[b2]);
  const horas_desligadas=new Set(horas_sorted.slice(0,24-N));
  const aducao_h=horas_idx.map(h=>horas_desligadas.has(h)?0:Qb*3600);
  let entSum=0,saiSum=0;
  const entrada_cum=[],saida_cum=[],saldo_cum=[];
  for(let h=0;h<24;h++){
    entSum+=aducao_h[h];saiSum+=consumo_h[h];
    entrada_cum.push(entSum);saida_cum.push(saiSum);saldo_cum.push(entSum-saiSum);
  }
  const saldo_max=Math.max(...saldo_cum);
  const saldo_min=Math.min(...saldo_cum);
  const V1=(saldo_max-saldo_min)/1000;
  const h_crit=saldo_cum.indexOf(saldo_min);
  const V2=Math.max(50,Qmed*3600*2/1000);
  const V3=Math.max(12,Math.min(108,pop*0.0008));
  const V_total=Math.ceil(V1+V2+V3);

  // Verificação NBR
  const nbrChecks=[];
  const addNBR=(norma,item,ok,msg)=>nbrChecks.push({norma,item,ok,msg});
  addNBR('NBR 12211','Velocidade na adutora (0,6–3,0 m/s)',v_real>=0.6&&v_real<=3.0,
    `v = ${v_real.toFixed(2)} m/s — ${v_real<0.6?'⚠ abaixo do mínimo (risco deposição)':v_real>3?'⚠ acima do máximo (risco erosão/aríete)':'✅ OK'}`);
  addNBR('NBR 12211','Horas de bombeamento (recomendado ≥ 16h/dia)',N>=16,
    `N = ${N}h/dia — ${N<16?'⚠ abaixo de 16h (Qb elevado, maior DN)':'✅ dentro do recomendado'}`);
  addNBR('NBR 12211','Evitar bombeamento 18h–21h (pico ANEEL)',!horas_desligadas.has(19)&&!horas_desligadas.has(20),
    horas_desligadas.has(19)||horas_desligadas.has(20)?'✅ Pico tarifário (19h–20h) está nas horas desligadas':'⚠ Sistema pode operar durante pico tarifário');
  addNBR('NBR 12217','Volume ≥ 1/3 consumo diário máximo',V_total>=Qmed*p.K1*86400/3000,
    `V = ${V_total} m³ · 1/3 Dmax = ${(Qmed*p.K1*86400/3000).toFixed(0)} m³ — ${V_total>=Qmed*p.K1*86400/3000?'✅ OK':'⚠ Abaixo do mínimo NBR 12217'}`);
  addNBR('NBR 12218','Pressão mínima na rede ≥ 10 m.c.a.',Hgeo>=10,
    `Hgeo = ${Hgeo.toFixed(1)} m — ${Hgeo<10?'⚠ Verificar pressão mínima na extremidade':'✅ Adequado'}`);
  addNBR('NBR 12218','Pressão máxima na rede ≤ 40–50 m.c.a.',Hgeo<=50,
    `Hgeo = ${Hgeo.toFixed(1)} m — ${Hgeo>50?'⚠ Pressão alta — instalar VRP':Hgeo>40?'⚠ Atenção: verificar extremidades baixas':'✅ OK'}`);
  addNBR('NBR 5648','Golpe de aríete ΔH ≤ 50% Hman',delta_H<=Hman*0.5,
    `ΔH = ${delta_H.toFixed(1)} m · P_max = ${P_max.toFixed(1)} mca — ${delta_H>Hman*0.5?'⚠ Instalar válvula antichoque':'✅ OK'}`);

  // Mapa de pressões — verificações adicionais (campos opcionais)
  if(cotaPontoBaixo!==null){
    const P_baixo=cotaRes-cotaPontoBaixo;
    const vrp_necessaria=P_baixo>50;
    addNBR('NBR 12218',`Pressão estática no ponto baixo (cota ${cotaPontoBaixo} m)`,!vrp_necessaria,
      `P_baixo = ${cotaRes}−${cotaPontoBaixo} = ${P_baixo.toFixed(1)} mca — ${vrp_necessaria?'⚠️ > 50 mca — instalar VRP (Válvula Redutora de Pressão)':'✅ OK'}`);
  }
  if(cotaPontoAlto!==null){
    const P_alto=cotaRes-cotaPontoAlto-Hf;
    const pressao_insuf=P_alto<10;
    addNBR('NBR 12218',`Pressão residual no ponto alto (cota ${cotaPontoAlto} m)`,!pressao_insuf,
      `P_alto = ${cotaRes}−${cotaPontoAlto}−${Hf.toFixed(1)} = ${P_alto.toFixed(1)} mca — ${pressao_insuf?'⚠️ < 10 mca — pressão insuficiente no ponto mais alto':'✅ OK'}`);
  }

  const nbrOk=nbrChecks.filter(c=>c.ok).length;
  const nbrFail=nbrChecks.filter(c=>!c.ok).length;
  const vColor=v_real<0.6||v_real>3?'red':v_real<1?'amber':'green';
  const arieteCls=risco_ariete==='crit'?'alert-danger':risco_ariete==='warn'?'alert-warning':'alert-success';
  // Feature 7 — mensagem enriquecida com km, 2L/a e VAO
  const L_km=(L/1000).toFixed(1);
  const tcInfo=T_c>0
    ?(T_c<=T_critico?`T_c = ${T_c}s ≤ 2L/a = ${T_critico.toFixed(1)}s (fechamento rápido)`:`T_c = ${T_c}s > 2L/a = ${T_critico.toFixed(1)}s (Michaud aplicado)`)
    :`2L/a = ${T_critico.toFixed(1)}s`;
  const arieteMsg=risco_ariete==='crit'
    ?`🚨 RISCO ELEVADO: Com ${L_km} km de adutora DN${DN}mm e ${tcInfo}, ΔH = ${delta_H.toFixed(1)} m > 50% Hman. Instalar Válvula Antecipadora de Onda (VAO) ou Volante de Inércia. Adotar PN ${PN_rec} m.c.a.`
    :risco_ariete==='warn'
    ?`⚠️ ATENÇÃO: Com ${L_km} km de adutora e ${tcInfo}, ΔH = ${delta_H.toFixed(1)} m (25–50% Hman). Recomendar válvula antichoque ou VAO. PN ${PN_rec} m.c.a.`
    :`✅ Baixo risco de golpe de aríete: Com ${L_km} km de adutora e ${tcInfo}, ΔH = ${delta_H.toFixed(1)} m < 25% Hman. Classe PN ${PN_rec} adequada.`;

  document.getElementById('ad-nbr-alerts').innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:var(--radius);background:var(--bg);border:1px solid var(--border);margin-bottom:0;">
      <span style="font-size:11px;font-family:var(--mono);color:var(--text3);">Verificação NBR:</span>
      <span style="font-size:12px;font-weight:600;color:var(--green);">✅ ${nbrOk} OK</span>
      <span style="font-size:12px;font-weight:600;color:${nbrFail>0?'var(--red)':'var(--text3)'};">${nbrFail>0?'⚠ '+nbrFail+' não conforme':'✅ todos conformes'}</span>
    </div>`;

  document.getElementById('ad-col-bombas').innerHTML=`
    <div class="hyd-step"><div class="hyd-label">Horas bombeamento / dia</div><div class="hyd-value">${N}</div><div class="hyd-unit">h/dia · desliga ${24-N}h</div></div>
    <div class="hyd-step" style="margin-top:8px;"><div class="hyd-label">Vazão de recalque Qb</div><div class="hyd-value">${Qb.toFixed(2)}</div><div class="hyd-unit">L/s · Q·K1×24/N</div></div>
    <div class="hyd-step amber" style="margin-top:8px;"><div class="hyd-label">Hman total</div><div class="hyd-value">${Hman.toFixed(1)}</div><div class="hyd-unit">m.c.a.</div></div>
    <div class="hyd-step teal" style="margin-top:8px;"><div class="hyd-label">Potência calculada</div><div class="hyd-value">${Pot_cv.toFixed(1)}</div><div class="hyd-unit">cv · ${Pot_kw.toFixed(1)} kW · η=${(eta*100).toFixed(0)}%</div></div>
    <div class="hyd-step green" style="margin-top:8px;"><div class="hyd-label">Motor NBR 17094</div><div class="hyd-value">${useFatorServico?Pot_motor_cv_fs:Pot_motor_cv}</div><div class="hyd-unit">cv · ${useFatorServico?Pot_motor_kw_fs:Pot_motor_kw} kW${useFatorServico?` · fs=×${fatorServico.toFixed(2)}`:''}</div></div>
    ${useFatorServico?`<div class="hyd-step amber" style="margin-top:8px;"><div class="hyd-label">Margem calculada (sem fs)</div><div class="hyd-value">${Pot_motor_cv}</div><div class="hyd-unit">cv · ${Pot_motor_kw} kW</div></div>`:''}
    <div class="hyd-formula" style="margin-top:10px;font-size:10px;">Pot = γ·Qb·Hman/(75·η) = 1000×${(Qb/1000).toFixed(4)}×${Hman.toFixed(1)}/(75×${eta.toFixed(2)}) = <strong>${Pot_cv.toFixed(2)} cv</strong><br>Hman = ${Hgeo.toFixed(1)} + ${Hf.toFixed(2)} + ${Hloc.toFixed(2)} = ${Hman.toFixed(2)} m.c.a.${useFatorServico?`<br>Fator de serviço: ×${fatorServico.toFixed(2)} → ${(Pot_kw*fatorServico).toFixed(1)} kW → <strong>Motor ${Pot_motor_kw_fs} kW</strong>`:''}</div>`;

  document.getElementById('ad-col-adutora').innerHTML=`
    <div class="hyd-step ${vColor}"><div class="hyd-label">DN adutora (Bresse)</div><div class="hyd-value">${DN}</div><div class="hyd-unit">mm · D_calc=${D_mm_calc.toFixed(0)} mm</div></div>
    <div class="hyd-step ${vColor}" style="margin-top:8px;"><div class="hyd-label">Velocidade real</div><div class="hyd-value">${v_real.toFixed(2)}</div><div class="hyd-unit">m/s · K=${K_bresse.toFixed(3)}</div></div>
    <div class="hyd-step amber" style="margin-top:8px;"><div class="hyd-label">Perda de carga Hf (atual)</div><div class="hyd-value">${Hf.toFixed(2)}</div><div class="hyd-unit">m · J=${(J*1000).toFixed(3)} m/km</div></div>
    ${Hf_futuro!==null?`<div class="hyd-step red" style="margin-top:8px;"><div class="hyd-label">Hf futuro (C=${C_futuro_input} envelhecido)</div><div class="hyd-value">${Hf_futuro.toFixed(2)}</div><div class="hyd-unit">m ·  +${((Hf_futuro-Hf)/Hf*100).toFixed(1)}% vs. atual</div></div>`:''}
    <div class="hyd-step" style="margin-top:8px;"><div class="hyd-label">Perdas localizadas (10%)</div><div class="hyd-value">${Hloc.toFixed(2)}</div><div class="hyd-unit">m</div></div>
    <div class="hyd-step" style="margin-top:8px;"><div class="hyd-label">Método · C / L</div><div class="hyd-value">${metodoDW?'D-W':C}</div><div class="hyd-unit">${metodoDW?'Darcy-Weisbach':'C H-W'} · ${(L/1000).toFixed(2)} km</div></div>
    ${co2_total>0?`<div class="hyd-step" style="margin-top:8px;background:var(--green-bg);"><div class="hyd-label">🌱 Pegada de carbono (20a)</div><div class="hyd-value">${co2_total.toFixed(0)}</div><div class="hyd-unit">ton CO₂e · tubo:${co2_pipe.toFixed(0)}t + op.:${(co2_energy*20).toFixed(0)}t</div></div>`:''}
    <div class="hyd-formula" style="margin-top:10px;font-size:10px;">D = K√(Qb) = ${K_bresse.toFixed(3)}×√${(Qb/1000).toFixed(4)} = ${D_mm_calc.toFixed(0)} mm → <strong>DN ${DN} mm</strong><br>${metodoDW?`J = f·v²/(2g·D) [D-W+S-J] = ${(J*1000).toFixed(4)} m/m`:`J = 10,643×Q^1,852/(C^1,852×D^4,87) = ${(J*1000).toFixed(4)} m/m`}</div>`;

  document.getElementById('ad-col-reservatorio').innerHTML=`
    <div class="hyd-step"><div class="hyd-label">V₁ — Equilíbrio (Rippl)</div><div class="hyd-value">${V1.toFixed(0)}</div><div class="hyd-unit">m³</div></div>
    <div class="hyd-step amber" style="margin-top:8px;"><div class="hyd-label">V₂ — Emergência (2h)</div><div class="hyd-value">${V2.toFixed(0)}</div><div class="hyd-unit">m³</div></div>
    <div class="hyd-step red" style="margin-top:8px;"><div class="hyd-label">V₃ — Incêndio (NBR 13714)</div><div class="hyd-value">${V3.toFixed(0)}</div><div class="hyd-unit">m³</div></div>
    <div class="hyd-step green" style="margin-top:10px;"><div class="hyd-label">V_total adotado</div><div class="hyd-value" style="font-size:26px;">${V_total.toLocaleString('pt-BR')}</div><div class="hyd-unit">m³ = V₁+V₂+V₃</div></div>
    <div class="hyd-formula" style="margin-top:10px;font-size:10px;">Rippl: V₁ = ${V1.toFixed(0)} m³ · Hora crit.: ${String(h_crit).padStart(2,'0')}:00<br>Mín. NBR 12217: ${(Qmed*p.K1*86400/3000).toFixed(0)} m³ (1/3 Dmax)</div>`;

  document.getElementById('ad-ariete-display').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px;">
      <div class="hyd-step"><div class="hyd-label">Celeridade onda a</div><div class="hyd-value">${a_celer.toFixed(0)}</div><div class="hyd-unit">m/s</div></div>
      <div class="hyd-step ${risco_ariete==='crit'?'red':risco_ariete==='warn'?'amber':'green'}"><div class="hyd-label">Sobrepressão ΔH</div><div class="hyd-value">${delta_H.toFixed(1)}</div><div class="hyd-unit">m</div></div>
      <div class="hyd-step ${risco_ariete==='crit'?'red':risco_ariete==='warn'?'amber':'green'}"><div class="hyd-label">Pressão máxima</div><div class="hyd-value">${P_max.toFixed(1)}</div><div class="hyd-unit">m.c.a.</div></div>
      <div class="hyd-step green"><div class="hyd-label">Classe de pressão</div><div class="hyd-value">PN ${PN_rec}</div><div class="hyd-unit">m.c.a. (fs=1,2)</div></div>
    </div>
    <div class="alert ${arieteCls}" style="font-family:var(--mono);font-size:12px;">${arieteMsg}</div>
    <div class="hyd-formula" style="margin-top:8px;font-size:10px;">Fórmula: <strong>${formulaAriete}</strong><br>a = √(K_água/(ρ·(1+D·K_água/(e·E_tubo)))) = ${a_celer.toFixed(0)} m/s · 2L/a = ${T_critico.toFixed(1)} s<br><span style="color:var(--text3);">E_tubo = ${E_tubo.toLocaleString('pt-BR')} MPa (${eTuboSource})</span></div>`;

  const ripplRows=horas_idx.map(h=>{
    const ligada=!horas_desligadas.has(h);
    const isCrit=h===h_crit;
    const deficit=saldo_cum[h]<-10;
    return `<tr class="${isCrit?'rippl-max':deficit?'rippl-deficit':''}">
      <td>${String(h).padStart(2,'0')}:00</td><td>${ligada?'🟢':'🔴'}</td>
      <td>${(aducao_h[h]/1000).toFixed(2)}</td><td>${(consumo_h[h]/1000).toFixed(2)}</td>
      <td style="color:${aducao_h[h]-consumo_h[h]>=0?'var(--green)':'var(--red)'};">${((aducao_h[h]-consumo_h[h])/1000).toFixed(2)}</td>
      <td style="font-weight:${isCrit?700:400};color:${isCrit?'var(--red)':'inherit'}">${(saldo_cum[h]/1000).toFixed(2)}</td>
    </tr>`;
  }).join('');

  document.getElementById('ad-rippl-display').innerHTML=`
    <div class="hyd-formula" style="margin-bottom:10px;font-size:10px;">
      V₁ = saldo_max − saldo_min = ${(saldo_max/1000).toFixed(2)} − ${(saldo_min/1000).toFixed(2)} = <strong>${V1.toFixed(1)} m³</strong> · Hora crítica: ${String(h_crit).padStart(2,'0')}:00h
    </div>
    <div class="tbl-wrap" style="max-height:240px;">
      <table class="rippl-table">
        <thead><tr><th>Hora</th><th>Bomba</th><th>Entr. (m³)</th><th>Cons. (m³)</th><th>Δ (m³)</th><th>Saldo (m³)</th></tr></thead>
        <tbody>${ripplRows}</tbody>
      </table>
    </div>`;

  if(state.charts.rippl)state.charts.rippl.destroy();
  state.charts.rippl=new Chart(document.getElementById('chart-rippl'),{
    type:'line',
    data:{labels:horas_idx.map(h=>String(h).padStart(2,'0')+':00'),datasets:[
      {label:'Entrada acumulada (m³)',data:entrada_cum.map(v=>+(v/1000).toFixed(2)),borderColor:'#4f7ef5',borderWidth:2.5,pointRadius:2,fill:false,tension:0},
      {label:'Saída acumulada (m³)',data:saida_cum.map(v=>+(v/1000).toFixed(2)),borderColor:'#E24B4A',borderWidth:2.5,pointRadius:2,fill:false,tension:0},
      {label:'Saldo (m³)',data:saldo_cum.map(v=>+(v/1000).toFixed(2)),borderColor:'#1D9E75',borderWidth:1.5,borderDash:[4,2],pointRadius:0,fill:false,tension:0,yAxisID:'y2'},
      {label:'V₁ Rippl',data:horas_idx.map(()=>+V1.toFixed(1)),borderColor:'#e09000',borderWidth:1,borderDash:[6,3],pointRadius:0,yAxisID:'y'},
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{font:{size:11},boxWidth:20}}},
      scales:{
        y:{title:{display:true,text:'m³ acumulado',font:{size:11}}},
        y2:{type:'linear',position:'right',title:{display:true,text:'Saldo m³',font:{size:11}},grid:{drawOnChartArea:false}}
      }}
  });

  document.getElementById('ad-nbr-detail').innerHTML=`
    <table class="tbl"><thead><tr><th>Norma</th><th>Item verificado</th><th>Resultado</th></tr></thead>
    <tbody>${nbrChecks.map(c=>`
      <tr>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text3);white-space:nowrap;">${c.norma}</td>
        <td style="font-size:12px;">${c.item}</td>
        <td style="font-family:var(--mono);font-size:11px;color:${c.ok?'var(--green)':'var(--amber)'};">${c.msg}</td>
      </tr>`).join('')}
    </tbody></table>`;

  document.getElementById('ad-memorial').innerHTML=`
    <table class="tbl"><tbody>
      <tr><td style="color:var(--text3);width:230px;">Município / Horizonte</td><td>${state.municipioNome} · ${ano} · ${pop.toLocaleString('pt-BR')} hab</td></tr>
      <tr><td style="color:var(--text3);">Consumo per capita</td><td>q=${p.agua} L/hab/dia · K₁=${p.K1} · Qmed=${Qmed.toFixed(3)} L/s · Q·K1=${QK1.toFixed(3)} L/s</td></tr>
      <tr><td style="color:var(--text3);">Regime bombeamento</td><td>N=${N} h/dia → <strong>Qb = ${Qb.toFixed(3)} L/s</strong> (Q·K1×24/N)</td></tr>
      <tr><td style="color:var(--text3);">Adutora — Bresse</td><td>K=${K_bresse.toFixed(3)} · D=${D_mm_calc.toFixed(0)} mm → <strong>DN ${DN} mm</strong> · v=${v_real.toFixed(2)} m/s</td></tr>
      <tr><td style="color:var(--text3);">${metodoLabel}</td><td>J=${(J*1000).toFixed(4)} m/m · L=${L} m · Hf=${Hf.toFixed(2)} m · Hloc=${Hloc.toFixed(2)} m${Hf_futuro!==null?` · Hf_futuro(C=${C_futuro_input})=${Hf_futuro.toFixed(2)} m`:''}</td></tr>
      <tr><td style="color:var(--text3);">Topografia</td><td>Z_cap=${cotaCap} m · Z_res=${cotaRes} m · Hgeo=${Hgeo.toFixed(1)} m</td></tr>
      <tr><td style="color:var(--text3);">Altura manométrica total</td><td><strong>Hman = ${Hman.toFixed(2)} m.c.a.</strong> = ${Hgeo.toFixed(1)}+${Hf.toFixed(2)}+${Hloc.toFixed(2)}</td></tr>
      <tr><td style="color:var(--text3);">Potência da bomba</td><td>${Pot_cv.toFixed(1)} cv → Motor: <strong>${useFatorServico?Pot_motor_cv_fs:Pot_motor_cv} cv (${useFatorServico?Pot_motor_kw_fs:Pot_motor_kw} kW)</strong>${useFatorServico?` · fs=×${fatorServico.toFixed(2)} (catálogo)`:' — NBR 17094'}</td></tr>
      <tr><td style="color:var(--text3);">NPSH verificação</td><td>NPSH_d=${NPSH_d.toFixed(2)} m | NPSHr=${npshReq} m | ${npshOk?'✅ Sem risco de cavitação':'🚨 RISCO DE CAVITAÇÃO — revisar instalação da bomba'}</td></tr>
      <tr><td style="color:var(--text3);">Reservatório (Rippl+NBR)</td><td>V₁=${V1.toFixed(0)} + V₂=${V2.toFixed(0)} + V₃=${V3.toFixed(0)} → <strong>V = ${V_total} m³</strong></td></tr>
      <tr><td style="color:var(--text3);">Golpe de aríete</td><td>${formulaAriete} · a=${a_celer.toFixed(0)} m/s · ΔH=${delta_H.toFixed(1)} m · P_max=${P_max.toFixed(1)} mca → <strong>PN ${PN_rec}</strong> · 2L/a=${T_critico.toFixed(1)}s · E_tubo=${E_tubo.toLocaleString('pt-BR')} MPa (${eTuboSource})</td></tr>
      ${co2_total>0?`<tr><td style="color:var(--text3);">🌱 Pegada de carbono (20a)</td><td>${co2Label} · Tubulação: ${co2_pipe.toFixed(0)} ton CO₂e · Operação: ${(co2_energy*20).toFixed(0)} ton CO₂e · <strong>Total: ${co2_total.toFixed(0)} ton CO₂e</strong></td></tr>`:''}
      <tr><td style="color:var(--text3);">Verificação NBR</td><td>${nbrOk} conforme · ${nbrFail} não conforme — NBR 12211/12217/12218/5648/17094</td></tr>
    </tbody></table>`;

  addAudit(`Hidráulica: DN${DN}mm · Hman=${Hman.toFixed(1)}m · ${useFatorServico?Pot_motor_cv_fs:Pot_motor_cv}cv · V=${V_total}m³ · PN${PN_rec}`);

  // Salvar resultado para o slider de racionamento e painel público
  state._aducaoResult={V_total,Qmed,QK1,Qb,N,L,DN,Hman,Hf,cotaRes};

  // Mapa de pressões pré-EPANET — renderiza se campos informados
  const pressaoEl=document.getElementById('ad-pressao-display');
  const pressaoCard=document.getElementById('ad-pressao-card');
  if(pressaoEl&&(cotaPontoBaixo!==null||cotaPontoAlto!==null)){
    if(pressaoCard)pressaoCard.style.display='';
    const P_baixo=cotaPontoBaixo!==null?cotaRes-cotaPontoBaixo:null;
    const P_alto=cotaPontoAlto!==null?cotaRes-cotaPontoAlto-Hf:null;
    const clsBaixo=P_baixo===null?'':P_baixo>50?'red':P_baixo>40?'amber':'green';
    const clsAlto=P_alto===null?'':P_alto<10?'red':P_alto<15?'amber':'green';
    pressaoEl.innerHTML=`
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:10px;">
        ${cotaRes!==null?`<div class="hyd-step"><div class="hyd-label">Nível reservatório</div><div class="hyd-value">${cotaRes}</div><div class="hyd-unit">m (cota piezométrica)</div></div>`:''}
        ${P_baixo!==null?`<div class="hyd-step ${clsBaixo}"><div class="hyd-label">P estática — ponto baixo</div><div class="hyd-value">${P_baixo.toFixed(1)}</div><div class="hyd-unit">mca · cota=${cotaPontoBaixo}m</div></div>`:''}
        ${P_alto!==null?`<div class="hyd-step ${clsAlto}"><div class="hyd-label">P residual — ponto alto</div><div class="hyd-value">${P_alto.toFixed(1)}</div><div class="hyd-unit">mca · cota=${cotaPontoAlto}m (−Hf)</div></div>`:''}
      </div>
      ${P_baixo!==null&&P_baixo>50?`<div class="alert alert-warning" style="font-size:12px;font-family:var(--mono);">⚠️ Pressão estática no ponto mais baixo (${P_baixo.toFixed(1)} mca) ultrapassa 50 mca. Risco de ruptura — instalar <strong>VRP (Válvula Redutora de Pressão)</strong> antes da zona de baixa cota. NBR 12218.</div>`:''}
      ${P_alto!==null&&P_alto<10?`<div class="alert alert-danger" style="font-size:12px;font-family:var(--mono);">🚨 Pressão residual no ponto mais alto (${P_alto.toFixed(1)} mca) abaixo de 10 mca. Pressão insuficiente — revisar topografia, aumentar DN ou elevar reservatório. NBR 12218.</div>`:''}
      <div class="hyd-formula" style="margin-top:6px;font-size:10px;">P_baixo = Z_res − Z_baixo = ${cotaRes}−${cotaPontoBaixo??'—'} = ${P_baixo!==null?P_baixo.toFixed(1):'—'} mca (estática) · P_alto = Z_res − Z_alto − Hf = ${cotaRes}−${cotaPontoAlto??'—'}−${Hf.toFixed(1)} = ${P_alto!==null?P_alto.toFixed(1):'—'} mca (dinâmica)</div>`;
  }else if(pressaoCard){
    pressaoCard.style.display='none';
  }

  // LCC (async — não bloqueia a renderização principal)
  renderLCC({DN,Qb,Hman,Hf,L,C,eta,N_h_dia:N,Pot_kw,series_dn}).catch(()=>{});
}

function setAdAno(idx,btn){
  state.adAnoIdx=idx;
  document.querySelectorAll('#ad-infra-anos .btn').forEach(b=>b.classList.remove('btn-primary'));
  btn.classList.add('btn-primary');
  calcAducao();
}

// ── Análise de Ciclo de Vida (LCC) ──────────────────────────────────────────
// LCC = CAPEX_tubo + CAPEX_bomba + Σ(OPEX_energia × (1+r)^-t) para t=1..N
// Compara 2 cenários: DN atual vs DN+1 (diâmetro maior, menor Hf)
let _tarifasAneel = null;

async function loadTarifasAneel(){
  if(_tarifasAneel)return _tarifasAneel;
  try{
    const r=await fetch('data/tarifas-aneel.json');
    if(!r.ok)throw new Error('HTTP '+r.status);
    _tarifasAneel=await r.json();
    return _tarifasAneel;
  }catch(_){ return null; }
}

async function renderLCC(params){
  const {DN, Qb, Hman, Hf, L, C, eta, N_h_dia, Pot_kw, series_dn} = params;
  const lccEl=document.getElementById('ad-lcc-display');
  if(!lccEl)return;

  const r_taxa=0.08; // taxa de desconto anual (8%)
  const horizonte_lcc=20; // anos
  const fator_dn_preco=2.0; // custo relativo por mm·m de tubulação (R$/mm/m)

  // Tarifa de energia — do JSON estático ANEEL ou padrão
  let tarifa_kwh=0.68;
  const uf=state.municipioUF||'BR';
  const tarifas=await loadTarifasAneel();
  if(tarifas&&tarifas.tarifas){
    const entry=tarifas.tarifas.find(t=>t.estado===uf)||tarifas.tarifas.find(t=>t.estado==='BR');
    if(entry)tarifa_kwh=entry.tarifa_kwh;
  }

  // CAPEX tubulação: proporcional a DN² (simplificado)
  const capex_tubo_dn=(dn)=>dn*dn*L*fator_dn_preco/1e6; // milhões R$

  // OPEX energia: kWh/ano × tarifa
  const opex_energia_dn=(hf_atual,dn_atual)=>{
    const D_r=dn_atual/1000;
    const J_r=10.643*Math.pow(Qb/1000,1.852)/(Math.pow(C,1.852)*Math.pow(D_r,4.87));
    const Hf_r=J_r*L;
    const Hloc_r=Hf_r*0.10;
    const Hgeo_r=Hman-Hf*(1+0.10); // Hgeo fixo
    const Hman_r=Hgeo_r+Hf_r+Hloc_r;
    const pot_kw_r=(1000*(Qb/1000)*Hman_r)/(75*eta)*0.7355;
    return pot_kw_r*N_h_dia*365*tarifa_kwh; // R$/ano
  };

  // VPL da OPEX por horizonte
  const vpn=(opex_ano)=>{
    let sum=0;
    for(let t=1;t<=horizonte_lcc;t++) sum+=opex_ano/Math.pow(1+r_taxa,t);
    return sum;
  };

  // Cenário A: DN atual
  const opex_a=opex_energia_dn(Hf,DN);
  const capex_a=capex_tubo_dn(DN);
  const lcc_a=capex_a+vpn(opex_a)/1e6;

  // Cenário B: DN+1 (diâmetro imediatamente acima na série)
  const dn_b=series_dn.find(d=>d>DN)||DN;
  const opex_b=opex_energia_dn(null,dn_b);
  const capex_b=capex_tubo_dn(dn_b);
  const lcc_b=capex_b+vpn(opex_b)/1e6;

  const melhor=lcc_a<=lcc_b?'A':'B';

  lccEl.innerHTML=`
    <div style="font-size:10px;font-family:var(--mono);color:var(--text3);margin-bottom:8px;">
      LCC = CAPEX_tubo + VPL(OPEX_energia) · r=${(r_taxa*100).toFixed(0)}%a.a. · ${horizonte_lcc} anos · Tarifa: R$ ${tarifa_kwh.toFixed(4)}/kWh (${uf}) · Fonte: ANEEL 2024
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div class="hyd-step ${melhor==='A'?'green':''}">
        <div class="hyd-label">Cenário A — DN ${DN} mm ${melhor==='A'?'⭐ Recomendado':''}</div>
        <div class="hyd-value">${lcc_a.toFixed(2)}</div>
        <div class="hyd-unit">M R$ · CAPEX: ${capex_a.toFixed(2)} M · OPEX_VPL: ${(vpn(opex_a)/1e6).toFixed(2)} M</div>
      </div>
      <div class="hyd-step ${melhor==='B'?'green':''}">
        <div class="hyd-label">Cenário B — DN ${dn_b} mm ${melhor==='B'?'⭐ Recomendado':''}</div>
        <div class="hyd-value">${lcc_b.toFixed(2)}</div>
        <div class="hyd-unit">M R$ · CAPEX: ${capex_b.toFixed(2)} M · OPEX_VPL: ${(vpn(opex_b)/1e6).toFixed(2)} M</div>
      </div>
    </div>
    <div class="hyd-formula" style="margin-top:8px;font-size:10px;">
      OPEX_A = ${(opex_a/1000).toFixed(1)} k R$/ano · OPEX_B = ${(opex_b/1000).toFixed(1)} k R$/ano · Diferença LCC = ${Math.abs(lcc_a-lcc_b).toFixed(2)} M R$
      ${melhor==='A'?`<br>✅ DN ${DN} mm tem menor custo de ciclo de vida — maior velocidade compensa menor CAPEX.`:
                    `<br>✅ DN ${dn_b} mm tem menor custo de ciclo de vida — menor OPEX de energia justifica maior CAPEX de tubulação.`}
    </div>`;
}

