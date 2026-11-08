# Pendências do Fino

Atualizado em 2026-11-08 (Onda 1 pronta na branch `claude/clever-clarke-3ukcxg`; a master continua em `ddeda90`). Marque com [x] o que for feito.

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

## Modo de teste dos pagamentos (até o Stripe existir)
Enquanto a empresa não está aberta e não há chaves do Stripe, o app tem um **modo de teste**: o groomer escolhe o plano mensal (US$29) ou anual (US$290) e "paga" numa página de teste do próprio Fino, **sem cobrança de verdade**. Tudo funciona como vai funcionar com o Stripe: os 14 dias grátis (escolher o plano no teste grátis mantém o teste; a 1ª cobrança é no fim dele, a não ser que faltem menos de 48 horas), os códigos de desconto do /admin → Códigos, a indicação (1º mês grátis para quem foi indicado e US$29 de crédito para quem indicou, uma vez, quando o indicado paga a 1ª cobrança de verdade), e "Gerenciar assinatura" (cancelar no fim do período ou retomar). As renovações e os fins de plano acontecem no job de hora em hora (o mesmo dos lembretes, com `CRON_SECRET`).
- Aparece a faixa **"Modo de teste — nenhuma cobrança real"** na página do plano, nas páginas de teste e no /admin. Se a faixa aparece, ninguém está pagando.
- **Liga sozinho só no desenvolvimento** (no computador de desenvolvimento e nos testes), quando não há `STRIPE_SECRET_KEY`. **No site no ar, só liga com `FAKE_PAYMENTS=1`** no Netlify. Sem essa variável e sem Stripe, o site no ar fica como antes: ninguém paga e nada é bloqueado. Na dúvida, fica desligado: ninguém consegue ativar um plano de graça.
- **Desliga sozinho** quando `STRIPE_SECRET_KEY` for colocada no Netlify: a partir daí vale o Stripe, sem mudar código. Os planos de teste que ainda existirem terminam no fim do período (não renovam de graça) e a pessoa escolhe o plano de novo, agora pelo Stripe. Os códigos de desconto criados no modo de teste (marcados "teste" no /admin) não existem no Stripe: crie de novo depois de ligar o Stripe.
- [ ] **Importante:** **NÃO** deixe `FAKE_PAYMENTS=1` no site no ar quando houver clientes de verdade. Com ela, qualquer groomer "paga" o plano na página de teste sem pagar nada. Apague a variável no Netlify antes de abrir para clientes (ou assim que colocar as chaves do Stripe).
- No modo de teste, o crédito da indicação fica só registrado no Fino (aparece na página do plano de quem indicou); ele não é descontado das cobranças de teste.
- **O crédito de indicação ganho no modo de teste não passa para o Stripe:** quando o Stripe for ligado, esse crédito não vira desconto de verdade. Por isso, `FAKE_PAYMENTS=1` é só para contas de teste, nunca para groomers de verdade.

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

## Onda 1 pronta (2026-11-08, branch `claude/clever-clarke-3ukcxg`)
O que o groomer ganhou (detalhes na spec `docs/superpowers/specs/2026-11-07-fino-vantagem-competitiva-design.md`):
- **Boletim pós-banho:** depois da visita, o dono do pet recebe um link (`/g/...`) com a foto, as etiquetas da tosa (calmo, nervoso, nós, unhas feitas...), a observação e o botão "Agendar o próximo" já com a data certa. O groomer manda pelo WhatsApp, SMS ou e-mail no cartão "Relatório de banho e tosa" da visita (é o nome do boletim no app em português).
- **Etiquetas da tosa:** marcar em um toque como o cão se comportou e o que foi feito.
- **"Agendado com Fino":** um rodapé discreto nas páginas do cliente e nos e-mails. Quem clica e assina vira indicação do groomer.
- **Preencher o buraco:** a página `/fill/<dia>` mostra o tempo livre do dia e quem convidar (lista de espera primeiro, depois os clientes atrasados mais perto), com a mensagem pronta para mandar. Aparece no Hoje e depois de um cancelamento ("Preencher este horário").
- **Painel de indicadores:** em Relatórios e no Hoje: faturamento, ticket médio, taxa de retorno, ocupação, faltas e cancelamentos, clientes atrasados, boletins enviados e convites que viraram agendamento, comparando com o mês (ou a semana) anterior. Groomer sem permissão de relatórios não vê valores.
- **Botões "Enviar pelo meu celular":** WhatsApp e SMS saem do celular do groomer, sem custo para o Fino.
- Tudo traduzido nos 20 idiomas do app.

