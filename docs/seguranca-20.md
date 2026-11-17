# Fino: as 20 verificações de segurança

Revisado em 2026-11-17. ✅ = feito e testado · 🟡 = feito em parte, o que falta está escrito · 🔧 = mudou nesta revisão.

| # | Item | Situação | Como está no Fino |
|---|------|----------|-------------------|
| 1 | Secrets | ✅ | Chaves só nas variáveis do Netlify/GitHub; `.env*` fora do git; nenhuma chave no código (verificado). |
| 2 | Controle de acesso | ✅ | Toda tela do app pede login (`requireStaff`/`requirePermission`); cada consulta é filtrada pela empresa da sessão (`business_id`); papéis e permissões por funcionário; `/admin` só para `ADMIN_EMAILS` (os outros veem 404). |
| 3 | Senhas com hash | ✅ | scrypt com sal aleatório e comparação em tempo constante. |
| 4 | RLS | 🟡 | Não há RLS no Postgres: o isolamento entre empresas é feito no código (item 2). Ligar RLS exige uma conexão por empresa e revisar ~180 consultas; recomendado antes de passar de algumas centenas de clientes. |
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
| 20 | Backups automáticos | 🟡 | Neon guarda o histórico automaticamente (point-in-time restore); backup semanal opcional no Google Drive por empresa; ensaio de restauração feito no banco de teste. **Falta você:** conferir na Neon quantos dias de histórico o plano guarda e fazer o ensaio lá (docs/fino-backup-restore.md). |

## Teste automático
`tests/e2e/security.mjs` confere tudo que dá para conferir de fora: cabeçalhos em todo tipo de página, nenhuma página quebrando o CSP, áreas privadas fechadas, tarefa de hora em hora e webhook recusando chave errada, upload falso recusado e o limite por visitante contado no banco.
