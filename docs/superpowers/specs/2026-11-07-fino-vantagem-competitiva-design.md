# Fino: vantagem competitiva sobre os apps de grooming móvel dos EUA

Data: 2026-11-07. Branch: `claude/clever-clarke-3ukcxg` (a partir da `google-map-tiles`).
Estado: aguardando a revisão do dono.

## 1. Objetivo (palavras do dono, resumidas)

- O **Fino** ganhar mais: mais assinantes, mais lucro, ticket médio maior por assinante.
- O groomer (o contratante) ter **vantagens que os concorrentes não oferecem**.
- **Custo quase zero para o Fino** em cada recurso. O plano é barato (US$29/mês, teste grátis), então nenhum recurso incluído pode ter custo variável relevante por assinante.
- Estratégia de **aumento de demanda**: as melhorias têm de trazer novos assinantes sozinhas.
- Avaliação completa, incluindo design e layout.

**Premissas minhas** (o dono pode corrigir):
- O mercado-alvo principal são os EUA. O Brasil e os outros países vêm de graça, porque o app já está em 20 idiomas.
- Tudo o que custa dinheiro por uso (SMS, cartão, IA) vira **adicional pago** ou taxa por transação, nunca um custo embutido nos US$29.

## 2. O que a pesquisa encontrou

Os sites oficiais estavam bloqueados nesta sessão. Os dados vêm de Capterra, GetApp, Toolradar e blogs. **Nada daqui vai para uma página pública sem conferir no site oficial e anotar a data** (regra que já está em `fino-competitor-analysis.md`).

| Concorrente | Preço (não conferido) | O que tem de bom | Fraqueza que exploramos |
|---|---|---|---|
| MoeGo | US$49–159 por van; groomer sozinho com SMS gasta ~US$139–200/mês | Agenda pensada na rota, mensagens de mão dupla, pagamentos | Caro; cobra por SMS; app lento; **não funciona sem internet**; a "agenda inteligente" é difícil de usar e fica nos planos caros |
| Goldie | Grátis até 20 visitas/mês; Pro por US$19,99 | Plano grátis; lembretes saem do celular do groomer (custo zero para eles); sinal | Genérico, sem nada de rota |
| Groomsoft | US$39,90 o plano móvel | Rota otimizada, quilometragem automática, Street View, **"pets atrasados perto da sua rota"** | Interface antiga; poucas avaliações |
| DaySmart Pet | ~US$29 | Pagamentos, cartão salvo, mensagens de mão dupla | Feito para pet shop com creche e hotel |
| Vagaro | US$24–30 + extras | IA de marketing | Comissão de 20% no marketplace, que gera reclamações |

**Dores do groomer móvel:**
- **Faltas:** cada uma custa US$50–150, mais o combustível e o horário que poderia ter sido de outro cliente.
- **Combustível:** um groomer de Fresno gasta US$4.000/mês; outro no Arizona diminuiu a área atendida.
- **Rotas mal feitas:** somam 30–50 milhas por dia.
- **Cliente que não volta.**
- **Buracos na agenda.**

Fontes: Capterra (MoeGo, Groomsoft), Toolradar, GoMarketBox, heygoldie.com, Tekpon, groomsoft.com, daysmart.com, Fox10 Phoenix, Groomer to Groomer, blog do MoeGo sobre faltas. Os links estão na conversa de 2026-11-07 e entram em `fino-competitor-analysis.md` na Onda 1.

## 3. Avaliação do Fino hoje

**Já tem** (conferido no código):
- Booking online por link e QR, com intake e contrato.
- Rota do dia com ETA e "estou chegando".
- Lista de espera e agendamentos abandonados.
- Lembrete de reagendar (`rebook_every_days` por pet).
- Histórico de tosa com foto (`pet_grooms`).
- Recibo com envio por WhatsApp/SMS (`receipt-actions.tsx`).
- Relatórios e folha de pagamento.
- 20 idiomas.
- Importação de qualquer planilha.
- Indicação e códigos de desconto.
- Acessibilidade WCAG AA e Lighthouse 97–100.

**Lacunas:**
- **Produto:**
  - nenhum boletim pós-banho para o dono do pet (a tabela `grooming_reports` existe desde a `0001`, mas nunca foi usada);
  - nenhuma ajuda para preencher horários vagos;
  - nenhum painel de indicadores;
  - preço não varia por porte ou peso;
  - sem taxa de deslocamento;
  - não funciona sem internet;
  - calendário sem grade por hora, visão do mês, arrastar ou cores;
  - sem cobrança de cartão do cliente final.
