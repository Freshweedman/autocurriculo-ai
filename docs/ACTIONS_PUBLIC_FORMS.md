# Candidaturas públicas pelo GitHub Actions

## Limite deliberado

O fluxo só processa páginas HTTPS de Greenhouse, Lever, Ashby, Workable e Recruitee sem login. LinkedIn e Indeed ficam fora. CAPTCHA, login, perguntas sem resposta e qualquer formulário não reconhecido viram `needs_action`. O histórico antigo tinha sessões e credenciais globais, removidas do fluxo principal em `f4c0245` e o workflow de navegador foi substituído por descoberta em `9b24be8`.

O teste antigo `TEST-APP-001` cobre um servidor controlado. `PUBLIC-FORM-001` também cobre inspeção, anexo PDF, reserva antes do clique e confirmação em um Greenhouse simulado. Eles não são prova de envio a uma vaga real.

## Operação

1. Aplicar `014_public_application_batches.sql` no SQL Editor do Supabase.
2. Criar um token fine-grained GitHub limitado ao repositório e somente permissão Actions de leitura e escrita.
3. Configurar na Vercel `ACTIONS_PUBLIC_APPLICATION_TOKEN`, `ACTIONS_PUBLIC_APPLICATION_WORKER_SECRET` com pelo menos 32 caracteres e `PUBLIC_APPLY_LIVE=enabled` somente depois do teste aprovado.
4. Configurar os mesmos segredos necessários no GitHub Actions. O workflow usa `PUBLIC_APPLICATION_WORKER_SECRET`, URL Supabase e service role. Segredos nunca vão nos inputs ou logs.
5. Na tela Busca de vagas, verificar os formulários, aprovar no máximo dez e só então enviar o lote. A aprovação expira em 24 horas.

O workflow tem concorrência por usuário por meio de um HMAC opaco. A fila reserva cada envio no banco imediatamente antes do clique. O limite é dez tentativas por usuário por dia e cinquenta globais. Capturas de confirmação vão para o bucket privado `runner-evidence`. Não há artefato de Actions.

## Telegram opcional

Crie o bot e configure o webhook para `https://SEU_DOMINIO/api/telegram/public-apply` com o mesmo segredo de `PUBLIC_TELEGRAM_WEBHOOK_SECRET`. Defina também `PUBLIC_TELEGRAM_BOT_TOKEN` e `PUBLIC_TELEGRAM_BOT_USERNAME` na Vercel. O vínculo usa um código de uso único que vence em dez minutos.

## Custo e restrições atuais

| Serviço | Plano | Limite relevante | Ao exceder | Custo |
| --- | --- | --- | --- | --- |
| Supabase | Free | projeto pode pausar por inatividade | fila e painel param até reativação | R$ 0 |
| GitHub Actions | repositório público | runners hospedados são gratuitos para repositórios públicos | limites e políticas da conta se aplicam | R$ 0 |
| Vercel | Hobby | uso pessoal e não comercial | produto comercial exige outro plano | R$ 0 no piloto |
| Playwright | GitHub runner | 55 minutos por lote | lote falha e vagas restantes ficam para revisão | R$ 0 |

O primeiro gargalo é a taxa de CAPTCHA e bloqueio por IP compartilhado do GitHub. Não há alternativa gratuita confiável que substitua CAPTCHA. Se a taxa passar de 30%, mantenha a vaga em `needs_action` e use o fluxo assistido.

Fontes oficiais: [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel Fair Use](https://vercel.com/docs/limits/fair-use-guidelines), [Supabase Free](https://supabase.com/pricing), [pausa Supabase](https://supabase.com/docs/guides/platform/free-project-pausing), [GitHub Actions billing](https://docs.github.com/en/actions/concepts/billing-and-usage), [agenda GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html), [Lever postings API](https://github.com/Lever/postings-api#apply-to-a-job-posting), [Ashby applicationForm.submit](https://developers.ashbyhq.com/reference/applicationformsubmit), [Gupy autenticação](https://developers.gupy.io/v2.0/docs/autentica%C3%A7%C3%A3o-e-autoriz%C3%A7%C3%A3o).
