# Runner local de candidaturas no Windows

O painel grava START e STOP no Supabase. O Node.js consulta esse comando a cada cinco segundos e abre um Chrome com perfil dedicado em `%LOCALAPPDATA%\AutoCurriculo\browser-profile`. Cookies, código de vínculo e capturas locais ficam no computador. A publicação de anúncios tem seu próprio runner.

## Instalação

1. Instale Node.js 22 ou superior e Google Chrome.
2. No painel, configure cargo, cidade, limite diário global, dados profissionais e currículo PDF. Na Central de Automação, você pode escolher outro currículo, ajustar limites por plataforma e informar respostas usando o texto exato de cada pergunta.
3. Em um terminal na raiz do repositório, rode `automation-runner\runner.bat instalar`.
4. Na Central de Automação, gere um código de vínculo. Rode `automation-runner\runner.bat vincular` e cole o código. O comando inicia o runner após o vínculo.
5. Para entrar no Indeed, encerre o runner com Ctrl+C e rode `automation-runner\runner.bat login`. Conclua o login pela interface do site, inclusive Google quando for o método usado pela sua conta. Feche o Chrome dedicado ao terminar. Use `automation-runner\runner.bat verificar-login` para reabrir o perfil, verificar a sessão e capturar a tela se o estado logado for reconhecido.
6. Rode `automation-runner\runner.bat --dry-run` e use START no painel para testar. O runner guarda as capturas em `%LOCALAPPDATA%\AutoCurriculo\evidence`. Um teste só alcança o botão final quando o runner reconhece o formulário, todas as respostas e o anexo. Use STOP e Ctrl+C para encerrar o teste.
7. Para descoberta contínua, rode `automation-runner\runner.bat` e use START. O Chrome e o terminal precisam permanecer abertos. O STOP impede novas reservas de envio. Se a plataforma já recebeu um clique, o runner registra o resultado dessa tentativa.

## Descoberta e candidatura

- Para medir a descoberta sem vínculo ou conta no painel, rode `automation-runner\runner.bat buscar "analista de qualidade" "Porto Alegre"`. Cada linha lista a fonte, vagas lidas, compatíveis e URLs individuais.
- A busca amplia cargos e regiões em etapas. Os adaptadores consultam Indeed BR, Vagas.com, Catho, InfoJobs, Gupy, Trabalha Brasil e os portais públicos Greenhouse, Lever e Ashby. Use `AUTOCURRICULO_GREENHOUSE`, `AUTOCURRICULO_LEVER` e `AUTOCURRICULO_ASHBY` no terminal para indicar identificadores de empresas separados por vírgulas.
- Para LinkedIn, Glassdoor e SINE, use os links manuais no painel. Fontes sem fluxo de envio reconhecido encaminham a vaga à revisão ou marcam o formulário externo.
- O envio pelo Indeed requer permissão da plataforma, além do consentimento individual configurado no painel. Use `set AUTOCURRICULO_INDEED_ENVIO_AUTORIZADO=1` no cmd somente quando tiver essa permissão. A primeira candidatura real depende da aprovação explícita da vaga. Para limitar o envio à vaga aprovada, passe `runner.bat "--vaga=https://br.indeed.com/viewjob?jk=ID"`. A descoberta só inclui essa URL se ela corresponder ao filtro. Sem a variável o runner consulta o portal e encaminha a candidatura à revisão.
- O Supabase reserva tentativas entre 09h e 18h de segunda a sexta no horário de São Paulo. O padrão é de 30 tentativas por plataforma, sujeito ao limite diário global do perfil. Quando falta uma resposta, o painel mostra o campo a revisar. CAPTCHA, bloqueio ou logout pausam a plataforma. Resolva a verificação no navegador e reinicie o runner.
- Uma tentativa segue para o contador somente quando o navegador captura texto novo de confirmação. O Supabase grava a prova e o histórico na mesma transação. A captura fica disponível no painel quando o upload privado é aceito. Se o navegador cair depois de reservar o envio, confira o histórico do portal. A mesma vaga fica protegida contra novo envio.

## Publicação

Aplique `supabase/migrations/012_local_runner.sql` após a migration 011 no Supabase do projeto e publique a versão correspondente no Vercel. O servidor usa as variáveis Supabase que o painel já possui. O runner local usa o código de vínculo, com acesso limitado a uma conta do painel.
