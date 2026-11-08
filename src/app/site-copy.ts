// The words of the public site's pages (besides the home page, in landing-copy.ts), in English,
// Portuguese and Spanish. Every claim is something the app does today, checked against the code:
// no invented numbers, reviews or comparisons with other apps.

import { PLAN_PRICES } from "./landing-copy";

export const SITE_LANGS = ["en", "pt", "es"] as const;
export type SiteLang = (typeof SITE_LANGS)[number];
export const siteLang = (lang: string): SiteLang => (lang === "pt" || lang === "es" ? lang : "en");

type Item = { t: string; d: string };
type QA = { q: string; a: string };
type Meta = { title: string; description: string };

const M = PLAN_PRICES.monthly ?? 29;
const Y = PLAN_PRICES.yearly ?? 290;

// ——— The nav, footer and closing call, the same on every page ———

const chromeEn = {
  nav: { features: "Features", pricing: "Pricing", login: "Log in", start: "Start free", menu: "Menu" },
  footer: {
    product: "Product", company: "Company",
    features: "Features", pricing: "Pricing", mobile: "Mobile grooming software", route: "Route planner", switch: "Switch to Fino", guides: "Guides",
    terms: "Terms", privacy: "Privacy", login: "Log in", rights: "All rights reserved.",
  },
  closer: { title: "Try it on your next working day.", sub: "14 days free, no card. Your prices, your hours and your booking link in five minutes.", cta: "Start your free trial" },
  home: "Home", related: "More about Fino",
  notFound: { title: "Page not found.", text: "The link may be old or typed wrong. These are a good place to start:" },
};
const chromePt: typeof chromeEn = {
  nav: { features: "Recursos", pricing: "Preços", login: "Entrar", start: "Começar grátis", menu: "Menu" },
  footer: {
    product: "Produto", company: "Empresa",
    features: "Recursos", pricing: "Preços", mobile: "App para banho e tosa móvel", route: "Planejador de rotas", switch: "Mudar para o Fino", guides: "Guias",
    terms: "Termos", privacy: "Privacidade", login: "Entrar", rights: "Todos os direitos reservados.",
  },
  closer: { title: "Teste no seu próximo dia de trabalho.", sub: "14 dias grátis, sem cartão. Seus preços, seus horários e seu link de agendamento em cinco minutos.", cta: "Começar teste grátis" },
  home: "Início", related: "Mais sobre o Fino",
  notFound: { title: "Página não encontrada.", text: "O link pode estar antigo ou com erro de digitação. Bons lugares para começar:" },
};
const chromeEs: typeof chromeEn = {
  nav: { features: "Funciones", pricing: "Precios", login: "Entrar", start: "Empezar gratis", menu: "Menú" },
  footer: {
    product: "Producto", company: "Empresa",
    features: "Funciones", pricing: "Precios", mobile: "App para grooming móvil", route: "Planificador de rutas", switch: "Cambiar a Fino", guides: "Guías",
    terms: "Términos", privacy: "Privacidad", login: "Entrar", rights: "Todos los derechos reservados.",
  },
  closer: { title: "Pruébala en tu próximo día de trabajo.", sub: "14 días gratis, sin tarjeta. Tus precios, tu horario y tu enlace de reservas en cinco minutos.", cta: "Empezar prueba gratis" },
  home: "Inicio", related: "Más sobre Fino",
  notFound: { title: "Página no encontrada.", text: "El enlace puede ser antiguo o tener un error. Buenos lugares para empezar:" },
};
export type SiteChrome = typeof chromeEn;
export const siteChrome = (l: SiteLang) => ({ en: chromeEn, pt: chromePt, es: chromeEs })[l];

// ——— /features ———

type FeaturesCopy = { meta: Meta; kicker: string; title: string; sub: string; groups: { title: string; shot?: string; alt?: string; items: Item[] }[] };

