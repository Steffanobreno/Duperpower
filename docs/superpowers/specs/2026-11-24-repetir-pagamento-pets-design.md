# Repetir com outro horário, tela de pagamento recebido e pets na visita (design curto)

Data: 2026-11-24. Aprovado pelo dono na conversa (opção "a" para pet que morreu).

## O que muda
1. **Repeat → Every few weeks:** campo "Time for the next visits", que começa no horário desta visita. As próximas visitas da série são marcadas nesse horário. Esta visita mantém o horário dela (para mudá-la, use o Reschedule). Ao reabrir, o campo mostra o horário da próxima visita da série.
2. **Payment received** (`/appointments/[id]/paid`): abre quando a conta é paga por inteiro, seja num pagamento ou em "Finish order" sem nada a cobrar. A tela mostra:
   - um ✓, o valor, a gorjeta, o cliente, os pets e a forma de pagamento;
   - os botões Book next visit, Client history, See receipt, Back to Today e Edit order;
   - as ações do recibo (enviar por e-mail, Text, WhatsApp).

   Um pagamento parcial continua no checkout.
3. **Seta ←** nessa tela: vai para Today, substituindo a tela no histórico. O checkout também é substituído pela tela nova, para que o Voltar do celular não caia no pagamento de novo. "Edit order" é o caminho de volta ao checkout.
4. **Pets na visita:**
   - Tocar no pet abre o perfil dele.
   - "Remove {name} from this visit" aparece quando a visita tem 2 ou mais pets, e pede confirmação. A visita fica mais curta e a conta é atualizada.
   - **Passed away:** o pet sai das visitas futuras que têm outros pets. As visitas futuras em que ele é o único pet aparecem no perfil dele, com "Cancel these visits". Nenhuma mensagem é enviada ao cliente.

## Abordagens
- **Horário:**
  - escolhida: um único horário para as próximas visitas;
  - descartada: um horário por data no modo "Every few weeks". O "Pick dates" já permite isso.
- **Pagamento:**
  - escolhida: uma tela própria depois do checkout;
  - descartada: só um aviso no checkout. É o que existia, e o dono pediu uma tela.
- **Pet que morreu:**
  - escolhida, (a): tirar o pet das visitas com outros pets e listar para cancelar as visitas em que ele é o único;
  - descartada, (b): só avisar.

## Testes
`tests/e2e/repeat-time.mjs`, `tests/e2e/paid-screen.mjs` e `tests/e2e/visit-pets.mjs`.
