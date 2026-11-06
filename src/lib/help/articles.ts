// The help center: short how-to articles for the groomer's app. English is the source; the
// Portuguese and Spanish versions are full translations. Other languages show the English
// article, and the assistant (/help) answers in the person's own language from these texts.
// Keep the steps true to the app's screens: the assistant is told to answer only from them.

export type HelpArticle = {
  slug: string;
  topic: "start" | "clients" | "booking" | "day" | "money" | "messages" | "team" | "settings";
  title: string;
  summary: string;
  steps: string[];
  tips?: string[];
};

export const TOPICS: { key: HelpArticle["topic"]; en: string; pt: string; es: string }[] = [
  { key: "start", en: "Getting started", pt: "Primeiros passos", es: "Primeros pasos" },
  { key: "clients", en: "Clients and pets", pt: "Clientes e pets", es: "Clientes y mascotas" },
  { key: "booking", en: "Booking", pt: "Agendamentos", es: "Reservas" },
  { key: "day", en: "Your day on the road", pt: "Seu dia na rua", es: "Tu día en ruta" },
  { key: "money", en: "Payments and reports", pt: "Pagamentos e relatórios", es: "Pagos e informes" },
  { key: "messages", en: "Texts, email and marketing", pt: "Mensagens, e-mail e marketing", es: "Mensajes, email y marketing" },
  { key: "team", en: "Team", pt: "Equipe", es: "Equipo" },
  { key: "settings", en: "Settings", pt: "Ajustes", es: "Ajustes" },
];

