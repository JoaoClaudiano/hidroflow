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
 * Fetch municipality territorial area (km²) from IBGE SIDRA table 6579.
 * Tries 2022 first (2022 Censo), then falls back to 2019 (table baseline year).
 * Returns 0 if unavailable.
 */
async function fetchAreaMunicipio(cod){
  const years=['2022','2019'];
  for(const yr of years){
    try{
      const r=await fetchWithRetry(
        `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/${yr}/variaveis/606?localidades=N6[${cod}]`,
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
