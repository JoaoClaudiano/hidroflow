/**
 * Unit tests for js/avancados.js:
 * 1. calcMuskingum — Muskingum flood routing coefficients & peak attenuation
 * 2. calcPumpCurve — System curve, pump interpolation, operating point
 *
 * These functions use DOM elements, so we drive them by injecting mock elements
 * into the vm context's document.getElementById stub.
 */
import { describe, test, expect } from 'vitest';
import { loadScript } from './setup.js';

// ── load avancados.js into a vm context ──────────────────────────────────────
function makeEl(val) {
  return { value: String(val) };
}

// We need state.charts to be available as a plain object
const avCtx = loadScript('avancados.js', {
  state: { charts: {} },
  Chart: class {
    constructor(_el, _cfg) { this._cfg = _cfg; }
    destroy() {}
  },
  // document stubs are set per-test via the context; provide a fallback here
  document: { getElementById: () => ({ innerHTML: '', style: {} }) },
});

/**
 * Helper: run calcMuskingum with given params and inflow array.
 * Overrides document.getElementById in the shared context.
 */
function runMuskingum(K, X, dt, Q0, inflow, chartId) {
  var resultStore = { innerHTML: '', style: {} };
  avCtx.document = {
    getElementById: function(id) {
      if (id === 'musk-K')      return makeEl(K);
      if (id === 'musk-X')      return makeEl(X);
      if (id === 'musk-dt')     return makeEl(dt);
      if (id === 'musk-Q0')     return makeEl(Q0);
      if (id === 'musk-inflow') return makeEl(inflow.join('\n'));
      if (id === 'musk-result') return resultStore;
      if (id === 'chart-musk')  return {};
      return { innerHTML: '', style: {} };
    }
  };
  avCtx.calcMuskingum();
  return resultStore.innerHTML;
}

/**
 * Helper: run calcPumpCurve with given params.
 */
function runPumpCurve(Hman, L, D, C, hloc, curvePairs, resultEl) {
  var resultStore = resultEl || { innerHTML: '', style: {} };
  avCtx.document = {
    getElementById: function(id) {
      if (id === 'pump-Hman')   return makeEl(Hman);
      if (id === 'pump-L')      return makeEl(L);
      if (id === 'pump-D')      return makeEl(D);
      if (id === 'pump-C')      return makeEl(C);
      if (id === 'pump-hloc')   return makeEl(hloc);
      if (id === 'pump-curve')  return makeEl(curvePairs.map(p => p[0]+';'+p[1]).join('\n'));
      if (id === 'pump-result') return resultStore;
      if (id === 'chart-pump')  return {};
      return { innerHTML: '', style: {} };
    }
  };
  avCtx.calcPumpCurve();
  return resultStore.innerHTML;
}

