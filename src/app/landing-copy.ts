// The sales page's words, in English, Portuguese and Spanish (other languages read English).
// Every claim here is something the app does today: no invented numbers, reviews or press.

export type LandingCopy = typeof en;

const en = {
  meta: {
    title: "Scheduling app for mobile dog groomers",
    description:
      "Online booking, your day's route, automatic reminders and checkout at the door, in one app built for mobile groomers. 20 languages, every country. Start free.",
  },
  bar: { text: "Now in 20 languages and every country", link: "See what's included" },
  nav: { features: "Features", pricing: "Pricing", faq: "Questions", login: "Log in", start: "Start free" },
  hero: {
    title: "Your mobile grooming day, run from one phone.",
    sub: "Clients book themselves, the route builds itself, reminders go out on their own and you get paid at the door. Built for groomers who work from a van.",
    cta: "Start your free trial",
    secondary: "See how it works",
    badgeA: "Made for mobile groomers",
    badgeB: "20 languages · every country",
    note: "14 days free. No card needed.",
    shotAlt: "The app's day list: four stops with clients, pets, services, addresses and drive times",
  },
  cards: [
    { title: "Emma confirmed", meta: "Luna · Sat 8:00 AM · Full haircut" },
    { title: "New online booking", meta: "Max · Bath, Large · added to Saturday" },
    { title: "“On my way” sent", meta: "Daniel was told you arrive around 10:42" },
    { title: "Best order found", meta: "Stops reordered for the least driving" },
    { title: "Rabies expires in 14 days", meta: "Reminder sent to Olivia" },
  ],
  dark: {
    title: "Everything between the van and the client's door.",
    sub: "The parts of the job that eat your evenings, done while you groom.",
  },
  rows: [
    {
      kicker: "Online booking",
      title: "Clients book themselves.",
      text: "Your own booking page asks one thing at a time: phone, pets, service, a time that fits your route. Put the link on Instagram, WhatsApp and Google. You accept each request, or let people you know book straight in.",
      alt: "The client's booking page on a phone, starting with their phone number",
      shot: "/landing/book.png",
    },
    {
      kicker: "The visit",
      title: "One tap: on my way, check in, finish.",
      text: "Message, call or navigate from the visit. “On my way” texts the client your arrival time. Every cut is saved with the blade, length and a photo, so next time looks the same.",
      alt: "A visit in the app with Message, Call, Take payment, Directions and On my way",
      shot: "/landing/visit.png",
    },
    {
      kicker: "Checkout",
      title: "Get paid at the door.",
      text: "Services, discounts, tips and payment in three steps: cash, card, Zelle, Venmo or anything you take. The receipt goes by email, text or WhatsApp, and every payment lands in your reports.",
      alt: "Checkout in the app with services, tip and total",
      shot: "/landing/pay.png",
    },
  ],
  tiles: [
    { title: "20 languages", text: "For you, your team and each client" },
    { title: "Every country", text: "Your currency, phone format and holidays" },
    { title: "Works in dead zones", text: "Your day stays on the phone without signal" },
    { title: "Texts from your number", text: "Reminders sent from your own iPhone" },
    { title: "Routes by Google Maps", text: "Drive times and the best order of stops" },
    { title: "Reports and payroll", text: "Commission, tips and hours, ready to pay" },
    { title: "Team and roles", text: "Each groomer with a color, route and login" },
    { title: "Help built in", text: "Step-by-step guides and an assistant" },
  ],
  pricing: {
    title: "Simple pricing.",
    sub: "Try everything free for 14 days. Then pay monthly, or yearly and save.",
    monthly: "Monthly",
    yearly: "Yearly",
    perMonth: "/month",
    perYear: "/year",
    soon: "Plans are being finalized. Start free today: you won't be charged during the trial.",
    included: ["Unlimited clients, pets and visits", "Online booking page and QR code", "Automatic texts and email", "Routes, checkout and receipts", "Help center and assistant"],
  },
  faq: {
    title: "Questions groomers ask.",
    items: [
      { q: "Do my clients need to download an app?", a: "No. They book on your page in their phone's browser, in their own language, and get texts and emails with a link to confirm or cancel." },
      { q: "Can I bring my clients from another app?", a: "Yes. Export your client list as a CSV file and import it in Settings. Clients are matched by phone number, so nothing is duplicated." },
      { q: "Does it work outside the US?", a: "Yes. Pick your country and the app follows it: currency, phone numbers, postal codes, kilometers or miles, kilos or pounds, and local holidays." },
      { q: "What if I have no signal in the van?", a: "The app keeps your day on the phone and shows the last saved copy. It updates as soon as the signal is back." },
      { q: "How do texts go out?", a: "From your own iPhone number, through a one-time Shortcuts setup, so clients reply to you directly. Emails go from your business email." },
      { q: "Can my team use it?", a: "Yes. Each groomer gets a color, their own route and, if you want, their own login, with you deciding what they can see and do." },
    ],
  },
  closer: {
    title: "Spend your evenings off the phone.",
    sub: "Set up in five minutes: your prices, your hours, your booking link.",
    cta: "Start your free trial",
    login: "I have an account",
  },
  footer: { terms: "Terms", privacy: "Privacy", help: "Help", login: "Log in", rights: "All rights reserved." },
};

