# Arquitetura alvo

O produto permanece Next.js + Supabase. Descoberta, ranking e candidatura são processos separados: uma fonte somente grava uma oportunidade quando há URL individual pública validada; `user_opportunities` preserva a relação privada da pessoa com o catálogo; candidaturas só são confirmadas com evidência persistida.

`automation_runs` representa uma execução; eventos e itens pertencem à execução e ao usuário. GitHub Actions é somente worker efêmero. Não deve ser usado para manter sessão, cookies compartilhados ou processos persistentes.

Adaptadores são classificados por capacidade: descoberta, preparação assistida, envio confirmado ou indisponível. Um adaptador não sobe de capacidade apenas por abrir uma página ou clicar num botão.
