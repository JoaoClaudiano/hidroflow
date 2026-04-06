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

function presetCagece(){
  document.getElementById('ad-horas').value='18';
  document.getElementById('ad-eta').value='72';
  document.getElementById('ad-chw').value='140';
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
  const adAnoIdx=state.adAnoIdx||0;
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

  const Qb=QK1*(24/N);

  const kBresseInput=document.getElementById('ad-k-bresse').value;
  const K_bresse=kBresseInput==='auto'?1.3*Math.pow(N/24,0.25):+kBresseInput;
  const D_bresse=K_bresse*Math.sqrt(Qb/1000);
  const series_dn=[50,75,100,125,150,200,250,300,350,400,450,500,600,700,800,900,1000];
  const D_mm_calc=D_bresse*1000;
  const DN=series_dn.find(d=>d>=D_mm_calc)||series_dn[series_dn.length-1];
  const D_real=DN/1000;
  const v_real=(Qb/1000)/(Math.PI*(D_real/2)**2);

  const J=10.643*Math.pow(Qb/1000,1.852)/(Math.pow(C,1.852)*Math.pow(D_real,4.87));
  const Hf=J*L;
  const Hloc=Hf*0.10;

  const Hgeo=cotaRes-cotaCap;
  const Hman=Hgeo+Hf+Hloc;

  const Pot_cv=(1000*(Qb/1000)*Hman)/(75*eta);
  const Pot_kw=Pot_cv*0.7355;
  const potMotor=[5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110,132,160,200,250,315];
  const Pot_motor_kw=potMotor.find(pw=>pw>=Pot_kw)||potMotor[potMotor.length-1];
  const Pot_motor_cv=Math.round(Pot_motor_kw/0.7355);

  // Golpe de Aríete — Joukowsky
  let E_tubo=2800;
  const C_val=+document.getElementById('ad-chw').value||140;
  if(C_val>=130&&C_val<140)E_tubo=170000;
  else if(C_val>=120&&C_val<130)E_tubo=170000;
  else if(C_val<120)E_tubo=30000;
  const eTuboInput=document.getElementById('ad-e-tubo');
  const eTuboUser=eTuboInput&&eTuboInput.value.trim()?+eTuboInput.value:0;
  const eTuboSource=eTuboUser>0?'fabricante':'estimado pelo C H-W';
  if(eTuboUser>0)E_tubo=eTuboUser;
  const E_agua=2100;
  const rho=1000;
  const e_m=e_mm/1000;
  const a_celer=Math.sqrt((E_agua*1e6/rho)/(1+(D_real*E_agua)/(e_m*E_tubo)));
  const g=9.81;
  const delta_H=(a_celer*v_real)/g;
  const P_max=Hman+delta_H;
  const pn_series=[60,80,100,125,160,200,250,315];
  const PN_rec=pn_series.find(pn=>pn>=P_max*1.2)||pn_series[pn_series.length-1];
  const risco_ariete=delta_H>Hman*0.5?'crit':delta_H>Hman*0.25?'warn':'ok';

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

  const nbrOk=nbrChecks.filter(c=>c.ok).length;
  const nbrFail=nbrChecks.filter(c=>!c.ok).length;
  const vColor=v_real<0.6||v_real>3?'red':v_real<1?'amber':'green';
  const arieteCls=risco_ariete==='crit'?'alert-danger':risco_ariete==='warn'?'alert-warning':'alert-success';
  const arieteMsg=risco_ariete==='crit'?
    `🚨 RISCO ELEVADO: ΔH = ${delta_H.toFixed(1)} m > 50% Hman. Instalar válvula de alívio/volante de inércia. Adotar PN ${PN_rec} m.c.a.`:
    risco_ariete==='warn'?
    `⚠️ ATENÇÃO: ΔH = ${delta_H.toFixed(1)} m (25–50% Hman). Recomendar válvula antichoque. PN ${PN_rec} m.c.a.`:
    `✅ Baixo risco de golpe de aríete (ΔH = ${delta_H.toFixed(1)} m < 25% Hman). Classe PN ${PN_rec} adequada.`;

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
    <div class="hyd-step green" style="margin-top:8px;"><div class="hyd-label">Motor NBR 17094</div><div class="hyd-value">${Pot_motor_cv}</div><div class="hyd-unit">cv · ${Pot_motor_kw} kW</div></div>
    <div class="hyd-formula" style="margin-top:10px;font-size:10px;">Pot = γ·Qb·Hman/(75·η) = 1000×${(Qb/1000).toFixed(4)}×${Hman.toFixed(1)}/(75×${eta.toFixed(2)}) = <strong>${Pot_cv.toFixed(2)} cv</strong><br>Hman = ${Hgeo.toFixed(1)} + ${Hf.toFixed(2)} + ${Hloc.toFixed(2)} = ${Hman.toFixed(2)} m.c.a.</div>`;

  document.getElementById('ad-col-adutora').innerHTML=`
    <div class="hyd-step ${vColor}"><div class="hyd-label">DN adutora (Bresse)</div><div class="hyd-value">${DN}</div><div class="hyd-unit">mm · D_calc=${D_mm_calc.toFixed(0)} mm</div></div>
    <div class="hyd-step ${vColor}" style="margin-top:8px;"><div class="hyd-label">Velocidade real</div><div class="hyd-value">${v_real.toFixed(2)}</div><div class="hyd-unit">m/s · K=${K_bresse.toFixed(3)}</div></div>
    <div class="hyd-step amber" style="margin-top:8px;"><div class="hyd-label">Perda de carga Hf</div><div class="hyd-value">${Hf.toFixed(2)}</div><div class="hyd-unit">m · J=${(J*1000).toFixed(3)} m/km</div></div>
    <div class="hyd-step" style="margin-top:8px;"><div class="hyd-label">Perdas localizadas (10%)</div><div class="hyd-value">${Hloc.toFixed(2)}</div><div class="hyd-unit">m</div></div>
    <div class="hyd-step" style="margin-top:8px;"><div class="hyd-label">Material / C HW / L</div><div class="hyd-value">${C}</div><div class="hyd-unit">C · ${(L/1000).toFixed(2)} km</div></div>
    <div class="hyd-formula" style="margin-top:10px;font-size:10px;">D = K√(Qb) = ${K_bresse.toFixed(3)}×√${(Qb/1000).toFixed(4)} = ${D_mm_calc.toFixed(0)} mm → <strong>DN ${DN} mm</strong><br>J = 10,643×Q^1,852/(C^1,852×D^4,87) = ${(J*1000).toFixed(4)} m/m</div>`;

  document.getElementById('ad-col-reservatorio').innerHTML=`
    <div class="hyd-step"><div class="hyd-label">V₁ — Equilíbrio (Rippl)</div><div class="hyd-value">${V1.toFixed(0)}</div><div class="hyd-unit">m³</div></div>
    <div class="hyd-step amber" style="margin-top:8px;"><div class="hyd-label">V₂ — Emergência (2h)</div><div class="hyd-value">${V2.toFixed(0)}</div><div class="hyd-unit">m³</div></div>
    <div class="hyd-step red" style="margin-top:8px;"><div class="hyd-label">V₃ — Incêndio (NBR 13714)</div><div class="hyd-value">${V3.toFixed(0)}</div><div class="hyd-unit">m³</div></div>
    <div class="hyd-step green" style="margin-top:10px;"><div class="hyd-label">V_total adotado</div><div class="hyd-value" style="font-size:26px;">${V_total.toLocaleString('pt-BR')}</div><div class="hyd-unit">m³ = V₁+V₂+V₃</div></div>
    <div class="hyd-formula" style="margin-top:10px;font-size:10px;">Rippl: V₁ = ${V1.toFixed(0)} m³ · Hora crit.: ${String(h_crit).padStart(2,'0')}:00<br>Mín. NBR 12217: ${(Qmed*p.K1*86400/3000).toFixed(0)} m³ (1/3 Dmax)</div>`;

  document.getElementById('ad-ariete-display').innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px;">
      <div class="hyd-step"><div class="hyd-label">Celeridade onda a</div><div class="hyd-value">${a_celer.toFixed(0)}</div><div class="hyd-unit">m/s</div></div>
      <div class="hyd-step ${risco_ariete==='crit'?'red':risco_ariete==='warn'?'amber':'green'}"><div class="hyd-label">Sobrepressão ΔH</div><div class="hyd-value">${delta_H.toFixed(1)}</div><div class="hyd-unit">m · a·v/g</div></div>
      <div class="hyd-step ${risco_ariete==='crit'?'red':risco_ariete==='warn'?'amber':'green'}"><div class="hyd-label">Pressão máxima</div><div class="hyd-value">${P_max.toFixed(1)}</div><div class="hyd-unit">m.c.a.</div></div>
      <div class="hyd-step green"><div class="hyd-label">Classe de pressão</div><div class="hyd-value">PN ${PN_rec}</div><div class="hyd-unit">m.c.a. (fs=1,2)</div></div>
    </div>
    <div class="alert ${arieteCls}" style="font-family:var(--mono);font-size:12px;">${arieteMsg}</div>
    <div class="hyd-formula" style="margin-top:8px;font-size:10px;">a = √(K_água/(ρ·(1+D·K_água/(e·E_tubo)))) = ${a_celer.toFixed(0)} m/s · ΔH = a·v/g = ${a_celer.toFixed(0)}×${v_real.toFixed(2)}/9,81 = <strong>${delta_H.toFixed(1)} m</strong><br><span style="color:var(--text3);">E_tubo = ${E_tubo.toLocaleString('pt-BR')} MPa (${eTuboSource})</span></div>`;

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
      <tr><td style="color:var(--text3);">Hazen-Williams (C=${C})</td><td>J=${(J*1000).toFixed(4)} m/m · L=${L} m · Hf=${Hf.toFixed(2)} m · Hloc=${Hloc.toFixed(2)} m</td></tr>
      <tr><td style="color:var(--text3);">Topografia</td><td>Z_cap=${cotaCap} m · Z_res=${cotaRes} m · Hgeo=${Hgeo.toFixed(1)} m</td></tr>
      <tr><td style="color:var(--text3);">Altura manométrica total</td><td><strong>Hman = ${Hman.toFixed(2)} m.c.a.</strong> = ${Hgeo.toFixed(1)}+${Hf.toFixed(2)}+${Hloc.toFixed(2)}</td></tr>
      <tr><td style="color:var(--text3);">Potência da bomba</td><td>${Pot_cv.toFixed(1)} cv → Motor: <strong>${Pot_motor_cv} cv (${Pot_motor_kw} kW)</strong> — NBR 17094</td></tr>
      <tr><td style="color:var(--text3);">Reservatório (Rippl+NBR)</td><td>V₁=${V1.toFixed(0)} + V₂=${V2.toFixed(0)} + V₃=${V3.toFixed(0)} → <strong>V = ${V_total} m³</strong></td></tr>
      <tr><td style="color:var(--text3);">Golpe de aríete</td><td>a=${a_celer.toFixed(0)} m/s · ΔH=${delta_H.toFixed(1)} m · P_max=${P_max.toFixed(1)} mca → <strong>PN ${PN_rec}</strong> · E_tubo=${E_tubo.toLocaleString('pt-BR')} MPa (${eTuboSource})</td></tr>
      <tr><td style="color:var(--text3);">Verificação NBR</td><td>${nbrOk} conforme · ${nbrFail} não conforme — NBR 12211/12217/12218/5648/17094</td></tr>
    </tbody></table>`;

  addAudit(`Hidráulica: DN${DN}mm · Hman=${Hman.toFixed(1)}m · ${Pot_motor_cv}cv · V=${V_total}m³ · PN${PN_rec}`);
}

function setAdAno(idx,btn){
  state.adAnoIdx=idx;
  document.querySelectorAll('#ad-infra-anos .btn').forEach(b=>b.classList.remove('btn-primary'));
  btn.classList.add('btn-primary');
  calcAducao();
}
