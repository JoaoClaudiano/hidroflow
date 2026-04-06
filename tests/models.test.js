/**
 * Unit tests for statistical model functions in js/models.js
 *
 * Covers: calcR2, calcRMSE, calcCI, calcLOO, holtFit / holtProject,
 *         calcGeoLogLinear, calcCompositeScore, confiabilidadeLabel
 */
import { describe, test, expect } from 'vitest';
import { loadScript } from './setup.js';

const m = loadScript('models.js');

// ── calcR2 ────────────────────────────────────────────────────────────────────
describe('calcR2', () => {
  test('perfect fit returns 1', () => {
    expect(m.calcR2([10, 20, 30], [10, 20, 30])).toBe(1);
  });

  test('constant actual array (zero variance) returns 1', () => {
    // When all actual values are equal, ss_tot = 0 → defined as 1
    expect(m.calcR2([5, 5, 5], [5, 5, 5])).toBe(1);
  });

  test('prediction equal to mean returns 0', () => {
    const y = [10, 20, 30]; // mean = 20
    expect(m.calcR2(y, [20, 20, 20])).toBe(0);
  });

  test('negative R² is clamped to 0', () => {
    // Very bad prediction should return 0 (not negative)
    const r = m.calcR2([10, 20, 30], [30, 10, 20]);
    expect(r).toBeGreaterThanOrEqual(0);
  });

  test('single element returns 1', () => {
    expect(m.calcR2([42], [42])).toBe(1);
  });
});