const featuresEn: FeaturesCopy = {
  meta: {
    title: "Features: booking, routes, reminders and checkout for mobile groomers",
    description: "Everything in Fino: online booking, route planning with drive times, automatic reminders, grooming history, checkout and receipts, team and payroll, in 20 languages.",
  },
  kicker: "Features",
  title: "Everything a mobile grooming day needs.",
  sub: "One app for the booking, the route, the visit and the money. Every feature is in every plan.",
  groups: [
    {
      title: "Online booking", shot: "/landing/book.png", alt: "The booking page on a phone",
      items: [
        { t: "Your own booking page", d: "A link and a QR code for Instagram, WhatsApp, Google and your van. It can also sit inside your own website." },
        { t: "One question at a time", d: "Phone, pets, services, a time. Returning clients are recognized by their number, with their pets and address already filled in." },
        { t: "Times that fit your route", d: "Only times that work with your hours, your service areas and the drive between stops are offered." },
        { t: "You decide who books straight in", d: "Accept every request yourself, or let returning clients (or everyone) book directly." },
        { t: "Forms and agreements", d: "A new-client form and a service agreement signed online, with a fresh signature when you change it." },
        { t: "Nobody slips away", d: "Unfinished bookings are listed so you can call back, and a waitlist tells people when a spot opens." },
      ],
    },
    {
      title: "Your day and your route", shot: "/landing/today.png", alt: "The day's stops with drive times",
      items: [
        { t: "Drive times between stops", d: "Today shows your stops in order with the driving time between them (with Google Maps)." },
        { t: "Best order in one tap", d: "Reorder the day's stops for the least driving, from where you start to where you end." },
        { t: "Service areas by day", d: "List the ZIP or postal codes you cover and the days for each, and see them on the map; the booking page follows them." },
        { t: "“On my way” with the arrival time", d: "One tap tells the client when you'll get there." },
        { t: "Works without signal", d: "Your day stays on the phone in dead zones and updates when the signal is back." },
      ],
    },
    {
      title: "The visit", shot: "/landing/visit.png", alt: "A visit with its main actions",
      items: [
        { t: "Grooming history", d: "Blade, length, notes and a photo of every cut, so the next one looks the same." },
        { t: "Pets, the way you work", d: "Sizes by height or weight, in pounds or kilos, breeds, coat, behavior notes and a price for each pet when it differs." },
        { t: "Vaccines", d: "Expiry dates on file, with a reminder to the client before they run out." },
        { t: "Repeat visits", d: "Every few days, weeks or months, or on the dates you pick." },
      ],
    },
    {
      title: "Getting paid", shot: "/landing/pay.png", alt: "Checkout with services, tip and total",
      items: [
        { t: "Checkout at the door", d: "Services, extras, discounts, tax and tips, then record how they paid: cash, card, Zelle, Venmo, check or other." },
        { t: "Receipts", d: "By email, text or WhatsApp, with a PDF. Make one by hand for anything else you sell." },
        { t: "Reports", d: "Sales, payments by method, tips and payroll by day, week or month, ready to export." },
      ],
    },
    {
      title: "Messages that send themselves",
      items: [
        { t: "Reminders and confirmations", d: "Before every visit, with a link to confirm or cancel. Choose which messages go out and how far ahead." },
        { t: "Texts from your own number", d: "Texts go from your iPhone after a one-time Shortcuts setup, so clients reply to you. Emails go from your business." },
        { t: "Email marketing", d: "Ready-made campaigns for the seasons and holidays, sent to the clients you pick, with an unsubscribe link." },
        { t: "Alerts for you", d: "New requests, cancellations and reschedule requests reach your phone." },
      ],
    },
    {
      title: "Team and business",
      items: [
        { t: "Groomers and roles", d: "Each groomer with a color, a route and their own login; you choose what each one sees and does." },
        { t: "Clock in and payroll", d: "Hours, commission and tips added up and ready to pay." },
        { t: "Your data is yours", d: "Import clients from a spreadsheet, export your clients, pets, visits and payments anytime (photos aside), weekly backup to Google Drive, and your visits in Google or iPhone Calendar." },
        { t: "Every country, 20 languages", d: "Your currency, phone format, postal codes, holidays, miles or kilometers; each person sees the app in their own language." },
        { t: "Help when you need it", d: "Step-by-step guides inside the app and an assistant that answers questions." },
      ],
    },
  ],
};
const featuresPt: FeaturesCopy = {
  meta: {
    title: "Recursos: agendamento, rotas, lembretes e recebimento para banho e tosa móvel",
    description: "Tudo o que o Fino faz: agendamento online, rota com tempo de estrada, lembretes automáticos, histórico de tosa, recebimento e recibos, equipe e folha, em 20 idiomas.",
  },
  kicker: "Recursos",
  title: "Tudo o que um dia de banho e tosa móvel precisa.",
  sub: "Um app para o agendamento, a rota, a visita e o dinheiro. Todos os recursos estão em todos os planos.",
  groups: [
    {
      title: "Agendamento online", shot: "/landing/book.png", alt: "A página de agendamento no celular",
      items: [
        { t: "Sua própria página de agendamento", d: "Um link e um QR code para Instagram, WhatsApp, Google e a sua van. Também pode ficar dentro do seu site." },
        { t: "Uma pergunta de cada vez", d: "Telefone, pets, serviços, horário. Quem já é cliente é reconhecido pelo número, com pets e endereço já preenchidos." },
        { t: "Horários que cabem na rota", d: "Só aparecem horários que combinam com seu expediente, suas áreas de atendimento e o trajeto entre as paradas." },
        { t: "Você decide quem agenda direto", d: "Aceite cada pedido, ou deixe clientes antigos (ou todos) agendarem direto." },
        { t: "Fichas e contrato", d: "Ficha de cliente novo e contrato de serviço assinado online, com nova assinatura quando você mudar o texto." },
        { t: "Ninguém se perde", d: "Agendamentos não terminados ficam listados para você retomar, e a lista de espera avisa quando abre uma vaga." },
      ],
    },
    {
      title: "Seu dia e sua rota", shot: "/landing/today.png", alt: "As paradas do dia com o tempo de estrada",
      items: [
        { t: "Tempo de estrada entre as paradas", d: "O Hoje mostra as paradas em ordem, com o tempo de carro entre elas (com o Google Maps)." },
        { t: "Melhor ordem num toque", d: "Reorganize as paradas do dia para rodar menos, do ponto de partida ao ponto final." },
        { t: "Áreas de atendimento por dia", d: "Liste os CEPs que você atende e os dias de cada área, e veja tudo no mapa; a página de agendamento segue isso." },
        { t: "“A caminho” com horário de chegada", d: "Um toque avisa o cliente quando você chega." },
        { t: "Funciona sem sinal", d: "Seu dia fica no celular nas áreas sem sinal e atualiza quando a conexão volta." },
      ],
    },
    {
      title: "A visita", shot: "/landing/visit.png", alt: "Uma visita com as ações principais",
      items: [
        { t: "Histórico de tosa", d: "Lâmina, comprimento, observações e foto de cada tosa, para a próxima sair igual." },
        { t: "Pets do seu jeito", d: "Porte por altura ou peso, em libras ou quilos, raças, pelagem, comportamento e preço próprio por pet quando for diferente." },
        { t: "Vacinas", d: "Datas de vencimento guardadas, com lembrete ao cliente antes de vencer." },
        { t: "Visitas que se repetem", d: "A cada tantos dias, semanas ou meses, ou nas datas que você escolher." },
      ],
    },
    {
      title: "Recebimento", shot: "/landing/pay.png", alt: "Recebimento com serviços, gorjeta e total",
      items: [
        { t: "Recebimento na porta", d: "Serviços, extras, descontos, impostos e gorjeta, e depois como pagaram: dinheiro, cartão, Zelle, Venmo, cheque ou outro." },
        { t: "Recibos", d: "Por e-mail, SMS ou WhatsApp, com PDF. Faça um à mão para qualquer outra venda." },
        { t: "Relatórios", d: "Vendas, pagamentos por forma, gorjetas e folha por dia, semana ou mês, prontos para exportar." },
      ],
    },
    {
      title: "Mensagens que se enviam sozinhas",
      items: [
        { t: "Lembretes e confirmações", d: "Antes de cada visita, com link para confirmar ou cancelar. Escolha quais mensagens saem e com quanta antecedência." },
        { t: "SMS do seu próprio número", d: "Os SMS saem do seu iPhone depois de uma configuração única nos Atalhos, e o cliente responde para você. Os e-mails saem do seu negócio." },
        { t: "E-mail marketing", d: "Campanhas prontas para as estações e datas comemorativas, para os clientes que você escolher, com link de descadastro." },
        { t: "Avisos para você", d: "Novos pedidos, cancelamentos e pedidos de remarcação chegam no seu celular." },
      ],
    },
    {
      title: "Equipe e negócio",
      items: [
        { t: "Groomers e permissões", d: "Cada groomer com cor, rota e login próprio; você escolhe o que cada um vê e faz." },
        { t: "Ponto e folha", d: "Horas, comissão e gorjetas somadas e prontas para pagar." },
        { t: "Seus dados são seus", d: "Importe clientes de uma planilha, exporte clientes, pets, visitas e pagamentos quando quiser (fotos à parte), backup semanal no Google Drive e suas visitas no Google Agenda ou no calendário do iPhone." },
        { t: "Qualquer país, 20 idiomas", d: "Sua moeda, formato de telefone, CEP, feriados, milhas ou quilômetros; cada pessoa vê o app no próprio idioma." },
        { t: "Ajuda quando precisar", d: "Guias passo a passo dentro do app e um assistente que responde dúvidas." },
      ],
    },
  ],
};
const featuresEs: FeaturesCopy = {
  meta: {
    title: "Funciones: reservas, rutas, recordatorios y cobro para grooming móvil",
    description: "Todo lo que hace Fino: reservas online, rutas con tiempos de manejo, recordatorios automáticos, historial de corte, cobro y recibos, equipo y nómina, en 20 idiomas.",
  },
  kicker: "Funciones",
  title: "Todo lo que necesita un día de grooming móvil.",
  sub: "Una app para la reserva, la ruta, la visita y el dinero. Todas las funciones están en todos los planes.",
  groups: [
    {
      title: "Reservas online", shot: "/landing/book.png", alt: "La página de reservas en un teléfono",
      items: [
        { t: "Tu propia página de reservas", d: "Un enlace y un código QR para Instagram, WhatsApp, Google y tu van. También puede ir dentro de tu sitio web." },
        { t: "Una pregunta a la vez", d: "Teléfono, mascotas, servicios, horario. Los clientes que vuelven se reconocen por su número, con mascotas y dirección ya completadas." },
        { t: "Horarios que caben en tu ruta", d: "Solo se ofrecen horarios que encajan con tu horario, tus zonas de servicio y el trayecto entre paradas." },
        { t: "Tú decides quién reserva directo", d: "Acepta cada solicitud, o deja que los clientes de siempre (o todos) reserven directo." },
        { t: "Formularios y contrato", d: "Formulario de cliente nuevo y contrato de servicio firmado online, con nueva firma cuando cambies el texto." },
        { t: "Nadie se pierde", d: "Las reservas sin terminar quedan en una lista para que vuelvas a llamar, y la lista de espera avisa cuando se libera un lugar." },
      ],
    },
    {
      title: "Tu día y tu ruta", shot: "/landing/today.png", alt: "Las paradas del día con tiempos de manejo",
      items: [
        { t: "Tiempo de manejo entre paradas", d: "Hoy muestra tus paradas en orden con el tiempo en auto entre ellas (con Google Maps)." },
        { t: "El mejor orden en un toque", d: "Reordena las paradas del día para manejar menos, desde donde empiezas hasta donde terminas." },
        { t: "Zonas de servicio por día", d: "Indica los códigos postales que cubres y los días de cada zona, y míralos en el mapa; la página de reservas los sigue." },
        { t: "“En camino” con hora de llegada", d: "Un toque le dice al cliente cuándo llegas." },
        { t: "Funciona sin señal", d: "Tu día queda en el teléfono en zonas sin señal y se actualiza cuando vuelve la conexión." },
      ],
    },
    {
      title: "La visita", shot: "/landing/visit.png", alt: "Una visita con sus acciones principales",
      items: [
        { t: "Historial de corte", d: "Cuchilla, largo, notas y una foto de cada corte, para que el próximo quede igual." },
        { t: "Mascotas a tu manera", d: "Tamaños por altura o peso, en libras o kilos, razas, pelaje, comportamiento y un precio propio por mascota cuando cambia." },
        { t: "Vacunas", d: "Fechas de vencimiento guardadas, con un recordatorio al cliente antes de que venzan." },
        { t: "Visitas que se repiten", d: "Cada tantos días, semanas o meses, o en las fechas que elijas." },
      ],
    },
    {
      title: "Cobrar", shot: "/landing/pay.png", alt: "El cobro con servicios, propina y total",
      items: [
        { t: "Cobro en la puerta", d: "Servicios, extras, descuentos, impuestos y propinas, y luego cómo pagaron: efectivo, tarjeta, Zelle, Venmo, cheque u otro." },
        { t: "Recibos", d: "Por correo, SMS o WhatsApp, con PDF. Haz uno a mano para cualquier otra venta." },
        { t: "Reportes", d: "Ventas, pagos por método, propinas y nómina por día, semana o mes, listos para exportar." },
      ],
    },
    {
      title: "Mensajes que se envían solos",
      items: [
        { t: "Recordatorios y confirmaciones", d: "Antes de cada visita, con un enlace para confirmar o cancelar. Elige qué mensajes salen y con cuánta anticipación." },
        { t: "SMS desde tu propio número", d: "Los SMS salen de tu iPhone tras configurar Atajos una sola vez, así el cliente te responde a ti. Los correos salen de tu negocio." },
        { t: "Email marketing", d: "Campañas listas para temporadas y fiestas, a los clientes que elijas, con enlace para darse de baja." },
        { t: "Avisos para ti", d: "Nuevas solicitudes, cancelaciones y pedidos de cambio llegan a tu teléfono." },
      ],
    },
    {
      title: "Equipo y negocio",
      items: [
        { t: "Groomers y permisos", d: "Cada groomer con un color, una ruta y su propio acceso; tú eliges qué ve y hace cada uno." },
        { t: "Fichaje y nómina", d: "Horas, comisión y propinas sumadas y listas para pagar." },
        { t: "Tus datos son tuyos", d: "Importa clientes desde una hoja de cálculo, exporta clientes, mascotas, visitas y pagos cuando quieras (fotos aparte), copia semanal en Google Drive y tus visitas en Google Calendar o el calendario del iPhone." },
        { t: "Cualquier país, 20 idiomas", d: "Tu moneda, formato de teléfono, códigos postales, feriados, millas o kilómetros; cada persona ve la app en su idioma." },
        { t: "Ayuda cuando la necesites", d: "Guías paso a paso dentro de la app y un asistente que responde preguntas." },
      ],
    },
  ],
};
export const featuresCopy = (l: SiteLang) => ({ en: featuresEn, pt: featuresPt, es: featuresEs })[l];

