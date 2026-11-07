# Fino: auditoria técnica

Data: 2026-11-07 · Branch: `google-map-tiles` · Base: commit `d242a7a`

Esta auditoria foi feita lendo o código. Nada foi presumido a partir de descrições, e nada foi mudado em produção.

## 1. O que existe hoje (verificado no código)

| Área | Como está |
|---|---|
| Framework | Next.js 16.4 (App Router), React 19.3. Server components e server actions. `cacheComponents: false`; quase todas as páginas são dinâmicas porque leem o login. |
| Estilo | Tailwind v4 |
| Hospedagem | Netlify, plano grátis (`netlify.toml`). O build roda `db:migrate && db:seed && build`. |
| Banco | Postgres via `postgres.js`, com URL pooled da Neon suportada (`src/lib/db-config.ts`). 41 migrações em `db/migrations`. |
| Multi-empresa | Coluna `business_id` em toda tabela de negócio, filtrada em cada consulta. Não há Row Level Security; o isolamento depende do código. |
| Autenticação | Sessões próprias (`src/lib/auth.ts`): senha com scrypt, token aleatório de 32 bytes, cookie httpOnly com SameSite=lax e Secure em produção, 60 dias. Bloqueio após 8 senhas erradas em 15 minutos. PIN por pessoa da equipe. |
| Permissões | `requireStaff` / `requirePermission` / `requireAdmin`, com papéis e permissões por pessoa (`src/lib/permissions.ts`). |
| Pagamentos (assinatura) | Stripe Checkout, Portal e Webhook (`src/lib/billing.ts`, `src/app/api/stripe/webhook`). US$29/mês ou US$290/ano, teste grátis de 14 dias. |
| Pagamentos (cliente final) | Só registro manual: dinheiro, Zelle, Venmo etc. **Não há cobrança de cartão pelo app.** |
| E-mail | Resend, com Gmail SMTP como alternativa (`src/lib/email.ts`). |
| SMS | Sai pelo iPhone do dono, via Atalho (`/api/device/outbox`). Não há provedor de SMS. |
| Mapas | Google (autocompletar, geocodificação, rotas, ETA) quando a chave está configurada; Leaflet para os mapas. |
| IA | Central de ajuda com Claude (`src/lib/help/assistant.ts`), opcional com `ANTHROPIC_API_KEY`. |
| Idiomas | App do groomer e páginas do cliente em 20 idiomas (RTL para árabe e urdu). Página de vendas em en, pt e es. |
| Testes | 46 testes e2e com Playwright (`tests/e2e`), checagem de frases traduzidas, lint e typecheck. |
| Monitoramento | Nenhum além dos logs do Netlify. Não há Sentry nem alertas. |
| Backups | Depende do plano da Neon (restauração a um ponto no tempo). Opcionalmente, um backup semanal por empresa no Google Drive, via Apps Script (`/api/device/backup`). Uma restauração nunca foi testada. |

## 2. Problemas encontrados

Prioridade: P0 = segurança e confiabilidade · P1 = SEO técnico e conversão · P2 = performance e experiência · P3 = expansão.