const pt: LandingCopy = {
  meta: {
    title: "App de agenda para banho e tosa móvel",
    description:
      "Agendamento online, rota do dia, lembretes automáticos e recebimento na porta, num app feito para quem faz banho e tosa móvel. 20 idiomas, qualquer país. Comece grátis.",
  },
  bar: { text: "Agora em 20 idiomas e em qualquer país", link: "Veja o que vem incluído" },
  nav: { features: "Recursos", pricing: "Preços", faq: "Dúvidas", login: "Entrar", start: "Começar grátis" },
  hero: {
    title: "Seu dia de banho e tosa móvel, num celular só.",
    sub: "Os clientes agendam sozinhos, a rota se monta, os lembretes saem por conta própria e você recebe na porta. Feito para quem trabalha numa van.",
    cta: "Começar teste grátis",
    secondary: "Ver como funciona",
    badgeA: "Feito para banho e tosa móvel",
    badgeB: "20 idiomas · qualquer país",
    note: "14 dias grátis. Sem cartão.",
    shotAlt: "A lista do dia no app: quatro paradas com clientes, pets, serviços, endereços e tempo de estrada",
  },
  cards: [
    { title: "Mariana confirmou", meta: "Pipoca · Sáb 8:00 · Tosa completa" },
    { title: "Novo agendamento online", meta: "Thor · Banho, Grande · no sábado" },
    { title: "“A caminho” enviado", meta: "Rafael sabe que você chega por volta de 10:42" },
    { title: "Melhor ordem encontrada", meta: "Paradas reorganizadas com menos estrada" },
    { title: "Antirrábica vence em 14 dias", meta: "Lembrete enviado para Pedro" },
  ],
  dark: {
    title: "Tudo entre a van e a porta do cliente.",
    sub: "As partes do trabalho que comem suas noites, feitas enquanto você atende.",
  },
  rows: [
    {
      kicker: "Agendamento online",
      title: "Os clientes agendam sozinhos.",
      text: "Sua própria página pergunta uma coisa de cada vez: telefone, pets, serviço e um horário que cabe na sua rota. Coloque o link no Instagram, WhatsApp e Google. Você aceita cada pedido, ou deixa quem já conhece agendar direto.",
      alt: "A página de agendamento do cliente no celular, começando pelo telefone",
      shot: "/landing/book.png",
    },
    {
      kicker: "A visita",
      title: "Um toque: a caminho, check-in, finalizar.",
      text: "Mensagem, ligação ou rota direto da visita. “Estou a caminho” manda ao cliente seu horário de chegada. Cada tosa fica salva com lâmina, comprimento e foto, para a próxima sair igual.",
      alt: "Uma visita no app com Mensagem, Ligar, Receber, Rota e A caminho",
      shot: "/landing/visit.png",
    },
    {
      kicker: "Fechamento",
      title: "Receba na porta.",
      text: "Serviços, descontos, gorjeta e pagamento em três passos: dinheiro, cartão, Pix ou o que você aceitar. O recibo vai por e-mail, mensagem ou WhatsApp, e cada pagamento entra nos relatórios.",
      alt: "Fechamento no app com serviços, gorjeta e total",
      shot: "/landing/pay.png",
    },
  ],
  tiles: [
    { title: "20 idiomas", text: "Para você, sua equipe e cada cliente" },
    { title: "Qualquer país", text: "Sua moeda, formato de telefone e feriados" },
    { title: "Funciona sem sinal", text: "Seu dia fica no celular mesmo sem internet" },
    { title: "Mensagens do seu número", text: "Lembretes saem do seu próprio iPhone" },
    { title: "Rotas pelo Google Maps", text: "Tempo de estrada e a melhor ordem" },
    { title: "Relatórios e comissões", text: "Comissão, gorjetas e horas, prontos" },
    { title: "Equipe e permissões", text: "Cada groomer com cor, rota e login" },
    { title: "Ajuda dentro do app", text: "Guias passo a passo e um assistente" },
  ],
  pricing: {
    title: "Preço simples.",
    sub: "Teste tudo grátis por 14 dias. Depois pague por mês, ou por ano e economize.",
    monthly: "Mensal",
    yearly: "Anual",
    perMonth: "/mês",
    perYear: "/ano",
    soon: "Os planos estão sendo finalizados. Comece grátis hoje: nada é cobrado durante o teste.",
    included: ["Clientes, pets e visitas sem limite", "Página de agendamento e QR code", "Mensagens e e-mails automáticos", "Rotas, fechamento e recibos", "Central de ajuda e assistente"],
  },
  faq: {
    title: "Dúvidas de quem faz banho e tosa.",
    items: [
      { q: "Meus clientes precisam baixar um app?", a: "Não. Eles agendam na sua página pelo navegador do celular, no idioma deles, e recebem mensagens e e-mails com um link para confirmar ou cancelar." },
      { q: "Consigo trazer meus clientes de outro app?", a: "Sim. Exporte a lista de clientes em CSV e importe em Ajustes. Os clientes são reconhecidos pelo telefone, então nada se duplica." },
      { q: "Funciona fora dos Estados Unidos?", a: "Sim. Escolha seu país e o app segue ele: moeda, telefones, CEP, quilômetros ou milhas, quilos ou libras e feriados locais." },
      { q: "E se ficar sem sinal na van?", a: "O app guarda seu dia no celular e mostra a última cópia salva. Atualiza assim que o sinal volta." },
      { q: "Como saem as mensagens?", a: "Do seu próprio número de iPhone, com uma configuração única no app Atalhos, então o cliente responde direto para você. Os e-mails saem do e-mail do negócio." },
      { q: "Minha equipe pode usar?", a: "Sim. Cada groomer tem uma cor, a própria rota e, se você quiser, o próprio login, e você decide o que cada um vê e faz." },
    ],
  },
  closer: {
    title: "Passe suas noites longe do celular.",
    sub: "Configure em cinco minutos: seus preços, seu horário, seu link de agendamento.",
    cta: "Começar teste grátis",
    login: "Já tenho conta",
  },
  footer: { terms: "Termos", privacy: "Privacidade", help: "Ajuda", login: "Entrar", rights: "Todos os direitos reservados." },
};

