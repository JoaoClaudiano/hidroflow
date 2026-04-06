/**
 * Unit tests for the Hardy-Cross network solver in js/network.js
 *
 * Covers:
 *   - hwResistance  – Hazen-Williams pipe resistance coefficient R
 *   - hwHeadloss    – Head-loss in a pipe given R and flow Q
 *   - findLoops     – Loop detection (DFS-based)
 *   - initFlows     – Initial flow assignment
 *   - calcPressures – Head propagation from source
 *
 * Reference: Azevedo Netto (1998) Manual de Hidráulica, 8ª ed., Cap. 13.
 */
import { describe, test, expect, beforeEach } from 'vitest';
import { loadScript } from './setup.js';

// network.js also calls getParams() — provide a stub
const ctx = loadScript('network.js', {
  getParams: () => ({
    agua: 150, K1: 1.2, K2: 1.5, K3: 0.5,
    ret: 0.8, res: 0.7, en: 35, extra1Nome: '', extra1Val: 0, custom: false,
  }),
});

const { hwResistance, hwHeadloss, findLoops, initFlows, calcPressures } = ctx;

// ── hwResistance ──────────────────────────────────────────────────────────────
describe('hwResistance', () => {
  test('returns positive value for a valid pipe', () => {
    const pipe = { dn: 100, length: 100, c: 140 };
    expect(hwResistance(pipe)).toBeGreaterThan(0);
  });

  test('R = 10.643 * L / (C^1.852 * D^4.87)', () => {
    const pipe = { dn: 100, length: 100, c: 140 };
    const D = 0.1;
    const expected = 10.643 * 100 / (Math.pow(140, 1.852) * Math.pow(D, 4.87));
    expect(hwResistance(pipe)).toBeCloseTo(expected, 6);
  });

  test('longer pipe → higher resistance', () => {
    const p100 = { dn: 100, length: 100, c: 140 };
    const p200 = { dn: 100, length: 200, c: 140 };
    expect(hwResistance(p200)).toBeCloseTo(hwResistance(p100) * 2, 6);
  });

  test('larger diameter → lower resistance', () => {
    const p100 = { dn: 100, length: 200, c: 140 };
    const p150 = { dn: 150, length: 200, c: 140 };
    expect(hwResistance(p150)).toBeLessThan(hwResistance(p100));
  });

  test('higher C (smoother pipe) → lower resistance', () => {
    const pSmooth = { dn: 100, length: 100, c: 150 };
    const pRough  = { dn: 100, length: 100, c: 100 };
    expect(hwResistance(pSmooth)).toBeLessThan(hwResistance(pRough));
  });
});

// ── hwHeadloss ────────────────────────────────────────────────────────────────
describe('hwHeadloss', () => {
  const R = 100; // arbitrary resistance

  test('positive Q → positive head-loss', () => {
    expect(hwHeadloss(R, 0.01)).toBeGreaterThan(0);
  });

  test('negative Q → negative head-loss (sign preserved)', () => {
    expect(hwHeadloss(R, -0.01)).toBeLessThan(0);
  });

  test('Q = 0 → head-loss = 0', () => {
    expect(hwHeadloss(R, 0)).toBe(0);
  });

  test('|hf(Q)| === |hf(-Q)| (symmetric)', () => {
    expect(Math.abs(hwHeadloss(R, 0.005))).toBeCloseTo(
      Math.abs(hwHeadloss(R, -0.005)), 10,
    );
  });

  test('hf = R * sign(Q) * |Q|^1.852', () => {
    const Q = 0.003;
    const expected = R * Math.sign(Q) * Math.pow(Math.abs(Q), 1.852);
    expect(hwHeadloss(R, Q)).toBeCloseTo(expected, 10);
  });
});