| # | Problema | Impacto | Evidência | Solução | Esforço | Risco | Prior. | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | O webhook do Stripe aplicava a assinatura que vinha dentro do evento. O Stripe pode entregar eventos atrasados ou fora de ordem. | Um "updated" antigo chegando depois do "deleted" reabriria um plano cancelado, ou trancaria um cliente que paga. | `api/stripe/webhook/route.ts` usava `event.data.object` | Ler a assinatura atual no Stripe (`subscriptions.retrieve`) a cada evento | P | Baixo | P0 | ✅ Feito, com teste |
| 2 | nodemailer 10.1.2 tem 3 falhas moderadas no leitor de endereços (GHSA-8c8m, GHSA-m943, GHSA-85x2). | Um e-mail digitado pelo cliente pode virar outro destinatário. | `npm audit` | Atualizar para 10.1.7 (correção da mesma versão maior) | P | Baixo | P0 | ✅ Feito |
| 3 | Faltavam cabeçalhos de segurança básicos (nosniff, Referrer-Policy, HSTS, Permissions-Policy). | Endurecimento padrão ausente. | `next.config.ts` só tinha `frame-ancestors` | Cabeçalhos em todas as páginas | P | Baixo | P0 | ✅ Feito |
| 4 | O autocompletar de endereço é público e o limite contava por um token que o próprio navegador escolhe. | Abuso gera custo no Google Places. | `src/app/address-actions.ts` | Limite extra por IP (300 por hora) | P | Baixo | P0 | ✅ Feito |
| 5 | O cadastro não tinha limite por IP, só um campo-armadilha para robôs. | Contas em massa (spam, custo de e-mail). | `src/app/signup/actions.ts` | 5 contas por hora por IP | P | Baixo | P0 | ✅ Feito |
| 6 | **Não existe "esqueci minha senha".** | O groomer que esquece a senha fica trancado para fora. Isso vira churn e suporte manual. | Não há rota nem ação de reset | Link de redefinição por e-mail, com token de uso único que vence em 1 hora | M | Médio (nova tabela, e-mail) | P0 | ⏸ Precisa de aprovação |
| 7 | Não há monitoramento de erros nem alertas. | Erros em produção passam despercebidos. | Nenhum `instrumentation.ts`, nenhum SDK | Sentry (há plano grátis) ou `onRequestError` com e-mail ao admin | P–M | Baixo | P0 | ⏸ Decisão de serviço externo |
| 8 | A restauração do backup nunca foi testada, e o prazo de restauração da Neon depende do plano. | Perda de dados se algo der errado. | `db-config.ts`; nenhum procedimento escrito | Confirmar o plano da Neon e fazer 1 teste de restauração num branch da Neon | P | Baixo | P0 | ⏸ Precisa de acesso à Neon |
| 9 | Chaves de dispositivo e de backup vão na URL (`?key=`). | Podem aparecer em logs. | `/api/device/*` | Aceitar a chave também no cabeçalho `Authorization` e migrar o Atalho e o Apps Script | M | Médio (quebra os Atalhos já instalados) | P2 | Documentado |
| 10 | O Schema.org da página de vendas dizia preço **0**. | Google e IAs citariam "grátis", diferente do preço real. | `src/app/page.tsx` | Ofertas de US$29/mês e US$290/ano, mais o schema Organization | P | Baixo | P1 | ✅ Feito |
| 11 | O hreflang do sitemap apontava o inglês para `/?lang=en`, mas o canonical é `/`. Também faltava `x-default`. | Sinais confusos para o Google. | `src/app/sitemap.ts`, `page.tsx` | Usar as mesmas URLs nos dois, mais `x-default` | P | Baixo | P1 | ✅ Feito |
| 12 | Toda página de agendamento tinha o mesmo título ("Book a visit") e nenhum canonical. `/book` sem slug também era indexável e duplicava uma empresa. | Títulos duplicados; o groomer não aparece pelo nome no Google. | `src/app/book/*/page.tsx` | Título "Book with {empresa}", descrição, canonical, `noindex` quando a agenda está pausada e em `/book` | P | Baixo | P1 | ✅ Feito |
| 13 | Um link `/book/<slug malformado>` (com maiúscula, por exemplo) abria a **primeira empresa do app**. | Cliente vê a empresa errada. | `getPublicBusiness(null)` volta a primeira | 404 para slug malformado | P | Baixo | P1 | ✅ Feito |
| 14 | Só existe 1 página comercial (`/`). Não há /pricing, /features nem páginas de intenção ("mobile grooming software") ou de comparação. | Pouca superfície para busca e para citação por IA. | `src/app` | Ver `fino-seo-strategy.md` | M–G | Baixo | P1 | ⏸ Fase 2 |
| 15 | O `robots.txt` libera todos os robôs, inclusive o GPTBot (treino de IA). | É uma decisão de negócio, não um erro. | `src/app/robots.ts` | Decidir: liberar o OAI-SearchBot (busca) e escolher se libera o GPTBot (treino) | P | Baixo | P1 | ❓ Decisão sua |
| 16 | Não há analytics nem eventos de conversão (cadastro, primeiro agendamento, assinatura). | O funil não é medido. | Nenhum script | Contadores próprios no painel /admin (sem cookies), ou GA4 com consentimento | M | Baixo | P1 | ⏸ Proposta |
| 17 | Não há e-mails de ciclo de vida: fim do teste chegando, cadastro sem primeiro agendamento. | Testes que acabam sem virar assinatura. | Só existe o banner no app (≤5 dias) | E-mails aos 3 e 1 dias do fim do teste e "ativação" no dia 2 | M | Baixo | P1 | ⏸ Proposta |
| 18 | O JS da página de vendas tem cerca de 470 KB (sem compressão) para uma página quase estática. | Pior em celulares fracos (o LCP está bom, mas há margem). | Medição abaixo | Investigar os blocos de JS e tirar componentes cliente desnecessários | M | Médio | P2 | Documentado |
| 19 | `clients.state` tem padrão `'CA'`, e criar um cliente a partir de um agendamento abandonado grava `'CA'` fixo. | Dado errado fora da Califórnia (só aparece no cadastro). | `0001_init.sql`, `abandoned/actions.ts` | Gravar null ou derivar do país | P | Baixo | P2 | Documentado |
| 20 | Os limites por IP valem por instância do servidor (memória). | Não é uma garantia forte. | `src/lib/rate-limit.ts` | Se houver abuso: tabela no Postgres ou Netlify Rate Limiting | M | Baixo | P3 | Documentado |
| 21 | O ícone do app ainda é o cachorro da Woofers. | Marca inconsistente (e o schema Organization usa esse ícone). | `src/app/icon.png` | Novo logo do Fino | P | Baixo | P1 | ⏸ Depende do logo |

