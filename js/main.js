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

function toggleTheme() {
  var html = document.documentElement;
  var current = html.getAttribute('data-theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark = current === 'dark' || (!current && prefersDark);
  var next = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  _updateThemeIcon(next === 'dark');
}

(function() {
  var saved = localStorage.getItem('theme');
  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var isDark = saved === 'dark' || (!saved && prefersDark);
  _updateThemeIcon(isDark);
})();
