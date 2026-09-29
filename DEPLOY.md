# Deploy

O servidor (`server.js`) guarda o estado dos setores em memória e grava os polígonos em `data/zones.json`. Por isso ele precisa de **um processo Node contínuo com disco persistente**. Não funciona em funções serverless (Vercel, Netlify Functions): cada requisição poderia cair numa instância diferente, com outro estado.

Hosts compatíveis: Render (Web Service + Disk), Railway (serviço + Volume), Fly.io (Machine + Volume) ou uma VPS.

## Variáveis de ambiente

| Variável | Obrigatória | Uso |
|---|---|---|
| `VOLUNTEER_TOKEN` | Sim, em produção | Código da equipe exigido para interditar/liberar setores, salvar polígonos e enviar telemetria do detector. O servidor não sobe com `NODE_ENV=production` sem ele. Use um valor longo e aleatório. |
| `NODE_ENV` | Sim | `production` |
| `PORT` | Definida pelo host | Porta HTTP |

O código é pedido uma vez em cada aparelho de voluntário e fica salvo no navegador. Para trocá-lo, altere a variável e reinicie: os aparelhos pedem o código novo na próxima ação recusada.

## Passos (qualquer host da lista)

1. Criar o serviço apontando para este repositório. Build: nenhum. Start: `npm start`.
2. Montar um volume persistente em `<raiz do app>/data`, para os polígonos sobreviverem a novos deploys.
3. Definir `NODE_ENV=production` e `VOLUNTEER_TOKEN`.
4. Conferir após publicar:
   - `GET /` carrega o portal;
   - `GET /api/state` responde JSON;
   - uma ação no Terminal do Voluntário pede o código e é aceita com ele.

## Detector Python (`ai_engine/detector.py`)

Roda perto das câmeras e envia telemetria ao servidor publicado:

```
PARKING_SERVER_URL=https://<seu-host> VOLUNTEER_TOKEN=<mesmo código> python ai_engine/detector.py --source rtsp://...
```

## Verificação local antes de publicar

```
npm test
NODE_ENV=production VOLUNTEER_TOKEN=teste npm start
```

## Limites conhecidos

- Estado dos setores em memória: um reinício zera interdições ativas, que já expiram sozinhas em 5 minutos.
- Um único código para toda a equipe, sem registro individual de quem agiu além do nome informado.
- HTTPS vem do host; o servidor não o termina.
