// ══════════════════════════════════════════
// BUSCA MUNICÍPIO
// ══════════════════════════════════════════
let _munCache=[],_munTimer=null;

// ── API response cache (keyed by URL) ────────────────────────────────────────
const _apiCache = new Map();

/**
 * fetch with exponential-backoff retry and in-memory cache.
 * @param {string} url
 * @param {object} [opts] - fetch options
 * @param {number} [maxRetries=3]
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, opts = {}, maxRetries = 3) {
  if (_apiCache.has(url)) {
    // Return a synthetic Response wrapping the cached value
    return { ok: true, json: async () => _apiCache.get(url) };
  }
  let lastErr;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(url, opts);
      if (resp.ok) {
        const data = await resp.json();
        _apiCache.set(url, data);
        // Return a consistent interface
        return { ok: true, json: async () => data };
      }
      // Non-2xx: don't retry 4xx client errors
      if (resp.status >= 400 && resp.status < 500) throw new Error(`HTTP ${resp.status}`);
      lastErr = new Error(`HTTP ${resp.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < maxRetries - 1) {
      // Exponential back-off: 300 ms, 900 ms, 2700 ms …
      await new Promise(r => setTimeout(r, 300 * Math.pow(3, attempt)));
    }
  }
  throw lastErr;
}

async function buscarMunicipioPorNome(termo){
  clearTimeout(_munTimer);
  const el=document.getElementById('mun-results');
  if(!termo||termo.length<3){el.style.display='none';return;}
  _munTimer=setTimeout(async()=>{
    try{
      if(!_munCache.length){
        const r=await fetchWithRetry('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
        _munCache=await r.json();
      }
      const q=removeAcentos(termo.toLowerCase());
      const found=_munCache.filter(m=>removeAcentos(m.nome.toLowerCase()).includes(q)).slice(0,8);
      if(!found.length){el.style.display='none';return;}
      el.innerHTML=found.map(m=>`<div class="mun-result-item" onclick="selecionarMunicipio('${m.id}','${escHtml(m.nome)}','${m['regiao-imediata']['regiao-intermediaria']['UF']['sigla']}')"><span>${m.nome} — ${m['regiao-imediata']['regiao-intermediaria']['UF']['sigla']}</span><span class="mun-result-cod">${m.id}</span></div>`).join('');
      el.style.display='block';
    }catch(e){
      el.style.display='none';
      console.warn('Erro ao buscar município:', e.message);
    }
  },300);
}

function selecionarMunicipio(cod,nome,uf){
  document.getElementById('ibge-cod').value=cod;
  document.getElementById('mun-busca').value=nome+' — '+uf;
  document.getElementById('mun-results').style.display='none';
  state.municipioCod=cod;state.municipioNome=nome;state.municipioUF=uf;
}
function fecharResultados(){document.getElementById('mun-results').style.display='none';}

async function buscarMunicipioB(termo){
  clearTimeout(_munTimer);
  const el=document.getElementById('cmp-b-results');
  if(!termo||termo.length<3){el.style.display='none';return;}
  _munTimer=setTimeout(async()=>{
    try{
      if(!_munCache.length){
        const r=await fetchWithRetry('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
        _munCache=await r.json();
      }
      const q=removeAcentos(termo.toLowerCase());
      const found=_munCache.filter(m=>removeAcentos(m.nome.toLowerCase()).includes(q)).slice(0,8);
      if(!found.length){el.style.display='none';return;}
      el.innerHTML=found.map(m=>`<div class="mun-result-item" onclick="selecionarMunicipioB('${m.id}','${escHtml(m.nome)}','${m['regiao-imediata']['regiao-intermediaria']['UF']['sigla']}')"><span>${m.nome} — ${m['regiao-imediata']['regiao-intermediaria']['UF']['sigla']}</span><span class="mun-result-cod">${m.id}</span></div>`).join('');
      el.style.display='block';
    }catch(e){
      el.style.display='none';
      console.warn('Erro ao buscar município B:', e.message);
    }
  },300);
}
function selecionarMunicipioB(cod,nome,uf){document.getElementById('cmp-b-cod').value=cod;document.getElementById('cmp-b-busca').value=nome+' — '+uf;document.getElementById('cmp-b-results').style.display='none';}
function fecharResultadosB(){document.getElementById('cmp-b-results').style.display='none';}

// ══════════════════════════════════════════
// SIDRA API
// ══════════════════════════════════════════
function parseSIDRA(dados){
  const pontos=[];
  if(!dados||!dados[0]||!dados[0].resultados)return pontos;
  for(const res of dados[0].resultados){
    const serie=res.series&&res.series[0]&&res.series[0].serie;
    if(!serie)continue;
    for(const[periodoStr,valStr]of Object.entries(serie)){
      const ano=parseInt(periodoStr),pop=parseInt(valStr);
      if(!isNaN(ano)&&!isNaN(pop)&&pop>0)pontos.push({ano,pop});
    }
  }
  return pontos;
}

async function fetchSIDRAMunicipio(cod){
  const r202=await fetchWithRetry(`https://servicodados.ibge.gov.br/api/v3/agregados/202/periodos/1991|2000|2010/variaveis/93?localidades=N6[${cod}]`);
  if(!r202.ok)throw new Error(`SIDRA Tabela 202: sem resposta`);
  const censos=parseSIDRA(await r202.json());
  let pop2022=null;
  try{
    const r4709=await fetchWithRetry(`https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades=N6[${cod}]`);
    if(r4709.ok){const pts=parseSIDRA(await r4709.json());if(pts.length)pop2022=pts[0].pop;}
  }catch(_){}
  if(!pop2022){
    try{
      const r9543=await fetchWithRetry(`https://servicodados.ibge.gov.br/api/v3/agregados/9543/periodos/2022/variaveis/93?localidades=N6[${cod}]`);
      if(r9543.ok){const pts=parseSIDRA(await r9543.json());if(pts.length)pop2022=pts[0].pop;}
    }catch(_){}
  }
  if(pop2022)censos.push({ano:2022,pop:pop2022});
  if(!censos.length)throw new Error('Nenhum dado encontrado. Verifique o código IBGE.');
  return censos.sort((a,b)=>a.ano-b.ano);
}

// ── Input validation ──────────────────────────────────────────────────────────

/** Returns true if cod is a valid 6–7 digit IBGE municipality code. */
function validarCodigoIBGE(cod){
  return /^\d{6,7}$/.test(cod.trim());
}