- **Crescimento:**
  - o booking e os e-mails do groomer não mostram o Fino a ninguém (zero efeito viral);
  - não há plano grátis contra o Goldie;
  - não há importação pronta do MoeGo nem do DaySmart.
- **Design:**
  - a página inicial do app (Hoje) mostra a rota, mas não mostra **dinheiro** (quanto falta para a meta, ocupação);
  - os relatórios são tabelas, sem visão rápida.

## 4. Estratégia: três ondas

Cada onda ganha a sua própria spec (esta seção já serve de spec da Onda 1), o seu plano (`superpowers:writing-plans`) e a sua execução (`superpowers:subagent-driven-development`). A ordem segue duas regras: **custo zero e impacto rápido primeiro**, e **o que traz assinantes antes do que traz receita extra**.

| Onda | Recursos | Custo para o Fino | Por que nesta ordem |
|---|---|---|---|
| **1. Fazer o cliente voltar e o Fino se espalhar** | Boletim pós-banho; Preencher o buraco; Painel de indicadores; "Agendado com Fino"; botões "Enviar pelo meu celular" | Zero (e-mail já pago, WhatsApp/SMS saem do celular do groomer) | É o que o groomer sente na 1ª semana do teste e o que traz novos assinantes sem anúncio |
| **2. Rota e ticket médio** | Agenda que agrupa por região (dias por área); lucro real por visita e por dia (combustível, milhas); preço por porte ou peso e taxa de deslocamento; calendário novo (grade por hora, mês, arrastar, cores); funcionamento sem internet; itens 1, 8, 9 e 10 da lista de revisão (configuração inicial) | Quase zero (as distâncias usam linha reta; o Google só onde já é usado hoje) | Ataca o maior custo do groomer móvel (combustível) e o ponto fraco do MoeGo |
| **3. Receita extra para o Fino** | Stripe Connect: sinal, taxa de falta, cartão salvo, com uma taxa pequena para o Fino; clube de assinatura do dono do pet; pacote de SMS/WhatsApp automático com margem; plano grátis limitado (Starter, ~15 visitas/mês); importação do MoeGo/DaySmart e `/moego-alternative` | Taxa por transação **é receita**; SMS revendido com margem | Precisa de assinantes primeiro, das contas de pagamento e de decisões comerciais do dono (percentuais) |

Fora das ondas (já na lista de pendências, cuidados à parte): o logo, o Google Agenda por OAuth, os apps nas lojas (Capacitor) e o embed da página de agendamento.

**O que não fazer:** recepcionista de IA incluída no plano (custo por uso), número de telefone próprio por groomer, marketplace com comissão.

## 5. Onda 1: design detalhado

### 5.1 Botões "Enviar pelo meu celular" (base comum)

**O que é:** um componente único que mostra "WhatsApp" e "SMS" e abre o app do celular do groomer com a mensagem pronta. Custo zero.

- Novo `src/components/send-from-phone.tsx`, recebendo `phone` (E.164), `text` e um `label` opcional. Gera `https://wa.me/<dígitos>?text=` e `sms:<phone>?&body=` (a forma com `?&` funciona no iOS e no Android).
- O `receipt-actions.tsx` passa a usar esse componente (é o mesmo padrão; nenhuma mudança visível).
- Sem telefone, os botões não aparecem. Cliente com `sms_opted_out_at`: o botão de SMS some e o de WhatsApp fica (foi o cliente que pediu para parar os SMS automáticos; mensagem manual pelo WhatsApp continua sendo escolha do groomer).

### 5.2 Boletim pós-banho

**O que é:** depois da visita, o dono do pet recebe um link com a foto de cada pet, o que foi feito e um botão "Agendar o próximo".

**Dados** (migração `0044_report_card.sql`):
- `appointments.report_token text unique` (aleatório, 16 bytes em hex, criado no 1º envio) e `appointments.report_sent_at timestamptz`.
- `pet_grooms.tags text[] not null default '{}'`: etiquetas rápidas de uma lista fixa (`calm`, `nervous`, `matting`, `sensitive_skin`, `ear_care`, `nails_done`, `teeth_brushed`, `flea_found`), traduzidas pelo i18n.
- A tabela `grooming_reports` (nunca usada) é removida nessa migração, para não haver dois conceitos de boletim.

