# AutoCurriculo AI — progresso de implementação

## Auditoria inicial — 2026-11-17

- Estado inicial preservado: `main` em `6b2472e` e árvore de trabalho limpa.
- Descoberta assistida dependia de Remotive, Arbeitnow e Remote OK sem filtro de país, modalidade ou perfil de busca. Isso explica vagas internacionais e irrelevantes.
- O webhook de oportunidades recebia `userId`, mas gravava somente o catálogo global. Não criava o vínculo privado em `user_opportunities`.
- O runner registrava resultados de candidatura com status vindo dos adaptadores. Esses adaptadores não comprovam de maneira uniforme a confirmação externa; portanto, o fluxo não é confiável para usar `enviado` como prova.
- Execuções do bot não tinham eventos persistentes nem identificação apresentada à pessoa usuária.
- A interface mistura CSS legado e estilos inline. A reconstrução será feita após os dados e estados reais serem expostos.

## Em andamento

- [x] Seis referências clonadas fora da árvore do produto e licenciadas auditadas.
- [x] Validação conservadora de URLs públicas individuais, com bloqueio de páginas de busca/listagem.
- [ ] Adaptadores brasileiros com fontes autorizadas e URLs individuais verificadas.
- [ ] Reconciliação dos registros técnicos legados em área de auditoria.
- [x] Migration aditiva 011 para observabilidade de automação, itens da execução e evidências de candidatura.
- [x] Filtros Brasil/localidade e ranking determinístico para fontes públicas.
- [x] Associação privada das oportunidades descobertas ao usuário.
- [x] Execução manual com `automation_run` persistido e feedback correto.
- [x] Central de automação com polling controlado, histórico e eventos reais.
- [ ] Aplicar migration 011 no Supabase e validar uma execução autenticada ponta a ponta.
- [ ] Consolidar o CSS legado restante e revisar as telas autenticadas em navegador com sessão de teste.

## Não validado externamente

- Nenhuma candidatura externa será marcada como confirmada sem evidência da plataforma.
- Teste RLS de dois usuários depende de tokens descartáveis ainda não configurados.
