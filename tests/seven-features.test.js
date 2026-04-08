/**
 * Unit tests for the 7-feature implementation:
 * Feature 1  — TABELA_CUSTOS, estimarCustoAdutora, estimarCustoRede, formatBRL (utils.js)
 * Feature 2  — calcPressaoRede (utils.js)
 * Feature 6  — calcTempoEsvaziamento (utils.js)
 * Feature 4  — calcQ95 (api.js)
 * Feature 3  — BOMBAS_PADRAO, interpBombaCurva, sugerirBomba (avancados.js)
 */
import { describe, test, expect } from 'vitest';
import { loadScript } from './setup.js';

// ── utils.js ──────────────────────────────────────────────────────────────────
const utils = loadScript('utils.js', {
  state: {
    _materialKey: null,
    municipioNome: '', municipioCod: '', municipioUF: '',
    municipioLat: null, municipioLon: null, auditLog: [],
  },
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    documentElement: { getAttribute: () => null },
  },
  addAudit: () => {},
  calcAducao: () => {},
});

// ── Feature 1 — TABELA_CUSTOS ─────────────────────────────────────────────────
describe('TABELA_CUSTOS', () => {
  test('has adutora_rm with expected DNs', () => {
    const tbl = utils.TABELA_CUSTOS;
    expect(tbl).toBeDefined();
    expect(tbl.adutora_rm[150]).toBeGreaterThan(0);
    expect(tbl.adutora_rm[500]).toBeGreaterThan(tbl.adutora_rm[150]);
  });

  test('reservatorio_m3 is positive', () => {
    expect(utils.TABELA_CUSTOS.reservatorio_m3).toBeGreaterThan(0);
  });

  test('opex_pct is between 0.01 and 0.10', () => {
    const pct = utils.TABELA_CUSTOS.opex_pct;
    expect(pct).toBeGreaterThanOrEqual(0.01);
    expect(pct).toBeLessThanOrEqual(0.10);
  });
});

// ── Feature 1 — estimarCustoAdutora ──────────────────────────────────────────
describe('estimarCustoAdutora', () => {
  test('returns positive cost for DN 200 and 5000m', () => {
    const cost = utils.estimarCustoAdutora(200, 5000);
    expect(cost).toBeGreaterThan(0);
  });

  test('cost scales linearly with length', () => {
    const c1 = utils.estimarCustoAdutora(300, 1000);
    const c2 = utils.estimarCustoAdutora(300, 2000);
    expect(c2).toBeCloseTo(c1 * 2, 1);
  });

  test('larger DN produces higher cost per meter', () => {
    const c150 = utils.estimarCustoAdutora(150, 1000);
    const c500 = utils.estimarCustoAdutora(500, 1000);
    expect(c500).toBeGreaterThan(c150);
  });

  test('uses next DN up when exact DN not in table', () => {
    // DN 175mm not in table — should use DN 200
    const c175 = utils.estimarCustoAdutora(175, 1000);
    const c200 = utils.estimarCustoAdutora(200, 1000);
    expect(c175).toBe(c200);
  });
});

// ── Feature 1 — estimarCustoRede ─────────────────────────────────────────────
describe('estimarCustoRede', () => {
  test('returns positive cost for DN 100 and 3000m', () => {
    const cost = utils.estimarCustoRede(100, 3000);
    expect(cost).toBeGreaterThan(0);
  });

  test('larger DN costs more per meter', () => {
    const c100 = utils.estimarCustoRede(100, 1000);
    const c300 = utils.estimarCustoRede(300, 1000);
    expect(c300).toBeGreaterThan(c100);
  });
});

// ── Feature 1 — formatBRL ─────────────────────────────────────────────────────
describe('formatBRL', () => {
  test('formats millions correctly', () => {
    const s = utils.formatBRL(2100000);
    expect(s).toContain('Mi');
    expect(s).toContain('2,10');
  });

  test('formats thousands correctly', () => {
    const s = utils.formatBRL(800000);
    expect(s).toContain('800');
    expect(s).toContain('mil');
  });

  test('formats billions correctly', () => {
    const s = utils.formatBRL(5e9);
    expect(s).toContain('Bi');
  });

  test('formats small values without suffix', () => {
    const s = utils.formatBRL(950);
    expect(s).toContain('R$');
    expect(s).not.toContain('Mi');
    expect(s).not.toContain('mil');
  });
});