// ——— /pricing ———

type PricingCopy = {
  meta: Meta; title: string; sub: string;
  monthly: string; yearly: string; perMonth: string; perYear: string; save: string; cta: string; trial: string;
  includedTitle: string; included: string[];
  referral: { title: string; text: string };
  faqTitle: string; faq: QA[];
};
const pricingEn: PricingCopy = {
  meta: {
    title: `Pricing: US$${M} a month, every feature, the whole team`,
    description: `Fino costs US$${M} a month or US$${Y} a year for the whole business: every feature, unlimited clients and visits, every groomer. 14 days free, no card.`,
  },
  title: "One price for the whole business.",
  sub: "Every feature, every groomer, unlimited clients and visits. No setup fee.",
  monthly: "Monthly", yearly: "Yearly", perMonth: "/month", perYear: "/year", save: "2 months free",
  cta: "Start your free trial", trial: "14 days free. No card needed.",
  includedTitle: "Included in every plan",
  included: [
    "Unlimited clients, pets and visits", "Every groomer on your team, each with their own login", "Online booking page, QR code and forms",
    "Routes with drive times and the best order", "Automatic reminders by text and email", "Checkout, receipts and reports",
    "Email marketing campaigns", "Import and export of your data", "20 languages and every country", "Help center and assistant",
  ],
  referral: { title: "Invited by another groomer?", text: `Sign up with their link and get US$${M} off your first bill: your first month free. Every groomer gets their own link: when someone you invite makes their first payment, you get US$${M} of credit on your bills.` },
  faqTitle: "Questions about the plan",
  faq: [
    { q: "Do I need a card for the free trial?", a: "No. Use everything for 14 days. If you choose a plan with more than 48 hours of the trial left, the first charge is on the day the trial ends; with 48 hours or less left, it's on the day you choose the plan." },
    { q: "What happens when the trial ends?", a: "If you haven't chosen a plan, the app opens only the plan page and your booking page pauses. Your clients, pets and visits stay saved, and everything comes back as soon as you choose a plan." },
    { q: "Is the price per groomer or per van?", a: "Neither. One plan covers the whole business, whatever the size of the team." },
    { q: "How do I pay and cancel?", a: "By card, through Stripe. Change the card, see invoices or cancel anytime in the billing portal, without talking to anyone. You keep using the app until the end of the period you paid for." },
    { q: "Can I get a refund?", a: "Monthly plans aren't refunded: when you cancel, the plan runs to the end of the month. On the yearly plan, ask within 14 days of the charge by emailing support and we refund the unused part of the year, prorated." },
    { q: "Which currency am I charged in?", a: "US dollars. Your bank converts it if your card is in another currency." },
    { q: "Do you take a cut of my sales?", a: "No. Fino doesn't process your clients' payments: you record how they paid, and the money goes straight to you." },
  ],
};
const pricingPt: PricingCopy = {
  meta: {
    title: `Preços: US$${M} por mês, todos os recursos, a equipe toda`,
    description: `O Fino custa US$${M} por mês ou US$${Y} por ano para o negócio inteiro: todos os recursos, clientes e visitas ilimitados, todos os groomers. 14 dias grátis, sem cartão.`,
  },
  title: "Um preço para o negócio inteiro.",
  sub: "Todos os recursos, todos os groomers, clientes e visitas ilimitados. Sem taxa de adesão.",
  monthly: "Mensal", yearly: "Anual", perMonth: "/mês", perYear: "/ano", save: "2 meses grátis",
  cta: "Começar teste grátis", trial: "14 dias grátis. Sem cartão.",
  includedTitle: "Incluído em todos os planos",
  included: [
    "Clientes, pets e visitas ilimitados", "Todos os groomers da equipe, cada um com seu login", "Página de agendamento, QR code e fichas",
    "Rotas com tempo de estrada e a melhor ordem", "Lembretes automáticos por SMS e e-mail", "Recebimento, recibos e relatórios",
    "Campanhas de e-mail marketing", "Importação e exportação dos seus dados", "20 idiomas e qualquer país", "Central de ajuda e assistente",
  ],
  referral: { title: "Foi convidado por outro groomer?", text: `Cadastre-se pelo link dele e ganhe US$${M} de desconto na primeira cobrança: seu primeiro mês grátis. Cada groomer tem o próprio link: quando alguém que você convidou fizer o primeiro pagamento, você ganha US$${M} de crédito nas suas cobranças.` },
  faqTitle: "Dúvidas sobre o plano",
  faq: [
    { q: "Preciso de cartão para o teste grátis?", a: "Não. Use tudo por 14 dias. Se escolher um plano com mais de 48 horas de teste restantes, a primeira cobrança é no dia em que o teste acaba; com 48 horas ou menos, é no dia em que você escolhe o plano." },
    { q: "O que acontece quando o teste acaba?", a: "Se você não escolheu um plano, o app abre só a página do plano e sua página de agendamento fica pausada. Seus clientes, pets e visitas continuam guardados, e tudo volta assim que você escolhe um plano." },
    { q: "O preço é por groomer ou por van?", a: "Nenhum dos dois. Um plano cobre o negócio inteiro, seja qual for o tamanho da equipe." },
    { q: "Como pago e cancelo?", a: "Com cartão, pelo Stripe. Troque o cartão, veja as faturas ou cancele quando quiser no portal de cobrança, sem falar com ninguém. Você continua usando o app até o fim do período pago." },
    { q: "Posso pedir reembolso?", a: "O plano mensal não tem reembolso: ao cancelar, ele vai até o fim do mês. No plano anual, peça em até 14 dias após a cobrança, pelo e-mail de suporte, e devolvemos a parte do ano não usada, proporcionalmente." },
    { q: "Em que moeda sou cobrado?", a: "Em dólares americanos. Seu banco converte se o cartão for de outra moeda." },
    { q: "Vocês ficam com parte das minhas vendas?", a: "Não. O Fino não processa os pagamentos dos seus clientes: você registra como pagaram, e o dinheiro vai direto para você." },
  ],
};
const pricingEs: PricingCopy = {
  meta: {
    title: `Precios: US$${M} al mes, todas las funciones, todo el equipo`,
    description: `Fino cuesta US$${M} al mes o US$${Y} al año para todo el negocio: todas las funciones, clientes y visitas ilimitados, todos los groomers. 14 días gratis, sin tarjeta.`,
  },
  title: "Un precio para todo el negocio.",
  sub: "Todas las funciones, todos los groomers, clientes y visitas ilimitados. Sin costo de alta.",
  monthly: "Mensual", yearly: "Anual", perMonth: "/mes", perYear: "/año", save: "2 meses gratis",
  cta: "Empezar prueba gratis", trial: "14 días gratis. Sin tarjeta.",
  includedTitle: "Incluido en todos los planes",
  included: [
    "Clientes, mascotas y visitas ilimitados", "Todos los groomers del equipo, cada uno con su acceso", "Página de reservas, código QR y formularios",
    "Rutas con tiempos de manejo y el mejor orden", "Recordatorios automáticos por SMS y correo", "Cobro, recibos y reportes",
    "Campañas de email marketing", "Importar y exportar tus datos", "20 idiomas y cualquier país", "Centro de ayuda y asistente",
  ],
  referral: { title: "¿Te invitó otro groomer?", text: `Regístrate con su enlace y obtén US$${M} de descuento en tu primera factura: tu primer mes gratis. Cada groomer tiene su propio enlace: cuando alguien que invitaste haga su primer pago, recibes US$${M} de crédito en tus facturas.` },
  faqTitle: "Preguntas sobre el plan",
  faq: [
    { q: "¿Necesito tarjeta para la prueba gratis?", a: "No. Usa todo durante 14 días. Si eliges un plan con más de 48 horas de prueba por delante, el primer cobro es el día en que termina la prueba; con 48 horas o menos, es el día en que eliges el plan." },
    { q: "¿Qué pasa cuando termina la prueba?", a: "Si no elegiste un plan, la app abre solo la página del plan y tu página de reservas se pausa. Tus clientes, mascotas y visitas quedan guardados, y todo vuelve apenas eliges un plan." },
    { q: "¿El precio es por groomer o por van?", a: "Ninguno. Un plan cubre todo el negocio, sea cual sea el tamaño del equipo." },
    { q: "¿Cómo pago y cancelo?", a: "Con tarjeta, a través de Stripe. Cambia la tarjeta, mira las facturas o cancela cuando quieras en el portal de facturación, sin hablar con nadie. Sigues usando la app hasta el fin del período pagado." },
    { q: "¿Puedo pedir un reembolso?", a: "El plan mensual no tiene reembolso: al cancelar, sigue hasta el fin del mes. En el plan anual, pídelo dentro de los 14 días posteriores al cobro, por email a soporte, y te devolvemos la parte del año no usada, en forma proporcional." },
    { q: "¿En qué moneda me cobran?", a: "En dólares estadounidenses. Tu banco convierte si la tarjeta es de otra moneda." },
    { q: "¿Se quedan con parte de mis ventas?", a: "No. Fino no procesa los pagos de tus clientes: tú registras cómo pagaron y el dinero va directo a ti." },
  ],
};
export const pricingCopy = (l: SiteLang) => ({ en: pricingEn, pt: pricingPt, es: pricingEs })[l];

