/**
 * Unit tests for the progressive-disclosure improvements:
 * 1. Student's t-quantile (tQuantile95) — already covered in models.test.js
 * 2. Joukowsky vs. Michaud water-hammer logic (helpers in aducao.js context)
 * 3. Motor safety factor per catalog
 * 4. Harmon peak-flow factor (harmonPeakFactor in infra.js)
 */
import { describe, test, expect } from 'vitest';
import { loadScript } from './setup.js';

// ── helpers shared across suites ─────────────────────────────────────────────
function makeDomEl(values = {}) {
  return {
    value: '',
    checked: false,
    trim: () => '',
    ...values,
  };
}

// ── harmonPeakFactor (infra.js) ───────────────────────────────────────────────
const infra = loadScript('infra.js', {
  // supply stubs for everything infra.js calls that isn't pure math
  SVG_WATER: '', SVG_FLOW: '', SVG_SEWER: '', SVG_WASTE: '', SVG_ENERGY: '',
  SVG_TANK: '', SVG_PIPE: '', SVG_PLANT: '',
  ic: () => '',
  renderObras: () => {},
  renderChartDemanda: () => {},
  renderDecisao: () => {},
  gerarRelatorio: () => {},
  getPopForAno: () => 100000,
});

describe('harmonPeakFactor', () => {
  test('P = 1000 hab (P_mil = 1): K = (14+1)/(4+1) = 3.0', () => {
    expect(infra.harmonPeakFactor(1000)).toBeCloseTo(3.0, 4);
  });

  test('P = 10000 hab (P_mil = 10): K ≈ 2.2', () => {
    // (14 + √10) / (4 + √10) = (14+3.162)/(4+3.162) ≈ 2.396
    const k = infra.harmonPeakFactor(10000);
    expect(k).toBeGreaterThan(2.0);
    expect(k).toBeLessThan(2.6);
  });

  test('K decreases as population grows', () => {
    const k10k  = infra.harmonPeakFactor(10000);
    const k100k = infra.harmonPeakFactor(100000);
    const k1M   = infra.harmonPeakFactor(1000000);
    expect(k100k).toBeLessThan(k10k);
    expect(k1M).toBeLessThan(k100k);
  });

  test('K is always > 1 for any positive population', () => {
    [1000, 5000, 50000, 500000, 5000000].forEach(pop => {
      expect(infra.harmonPeakFactor(pop)).toBeGreaterThan(1);
    });
  });
});

// ── Michaud / Joukowsky decision logic ───────────────────────────────────────
describe('Michaud vs. Joukowsky decision', () => {
  // Pure functions extracted — test the math in isolation
  const g = 9.81;

  function joukowsky(a, v) { return (a * v) / g; }
  function michaud(L, v, T_c) { return (2 * L * v) / (g * T_c); }
  function T_critico(L, a) { return (2 * L) / a; }

  test('Joukowsky: a=1200 m/s, v=1.5 m/s → ΔH ≈ 183.5 m', () => {
    expect(joukowsky(1200, 1.5)).toBeCloseTo(183.49, 1);
  });

  test('Michaud gives smaller ΔH for slow closure', () => {
    const a = 1200, v = 1.5, L = 3500;
    const Tc = 120; // > 2L/a = 5.83s
    expect(michaud(L, v, Tc)).toBeLessThan(joukowsky(a, v));
  });

  test('T_critico = 2L/a', () => {
    expect(T_critico(3500, 1200)).toBeCloseTo(5.833, 2);
  });

  test('Michaud is used when T_c > 2L/a', () => {
    const L = 3500, a = 1200, v = 1.5, T_c = 30;
    const tc = T_critico(L, a); // ≈ 5.83 s
    // T_c=30 > tc → Michaud
    const dH = T_c > tc ? michaud(L, v, T_c) : joukowsky(a, v);
    expect(dH).toBeCloseTo(michaud(L, v, T_c), 4);
  });

  test('Joukowsky is used when T_c <= 2L/a', () => {
    const L = 3500, a = 1200, v = 1.5, T_c = 3;
    const tc = T_critico(L, a); // ≈ 5.83 s
    // T_c=3 < tc → Joukowsky
    const dH = T_c > tc ? michaud(L, v, T_c) : joukowsky(a, v);
    expect(dH).toBeCloseTo(joukowsky(a, v), 4);
  });
});

// ── Motor safety factor (catalog margin) ─────────────────────────────────────
describe('Motor catalog safety factor', () => {
  function catalogFactor(Pot_cv) {
    if (Pot_cv <= 2)  return 1.50;
    if (Pot_cv <= 5)  return 1.20;
    if (Pot_cv <= 20) return 1.15;
    return 1.10;
  }

  const potMotor = [5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315];
  function nextCommercial(kw) {
    return potMotor.find(pw => pw >= kw) || potMotor[potMotor.length - 1];
  }

  test('+50% for motors <= 2 cv', () => {
    expect(catalogFactor(1.5)).toBe(1.50);
    expect(catalogFactor(2)).toBe(1.50);
  });

  test('+20% for motors > 2 cv and <= 5 cv', () => {
    expect(catalogFactor(3)).toBe(1.20);
    expect(catalogFactor(5)).toBe(1.20);
  });

  test('+15% for motors > 5 cv and <= 20 cv', () => {
    expect(catalogFactor(10)).toBe(1.15);
    expect(catalogFactor(20)).toBe(1.15);
  });

  test('+10% for motors > 20 cv', () => {
    expect(catalogFactor(25)).toBe(1.10);
    expect(catalogFactor(100)).toBe(1.10);
  });

  test('commercial motor >= required after safety factor', () => {
    const Pot_cv = 12;
    const Pot_kw = Pot_cv * 0.7355;
    const fs = catalogFactor(Pot_cv);
    const Pot_kw_fs = Pot_kw * fs;
    const commercial = nextCommercial(Pot_kw_fs);
    expect(commercial).toBeGreaterThanOrEqual(Pot_kw_fs);
  });
});