const en: HelpArticle[] = [
  {
    slug: "set-up", topic: "start", title: "Set up your business in 5 minutes",
    summary: "The five steps after signing up: business, prices, hours, clients and your booking link.",
    steps: [
      "Right after signing up, the setup opens with 5 short steps. Each one can be skipped and done later.",
      "Step 1 · Your business: add your logo (tap Add logo), your business phone and, if you have one, your address.",
      "Step 2 · Your prices: every service comes with a starting price. Type your own prices and untick the add-ons you don't offer.",
      "Step 3 · Your working hours: tick the days you work and set the start and end times.",
      "Step 4 · Your clients: import your client list from your old app, add your first client, or leave it for later.",
      "Step 5 · Share your booking link: copy the link or save the QR code and put it on Instagram, WhatsApp and your Google profile.",
      "Skipped something? Today shows Continue setup until you finish.",
    ],
  },
  {
    slug: "services", topic: "start", title: "Services, add-ons and prices",
    summary: "Add or change services, prices by dog size, times and add-ons.",
    steps: [
      "Open Settings → Services and prices.",
      "Tap a service to change its name, price, time, size or category. Tap New service to add one.",
      "Services that cost more for bigger dogs have one line per size (Small, Medium, Large, X-Large). A service for every dog uses Any size.",
      "Add-ons (nail painting, de-shedding…) are added on top of a service. Set their price and the extra time they take (0 if none).",
      "Untick Active to hide a service without deleting it; untick Clients can book it online to keep it only for you.",
      "A special price for one dog: open the pet (Clients → the client → the pet) and add a price just for them.",
    ],
    tips: ["Price changes apply to new bookings. Visits already booked keep their price."],
  },
  {
    slug: "sizes-weight", topic: "settings", title: "Sizes by height or by weight; pounds or kilos",
    summary: "Choose how you sort dogs into sizes and the units you measure in.",
    steps: [
      "Open Settings → Business and scroll to Measurements.",
      "Sort dogs into sizes by: Height at the shoulder, or Weight.",
      "Weight in: pounds (lb) or kilograms (kg). Height in: inches or centimeters.",
      "Tap Save. Your services, the pet form and your booking page now show sizes your way.",
      "Sizing by weight: when you type a pet's weight, its size is set for you (Small up to 20 lb / 9 kg, Medium up to 50 lb / 22 kg, Large up to 90 lb / 40 kg, X-Large above).",
    ],
  },
  {
    slug: "add-client", topic: "clients", title: "Add a client and their pets",
    summary: "The fastest way to add a client, and what each field is for.",
    steps: [
      "Tap Clients, then + (New client).",
      "Only the first name and the mobile phone are required. The address is filled in for you when you pick a suggestion while typing.",
      "Tick the text consent box if the client agreed to get texts about their visits.",
      "Tap Save and add a pet. Only the pet's name is required; breed, size, weight and notes help you price and prepare.",
      "Inside a pet you can add vaccines (with expiry dates), a special price, and the cut you did each visit (blade, length, photo).",
    ],
    tips: ["Clients who book on your booking page are added for you, with their pets."],
  },
  {
    slug: "import", topic: "clients", title: "Bring your clients from another app",
    summary: "Import a client list (CSV) without creating duplicates.",
    steps: [
      "In your old app or spreadsheet, export the client list as a CSV file.",
      "Open Settings → Import and export clients, choose the file and tap Import clients.",
      "Clients are matched by phone number, so importing the same file twice doesn't create duplicates.",
      "Pets come with their breed and grooming frequency. Set each pet's size when you see them.",
      "You can also download your own client list (CSV) there anytime, as a backup.",
    ],
  },
  {
    slug: "book-visit", topic: "booking", title: "Book a visit from the app",
    summary: "Book a client in a few taps, with the right price and time.",
    steps: [
      "Tap Book (top of Today), or open the client and tap + New appointment.",
      "Pick the client, then tick the pets for this visit and choose a service for each one. Add-ons are optional.",
      "Pick the day and start time. The time estimate comes from the services; use − and + to change it.",
      "Leave Send the confirmation ticked to text and email the client, then tap Book appointment.",
      "To repeat it, open the visit and tap Repeat this appointment (every few weeks, or dates you pick).",
    ],
    tips: ["If the client is already booked near another visit that day, the app suggests times right after it."],
  },
  {
    slug: "online-booking", topic: "booking", title: "Your online booking page",
    summary: "Let clients book themselves, and choose what happens with each request.",
    steps: [
      "Open Settings → Online booking. Your booking link and QR code are at the top.",
      "Choose what happens when a client books: you accept each request, people you know are booked right away, or everyone is booked right away.",
      "Set the notice you need, how far ahead clients can book, and the start times (for example every 2 hours).",
      "Requests show up in Today and in Booking requests. Accept or decline them there; the client gets a text either way.",
      "Clients who stop halfway show up in Abandoned bookings, so you can call or text them.",
    ],
  },
  {
    slug: "service-areas", topic: "booking", title: "Service area and areas by day",
    summary: "Limit where you go, and which days you go to each area.",
    steps: [
      "In Settings → Online booking set the van's home postal code and the service area (distance from home).",
      "For areas by day, open Settings → Service areas → Add area.",
      "Give it a name and a color, list the postal codes (or their first part), and pick the days you go there.",
      "Online, clients only see times on their area's days, and addresses outside every area can't book.",
    ],
  },
  {
    slug: "today", topic: "day", title: "Today: your route, on my way and finishing",
    summary: "Run the day from one screen.",
    steps: [
      "Today shows the day's stops on the map and as cards. Swipe the cards or switch to List.",
      "Tap 🧭 Find the best order to have the stops reordered for the least driving.",
      "On a visit, tap I'm on the way: the client gets a text with your arrival time.",
      "When you arrive, tap Check in. When you're done, tap Finish order to take payment.",
      "No signal in the van? The app keeps showing the last saved copy and updates when the signal comes back.",
    ],
  },
  {
    slug: "reschedule", topic: "booking", title: "Move, cancel or mark a no-show",
    summary: "Change a visit and let the client know.",
    steps: [
      "Open the visit (tap it in Today or Calendar).",
      "Reschedule: pick a new day and tap a free time. Leave Tell the client about the new time ticked.",
      "Cancel: the client gets the cancellation text. No-show: the visit comes off your day.",
      "Marked by mistake? Open it and tap Restore.",
    ],
  },
  {
    slug: "checkout", topic: "money", title: "Finish an order and take payment",
    summary: "Services, discounts, tips and payment in three steps.",
    steps: [
      "Open the visit and tap Finish order.",
      "Step 1 · Services: check the services and prices. Add a discount, a service charge or tax if needed.",
      "Step 2 · Payment: add a tip (choose a percent or type an amount), then pick how the client paid (cash, card, check, Zelle, Venmo…).",
      "For cash, type what you received and the app shows the change. Tap Charge.",
      "Step 3 · Receipt: email it, text the link, or share the PDF.",
      "The client will pay later? Tap The client will pay later; the balance shows on the visit.",
    ],
  },
  {
    slug: "reports", topic: "money", title: "Reports and payroll",
    summary: "See what came in, and what to pay each groomer.",
    steps: [
      "Tap Reports. Pick a period (today, this week, this month…) or your own dates.",
      "See collected money, expected service price, dogs groomed, payment methods and top clients.",
      "Download it as PDF or Excel (CSV) for your accountant.",
      "Payroll (top right) adds commission, tips share and hours for each groomer. Set each person's pay in Settings → Team.",
    ],
  },
  {
    slug: "messages", topic: "messages", title: "Automatic texts and email",
    summary: "Confirmations, reminders, rebook and review messages, sent for you.",
    steps: [
      "Open Settings → Texts and email.",
      "Turn each message on or off and edit its text. Words in {braces} (like {client} or {date}) are filled in for each client.",
      "Reminders go out a set number of days before the visit at the time you choose; you can add a second reminder.",
      "Texts go out from your own iPhone with a Shortcuts automation (follow the steps on that page), and email from your business email.",
      "Use Preview emails to see what clients get.",
    ],
  },
  {
    slug: "marketing", topic: "messages", title: "Email campaigns",
    summary: "Send a holiday hello or a “we miss you” to the right clients.",
    steps: [
      "Open Marketing → New email. Start from a template or a blank email.",
      "1 Write: subject, picture, headline, text and button.",
      "2 Who: choose clients by last visit, next visit, breed or city.",
      "3 Send: send yourself a test, then send now or schedule it.",
      "Add your mailing address on the Marketing page first; it goes in small print at the bottom.",
    ],
  },
  {
    slug: "team", topic: "team", title: "Add groomers and choose what they can do",
    summary: "Each groomer gets a color, a route and, if you want, their own login.",
    steps: [
      "Open Settings → Team → Add groomer. Give them a name and a color.",
      "To let them use the app on their phone, open them and tap Give a login (their email and a password).",
      "Choose what admins and groomers can see and do in Team → Roles and permissions.",
      "Set their commission, tips share and hourly pay; turn on Clock in and out to track hours.",
    ],
  },
  {
    slug: "country-language", topic: "settings", title: "Country, currency, time zone and language",
    summary: "Make the app fit where you work.",
    steps: [
      "Settings → Business: choose your Country, Currency and Time zone. Phones, addresses, the map, distances and holidays follow the country.",
      "Settings → Account → Language: the app's language for you. Each person on the team picks their own.",
      "Clients pick their own language on your booking page (the 🌐 menu).",
    ],
  },
  {
    slug: "closed-days", topic: "settings", title: "Vacations, holidays and blocked time",
    summary: "Days and hours nobody can book.",
    steps: [
      "Settings → Closed dates and holidays: add your vacation (first and last day) and tick the holidays you don't work.",
      "For a few hours (lunch, van service), open Calendar and tap Block time.",
      "On closed days clients can't book online and the calendar shows the day as closed.",
    ],
  },
  {
    slug: "notifications", topic: "settings", title: "Notifications on your phone",
    summary: "Get a pop-up when a client books, confirms, cancels or asks for another time.",
    steps: [
      "On iPhone, first add the app to your Home Screen (Safari → Share → Add to Home Screen) and open it from there.",
      "Open Settings → Notifications and tap Turn on notifications on this device.",
      "Tap Send a test to check it works.",
    ],
  },
  {
    slug: "troubleshooting", topic: "settings", title: "Something isn't working",
    summary: "Quick fixes for the most common problems.",
    steps: [
      "The page took too long: the app may have been waking up or the signal dropped. Tap Try again.",
      "Texts aren't going out: check Settings → Texts and email (automatic messages on) and that your iPhone automation ran.",
      "Emails aren't going out: Settings → Texts and email shows whether email is set up.",
      "Notifications don't show: see “Notifications on your phone”, and check the phone's notification settings.",
      "Still stuck? Ask the assistant on this page, or tap Talk to a person.",
    ],
  },
];

