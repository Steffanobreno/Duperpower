# Guia de configuração — tudo grátis

Ordem sugerida: 1 → 2 → 3 → 4 → 5. Cada passo funciona sozinho; o app já roda sem eles.

> **Mensagens automáticas começam DESLIGADAS.** Enquanto você ainda usa o app antigo, deixe assim
> (senão o cliente recebe tudo em dobro). No dia da troca: Settings → Texts and email →
> **Turn automatic messages on**, e desligue os lembretes no app antigo.

## 1. Banco de dados grátis (Neon)

1. Crie uma conta em neon.tech com o Gmail da Woofers (plano Free, sem cartão).
2. Crie um projeto (região **US West**). Copie a "connection string" (começa com `postgres://`).
3. Essa string vira `DATABASE_URL` no servidor (passo 2).

## 2. Hospedagem grátis (Netlify)

O plano **Premium** da Hostinger não roda apps Node.js (só o Business e acima). Por isso o app
fica no **Netlify (plano Free, permite uso comercial)**; a Hostinger continua com os seus sites.

1. Crie uma conta em netlify.com com o GitHub (plano Free, sem cartão).
2. **Add new site → Import from Git** → repositório `Duperpower`.
   O Netlify reconhece o Next.js sozinho (o arquivo `netlify.toml` já está no projeto).
   **Importante:** em *Build & deploy → Branches*, coloque **Production branch = `production`** e
   desligue *Branch deploys* e *Deploy previews*. Cada publicação gasta 15 dos 300 créditos do mês;
   assim só publicamos quando juntamos as mudanças (umas 4 por mês), e as melhorias do dia a dia
   não gastam créditos.
3. **Site configuration → Environment variables**: `DATABASE_URL`, `APP_URL`
   (ex.: `https://app.woofersdogspa.com`), `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `CRON_SECRET`.
4. Domínio: **Domain management → Add a domain** → `app.woofersdogspa.com`. O Netlify mostra um
   registro **CNAME**; crie esse registro onde o domínio `woofersdogspa.com` é gerenciado
   (Hostinger → Domínios → DNS, ou no Lovable, se o domínio estiver lá).
5. Uma vez só, crie as tabelas e os seus dados: `npm run db:migrate` e `npm run db:seed`
   (eu rodo daqui com a `DATABASE_URL`).
6. Abra `https://app.woofersdogspa.com` → crie o seu login de dono.

Limite do plano Free: 300 créditos por mês, com corte: se acabar, o app pausa até o mês seguinte.
Conta estimada para o seu volume (~75 visitas/mês): 4 publicações = 60, acessos e páginas ≈ 10–30,
tráfego ≈ 10–20 → **~100 de 300**. O Netlify avisa por e-mail em 50%, 75% e 100%; se chegar perto,
o plano Personal ($9/mês, 1.000 créditos) resolve na hora, sem mudar nada no app.

Banco (Neon Free): 100 horas de processamento por mês e 1 GB. O banco "dorme" depois de 5 min sem
uso; o primeiro acesso depois disso demora cerca de 1 segundo a mais. Uso estimado: ~15–25 horas.

**Antes de cancelar o MoeGo:** use os dois juntos por 2 a 4 semanas (mensagens automáticas do app
novo desligadas). Se algo falhar, o MoeGo ainda está lá. Só cancele depois de ver o uso real.

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

## 8. Trazer os clientes do app antigo

Settings → **Import clients** → escolha o arquivo `.csv` exportado → **Import clients**.
Vêm os clientes, os pets (com raça e frequência) e a próxima visita de cada um.
Pode importar de novo um export mais novo: quem já existe (mesmo telefone) não é duplicado.
Depois confira: o tamanho de cada pet (para o preço certo) e os serviços das visitas importadas.

## 9. Contrato de serviço

Settings → **Service agreement**. O seu texto já está lá (sem a seção 9, e com o
cancelamento: grátis até 48 h antes, depois 50% do serviço). O cliente assina digitando o nome: ao agendar online e no link
de confirmação (uma vez por ano). Mudança importante? Marque "ask every client to sign again".
