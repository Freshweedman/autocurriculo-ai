# AutoCurriculo AI

Painel web para encontrar vagas e preparar candidaturas pelo celular. A busca roda no servidor e pode ser agendada para dias úteis. Na página de vagas, baixe seu PDF, abra o portal e registre o envio após se candidatar.

---

## Arquitetura

```
autocurriculo-ai/
├── src/                          # Next.js (Frontend + API)
│   ├── app/
│   │   ├── login/               # Pagina de login
│   │   ├── register/            # Pagina de registro
│   │   ├── dashboard/           # Painel SaaS
│   │   │   ├── candidaturas/    # Historico de candidaturas
│   │   │   ├── leads/           # Leads coletados
│   │   │   └── configuracoes/   # Config do bot
│   │   └── api/
│   │       └── webhook/         # APIs para o bot engine
│   ├── components/              # Componentes reutilizaveis
│   └── lib/supabase/            # Clientes Supabase
│
├── bot-engine/                   # Busca de vagas no servidor
│   ├── bot.js                    # Entry point
│   ├── platforms/               # Integracoes por plataforma
│   │   ├── indeed.js
│   │   └── generic.js
│   ├── scraper-google.js        # Coleta leads do Google
│   └── utils/                   # Delay, logger
│
├── .github/workflows/
│   └── bot.yml                  # GitHub Actions cron job
│
└── supabase/migrations/
    └── 001_schema.sql           # Schema do banco
```

---

## Funcionalidades

- **Dashboard Web** - Upload curriculo, configurar cargo/cidade, limite diario
- **Busca automática** - Busca por cargo e localização em dias úteis.
- **Candidatura assistida** - PDF privado, link do portal e registro do envio.
- **Google Scraper** - Coleta empresas, telefones, emails, sites
- **Historico** - Acompanha candidaturas e leads em tempo real
- **100% Gratis** - GitHub Actions ilimitado (repos publicos)

---

## Deploy (passo-a-passo)

### 1. Supabase

1. Crie conta em [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Va em **SQL Editor** > cole o conteudo de `supabase/migrations/001_schema.sql`
4. Va em **Project Settings > API** e copie `URL` e `anon key`
5. Va em **Storage** > crie um bucket chamado `curriculos` (privado)

### 2. Vercel

1. Faca fork deste repositorio (ou crie seu proprio)
2. Va em [vercel.com](https://vercel.com) > New Project > Importe o repo
3. Configure as variaveis de ambiente (`.env.example` como referencia)
4. Deploy

### 3. Busca de vagas no servidor

Configure os secrets de Supabase, GitHub Actions e o webhook do projeto. O workflow `bot.yml` atende buscas solicitadas no painel e agendamentos em dias úteis. Consulte `.env.example` para os nomes das variáveis.

---

## Rodar localmente

```bash
# Frontend
cd autocurriculo-ai
npm install
cp .env.example .env  # Configure o .env
npm run dev

# Bot Engine (teste local)
cd bot-engine
npm install
npx playwright install chromium
node bot.js
```

---

## Tecnologias

| Camada | Tech |
|--------|------|
| Frontend | Next.js 14 + TailwindCSS |
| Backend API | Next.js API Routes |
| Auth | Supabase Auth (email+senha) |
| Database | Supabase PostgreSQL |
| Storage | Supabase Storage |
| Bot Engine | Playwright (Node.js) |
| Bot Hosting | GitHub Actions |
| Frontend Hosting | Vercel |

---

## Avisos

- Use **contas secundarias** no Indeed (risco de banimento)
- Rode **maximo 1x por dia** por conta
- Selectors podem quebrar com atualizacoes dos sites
- Mantenha curriculo otimizado para ATS