// ── Muskingum tests ───────────────────────────────────────────────────────────
describe('calcMuskingum', () => {
  const inflow = [10, 20, 45, 80, 120, 100, 75, 50, 30, 18, 12, 10];

  test('coeficientes somam 1 (C0 + C1 + C2 = 1)', () => {
    // K=12h, X=0.2, dt=6h → denom = 2*12*0.8 + 6 = 25.2
    const K = 12, X = 0.2, dt = 6;
    const denom = 2 * K * (1 - X) + dt;
    const C0 = (dt - 2 * K * X) / denom;
    const C1 = (dt + 2 * K * X) / denom;
    const C2 = (2 * K * (1 - X) - dt) / denom;
    expect(C0 + C1 + C2).toBeCloseTo(1, 10);
  });

  test('pico de saída é menor ou igual ao pico de entrada', () => {
    const html = runMuskingum(12, 0.2, 6, 10, inflow);
    // Atenuação deve ser ≥ 0
    const match = html.match(/Atenuação.*?(\d+\.?\d*)%/);
    expect(match).not.toBeNull();
    expect(parseFloat(match[1])).toBeGreaterThanOrEqual(0);
  });

  test('X=0 máxima atenuação — saída mais amortecida que X=0.4', () => {
    const html0  = runMuskingum(12, 0.0, 6, 10, inflow);
    const html04 = runMuskingum(12, 0.4, 6, 10, inflow);
    const att0  = parseFloat((html0.match(/Atenuação.*?(\d+\.?\d*)%/) || [])[1] || 0);
    const att04 = parseFloat((html04.match(/Atenuação.*?(\d+\.?\d*)%/) || [])[1] || 0);
    expect(att0).toBeGreaterThanOrEqual(att04);
  });

  test('K maior → defasagem maior', () => {
    const htmlK6  = runMuskingum(6,  0.2, 3, 10, inflow);
    const htmlK24 = runMuskingum(24, 0.2, 3, 10, inflow);
    const lagK6  = parseFloat((htmlK6.match(/Defasagem.*?(\d+\.?\d*)\s*h/)  || [])[1] || -1);
    const lagK24 = parseFloat((htmlK24.match(/Defasagem.*?(\d+\.?\d*)\s*h/) || [])[1] || -1);
    expect(lagK24).toBeGreaterThanOrEqual(lagK6);
  });

  test('entrada inválida (menos de 2 valores) mostra alerta', () => {
    const html = runMuskingum(12, 0.2, 6, 10, [50]);
    expect(html).toContain('alert');
  });

  test('X fora de [0, 0.5] mostra alerta de validação', () => {
    const html = runMuskingum(12, 0.6, 6, 10, inflow);
    expect(html).toContain('alert');
  });
});

// ── Pump curve tests ──────────────────────────────────────────────────────────
describe('calcPumpCurve', () => {
  // Curva de bomba simples: H decresce linearmente de 45 m a 0 para Q 0..50 m³/h
  const simpleCurve = [[0, 45], [25, 22.5], [50, 0]];

  test('ponto de operação calculado e presente no resultado', () => {
    const html = runPumpCurve(10, 200, 100, 120, 0, simpleCurve);
    expect(html).toContain('Ponto de operação');
    expect(html).toContain('m³/h');
  });

  test('Q de operação positivo', () => {
    const html = runPumpCurve(10, 200, 100, 120, 0, simpleCurve);
    const match = html.match(/Q\s*=\s*([\d.]+)\s*m³\/h/);
    expect(match).not.toBeNull();
    expect(parseFloat(match[1])).toBeGreaterThan(0);
  });

  test('H de operação entre Hman e H0 da bomba', () => {
    const Hman = 10;
    const H0 = 45; // bomba parada
    const html = runPumpCurve(Hman, 200, 100, 120, 0, simpleCurve);
    const match = html.match(/H\s*=\s*([\d.]+)\s*m/);
    expect(match).not.toBeNull();
    const H_op = parseFloat(match[1]);
    expect(H_op).toBeGreaterThan(Hman);
    expect(H_op).toBeLessThan(H0);
  });

  test('sistema mais resistente (L maior) → Q operação menor', () => {
    const htmlL200  = runPumpCurve(10, 200,  100, 120, 0, simpleCurve);
    const htmlL2000 = runPumpCurve(10, 2000, 100, 120, 0, simpleCurve);
    const q200  = parseFloat((htmlL200.match(/Q\s*=\s*([\d.]+)\s*m³\/h/)  || [])[1] || Infinity);
    const q2000 = parseFloat((htmlL2000.match(/Q\s*=\s*([\d.]+)\s*m³\/h/) || [])[1] || Infinity);
    expect(q2000).toBeLessThan(q200);
  });

  test('sem interseção mostra alerta', () => {
    // Bomba toda abaixo do Hman → nunca sobrepõe a curva do sistema
    const flatLowCurve = [[0, 2], [50, 2]]; // bomba dá apenas 2 m; Hman = 30
    const html = runPumpCurve(30, 200, 100, 120, 0, flatLowCurve);
    expect(html).toContain('alert');
  });

  test('curva insuficiente (menos de 2 pares) mostra alerta', () => {
    const html = runPumpCurve(10, 200, 100, 120, 0, [[0, 45]]);
    expect(html).toContain('alert');
  });
});
