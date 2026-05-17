# AutoCurriculo AI

SaaS de automacao de candidaturas de emprego. Encontra vagas, envia curriculos automaticamente e coleta leads de empresas via Google.

---

## Arquitetura

```
autocurriculo-ai/
├── src/                          # Next.js 14 App (Frontend + API)
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
├── bot-engine/                   # Bot Playwright (roda no GitHub Actions)
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
- **Bot Auto** - Playwright com delay humano, evita deteccao
- **Indeed** - Login + busca + candidatura simplificada + upload PDF
- **Plataformas genericas** - Detecta `<input type="file">` automaticamente
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

### 3. GitHub Actions (Bot)

1. No GitHub, va em **Settings > Secrets and variables > Actions**
2. Adicione os seguintes secrets:

| Secret | Descricao |
|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key do Supabase |
| `BOT_API_KEY` | Chave aleatoria p/ webhook auth |
| `API_URL` | URL do deploy Vercel |
| `INDEED_EMAIL` | Email da conta Indeed (secundaria) |
| `INDEED_SENHA` | Senha da conta Indeed |

3. Va em **Actions > AutoCurriculo AI Bot > Run workflow**

O bot roda automaticamente Seg-Sex as 9h BRT.

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
