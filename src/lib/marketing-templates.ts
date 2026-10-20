// Ready-made campaigns for the big US holidays and a few grooming moments, each with its own
// picture (public/marketing/<key>.jpg, drawn for Woofers). The owner edits everything before sending.
// {first_name}, {pet_name}, {business} and {booking_link} are filled in for each client.

export type MarketingTemplate = {
  key: string;
  name: string;
  /** The date this year it's about (yyyy-MM-dd), or null for any time. */
  date: ((year: number) => string) | null;
  subject: string;
  headline: string;
  body: string;
  button: string;
  banner: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
/** The n-th weekday (0 = Sunday) of a month; n = -1 for the last one. */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return ymd(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return ymd(y, m, lastDay - ((last - weekday + 7) % 7));
}
/** Easter Sunday (Gregorian calendar). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(y, month, day);
}

const sign = "\n\nSee you soon,\n{business}";

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  {
    key: "we-miss-you", name: "We miss you", date: null, banner: "/marketing/we-miss-you.jpg",
    subject: "We miss {pet_name}! 🐾", headline: "It's been a while!",
    body: "Hi {first_name},\n\nWe miss seeing {pet_name}! It's been a little while since the last spa day, and a fresh groom keeps coats healthy, nails short and tails wagging.\n\nOur van comes right to your door. Pick a time that works for you:" + sign,
    button: "Book a visit",
  },
  {
    key: "new-year", name: "New Year", date: (y) => ymd(y, 1, 1), banner: "/marketing/new-year.jpg",
    subject: "New year, fresh look for {pet_name} ✨", headline: "Happy New Year!",
    body: "Hi {first_name},\n\nThank you for trusting us with {pet_name} this past year. Start the new year fresh with a bath, haircut and a little pampering, right in your driveway.\n\nThe first weeks of January fill up fast:" + sign,
    button: "Book now",
  },
  {
    key: "valentines", name: "Valentine's Day", date: (y) => ymd(y, 2, 14), banner: "/marketing/valentines.jpg",
    subject: "Show {pet_name} some love 💕", headline: "Happy Valentine's Day!",
    body: "Hi {first_name},\n\nNobody loves you like {pet_name} does. Say thank you with a spa day: a warm bath, a fresh cut and a cute bandana, all in our van at your door." + sign,
    button: "Book a spa day",
  },
  {
    key: "st-patricks", name: "St. Patrick's Day", date: (y) => ymd(y, 3, 17), banner: "/marketing/st-patricks.jpg",
    subject: "Feeling lucky? 🍀", headline: "Happy St. Patrick's Day!",
    body: "Hi {first_name},\n\nWe're lucky to have friends like you and {pet_name}! Spring is around the corner, and so is shedding season. Book a de-shedding bath and keep the fur off your couch." + sign,
    button: "Book now",
  },
  {
    key: "spring", name: "Spring", date: (y) => ymd(y, 3, 20), banner: "/marketing/spring.jpg",
    subject: "Spring cleaning for {pet_name} 🌷", headline: "Spring is here!",
    body: "Hi {first_name},\n\nWarmer days mean muddy paws and lots of shedding. Our de-shedding treatment and a fresh trim will get {pet_name} ready for the season." + sign,
    button: "Book a spring groom",
  },
  {
    key: "easter", name: "Easter", date: easter, banner: "/marketing/easter.jpg",
    subject: "Hop in for a fresh groom 🐣", headline: "Happy Easter!",
    body: "Hi {first_name},\n\nFamily photos coming up? Make sure {pet_name} looks their best. Book a bath and haircut before the holiday weekend." + sign,
    button: "Book now",
  },
  {
    key: "mothers-day", name: "Mother's Day", date: (y) => nthWeekday(y, 5, 0, 2), banner: "/marketing/mothers-day.jpg",
    subject: "Happy Mother's Day to all dog moms 💐", headline: "Happy Mother's Day!",
    body: "Hi {first_name},\n\nTo every mom who loves her fur babies: you deserve a break! Let us take care of {pet_name}'s grooming, right at your door, while you relax." + sign,
    button: "Book a visit",
  },
  {
    key: "summer", name: "Summer", date: (y) => nthWeekday(y, 5, 1, -1), banner: "/marketing/summer.jpg",
    subject: "Summer-ready {pet_name} ☀️", headline: "Hello, summer!",
    body: "Hi {first_name},\n\nHot days are coming. A summer trim and a good de-shed help {pet_name} stay cool and comfortable. Summer spots go fast, so book early!" + sign,
    button: "Book a summer cut",
  },
  {
    key: "fathers-day", name: "Father's Day", date: (y) => nthWeekday(y, 6, 0, 3), banner: "/marketing/fathers-day.jpg",
    subject: "Happy Father's Day to all dog dads 🐶", headline: "Happy Father's Day!",
    body: "Hi {first_name},\n\nHere's to the dog dads! Treat {pet_name} (and yourself) to a fresh groom, no driving needed. We come to you." + sign,
    button: "Book now",
  },
  {
    key: "july-4th", name: "4th of July", date: (y) => ymd(y, 7, 4), banner: "/marketing/july-4th.jpg",
    subject: "Happy 4th of July! 🎆", headline: "Happy Independence Day!",
    body: "Hi {first_name},\n\nFireworks can be scary for pups. Keep {pet_name} inside, close the curtains and turn on some music. And for the summer BBQs, book a fresh groom so they look their best." + sign,
    button: "Book now",
  },
  {
    key: "dog-day", name: "National Dog Day", date: (y) => ymd(y, 8, 26), banner: "/marketing/dog-day.jpg",
    subject: "Happy National Dog Day, {pet_name}! 🐕", headline: "Happy National Dog Day!",
    body: "Hi {first_name},\n\nToday is all about our best friends, and {pet_name} is one of our favorites! Celebrate with a spa day: bath, cut, nails and lots of love." + sign,
    button: "Book a spa day",
  },
  {
    key: "fall", name: "Fall", date: (y) => nthWeekday(y, 9, 1, 1), banner: "/marketing/fall.jpg",
    subject: "Fall grooming for {pet_name} 🍂", headline: "Hello, fall!",
    body: "Hi {first_name},\n\nThe seasons are changing and so are coats. A fall groom gets rid of the summer undercoat and keeps {pet_name} comfy for cooler days." + sign,
    button: "Book now",
  },
  {
    key: "halloween", name: "Halloween", date: (y) => ymd(y, 10, 31), banner: "/marketing/halloween.jpg",
    subject: "No tricks, just treats for {pet_name} 🎃", headline: "Happy Halloween!",
    body: "Hi {first_name},\n\nWhether {pet_name} is dressing up as a pumpkin or a superhero, a fresh groom makes every costume look better. Book before the spooky weekend!" + sign,
    button: "Book now",
  },
  {
    key: "thanksgiving", name: "Thanksgiving", date: (y) => nthWeekday(y, 11, 4, 4), banner: "/marketing/thanksgiving.jpg",
    subject: "Thankful for you and {pet_name} 🦃", headline: "Happy Thanksgiving!",
    body: "Hi {first_name},\n\nThis year we're thankful for clients like you. Family is coming over? Have {pet_name} looking (and smelling) great for the holiday. Book early, the week fills up fast!" + sign,
    button: "Book before the holiday",
  },
  {
    key: "holidays", name: "Christmas & holidays", date: (y) => ymd(y, 12, 25), banner: "/marketing/holidays.jpg",
    subject: "Make {pet_name} holiday-ready 🎄", headline: "Happy Holidays!",
    body: "Hi {first_name},\n\nThe holidays are here! Family photos, parties or just cozy days at home: {pet_name} deserves to look and feel their best. Our December spots are filling up fast." + sign,
    button: "Book online",
  },
  {
    key: "blank", name: "Start from scratch", date: null, banner: null,
    subject: "", headline: "", body: "Hi {first_name},\n\n" + sign.trimStart(), button: "Book now",
  },
];

export const templateByKey = (key: string | null) => MARKETING_TEMPLATES.find((t) => t.key === key) ?? null;

/** The next date (today or later) the template is about. */
export function nextDate(t: MarketingTemplate, today: string) {
  if (!t.date) return null;
  const y = Number(today.slice(0, 4));
  const d = t.date(y);
  return d >= today ? d : t.date(y + 1);
}
