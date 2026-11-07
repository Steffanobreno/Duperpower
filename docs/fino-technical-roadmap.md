# Fino: roteiro técnico

Data: 2026-11-07. Os números (#) se referem à tabela de `fino-audit.md`.

## Feito nesta etapa (branch `google-map-tiles`, ainda não publicado)
- P0: webhook do Stripe lê a assinatura atual (#1); nodemailer 10.1.7 (#2); cabeçalhos de segurança (#3); limite por IP no autocompletar de endereço (#4) e no cadastro (#5).
- P0: "Esqueci minha senha" (#6): link por e-mail que vale 1 hora e só uma vez; encerra as outras sessões; a resposta é a mesma se o e-mail não tiver conta.
- P1: JSON-LD com os preços reais e Organization (#10); hreflang e x-default coerentes (#11); título e canonical por empresa no booking, `noindex` quando pausado e em `/book` (#12); 404 para slug malformado (#13).

## Precisa da sua aprovação (P0/P1)

| # | Tarefa | Por que precisa de aprovação | Custo |
|---|---|---|---|
| 7 | Monitoramento de erros | Serviço externo (Sentry) ou e-mail ao admin | US$0 no plano grátis do Sentry, ou US$0 por e-mail |
| 8 | Teste de restauração do backup | Precisa de acesso à Neon | US$0 |
| 15 | Política de robôs de IA (GPTBot etc.) | Decisão de negócio | US$0 |
| 16 | Medir o funil (cadastro → 1º agendamento → assinatura) | Escolher: contadores próprios no /admin (recomendo, sem cookies) ou GA4 com consentimento | US$0 |
| 17 | E-mails de fim de teste e de ativação | Novos e-mails para os clientes do Fino | US$0 |

## 30 / 60 / 90 dias

**30 dias: poder vender**
1. Domínio, `APP_URL`, chaves do Stripe ao vivo, Search Console e Bing.
2. #7 erros e #8 restauração.
3. #16 funil e #17 e-mails do teste.
4. Novo logo (#21).
5. Cadastrar o Fino no Capterra, G2 e GetApp.
6. Meta: os 10 primeiros assinantes, trazidos à mão (grupos de groomers e contatos).

**60 dias: ser encontrado**
1. Páginas `/pricing`, `/mobile-grooming-software` e `/mobile-grooming-route-planner`, uma por vez, medindo o efeito.
2. `/moego-alternative`, com fatos conferidos e datados.
3. Programa de indicação ("os dois ganham 1 mês"): Stripe coupons, sem custo fixo.
4. Importação a partir de planilhas do MoeGo e do DaySmart, se os primeiros clientes pedirem.
5. Reduzir o JS da home (#18).

**90 dias: aumentar o valor**
1. Cobrança de cartão do cliente final com Stripe Connect (sinal e taxa de falta). Exige uma decisão sobre taxas e termos.
2. Report card com foto enviado ao dono do pet.
3. IA que responde o cliente final, só se os assinantes pedirem e o custo por mensagem fechar a conta.
4. Próximo idioma da página de vendas, escolhido pelos cadastros por país.

## O que **não** fazer agora
- Gerar dezenas de páginas parecidas ou traduzir a página de vendas para 20 línguas sem revisão.
- Publicar comparações sem fonte e data.
- Refatorar a arquitetura: ela está sólida para esta fase.
