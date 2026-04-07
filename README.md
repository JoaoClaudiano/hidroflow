<div align="center">

# 💧 HidroFlow

**Suporte à Análise e Dimensionamento de Sistemas de Abastecimento de Água**

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/Deploy-GitHub%20Pages-brightgreen)](https://joaoclaudiano.github.io/hidroflow/)
[![Version](https://img.shields.io/badge/version-5.0.0-informational)](package.json)
[![Tests](https://img.shields.io/badge/tests-Vitest-yellow)](https://vitest.dev/)
[![Normas ABNT](https://img.shields.io/badge/Normas-ABNT%20NBR-orange)](https://joaoclaudiano.github.io/hidroflow/metodologia.html)

🌐 **[Acesse o app online →](https://joaoclaudiano.github.io/hidroflow/)**

</div>

---

## O que é o HidroFlow?

HidroFlow é uma **aplicação web 100% client-side** (sem backend, sem instalação) desenvolvida para engenheiros, planejadores e técnicos municipais que precisam realizar estudos de **Sistemas de Abastecimento de Água (SAA)** conforme as normas brasileiras.

Com HidroFlow você vai desde a **coleta de dados censitários do IBGE** até a **geração do memorial de cálculo** completo, passando por projeção populacional, dimensionamento de infraestrutura, hidráulica de adução e resolução de redes de distribuição — tudo no navegador, sem instalar nada.

---

## ✨ Funcionalidades

| Módulo | O que faz |
|--------|-----------|
| 📊 **Projeção Populacional** | Ajuste automático de 4 modelos (Aritmético, Geométrico, Logístico, Holt) com R², LOO cross-validation e intervalos de confiança |
| 🏗️ **Dimensionamento de Infraestrutura** | Cálculo de vazões de projeto (Qmed, Q·K1, Q·K1·K2), volume de reservatório, ETA/ETE, resíduos e energia conforme NBR 12.211 |
| 🔧 **Adução & Elevatórias** | Equação de Hazen-Williams, fórmula de Bresse, Método de Rippl, golpe de aríete (Joukowsky), verificação NBR 12217/12218/5648 |
| 🗺️ **Rede de Distribuição** | Editor visual sobre mapa (Leaflet) + solver Hardy-Cross iterativo para cálculo de pressões |
| 📈 **Saturação Populacional** | Cálculo do limite K pela densidade habitacional e taxa de urbanização |
| ⚡ **Eventos / Rupturas** | Modelagem de tendências com quebras estruturais na série histórica |
| 🔍 **Comparação de Municípios** | Análise comparativa de projeções entre dois municípios usando taxa geométrica de crescimento |
| 📄 **Relatório Técnico** | Memorial de cálculo em HTML pronto para impressão/PDF |
| 💾 **Projetos Salvos** | Salvamento e recuperação de projetos via `localStorage` |

---

## 🚀 Acesso Rápido

### Via GitHub Pages (recomendado)

Sem instalação. Acesse diretamente no navegador:

**👉 [https://joaoclaudiano.github.io/hidroflow/](https://joaoclaudiano.github.io/hidroflow/)**

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

> **Não é necessário npm install** para usar o app. As dependências (Chart.js, Leaflet, jsPDF) são carregadas via CDN.

---

## 🔬 Fluxo de Trabalho

```
1. Dados        → Informe o código IBGE ou preencha os censos manualmente
2. Best Fit     → Execute o ajuste automático de modelos populacionais
3. Projeção     → Visualize a projeção com envelope de incerteza
4. Saturação    → Calcule o limite de saturação K (opcional)
5. Infraestrutura → Dimensione SAA: vazões, reservatório, ETA/ETE, resíduos
6. Adução       → Calcule DN da adutora, potência da bomba e Rippl
7. Rede         → Desenhe e resolva a rede de distribuição (Hardy-Cross)
8. Relatório    → Gere o memorial de cálculo e exporte como PDF
```

---

## 📐 Normas e Referências Técnicas

| Norma / Referência | Aplicação no HidroFlow |
|---|---|
| **NBR 12.211:2017** | SAA — Estudo de Concepção (vazões, reservatório, energia) |
| **NBR 12.217:1994** | Projeto de Reservatório de Distribuição |
| **NBR 12.218:2017** | Projeto de Rede de Distribuição |
| **NBR 9281:1986** | Medição de Vazão — Calhas Parshall |
| **NBR 5648:2010** | Tubos e Conexões — Pressão Nominal |
| **NBR 13714:2000** | Hidrantes e Mangotinhos |
| **NBR 17094:2008** | Motores Elétricos — Potência Normalizada |
| **FUNASA (2014)** | Manual de Saneamento — Abastecimento de Água |
| **Azevedo Netto (1998)** | Manual de Hidráulica — Hardy-Cross |

---

## 🏗️ Arquitetura do Projeto

```
hidroflow/
├── index.html              # SPA — toda a interface principal
├── metodologia.html        # Memorial de cálculo e metodologia
├── guia.html               # Guia de uso e glossário
├── novidades.html          # Changelog e roadmap
├── sobre.html              # Sobre o projeto
├── contato.html            # Contato
├── privacidade.html        # Política de privacidade
├── termos.html             # Termos de uso
│
├── css/
│   ├── variables.css       # Design tokens (temas claro/escuro)
│   ├── layout.css          # Layout principal
│   ├── forms.css           # Campos e controles
│   ├── components.css      # Cards, badges, alertas
│   ├── domain.css          # Componentes específicos do domínio
│   ├── footer.css          # Rodapé
│   └── print.css           # Folha de impressão
│
├── js/
│   ├── state.js            # Estado global da aplicação
│   ├── utils.js            # Utilitários + materiais hidráulicos
│   ├── api.js              # IBGE/SIDRA (retry + cache)
│   ├── models.js           # Modelos de projeção + R²/LOO/Holt
│   ├── projection.js       # Projeção e envelope de incerteza
│   ├── infra.js            # Dimensionamento de infraestrutura
│   ├── aducao.js           # Hidráulica da adução (HW, Bresse, Rippl)
│   ├── network.js          # Rede de distribuição + Hardy-Cross
│   ├── saturacao.js        # Saturação populacional
│   ├── eventos.js          # Modelagem de rupturas de tendência
│   ├── comparison.js       # Comparação entre municípios
│   ├── decision.js         # Motor de diagnóstico automático
│   ├── report.js           # Geração de relatório HTML
│   ├── projects.js         # Salvar/carregar projetos (localStorage)
│   ├── census.js           # Tabela de censos
│   ├── tabs.js             # Navegação por abas
│   ├── map.js              # Mapa Leaflet + editor de rede
│   ├── avancados.js        # Módulos avançados
│   ├── config.js           # Configurações do projeto
│   └── main.js             # Inicialização e tema
│
├── responsive.css          # Estilos mobile
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (offline)
├── robots.txt              # Diretivas para rastreadores
├── sitemap.xml             # Mapa do site
├── llms.txt                # Guia para modelos de linguagem
├── ai.txt                  # Diretrizes para IA
├── humans.txt              # Equipe e tecnologias
├── .well-known/
│   └── security.txt        # Política de segurança
│
└── tests/                  # Testes unitários (Vitest)
    ├── setup.js
    ├── models.test.js
    ├── hazen-williams.test.js
    ├── hardy-cross.test.js
    └── new-features.test.js
```

**Dependências externas (CDN, sem instalação local):**

| Biblioteca | Versão | Uso |
|---|---|---|
| [Chart.js](https://www.chartjs.org/) | 4.4.1 | Visualização de gráficos |
| [Leaflet.js](https://leafletjs.com/) | 1.9.4 | Mapas interativos |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | Exportação PDF |
| [SheetJS (xlsx)](https://sheetjs.com/) | 0.20.3 | Exportação Excel |
| [OpenStreetMap](https://www.openstreetmap.org/) | — | Tiles de mapa |
| [Nominatim](https://nominatim.org/) | — | Geocodificação reversa |
| [IBGE/SIDRA API](https://servicodados.ibge.gov.br/) | — | Dados censitários |

---

## 🧪 Testes

O projeto usa [Vitest](https://vitest.dev/) para testes unitários dos algoritmos matemáticos principais.

```bash
# Instalar dependências de desenvolvimento
npm install

# Executar todos os testes
npm test

# Modo watch (re-executa ao salvar)
npm run test:watch

# Relatório de cobertura
npm run test:coverage
```

**Suítes de teste:**

| Arquivo | O que testa |
|---|---|
| `models.test.js` | R², RMSE, IC, LOO, Holt, regressão log-linear, score composto |
| `hazen-williams.test.js` | Gradiente HW, velocidade, golpe de aríete, seleção DN |
| `hardy-cross.test.js` | Resistência HW, perda de carga, detecção de malhas, propagação de pressões |
| `new-features.test.js` | Saturação, comparação de municípios, adução avançada |

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Consulte o [CONTRIBUTING.md](CONTRIBUTING.md) para diretrizes detalhadas sobre:

- Padrões de código e estilo
- Como reportar bugs
- Como propor novas funcionalidades
- Como executar os testes antes de enviar um PR

---

## 📋 Páginas do Site

| Página | Descrição |
|---|---|
| [App Principal](https://joaoclaudiano.github.io/hidroflow/) | Ferramenta de dimensionamento SAA |
| [Metodologia](https://joaoclaudiano.github.io/hidroflow/metodologia.html) | Equações, referências e memorial de cálculo |
| [Guia de Uso](https://joaoclaudiano.github.io/hidroflow/guia.html) | Passo a passo e glossário técnico |
| [Novidades](https://joaoclaudiano.github.io/hidroflow/novidades.html) | Changelog e roadmap |
| [Sobre](https://joaoclaudiano.github.io/hidroflow/sobre.html) | Sobre o projeto e o autor |
| [Contato](https://joaoclaudiano.github.io/hidroflow/contato.html) | Feedback e suporte |
| [Privacidade](https://joaoclaudiano.github.io/hidroflow/privacidade.html) | Política de privacidade |
| [Termos de Uso](https://joaoclaudiano.github.io/hidroflow/termos.html) | Termos e condições de uso |
| [Aviso Legal](https://joaoclaudiano.github.io/hidroflow/disclaimer.html) | Limitação de responsabilidade e uso profissional |

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

© 2024 JoaoClaudiano — Feito com 💧 para a engenharia de saneamento brasileira.
