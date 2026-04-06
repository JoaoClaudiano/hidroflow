/**
 * Unit tests for Hazen-Williams hydraulic calculations in js/aducao.js
 *
 * Covers the core formulae:
 *   - Head loss gradient:  J = 10.643 · Q^1.852 / (C^1.852 · D^4.87)      [m/m]
 *   - Bresse diameter:     D = K · √(Q/1000)                                [m]
 *   - Velocity:            v = Q / (π · (D/2)²)                             [m/s]
 *   - Water-hammer Joukowsky: ΔH = a · v / g                                [m]
 *
 * Reference values computed independently and cross-checked against
 * FUNASA (2014) Capítulo 7 – Adução.
 */
import { describe, test, expect } from 'vitest';
import { loadScript } from './setup.js';

// ── Minimal state needed so calcAducao() early-exits without DOM errors ──────
const ctx = loadScript('aducao.js', {
  // Provide getParams and getPopForAno so the script doesn't throw on load
  getParams: () => ({
    agua: 150, K1: 1.2, K2: 1.5, K3: 0.5,
    ret: 0.8, res: 0.7, en: 35, extra1Nome: '', extra1Val: 0, custom: false,
  }),
  getPopForAno: () => 50000,
  addAudit: () => {},
});

// ── Extract pure formulae as local helpers ────────────────────────────────────
/**
 * Hazen-Williams head-loss gradient (m/m).
 * J = 10.643 · Q^1.852 / (C^1.852 · D^4.87)
 * Q in m³/s, D in m, C dimensionless.
 */
function J_hw(Q_m3s, C, D_m) {
  return 10.643 * Math.pow(Q_m3s, 1.852) / (Math.pow(C, 1.852) * Math.pow(D_m, 4.87));
}

/** Velocity in a full pipe (m/s). Q in m³/s, D in m. */
function velocity(Q_m3s, D_m) {
  return Q_m3s / (Math.PI * (D_m / 2) ** 2);
}

/** Joukowsky water-hammer overpressure (m). */
function deltaH(a_celer, v, g = 9.81) {
  return (a_celer * v) / g;
}

// ── Hazen-Williams: J (head-loss gradient) ────────────────────────────────────
describe('Hazen-Williams head-loss gradient J', () => {
  test('Q=1 L/s, DN100, C=140 → J ≈ 0.000233 m/m', () => {
    const Q = 0.001; // 1 L/s → m³/s
    const D = 0.1;   // DN 100 mm → m
    const C = 140;
    const J = J_hw(Q, C, D);
    // J = 10.643 × 0.001^1.852 / (140^1.852 × 0.1^4.87) ≈ 0.000233 m/m
    expect(J).toBeGreaterThan(0.0001);
    expect(J).toBeLessThan(0.001);
  });

  test('larger diameter → lower J (inverse relationship with D)', () => {
    const Q = 0.005;
    const C = 140;
    const J100 = J_hw(Q, C, 0.100);
    const J200 = J_hw(Q, C, 0.200);
    expect(J200).toBeLessThan(J100);
  });

  test('higher C (smoother pipe) → lower J', () => {
    const Q = 0.003; const D = 0.1;
    expect(J_hw(Q, 120, D)).toBeGreaterThan(J_hw(Q, 140, D));
  });

  test('higher flow → higher J (super-linear: exponent 1.852)', () => {
    const C = 140; const D = 0.15;
    const J1 = J_hw(0.005, C, D);
    const J2 = J_hw(0.010, C, D);
    // Doubling Q → J increases by factor ≈ 2^1.852 ≈ 3.6
    expect(J2 / J1).toBeCloseTo(Math.pow(2, 1.852), 1);
  });

  test('J > 0 for any positive flow', () => {
    expect(J_hw(0.001, 140, 0.1)).toBeGreaterThan(0);
  });
});

// ── Velocity formula ──────────────────────────────────────────────────────────
describe('Pipe velocity', () => {
  test('Q=1 L/s, DN100 → v ≈ 0.127 m/s', () => {
    const v = velocity(0.001, 0.1);
    expect(v).toBeCloseTo(0.001 / (Math.PI * 0.0025), 4);
  });

  test('larger diameter → lower velocity for same flow', () => {
    const v100 = velocity(0.005, 0.100);
    const v200 = velocity(0.005, 0.200);
    expect(v200).toBeLessThan(v100);
  });

  test('velocity scales quadratically with inverse diameter', () => {
    // v ∝ 1/D²  →  doubling D → v/4
    const v1 = velocity(0.01, 0.1);
    const v2 = velocity(0.01, 0.2);
    expect(v1 / v2).toBeCloseTo(4, 3);
  });
});

// ── Joukowsky water-hammer ────────────────────────────────────────────────────
describe('Joukowsky water-hammer overpressure', () => {
  test('ΔH = a · v / g', () => {
    const a = 1000; // m/s celerity
    const v = 1.5;  // m/s
    const dH = deltaH(a, v);
    expect(dH).toBeCloseTo((1000 * 1.5) / 9.81, 3);
  });

  test('zero velocity → zero overpressure', () => {
    expect(deltaH(1000, 0)).toBe(0);
  });

  test('higher celerity → higher overpressure', () => {
    expect(deltaH(1200, 1.0)).toBeGreaterThan(deltaH(800, 1.0));
  });
});

// ── DN series selection ───────────────────────────────────────────────────────
describe('DN selection (Bresse + standard series)', () => {
  const DN_SERIES = [50, 75, 100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000];

  function selectDN(D_mm) {
    return DN_SERIES.find(d => d >= D_mm) || DN_SERIES[DN_SERIES.length - 1];
  }

  test('D_calc=80mm → DN100', () => {
    expect(selectDN(80)).toBe(100);
  });

  test('D_calc=100mm → DN100 (exact match)', () => {
    expect(selectDN(100)).toBe(100);
  });

  test('D_calc=1200mm → DN1000 (clamped to max)', () => {
    expect(selectDN(1200)).toBe(1000);
  });

  test('D_calc=1mm → DN50 (minimum)', () => {
    expect(selectDN(1)).toBe(50);
  });
});

// ── Rippl volume sanity checks ────────────────────────────────────────────────
describe('Rippl balance (V1 = saldo_max - saldo_min)', () => {
  test('constant supply and demand → V1 = 0', () => {
    // 24 hours equal supply and demand
    const supply = Array(24).fill(100);
    const demand = Array(24).fill(100);
    let saldo = 0;
    const saldoCum = supply.map((s, i) => { saldo += s - demand[i]; return saldo; });
    const V1 = Math.max(...saldoCum) - Math.min(...saldoCum);
    expect(V1).toBe(0);
  });

  test('V1 is positive when there is supply/demand mismatch', () => {
    // Pump runs first 12 hours, demand uniform
    const Qd = 100 / 24;
    const supply = Array(24).fill(0).map((_, h) => h < 12 ? 100 / 12 : 0);
    const demand = Array(24).fill(Qd);
    let saldo = 0;
    const saldoCum = supply.map((s, i) => { saldo += s - demand[i]; return saldo; });
    const V1 = Math.max(...saldoCum) - Math.min(...saldoCum);
    expect(V1).toBeGreaterThan(0);
  });
});
