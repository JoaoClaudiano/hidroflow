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
  test('P = 1000 hab (P_mil = 1): K = (18+1)/(4+1) = 3.8', () => {
    expect(infra.harmonPeakFactor(1000)).toBeCloseTo(3.8, 4);
  });

  test('P = 10000 hab (P_mil = 10): K ≈ 2.95', () => {
    // (18 + √10) / (4 + √10) = (18+3.162)/(4+3.162) ≈ 2.953
    const k = infra.harmonPeakFactor(10000);
    expect(k).toBeGreaterThan(2.7);
    expect(k).toBeLessThan(3.2);
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

// ── autoParshallIdx (infra.js) ─────────────────────────────────────────────────
describe('autoParshallIdx — seleção automática de garganta Parshall', () => {
  test('Q = 30 L/s: garganta 9" (idx 2) é adequada', () => {
    const idx = infra.autoParshallIdx(30);
    // Para 30 L/s, a garganta 9" (K=0.1225) dá H_a ≈ 0.37 m → dentro da faixa
    expect(idx).toBeLessThanOrEqual(2);
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  test('Q = 208 L/s: garganta sugerida mantém H_a ≤ 0,75 m', () => {
    const idx = infra.autoParshallIdx(208);
    expect(idx).toBeGreaterThanOrEqual(0); // existe uma garganta adequada
    const r = infra.calcParshall(208, idx);
    expect(r.in_range).toBe(true);
  });

  test('Q muito pequena (1 L/s): menor garganta (3") é suficiente', () => {
    const idx = infra.autoParshallIdx(1);
    const r = infra.calcParshall(1, idx);
    expect(r.in_range).toBe(true);
  });

  test('garganta retornada é a menor adequada para Q = 208 L/s', () => {
    const idx = infra.autoParshallIdx(208);
    // Todas as gargantas menores devem estar fora da faixa para 208 L/s
    for (let i = 0; i < idx; i++) {
      const r = infra.calcParshall(208, i);
      expect(r.in_range).toBe(false);
    }
  });
});

// ── calcPotBombeamento (infra.js) ─────────────────────────────────────────────
describe('calcPotBombeamento — potencia de bombeamento', () => {
  // Pot (CV) = (1000 * Q_m3s * H_man) / (75 * eta)
  // Q_m3s = Q_ls / 1000
  test('100 L/s, H=30m, eta=0.65: Pot_cv ≈ 61.5 CV', () => {
    const r = infra.calcPotBombeamento(100, 30, 0.65, 16);
    // (1000 * 0.1 * 30) / (75 * 0.65) = 3000 / 48.75 ≈ 61.54
    expect(r.pot_cv).toBeCloseTo(61.54, 1);
  });

  test('pot_kw = pot_cv * 0.7355', () => {
    const r = infra.calcPotBombeamento(100, 30, 0.65, 16);
    expect(r.pot_kw).toBeCloseTo(r.pot_cv * 0.7355, 4);
  });

  test('en_mwh_ano = pot_kw * N_horas * 365 / 1000', () => {
    const N = 16;
    const r = infra.calcPotBombeamento(100, 30, 0.65, N);
    expect(r.en_mwh_ano).toBeCloseTo(r.pot_kw * N * 365 / 1000, 4);
  });

  test('N_horas padrao 16 quando nao informado', () => {
    const r = infra.calcPotBombeamento(100, 30, 0.65, undefined);
    expect(r.N_horas).toBe(16);
  });

  test('eta padrao 0.65 quando nao informado', () => {
    const r1 = infra.calcPotBombeamento(100, 30, undefined, 16);
    const r2 = infra.calcPotBombeamento(100, 30, 0.65, 16);
    expect(r1.pot_cv).toBeCloseTo(r2.pot_cv, 4);
  });

  test('maior H_man aumenta potencia proporcionalmente', () => {
    const r20 = infra.calcPotBombeamento(100, 20, 0.65, 16);
    const r40 = infra.calcPotBombeamento(100, 40, 0.65, 16);
    expect(r40.pot_cv).toBeCloseTo(r20.pot_cv * 2, 4);
  });

  test('Q zero resulta em pot_cv zero', () => {
    const r = infra.calcPotBombeamento(0, 30, 0.65, 16);
    expect(r.pot_cv).toBe(0);
  });
});

// ── calcInfra — reservatório NBR 12217 e QesgK1K2 ────────────────────────────
describe('calcInfra — volume de reservatório e SES hora de ponta', () => {
  const p = {
    agua: 150, ret: 0.8, res: 0.5, en: 100,
    K1: 1.2, K2: 1.5, K3: 0.5,
    extra1Nome: '', extra1Val: 0,
    custom: false, useHarmon: false,
  };

  test('reservatório: V_reg = (1/3) × Q·K1 × 86400 (NBR 12217)', () => {
    const pop = 120000;
    const Qmed = pop * p.agua / 86400; // L/s
    const expected = Qmed * p.K1 * 86400 / (3 * 1000); // m³
    const v = infra.calcInfra(pop, p);
    expect(v.vol_res_m3).toBeCloseTo(expected, 3);
  });

  test('reservatório 120k hab: V_reg ≈ 7200 m³ (NBR 12217)', () => {
    const v = infra.calcInfra(120000, p);
    // (1/3) × 0.25 m³/s × 86400 = 7200 m³
    expect(v.vol_res_m3).toBeCloseTo(7200, 0);
  });

  test('QesgK1K2 não-Harmon = Qesg × K1 × K2', () => {
    const pop = 120000;
    const v = infra.calcInfra(pop, p);
    const expected = v.Qesg * p.K1 * p.K2;
    expect(v.QesgK1K2).toBeCloseTo(expected, 3);
  });

  test('QesgK1K2 Harmon = QesgK1 (Harmon já inclui pico horário)', () => {
    const pHarmon = { ...p, useHarmon: true };
    const v = infra.calcInfra(120000, pHarmon);
    expect(v.QesgK1K2).toBeCloseTo(v.QesgK1, 6);
  });

  test('QesgK1K2 > QesgK1 quando não usa Harmon e K2 > 1', () => {
    const v = infra.calcInfra(120000, p);
    expect(v.QesgK1K2).toBeGreaterThan(v.QesgK1);
  });
});
