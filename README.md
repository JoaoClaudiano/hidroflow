# HidroFlow

**Suporte à Análise e Dimensionamento de Sistemas de Abastecimento de Água**

HidroFlow é uma aplicação web *client-side* (sem backend) para engenheiros e planejadores municipais que precisam realizar estudos de abastecimento de água conforme as normas brasileiras (NBR 12.211, NBR 12.217, NBR 12.218, FUNASA).

---

## ✨ Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Projeção Populacional** | Ajuste automático de 4 modelos (Aritmético, Geométrico, Logístico, Holt) com R², LOO cross-validation e intervalos de confiança |
| **Dimensionamento de Infraestrutura** | Cálculo de vazões de projeto (Qmed, Q·K1, Q·K1·K2), volume de reservatório, ETE, resíduos e energia conforme NBR 12.211 |
| **Adução & Elevatórias** | Equação de Hazen-Williams, fórmula de Bresse, Método de Rippl, golpe de aríete (Joukowsky), verificação NBR 12217/12218/5648 |
| **Rede de Distribuição** | Editor visual sobre mapa (Leaflet) + solver Hardy-Cross iterativo para cálculo de pressões |
| **Saturação Populacional** | Cálculo do limite K pela densidade habitacional e taxa de urbanização |
| **Eventos / Rupturas** | Modelagem de tendências com quebras estruturais na série histórica |
| **Comparação de Municípios** | Análise comparativa de projeções entre dois municípios |
| **Relatório Técnico** | Memorial de cálculo em HTML pronto para impressão |
| **Projetos Salvos** | Salvamento e recuperação de projetos via `localStorage` |

---

## 🚀 Como usar

HidroFlow não exige instalação. Basta abrir o arquivo `index.html` em qualquer navegador moderno (Chrome, Firefox, Edge, Safari).

### Via GitHub Pages

Acesse diretamente em: `https://joaoclaudiano.github.io/hidroflow/`

### Localmente

```bash
# Clone o repositório
git clone https://github.com/JoaoClaudiano/hidroflow.git
cd hidroflow

# Abra no navegador (sem servidor necessário)
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

---

## 🔬 Fluxo de Trabalho

1. **Dados** — Informe o código IBGE do município ou preencha os censos manualmente
2. **Best Fit** — Execute o ajuste automático de modelos populacionais
3. **Projeção** — Visualize a projeção do modelo selecionado com envelope de incerteza
4. **Saturação** — Calcule o limite de saturação K com base na área urbana (opcional)
5. **Infraestrutura** — Dimensione o SAA: vazões de projeto, reservatório, ETE, resíduos
6. **Adução** — Calcule DN da adutora, potência da bomba e volume de regulação (Rippl)
7. **Rede** — Desenhe e resolva a rede de distribuição com Hardy-Cross
8. **Relatório** — Gere o memorial de cálculo e imprima ou salve como PDF

---

## 📐 Normas e Referências

| Norma / Referência | Aplicação |
|---|---|
| **NBR 12.211:2017** | SAA — Estudo de Concepção |
| **NBR 12.217:1994** | Projeto de Reservatório |
| **NBR 12.218:2017** | Rede de Distribuição |
| **NBR 5648:2010** | Tubos e Conexões — Pressão Nominal |
| **NBR 13714:2000** | Hidrantes e Mangotinhos |
| **NBR 17094:2008** | Motores Elétricos — Potência Normalizada |
| **FUNASA (2014)** | Manual de Saneamento — Abastecimento de Água |
| **Azevedo Netto (1998)** | Manual de Hidráulica — Hardy-Cross |

---

## 🏗️ Arquitetura

```
hidroflow/
├── index.html          # SPA — toda a interface
├── css/
│   ├── variables.css   # Design tokens (temas claro/escuro)
│   ├── layout.css      # Layout principal
│   ├── forms.css       # Campos e controles
│   ├── components.css  # Cards, badges, alertas
│   ├── domain.css      # Componentes específicos do domínio
│   └── print.css       # Folha de impressão
├── js/
│   ├── state.js        # Estado global da aplicação
│   ├── utils.js        # Utilitários compartilhados
│   ├── api.js          # Integração IBGE/SIDRA (com retry e cache)
│   ├── models.js       # Modelos de projeção + R²/LOO/Holt
│   ├── projection.js   # Projeção e envelope de incerteza
│   ├── infra.js        # Dimensionamento de infraestrutura
│   ├── aducao.js       # Hidráulica da adução (HW, Bresse, Rippl)
│   ├── network.js      # Rede de distribuição + Hardy-Cross
│   ├── saturacao.js    # Saturação populacional
│   ├── eventos.js      # Modelagem de rupturas de tendência
│   ├── comparison.js   # Comparação entre municípios
│   ├── decision.js     # Motor de diagnóstico automático
│   ├── report.js       # Geração de relatório HTML
│   ├── projects.js     # Salvar/carregar projetos (localStorage)
│   ├── census.js       # Tabela de censos
│   ├── tabs.js         # Navegação por abas
│   ├── map.js          # Mapa Leaflet
│   ├── mapa.js         # Visualização de mapa do município
│   ├── config.js       # Configurações do projeto
│   └── main.js         # Inicialização e tema
├── responsive.css      # Estilos mobile
├── tests/              # Testes unitários (Vitest)
│   ├── setup.js
│   ├── models.test.js
│   ├── hazen-williams.test.js
│   └── hardy-cross.test.js
└── package.json
```

**Dependências externas (CDN, sem instalação):**
- [Chart.js 4.4.1](https://www.chartjs.org/) — Visualização de dados
- [Leaflet.js 1.9.4](https://leafletjs.com/) — Mapas interativos
- [OpenStreetMap](https://www.openstreetmap.org/) — Tiles de mapa
- [Nominatim](https://nominatim.org/) — Geocodificação reversa
- [IBGE/SIDRA API](https://servicodados.ibge.gov.br/) — Dados censitários

---

## 🧪 Testes

O projeto usa [Vitest](https://vitest.dev/) para testes unitários dos algoritmos matemáticos.

```bash
# Instalar dependências de desenvolvimento
npm install

# Executar todos os testes
npm test

# Modo watch (re-executa ao salvar)
npm run test:watch
```

**O que é testado:**
- `models.test.js` — R², RMSE, CI, LOO, Holt, regressão log-linear, score composto
- `hazen-williams.test.js` — Gradiente de perda de carga HW, velocidade, golpe de aríete, seleção DN
- `hardy-cross.test.js` — Resistência HW, perda de carga, detecção de malhas, inicialização de vazões, propagação de pressões

---

## 🤝 Contribuindo

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para diretrizes de contribuição.

---

## 📄 Licença

MIT © JoaoClaudiano