// ——— /mobile-grooming-software and /mobile-grooming-route-planner (the same shape) ———

type TopicCopy = { meta: Meta; kicker: string; title: string; sub: string; shot: string; alt: string; points: Item[]; stepsTitle: string; steps: Item[]; faqTitle: string; faq: QA[] };

const mobileEn: TopicCopy = {
  meta: {
    title: "Mobile dog grooming software: booking, routes and checkout in one app",
    description: "Fino is software for mobile dog groomers: clients book online around your route, reminders go out on their own, and you check out at the door. 14 days free.",
  },
  kicker: "Mobile grooming software",
  title: "Software made for groomers who work from a van.",
  sub: "A salon app plans chairs. A mobile groomer plans streets. Fino books around your route, keeps your day on the phone and gets you paid at the door.",
  shot: "/landing/today.png", alt: "The day's stops with drive times",
  points: [
    { t: "Bookings that fit the route", d: "The booking page only offers times that work with your service areas, your hours and the drive from the stop before." },
    { t: "Your areas, your days", d: "Work the north side on Tuesdays and the coast on Fridays: the booking page follows the plan." },
    { t: "Drive times and the best order", d: "See the drive between stops and reorder the day for the least driving." },
    { t: "Clients know when you're coming", d: "“On my way” tells them your arrival time, and reminders go out before every visit." },
    { t: "Built for the driveway", d: "Big buttons, one-handed screens, and the day stays on the phone without signal." },
    { t: "Paid before you drive off", d: "Checkout, tip and receipt at the door, recorded the way the client paid." },
  ],
  stepsTitle: "Set up in five minutes",
  steps: [
    { t: "Add your services and prices", d: "Starter services come ready by size; change names, prices and times." },
    { t: "Set your hours and areas", d: "Your working days, where you start, and the areas you cover." },
    { t: "Share your booking link", d: "On Instagram, WhatsApp, Google and as a QR code on the van." },
  ],
  faqTitle: "Questions mobile groomers ask",
  faq: [
    { q: "Is Fino only for mobile groomers?", a: "It's built around the van: routes, service areas, drive times and arrival texts. Groomers with a salon can use it too and simply skip the route features." },
    { q: "Do my clients need to download an app?", a: "No. They book on your page in their phone's browser, in their own language." },
    { q: "Can I use it with my team?", a: "Yes. Each groomer gets a color, their own route and their own login, and the plan covers the whole team." },
    { q: "Does it work outside the US?", a: "Yes. Pick your country and the app follows it: currency, phone numbers, postal codes, miles or kilometers and local holidays." },
  ],
};
const mobilePt: TopicCopy = {
  meta: {
    title: "App para banho e tosa móvel: agendamento, rotas e recebimento num app só",
    description: "O Fino é um app para quem faz banho e tosa móvel: clientes agendam online de acordo com sua rota, lembretes saem sozinhos e você recebe na porta. 14 dias grátis.",
  },
  kicker: "App para banho e tosa móvel",
  title: "Feito para quem trabalha numa van.",
  sub: "App de pet shop organiza cadeiras. Quem é móvel organiza ruas. O Fino agenda de acordo com a sua rota, mantém seu dia no celular e faz você receber na porta.",
  shot: "/landing/today.png", alt: "As paradas do dia com o tempo de estrada",
  points: [
    { t: "Agendamentos que cabem na rota", d: "A página de agendamento só oferece horários que combinam com suas áreas, seu expediente e o trajeto desde a parada anterior." },
    { t: "Suas áreas, seus dias", d: "Zona norte às terças e litoral às sextas: a página de agendamento segue o plano." },
    { t: "Tempo de estrada e a melhor ordem", d: "Veja o trajeto entre as paradas e reorganize o dia para rodar menos." },
    { t: "O cliente sabe quando você chega", d: "“A caminho” manda o horário de chegada, e os lembretes saem antes de cada visita." },
    { t: "Feito para a calçada", d: "Botões grandes, telas para usar com uma mão, e o dia fica no celular sem sinal." },
    { t: "Recebido antes de sair", d: "Recebimento, gorjeta e recibo na porta, registrados do jeito que o cliente pagou." },
  ],
  stepsTitle: "Pronto em cinco minutos",
  steps: [
    { t: "Cadastre serviços e preços", d: "Serviços iniciais já vêm por porte; mude nomes, preços e tempos." },
    { t: "Defina horários e áreas", d: "Seus dias de trabalho, de onde você sai e as áreas que atende." },
    { t: "Compartilhe seu link", d: "No Instagram, WhatsApp, Google e como QR code na van." },
  ],
  faqTitle: "Dúvidas de quem faz banho e tosa móvel",
  faq: [
    { q: "O Fino é só para banho e tosa móvel?", a: "Ele foi pensado em volta da van: rotas, áreas, tempo de estrada e aviso de chegada. Quem tem pet shop também pode usar, sem precisar dos recursos de rota." },
    { q: "Meus clientes precisam baixar um app?", a: "Não. Eles agendam na sua página, pelo navegador do celular, no próprio idioma." },
    { q: "Posso usar com minha equipe?", a: "Sim. Cada groomer tem cor, rota e login próprios, e o plano cobre a equipe toda." },
    { q: "Funciona fora dos EUA?", a: "Sim. Escolha seu país e o app acompanha: moeda, telefone, CEP, milhas ou quilômetros e feriados locais." },
  ],
};
const mobileEs: TopicCopy = {
  meta: {
    title: "Software para grooming móvil: reservas, rutas y cobro en una sola app",
    description: "Fino es software para groomers móviles: los clientes reservan online según tu ruta, los recordatorios salen solos y cobras en la puerta. 14 días gratis.",
  },
  kicker: "Software para grooming móvil",
  title: "Hecho para groomers que trabajan desde una van.",
  sub: "Una app de salón organiza sillas. Un groomer móvil organiza calles. Fino reserva según tu ruta, mantiene tu día en el teléfono y te ayuda a cobrar en la puerta.",
  shot: "/landing/today.png", alt: "Las paradas del día con tiempos de manejo",
  points: [
    { t: "Reservas que caben en la ruta", d: "La página de reservas solo ofrece horarios que encajan con tus zonas, tu horario y el trayecto desde la parada anterior." },
    { t: "Tus zonas, tus días", d: "El norte los martes y la costa los viernes: la página de reservas sigue el plan." },
    { t: "Tiempos de manejo y el mejor orden", d: "Mira el trayecto entre paradas y reordena el día para manejar menos." },
    { t: "El cliente sabe cuándo llegas", d: "“En camino” le envía tu hora de llegada, y los recordatorios salen antes de cada visita." },
    { t: "Hecha para la vereda", d: "Botones grandes, pantallas para usar con una mano, y el día queda en el teléfono sin señal." },
    { t: "Cobrado antes de irte", d: "Cobro, propina y recibo en la puerta, registrados como pagó el cliente." },
  ],
  stepsTitle: "Lista en cinco minutos",
  steps: [
    { t: "Agrega servicios y precios", d: "Los servicios iniciales vienen por tamaño; cambia nombres, precios y tiempos." },
    { t: "Define horario y zonas", d: "Tus días de trabajo, desde dónde sales y las zonas que cubres." },
    { t: "Comparte tu enlace", d: "En Instagram, WhatsApp, Google y como código QR en la van." },
  ],
  faqTitle: "Preguntas de groomers móviles",
  faq: [
    { q: "¿Fino es solo para grooming móvil?", a: "Está pensado alrededor de la van: rutas, zonas, tiempos de manejo y aviso de llegada. Quien tiene un salón también puede usarla, sin necesitar las funciones de ruta." },
    { q: "¿Mis clientes tienen que descargar una app?", a: "No. Reservan en tu página, desde el navegador del teléfono, en su propio idioma." },
    { q: "¿Puedo usarla con mi equipo?", a: "Sí. Cada groomer tiene color, ruta y acceso propios, y el plan cubre a todo el equipo." },
    { q: "¿Funciona fuera de EE. UU.?", a: "Sí. Elige tu país y la app lo sigue: moneda, teléfonos, códigos postales, millas o kilómetros y feriados locales." },
  ],
};
export const mobileCopy = (l: SiteLang) => ({ en: mobileEn, pt: mobilePt, es: mobileEs })[l];