const es: LandingCopy = {
  meta: {
    title: "App de agenda para peluquería canina móvil",
    description:
      "Reservas en línea, la ruta del día, recordatorios automáticos y cobro en la puerta, en una app hecha para peluqueros caninos móviles. 20 idiomas, cualquier país. Empieza gratis.",
  },
  bar: { text: "Ahora en 20 idiomas y en cualquier país", link: "Mira lo que incluye" },
  nav: { features: "Funciones", pricing: "Precios", faq: "Preguntas", login: "Entrar", start: "Empezar gratis" },
  hero: {
    title: "Tu día de peluquería móvil, desde un solo teléfono.",
    sub: "Los clientes reservan solos, la ruta se arma sola, los recordatorios salen solos y cobras en la puerta. Hecha para quien trabaja desde una van.",
    cta: "Empezar prueba gratis",
    secondary: "Ver cómo funciona",
    badgeA: "Hecha para peluquería móvil",
    badgeB: "20 idiomas · cualquier país",
    note: "14 días gratis. Sin tarjeta.",
    shotAlt: "La lista del día en la app: cuatro paradas con clientes, mascotas, servicios, direcciones y tiempos de manejo",
  },
  cards: [
    { title: "Valeria confirmó", meta: "Canela · Sáb 8:00 · Corte completo" },
    { title: "Nueva reserva en línea", meta: "Rocky · Baño, Grande · el sábado" },
    { title: "“Voy en camino” enviado", meta: "Diego sabe que llegas hacia las 10:42" },
    { title: "Mejor orden encontrado", meta: "Paradas reordenadas con menos manejo" },
    { title: "La antirrábica vence en 14 días", meta: "Recordatorio enviado a Andrés" },
  ],
  dark: {
    title: "Todo entre la van y la puerta del cliente.",
    sub: "Lo que se come tus noches, hecho mientras trabajas.",
  },
  rows: [
    {
      kicker: "Reservas en línea",
      title: "Los clientes reservan solos.",
      text: "Tu propia página pregunta una cosa a la vez: teléfono, mascotas, servicio y una hora que encaja en tu ruta. Pon el enlace en Instagram, WhatsApp y Google. Aceptas cada solicitud, o dejas que tus conocidos reserven directo.",
      alt: "La página de reservas del cliente en el teléfono, empezando por su número",
      shot: "/landing/book.png",
    },
    {
      kicker: "La visita",
      title: "Un toque: en camino, llegada, terminar.",
      text: "Mensaje, llamada o ruta desde la visita. “Voy en camino” le manda al cliente tu hora de llegada. Cada corte queda guardado con cuchilla, largo y foto.",
      alt: "Una visita en la app con Mensaje, Llamar, Cobrar, Ruta y En camino",
      shot: "/landing/visit.png",
    },
    {
      kicker: "Cobro",
      title: "Cobra en la puerta.",
      text: "Servicios, descuentos, propina y pago en tres pasos: efectivo, tarjeta o lo que aceptes. El recibo va por email, mensaje o WhatsApp, y cada pago entra en tus informes.",
      alt: "El cobro en la app con servicios, propina y total",
      shot: "/landing/pay.png",
    },
  ],
  tiles: [
    { title: "20 idiomas", text: "Para ti, tu equipo y cada cliente" },
    { title: "Cualquier país", text: "Tu moneda, formato de teléfono y feriados" },
    { title: "Funciona sin señal", text: "Tu día queda en el teléfono sin internet" },
    { title: "Mensajes desde tu número", text: "Recordatorios desde tu propio iPhone" },
    { title: "Rutas con Google Maps", text: "Tiempos de manejo y el mejor orden" },
    { title: "Informes y nómina", text: "Comisión, propinas y horas, listos" },
    { title: "Equipo y permisos", text: "Cada groomer con color, ruta y acceso" },
    { title: "Ayuda incluida", text: "Guías paso a paso y un asistente" },
  ],
  pricing: {
    title: "Precio simple.",
    sub: "Prueba todo gratis 14 días. Después paga por mes, o por año y ahorra.",
    monthly: "Mensual",
    yearly: "Anual",
    perMonth: "/mes",
    perYear: "/año",
    soon: "Los planes se están finalizando. Empieza gratis hoy: no se cobra nada durante la prueba.",
    included: ["Clientes, mascotas y visitas sin límite", "Página de reservas y código QR", "Mensajes y emails automáticos", "Rutas, cobro y recibos", "Centro de ayuda y asistente"],
  },
  faq: {
    title: "Preguntas de peluqueros.",
    items: [
      { q: "¿Mis clientes tienen que descargar una app?", a: "No. Reservan en tu página desde el navegador del teléfono, en su idioma, y reciben mensajes y emails con un enlace para confirmar o cancelar." },
      { q: "¿Puedo traer mis clientes de otra app?", a: "Sí. Exporta tu lista en CSV e impórtala en Ajustes. Los clientes se reconocen por el teléfono, así que nada se duplica." },
      { q: "¿Funciona fuera de Estados Unidos?", a: "Sí. Elige tu país y la app lo sigue: moneda, teléfonos, códigos postales, kilómetros o millas, kilos o libras y feriados." },
      { q: "¿Y si no hay señal en la van?", a: "La app guarda tu día en el teléfono y muestra la última copia guardada. Se actualiza cuando vuelve la señal." },
      { q: "¿Cómo salen los mensajes?", a: "Desde tu propio número de iPhone, con una configuración única en Atajos, así el cliente te responde directo. Los emails salen del email del negocio." },
      { q: "¿Mi equipo puede usarla?", a: "Sí. Cada groomer tiene un color, su propia ruta y, si quieres, su propio acceso, y tú decides qué ve y hace cada uno." },
    ],
  },
  closer: {
    title: "Pasa tus noches lejos del teléfono.",
    sub: "Configura en cinco minutos: tus precios, tu horario, tu enlace de reservas.",
    cta: "Empezar prueba gratis",
    login: "Ya tengo cuenta",
  },
  footer: { terms: "Términos", privacy: "Privacidad", help: "Ayuda", login: "Entrar", rights: "Todos los derechos reservados." },
};

export const LANDING_LANGS = ["en", "pt", "es"] as const;
export const landingCopy = (lang: string): { lang: (typeof LANDING_LANGS)[number]; c: LandingCopy } =>
  lang === "pt" ? { lang: "pt", c: pt } : lang === "es" ? { lang: "es", c: es } : { lang: "en", c: en };

/** Plan prices, in US dollars (null until they are set): the pricing section shows them when set. */
export const PLAN_PRICES: { monthly: number | null; yearly: number | null } = { monthly: 29, yearly: 290 };
