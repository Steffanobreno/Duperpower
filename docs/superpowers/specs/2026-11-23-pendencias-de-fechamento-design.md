# Pendências: visitas para concluir e para receber (design curto)

Data: 2026-11-23. Aprovado pelo dono na conversa ("Okay pode fazer assim").

## Por quê
Hoje o dono procura visita por visita o que ficou sem concluir ou sem receber. Ele quer ver tudo de uma vez, por dia, semana ou mês, e fechar dali mesmo.

## O que é
**Tela "Pending"** (`/pending`), no menu lateral e com um número ao lado.
- No topo: **Day / Week / Month**, com setas ‹ › para o período anterior ou o seguinte. Abre na semana atual (de segunda a domingo, como o calendário).
- **Dois grupos**, cada um com quantidade e valor:
  - **To close:** a visita terminou (end_at < agora), mas o status ainda é unconfirmed, confirmed, en_route ou in_progress. O botão **Mark done** conclui e abre o checkout (a ação de status que já existe faz isso).
  - **To collect:** a visita está completed, mas sem cobrança fechada (sem invoice com status closed). O botão **Take payment** abre o checkout.
- Cada linha mostra o dia, o horário, o cliente, os pets e o valor (soma dos serviços). Tocar na linha abre a visita.
- Quando há pendências antes do período mostrado, aparece "N more before this", com um link para o período da mais antiga.
- **Tela Hoje:** um cartão "N visits to close or collect ›" quando N > 0.
- **Permissão:** a de pagamentos (a tela mostra valores e leva ao checkout).

## A partir de quando conta
A partir do dia (no fuso do negócio) do **primeiro pagamento fechado no app** (min(invoices.closed_at) com status closed). Antes disso as visitas vieram do app antigo e não têm pagamento aqui. Sem nenhum pagamento fechado ainda, conta tudo.

## Fora do escopo
- Fechar várias visitas de uma vez.
- Lembretes automáticos de pendência.

## Abordagens
- A, escolhida: uma tela própria com períodos e dois grupos.
- B: filtros em Relatórios. Descartada: Relatórios só mostra totais, e o dono quer agir em cada visita.

## Teste
`tests/e2e/pending.mjs`.
