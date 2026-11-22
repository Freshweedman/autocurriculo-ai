# Diagnóstico do fluxo START

| Commit | Evidência no código |
| --- | --- |
| `f9f654c` | Chromium/Playwright no GitHub Actions, cron em dias úteis e webhook para gravar candidaturas no Supabase. |
| `e7f711b` | Adicionou autenticação, paginação e limites para Indeed, InfoJobs, LinkedIn e adaptadores genéricos. |
| `f9f158c` | Login manual no Chrome, exportação de `storageState` e importação no runner por `SESSION_STATE`. O mesmo estado podia conter sessões de vários sites. Indeed, InfoJobs e LinkedIn usavam esse contexto. |
| `b1dda21` | O setup passou a usar `launchPersistentContext` com o perfil do Chrome. A execução continuou consumindo o estado exportado. |
| `e74aa4b` | O botão passou a disparar `workflow_dispatch` no GitHub. |
| `f4c0245` | Retirou `SESSION_STATE` do workflow e do motor ativo, trocou a sessão exportada por conexões cifradas individuais e mudou a execução para descoberta assistida. O setup local ainda exportava arquivos que o workflow deixou de ler. O uso do LinkedIn foi retirado do motor. O runner Python era voltado aos canais de publicação. |
| `6b2472e`, `b643d27`, `7348248` | Reintroduziram consentimento, verificação de confirmação, upload e formulário em etapas. O botão ainda disparava um runner efêmero. O Indeed era percorrido após login e a deduplicação do webhook só acontecia depois da tentativa. |
| `5259960`, `7490dbc` | Adicionaram eventos de execução, vínculo privado às oportunidades e descoberta pública com filtros. A descoberta pública tinha alcance restrito e não utilizava o perfil local. |

O histórico mostra a arquitetura e a intenção de envio, mas não comprova o volume relatado. O motor antigo contabilizava retornos `enviado`, sem exigir prova externa. Preserve o perfil de busca, o currículo padrão, o consentimento individual, os registros de execução e a evidência de confirmação. Reutilize Playwright, a leitura de vagas e os formulários existentes. Mantenha a sessão no perfil dedicado do Windows.
