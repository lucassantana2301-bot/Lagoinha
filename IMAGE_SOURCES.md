# Registro de Origem, Verificação e Solicitação de Imagens

**Data de Auditoria:** 26 de Setembro de 2026 (revisada — evolução visual do portal)
**Projeto:** Portal Integrado Lagoinha Alphaville & Lagoinha Parking
**Diretriz Ética:** Uso estrito de materiais com origem confirmada e direitos autorais verificados. Proibição de imagens geradas por IA, bancos genéricos ou fotos de outros templos/campi apresentadas como se fossem de Alphaville.

---

## 0. Correção de Auditoria — 26/09/2026 (achado crítico)

Uma reauditoria binária dos dois arquivos ilustrativos abaixo (inspeção do cabeçalho JPEG/JUMBF, não apenas do nome do arquivo) encontrou um manifesto **C2PA** embutido nos bytes de ambos os arquivos:

```
claim_generator_info → name: "Google C2PA Core Generator Library"
action: c2pa.created → description: "Created by Google Generative AI."
action: c2pa.edited  → description: "Applied imperceptible SynthID watermark."
digitalSourceType: trainedAlgorithmicMedia
```

Ou seja: **`cctv_lagoinha.jpg` e `satellite_lagoinha.jpg` são imagens geradas por IA (Google Generative AI), com marca d'água digital SynthID embutida.** O nome do arquivo sugeria uma foto real da igreja, mas o conteúdo binário comprova o contrário — exatamente o risco que motivou a auditoria (nomes de arquivo não comprovam autenticidade).

**Ação tomada nesta revisão:**
- Removidas do **Portal institucional** (nenhuma seção pública do site usa mais esses arquivos).
- Mantidas **apenas dentro do simulador operacional** (`?app=parking`), onde já eram rotuladas como "Foto Ilustrativa CCTV" / simulação — o texto de transparência (`Sobre & Dados` → item 2) foi reforçado para declarar explicitamente que são **geradas por IA**, não apenas "ilustrativas".
- **Não remova a marca d'água SynthID** desses arquivos (reencodar/recortar para apagar o C2PA violaria a diretriz de não remover marcas d'água). Se decidirem substituí-los por fotografia real do pátio, o arquivo antigo deve ser descartado, não editado.

---

## 1. Auditoria dos Arquivos Existentes no Projeto