const pt: Record<string, Omit<HelpArticle, "slug" | "topic">> = {
  "set-up": {
    title: "Configure seu negócio em 5 minutos",
    summary: "Os cinco passos depois do cadastro: negócio, preços, horário, clientes e link de agendamento.",
    steps: [
      "Logo depois do cadastro, abre a configuração com 5 passos curtos. Dá para pular qualquer um e fazer depois.",
      "Passo 1 · Seu negócio: coloque seu logo (toque em Adicionar logo), o telefone do negócio e, se tiver, o endereço.",
      "Passo 2 · Seus preços: cada serviço vem com um preço inicial. Digite os seus e desmarque os adicionais que você não oferece.",
      "Passo 3 · Seu horário de trabalho: marque os dias que você trabalha e o horário de início e fim.",
      "Passo 4 · Seus clientes: importe a lista do app antigo, cadastre o primeiro cliente, ou deixe para depois.",
      "Passo 5 · Compartilhe seu link: copie o link ou salve o QR code e coloque no Instagram, WhatsApp e perfil do Google.",
      "Pulou algo? A tela Hoje mostra Continuar configuração até você terminar.",
    ],
  },
  services: {
    title: "Serviços, adicionais e preços",
    summary: "Adicionar ou mudar serviços, preços por tamanho, tempos e adicionais.",
    steps: [
      "Abra Ajustes → Serviços e preços.",
      "Toque num serviço para mudar nome, preço, tempo, tamanho ou categoria. Toque em Novo serviço para criar um.",
      "Serviços que custam mais para cães maiores têm uma linha por tamanho (Pequeno, Médio, Grande, Extra grande). Um serviço igual para todos usa Qualquer tamanho.",
      "Adicionais (pintura de unhas, remoção de subpelo…) somam a um serviço. Defina o preço e o tempo extra (0 se não tiver).",
      "Desmarque Ativo para esconder sem apagar; desmarque Clientes podem agendar online para deixar só para você.",
      "Preço especial para um cão: abra o pet (Clientes → o cliente → o pet) e adicione um preço só para ele.",
    ],
    tips: ["Mudanças de preço valem para agendamentos novos. Visitas já marcadas mantêm o preço."],
  },
  "sizes-weight": {
    title: "Tamanho por altura ou por peso; libras ou quilos",
    summary: "Escolha como separar os cães por tamanho e as unidades.",
    steps: [
      "Abra Ajustes → Negócio e desça até Medidas.",
      "Separar os cães por tamanho pela: Altura na cernelha, ou Peso.",
      "Peso em: libras (lb) ou quilos (kg). Altura em: polegadas ou centímetros.",
      "Toque em Salvar. Os serviços, a ficha do pet e sua página de agendamento passam a mostrar os tamanhos do seu jeito.",
      "Por peso: quando você digita o peso do pet, o tamanho é escolhido sozinho (Pequeno até 9 kg / 20 lb, Médio até 22 kg / 50 lb, Grande até 40 kg / 90 lb, Extra grande acima).",
    ],
  },
  "add-client": {
    title: "Cadastrar um cliente e seus pets",
    summary: "O jeito mais rápido de cadastrar, e para que serve cada campo.",
    steps: [
      "Toque em Clientes e depois em + (Novo cliente).",
      "Só o primeiro nome e o celular são obrigatórios. O endereço se completa sozinho quando você escolhe uma sugestão.",
      "Marque o consentimento de mensagens se o cliente aceitou receber mensagens sobre as visitas.",
      "Toque em Salvar e cadastre um pet. Só o nome é obrigatório; raça, tamanho, peso e observações ajudam no preço e no preparo.",
      "Dentro do pet você coloca vacinas (com vencimento), um preço especial e o corte de cada visita (lâmina, comprimento, foto).",
    ],
    tips: ["Clientes que agendam pela sua página entram sozinhos, com os pets."],
  },
  import: {
    title: "Trazer seus clientes de outro app",
    summary: "Importar uma lista de clientes (CSV) sem criar duplicados.",
    steps: [
      "No app antigo ou na planilha, exporte a lista de clientes em CSV.",
      "Abra Ajustes → Importar e exportar clientes, escolha o arquivo e toque em Importar clientes.",
      "Os clientes são reconhecidos pelo telefone, então importar o mesmo arquivo duas vezes não duplica.",
      "Os pets vêm com raça e frequência de tosa. Defina o tamanho de cada pet quando atender.",
      "Ali você também baixa sua própria lista (CSV) quando quiser, como cópia de segurança.",
    ],
  },
  "book-visit": {
    title: "Agendar uma visita pelo app",
    summary: "Agende um cliente em poucos toques, com o preço e o tempo certos.",
    steps: [
      "Toque em Agendar (no alto da tela Hoje), ou abra o cliente e toque em + Novo agendamento.",
      "Escolha o cliente, marque os pets da visita e escolha um serviço para cada um. Adicionais são opcionais.",
      "Escolha o dia e o horário. O tempo estimado vem dos serviços; use − e + para mudar.",
      "Deixe Enviar a confirmação marcado para mandar mensagem e e-mail ao cliente, e toque em Agendar.",
      "Para repetir, abra a visita e toque em Repetir este agendamento (a cada tantas semanas, ou datas que você escolhe).",
    ],
    tips: ["Se você já tem outra visita perto do cliente naquele dia, o app sugere horários logo depois dela."],
  },
  "online-booking": {
    title: "Sua página de agendamento online",
    summary: "Deixe os clientes agendarem sozinhos e escolha o que acontece com cada pedido.",
    steps: [
      "Abra Ajustes → Agendamento online. Seu link e o QR code estão no alto.",
      "Escolha o que acontece quando alguém agenda: você aceita cada pedido, quem você já conhece entra direto, ou todos entram direto.",
      "Defina a antecedência mínima, até quantos dias à frente dá para agendar e os horários de início (por exemplo a cada 2 horas).",
      "Os pedidos aparecem em Hoje e em Pedidos de agendamento. Aceite ou recuse ali; o cliente recebe mensagem nos dois casos.",
      "Quem para no meio aparece em Agendamentos abandonados, para você ligar ou mandar mensagem.",
    ],
  },
  "service-areas": {
    title: "Área de atendimento e áreas por dia",
    summary: "Limite onde você vai, e em que dias vai a cada região.",
    steps: [
      "Em Ajustes → Agendamento online, coloque o CEP da base da van e a área de atendimento (distância da base).",
      "Para áreas por dia, abra Ajustes → Áreas de atendimento → Adicionar área.",
      "Dê um nome e uma cor, liste os CEPs (ou o começo deles) e escolha os dias em que você vai lá.",
      "Online, os clientes só veem horários nos dias da área deles, e endereços fora de todas as áreas não agendam.",
    ],
  },
  today: {
    title: "Hoje: sua rota, a caminho e fechamento",
    summary: "Toque o dia inteiro numa tela só.",
    steps: [
      "Hoje mostra as paradas do dia no mapa e em cartões. Deslize os cartões ou troque para Lista.",
      "Toque em 🧭 Encontrar a melhor ordem para reorganizar as paradas com menos estrada.",
      "Na visita, toque em Estou a caminho: o cliente recebe mensagem com o horário de chegada.",
      "Ao chegar, toque em Check-in. Ao terminar, toque em Finalizar pedido para receber.",
      "Sem sinal na van? O app mostra a última cópia salva e atualiza quando o sinal volta.",
    ],
  },
  reschedule: {
    title: "Remarcar, cancelar ou marcar falta",
    summary: "Mude uma visita e avise o cliente.",
    steps: [
      "Abra a visita (toque nela em Hoje ou no Calendário).",
      "Remarcar: escolha o novo dia e toque num horário livre. Deixe Avisar o cliente marcado.",
      "Cancelar: o cliente recebe a mensagem de cancelamento. Falta: a visita sai do seu dia.",
      "Marcou sem querer? Abra a visita e toque em Restaurar.",
    ],
  },
  checkout: {
    title: "Finalizar um pedido e receber",
    summary: "Serviços, descontos, gorjeta e pagamento em três passos.",
    steps: [
      "Abra a visita e toque em Finalizar pedido.",
      "Passo 1 · Serviços: confira serviços e preços. Adicione desconto, taxa ou imposto se precisar.",
      "Passo 2 · Pagamento: coloque a gorjeta (escolha uma porcentagem ou digite o valor) e como o cliente pagou (dinheiro, cartão, Pix, cheque…).",
      "Em dinheiro, digite quanto recebeu e o app mostra o troco. Toque em Cobrar.",
      "Passo 3 · Recibo: mande por e-mail, mande o link por mensagem ou compartilhe o PDF.",
      "O cliente vai pagar depois? Toque em O cliente vai pagar depois; o saldo fica na visita.",
    ],
  },
  reports: {
    title: "Relatórios e folha de pagamento",
    summary: "Veja o que entrou e quanto pagar a cada groomer.",
    steps: [
      "Toque em Relatórios. Escolha o período (hoje, esta semana, este mês…) ou suas datas.",
      "Veja o recebido, o previsto, cães atendidos, formas de pagamento e melhores clientes.",
      "Baixe em PDF ou Excel (CSV) para o contador.",
      "Folha de pagamento (no alto, à direita) soma comissão, parte das gorjetas e horas de cada groomer. Defina o pagamento de cada um em Ajustes → Equipe.",
    ],
  },
  messages: {
    title: "Mensagens e e-mails automáticos",
    summary: "Confirmações, lembretes, retorno e avaliação, enviados por você.",
    steps: [
      "Abra Ajustes → Mensagens e e-mail.",
      "Ligue ou desligue cada mensagem e edite o texto. Palavras entre {chaves} (como {client} ou {date}) são preenchidas para cada cliente.",
      "Os lembretes saem alguns dias antes da visita, no horário que você escolher; dá para ter um segundo lembrete.",
      "As mensagens saem do seu próprio iPhone com uma automação do app Atalhos (siga os passos nessa página), e os e-mails do e-mail do negócio.",
      "Use Pré-visualizar e-mails para ver o que o cliente recebe.",
    ],
  },
  marketing: {
    title: "Campanhas de e-mail",
    summary: "Mande um feliz feriado ou um “sentimos sua falta” para os clientes certos.",
    steps: [
      "Abra Marketing → Novo e-mail. Comece de um modelo ou em branco.",
      "1 Escrever: assunto, imagem, título, texto e botão.",
      "2 Para quem: escolha clientes pela última visita, próxima visita, raça ou cidade.",
      "3 Enviar: mande um teste para você e depois envie agora ou agende.",
      "Coloque antes seu endereço de correspondência na página Marketing; ele vai em letra pequena no fim.",
    ],
  },
  team: {
    title: "Adicionar groomers e escolher o que podem fazer",
    summary: "Cada groomer tem uma cor, uma rota e, se você quiser, seu próprio login.",
    steps: [
      "Abra Ajustes → Equipe → Adicionar groomer. Dê um nome e uma cor.",
      "Para ele usar o app no próprio celular, abra-o e toque em Dar um login (e-mail e senha).",
      "Escolha o que administradores e groomers veem e fazem em Equipe → Funções e permissões.",
      "Defina comissão, parte das gorjetas e valor por hora; ligue o ponto (entrada e saída) para contar horas.",
    ],
  },
  "country-language": {
    title: "País, moeda, fuso horário e idioma",
    summary: "Deixe o app do jeito do lugar onde você trabalha.",
    steps: [
      "Ajustes → Negócio: escolha País, Moeda e Fuso horário. Telefones, endereços, mapa, distâncias e feriados seguem o país.",
      "Ajustes → Conta → Idioma: o idioma do app para você. Cada pessoa da equipe escolhe o seu.",
      "Os clientes escolhem o idioma deles na sua página de agendamento (menu 🌐).",
    ],
  },
  "closed-days": {
    title: "Férias, feriados e horários bloqueados",
    summary: "Dias e horas em que ninguém agenda.",
    steps: [
      "Ajustes → Datas fechadas e feriados: coloque suas férias (primeiro e último dia) e marque os feriados em que não trabalha.",
      "Para algumas horas (almoço, oficina da van), abra o Calendário e toque em Bloquear horário.",
      "Nos dias fechados os clientes não agendam online e o calendário mostra o dia fechado.",
    ],
  },
  notifications: {
    title: "Notificações no celular",
    summary: "Receba um aviso quando um cliente agenda, confirma, cancela ou pede outro horário.",
    steps: [
      "No iPhone, primeiro adicione o app à Tela de Início (Safari → Compartilhar → Adicionar à Tela de Início) e abra por lá.",
      "Abra Ajustes → Notificações e toque em Ligar notificações neste aparelho.",
      "Toque em Enviar um teste para conferir.",
    ],
  },
  troubleshooting: {
    title: "Algo não está funcionando",
    summary: "Soluções rápidas para os problemas mais comuns.",
    steps: [
      "A página demorou: o app pode estar acordando ou o sinal caiu. Toque em Tentar de novo.",
      "As mensagens não saem: confira Ajustes → Mensagens e e-mail (mensagens automáticas ligadas) e se a automação do iPhone rodou.",
      "Os e-mails não saem: Ajustes → Mensagens e e-mail mostra se o e-mail está configurado.",
      "As notificações não aparecem: veja “Notificações no celular” e as configurações de notificação do celular.",
      "Ainda travado? Pergunte ao assistente nesta página, ou toque em Falar com uma pessoa.",
    ],
  },
};