const routeEn: TopicCopy = {
  meta: {
    title: "Route planner for mobile groomers: drive times, best order and service areas",
    description: "Plan the mobile grooming day with drive times between stops, the best order in one tap, service areas by day and arrival texts. Part of every Fino plan.",
  },
  kicker: "Route planner",
  title: "Less driving, more grooming.",
  sub: "The route is planned when the booking is made, not the night before. Fino keeps bookings close together and shows the day in the order that drives the least.",
  shot: "/landing/today.png", alt: "The day's stops with drive times",
  points: [
    { t: "Drive times on the day", d: "Every stop shows the drive from the one before, with Google Maps." },
    { t: "Best order in one tap", d: "Reorder the stops for the least driving, from your start point to your end point." },
    { t: "Service areas by day", d: "List the postal codes you cover and pick the days for each; online booking offers only those days." },
    { t: "Bookings near your other stops", d: "When you're already booked nearby, the booking page offers the times right before and after, so the day stays tight." },
    { t: "Your rules for the road", d: "Your start and end points, the time between visits and how far apart stops can be." },
    { t: "Arrival texts", d: "“On my way” sends the client your arrival time from the route." },
  ],
  stepsTitle: "How it works",
  steps: [
    { t: "Set where you start", d: "Home, the shop or wherever the van sleeps, and where the day ends." },
    { t: "List your areas", d: "The postal codes you cover and the days you work each one, shown on a map." },
    { t: "Let bookings come in", d: "Clients see times that fit; you open Today and drive." },
  ],
  faqTitle: "Questions about routes",
  faq: [
    { q: "Do I need a Google Maps account?", a: "No. Drive times and the best order come from Google Maps through Fino; you just use the app." },
    { q: "Can I still move a visit by hand?", a: "Yes. The best order is a suggestion; you can change any visit's time or day." },
    { q: "Miles or kilometers?", a: "Whichever your country uses, and you can change it in Settings." },
    { q: "Is the route planner extra?", a: "No. It's part of every plan, like every other feature." },
  ],
};
const routePt: TopicCopy = {
  meta: {
    title: "Planejador de rotas para banho e tosa móvel: tempo de estrada, melhor ordem e áreas",
    description: "Planeje o dia de banho e tosa móvel com tempo de estrada entre paradas, melhor ordem num toque, áreas de atendimento por dia e aviso de chegada. Em todos os planos do Fino.",
  },
  kicker: "Planejador de rotas",
  title: "Menos estrada, mais banho e tosa.",
  sub: "A rota é planejada na hora do agendamento, não na noite anterior. O Fino mantém os agendamentos próximos e mostra o dia na ordem que roda menos.",
  shot: "/landing/today.png", alt: "As paradas do dia com o tempo de estrada",
  points: [
    { t: "Tempo de estrada no dia", d: "Cada parada mostra o trajeto desde a anterior, com o Google Maps." },
    { t: "Melhor ordem num toque", d: "Reorganize as paradas para rodar menos, do ponto de partida ao ponto final." },
    { t: "Áreas de atendimento por dia", d: "Liste os CEPs que você atende e escolha os dias de cada área; o agendamento online oferece só esses dias." },
    { t: "Agendamentos perto das outras paradas", d: "Quando você já tem visita por perto, a página oferece os horários logo antes e depois, para o dia ficar enxuto." },
    { t: "Suas regras de estrada", d: "Ponto de partida e de chegada, o tempo entre visitas e a distância máxima entre paradas." },
    { t: "Aviso de chegada", d: "“A caminho” manda ao cliente o horário de chegada a partir da rota." },
  ],
  stepsTitle: "Como funciona",
  steps: [
    { t: "Diga de onde você sai", d: "Casa, loja ou onde a van dorme, e onde o dia termina." },
    { t: "Liste suas áreas", d: "Os CEPs que você atende e os dias de cada área, mostrados no mapa." },
    { t: "Deixe os agendamentos chegarem", d: "Os clientes veem horários que encaixam; você abre o Hoje e dirige." },
  ],
  faqTitle: "Dúvidas sobre rotas",
  faq: [
    { q: "Preciso de conta no Google Maps?", a: "Não. O tempo de estrada e a melhor ordem vêm do Google Maps pelo Fino; você só usa o app." },
    { q: "Ainda posso mudar uma visita à mão?", a: "Sim. A melhor ordem é uma sugestão; você muda o horário ou o dia de qualquer visita." },
    { q: "Milhas ou quilômetros?", a: "O que o seu país usa, e dá para mudar nos Ajustes." },
    { q: "O planejador de rotas é cobrado à parte?", a: "Não. Ele faz parte de todos os planos, como todos os outros recursos." },
  ],
};
const routeEs: TopicCopy = {
  meta: {
    title: "Planificador de rutas para grooming móvil: tiempos de manejo, mejor orden y zonas",
    description: "Planifica el día de grooming móvil con tiempos de manejo entre paradas, el mejor orden en un toque, zonas de servicio por día y aviso de llegada. En todos los planes de Fino.",
  },
  kicker: "Planificador de rutas",
  title: "Menos manejo, más grooming.",
  sub: "La ruta se planifica al reservar, no la noche anterior. Fino mantiene las reservas cerca y muestra el día en el orden que menos maneja.",
  shot: "/landing/today.png", alt: "Las paradas del día con tiempos de manejo",
  points: [
    { t: "Tiempos de manejo en el día", d: "Cada parada muestra el trayecto desde la anterior, con Google Maps." },
    { t: "El mejor orden en un toque", d: "Reordena las paradas para manejar menos, desde tu punto de partida hasta el final." },
    { t: "Zonas de servicio por día", d: "Indica los códigos postales que cubres y elige los días de cada zona; las reservas online ofrecen solo esos días." },
    { t: "Reservas cerca de tus otras paradas", d: "Cuando ya tienes una visita cerca, la página ofrece los horarios justo antes y después, para que el día quede compacto." },
    { t: "Tus reglas de ruta", d: "Punto de partida y de llegada, el tiempo entre visitas y la distancia máxima entre paradas." },
    { t: "Aviso de llegada", d: "“En camino” envía al cliente tu hora de llegada desde la ruta." },
  ],
  stepsTitle: "Cómo funciona",
  steps: [
    { t: "Indica desde dónde sales", d: "Casa, el local o donde duerme la van, y dónde termina el día." },
    { t: "Indica tus zonas", d: "Los códigos postales que cubres y los días de cada zona, en un mapa." },
    { t: "Deja que lleguen las reservas", d: "Los clientes ven horarios que encajan; tú abres Hoy y manejas." },
  ],
  faqTitle: "Preguntas sobre rutas",
  faq: [
    { q: "¿Necesito una cuenta de Google Maps?", a: "No. Los tiempos de manejo y el mejor orden vienen de Google Maps a través de Fino; tú solo usas la app." },
    { q: "¿Puedo mover una visita a mano?", a: "Sí. El mejor orden es una sugerencia; puedes cambiar la hora o el día de cualquier visita." },
    { q: "¿Millas o kilómetros?", a: "Lo que use tu país, y puedes cambiarlo en Ajustes." },
    { q: "¿El planificador de rutas se cobra aparte?", a: "No. Es parte de todos los planes, como todas las demás funciones." },
  ],
};
export const routeCopy = (l: SiteLang) => ({ en: routeEn, pt: routePt, es: routeEs })[l];

