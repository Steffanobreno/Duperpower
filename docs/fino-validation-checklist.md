# Fino: checklist de validação

Rode antes de cada publicação (merge na master).

## Automático (no repositório)
- [ ] `npm run lint` sem erros
- [ ] `npm run typecheck` sem erros
- [ ] `node tests/i18n-check.mjs` → "All good."
- [ ] `node tests/owner-phrases.mjs` roda sem erro
- [ ] `npm audit --omit=dev` → nada alto ou crítico
- [ ] Suíte e2e: `slice.mjs` primeiro, depois os demais (com Postgres de teste, o falso Stripe e o falso Google)

## Segurança (a cada mudança em ações, rotas ou banco)
- [ ] Toda server action nova chama `requireStaff`/`requirePermission` (ou é pública de propósito, com limite)
- [ ] Toda consulta por id filtra por `business_id` ou checa o dono antes
- [ ] Nenhuma migração destrutiva (drop ou delete de dados) sem aprovação
- [ ] Nenhuma chave no código ou nos logs

## SEO (depois do domínio)
- [ ] `https://<domínio>/robots.txt` e `/sitemap.xml` respondem 200
- [ ] Teste de Resultados Avançados do Google na home: SoftwareApplication, Organization e FAQPage válidos
- [ ] Search Console: o sitemap foi lido e não há "Duplicada sem canonical"
- [ ] `/book/<slug>` mostra "Book with {empresa}" na aba do navegador
- [ ] `/book/SlugComMaiuscula` dá 404

## Mobile e desktop
- [ ] Sem rolagem horizontal em 320, 375, 390, 430, 768, 1024, 1440 e 1920 px nas páginas públicas
- [ ] Cadastro, login e booking completos num iPhone (Safari) e num Android (Chrome) de verdade
- [ ] LCP abaixo de 2,5 s e CLS abaixo de 0,1 (laboratório agora; Search Console depois, com dados reais)

## Assinatura (com o Stripe em modo de teste)
- [ ] Cadastro → teste de 14 dias → escolher o plano mensal → o webhook ativa → o painel mostra US$29
- [ ] Cancelar no portal → o app abre só a página de planos e o booking pausa
- [ ] Reenviar um evento antigo pelo painel do Stripe não muda o plano
- [ ] Código de desconto criado em /admin → Códigos aparece no Stripe → Products → Coupons
- [ ] Indicação: abrir `/signup?ref=<código>` mostra "Invited by …"; o Checkout mostra o mês grátis
- [ ] O webhook tem o evento `invoice.paid` marcado (é ele que dá o crédito de quem indicou)

## Tarefa de hora em hora e alertas
- [ ] GitHub Actions → "messages" roda verde (com os segredos `APP_URL` e `CRON_SECRET`)
- [ ] /admin → Erros abre; o e-mail de alerta chega em ADMIN_EMAILS
