# Fino: roteiro técnico

Data: 2026-11-07. Os números (#) se referem à tabela de `fino-audit.md`.

## Feito (branch `google-map-tiles`, ainda não publicado)
- **P0:**
  - webhook do Stripe lê a assinatura atual (#1); nodemailer 10.1.7 (#2); cabeçalhos de segurança (#3);
  - limite por IP no autocompletar de endereço (#4) e no cadastro (#5);
  - "Esqueci minha senha" (#6);
  - alerta de erros por e-mail e lista em /admin → Erros (#7);
  - ensaio de restauração local (#8).
- **P1:**
  - JSON-LD com os preços reais (#10); hreflang e x-default (#11);
  - booking com título e canonical por empresa (#12); 404 para slug malformado (#13);
  - política de robôs de IA explícita (#15); funil no /admin (#16);
  - e-mails do fim do teste e do 1º agendamento (#17).
- **Crescimento:**
  - **códigos de desconto** criados em /admin → Códigos (Stripe coupon + promotion code; %, US$, só a 1ª cobrança, alguns meses ou para sempre, limite de usos, validade);
  - **indicação**: cada groomer tem link e código na página do plano. Quem foi indicado ganha o 1º mês grátis; quem indicou ganha US$29 de crédito quando o indicado paga a 1ª cobrança de verdade. Teste `discounts.mjs`.
- **P2:** chaves de dispositivo também pelo cabeçalho (#9); estado dos clientes novos dos EUA vem da empresa (#19).

## Depende de você (configuração, sem código)
1. **Stripe → Developers → Webhooks:** no endpoint `<APP_URL>/api/stripe/webhook`, marque também o evento **`invoice.paid`**. Sem ele, a indicação não dá o crédito.
2. **E-mails do fim do teste (tarefa de hora em hora):**
   - no GitHub do Duperpower, em Settings → Secrets → Actions, crie `APP_URL` e `CRON_SECRET`;
   - no Netlify, crie a mesma `CRON_SECRET`.
3. **Alerta de erros:** `ADMIN_EMAILS` no Netlify (já é usada pelo /admin) e o e-mail configurado.
4. **Backup:** fazer o ensaio na Neon (`fino-backup-restore.md`).

## 30 / 60 / 90 dias

**30 dias: poder vender**
1. Domínio, `APP_URL`, chaves do Stripe ao vivo, Search Console e Bing.
2. Novo logo (#21).
3. Cadastrar o Fino no Capterra, G2 e GetApp.
4. Meta: os 10 primeiros assinantes, trazidos à mão. Criar um código de lançamento em /admin → Códigos.

**60 dias: ser encontrado**
1. Páginas `/pricing`, `/mobile-grooming-software` e `/mobile-grooming-route-planner`, uma por vez, medindo o efeito.
2. `/moego-alternative`, com fatos conferidos e datados.
3. Importação de planilhas do MoeGo e do DaySmart, se os primeiros clientes pedirem.
4. Reduzir o JS da home (#18).

**90 dias: aumentar o valor**
1. Cobrança de cartão do cliente final com Stripe Connect (sinal e taxa de falta).
2. Report card com foto enviado ao dono do pet.
3. IA que responde o cliente final, se os assinantes pedirem e o custo fechar a conta.
4. Próximo idioma da página de vendas, escolhido pelos cadastros por país.

## O que **não** fazer agora
- Gerar dezenas de páginas parecidas ou traduzir a página de vendas para 20 línguas sem revisão.
- Publicar comparações sem fonte e data.
- Refatorar a arquitetura: ela está sólida para esta fase.
