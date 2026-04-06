# Contribuindo com o HidroFlow

Obrigado pelo interesse em contribuir! Este guia explica como colaborar com o projeto.

---

## 📋 Pré-requisitos

- Node.js ≥ 18 (apenas para rodar os testes)
- Um navegador moderno para testar a interface
- Conhecimento básico de JavaScript vanilla e hidráulica sanitária é bem-vindo

---

## 🐛 Reportando Bugs

1. Acesse [Issues](https://github.com/JoaoClaudiano/hidroflow/issues)
2. Verifique se o bug já foi reportado
3. Abra uma nova issue com:
   - Descrição clara do problema
   - Passos para reproduzir
   - Comportamento esperado vs. observado
   - Navegador e versão
   - Captura de tela se relevante

---

## 💡 Sugerindo Melhorias

Abra uma issue com o label `enhancement` descrevendo:
- O problema que a melhoria resolve
- A solução proposta
- Alternativas consideradas

---

## 🔧 Contribuindo com Código

### 1. Fork e clone

```bash
git clone https://github.com/SEU_USUARIO/hidroflow.git
cd hidroflow
npm install
```

### 2. Crie uma branch

```bash
git checkout -b feat/nome-da-funcionalidade
# ou
git checkout -b fix/descricao-do-bug
```

### 3. Faça suas alterações

- **Siga o estilo existente** — código minificado por consistência nos arquivos JS (exceto funções novas que podem ser legíveis)
- **Adicione testes** para qualquer função matemática pura nova em `tests/`
- **Execute os testes** antes de enviar: `npm test`
- **Não quebre testes existentes**

### 4. Convenções de código

| Item | Convenção |
|---|---|
| Idioma do código | Português (variáveis e funções) |
| Comentários complexos | Português |
| Normas citadas | Sempre referenciar NBR/FUNASA com número e ano |
| Números mágicos | Definir em `js/config.js` com comentário de origem |
| Sanitização HTML | Sempre usar `safeHtml()` para innerHTML de dados externos |
| Erros de API | Sempre mostrar mensagem ao usuário via `setStatus()` |
| Funções puras | Testar em `tests/` com Vitest |

### 5. Commit

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: adiciona exportação CSV do relatório
fix: corrige divisão por zero em calcSaturacao
test: adiciona testes para holtProject
docs: atualiza README com instruções de uso
refactor: extrai validação de entradas para utils
```

### 6. Pull Request

- Abra o PR contra a branch `main`
- Descreva as mudanças e o raciocínio
- Inclua referências a issues relacionadas (`Closes #42`)
- Aguarde revisão

---

## 🧪 Estrutura de Testes

Os testes vivem em `tests/` e usam [Vitest](https://vitest.dev/).

```
tests/
  setup.js              # Helper: carrega scripts JS com vm.runInContext
  models.test.js        # Testa algoritmos estatísticos de models.js
  hazen-williams.test.js # Testa hidráulica de aducao.js
  hardy-cross.test.js   # Testa solver Hardy-Cross de network.js
```

Para **adicionar um novo teste**:

```js
// tests/meu-modulo.test.js
import { describe, test, expect } from 'vitest';
import { loadScript } from './setup.js';

const ctx = loadScript('meu-modulo.js');

describe('minhaFuncao', () => {
  test('caso básico', () => {
    expect(ctx.minhaFuncao(1, 2)).toBe(3);
  });
});
```

---

## 📐 Algoritmos e Referências

Ao implementar novos cálculos hidráulicos, sempre:

1. Citar a equação original com referência bibliográfica
2. Documentar as unidades de todas as variáveis
3. Adicionar verificação contra valores tabelados em FUNASA/Azevedo Netto
4. Incluir alertas de validade (ex: limites de C na equação de Hazen-Williams)

---

## 📄 Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a [MIT License](LICENSE).