async function buscarSIDRA(){
  const cod=document.getElementById('ibge-cod').value.trim();
  const st=document.getElementById('ibge-status');
  const btn=document.getElementById('btn-buscar');
  const txt=document.getElementById('buscar-txt');
  if(!validarCodigoIBGE(cod)){setStatus(st,'Código IBGE inválido — informe 6 ou 7 dígitos numéricos.','err');return;}
  btn.classList.add('btn-loading');
  txt.innerHTML='<span class="spinner"></span> Buscando…';
  setStatus(st,'Consultando SIDRA/IBGE…','');
  try{
    const nomeResp=await fetchWithRetry(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cod}`);
    if(nomeResp.ok){
      const j=await nomeResp.json();
      state.municipioNome=j.nome||`Município ${cod}`;
      state.municipioUF=j['regiao-imediata']?.['regiao-intermediaria']?.['UF']?.['sigla']||'';
      try{
        const geoR=await fetchWithRetry(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(state.municipioNome+', '+state.municipioUF+', Brasil')}&format=json&limit=1`);
        if(geoR.ok){const geo=await geoR.json();if(geo&&geo.length){state.municipioLat=parseFloat(geo[0].lat);state.municipioLon=parseFloat(geo[0].lon);}}
      }catch(_){
        // Geolocation is optional — log but don't fail the whole operation
        console.warn('Nominatim indisponível — mapa pode não centralizar automaticamente.');
      }
      document.getElementById('mun-busca').value=state.municipioNome+(state.municipioUF?' — '+state.municipioUF:'');
    }
    state.censosData=await fetchSIDRAMunicipio(cod);
    state.municipioCod=cod;
    renderCensusRows();
    setStatus(st,`${state.municipioNome} — ${state.censosData.length} censos carregados`,'ok');
    addAudit(`Dados SIDRA: ${state.municipioNome} (${cod})`);
    // Auto-fill municipality area if available
    fetchAreaMunicipio(cod).then(area=>{
      if(area>0){
        const el=document.getElementById('area-total');
        if(el){ el.value=area.toFixed(2); }
      }
    }).catch(()=>{});
  }catch(err){
    setStatus(st,`Erro ao buscar dados: ${err.message}. Verifique a conexão e o código IBGE.`,'err');
  }
  finally{btn.classList.remove('btn-loading');txt.innerHTML='<svg class="icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Buscar dados SIDRA';}
}

/**
 * Fetch municipality territorial area (km²) from IBGE SIDRA.
 * Uses table 1301 / variable 5930 ("Área da unidade territorial") — the canonical
 * IBGE territorial-area table available across census years.
 * Returns 0 if unavailable.
 */