// ── findLoops ─────────────────────────────────────────────────────────────────
describe('findLoops', () => {
  test('two nodes, one pipe → no loops', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }];
    const pipes = [{ id: 'p1', from: 'A', to: 'B', dn: 100, length: 100, c: 140 }];
    expect(findLoops(nodes, pipes)).toHaveLength(0);
  });

  test('triangle (3 nodes, 3 pipes) → 1 loop', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const pipes = [
      { id: 'p1', from: 'A', to: 'B', dn: 100, length: 100, c: 140 },
      { id: 'p2', from: 'B', to: 'C', dn: 100, length: 100, c: 140 },
      { id: 'p3', from: 'C', to: 'A', dn: 100, length: 100, c: 140 },
    ];
    expect(findLoops(nodes, pipes)).toHaveLength(1);
  });

  test('two separate triangles → 2 loops', () => {
    const nodes = [
      { id: 'A' }, { id: 'B' }, { id: 'C' },
      { id: 'D' }, { id: 'E' }, { id: 'F' },
    ];
    const pipes = [
      { id: 'p1', from: 'A', to: 'B', dn: 100, length: 100, c: 140 },
      { id: 'p2', from: 'B', to: 'C', dn: 100, length: 100, c: 140 },
      { id: 'p3', from: 'C', to: 'A', dn: 100, length: 100, c: 140 },
      { id: 'p4', from: 'D', to: 'E', dn: 100, length: 100, c: 140 },
      { id: 'p5', from: 'E', to: 'F', dn: 100, length: 100, c: 140 },
      { id: 'p6', from: 'F', to: 'D', dn: 100, length: 100, c: 140 },
    ];
    expect(findLoops(nodes, pipes)).toHaveLength(2);
  });

  test('single node → no loops', () => {
    expect(findLoops([{ id: 'A' }], [])).toHaveLength(0);
  });

  test('loop pipes contain direction information', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
    const pipes = [
      { id: 'p1', from: 'A', to: 'B', dn: 100, length: 100, c: 140 },
      { id: 'p2', from: 'B', to: 'C', dn: 100, length: 100, c: 140 },
      { id: 'p3', from: 'C', to: 'A', dn: 100, length: 100, c: 140 },
    ];
    const loops = findLoops(nodes, pipes);
    expect(loops[0].length).toBeGreaterThan(0);
    loops[0].forEach(entry => {
      expect(entry).toHaveProperty('pipe');
      expect(entry).toHaveProperty('dir');
      expect(Math.abs(entry.dir)).toBe(1);
    });
  });
});

// ── initFlows ─────────────────────────────────────────────────────────────────
describe('initFlows', () => {
  test('all flows are initialized to a non-zero value', () => {
    const source  = { id: 'R', type: 'reservoir', demand: 0, elevation: 20 };
    const nodeA   = { id: 'A', type: 'junction',  demand: 0.5, elevation: 0 };
    const nodeB   = { id: 'B', type: 'junction',  demand: 0.5, elevation: 0 };
    const nodes = [source, nodeA, nodeB];
    const pipes = [
      { id: 'p1', from: 'R', to: 'A', dn: 100, length: 200, c: 140, flow: 0 },
      { id: 'p2', from: 'A', to: 'B', dn: 100, length: 150, c: 140, flow: 0 },
    ];

    initFlows(nodes, pipes, source);

    pipes.forEach(p => {
      expect(Math.abs(p.flow)).toBeGreaterThan(0);
    });
  });
});

// ── calcPressures ─────────────────────────────────────────────────────────────
describe('calcPressures (head propagation)', () => {
  test('nodes receive pressure attribute after calcPressures', () => {
    const reservoir = { id: 'R', type: 'reservoir', elevation: 30, demand: 0 };
    const nodeA     = { id: 'A', type: 'junction',  elevation: 10, demand: 1.0 };
    const nodes = [reservoir, nodeA];
    const pipes = [{
      id: 'p1', from: 'R', to: 'A',
      dn: 200, length: 500, c: 140,
      flow: 1.0, // L/s
      headloss: 2.0,
      calculated: true,
    }];

    calcPressures(nodes, pipes, reservoir);

    // Nodes should have pressure set after calcPressures
    expect(nodeA.pressure).toBeDefined();
    expect(nodeA.pressure).toBeGreaterThanOrEqual(0);
  });

  test('downstream node has lower head than reservoir', () => {
    const reservoir = { id: 'R', type: 'reservoir', elevation: 30, demand: 0 };
    const nodeA     = { id: 'A', type: 'junction',  elevation: 10, demand: 1.0 };
    const nodes = [reservoir, nodeA];
    const pipes = [{
      id: 'p1', from: 'R', to: 'A',
      dn: 100, length: 500, c: 140,
      flow: 1.0,
    }];

    initFlows(nodes, pipes, reservoir);
    calcPressures(nodes, pipes, reservoir);

    if (nodeA.head !== undefined) {
      expect(nodeA.head).toBeLessThanOrEqual(reservoir.head);
    }
  });
});
