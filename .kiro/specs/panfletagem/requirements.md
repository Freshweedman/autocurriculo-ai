# Máquina de Panfletagem Digital — Requisitos

## Visão Geral
Sistema pessoal de distribuição de anúncios de serviços em canais externos. Não é marketplace, não é rede social. É uma ferramenta de produtividade para panfletagem digital organizada.

## O que remover
- Marketplace interno (aba Explorar, anúncios de outros usuários)
- API /api/marketplace
- Página /dashboard/marketplace
- Tabela marketplace_listings

## Nova estrutura de navegação
/dashboard — visão geral
/dashboard/servicos — cadastro de serviços
/dashboard/campanhas — campanhas de divulgação
/dashboard/panfletagem — gerador de panfletos com IA
/dashboard/canais — canais externos cadastrados
/dashboard/fila — fila de publicações
/dashboard/autopilot — agente local runner
/dashboard/criativos — banco de imagens
/dashboard/leads — leads recebidos
/dashboard/historico — histórico de publicações
/dashboard/configuracoes — configurações

## Banco de dados (novas tabelas)
- services
- campaigns
- channels
- generated_pamphlets
- publishing_queue
- automation_tasks
- leads (novo schema)

## Runner Python
automation-runner/ com Playwright para preenchimento assistido em:
- OLX
- Facebook Marketplace
- Facebook Groups
- Workana
- 99Freelas
- Fiverr
- LinkedIn
- Instagram