// ——— /switch ———

const switchEn: TopicCopy = {
  meta: {
    title: "Switch to Fino from another grooming app: bring your clients in minutes",
    description: "Moving from another grooming app or a spreadsheet? Import your client list, set your services and share your new booking link. 14 days free to try it alongside.",
  },
  kicker: "Switch to Fino",
  title: "Bring your clients. Keep your Saturday.",
  sub: "Moving apps shouldn't take a weekend. Export your client list, import it into Fino and share your new booking link: most of the work is done in an evening.",
  shot: "/landing/book.png", alt: "The booking page on a phone",
  points: [
    { t: "Import from a spreadsheet", d: "Any CSV file with names and phone numbers works: most grooming apps and contact lists can export one." },
    { t: "No duplicates", d: "Clients are matched by phone number, so importing twice doesn't double anyone." },
    { t: "Try both side by side", d: "Use Fino for 14 days, free and without a card, before you turn the old app off." },
    { t: "Clients just get a new link", d: "No app to download: they book on your new page in their phone's browser." },
    { t: "Your data stays yours", d: "Export your clients, pets, visits and payments from Fino anytime, as a spreadsheet or a backup file (photos aside)." },
    { t: "Help on every screen", d: "Step-by-step guides inside the app, and an assistant for questions." },
  ],
  stepsTitle: "Moving in three steps",
  steps: [
    { t: "Export your client list", d: "From your current app or your phone's contacts, as a CSV file." },
    { t: "Import it into Fino", d: "In the first-run setup or in Settings → Import; check the columns and go." },
    { t: "Share your new booking link", d: "Swap the link on Instagram, Google and your website, and print the new QR code." },
  ],
  faqTitle: "Questions about switching",
  faq: [
    { q: "Which columns does the import read?", a: "Names, phone, email, address, notes, tags and pets with their breed. Past visits stay in your old app's export." },
    { q: "Will my clients get messages when I import them?", a: "No. Importing doesn't send anything to anyone." },
    { q: "Can I keep my prices and services?", a: "Yes. Starter services come ready, and you rename them and set your own prices and times." },
    { q: "What if I change my mind?", a: "Export your clients from Fino as a spreadsheet anytime. No lock-in: cancel anytime." },
  ],
};
const switchPt: TopicCopy = {
  meta: {
    title: "Mude para o Fino vindo de outro app de banho e tosa: traga seus clientes em minutos",
    description: "Vindo de outro app ou de uma planilha? Importe sua lista de clientes, ajuste seus serviços e compartilhe o novo link de agendamento. 14 dias grátis para testar junto.",
  },
  kicker: "Mudar para o Fino",
  title: "Traga seus clientes. Guarde seu sábado.",
  sub: "Trocar de app não devia levar um fim de semana. Exporte sua lista de clientes, importe no Fino e compartilhe o novo link: quase tudo fica pronto numa noite.",
  shot: "/landing/book.png", alt: "A página de agendamento no celular",
  points: [
    { t: "Importe de uma planilha", d: "Qualquer arquivo CSV com nomes e telefones serve: a maioria dos apps de banho e tosa e das agendas de contatos exporta um." },
    { t: "Sem duplicados", d: "Os clientes são reconhecidos pelo telefone, então importar duas vezes não duplica ninguém." },
    { t: "Teste os dois juntos", d: "Use o Fino por 14 dias, grátis e sem cartão, antes de desligar o app antigo." },
    { t: "O cliente só recebe um link novo", d: "Nada para baixar: ele agenda na sua nova página pelo navegador do celular." },
    { t: "Seus dados continuam seus", d: "Exporte clientes, pets, visitas e pagamentos do Fino quando quiser, em planilha ou arquivo de backup (fotos à parte)." },
    { t: "Ajuda em cada tela", d: "Guias passo a passo dentro do app e um assistente para dúvidas." },
  ],
  stepsTitle: "Mudança em três passos",
  steps: [
    { t: "Exporte sua lista de clientes", d: "Do seu app atual ou da agenda do celular, como arquivo CSV." },
    { t: "Importe no Fino", d: "Na configuração inicial ou em Ajustes → Importar; confira as colunas e pronto." },
    { t: "Compartilhe o novo link", d: "Troque o link no Instagram, no Google e no seu site, e imprima o novo QR code." },
  ],
  faqTitle: "Dúvidas sobre a mudança",
  faq: [
    { q: "Quais colunas a importação lê?", a: "Nomes, telefone, e-mail, endereço, observações, etiquetas e pets com a raça. As visitas antigas ficam no arquivo exportado do app anterior." },
    { q: "Meus clientes recebem mensagens quando eu importo?", a: "Não. Importar não envia nada para ninguém." },
    { q: "Posso manter meus preços e serviços?", a: "Sim. Serviços iniciais já vêm prontos, e você muda os nomes, os preços e os tempos." },
    { q: "E se eu mudar de ideia?", a: "Exporte seus clientes do Fino em planilha quando quiser. Sem fidelidade: cancele quando quiser." },
  ],
};
const switchEs: TopicCopy = {
  meta: {
    title: "Cámbiate a Fino desde otra app de grooming: trae tus clientes en minutos",
    description: "¿Vienes de otra app de grooming o de una hoja de cálculo? Importa tu lista de clientes, ajusta tus servicios y comparte tu nuevo enlace de reservas. 14 días gratis para probar.",
  },
  kicker: "Cambiar a Fino",
  title: "Trae tus clientes. Guarda tu sábado.",
  sub: "Cambiar de app no debería llevar un fin de semana. Exporta tu lista de clientes, impórtala en Fino y comparte tu nuevo enlace: casi todo queda listo en una noche.",
  shot: "/landing/book.png", alt: "La página de reservas en un teléfono",
  points: [
    { t: "Importa desde una hoja de cálculo", d: "Cualquier archivo CSV con nombres y teléfonos sirve: la mayoría de las apps de grooming y agendas de contactos pueden exportarlo." },
    { t: "Sin duplicados", d: "Los clientes se reconocen por teléfono, así que importar dos veces no duplica a nadie." },
    { t: "Prueba las dos a la vez", d: "Usa Fino 14 días, gratis y sin tarjeta, antes de apagar la app anterior." },
    { t: "El cliente solo recibe un enlace nuevo", d: "Nada que descargar: reserva en tu nueva página desde el navegador del teléfono." },
    { t: "Tus datos siguen siendo tuyos", d: "Exporta clientes, mascotas, visitas y pagos desde Fino cuando quieras, como hoja de cálculo o archivo de copia (fotos aparte)." },
    { t: "Ayuda en cada pantalla", d: "Guías paso a paso dentro de la app y un asistente para dudas." },
  ],
  stepsTitle: "El cambio en tres pasos",
  steps: [
    { t: "Exporta tu lista de clientes", d: "Desde tu app actual o los contactos del teléfono, como archivo CSV." },
    { t: "Impórtala en Fino", d: "En la configuración inicial o en Ajustes → Importar; revisa las columnas y listo." },
    { t: "Comparte tu nuevo enlace", d: "Cambia el enlace en Instagram, Google y tu sitio web, e imprime el nuevo código QR." },
  ],
  faqTitle: "Preguntas sobre el cambio",
  faq: [
    { q: "¿Qué columnas lee la importación?", a: "Nombres, teléfono, correo, dirección, notas, etiquetas y mascotas con su raza. Las visitas anteriores quedan en el archivo exportado de la app anterior." },
    { q: "¿Mis clientes reciben mensajes cuando los importo?", a: "No. Importar no le envía nada a nadie." },
    { q: "¿Puedo mantener mis precios y servicios?", a: "Sí. Los servicios iniciales vienen listos, y cambias nombres, precios y tiempos." },
    { q: "¿Y si cambio de opinión?", a: "Exporta tus clientes de Fino en una hoja de cálculo cuando quieras. Sin permanencia: cancela cuando quieras." },
  ],
};
export const switchCopy = (l: SiteLang) => ({ en: switchEn, pt: switchPt, es: switchEs })[l];

