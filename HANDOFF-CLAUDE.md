# HANDOFF — Claude (Portal Institucional)

**Papel nesta equipe:** elevar o portal institucional usando as fotos oficiais já incorporadas e autorizadas pelo usuário (`public/assets/official/church.jpg`, `group.jpg`, `baptism.webp`, `volunteers.jpg`), sem interferir no estacionamento (Antigravity) nem na integração (Codex).

Li `HANDOFF.md` e `IMAGE_SOURCES.md` antes de editar. Confirmado: as 4 fotos oficiais já estão em `public/assets/official/`, já referenciadas em `public/index.html` (hero, GC, Batismo, Voluntariado) e já estilizadas por `public/css/official-photos.css`. Não recriei nada disso — só adicionei uma camada de acabamento por cima.

## O que foi entregue

- **`public/css/portal-polish.css`** (novo arquivo, CSS puro, sem dependências).
- **Nenhum JS foi necessário** — não criei `portal-polish.js`. Tudo abaixo é só CSS.

### O que o arquivo faz
1. Alinha o raio de borda e a sombra das fotos oficiais aos tokens do design system (`--radius-lg`, `--shadow-sm/--shadow-lg`, `--ease-apple`) em vez dos valores fixos de `official-photos.css`.
2. Refina a legenda/crédito da fonte (`figcaption`) para a mesma linguagem tipográfica editorial usada em `.quote-source`/`.card-action-link` no resto do portal (link em `--accent-blue`, gap animado no hover).
3. Corrige um espaçamento ausente: a foto do bloco de GCs (`.gc-hero-side .official-photo`) encostava direto no cartão de informações abaixo, sem respiro nenhum — adicionado `margin-bottom`.
4. Acessibilidade: adiciona `:focus-visible` nos botões que abrem a galeria (`.official-photo-trigger`), que não tinham nenhum estado de foco visível por teclado.
5. Hover discreto (leve elevação + sombra) nas fotos de GC/Batismo/Voluntariado via `:has()`, com fallback silencioso em navegadores sem suporte (a foto some com sua sombra, mas a interação de zoom da imagem que já existe em `official-photos.css` continua funcionando normalmente).
6. Respeita `prefers-reduced-motion` (zera transição/transform).
7. Tudo usa `var(--token, fallback)`, então funciona em tema claro e escuro sem regra própria de dark mode.

### Ação pendente para Codex (integração)
Este CSS **não está linkado em `index.html` porque isso está fora do meu escopo**. Falta adicionar, no `<head>`, depois de `css/official-photos.css`:

```html
<link rel="stylesheet" href="css/portal-polish.css">
```

A ordem importa: o arquivo assume que `style.css` e `official-photos.css` já carregaram antes, para herdar as variáveis CSS e para suas regras (mesma especificidade, ordem posterior) vencerem onde refinam algo.

## Como validei sem tocar em `index.html`
Não é possível ver o resultado sem o `<link>`, e eu não podia adicioná-lo. Então validei injetando a tag `<link>` **em tempo de execução, só na aba do navegador** (via JS, sem alterar nenhum arquivo em disco) e conferindo:
- O arquivo carrega sem erro de parse (15 regras, 0 erros).
- Os seletores batem com os elementos reais: `border-radius` e `box-shadow` resolvidos corretamente em `.official-hero`, `.gc-hero-side .official-photo` e `.step-subcard .official-photo`; `margin-bottom` do GC corrigido de `0px` para `20px`.
- `:focus-visible` funciona (testado com Tab real do teclado em outro elemento da mesma página, mesmo mecanismo).
- Sem erros no console.
- Tema escuro: cores herdadas corretamente via `var(--bg-surface)`/`var(--border-subtle)`, sem hardcode.
- Não rodei `tests/regression.cjs` de novo porque não toquei em servidor, `app.js` nem em nenhum arquivo que o teste cobre.

## Escopo respeitado (nada além disso foi tocado)
- ❌ `public/index.html`
- ❌ `public/css/style.css`
- ❌ `public/js/app.js`
- ❌ `server.js`
- ❌ Qualquer arquivo do estacionamento (simulador, editor de polígonos, detector, `ai_engine/`)
- ❌ `public/css/official-photos.css` (não é meu — só adiciono por cima, não redefino)

## Observação para o time
`public/css/official-photos.css` tem uma regra duplicada no final do arquivo (`.official-volunteer.strip-item` aparece duas vezes, a segunda repetindo/estreitando a primeira). Não mexi nisso por não ser meu arquivo — fica registrado para quem for revisar (Codex).
