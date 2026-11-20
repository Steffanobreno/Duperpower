# Fino: as 20 verificações de segurança

Revisado em 2026-11-17. ✅ = feito e testado · 🟡 = feito em parte, o que falta está escrito · 🔧 = mudou nesta revisão.

| # | Item | Situação | Como está no Fino |
|---|------|----------|-------------------|
| 1 | Secrets | ✅ | Chaves só nas variáveis do Netlify/GitHub; `.env*` fora do git; nenhuma chave no código (verificado). |
| 2 | Controle de acesso | ✅ | Toda tela do app pede login (`requireStaff`/`requirePermission`); cada consulta é filtrada pela empresa da sessão (`business_id`); papéis e permissões por funcionário; `/admin` só para `ADMIN_EMAILS` (os outros veem 404). |
| 3 | Senhas com hash | ✅ | scrypt com sal aleatório e comparação em tempo constante. |
| 4 | RLS | 🔧 ✅ | Duas travas. **No código:** toda consulta filtra pela empresa da sessão. **No banco** (migração 0058): 15 regras recusam qualquer gravação que ligue dados de duas empresas (visita → cliente, pet → visita, pagamento → recibo, nota → cliente…), seja qual for a parte do código que tente. Não usamos o RLS "clássico" do Postgres (variável por transação) porque no pooler da Neon ele deixa cada consulta 3 a 4 vezes mais lenta (medido: 22 ms → 64–85 ms com o banco a 10 ms). `tests/e2e/tenant-isolation.mjs` abre 13 telas e arquivos de outra empresa (nada aparece) e tenta 7 ligações proibidas (todas recusadas). |
| 5 | Validar inputs | ✅ | Formulários limitam tamanho e formato (telefone, e-mail, CEP); campo isca contra robôs no agendamento e na ficha. |
| 6 | SQL injection | ✅ | Todas as consultas usam parâmetros (postgres.js), nunca texto colado. |
| 7 | Dependências | 🔧 ✅ | Next.js 16.4.2 → 16.4.6: `npm audit` agora mostra **0 vulnerabilidades**. |
| 8 | HTTPS | ✅ | Netlify só serve HTTPS; HSTS de 1 ano; 🔧 `upgrade-insecure-requests` no CSP. |
| 9 | XSS | 🔧 ✅ | React escapa tudo; dados estruturados com `<` escapado; 🔧 Content-Security-Policy completa: scripts só deste site e do Google Maps, sem plugins (`object-src 'none'`), `base-uri` e `form-action` presos ao site. |
| 10 | Rate limiting | 🔧 ✅ | 🔧 Agora contado **no banco** (vale para todos os servidores, antes era por servidor): login (30/15 min por IP, além do bloqueio de 8 erros por e-mail), cadastro (5/h), esqueci a senha (10/h), agendamento online (15/h), ficha de cliente novo (10/h), busca por telefone (20/10 min), endereços (300/h), cartão de visita (120/h). |
| 11 | Criptografia | ✅ | Tokens de sessão e de recuperação de senha guardados só como hash SHA-256; banco Neon criptografado em repouso e em trânsito (TLS). |
| 12 | Cookies seguros | ✅ | `httpOnly`, `secure` em produção, `SameSite=Lax`. |
| 13 | CORS | ✅ | Nenhuma rota libera outros sites a lerem respostas (teste confere). |
| 14 | Sessões | 🔧 ✅ | Token aleatório de 256 bits, novo a cada login; 60 dias; "sair dos outros aparelhos"; trocar ou recuperar a senha encerra as outras sessões; 🔧 sessões vencidas são apagadas. |
| 15 | Uploads seguros | ✅ | Fotos e logo: o servidor confere os primeiros bytes (só JPEG/PNG/WebP), limite de 1–1,5 MB; CSV até 5 MB; nada vai para disco público. |
| 16 | CSRF | ✅ | Server Actions do Next conferem a origem; cookie `SameSite=Lax`; webhook do Stripe confere a assinatura. |
| 17 | Tratar erros | ✅ | O cliente vê só uma mensagem amigável e um código; o detalhe fica no log (`/admin/errors`). 🔧 Sem o cabeçalho `X-Powered-By`. |
| 18 | Security headers | 🔧 ✅ | CSP completa, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, 🔧 `Cross-Origin-Opener-Policy`; só `/book` pode aparecer dentro de outro site. |
| 19 | Monitoramento | ✅ | Erros do servidor gravados e mostrados em `/admin/errors`, com aviso por e-mail. 🔧 A chave da tarefa de hora em hora (`CRON_SECRET`) é comparada em tempo constante. |
| 20 | Backups automáticos | 🔧 ✅ | Três camadas: (1) histórico da Neon (point-in-time restore); (2) 🔧 **cópia semanal automática** fora da Neon (GitHub Actions, domingo): o banco inteiro, criptografado (AES-256), guardado 90 dias, e **restaurado num banco vazio a cada semana** para provar que funciona; se falhar, o GitHub manda e-mail; (3) backup semanal opcional no Google Drive por empresa. **Falta você:** criar os 2 segredos no GitHub (docs/pendencias.md) e conferir a retenção na Neon. |

## Teste automático
`tests/e2e/security.mjs` confere tudo que dá para conferir de fora: cabeçalhos em todo tipo de página, nenhuma página quebrando o CSP, áreas privadas fechadas, tarefa de hora em hora e webhook recusando chave errada, upload falso recusado e o limite por visitante contado no banco.
