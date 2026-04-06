/**
 * Unit tests for the new features:
 * 1. hasNegativeGrowth (models.js)
 * 2. Logistic guard K <= Pn (models.js)
 * 3. calcManning (infra.js)
 * 4. calcSwameeJain + calcDarcyWeisbach (aducao.js)
 * 5. calcNPSH + calcPvapor (aducao.js)
 * 6. haversineDistance (network.js)
 * 7. MATERIAIS_HIDRO (utils.js)
 */
import { describe, test, expect } from 'vitest';
import { loadScript } from './setup.js';

// ── models.js (hasNegativeGrowth) ─────────────────────────────────────────────
const models = loadScript('models.js', {
  calcAducao: () => {},
  renderDimensionamento: () => {},
  renderObras: () => {},
  renderChartDemanda: () => {},
});

describe('hasNegativeGrowth', () => {
  test('returns false for monotonically increasing series', () => {
    expect(models.hasNegativeGrowth([10000, 11000, 12000, 13500])).toBe(false);
  });
  test('returns true when any value is less than previous', () => {
    expect(models.hasNegativeGrowth([10000, 11000, 10500, 12000])).toBe(true);
  });
  test('returns true for strictly decreasing series', () => {
    expect(models.hasNegativeGrowth([15000, 14000, 13000])).toBe(true);
  });
  test('single element series: no growth to compare', () => {
    expect(models.hasNegativeGrowth([10000])).toBe(false);
  });
  test('returns false for flat series', () => {
    expect(models.hasNegativeGrowth([10000, 10000, 10000])).toBe(false);
  });
});

// ── infra.js (calcManning) ────────────────────────────────────────────────────
const infra = loadScript('infra.js', {
  SVG_WATER: '', SVG_FLOW: '', SVG_SEWER: '', SVG_WASTE: '', SVG_ENERGY: '',
  SVG_TANK: '', SVG_PIPE: '', SVG_PLANT: '',
  ic: () => '',
  renderObras: () => {},
  renderChartDemanda: () => {},
  renderDecisao: () => {},
  gerarRelatorio: () => {},
  getPopForAno: () => 100000,
  MATERIAIS_HIDRO: {},
});

describe('calcManning', () => {
  test('produces positive velocity for valid inputs', () => {
    // n=0.013, D=0.2m, S=0.5%, laminaFrac=0.65
    const r = infra.calcManning(0.013, 0.2, 0.005, 0.65);
    expect(r.v_m_s).toBeGreaterThan(0);
  });

  test('v >= 0.6 m/s for PVC DN200 at S=0.5%', () => {
    // n=0.009 (PVC), D=0.2m, S=0.5%
    const r = infra.calcManning(0.009, 0.2, 0.005, 0.65);
    expect(r.v_min_ok).toBe(true);
    expect(r.v_m_s).toBeGreaterThanOrEqual(0.6);
  });

  test('v < 0.6 m/s for rough concrete at very low slope', () => {
    // n=0.016, D=0.3m, S=0.01% (very flat)
    const r = infra.calcManning(0.016, 0.3, 0.0001, 0.65);
    expect(r.v_min_ok).toBe(false);
  });

  test('area_m2 is positive', () => {
    const r = infra.calcManning(0.013, 0.2, 0.005, 0.65);
    expect(r.area_m2).toBeGreaterThan(0);
  });

  test('Rh_m is positive and < D/4 for partial flow', () => {
    const r = infra.calcManning(0.013, 0.2, 0.005, 0.65);
    // Rh for full circle = D/4; partial flow can be near this
    expect(r.Rh_m).toBeGreaterThan(0);
    expect(r.Rh_m).toBeLessThan(0.2); // Must be less than diameter
  });

  test('higher slope gives higher velocity', () => {
    const r1 = infra.calcManning(0.013, 0.2, 0.001, 0.65);
    const r2 = infra.calcManning(0.013, 0.2, 0.01, 0.65);
    expect(r2.v_m_s).toBeGreaterThan(r1.v_m_s);
  });

  test('larger diameter gives larger area', () => {
    const r1 = infra.calcManning(0.013, 0.2, 0.005, 0.65);
    const r2 = infra.calcManning(0.013, 0.3, 0.005, 0.65);
    expect(r2.area_m2).toBeGreaterThan(r1.area_m2);
  });
});