async function fetchAreaMunicipio(cod){
  const endpoints=[
    {table:'1301',variable:'5930',year:'2022'},
    {table:'1301',variable:'5930',year:'2010'},
  ];
  for(const ep of endpoints){
    try{
      const r=await fetchWithRetry(
        `https://servicodados.ibge.gov.br/api/v3/agregados/${ep.table}/periodos/${ep.year}/variaveis/${ep.variable}?localidades=N6[${cod}]`,
        {},
        1
      );
      if(!r.ok) continue;
      const data=await r.json();
      if(!data||!data[0]||!data[0].resultados) continue;
      for(const res of data[0].resultados){
        const serie=res.series&&res.series[0]&&res.series[0].serie;
        if(serie){
          for(const val of Object.values(serie)){
            const area=parseFloat(val);
            if(!isNaN(area)&&area>0) return area;
          }
        }
      }
    }catch(_){}
  }
  return 0;
}

async function carregarMunicipioB(){
  const cod=document.getElementById('cmp-b-cod').value.trim();
  const st=document.getElementById('cmp-b-status');
  if(!validarCodigoIBGE(cod)){setStatus(st,'Código IBGE inválido — informe 6 ou 7 dígitos numéricos.','err');return;}
  setStatus(st,'Buscando…','');
  try{
    const nomeResp=await fetchWithRetry(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${cod}`);
    let nome=`Município ${cod}`,uf='';
    if(nomeResp.ok){const j=await nomeResp.json();nome=j.nome;uf=j['regiao-imediata']?.['regiao-intermediaria']?.['UF']?.['sigla']||'';}
    const censos=await fetchSIDRAMunicipio(cod);
    state.cmpB={cod,nome,uf,censos};
    setStatus(st,`${nome} carregado`,'ok');
    renderComparacao();
    addAudit(`Município B: ${nome}`);
  }catch(err){setStatus(st,`Erro: ${err.message}`,'err');}
}

// ══════════════════════════════════════════
// ALERTA CLIMÁTICO — HidroWeb / ANA (Q95)
// ══════════════════════════════════════════

/**
 * Calcula Q95 (vazão de permanência 95%) a partir de uma série histórica.
 * Q95 é o valor excedido em 95% das observações (5º percentil).
 * @param {number[]} vazoes - array de valores de vazão (qualquer unidade)
 * @returns {number} Q95 na mesma unidade do array de entrada
 */
function calcQ95(vazoes) {
  if(!vazoes||!vazoes.length) return 0;
  var sorted=vazoes.slice().sort(function(a,b){return a-b;});
  var idx=Math.max(0,Math.floor(0.05*sorted.length));
  return sorted[idx];
}

/**
 * Busca dados de vazão de uma estação fluviométrica na API HidroWeb (ANA/SNIRH).
 * Retorna { estacao, serie_m3s, Q95_m3s, Q_media_m3s } ou lança exceção.
 * Em caso de falha de CORS/rede o chamador deve exibir entrada manual de Q95.
 * @param {string} codEstacao - código de 8 dígitos da estação ANA
 * @returns {Promise<{estacao:string, serie_m3s:number[], Q95_m3s:number, Q_media_m3s:number}>}
 */
async function fetchHidroweb(codEstacao){
  // HidroWeb REST v3 — endpoint público de documentos convencionais (vazões)
  const url=`https://www.snirh.gov.br/hidroweb/rest/api/documento/convencionais?codigoEstacao=${encodeURIComponent(codEstacao)}&tipoArquivo=3&format=json`;
  let data;
  try{
    const resp=await fetchWithRetry(url,{},2);
    if(!resp.ok) throw new Error('HidroWeb retornou HTTP '+resp.status);
    data=await resp.json();
  }catch(e){
    throw new Error('HidroWeb indisponível ('+e.message+') — use entrada manual de Q95');
  }
  // Extrair série de valores numéricos positivos de diversas estruturas de resposta
  var serie=[];
  if(Array.isArray(data)){
    data.forEach(function(item){
      if(item&&typeof item.vazao==='number'&&item.vazao>=0) serie.push(item.vazao);
      else if(item&&typeof item.maxima==='number'&&item.maxima>=0) serie.push(item.maxima);
      else if(item&&typeof item.media==='number'&&item.media>=0) serie.push(item.media);
    });
  }else if(data&&Array.isArray(data.vazoes)){
    serie=data.vazoes.filter(function(v){return typeof v==='number'&&v>=0;});
  }else if(data&&Array.isArray(data.valores)){
    serie=data.valores.filter(function(v){return typeof v==='number'&&v>=0;});
  }
  if(!serie.length) throw new Error('Sem dados de vazão para a estação '+codEstacao+' — verifique o código');
  var Q95=calcQ95(serie);
  var Q_media=serie.reduce(function(s,v){return s+v;},0)/serie.length;
  return{estacao:codEstacao,serie_m3s:serie,Q95_m3s:Q95,Q_media_m3s:Q_media};
}

/** Busca vazão Q95 pela UI do módulo HidroWeb e avalia viabilidade de captação. */
async function buscarVazaoHidroweb(){
  const codEl=document.getElementById('hidroweb-cod');
  const resultEl=document.getElementById('hidroweb-result');
  const cod=codEl?codEl.value.trim():'';
  if(!cod){
    if(resultEl)resultEl.innerHTML='<div class="alert alert-info">Informe o código da estação ANA (8 dígitos numéricos).</div>';
    return;
  }
  if(resultEl)resultEl.innerHTML='<div class="alert alert-info"><span class="spinner"></span> Consultando HidroWeb / ANA…</div>';
  try{
    const dados=await fetchHidroweb(cod);
    _avaliarQ95(dados.Q95_m3s,dados.Q_media_m3s,dados.serie_m3s.length,cod);
  }catch(e){
    // Fallback: entrada manual de Q95
    if(resultEl)resultEl.innerHTML=`
      <div class="alert alert-warning" style="font-size:12px;font-family:var(--mono);">⚠️ ${e.message}<br>Insira Q95 manualmente:</div>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <label style="font-size:11px;color:var(--text3);">Q95 manual (m³/s):</label>
        <input type="number" id="hidroweb-q95-manual" step="0.001" min="0" placeholder="Ex: 0.250" style="width:130px;padding:4px 8px;border:1px solid var(--border2);border-radius:var(--radius);font-size:12px;background:var(--input-bg);color:var(--text);">
        <button class="btn btn-sm" onclick="aplicarQ95Manual()">Aplicar</button>
      </div>`;
  }
}

function _avaliarQ95(Q95_m3s,Q_media_m3s,nRegistros,codEstacao){
  const resultEl=document.getElementById('hidroweb-result');
  if(!resultEl)return;
  const ad=state._aducaoResult;
  const QK1_m3s=ad&&ad.QK1?ad.QK1/1000:null;
  const viavel=QK1_m3s!==null?Q95_m3s>=QK1_m3s:null;
  const msg=QK1_m3s!==null
    ?(viavel
      ?`✅ Viável: Q95 (${Q95_m3s.toFixed(3)} m³/s) ≥ Q·K1 projeto (${QK1_m3s.toFixed(3)} m³/s). Outorga preliminarmente viável.`
      :`🚫 Insustentável: Q95 (${Q95_m3s.toFixed(3)} m³/s) < Q·K1 projeto (${QK1_m3s.toFixed(3)} m³/s). Sugere-se reservatório de acumulação ou captação subterrânea.`)
    :'Execute o módulo de Adução para comparar com Q·K1 do projeto.';
  resultEl.innerHTML=`
    <div class="alert ${viavel===false?'alert-danger':viavel===true?'alert-success':'alert-info'}" style="font-family:var(--mono);font-size:12px;">${msg}</div>
    <div style="margin-top:8px;font-size:11px;font-family:var(--mono);color:var(--text3);">
      Q95 (excedida 95% do tempo) = <strong>${Q95_m3s.toFixed(3)} m³/s</strong> · Q média = ${Q_media_m3s.toFixed(3)} m³/s · ${nRegistros} registros
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:4px;">Fonte: HidroWeb / ANA · Estação ${codEstacao}</div>`;
  // Atualiza slider de racionamento com percentual Q95
  if(ad&&ad.Qmed&&Q95_m3s>0){
    const pct=Math.min(100,Math.round(Q95_m3s*1000/ad.Qmed*100));
    const pctEl=document.getElementById('rac-pct');
    const lblEl=document.getElementById('rac-pct-label');
    const hintEl=document.getElementById('rac-q95-hint');
    if(pctEl){pctEl.value=pct;}
    if(lblEl){lblEl.textContent=pct+'%';}
    if(hintEl){hintEl.textContent='Q95 ANA = '+(Q95_m3s*1000).toFixed(1)+' L/s = '+pct+'% da vazão média de projeto';}
    if(typeof calcRacionamento==='function')calcRacionamento();
  }
}

function aplicarQ95Manual(){
  const val=+(document.getElementById('hidroweb-q95-manual')?.value);
  const resultEl=document.getElementById('hidroweb-result');
  const ad=state._aducaoResult;
  if(!val||val<=0){
    if(resultEl)resultEl.innerHTML+='<div class="alert alert-info" style="font-size:12px;margin-top:6px;">Informe um valor de Q95 > 0.</div>';
    return;
  }
  if(!ad||!ad.QK1){
    if(resultEl)resultEl.innerHTML+='<div class="alert alert-info" style="font-size:12px;margin-top:6px;">Execute o módulo de Adução primeiro.</div>';
    return;
  }
  _avaliarQ95(val,val,1,'manual');
}
