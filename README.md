# Rota Saúde — wpda (frontend do cidadão)

A única app do Rota Saúde voltada ao **cidadão**. Vive no host da cidade
(`<cidade>.rotasaude.app/wpda/`), e o subdomínio diz ao Rails qual cidade
servir. Faz duas coisas:

1. **Canal web do cidadão** (ADR 0017): fazer a triagem, acompanhar as
   triagens e gerar os códigos para o atendimento presencial (ADR 0018).
2. **Relatório público por token**: o resultado congelado de uma triagem,
   aberto por link, sem login.

Vite + React + TypeScript + React Query. Consome o `api` (Rails, repo
`rotasaude/api`). Decisões arquiteturais em `rotasaude/docs`.

## Papel no ecossistema

| App | Quem usa | Alcance |
|---|---|---|
| **wpda** (este) | Cidadão | Uma cidade |
| `dashboard` | Equipe da prefeitura | Uma cidade (`<cidade>.rotasaude.app/dashboard/`) |
| `admin` | Operador da plataforma | Catálogo de cidades, provisionamento, entrada nas cidades via grant |
| `maintenance` | Mantenedor (superusuário) | Todas as cidades, só em development/staging |

O canal web substituiu o WhatsApp como entrada do cidadão. O que acontece aqui
aparece para a equipe da cidade no dashboard (triagens, filas, balcão de
atendimento).

## Fluxos

`App.tsx` escolhe o fluxo pela URL: com `?token=` abre o relatório; sem ele,
abre o canal web.

### Canal web (`src/modules/citizen/Flow.tsx`)

Uma máquina de telas sem biblioteca de rotas. Um F5 volta ao começo, mas a
sessão (cookie) é preservada.

1. **Telefone** → código por SMS (`POST /citizen/otp`).
2. **Código** → abre a sessão (`POST /citizen/session`, cookie httpOnly
   `citizen_session`).
3. **Consentimento**: o termo vigente; recusar encerra.
4. **Pessoas**: escolher alguém já declarado ou **declarar um CPF** (a
   identidade é declarada, não comprovada; a comprovação é presencial).
5. **Perguntas** do protocolo ativo da cidade, com desfazer e chave de
   idempotência por resposta.
6. **Resultado**: espera o job gerar o relatório e mostra o mesmo relatório do
   link público.
7. **Minhas triagens**: histórico, com **Validar no posto** (código que o
   atendente confere para validar a identidade) e **Cheguei na unidade**
   (código de check-in do atendimento).

Os códigos de balcão são de 6 dígitos, vencem em minutos e podem ser gerados de
novo. Só o pedido mais recente vale na tela; um código já invalidado não
"vence" por chegar atrasado.

Conflitos que uma nova tentativa não resolve, como termo trocado no meio da
triagem, consentimento revogado em outra aba ou conversa expirada, mandam o
cidadão para a tela que resolve cada caso, em vez de um erro genérico.

### Relatório público (`src/modules/Report.tsx`)

`/wpda/?token=<token>` busca o JSON congelado de `GET /r/:token`, sem login.
404 significa token inválido ou expirado. Sem recomendação do protocolo, a tela
mostra uma orientação genérica.

## Como rodar em dev

O app roda como o serviço `wpda` do `docker-compose.yml` da raiz do monorepo:

```bash
docker compose up -d api wpda
docker compose exec api bin/rails db:seed
```

- Canal web: **http://curitiba.localhost:5176/wpda/** (ou `maringa`).
- Relatório: **http://curitiba.localhost:5176/wpda/?token=<token>**. O
  `db:seed` imprime o link do relatório semeado de cada cidade.

Em `localhost` puro nenhuma cidade é resolvida.

**Código SMS em dev:** não há provedor de SMS. O api usa
`config.x.otp_sender = :log`, e o código aparece no log do api:

```bash
docker compose logs -f api | grep "\[otp\]"
```

O provedor real de SMS é pendência de go-live; sem ele, fora de dev, o envio
responde 503.

Fora do Docker:

```bash
cp .env.example .env
npm install
npm run dev        # porta 5173; o compose publica em 5176
```

O Vite proxa `/up`, `/r` e `/citizen` para `VITE_API_PROXY_TARGET` com
`changeOrigin: false`. **Não troque para `true`**: o proxy reescreveria o Host
para o alvo e nenhuma cidade chegaria ao Rails.

| Var | Default | Uso |
|---|---|---|
| `VITE_API_PROXY_TARGET` | `http://localhost:3030` (`http://api:3000` no compose) | alvo do proxy em dev |

## Estrutura

```
src/
├── main.tsx, App.tsx      ← App escolhe relatório (?token=) ou canal web
├── lib/
│   ├── citizenApi.ts      ← cliente das rotas /citizen/* (cookie same-origin, escrita só em JSON)
│   ├── report.ts          ← token da URL e leitura de /r/:token
│   ├── masks.ts, format.ts
├── modules/
│   ├── Report.tsx         ← relatório público
│   └── citizen/           ← Flow e uma tela por passo (Phone, Code, Consent, People,
│                             Question, Result, History, VerificationCode, CounterCode)
├── theme/                 ← tokens e CSS global
└── test/setup.ts
```

## Testes e CI

```bash
npm run typecheck
npm test           # vitest: lib e telas do fluxo
npm run build
```

A CI (`.github/workflows/ci.yml`) roda os três em todo push para `main` e em
todo PR.

## Build de produção

O `Dockerfile` gera a SPA e a serve com nginx sob `/wpda/` (`nginx.conf`).

## Princípios

- **Uma cidade por host.** Sessão e dados do cidadão ficam no banco da cidade.
- **O celular é o alvo.** Botões grandes (mínimo de 48 px), uma pergunta por
  tela, sem depender de biblioteca de rotas.
- **Erros levam a uma saída.** Cada conflito conhecido leva à tela que resolve;
  o erro genérico é o último recurso.
- **O relatório é congelado.** O link mostra o que foi calculado no fim da
  triagem, não um recálculo.
