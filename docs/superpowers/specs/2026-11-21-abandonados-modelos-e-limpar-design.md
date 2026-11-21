# Abandonados: 20 modelos de mensagem e "Clear recovered" (design curto)

Data: 2026-11-21. Aprovado pelo dono na conversa ("Perfeito, pode fazer").

## Por quê
- O "Send to all" funcionou. O dono quer variar as mensagens para não mandar sempre o mesmo texto.
- Quer tirar da lista quem já foi recuperado, para ficar só quem ainda falta recuperar.
- **Tudo grátis:** sem IA paga (a API da Anthropic foi descartada pelo custo).

## Objetivos
1. **Menu de mensagens:** na tela "Send to all", um menu que abre e fecha (seta para baixo), com:
   - "Random: a different message for each person" (cada pessoa recebe uma das 20, sorteada);
   - a mensagem "Finish booking" do próprio negócio (de Ajustes → Mensagens; é a escolhida ao abrir);
   - "Sorry, it's fixed";
   - **20 mensagens prontas**, em inglês, com `{client}`, `{pet}`, `{business}` e `{booking_url}`.

   Escolher uma coloca o texto na caixa, onde ainda dá para editar. No "Random" a caixa some e aparece a explicação.
2. **"Clear recovered (N)":** um botão na tela Abandonados, que aparece quando há recuperados. Ele esconde todos os recuperados da lista (usa o `dismissed_at` que já existe). Os números do topo (Recuperados e Faturamento recuperado, 30 dias) **continuam contando** os escondidos.

## Fora do escopo
- IA, salvar modelos próprios (abordagem B; pode vir depois) e traduzir as 20 mensagens. Elas vão para os clientes nos EUA, em inglês como hoje.

## Abordagens consideradas
- **Mensagens:**
  - A (escolhida): 20 textos fixos no app, num menu `<select>`, mais a opção Random;
  - B: o mesmo, com "Salvar como modelo" (mais tela e mais manutenção);
  - IA: descartada pelo custo.
- **Limpar:**
  - A (escolhida): botão que esconde os recuperados, mantendo as estatísticas;
  - B: a lista já abriria sem os recuperados (o dono pediu o botão).

## Decisões do construtor (Claude)
- **O menu:**
  - é um `<select>` nativo: abre a lista do próprio celular e é acessível;
  - as 20 opções mostram o começo do texto (em inglês, sem tradução);
  - as outras opções e os textos da tela são traduzidos nos 19 idiomas, como sempre.
- **No Random:**
  - o servidor sorteia por pessoa entre as 20;
  - o assunto do e-mail é o mesmo para todos.
- **As estatísticas** passam a contar também os rascunhos escondidos que foram recuperados. Os escondidos não recuperados continuam fora, como hoje.
- **Teste:** `tests/e2e/abandoned-send-all.mjs`, ampliado.
