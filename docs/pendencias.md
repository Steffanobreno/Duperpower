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

## Site (feito na noite de 2026-11-07, ver `docs/site-noite.md`)
- [ ] Ler os textos das páginas novas (/features, /pricing, /mobile-grooming-software, /mobile-grooming-route-planner, /switch, /guides) e pedir ajustes.
- [ ] Contar sua história para a página "Sobre" (opcional, só se quiser).
- [ ] Publicar ("pode publicar") quando aprovar.

## Próximas etapas de código (pedir quando quiser)
1. `/moego-alternative`, só com fatos conferidos no site oficial, com data.
2. Importar planilhas do MoeGo e do DaySmart.
3. Cobrança de cartão do cliente final (Stripe Connect: sinal e taxa de falta).

Detalhes em `docs/fino-technical-roadmap.md` e `docs/fino-audit.md`.

## Lista de mudanças da revisão (juntando para fazer de uma vez, a pedido do dono)
Atualizado em 2026-11-07, durante a revisão do site de prévia. Não começar antes de ele dizer que terminou a lista.

1. **Configuração inicial (etapa de serviços):** hoje só mede o cão por altura, em polegadas. Perguntar primeiro "por altura ou por peso", com a unidade do país (cm/kg no Brasil, in/lb nos EUA) e a opção de trocar.
2. **Site "cru":** falta informação. Esperar a lista do dono sobre o que falta (textos, seções, fotos).
3. **Logomarca nova:** o dono vai mandar as versões (fundo transparente, com fundo, cores). Aplicar no ícone do app, no site, na imagem de compartilhamento e nos e-mails.
4. **Google Agenda com um clique (OAuth):** botão "Conectar Google Agenda", login e permissão do Google, e as visitas sincronizam sozinhas. Tirar o script colado. Precisa de um projeto no Google Cloud e da verificação do app pelo Google.
5. **SMS (decidido):** tirar o Atalho do iPhone do caminho principal. No plano de US$29 ficam e-mail, notificações e os botões "Enviar por WhatsApp" e "Enviar SMS", que abrem o celular do groomer com a mensagem pronta (grátis). **Depois:** um adicional pago com envio automático, por SMS (Twilio) e/ou WhatsApp (API oficial da Meta), em pacote mensal com margem, para aumentar o ticket médio. Levantar os preços atuais antes.
6. **Apps na App Store e no Google Play:** embrulhar o app atual (Capacitor), com notificações nativas. O dono vai abrir as contas de desenvolvedor (Apple e Google), de preferência como empresa.
7. **Página de agendamento embutida (decidido: liberar):** todo groomer assinante pode embutir a página de agendamento e a ficha de cliente novo no próprio site. As outras telas continuam proibidas de ser embutidas.
8. **Prévias do Netlify:** ligar "Deploy Previews" no site, para o PR #1 gerar o link de revisão (o dono está revisando pela prévia da sessão por enquanto).
