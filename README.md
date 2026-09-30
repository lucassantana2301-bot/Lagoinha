# ⛪ Lagoinha Parking Monitor & Portal Interativo

> **Sistema inteligente de monitoramento de estacionamento em tempo real e portal institucional cinematográfico para a Igreja Lagoinha Alphaville.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: Tests Passing](https://img.shields.io/badge/Tests-Passing-success.svg)]()

---

## 📋 Visão Geral

O **Lagoinha Parking Monitor** é uma solução completa desenvolvida para transformar a gestão de tráfego, vagas e a experiência dos membros e visitantes nos dias de culto. O sistema integra:

1. **Monitoramento Inteligente em Tempo Real**: Telemetria ao vivo de ocupação de setores do estacionamento (Pátio Principal, Subsolo, Anexo, etc.).
2. **Painel da Entrada / Guarita**: Exibição semafórica de alta legibilidade a distância para guiar o fluxo de veículos instantaneamente.
3. **Terminal Mobile para Voluntários**: Interface ergonômica com botões grandes (*touch-targets* de 64px) para interdições, liberações rápidas e overrides manuais com expiração automática de segurança.
4. **Módulo de Visão Computacional (Python / OpenCV)**: Detecção automática de veículos em zonas poligonais via câmeras RTSP ou webcams locais.
5. **Portal Institucional Cinematográfico**: Navegação interativa com cena 3D da igreja, profundidade de camadas, indicação dinâmica do próximo culto e galeria de fotos.

---

## 🚀 Funcionalidades Principais

### 🚗 Gestão de Estacionamento
- **Painel de Decisão em Tempo Real**: Cores semafóricas (Verde, Laranja, Vermelho, Roxo para incerteza) indicando onde direcionar os carros.
- **Rastreabilidade da Informação**: Distinção clara entre dados manuais (Voluntário), detecção automática (IA) e modo simulação.
- **Detector de Quedas de Conexão**: Banners de alerta pulsantes quando os dados de telemetria perdem sinal (> 5s / > 20s).
- **Editor de Polígonos**: Ferramenta visual interativa para calibrar setores de vagas sobre feeds de câmeras.

### 📱 Terminal do Voluntário
- Otimizado para operação com uma só mão no celular.
- Ações com resposta tátil e toasts não-bloqueantes.
- Proteção por `VOLUNTEER_TOKEN` em ambiente de produção.
- Interdições com expiração automática em 5 minutos para evitar bloqueios acidentais esquecidos.

### ✨ Portal Interativo
- **Cena 3D & Depth Effect**: Renderização volumétrica interativa da fachada da igreja.
- **Contador do Próximo Culto**: Cálculo preciso do culto em andamento ou do próximo horário com contagem regressiva.
- **Design Bento Grid & Dark Mode**: Estética moderna com vidro fosco (*glassmorphism*), iluminação suave e microinterações.

---

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js, Express, SSE (Server-Sent Events) / Polling de baixa latência.
- **Frontend**: HTML5 Semântico, CSS3 Moderno (CSS Variables, Flexbox/Grid, Glassmorphism, GPU Accelerated Animations), Vanilla JavaScript modular.
- **Visão Computacional**: Python 3.10+, OpenCV (`cv2`), NumPy, Requests.
- **Testes Automatizados**: Suíte de testes para regressão, segurança, regras de culto e integridade de estilos.

---

## 📂 Estrutura do Projeto

```text
├── ai_engine/               # Módulo de visão computacional em Python
│   ├── detector.py          # Script de detecção em tempo real e envio de telemetria
│   └── requirements.txt     # Dependências Python (opencv, numpy, requests)
├── data/                    # Dados persistentes
│   └── zones.json           # Definição e calibração dos polígonos das vagas
├── public/                  # Frontend estático servido pelo Node.js
│   ├── assets/              # Imagens, fotos oficiais e texturas
│   ├── css/                 # Estilos (bento, dark mode, parking polish, motion)
│   ├── js/                  # Módulos JS (app, church-depth, simulator, polygon-editor)
│   └── index.html           # Página principal do portal e aplicação
├── tests/                   # Suítes de testes unitários e de integração
│   ├── regression.cjs       # Testes de regras de negócio e telemetria
│   ├── security.cjs         # Validação de tokens e proteção de rotas
│   ├── next-service.cjs     # Lógica de cálculo de horários de cultos
│   └── antigravity/         # Testes de isolamento de escopo e qualidade do parking polish
├── server.js                # Servidor Express, APIs e gerenciamento de estado
├── package.json             # Metadados e scripts do projeto
├── DEPLOY.md                # Guia detalhado de deploy em produção
└── README.md                # Este documento
```

---

## ⚡ Como Executar Localmente

### Pré-requisitos
- **Node.js** >= 18.x
- **Python** >= 3.10 (opcional, para o módulo de IA)

### 1. Iniciar o Servidor Web
Clone o repositório e inicie o servidor:

```bash
# Instalar dependências (caso necessário)
npm install

# Iniciar o servidor Node.js
npm start
```

Acesse no navegador:
👉 **`http://localhost:3000`**

### 2. Executar os Testes Automatizados
```bash
npm test
```

---

## 🤖 Executar o Módulo de Detecção por IA (Opcional)

Para alimentar o sistema com dados reais de câmeras de segurança:

```bash
# 1. Acesse o diretório do detector
cd ai_engine

# 2. Crie e ative um ambiente virtual
python -m venv venv
# No Windows:
venv\Scripts\activate
# No Linux/Mac:
source venv/bin/activate

# 3. Instale as dependências
pip install -r requirements.txt

# 4. Execute apontando para uma webcam, arquivo de vídeo ou stream RTSP
python detector.py --source 0
# Ou com RTSP:
# python detector.py --source rtsp://usuario:senha@ip_da_camera:554/stream
```

---

## 🌐 Deploy em Produção

Consulte o arquivo [`DEPLOY.md`](DEPLOY.md) para detalhes completos de infraestrutura.

### Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `NODE_ENV` | Sim | Definir como `production` |
| `VOLUNTEER_TOKEN` | Sim (em produção) | Chave secreta da equipe para autorizar ações operacionais |
| `PORT` | Automática | Porta HTTP (definida pela plataforma de hospedagem) |

> **Nota:** Como o servidor armazena os polígonos em `data/zones.json`, monte um volume persistente apontando para a pasta `data/` em hosts como Railway, Render ou Fly.io.

---

## 👥 Autoria e Licença

Desenvolvido para e por **Lagoinha Tech & Voluntários**.  
Licenciado sob a [MIT License](LICENSE).
