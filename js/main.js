// ══════════════════════════════════════════
// INICIALIZAÇÃO
// ══════════════════════════════════════════
renderCensusRows();
addEvento();
document.getElementById('infra-anos').innerHTML=state.infraAnos.map((a,i)=>`<button class="btn btn-sm ${i===0?'btn-primary':''}" onclick="setInfraAno(${i},this)">${a}</button>`).join('');
renderDimensionamento();
addAudit('Aplicação iniciada (v5.0)');

// ══════════════════════════════════════════
// TEMA (DARK / LIGHT MODE)
// ══════════════════════════════════════════
function _updateThemeIcon(isDark) {
  document.getElementById('theme-icon-sun').style.display = isDark ? '' : 'none';
  document.getElementById('theme-icon-moon').style.display = isDark ? 'none' : '';
}

/**
 * Read a CSS custom property from :root (resolved after theme switch).
 * @param {string} prop  e.g. '--text2'
 * @returns {string}
 */
function _cssVar(prop) {
  return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
}

/**
 * Update Chart.js global defaults and rebuild any existing charts so they
 * respect the current colour theme.
 */
function _applyThemeToCharts() {
  const text    = _cssVar('--text');
  const text2   = _cssVar('--text2');
  const text3   = _cssVar('--text3');
  const border  = _cssVar('--border');

  // Update Chart.js global defaults
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color          = text2;
    Chart.defaults.borderColor    = border;
    Chart.defaults.plugins.legend.labels.color = text2;
    Chart.defaults.scale.ticks.color = text2;
    Chart.defaults.scale.grid.color  = border;
  }

  // Rebuild all live charts so the new defaults take effect
  Object.values(state.charts).forEach(ch => {
    if (!ch || typeof ch.update !== 'function') return;
    if (ch.options && ch.options.plugins && ch.options.plugins.legend) {
      ch.options.plugins.legend.labels.color = text2;
    }
    if (ch.options && ch.options.scales) {
      Object.values(ch.options.scales).forEach(axis => {
        if (axis.ticks)  axis.ticks.color = text2;
        if (axis.grid)   axis.grid.color  = border;
        if (axis.title)  axis.title.color = text3;
      });
    }
    ch.update('none'); // 'none' = no animation for instant response
  });
}

function toggleTheme() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark = current === 'dark' || (!current && prefersDark);
  var next = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  _updateThemeIcon(next === 'dark');
  _applyThemeToCharts();
}

(function() {
  var saved = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark = saved === 'dark' || (!saved && prefersDark);
  _updateThemeIcon(isDark);
  // Apply theme defaults to Chart.js on load (after a tick so Chart is ready)
  setTimeout(_applyThemeToCharts, 0);
})();