O que precisa de você:
- [ ] **E-mail automático do boletim (opcional):** se quiser que o boletim vá sozinho por e-mail depois do fechamento, ligar em **Ajustes → Mensagens e e-mail → Relatório de banho e tosa**. Desligado (o padrão), o groomer manda pelo botão.
- [ ] **Traduções (opcional):** as frases novas foram traduzidas para os 19 idiomas. Se quiser, peça a alguém nativo para revisar (sobretudo espanhol e português).
- [ ] **Aceitar o Lighthouse abaixo da meta:** a meta era desempenho ≥97, e as medições deram 91–98 no `/book` e 95–97 no `/g` (tabela abaixo). A causa principal são as imagens grandes da empresa de teste, não a Onda 1. Responder "aceito" ou pedir a otimização das imagens agora.
- [ ] **Privacidade × rodapé "Agendado com Fino":** o texto da Política de Privacidade ainda não fala do link do rodapé nas páginas do cliente e nos e-mails. Continua em aberto para a etapa jurídica (ajustar o texto da privacidade, sem tirar o rodapé).
- [ ] **Boletim e observação da tosa:** a observação da tosa aparece no boletim do cliente. O formulário agora avisa embaixo do campo ("O cliente vê esta nota no relatório de banho e tosa."). Uma observação separada, só para o groomer, ficou para depois.

Problemas antigos encontrados nos testes (já existiam antes da Onda 1, não foram mexidos). Estes cinco testes já falhavam no começo da branch (`614a5b8`), do mesmo jeito:
- [ ] **Hoje no modo mapa, teste do pino da rota:** o teste `today-map.mjs` falha no passo em que o cartão da 2ª visita deveria destacar o pino 2 (`.route-pin-active`).
- [ ] **Agendamento abandonado:** `abandoned.mjs` não encontra "Abandoned step: Address" no cartão da cliente (ela aparece como "Contacted").
- [ ] **Clientes por perto:** `nearby.mjs` espera a ⭐ logo depois da visita das 9–11 e recebe "⭐ 7:00 AM, ⭐ 11:00 AM".
- [ ] **Sem internet:** `offline.mjs` não chega ao /today no login pelo endereço alternativo (127.0.0.1:3099). Parece coisa do ambiente de teste.
- [ ] **Equipe e backup:** `team-backup.mjs` falha em "Today defaults to your own route (1 stop)".
- [ ] **Hoje no modo mapa, "Cancelado ou faltou":** essa seção fica por cima dos cartões das visitas. Precisa de ajuste de layout.

Lighthouse (celular, build de produção `npm run build && npm start`, 3 medições cada, em 2026-11-08):

| Página | Desempenho | Acessibilidade | Boas práticas | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| `/book/woofers` | 91 / 96 / 98 | 100 | 100 | 100 | 2,4–3,3 s | 0 |
| `/g/<token>` (boletim) | 95 / 96 / 97 | 100 | 100 | 66 (de propósito: a página tem `noindex`) | 2,5–2,7 s | 0 |
| `/book/woofers` no começo da branch (`614a5b8`), para comparar | 96 / 97 / 97 | 100 | 100 | 100 | 2,1–2,8 s | 0 |

- [ ] **Desempenho abaixo de 97 em algumas medições:** a página de agendamento pesa o mesmo de antes da Onda 1 (diferença de 0,4 KB), então a variação é do teste. O que segura o LCP é a imagem grande da empresa de teste (`van.jpg` no booking, o logo `logo-light.png` de 84 KB no boletim): o Lighthouse sugere WebP/AVIF e tamanhos por tela. Vale fazer quando o logo do Fino e as imagens de verdade chegarem.

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
8. **Configuração inicial, serviços:** o groomer tem que poder incluir e remover serviços e também categorias ali mesmo, sem ir aos Ajustes.
9. **Primeiro cadastro de cão:** a raça é obrigatória.
10. **Configuração inicial, clientes:** depois de cadastrar um cliente pela configuração inicial, voltar para a etapa de concluir a configuração, e não largar o groomer em outra tela.
11. **Prévias do Netlify:** ligar "Deploy Previews" no site, para o PR #1 gerar o link de revisão (o dono está revisando pela prévia da sessão por enquanto).