// ── Feature 2 — calcPressaoRede ───────────────────────────────────────────────
describe('calcPressaoRede', () => {
  test('calculates P_baixo as cotaRes - cotaBaixo', () => {
    const r = utils.calcPressaoRede(85, 10, null, 15);
    expect(r.P_baixo).toBeCloseTo(75, 5);
    expect(r.P_alto).toBeNull();
  });

  test('calculates P_alto as cotaRes - cotaAlto - Hf', () => {
    const r = utils.calcPressaoRede(85, null, 80, 15);
    expect(r.P_baixo).toBeNull();
    expect(r.P_alto).toBeCloseTo(-10, 5); // 85 - 80 - 15 = -10
  });

  test('calculates both when both inputs provided', () => {
    const r = utils.calcPressaoRede(85, 10, 75, 10);
    expect(r.P_baixo).toBeCloseTo(75, 5);
    expect(r.P_alto).toBeCloseTo(0, 5); // 85 - 75 - 10 = 0
  });

  test('returns null for both when both inputs null', () => {
    const r = utils.calcPressaoRede(85, null, null, 10);
    expect(r.P_baixo).toBeNull();
    expect(r.P_alto).toBeNull();
  });
});

// ── Feature 6 — calcTempoEsvaziamento ────────────────────────────────────────
describe('calcTempoEsvaziamento', () => {
  test('returns Infinity when captacao >= consumo', () => {
    expect(utils.calcTempoEsvaziamento(10000, 50, 40)).toBe(Infinity);
    expect(utils.calcTempoEsvaziamento(10000, 40, 40)).toBe(Infinity);
  });

  test('returns correct hours when deficit exists', () => {
    // V=10000 m³, Q_cap=20 L/s, Q_cons=30 L/s → deficit=10 L/s
    // T = 10000*1000 / (10*3600) = 277.78 h
    const T = utils.calcTempoEsvaziamento(10000, 20, 30);
    expect(T).toBeCloseTo(10000 * 1000 / (10 * 3600), 2);
  });

  test('larger reservoir gives longer autonomy', () => {
    const T1 = utils.calcTempoEsvaziamento(5000, 10, 20);
    const T2 = utils.calcTempoEsvaziamento(10000, 10, 20);
    expect(T2).toBeCloseTo(T1 * 2, 5);
  });

  test('returns 0 or positive value (never negative)', () => {
    const T = utils.calcTempoEsvaziamento(100, 0, 50);
    expect(T).toBeGreaterThan(0);
  });
});

// ── Feature 4 — calcQ95 (api.js) ─────────────────────────────────────────────
const api = loadScript('api.js', {
  state: {
    censosData: [], municipioNome: '', municipioCod: '', municipioUF: '',
    municipioLat: null, municipioLon: null, projData: [], cmpB: null,
    auditLog: [], _aducaoResult: null,
  },
  document: {
    getElementById: () => ({ value: '', style: {}, classList: { add(){}, remove(){} }, innerHTML: '', textContent: '' }),
    querySelectorAll: () => [],
    documentElement: { getAttribute: () => null },
  },
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  addAudit: () => {},
  setStatus: () => {},
  renderCensusRows: () => {},
  renderComparacao: () => {},
  removeAcentos: (s) => s,
  safeHtml: (s) => s, escHtml: (s) => s,
  fetchAreaMunicipio: async () => 0,
  calcRacionamento: () => {},
});

describe('calcQ95', () => {
  test('returns 5th-percentile value from sorted array', () => {
    // 20 values [1,2,...,20]; 5th percentile idx = floor(0.05*20)=1 → sorted[1]=2
    const vals = Array.from({length:20},(_,i)=>i+1);
    expect(api.calcQ95(vals)).toBe(2);
  });

  test('returns 0 for empty array', () => {
    expect(api.calcQ95([])).toBe(0);
  });

  test('returns 0 for null/undefined', () => {
    expect(api.calcQ95(null)).toBe(0);
    expect(api.calcQ95(undefined)).toBe(0);
  });

  test('single element returns that element', () => {
    expect(api.calcQ95([42])).toBe(42);
  });

  test('Q95 is always <= Q_media for non-trivial series', () => {
    const vals = [100, 80, 60, 40, 20, 10, 5, 50, 70, 90];
    const q95 = api.calcQ95(vals);
    const qmed = vals.reduce((a,b)=>a+b,0) / vals.length;
    expect(q95).toBeLessThanOrEqual(qmed);
  });
});