## 3. Pontos que já estão bons (verificados)

- **Isolamento entre empresas:** todas as server actions do app chamam `requireStaff`/`requirePermission`. Uma busca achou cerca de 30 escritas por id sem `business_id` na mesma linha. Conferi por amostragem (listas, clientes, pagamentos, itens da conta, rascunhos, campanhas): todas checam o dono antes, na mesma transação. Uma revisão linha a linha das demais continua pendente. As rotas de foto filtram por `business_id`.
- **Agendamento duplo:** bloqueado no banco por restrições `exclude using gist` (`no_double_booking`, `no_double_booking_online`).
- **Booking público:** a busca por telefone tem limite por IP e mostra pouco (primeiro nome, pets e cidade, nunca a rua). Máximo de 3 pedidos por telefone por dia. Campo-armadilha para robôs. O horário é revalidado no servidor.
- **Links privados** (`/a/`, `/r/`, `/s/`, `/u/`) usam tokens longos, validados por formato, e têm `noindex`.
- **Webhook do Stripe:** assinatura verificada com `constructEventAsync`. A atualização é idempotente (grava o estado; não soma).
- **Senhas:** scrypt com comparação de tempo constante. Login com e-mail inexistente gasta o mesmo tempo.

## 4. Medições (laboratório, não são dados de usuários reais)

Build de produção local. Celular emulado (390×844), CPU 4× mais lenta, rede de 1,6 Mbps com 150 ms. As metas do Core Web Vitals valem para dados reais (percentil 75), que ainda não existem porque não há domínio nem tráfego.

| Página | LCP | CLS | Peso total | JS |
|---|---|---|---|---|
| `/` | 1,26 s | 0 | 648 KB | 469 KB |
| `/?lang=pt` | 0,79 s | 0 | 649 KB | 469 KB |
| `/signup` | 0,80 s | 0 | 712 KB | 567 KB |
| `/login` | 0,65 s | 0 | 645 KB | 557 KB |
| `/book/woofers` | 1,94 s | 0 | 838 KB | 588 KB |
| `/terms` | 0,72 s | 0 | 547 KB | 454 KB |

Os pesos são sem compressão; na rede, com gzip ou brotli, são menores. O INP não foi medido, porque precisa de interação real.

Rolagem horizontal em 320, 375, 390, 430, 768, 1024, 1440 e 1920 px: **nenhuma**, em `/`, `/signup`, `/login`, `/book/woofers` e `/terms`.