// ——— /guides (the help center's how-to articles, public) ———

const guidesEn = {
  meta: { title: "Guides: how to run your mobile grooming day with Fino", description: "Step-by-step guides for Fino: setting up, booking, service areas, the day's route, checkout, reminders, marketing, team and settings." },
  kicker: "Guides", title: "How to do it in Fino.", sub: "Short step-by-step guides, the same ones inside the app.",
  steps: "Steps", tips: "Tips", more: "More in this topic", all: "All guides",
};
export type GuidesCopy = typeof guidesEn;
const guidesPt: GuidesCopy = {
  meta: { title: "Guias: como tocar seu dia de banho e tosa móvel com o Fino", description: "Guias passo a passo do Fino: configuração, agendamentos, áreas de atendimento, rota do dia, recebimento, lembretes, marketing, equipe e ajustes." },
  kicker: "Guias", title: "Como fazer no Fino.", sub: "Guias curtos, passo a passo, os mesmos que estão dentro do app.",
  steps: "Passos", tips: "Dicas", more: "Mais neste tema", all: "Todos os guias",
};
const guidesEs: GuidesCopy = {
  meta: { title: "Guías: cómo llevar tu día de grooming móvil con Fino", description: "Guías paso a paso de Fino: configuración, reservas, zonas de servicio, la ruta del día, cobro, recordatorios, marketing, equipo y ajustes." },
  kicker: "Guías", title: "Cómo hacerlo en Fino.", sub: "Guías cortas, paso a paso, las mismas que están dentro de la app.",
  steps: "Pasos", tips: "Consejos", more: "Más sobre este tema", all: "Todas las guías",
};
export const guidesCopy = (l: SiteLang) => ({ en: guidesEn, pt: guidesPt, es: guidesEs })[l];