// ── Feature 3 — avancados.js (BOMBAS_PADRAO, interpBombaCurva, sugerirBomba) ─
const avancados = loadScript('avancados.js', {
  state: { charts: {}, _aducaoResult: null, auditLog: [] },
  document: {
    getElementById: () => ({ value: '', style: {}, classList:{add(){},remove(){}}, innerHTML: '', textContent: '' }),
    querySelectorAll: () => [],
    documentElement: { getAttribute: () => null },
  },
  Chart: class { constructor(){} destroy(){} update(){} },
  addAudit: () => {},
  calcTempoEsvaziamento: (V, Qc, Qd) => {
    // inline for isolation
    const d = Qd - Qc;
    return d <= 0 ? Infinity : (V * 1000) / (d * 3600);
  },
});

describe('BOMBAS_PADRAO', () => {
  test('has 6 entries', () => {
    expect(avancados.BOMBAS_PADRAO.length).toBe(6);
  });

  test('each entry has curva, NPSHr, id, label', () => {
    avancados.BOMBAS_PADRAO.forEach(b => {
      expect(b.curva.length).toBeGreaterThan(0);
      expect(b.NPSHr).toBeGreaterThan(0);
      expect(typeof b.id).toBe('string');
      expect(typeof b.label).toBe('string');
    });
  });

  test('pump curves are monotonically decreasing in H', () => {
    avancados.BOMBAS_PADRAO.forEach(b => {
      for(let i = 1; i < b.curva.length; i++){
        expect(b.curva[i].h).toBeLessThanOrEqual(b.curva[i-1].h + 0.01); // allow tiny float noise
      }
    });
  });
});

describe('interpBombaCurva', () => {
  const curva = [{q:0,h:80},{q:50,h:60},{q:100,h:0}];

  test('returns H0 for Q <= Q_min', () => {
    expect(avancados.interpBombaCurva(curva, 0)).toBe(80);
    expect(avancados.interpBombaCurva(curva, -5)).toBe(80);
  });

  test('returns last H for Q >= Q_max', () => {
    expect(avancados.interpBombaCurva(curva, 100)).toBe(0);
    expect(avancados.interpBombaCurva(curva, 200)).toBe(0);
  });

  test('interpolates linearly at midpoint', () => {
    // midpoint between Q=0,H=80 and Q=50,H=60 is Q=25, H=70
    expect(avancados.interpBombaCurva(curva, 25)).toBeCloseTo(70, 5);
  });
});

describe('sugerirBomba', () => {
  test('returns non-empty array for typical H=63, Q=75 m³/h (cat-b BEP)', () => {
    const matches = avancados.sugerirBomba(63, 75);
    expect(matches.length).toBeGreaterThan(0);
  });

  test('closest match has smallest |desvio_pct|', () => {
    const matches = avancados.sugerirBomba(49, 30); // cat-a BEP
    if(matches.length > 1){
      expect(Math.abs(matches[0].desvio_pct)).toBeLessThanOrEqual(Math.abs(matches[1].desvio_pct));
    }
  });

  test('respects tolerance parameter', () => {
    // Tight tolerance — only perfect matches
    const tight = avancados.sugerirBomba(63, 75, 0.001);
    const loose = avancados.sugerirBomba(63, 75, 0.30);
    expect(loose.length).toBeGreaterThanOrEqual(tight.length);
  });

  test('returns empty array for impossible requirements', () => {
    // H=500m, Q=5000 m³/h — no pump in library can match
    const matches = avancados.sugerirBomba(500, 5000);
    expect(matches.length).toBe(0);
  });

  test('each match has bomba, H_na_Qreq, desvio_pct properties', () => {
    const matches = avancados.sugerirBomba(49, 30);
    if(matches.length > 0){
      expect(matches[0]).toHaveProperty('bomba');
      expect(matches[0]).toHaveProperty('H_na_Qreq');
      expect(matches[0]).toHaveProperty('desvio_pct');
    }
  });
});
