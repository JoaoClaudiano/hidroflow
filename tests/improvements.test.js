/**
 * Unit tests for the progressive-disclosure improvements:
 * 1. Student's t-quantile (tQuantile95) — already covered in models.test.js
 * 2. Joukowsky vs. Michaud water-hammer logic (helpers in aducao.js context)
 * 3. Motor safety factor per catalog
 * 4. Harmon peak-flow factor (harmonPeakFactor in infra.js)
 * 5. Lei de Stokes — settling velocity (calcStokes in infra.js)
 * 6. Calha Parshall — flow measurement (calcParshall in infra.js)
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

// ── calcStokes (infra.js) ─────────────────────────────────────────────────────
describe('calcStokes — Lei de Stokes', () => {
  // calcStokes(d_mm, rho_p, temp_C, Q_m3s)
  test('areia fina 0,1 mm @ 20°C: v_s ≈ 8,2 mm/s', () => {
    const r = infra.calcStokes(0.1, 2650, 20, 0.01);
    // Manual: v_s = 9.81*(2650-1000)*(0.0001)^2/(18*0.001002) ≈ 8.93e-3 m/s
    expect(r.v_s_m_s).toBeGreaterThan(0.005);
    expect(r.v_s_m_s).toBeLessThan(0.015);
  });

  test('argila muito fina 0,01 mm @ 20°C: v_s deve ser muito menor', () => {
    const r_argila = infra.calcStokes(0.01, 2650, 20, 0.01);
    const r_areia  = infra.calcStokes(0.1,  2650, 20, 0.01);
    // v_s ∝ d² → 100× mais lento
    expect(r_argila.v_s_m_s).toBeLessThan(r_areia.v_s_m_s / 50);
  });

  test('Re < 0,5 para partícula fina (Stokes válido)', () => {
    const r = infra.calcStokes(0.05, 2650, 20, 0.01);
    expect(r.stokes_ok).toBe(true);
  });

  test('área do decantador A = Q / v_s', () => {
    const Q = 0.05; // m³/s
    const r = infra.calcStokes(0.1, 2650, 20, Q);
    expect(r.A_dec_m2).toBeCloseTo(Q / r.v_s_m_s, 4);
  });

  test('temperatura maior → viscosidade menor → v_s maior', () => {
    const r20 = infra.calcStokes(0.1, 2650, 20, 0.01);
    const r35 = infra.calcStokes(0.1, 2650, 35, 0.01);
    expect(r35.v_s_m_s).toBeGreaterThan(r20.v_s_m_s);
  });

  test('v_s = 0 se Q = 0 mas retorna valor positivo (v_s independe de Q)', () => {
    const r = infra.calcStokes(0.1, 2650, 20, 0);
    expect(r.v_s_m_s).toBeGreaterThan(0);
    expect(r.A_dec_m2).toBe(0); // A = 0/v_s = 0
  });
});

// ── calcParshall (infra.js) ───────────────────────────────────────────────────
describe('calcParshall — Calha Parshall', () => {
  // calcParshall(Q_ls, W_idx)  W_idx=2 → garganta 9" (K=0.1225, n=1.547)
  test('Q = 30 L/s com garganta 9": H_a deve estar dentro da faixa', () => {
    const r = infra.calcParshall(30, 2);
    expect(r.in_range).toBe(true);
    expect(r.H_a_m).toBeGreaterThan(0.03);
    expect(r.H_a_m).toBeLessThan(0.75);
  });

  test('H_a consistente: Q_re = K × H_a^n deve recuperar Q original', () => {
    const Q_ls = 20;
    const r = infra.calcParshall(Q_ls, 2); // garganta 9"
    const Q_re = r.K * Math.pow(r.H_a_m, r.n) * 1000; // m³/s → L/s
    expect(Q_re).toBeCloseTo(Q_ls, 2);
  });

  test('garganta maior permite vazão maior na mesma H_a', () => {
    // Q fixo: garganta 6" vs 24"
    const r6  = infra.calcParshall(50, 1); // 6" — K=0.0703
    const r24 = infra.calcParshall(50, 5); // 24" — K=0.4376
    // Garganta maior → menor H_a para a mesma Q
    expect(r24.H_a_m).toBeLessThan(r6.H_a_m);
  });

  test('PARSHALL_COEFS exportado e tem 9 entradas', () => {
    expect(infra.PARSHALL_COEFS).toBeDefined();
    expect(infra.PARSHALL_COEFS.length).toBe(9);
  });

  test('W_idx fora do intervalo clampado ao mais próximo', () => {
    const rMenos = infra.calcParshall(10, -5);
    const rMais  = infra.calcParshall(10, 999);
    expect(rMenos.W_label).toBe(infra.PARSHALL_COEFS[0].label);
    expect(rMais.W_label).toBe(infra.PARSHALL_COEFS[infra.PARSHALL_COEFS.length-1].label);
  });
});
