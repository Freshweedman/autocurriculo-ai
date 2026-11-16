# AutoCurriculo AI Runner

O site publicado na Vercel cria as tarefas de publicacao no Supabase. Quem abre Mercado Livre, GGMAX, OLX, Facebook e outros sites no navegador e tenta preencher os campos e este runner local.

Ele nao clica no envio final. O runner para em `aguardando_confirmacao` para voce revisar login, categoria, preco, imagens, captcha e regras do marketplace.

## Rodar

```bash
cd automation-runner
pip install -r requirements.txt
playwright install chromium
python runner.py
```

## Modos

- Semi automatico: cria a fila, abre o navegador, preenche o que encontrar e para para revisao.
- Full automatico: reservado para integracoes oficiais por API com token valido. Quando o canal depende de navegador, login, captcha, categoria ou botao final de marketplace, ele volta para revisao humana.

Depois, no painel:

1. Cadastre um servico.
2. Abra `Panfletagem`.
3. Escolha `Semi automatico` ou `Full automatico`.
4. Clique em `Criar fila + runner`.
5. Abra `Autopilot`.
6. Com o runner local ligado, chame `POST http://localhost:8765/poll` ou execute uma tarefa especifica com `POST http://localhost:8765/run/{task_id}`.
7. Revise o navegador aberto e publique manualmente quando estiver correto.

## Plataformas com runner

- Mercado Livre: abre a pagina de anuncio e tenta preencher campos comuns.
- GGMAX: abre a area de anuncios e tenta preencher campos comuns.
- OLX: tenta preencher titulo e descricao.
- Facebook Marketplace: tenta preencher titulo.
- Workana e 99Freelas: abre a pagina e deixa a proposta pronta para copiar/revisar.
- GetNinjas: abre a plataforma e tenta preencher campos comuns quando aparecerem.

## Canais de API oficial

Estes canais aparecem na fila, mas so viram `full automatico` depois que voce conectar app/token oficial:

- Paginas do Facebook e Instagram profissional via Meta Graph API.
- Pinterest via Pinterest API.
- Google Business Profile.
- Mercado Livre via API/OAuth de vendedor.
- WhatsApp Cloud API apenas para contatos com opt-in.

Campos podem mudar porque marketplaces alteram HTML com frequencia. Quando o runner nao acha um campo, ele tira screenshot e deixa a tarefa para revisao manual.
