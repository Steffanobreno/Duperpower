# Fino: correções dos termos, consentimentos e contratos

Data: 2026-11-08. Branch: `claude/clever-clarke-3ukcxg`. Origem: a revisão jurídica de 2026-11-08 (`revisao-juridica.md`, entregue ao dono). Desenho aprovado pelo dono na conversa, com a política de reembolso **opção 2**.

**Isto não é parecer jurídico.** Os textos são uma base organizada para o advogado revisar. Tudo o que depende da empresa (ainda não aberta) fica com marcadores visíveis.

## Objetivo
Fazer o que os textos prometem bater com o que o código faz, e corrigir os riscos mais altos que não dependem da empresa:
- o consentimento de SMS (TCPA);
- a renovação automática (ARL e ROSCA);
- as exigências do Stripe;
- a prova do contrato do groomer.

## Marcadores (preenchidos quando a empresa existir)
Um único lugar no código, `src/lib/legal.ts`, guarda os marcadores:
- `LEGAL.company = "[NOME DA EMPRESA]"`
- `LEGAL.address = "[ENDEREÇO]"`
- `LEGAL.jurisdiction = "[FORO E LEI APLICÁVEL]"`
- `LEGAL.supportEmail`, que vem de `SUPPORT_EMAIL`, com o marcador `"[E-MAIL DE SUPORTE]"` quando a variável estiver vazia
- `LEGAL.termsVersion = "2026-11-08"`

Os Termos, a Privacidade e o rodapé do site leem daqui. Os marcadores entre colchetes aparecem como estão, para ninguém esquecer de preencher. O `pendencias.md` lista onde preencher.

## A. Consentimento das mensagens aos clientes do groomer
1. **Caixa desmarcada.** A caixa de consentimento de SMS começa desmarcada na página de agendamento (`booking-wizard.tsx`), na ficha de cliente novo (`intake-form.tsx`) e no cadastro manual (`clients/forms.tsx`).
2. **Importação sem consentimento automático.** Clientes importados de planilha não ganham consentimento (`sms_consent_at` nulo). A tela de importação ganha uma caixa opcional, desmarcada: "Tenho o consentimento por escrito destes clientes para mensagens de texto". Só marcando essa caixa o consentimento é gravado, com a origem `import_attested`. Onde o consentimento é gravado, guardar também a origem: `booking`, `intake`, `manual`, `import_attested`.
3. **STOP com o texto correto.** Os Termos, a Privacidade e as telas param de dizer que "o app honra o STOP". O texto correto: as respostas chegam no celular do groomer, e o groomer precisa desmarcar o cliente. A tela do cliente já tem como desmarcar; a frase deve aparecer ali.
4. **Marketing.** O SMS de marketing, se existir algum caminho, checa o consentimento como os lembretes. Se não existir caminho de SMS de marketing, registrar isso no plano.
5. **Página de descadastro.** `/u/[token]` passa a ser traduzida nos 20 idiomas.

## B. Assinatura do Fino
1. **Aviso de renovação junto ao botão de pagar**, no plano e no checkout de teste: "Renova automaticamente a cada {mês|ano} por US$X até você cancelar. Cancele quando quiser em Plano; o acesso continua até o fim do período pago." O plano anual menciona a política de reembolso (B5).
2. **Aceite registrado.** Nova tabela `terms_acceptances (id, business_id, user_id, terms_version, accepted_at, ip, context)`. O `context` é `signup` ou `checkout`. O aceite é gravado no cadastro (a caixa que já existe) e ao escolher um plano (uma caixa nova, obrigatória: "Li e aceito os Termos e a renovação automática").
3. **Lembrete antes da 1ª cobrança** para quem escolheu um plano durante o teste: e-mail 3 dias antes do fim do teste com "dia X cobraremos US$Y". Hoje os lembretes só vão para quem não escolheu plano.
4. **Lembrete antes da renovação anual:** e-mail 15 dias antes, com a data e o valor. Uma vez por período.
5. **Reembolso (opção 2).**
   - Sem reembolso no mensal: cancela quando quiser e usa até o fim do período.
   - No anual, reembolso proporcional se pedido em até 14 dias após a cobrança.
   - O pedido é feito pelo e-mail de suporte e processado à mão. Não há botão.
   - Escrito nos Termos, no FAQ e no aviso do plano anual.
6. **FAQ do teste.** O texto passa a dizer a regra real: escolhendo um plano com mais de 48 horas de teste restantes, a cobrança acontece no fim do teste; com menos, acontece na hora.

