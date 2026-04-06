/**
 * Test helper: loads a browser-targeted JS file into a vm context,
 * allowing unit testing of pure functions without a DOM.
 */
import vm from 'vm';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Minimal DOM stub that silently ignores all calls. */
function makeDomStub() {
  const el = () => ({
    innerHTML: '', textContent: '', value: '', style: {}, className: '',
    children: [], classList: { add() {}, remove() {}, contains() { return false; } },
    querySelectorAll() { return []; },
  });
  return {
    getElementById: el,
    querySelectorAll: () => [],
    documentElement: { getAttribute: () => null },
  };
}

/**
 * Loads a JS file from the js/ directory and executes it inside a vm sandbox
 * with mocked browser globals. Returns the vm context, which holds all
 * functions and variables declared at the top level of the script.
 *
 * @param {string} filename - filename inside js/ (e.g. 'models.js')
 * @param {object} [extra]  - additional globals to inject into the context
 * @returns {vm.Context}
 */
export function loadScript(filename, extra = {}) {
  const src = fs.readFileSync(join(__dirname, '..', 'js', filename), 'utf8');

  const ctx = vm.createContext({
    // ── Builtins ─────────────────────────────────────────────────────────────
    Math, Infinity, NaN, isFinite, isNaN, parseInt, parseFloat,
    console, Date, Object, Array, Set, Map, Promise, JSON,
    String, Number, Boolean, Error, TypeError,
    encodeURIComponent, decodeURIComponent,
    setTimeout: () => {}, clearTimeout: () => {},

    // ── HidroFlow globals ─────────────────────────────────────────────────────
    state: {
      censosData: [], K: null, coefs: {},
      r2: {}, rmse: {}, loo: {}, scores: {},
      infraAnos: [2025, 2030, 2035, 2043],
      censosRaw: null, bestModel: null,
      municipioNome: '', municipioCod: '', municipioUF: '',
      municipioLat: null, municipioLon: null,
      charts: {}, mapaL: null, config: {},
      projData: [], adAnoIdx: 0, auditLog: [], cmpB: null,
    },
    modelLabel: {
      aritmetico: 'Aritmético', geometrico: 'Geométrico',
      logistico: 'Logístico', holt: 'Holt',
    },
    modelColors: {
      aritmetico: '#4f7ef5', geometrico: '#1D9E75',
      logistico: '#E24B4A', holt: '#e09000',
    },
    addAudit: () => {},
    setStatus: () => {},
    document: makeDomStub(),
    alert: () => {},
    confirm: () => true,
    Chart: class { constructor() {} destroy() {} },
    fetch: async () => ({ ok: true, json: async () => ({}) }),

    // ── Extra overrides ───────────────────────────────────────────────────────
    ...extra,
  });

  vm.runInContext(src, ctx);
  return ctx;
}