| Arquivo Local | Origem / Natureza | Situação de Uso | Parecer Técnico |
| :--- | :--- | :--- | :--- |
| `public/assets/cctv_lagoinha.jpg` | **Gerado por IA** (Google Generative AI, SynthID/C2PA confirmado no binário) | ⚠️ **IA — uso restrito ao simulador** | **Proibido no portal institucional.** Usado só dentro da demonstração operacional, com rótulo explícito de IA. |
| `public/assets/satellite_lagoinha.jpg` | **Gerado por IA** (Google Generative AI, SynthID/C2PA confirmado no binário) | ⚠️ **IA — uso restrito ao simulador** | **Proibido no portal institucional.** Usado só dentro da demonstração operacional, com rótulo explícito de IA. |
| `public/assets/prototype_overview.jpg` | Captura de tela real (screenshot) da própria interface do protótipo rodando em `localhost:3002`, capturada em 26/09/2026 durante esta sessão | ✅ **Real, autoral, sem restrição** | Usado no portal (seção Estacionamento) e na galeria como demonstração real da interface — não é câmera ao vivo, texto deixa isso explícito. |
| `public/assets/prototype_entrance.jpg` | Idem — captura real do Painel de Direcionamento da Entrada | ✅ **Real, autoral, sem restrição** | Usado na galeria da seção Estacionamento. |
| `public/assets/prototype_editor.jpg` | Idem — captura real do Editor Visual de Polígonos | ✅ **Real, autoral, sem restrição** | Usado na galeria da seção Estacionamento. |
| `public/assets/lagoinha_alphaville_official_logo.png` | **Logotipo Oficial Horizontal Lagoinha Alphaville** (Círculo branco com pomba dourada `#FFC800` + tipografia LAGOINHA ALPHAVILLE em caixa alta) | ✅ **Oficial Institucional** (Enviado pelo usuário) | Aplicado no cabeçalho principal e no rodapé global da aplicação. |
| `public/assets/lagoinha_official_emblem.png` | **Emblema Oficial Lagoinha** (Círculo amarelo institucional `#FFC800` com a pomba preta) | ✅ **Oficial Institucional** (Enviado pelo usuário) | Usado no cabeçalho institucional, selo do hero, cartão de localização e favicon. |
| `public/assets/lagoinha_alphaville_logo.png` | **Logotipo Oficial Lagoinha Alphaville** (Emblema circular amarelo com pomba preta + tipografia customizada "ALPHAVILLE" em amarelo institucional `#FFC800`) | ✅ **Oficial Institucional** (Fornecido pelo usuário) | Ativo oficial da marca. Pronto para cabeçalho, hero e rodapé. |
| `public/assets/lagoinha_dove_symbol.png` | **Símbolo Oficial da Pomba da Lagoinha** (Silhueta vetorial do Espírito Santo com asa horizontal e cauda recortada) | ✅ **Oficial Institucional** (Fornecido pelo usuário) | Emblema oficial da igreja para favicons, ícones e marca d'água de cabeçalho. |
| `emblem_lagoinha_dove.svg` (em `icons.js`) | Vetorização do emblema oficial (círculo amarelo #FFC800 com silhueta da pomba) | ✅ **Oficial Institucional** | Utilizado no favicon, cabeçalho e selos oficiais de identidade da Lagoinha. |

---

## 1.1 Pesquisa nas Fontes Oficiais — 26/09/2026

**Site oficial (`lagoinhaalphaville.com.br`):** acessado diretamente (HTML estático, sem paywall). Localizadas imagens reais já publicadas pela própria igreja na página inicial (hospedadas no CDN Wix da igreja), prováveis temas por posição na página (sem alt-text/legenda no HTML de origem, então o tema é inferido visualmente, não uma legenda oficial):

| Imagem oficial (CDN da igreja) | Tema provável | Usada neste projeto? |
| :--- | :--- | :--- |
| `static.wixstatic.com/media/d7e284_9980a324f46540919ac27aa5fd0dd79d~mv2.jpg` | Fachada/interior da igreja | ❌ Não |
| `static.wixstatic.com/media/d7e284_4ad952e22e284bf6b8724ea5a70c1b16~mv2.jpg` | Grupo de Crescimento | ❌ Não |
| `static.wixstatic.com/media/d7e284_40d1c8391efa4a89911861f2c17eeeb8~mv2.webp` | Batismo | ❌ Não |
| `static.wixstatic.com/media/d7e284_34a1ccb3c2ea48e4ad2114db8b8785f1~mv2.jpg` | Voluntariado | ❌ Não |

**Por que não foram usadas:** são fotos reais e da unidade certa, mas **não há autorização confirmada para republicá-las neste protótipo independente** — hospedar/incorporar essas imagens (mesmo via link direto ao CDN da igreja) constitui reprodução da obra sem licença, o que a diretriz do projeto proíbe ("fotos públicas não são automaticamente livres para republicação"). Ficam registradas aqui como referência exata do que pedir à equipe de Mídia (ver checklist na seção 3).

**Instagram (`instagram.com/lagoinhaalphaville.sp`):** tentativa de acesso automatizado (fetch programático) **falhou de forma relevante para registro**: a página retornada sem sessão autenticada é a tela de login/challenge do Instagram (confirmado inspecionando o HTML bruto — sem metadados `og:`, sem `shortcode` de post, `<title>` genérico "Instagram"). Uma primeira tentativa via ferramenta de resumo automático chegou a listar 12 URLs de posts que **não existem no HTML real** — descartadas por serem invenção da ferramenta, não dado real (achado registrado para não repetir o erro: não confiar em resumos de fetch para páginas com login-wall). **Nenhum conteúdo do Instagram foi usado neste projeto.** Para trazer posts reais e com crédito automático preservado (marca d'água, legenda, link), a forma correta é o embed oficial do Instagram (`https://www.instagram.com/p/<ID>/embed`), que exige copiar a URL de um post específico manualmente (visualizando o Instagram logado, em navegador) — isso não pôde ser feito nesta sessão e fica como próximo passo.

---

## 2. Status dos Materiais Fotográficos Necessários

Para preservar a máxima integridade e não fabricar imagens artificiais da igreja, mapeamos exatamente as 6 fotografias oficiais que devem ser fornecidas pela equipe de Comunicação/Mídia da Lagoinha Alphaville:

| Seção do Portal | Fotografia Necessária | Especificação Recomendada | Status Atual | Ação Requerida |
| :--- | :--- | :--- | :--- | :--- |
| **A. Hero (Abertura)** | Fachada real e entrada da igreja na Av. Tamboré, 74 | Horizontal (16:9 ou 4:3), alta resolução (mín. 1920x1080), iluminação natural diurna ou noturna com letreiro aceso | ⏳ *Pendente de envio oficial* | Solicitar à equipe de Mídia de Alphaville. Enquanto isso, o portal utiliza composição arquitetônica tipográfica premium com o emblema oficial. |
| **B. Comunidade / Culto** | Comunidade reunida no auditório principal | Horizontal ou 4:3, plano aberto mostrando o auditório e louvor na Av. Tamboré | ⏳ *Pendente de envio oficial* | Solicitar foto oficial de culto de celebração. |
| **C. Acolhimento / Voluntários** | Voluntários da recepção/tráfego acolhendo pessoas na entrada | Vertical ou 4:5, foco no sorriso e acolhimento humano | ⏳ *Pendente de envio oficial* | Solicitar foto da equipe de Diaconia / Recepção / Tráfego. |
| **D. Grupos de Crescimento** | Encontro de GC em residência | Horizontal, ambiente acolhedor, comunhão | ⏳ *Pendente de envio oficial* | Solicitar foto oficial de GC com autorização de imagem dos membros. |
| **E. Batismo** | Celebração de batismo no tanque batismal de Alphaville | Horizontal ou quadrada, momento emocionante de celebração | ⏳ *Pendente de envio oficial* | Solicitar foto dos batismos recentes. |
| **F. Espaço Kids / Link** | Sala do Lagoinha Kids / Culto Link estruturado | Horizontal, ambiente lúdico e seguro | ⏳ *Pendente de envio oficial* | Solicitar registro institucional do ministério infantil. |

> Nota: para as linhas B, D e E, o site oficial já publica uma foto candidata (ver seção 1.1) — pedir à Mídia o arquivo em alta resolução correspondente e o termo de autorização agiliza a substituição sem precisar de uma nova sessão de fotos.

---

## 3. Checklist de Solicitação à Comunicação da Igreja

Para solicitar os arquivos à equipe de comunicação (`@lagoinhaalphaville.sp` / `(11) 96175-0055`), utilize o seguinte checklist:
1. Arquivos em formato JPEG ou PNG de alta qualidade sem marcas d'água de terceiros.
2. Termo de autorização de uso institucional para o portal web e demonstração de engenharia.
3. Créditos de fotógrafo(a) voluntário(a) para inclusão nas notas de rodapé quando aplicável.


## Atualização: uso autorizado pelo usuário — 26/09/2026
O usuário confirmou nesta conversa que tem autorização da igreja para utilizar as fotos do site oficial. As quatro imagens da seção 1.1 foram incorporadas sem alteração de seus bytes em public/assets/official/. As pendências anteriores de autorização dessas quatro imagens estão resolvidas.
- church.jpg: pessoas durante culto, 1000×563; abertura. Não é fotografia da fachada.
- group.jpg: celebração coletiva, 1440×1080; participação. Não comprova um encontro de GC residencial.
- baptism.webp: batismo, 328×455; mantida em dimensão compatível com sua resolução.
- volunteers.jpg: oração coletiva, 2048×1536; seção de voluntariado, sem afirmar função específica das pessoas.
Fotógrafos e datas não informados na fonte consultada; crédito ao site de origem, sem inventar autoria. Fotos específicas de fachada, estacionamento real e Kids continuam pendentes.