**Tela do groomer** (`appointments/[id]`, no formulário de tosa existente):
- as etiquetas viram chips para marcar ao lado de lâmina, estilo, nota e foto;
- depois do checkout, ou a qualquer momento depois do início da visita, um cartão "Boletim" mostra a prévia, o botão "Enviar por e-mail" e os botões do 5.1 com o texto "{first_name}, o boletim do {pet} está aqui: {link}".

**Página pública** `/g/[token]` (`/r/` já é o recibo):
- sem login, `noindex`, no idioma do cliente;
- logo e nome do negócio; por pet: foto, etiquetas, a nota, o estilo;
- botão grande "Agendar o próximo": abre `/book/<slug>` já como cliente que retorna, com a data sugerida = dia da visita + `rebook_every_days` do pet (sem frequência: sem sugestão);
- botão "Avaliar no Google" se `review_url` estiver preenchido;
- rodapé do 5.4.

Token inválido: 404. A foto é servida por uma rota que valida o token (`/g/[token]/photo/[groomId]`), nunca pela rota interna do groomer.

**E-mail:**
- novo gatilho `report_card` em `messaging.ts`, com o modelo padrão em inglês e editável, como os demais modelos (`new-business.ts`); a migração cria o modelo também para as empresas que já existem;
- sai pelo e-mail que já existe; nunca vai por SMS automático (o SMS fica com o botão do celular).
- Em Ajustes → Mensagens, o modelo "Boletim" começa desligado (`enabled = false`). Ligado, o e-mail sai pela tarefa de mensagens (`queueDueMessages`) depois do checkout, se houver pelo menos uma foto, nota ou etiqueta. O botão "Enviar por e-mail" da visita funciona mesmo com o modelo desligado.
- `dedupe_key = report:<appointment_id>`.

### 5.3 Preencher o buraco

**O que é:** para um dia com tempo livre, o Fino lista quem convidar, do mais perto para o mais longe, com a mensagem pronta.

**Quem entra na lista** (`src/lib/data/fill-gap.ts`, uma consulta SQL, sem serviço pago):
1. Pessoas da lista de espera que aceitam aquele dia (a lista de espera já existe).
2. Clientes com pet **atrasado ou quase**: última visita + `rebook_every_days` ≤ o dia + 7. Sem frequência, 42 dias.
3. Clientes sem visita futura marcada.

Ficam de fora: inativos, falecidos, com visita marcada nos próximos 14 dias.

**Ordem:** distância em linha reta (`milesBetween` com as coordenadas; sem coordenadas, o centro do CEP por `postalPoints`, como o `nearbyDays` já faz) da casa do cliente até a parada mais próxima daquele dia. Sem paradas no dia, até o CEP de partida da van (`businesses.start_zip`). Cliente sem coordenadas vai para o fim, marcado "sem endereço no mapa". Mostra milhas ou km conforme o país da empresa.

**Horários vagos:** `freeGaps(day)` usa o horário de trabalho menos as visitas e os bloqueios. Mostra só buracos maiores que a menor duração de serviço ativa.

**Onde aparece:**
- na tela **Hoje**, um cartão "{n} horários vagos · {m} clientes perto" quando o dia mostrado tem buraco (hoje ou futuro);
- na tela de uma visita **cancelada**, o atalho "Preencher este horário".

Os dois abrem `/fill/[date]`: os buracos no topo e a lista (até 30). Cada linha tem nome, pet, "atrasado há X dias" ou "na lista de espera", distância e os botões do 5.1. O texto usa um modelo editável novo, `gap_offer` (só manual, como o `on_my_way`): "Oi {first_name}! Vou estar perto de você {day}. Tenho horário às {time} para o {pet}. Quer agendar? {booking_link}".

**Registro:** tocar num botão grava `fill_offers (business_id, client_id, day, sent_at)`. Assim a linha mostra "convidado hoje" e o painel do 5.5 conta convites e quantos viraram visita.

### 5.4 "Agendado com Fino" (crescimento)

**O que é:** uma linha discreta no rodapé do `ClientShell` (o mesmo rodapé de agendamento, boletim, recibo, link da visita e ficha de cliente novo) e dos e-mails para clientes: "Agendamento online por **Fino** · teste grátis para groomers". O link é `/?ref=<referral_code do groomer>&utm_source=powered_by`.

