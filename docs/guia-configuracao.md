# Guia de configuração — tudo grátis

Ordem sugerida: 1 → 2 → 3 → 4 → 5. Cada passo funciona sozinho; o app já roda sem eles.

## 1. Banco de dados grátis (Neon)

1. Crie uma conta em neon.tech com o Gmail da Woofers (plano Free, sem cartão).
2. Crie um projeto (região **US West**). Copie a "connection string" (começa com `postgres://`).
3. Essa string vira `DATABASE_URL` no servidor (passo 2).

## 2. Hospedagem (Hostinger)

O app é Node.js (Next.js). O plano **Business** da Hostinger roda apps Node.js; os planos
mais baratos não. Se o seu for Business:

1. hPanel → Websites → Add website → **Node.js app** → conecte o GitHub e escolha o
   repositório `Duperpower`, branch `master`.
2. Comandos: build `npm run build`, start `npm start`.
3. Variáveis de ambiente (copie de `.env.example`): `DATABASE_URL`, `APP_URL`
   (ex.: `https://app.woofersdogspa.com`), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CRON_SECRET`.
4. Domínio: use um subdomínio, ex. **app.woofersdogspa.com**, apontando para esse app.
5. Uma vez só, crie as tabelas e os seus dados: `npm run db:migrate` e `npm run db:seed`
   (pelo terminal da Hostinger, ou eu rodo daqui com a `DATABASE_URL`).
6. Abra `https://app.woofersdogspa.com` → crie o seu login de dono.

No iPhone: abra o app no Safari → Compartilhar → **Adicionar à Tela de Início**.

## 3. E-mail automático (Gmail da Woofers)

1. myaccount.google.com → Segurança → ative a **Verificação em duas etapas**.
2. Na busca da conta, procure **Senhas de app** → crie uma chamada "Woofers app".
3. O Google mostra 16 letras: essa é a `GMAIL_APP_PASSWORD`. `GMAIL_USER` é o seu Gmail.
4. No app: Settings → Texts and email → coloque o seu e-mail (para avisos de pedidos e
   cancelamentos) e confira o link de review do Google.

Limite do Gmail: ~500 e-mails por dia. Você usa poucos por dia.

## 4. SMS automático pelo seu iPhone (linha AT&T)

No app: Settings → Texts and email → **Copy** no "Link for the Shortcut".

No iPhone, app **Atalhos** (Shortcuts):

1. Aba **Automação** → **+** → **Hora do Dia** → **10:00**, **Diariamente** →
   marque **Executar Imediatamente** → Avançar → **Nova Automação em Branco**.
2. Adicione **Obter Conteúdo do URL** → cole o link.
3. Adicione **Obter Valor do Dicionário** → Chave: `messages`.
4. Adicione **Repetir com Cada** (cada item do Valor do Dicionário).
5. Dentro do Repetir:
   - **Obter Valor do Dicionário** → Chave `body` → do **Item Repetido**;
   - **Obter Valor do Dicionário** → Chave `phone` → do **Item Repetido**;
   - **Enviar Mensagem** → Mensagem = o `body`, Destinatário = o `phone`.
     Toque na setinha da ação e **desligue "Mostrar ao Executar"** (senão ele pede para tocar em Enviar).
6. Salve. Faça outra automação igual às **18:00** (pedidos de avaliação e o que entrou à tarde).

Teste: na automação, toque em ▶︎. Se não houver nada para enviar, ele termina sem mandar nada.
Cada texto sai **uma vez só**; o app marca como "Sent from iPhone".

Respostas dos clientes chegam no seu Mensagens normal. Para confirmar ou cancelar, o texto
leva um link: o cliente toca e o app muda o status sozinho.

Se um cliente pedir para não receber textos: abra o cliente → Edit → desmarque
"Client agreed to receive text messages".

## 5. Google Calendar

No computador, Google Calendar → **Outras agendas** → **+** → **Do URL** → cole o
"Calendar link" de Settings → Texts and email. O Google atualiza a cada poucas horas
(não é instantâneo; a agenda certa e na hora é sempre a do app).

## 6. Botão "Book Now" no site (Lovable)

Cole isto no Lovable (troque o endereço pelo do seu app):

> Change every "Book Now" / "Book" button on the site so it opens
> https://app.woofersdogspa.com/book in the same tab. Keep the current button styles.

Se preferir a página dentro do site:

> Create a page at /book that shows only this, full width, no extra padding:
> `<iframe src="https://app.woofersdogspa.com/book" title="Book a visit" style="width:100%;min-height:1400px;border:0"></iframe>`
> and make every "Book Now" button link to /book.

## 7. Lembretes de hora em hora (opcional, grátis)

Para os e-mails saírem mesmo com o celular desligado: no GitHub do projeto → Settings →
Secrets and variables → Actions → crie `APP_URL` e `CRON_SECRET` (o mesmo do servidor).
O arquivo `.github/workflows/messages.yml` já chama o app de hora em hora.