// ── calcRMSE ──────────────────────────────────────────────────────────────────
describe('calcRMSE', () => {
  test('perfect fit returns 0', () => {
    expect(m.calcRMSE([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  test('known values: errors of [1, -1, 1] → RMSE = 1', () => {
    const rmse = m.calcRMSE([10, 20, 30], [11, 19, 31]);
    expect(rmse).toBeCloseTo(1, 5);
  });

  test('asymmetric errors', () => {
    // errors: [0, 3, 4] → SSE = 0 + 9 + 16 = 25 → RMSE = sqrt(25/3) ≈ 2.887
    const rmse = m.calcRMSE([0, 0, 0], [0, 3, 4]);
    expect(rmse).toBeCloseTo(Math.sqrt(25 / 3), 5);
  });
});

// ── tQuantile95 & calcCI ──────────────────────────────────────────────────────
describe('tQuantile95', () => {
  test('df >= 30 returns z = 1.96', () => {
    expect(m.tQuantile95(32)).toBe(1.96); // n=32 → df=30
  });

  test('n = 30 (df=28) returns t-value > 1.96', () => {
    const t = m.tQuantile95(30);
    expect(t).toBeGreaterThan(1.96);
  });

  test('n = 4 (df=2) returns ~4.303', () => {
    expect(m.tQuantile95(4)).toBeCloseTo(4.303, 2);
  });

  test('n = 3 (df=1) returns ~12.706', () => {
    expect(m.tQuantile95(3)).toBeCloseTo(12.706, 2);
  });

  test('n <= 2 (df clamped to 1) returns ~12.706', () => {
    expect(m.tQuantile95(2)).toBeCloseTo(12.706, 2);
  });
});

describe('calcCI', () => {
  test('n >= 32 (df=30) uses z = 1.96', () => {
    const ci = m.calcCI(1000, 50, 1, 32);
    expect(ci.margin).toBeCloseTo(1.96 * 50, 1);
    expect(ci.z).toBeCloseTo(1.96, 2);
    expect(ci.upper).toBe(Math.round(1000 + ci.margin));
    expect(ci.lower).toBe(Math.round(1000 - ci.margin));
  });

  test('n = 4 uses t-distribution (wider margin than z=1.96)', () => {
    const ciNormal = m.calcCI(1000, 50, 1, 32);
    const ciSmall  = m.calcCI(1000, 50, 1, 4);
    expect(ciSmall.margin).toBeGreaterThan(ciNormal.margin);
  });

  test('n omitted defaults to large sample (z = 1.96)', () => {
    const ci = m.calcCI(1000, 50, 1);
    expect(ci.z).toBeCloseTo(1.96, 2);
  });

  test('margin grows with extrapolation distance', () => {
    const ci1 = m.calcCI(1000, 50, 1, 32);
    const ci9 = m.calcCI(1000, 50, 9, 32);
    expect(ci9.margin).toBeGreaterThan(ci1.margin);
  });

  test('zero RMSE gives zero margin', () => {
    const ci = m.calcCI(5000, 0, 10, 32);
    expect(ci.margin).toBe(0);
    expect(ci.lower).toBe(5000);
    expect(ci.upper).toBe(5000);
  });
});

// ── calcLOO ───────────────────────────────────────────────────────────────────
describe('calcLOO', () => {
  test('returns null when fewer than 3 data points', () => {
    expect(m.calcLOO([2000, 2010], [100, 110], () => 0)).toBeNull();
  });

  test('returns a non-negative number for 4 data points', () => {
    const anos = [1991, 2000, 2010, 2022];
    const pops = [50000, 60000, 72000, 85000];
    // linear model for LOO
    const linearFn = (at, pt, ao) => {
      const n = at.length;
      let sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (let i = 0; i < n; i++) {
        sx += at[i]; sy += pt[i]; sxx += at[i] * at[i]; sxy += at[i] * pt[i];
      }
      const den = n * sxx - sx * sx;
      const k = den !== 0 ? (n * sxy - sx * sy) / den : 0;
      const b = sy / n - k * (sx / n);
      return b + k * ao;
    };
    const loo = m.calcLOO(anos, pops, linearFn);
    expect(loo).not.toBeNull();
    expect(loo).toBeGreaterThanOrEqual(0);
  });

  test('perfect predictor → LOO near 0', () => {
    const anos = [2000, 2010, 2020, 2030];
    const pops = [100, 200, 300, 400]; // perfect linear
    const perfectFn = (at, pt, ao) => {
      // linear extrapolation from the subsample
      const slope = (pt[pt.length - 1] - pt[0]) / (at[at.length - 1] - at[0]);
      return pt[pt.length - 1] + slope * (ao - at[at.length - 1]);
    };
    const loo = m.calcLOO(anos, pops, perfectFn);
    expect(loo).not.toBeNull();
    expect(loo).toBeCloseTo(0, 1);
  });
});

// ── holtFit / holtProject ─────────────────────────────────────────────────────
describe('holtFit', () => {
  const pops = [78420, 95310, 108760, 127500];
  const anos = [1991, 2000, 2010, 2022];

  test('returns expected shape', () => {
    const result = m.holtFit(pops, anos);
    expect(result).toHaveProperty('alpha');
    expect(result).toHaveProperty('beta');
    expect(result).toHaveProperty('L');
    expect(result).toHaveProperty('T');
    expect(result).toHaveProperty('pred');
    expect(result.pred).toHaveLength(pops.length);
  });

  test('alpha and beta are in valid grid-search range', () => {
    const result = m.holtFit(pops, anos);
    expect(result.alpha).toBeGreaterThanOrEqual(0.1);
    expect(result.alpha).toBeLessThanOrEqual(0.9);
    expect(result.beta).toBeGreaterThanOrEqual(0.05);
    expect(result.beta).toBeLessThanOrEqual(0.5);
  });

  test('predictions are positive integers', () => {
    const result = m.holtFit(pops, anos);
    result.pred.forEach(p => {
      expect(p).toBeGreaterThan(0);
      expect(Number.isInteger(p)).toBe(true);
    });
  });
});

describe('holtProject', () => {
  test('projects linearly from level and trend', () => {
    // L = 100000, T = 1000/year, base=2022, target=2032 → 110000
    const proj = m.holtProject(100000, 1000, 2022, 2032);
    expect(proj).toBe(110000);
  });

  test('same base and target returns L', () => {
    expect(m.holtProject(50000, 500, 2020, 2020)).toBe(50000);
  });
});

// ── calcGeoLogLinear ──────────────────────────────────────────────────────────
describe('calcGeoLogLinear', () => {
  test('returns expected properties', () => {
    const result = m.calcGeoLogLinear([2000, 2010, 2022], [50000, 60000, 72000]);
    expect(result).toHaveProperty('i_geo');
    expect(result).toHaveProperty('a_geo');
    expect(result).toHaveProperty('b_geo');
    expect(result).toHaveProperty('P0_geo');
  });

  test('positive growth rate for growing population', () => {
    const r = m.calcGeoLogLinear([2000, 2010, 2020], [50000, 60000, 72000]);
    expect(r.i_geo).toBeGreaterThan(0);
  });

  test('negative growth rate for shrinking population', () => {
    const r = m.calcGeoLogLinear([2000, 2010, 2020], [72000, 60000, 50000]);
    expect(r.i_geo).toBeLessThan(0);
  });

  test('constant population → near zero growth rate', () => {
    const r = m.calcGeoLogLinear([2000, 2010, 2020], [50000, 50000, 50000]);
    expect(Math.abs(r.i_geo)).toBeLessThan(1e-6);
  });
});

// ── calcCompositeScore ────────────────────────────────────────────────────────
describe('calcCompositeScore', () => {
  test('loo=null → 0.8 * r2', () => {
    expect(m.calcCompositeScore(0.9, null)).toBeCloseTo(0.72, 5);
    expect(m.calcCompositeScore(1.0, null)).toBeCloseTo(0.8, 5);
  });

  test('loo=0 (perfect CV) → 0.6*r2 + 0.4', () => {
    expect(m.calcCompositeScore(0.9, 0)).toBeCloseTo(0.6 * 0.9 + 0.4, 5);
  });

  test('loo=1 → 0.6*r2 + 0 (LOO score clamped to 0)', () => {
    expect(m.calcCompositeScore(0.8, 1)).toBeCloseTo(0.6 * 0.8, 5);
  });

  test('loo > 1 is clamped to 0 contribution', () => {
    const s = m.calcCompositeScore(0.5, 2);
    expect(s).toBeCloseTo(0.6 * 0.5, 5);
  });
});

// ── confiabilidadeLabel ───────────────────────────────────────────────────────
describe('confiabilidadeLabel', () => {
  test('R² >= 0.995 and low LOO → Muito alta', () => {
    const r = m.confiabilidadeLabel(0.998, 0.01);
    expect(r.label).toBe('Muito alta');
    expect(r.cls).toBe('conf-high');
  });

  test('R² >= 0.98 and moderate LOO → Alta', () => {
    const r = m.confiabilidadeLabel(0.985, 0.05);
    expect(r.label).toBe('Alta');
  });

  test('R² >= 0.95 → Média', () => {
    const r = m.confiabilidadeLabel(0.96, 0.08);
    expect(r.label).toBe('Média');
  });

  test('R² < 0.95 → Baixa', () => {
    const r = m.confiabilidadeLabel(0.9, 0.2);
    expect(r.label).toContain('Baixa');
    expect(r.cls).toBe('conf-low');
  });

  test('loo=null is handled without error', () => {
    expect(() => m.confiabilidadeLabel(0.99, null)).not.toThrow();
  });
});