const es: Record<string, Omit<HelpArticle, "slug" | "topic">> = {
  "set-up": {
    title: "Configura tu negocio en 5 minutos",
    summary: "Los cinco pasos después de registrarte: negocio, precios, horario, clientes y enlace de reservas.",
    steps: [
      "Justo después de registrarte se abre la configuración con 5 pasos cortos. Puedes saltar cualquiera y hacerlo después.",
      "Paso 1 · Tu negocio: agrega tu logo, el teléfono del negocio y, si tienes, la dirección.",
      "Paso 2 · Tus precios: cada servicio trae un precio inicial. Escribe los tuyos y desmarca los adicionales que no ofreces.",
      "Paso 3 · Tu horario: marca los días que trabajas y la hora de inicio y fin.",
      "Paso 4 · Tus clientes: importa la lista de tu app anterior, agrega tu primer cliente, o déjalo para después.",
      "Paso 5 · Comparte tu enlace: copia el enlace o guarda el código QR y ponlo en Instagram, WhatsApp y tu perfil de Google.",
      "¿Saltaste algo? Hoy muestra Seguir configurando hasta que termines.",
    ],
  },
  services: {
    title: "Servicios, adicionales y precios",
    summary: "Agregar o cambiar servicios, precios por tamaño, tiempos y adicionales.",
    steps: [
      "Abre Ajustes → Servicios y precios.",
      "Toca un servicio para cambiar nombre, precio, tiempo, tamaño o categoría. Toca Nuevo servicio para crear uno.",
      "Los servicios que cuestan más para perros grandes tienen una línea por tamaño. Un servicio igual para todos usa Cualquier tamaño.",
      "Los adicionales se suman a un servicio. Pon su precio y el tiempo extra (0 si no tiene).",
      "Desmarca Activo para ocultarlo sin borrarlo; desmarca Reserva en línea para dejarlo solo para ti.",
      "Precio especial para un perro: abre la mascota (Clientes → el cliente → la mascota) y agrega un precio solo para ella.",
    ],
    tips: ["Los cambios de precio valen para reservas nuevas. Las visitas ya reservadas mantienen su precio."],
  },
  "sizes-weight": {
    title: "Tamaño por altura o por peso; libras o kilos",
    summary: "Elige cómo clasificar a los perros por tamaño y las unidades.",
    steps: [
      "Abre Ajustes → Negocio y baja hasta Medidas.",
      "Clasificar perros por tamaño según: Altura a la cruz, o Peso.",
      "Peso en: libras (lb) o kilos (kg). Altura en: pulgadas o centímetros.",
      "Toca Guardar. Tus servicios, la ficha de la mascota y tu página de reservas muestran los tamaños a tu manera.",
      "Por peso: al escribir el peso, el tamaño se elige solo (Pequeño hasta 9 kg / 20 lb, Mediano hasta 22 kg / 50 lb, Grande hasta 40 kg / 90 lb, Extra grande más).",
    ],
  },
  "add-client": {
    title: "Agregar un cliente y sus mascotas",
    summary: "La forma más rápida de agregar un cliente.",
    steps: [
      "Toca Clientes y luego + (Nuevo cliente).",
      "Solo el nombre y el celular son obligatorios. La dirección se completa sola al elegir una sugerencia.",
      "Marca el consentimiento de mensajes si el cliente aceptó recibir mensajes de sus visitas.",
      "Toca Guardar y agrega una mascota. Solo el nombre es obligatorio; raza, tamaño, peso y notas ayudan con el precio.",
      "Dentro de la mascota agregas vacunas (con vencimiento), un precio especial y el corte de cada visita.",
    ],
    tips: ["Los clientes que reservan en tu página se agregan solos, con sus mascotas."],
  },
  import: {
    title: "Traer tus clientes de otra app",
    summary: "Importar una lista de clientes (CSV) sin duplicados.",
    steps: [
      "En tu app anterior u hoja de cálculo, exporta la lista de clientes en CSV.",
      "Abre Ajustes → Importar y exportar clientes, elige el archivo y toca Importar clientes.",
      "Los clientes se reconocen por el teléfono, así que importar el mismo archivo dos veces no duplica.",
      "Las mascotas llegan con raza y frecuencia. Pon el tamaño de cada una cuando la atiendas.",
      "Ahí también puedes descargar tu lista (CSV) cuando quieras, como copia de seguridad.",
    ],
  },
  "book-visit": {
    title: "Reservar una visita desde la app",
    summary: "Reserva a un cliente en pocos toques.",
    steps: [
      "Toca Reservar (arriba en Hoy), o abre el cliente y toca + Nueva cita.",
      "Elige el cliente, marca las mascotas y elige un servicio para cada una. Los adicionales son opcionales.",
      "Elige el día y la hora. El tiempo estimado sale de los servicios; usa − y + para cambiarlo.",
      "Deja marcado Enviar la confirmación y toca Reservar cita.",
      "Para repetirla, abre la visita y toca Repetir esta cita.",
    ],
  },
  "online-booking": {
    title: "Tu página de reservas en línea",
    summary: "Deja que los clientes reserven solos.",
    steps: [
      "Abre Ajustes → Reservas en línea. Tu enlace y el código QR están arriba.",
      "Elige qué pasa cuando alguien reserva: aceptas cada solicitud, los conocidos entran directo, o todos entran directo.",
      "Define la antelación mínima, cuántos días adelante se puede reservar y las horas de inicio.",
      "Las solicitudes aparecen en Hoy y en Solicitudes de reserva. Acéptalas o recházalas ahí.",
      "Quien se detiene a mitad aparece en Reservas abandonadas, para que lo llames o le escribas.",
    ],
  },
  "service-areas": {
    title: "Zona de servicio y zonas por día",
    summary: "Limita a dónde vas y qué días vas a cada zona.",
    steps: [
      "En Ajustes → Reservas en línea pon el código postal de la base y la zona de servicio (distancia).",
      "Para zonas por día, abre Ajustes → Zonas de servicio → Agregar zona.",
      "Ponle nombre y color, lista los códigos postales (o su inicio) y elige los días.",
      "En línea, los clientes solo ven horarios en los días de su zona.",
    ],
  },
  today: {
    title: "Hoy: tu ruta, en camino y cierre",
    summary: "Maneja el día desde una pantalla.",
    steps: [
      "Hoy muestra las paradas en el mapa y en tarjetas. Desliza las tarjetas o cambia a Lista.",
      "Toca 🧭 Encontrar el mejor orden para reordenar las paradas con menos manejo.",
      "En una visita, toca Voy en camino: el cliente recibe tu hora de llegada.",
      "Al llegar, toca Check-in. Al terminar, toca Terminar orden para cobrar.",
      "¿Sin señal? La app muestra la última copia guardada y se actualiza cuando vuelve la señal.",
    ],
  },
  reschedule: {
    title: "Mover, cancelar o marcar no-show",
    summary: "Cambia una visita y avisa al cliente.",
    steps: [
      "Abre la visita (tócala en Hoy o en el Calendario).",
      "Reprogramar: elige el nuevo día y toca una hora libre. Deja marcado Avisar al cliente.",
      "Cancelar: el cliente recibe el mensaje de cancelación. No-show: la visita sale de tu día.",
      "¿Te equivocaste? Ábrela y toca Restaurar.",
    ],
  },
  checkout: {
    title: "Terminar una orden y cobrar",
    summary: "Servicios, descuentos, propina y pago en tres pasos.",
    steps: [
      "Abre la visita y toca Terminar orden.",
      "Paso 1 · Servicios: revisa servicios y precios. Agrega descuento, cargo o impuesto si hace falta.",
      "Paso 2 · Pago: agrega la propina y cómo pagó el cliente.",
      "En efectivo, escribe lo recibido y la app muestra el cambio. Toca Cobrar.",
      "Paso 3 · Recibo: envíalo por email, manda el enlace o comparte el PDF.",
      "¿Pagará después? Toca El cliente pagará después; el saldo queda en la visita.",
    ],
  },
  reports: {
    title: "Informes y nómina",
    summary: "Mira lo que entró y cuánto pagar a cada groomer.",
    steps: [
      "Toca Informes y elige el período o tus fechas.",
      "Ve lo cobrado, lo esperado, perros atendidos, métodos de pago y mejores clientes.",
      "Descárgalo en PDF o Excel (CSV).",
      "Nómina suma comisión, propinas y horas de cada groomer. Define el pago en Ajustes → Equipo.",
    ],
  },
  messages: {
    title: "Mensajes y emails automáticos",
    summary: "Confirmaciones, recordatorios y más, enviados por ti.",
    steps: [
      "Abre Ajustes → Mensajes y email.",
      "Activa o desactiva cada mensaje y edita su texto. Las palabras entre {llaves} se llenan para cada cliente.",
      "Los recordatorios salen unos días antes, a la hora que elijas; puedes agregar un segundo.",
      "Los mensajes salen de tu propio iPhone con una automatización de Atajos, y los emails del email del negocio.",
    ],
  },
  marketing: {
    title: "Campañas de email",
    summary: "Envía un saludo de fiestas o un “te extrañamos”.",
    steps: [
      "Abre Marketing → Nuevo email. Empieza con una plantilla o en blanco.",
      "1 Escribir · 2 Para quién (última visita, próxima visita, raza, ciudad) · 3 Enviar (prueba, ahora o programado).",
      "Pon primero tu dirección postal en la página Marketing.",
    ],
  },
  team: {
    title: "Agregar groomers y elegir qué pueden hacer",
    summary: "Cada groomer tiene color, ruta y, si quieres, su propio acceso.",
    steps: [
      "Abre Ajustes → Equipo → Agregar groomer.",
      "Para que use la app en su celular, ábrelo y toca Dar acceso (email y contraseña).",
      "Elige qué ven y hacen en Equipo → Roles y permisos.",
      "Define comisión, propinas y pago por hora; activa el reloj de entrada y salida.",
    ],
  },
  "country-language": {
    title: "País, moneda, zona horaria e idioma",
    summary: "Adapta la app a donde trabajas.",
    steps: [
      "Ajustes → Negocio: elige País, Moneda y Zona horaria.",
      "Ajustes → Cuenta → Idioma: el idioma de la app para ti.",
      "Los clientes eligen su idioma en tu página de reservas (menú 🌐).",
    ],
  },
  "closed-days": {
    title: "Vacaciones, feriados y horas bloqueadas",
    summary: "Días y horas en que nadie reserva.",
    steps: [
      "Ajustes → Fechas cerradas y feriados: agrega tus vacaciones y marca los feriados que no trabajas.",
      "Para unas horas, abre el Calendario y toca Bloquear tiempo.",
    ],
  },
  notifications: {
    title: "Notificaciones en tu celular",
    summary: "Recibe un aviso cuando un cliente reserva, confirma o cancela.",
    steps: [
      "En iPhone, agrega la app a la pantalla de inicio (Safari → Compartir → Agregar a inicio) y ábrela desde ahí.",
      "Abre Ajustes → Notificaciones y toca Activar notificaciones en este dispositivo.",
      "Toca Enviar una prueba.",
    ],
  },
  troubleshooting: {
    title: "Algo no funciona",
    summary: "Soluciones rápidas.",
    steps: [
      "La página tardó: toca Intentar de nuevo.",
      "No salen los mensajes: revisa Ajustes → Mensajes y email y que la automatización del iPhone corrió.",
      "No salen los emails: Ajustes → Mensajes y email muestra si el email está configurado.",
      "¿Sigues con problemas? Pregunta al asistente o toca Hablar con una persona.",
    ],
  },
};

const BY_LANG: Partial<Record<string, Record<string, Omit<HelpArticle, "slug" | "topic">>>> = { pt, es };

/** The articles in a language (Portuguese and Spanish translated; others in English). */
export function helpArticles(lang: string): HelpArticle[] {
  const tr = BY_LANG[lang];
  return en.map((a) => (tr?.[a.slug] ? { ...a, ...tr[a.slug] } : a));
}

export const helpArticle = (slug: string, lang: string) => helpArticles(lang).find((a) => a.slug === slug) ?? null;

export const topicName = (key: HelpArticle["topic"], lang: string) => {
  const t = TOPICS.find((x) => x.key === key)!;
  return lang === "pt" ? t.pt : lang === "es" ? t.es : t.en;
};

/** All articles as plain text in English, for the assistant's instructions. */
export const helpAsText = () =>
  en.map((a) => `## ${a.title}\n${a.summary}\n${a.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${a.tips ? `\nTip: ${a.tips.join(" ")}` : ""}`).join("\n\n");