- O Fino ganha um canal gratuito de aquisição. Quem assina por esse link conta como indicação do groomer, e o groomer ganha os US$29 de crédito que o programa de indicação já paga. Isso motiva o groomer a não esconder a linha.
- Não há opção de esconder na Onda 1 (pode virar recurso de um plano maior depois).
- A página inicial do site passa a levar o `ref` e o `utm_source` que recebeu para os botões "Começar grátis" (hoje eles se perdem no caminho até `/signup`).
- `businesses.signup_source` já existe, mas hoje, quando o link tem `ref`, o cadastro guarda só o código e descarta o `utm_source`. A função `signupSource` (`src/app/signup/page.tsx`) passa a guardar os dois (`<code> / powered_by`). Assim o /admin → Funil separa a indicação comum da que veio do rodapé.

### 5.5 Painel de indicadores

**O que é:** no topo de **Relatórios**, e em versão de 3 números no topo da tela **Hoje**, o mês até hoje comparado ao mesmo período do mês passado:
- faturamento recebido;
- visitas feitas;
- ticket médio (faturamento ÷ visitas);
- **taxa de retorno** (clientes atendidos nos últimos 60 dias que já têm uma visita futura);
- **ocupação** (horas marcadas ÷ horas de trabalho);
- faltas e cancelamentos;
- clientes atrasados (abre o 5.3);
- boletins enviados e convites que viraram visita.

**Implementação:**
- `src/lib/data/kpis.ts`: uma função por indicador, cada uma uma consulta só, sobre tabelas que já existem;
- respeita o fuso e a moeda da empresa (`format.ts`);
- **Hoje** mostra faturamento do mês, ocupação da semana e atrasados;
- cada número tem a seta de variação; sem gráfico pesado (Lighthouse continua ≥ 97).

### 5.6 Erros e casos de borda

- **Todo texto novo nos 20 idiomas.** O teste de frases traduzidas existente cobre isso.
- **Permissões:**
  - boletim e "preencher" exigem a mesma permissão de ver agendamentos;
  - o painel exige a permissão de relatórios. Funcionário sem ela vê o Hoje sem os números de dinheiro.
- **Página pública do boletim:** limite por IP como nas outras rotas públicas; o token nunca aparece nos logs de erro.
- **Empresa sem fotos ou sem `review_url`:** os blocos somem, nunca ficam vazios.

### 5.7 Testes (Playwright, padrão do repositório)

- `report-card.mjs`:
  - marca etiquetas e foto;
  - envia;
  - abre `/g/<token>` deslogado;
  - confere foto, etiquetas e o link de reagendar com a data sugerida;
  - token errado dá 404;
  - o e-mail automático sai uma vez só.
- `fill-gap.mjs`:
  - dia com buraco;
  - três clientes a distâncias diferentes aparecem em ordem;
  - cliente com visita marcada fica de fora;
  - o botão do WhatsApp tem o texto certo;
  - o convite é registrado.
- `kpis.mjs`: dados conhecidos e os números esperados (ticket, ocupação, retorno), incluindo a virada de mês no fuso da empresa.
- `powered-by.mjs`:
  - o rodapé aparece no booking e no boletim com o `ref` do groomer;
  - o cadastro por esse link grava `signup_source` e a indicação.
- O `a11y.mjs` passa a incluir `/g/[token]` e `/fill/[date]`.

### 5.8 Critério de pronto da Onda 1

- `npm run typecheck`, `npm run lint` e a suíte e2e verdes.
- Lighthouse de `/book/<slug>` e `/g/<token>` ≥ 97 em velocidade.
- `docs/fino-competitor-analysis.md` atualizado com esta pesquisa e os links.
- `docs/pendencias.md` atualizado.
- Nada publicado na `master` sem o "pode publicar" do dono.

## 6. Próximas specs

Quando a Onda 1 estiver pronta, a Onda 2 ganha a sua própria spec, com as perguntas que só o dono responde:
- custo padrão do combustível e consumo da van;
- se a agenda por região bloqueia ou só sugere;
- as faixas de porte e peso.

Na Onda 3, as decisões são:
- o percentual da taxa por transação;
- o preço do pacote de SMS;
- os limites do plano grátis.