## C. Termos e Política de Privacidade (`src/app/terms`, `src/app/privacy`)
Reescritos em inglês claro, como hoje, mantendo o layout `legal-page.tsx`. Data "Last updated" igual a `termsVersion`.

**Seções dos Termos:**
- quem somos;
- uso só profissional;
- conta e equipe;
- teste, plano, renovação e cancelamento;
- reembolso;
- indicações e cupons, com as regras reais: crédito de US$29 quando o indicado paga a 1ª cobrança; 1º mês grátis para o indicado; cupom com prazo e limite;
- impostos;
- mudanças de preço (aviso de 30 dias, valendo na próxima renovação);
- os dados dos clientes do groomer: o groomer controla, o Fino processa;
- os modelos de contrato e mensagens são exemplos, não aconselhamento jurídico;
- o groomer cumpre as leis de mensagens;
- uso aceitável;
- disponibilidade, com "esforço razoável para avisar mudanças importantes" no lugar de "we will tell you before removing anything";
- isenção de garantias e limite de responsabilidade;
- indenização;
- lei aplicável e foro, com marcador;
- cessão, contrato integral e independência das cláusulas;
- avisos por e-mail;
- contato.

**Seções da Privacidade:**
- quem controla o quê;
- dados que guardamos;
- para que usamos;
- bases legais (GDPR/LGPD);
- o rodapé "Online booking by Fino" nas páginas e e-mails dos clientes;
- suboperadores, numa lista real conferida no código: Neon/Postgres, Netlify, Resend/Gmail, Google Maps, OpenStreetMap, Anthropic (ajuda opcional), Stripe, Google Drive (backup opcional);
- transferência internacional;
- retenção (conta encerrada: apagamos em até 30 dias após o pedido; backups saem do ciclo em até 35 dias);
- crianças;
- cookies, com a lista real: sessão, idioma, armazenamento do PIN;
- direitos e como pedir;
- contato e encarregado (marcador);
- "não vendemos dados".

**Promessas ajustadas ao que o código faz:**
- A exportação inclui clientes, pets, visitas e pagamentos; ainda não inclui fotos e assinaturas.
- Encerrar a conta é feito por pedido ao e-mail de suporte.

**Contato público.** O e-mail de suporte aparece no rodapé do site, nos Termos e na Privacidade, sem login.

**Textos fixos errados.** Saem a frase "Mobile dog grooming in the Bay Area" do e-mail de marketing (`marketing-email.ts`) e a frase da Bay Area na página de agendamento. As duas só aparecem para a empresa de demonstração (`hasBuiltInArtwork`), e devem continuar só nela; conferir as condições no código.

## D. Contrato de serviço do groomer
1. **Versões imutáveis.** Cada vez que o texto muda, nasce uma nova versão guardada. Nenhuma versão é apagada. Cada assinatura aponta para o texto exato que o cliente viu. O groomer só decide se pede que todos assinem de novo. O desenho de dados fica para o plano: uma tabela de versões ou o texto guardado junto da assinatura. As assinaturas antigas continuam ligadas às versões delas.
2. **Excluir cliente.** A confirmação passa a dizer: "as assinaturas deste cliente também serão apagadas".
3. **Modelo inicial no idioma do groomer** (`starterAgreement`, como já é feito com os serviços). Ganha um campo para o valor da taxa de falta, `{no_show_fee}`, preenchido nos Ajustes, e a frase "This agreement is valid for 12 months from signing".

## Testes
- **Consentimento:**
  - booking, intake e cadastro manual começam desmarcados;
  - a importação sem a caixa não grava consentimento; com a caixa, grava `import_attested`.
- **Aceite dos Termos:**
  - o cadastro grava o aceite;
  - escolher um plano sem a caixa é recusado; com a caixa, grava `checkout`.
- **Lembretes:** o lembrete da 1ª cobrança e o da renovação anual saem uma vez cada, no coletor de e-mail.
- **Contrato do groomer:**
  - editar o contrato cria uma nova versão, e a assinatura antiga ainda mostra o texto antigo;
  - a confirmação de exclusão do cliente mostra o aviso.
- **Páginas:**
  - Termos e Privacidade mostram os marcadores e o e-mail de suporte;
  - `/u/[token]` aparece traduzida.
- **Checagens gerais:** acessibilidade, i18n-check, typecheck e lint.

## Pronto quando
- Os testes acima passam num banco limpo, sem quebrar os testes que já passavam.
- O `pendencias.md` lista os marcadores a preencher e as perguntas para o advogado e o contador.
- Nada é publicado sem o "pode publicar".
