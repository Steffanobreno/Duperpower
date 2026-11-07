# Pendências do Fino

Atualizado em 2026-11-07, depois de publicar `ddeda90` na master. Marque com [x] o que for feito.

## Configurações suas (sem código)
- [ ] **Netlify:** confirmar que o deploy do `ddeda90` terminou verde.
- [ ] **Domínio:** comprar finogroom.com (fino.pet é opcional) e pôr `APP_URL` no Netlify com o endereço final.
- [ ] **Stripe ao vivo:** `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` no Netlify.
- [ ] **Stripe → Developers → Webhooks:** endpoint `<APP_URL>/api/stripe/webhook` com os eventos `checkout.session.completed`, `customer.subscription.created`, `.updated`, `.deleted` e **`invoice.paid`** (este dá o crédito da indicação).
- [ ] **GitHub → Duperpower → Settings → Secrets → Actions:** criar `APP_URL` e `CRON_SECRET`. Criar a mesma `CRON_SECRET` no Netlify. Isso liga os lembretes e os e-mails do fim do teste.
- [ ] **`ADMIN_EMAILS`** no Netlify: o seu e-mail (para o /admin e os alertas de erro).
- [ ] Opcionais: `ANTHROPIC_API_KEY` (assistente da Ajuda) e `SUPPORT_EMAIL`.
- [ ] **Logo do Fino:** mandar o arquivo. Hoje o ícone ainda é o cachorro da Woofers.
- [ ] **Neon:** fazer o ensaio de restauração (`docs/fino-backup-restore.md`) e ver quantos dias de histórico o plano guarda.

## Conferir no site no ar
- [ ] /admin → Códigos abre. Criar um código de lançamento (ex.: LANCAMENTO50).
- [ ] /admin → Erros abre.
- [ ] Login → "Esqueceu sua senha?" → o e-mail chega e o link funciona.
- [ ] Página do plano mostra o link de indicação.
- [ ] Cadastro, login e booking num iPhone (Safari) e num Android (Chrome) de verdade.

## Depois do domínio
- [ ] Google Search Console: verificar por DNS e enviar `/sitemap.xml`.
- [ ] Bing Webmaster Tools: importar do Search Console.
- [ ] Cadastrar o Fino no Capterra, G2 e GetApp, e pedir avaliações aos primeiros clientes.

## Próximas etapas de código (pedir quando quiser)
1. Páginas `/pricing`, `/mobile-grooming-software` e `/mobile-grooming-route-planner`, uma de cada vez.
2. `/moego-alternative`, só com fatos conferidos no site oficial, com data.
3. Reduzir o JavaScript da página de vendas.
4. Importar planilhas do MoeGo e do DaySmart.
5. Cobrança de cartão do cliente final (Stripe Connect: sinal e taxa de falta).

Detalhes em `docs/fino-technical-roadmap.md` e `docs/fino-audit.md`.