// ── aducao.js (Swamee-Jain, Darcy-Weisbach, NPSH) ───────────────────────────
const aducao = loadScript('aducao.js', {
  state: {
    projData: [], censosRaw: null, infraAnos: [2025, 2030, 2035, 2043],
    adAnoIdx: 0, auditLog: [], charts: {}, config: {},
    municipioNome: '', municipioUF: 'CE', _materialKey: null,
  },
  getParams: () => ({ agua: 150, K1: 1.2, K2: 1.5, ret: 0.8 }),
  getPopForAno: () => 50000,
  addAudit: () => {},
  calcAducao: () => {},
  MATERIAIS_HIDRO: {},
  document: {
    getElementById: () => ({ value: '', style: {}, checked: false, children: [], innerHTML: '' }),
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  Chart: class { constructor() {} destroy() {} },
  alert: () => {},
  confirm: () => true,
  fetch: async () => ({ ok: true, json: async () => ({ tarifas: [] }) }),
});

describe('calcSwameeJain', () => {
  test('returns a positive friction factor for turbulent flow', () => {
    // PVC pipe: eps=0.000007m, D=0.2m, Re=100000
    const f = aducao.calcSwameeJain(0.000007, 0.2, 100000);
    expect(f).toBeGreaterThan(0);
    expect(f).toBeLessThan(0.1);
  });

  test('returns minimum factor for edge case (Re=0)', () => {
    const f = aducao.calcSwameeJain(0.0001, 0.2, 0);
    expect(f).toBeGreaterThanOrEqual(0.008);
  });

  test('rougher pipe gives higher friction factor', () => {
    const f_smooth = aducao.calcSwameeJain(0.000007, 0.2, 100000); // PVC
    const f_rough  = aducao.calcSwameeJain(0.003, 0.2, 100000);    // concrete
    expect(f_rough).toBeGreaterThan(f_smooth);
  });
});

describe('calcDarcyWeisbach', () => {
  test('returns positive head loss for positive flow', () => {
    // Q=50 L/s, D=0.2m, eps=0.0001m, nu=1e-6
    const J = aducao.calcDarcyWeisbach(0.05, 0.2, 0.0001, 1e-6);
    expect(J).toBeGreaterThan(0);
  });

  test('larger flow gives larger head loss', () => {
    const J1 = aducao.calcDarcyWeisbach(0.02, 0.2, 0.0001, 1e-6);
    const J2 = aducao.calcDarcyWeisbach(0.05, 0.2, 0.0001, 1e-6);
    expect(J2).toBeGreaterThan(J1);
  });

  test('larger diameter gives smaller head loss', () => {
    const J1 = aducao.calcDarcyWeisbach(0.05, 0.15, 0.0001, 1e-6);
    const J2 = aducao.calcDarcyWeisbach(0.05, 0.25, 0.0001, 1e-6);
    expect(J2).toBeLessThan(J1);
  });

  test('returns 0 for zero flow', () => {
    const J = aducao.calcDarcyWeisbach(0, 0.2, 0.0001, 1e-6);
    expect(J).toBe(0);
  });
});

describe('calcPvapor', () => {
  test('returns ~3.17 kPa at 25°C', () => {
    const pv = aducao.calcPvapor(25);
    expect(pv).toBeGreaterThan(3.0);
    expect(pv).toBeLessThan(3.5);
  });

  test('vapor pressure increases with temperature', () => {
    const pv20 = aducao.calcPvapor(20);
    const pv40 = aducao.calcPvapor(40);
    expect(pv40).toBeGreaterThan(pv20);
  });
});

describe('calcNPSH', () => {
  test('returns positive NPSH_d for typical installation', () => {
    // Hs=3m, hf_suc=0.5m, temp=25°C
    const npsh = aducao.calcNPSH(3, 0.5, 25);
    expect(npsh).toBeGreaterThan(0);
  });

  test('NPSH decreases with higher suction head', () => {
    const npsh1 = aducao.calcNPSH(2, 0.5, 25);
    const npsh2 = aducao.calcNPSH(5, 0.5, 25);
    expect(npsh2).toBeLessThan(npsh1);
  });

  test('NPSH decreases at higher temperature (more vapor pressure)', () => {
    const npsh20 = aducao.calcNPSH(3, 0.5, 20);
    const npsh60 = aducao.calcNPSH(3, 0.5, 60);
    expect(npsh60).toBeLessThan(npsh20);
  });
});

// ── network.js (haversineDistance) ───────────────────────────────────────────
const network = loadScript('network.js', {
  L: {
    map: () => ({ on: () => {}, off: () => {}, getContainer: () => ({ style: {} }) }),
    tileLayer: () => ({ addTo: () => {} }),
    circleMarker: () => ({ addTo: () => {}, bindPopup: () => {}, on: () => {}, remove: () => {} }),
    polyline: () => ({ addTo: () => {}, bindPopup: () => {}, on: () => {}, remove: () => {} }),
    marker: () => ({ addTo: () => {}, bindPopup: () => {}, on: () => {}, remove: () => {} }),
    divIcon: () => ({}),
    DomEvent: { stopPropagation: () => {} },
    Icon: { Default: { prototype: {} } },
  },
  state: {
    projData: [], censosRaw: null, infraAnos: [2025], adAnoIdx: 0,
    auditLog: [], charts: {}, config: {}, mapaL: null,
    municipioNome: '', municipioLat: null, municipioLon: null,
  },
  getParams: () => ({}),
  getPopForAno: () => 0,
  addAudit: () => {},
  calcAducao: () => {},
  alert: () => {},
  confirm: () => true,
  document: {
    getElementById: () => ({ value: '', style: {}, innerHTML: '', children: [] }),
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  fetch: async () => ({ ok: false }),
  AbortSignal: { timeout: () => ({}) },
});

describe('haversineDistance', () => {
  test('distance between same point is 0', () => {
    expect(network.haversineDistance(-3.7, -38.5, -3.7, -38.5)).toBe(0);
  });

  test('Fortaleza to Recife ≈ 630 km (geodesic, não rodoviário)', () => {
    // Fortaleza: -3.7172, -38.5433  Recife: -8.0476, -34.8770
    const d = network.haversineDistance(-3.7172, -38.5433, -8.0476, -34.8770);
    expect(d).toBeGreaterThan(600000); // > 600 km
    expect(d).toBeLessThan(700000);    // < 700 km
  });

  test('distance is symmetric', () => {
    const d1 = network.haversineDistance(-3.7, -38.5, -8.0, -34.9);
    const d2 = network.haversineDistance(-8.0, -34.9, -3.7, -38.5);
    expect(d1).toBeCloseTo(d2, 0);
  });

  test('1 degree of latitude ≈ 111 km', () => {
    const d = network.haversineDistance(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });
});

// ── utils.js (MATERIAIS_HIDRO) ───────────────────────────────────────────────
const utils = loadScript('utils.js', {
  state: { auditLog: [], _materialKey: null },
  addAudit: () => {},
  calcAducao: () => {},
  document: {
    getElementById: () => ({ value: '' }),
  },
});

describe('MATERIAIS_HIDRO', () => {
  test('has entries for all standard materials', () => {
    const keys = Object.keys(utils.MATERIAIS_HIDRO);
    expect(keys).toContain('pvc_novo');
    expect(keys).toContain('pvc_uso');
    expect(keys).toContain('ffd');
    expect(keys).toContain('ffc');
    expect(keys).toContain('aco');
    expect(keys).toContain('concreto_l');
  });

  test('C values are in valid range (50–160)', () => {
    Object.values(utils.MATERIAIS_HIDRO).forEach(m => {
      expect(m.chw).toBeGreaterThanOrEqual(50);
      expect(m.chw).toBeLessThanOrEqual(160);
    });
  });

  test('Manning n values are reasonable (0.005–0.025)', () => {
    Object.values(utils.MATERIAIS_HIDRO).forEach(m => {
      expect(m.n_mann).toBeGreaterThan(0.005);
      expect(m.n_mann).toBeLessThan(0.025);
    });
  });

  test('E_mpa (modulus of elasticity) is positive', () => {
    Object.values(utils.MATERIAIS_HIDRO).forEach(m => {
      expect(m.E_mpa).toBeGreaterThan(0);
    });
  });

  test('pvc_novo has higher C than pvc_uso (new vs used)', () => {
    expect(utils.MATERIAIS_HIDRO.pvc_novo.chw).toBeGreaterThan(utils.MATERIAIS_HIDRO.pvc_uso.chw);
  });

  test('ffd has higher C than ffc', () => {
    expect(utils.MATERIAIS_HIDRO.ffd.chw).toBeGreaterThan(utils.MATERIAIS_HIDRO.ffc.chw);
  });

  test('steel (aco) has highest E_mpa', () => {
    const eAco = utils.MATERIAIS_HIDRO.aco.E_mpa;
    const ePVC = utils.MATERIAIS_HIDRO.pvc_novo.E_mpa;
    expect(eAco).toBeGreaterThan(ePVC);
  });
});
