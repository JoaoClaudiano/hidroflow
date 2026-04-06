// ══════════════════════════════════════════
// DIMENSIONAMENTO + PARÂMETROS CUSTOM
// ══════════════════════════════════════════

// ── Manning — velocidade em conduto parcialmente cheio ─────────────────────
// v = (1/n) × Rh^(2/3) × S^(1/2)   [m/s]
// Rh = raio hidráulico (m), S = declividade (m/m), n = coef. Manning
// Retorna { v_m_s, v_min_ok, D_m, area_m2, Rh_m }
function calcManning(n_mann, D_m, S, laminaFrac){
  // laminaFrac = fração de lâmina d'água (0,5–0,75 típico para SES)
  const frac=Math.min(Math.max(laminaFrac||0.65,0.1),0.9);
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
function harmonPeakFactor(pop){
  const P=pop/1000;
  return(14+Math.sqrt(P))/(4+Math.sqrt(P));
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
  const vol_res_m3=Qmed*p.K1*3600*12/1000;
  const K_harmon=harmonPeakFactor(pop);
  // Vazão de ponta de esgoto: K1 padrão ou Harmon (dependente da população)
  const QesgPonta=p.useHarmon?(Qmed*p.ret*K_harmon):(Qmed*p.ret*p.K1);
  return{
    Qmed, QK1:Qmed*p.K1, QK2:Qmed*p.K1*p.K2, QK3:Qmed*p.K3,
    Qesg:Qmed*p.ret, QesgK1:QesgPonta,
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
      <div class="infra-card teal">${ic(SVG_FLOW,'teal')}<div class="infra-title">Qesg hora de ponta</div><div class="infra-value">${v.QesgK1.toFixed(2)}</div><div class="infra-unit">L/s</div><div class="infra-ponta">${v.useHarmon?`Harmon K=${v.K_harmon.toFixed(2)}`:`K1 = ${p.K1.toFixed(2)}`}</div></div>
      <div class="infra-card">${ic(SVG_FLOW)}<div class="infra-title">Q mínima noturna</div><div class="infra-value">${v.QK3.toFixed(2)}</div><div class="infra-unit">L/s</div><div class="infra-ponta">K3 = ${p.K3.toFixed(2)}</div></div>
    </div>
    <div class="infra-section-title">Resíduos e energia</div>
    <div class="infra-grid-4">
      <div class="infra-card amber">${ic(SVG_WASTE,'amber')}<div class="infra-title">Resíduos sólidos</div><div class="infra-value">${v.res_td.toFixed(1)}</div><div class="infra-unit">ton/dia</div><div class="infra-unit" style="margin-top:3px;">${(v.res_td*365).toFixed(0)} ton/ano</div></div>
      <div class="infra-card amber">${ic(SVG_ENERGY,'amber')}<div class="infra-title">Energia elétrica</div><div class="infra-value">${v.en_mwh.toFixed(0)}</div><div class="infra-unit">MWh/mês</div><div class="infra-unit" style="margin-top:3px;">${(v.en_mwh*12).toLocaleString('pt-BR')} MWh/ano</div></div>
      ${p.extra1Nome&&p.extra1Val>0?`<div class="infra-card green">${ic(SVG_FLOW,'green')}<div class="infra-title">${p.extra1Nome}</div><div class="infra-value">${p.extra1Val.toFixed(2)}</div><div class="infra-unit">L/s (fixo)</div></div>`:''}
    </div>`;

  renderObras(pop,v,p,ano);
  renderChartDemanda(p);
}

function renderObras(pop,v,p,ano){
  const diam_adut=Math.sqrt((4*v.QK1)/(Math.PI*1.5))*1000;
  const diam_rede=Math.sqrt((4*v.QK2/0.7)/(Math.PI*2.0))*1000;
  const vol_res=v.vol_res_m3;
  const area_eta=v.Qmed*86400/600;
  const vol_ete=v.vol_ete_m3;
  const area_lagoa=vol_ete/(3.5);

  // Reservação de incêndio (NBR 13714)
  const V_incendio=Math.max(12,Math.min(108,pop*0.0008));
  const vol_res_total=vol_res+V_incendio;

  // Rede de distribuição — diâmetros por trecho típico
  const series_dn_rede=[50,75,100,125,150,200,250,300,350,400];
  const DN_rede=series_dn_rede.find(d=>d>=diam_rede)||series_dn_rede[series_dn_rede.length-1];
  const DN_adut=Math.ceil(diam_adut/25)*25;
  const v_rede_real=(v.QK2/1000)/(Math.PI*((DN_rede/1000)/2)**2);

  document.getElementById('dim-display').innerHTML=`
    <p style="font-size:12px;color:var(--text3);font-family:var(--mono);margin-bottom:14px;">Dimensionamento de obras para <strong style="color:var(--text);">${pop.toLocaleString('pt-BR')} hab</strong> em <strong style="color:var(--text);">${ano}</strong></p>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_TANK)} Reservatório de distribuição</div>
        <div><div class="dim-result">${vol_res_total.toFixed(0)}</div><div class="dim-unit">m³ (regularização + incêndio)</div></div>
      </div>
      <div class="dim-detail">Volume de regularização (12h × Q·K1) + reserva de incêndio NBR 13714 (${V_incendio.toFixed(0)} m³). Ref: NBR 12.218 / FUNASA.</div>
      <div class="dim-formula">V_reg = Q·K1 × 3600 × 12 / 1000 = ${vol_res.toFixed(0)} m³ · V_inc = ${V_incendio.toFixed(0)} m³ → <strong>V_total = ${vol_res_total.toFixed(0)} m³</strong></div>
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_PIPE)} Adutora principal</div>
        <div><div class="dim-result">${DN_adut}</div><div class="dim-unit">mm (DN nominal)</div></div>
      </div>
      <div class="dim-detail">Diâmetro calculado para conduzir Q·K1 com velocidade de 1,5 m/s. DN nominal arredondado para cima (série ABNT).</div>
      <div class="dim-formula">D = √(4·Q / π·v) = ${diam_adut.toFixed(0)} mm calc. → DN ${DN_adut} mm</div>
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_PIPE)} Rede de distribuição — tronco principal</div>
        <div><div class="dim-result">DN ${DN_rede}</div><div class="dim-unit">mm (tronco)</div></div>
      </div>
      <div class="dim-detail">Diâmetro para conduzir Q·K1·K2 (hora de ponta) com velocidade de 2,0 m/s no tronco. Derivações secundárias: DN 75–100 mm. Velocidade real no tronco: ${v_rede_real.toFixed(2)} m/s. NBR 12218.</div>
      <div class="dim-formula">D_rede = √(4·Q·K1·K2 / (π·v)) = ${diam_rede.toFixed(0)} mm calc. → DN ${DN_rede} mm · v = ${v_rede_real.toFixed(2)} m/s</div>
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_PLANT)} ETA — Estação de Tratamento de Água</div>
        <div><div class="dim-result">${area_eta.toFixed(0)}</div><div class="dim-unit">m² área de filtração</div></div>
      </div>
      <div class="dim-detail">Área de leito filtrante para taxa de filtração de 600 m³/m²/dia (filtro rápido pressão). Capacidade de tratamento: ${v.m3dia.toFixed(0)} m³/dia.</div>
      <div class="dim-formula">A_ETA = Q / τ = ${v.m3dia.toFixed(0)} m³/dia ÷ 600 m³/m²/dia = ${area_eta.toFixed(0)} m²</div>
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_SEWER)} ETE — Lagoa Facultativa (TDH 20 dias)</div>
        <div><div class="dim-result">${(vol_ete/1000).toFixed(1)}</div><div class="dim-unit">mil m³ (volume útil)</div></div>
      </div>
      <div class="dim-detail">Lagoa facultativa com tempo de detenção hidráulica de <strong>20 dias</strong> (Von Sperling 2002 / FUNASA — clima tropical). Profundidade útil: 3,5 m. Área da lagoa: ${area_lagoa.toFixed(0)} m² = ${(area_lagoa/10000).toFixed(2)} ha. Vazão afluente: ${v.Qesg.toFixed(2)} L/s. <em>Nota: TDH de 2 dias é adequado para reatores UASB, não para lagoa facultativa.</em></div>
      <div class="dim-formula">V_ETE = Q_esg × 86.400 × TDH(20d) / 1.000 = ${v.Qesg.toFixed(2)} L/s × 86.400 × 20 / 1.000 = ${vol_ete.toFixed(0)} m³</div>
    </div>

    <div class="dim-card">
      <div class="dim-header">
        <div class="dim-title">${ic(SVG_WASTE,'amber')} Aterro sanitário / Galpão de triagem</div>
        <div><div class="dim-result">${(v.res_td*365*20/1000).toFixed(1)}</div><div class="dim-unit">mil ton (20 anos)</div></div>
      </div>
      <div class="dim-detail">Geração de ${v.res_td.toFixed(1)} ton/dia. Volume de aterro necessário para 20 anos: ${(v.res_td*365*20/0.8/1000).toFixed(0)} m³ (densidade 0,8 t/m³).</div>
      <div class="dim-formula">V_aterro = ${v.res_td.toFixed(1)} × 365 × 20 / 0,8 = ${(v.res_td*365*20/0.8/1000).toFixed(0)} m³</div>
    </div>
    ${renderManningCard(v,p,pop)}`;
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
  const Q_design=v.QesgK1+Q_inf; // L/s total (ponta + infiltração)
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
      Q_infiltração=${Q_inf.toFixed(3)} L/s (taxa ${taxa_inf} L/s·km × ${ext_rede_km} km) · Q_design=${Q_design.toFixed(2)} L/s
    </div>
    <div class="dim-formula">
      v = (1/n)·Rh^2/3·S^1/2 = (1/${n_mann})×${mann.Rh_m.toFixed(4)}^0,667×${(S_oo*100).toFixed(2)}%^0,5 = ${mann.v_m_s.toFixed(3)} m/s
      Q_inf = ${taxa_inf} × ${ext_rede_km} = ${Q_inf.toFixed(3)} L/s → Q_total = ${Q_design.toFixed(2)} L/s
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
