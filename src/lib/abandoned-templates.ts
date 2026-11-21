// Twenty ready messages for people who started booking online and didn't finish, so the owner
// never has to send the same text twice. English (they go to the business's clients). Only
// {client}, {pet}, {business} and {booking_url} are filled in; keep each under 320 characters.

export const ABANDONED_TEMPLATES: string[] = [
  "Hi {client}! It's {business} 🐾 We saw you started booking {pet}'s visit. Your spot isn't saved yet: finish here in a minute: {booking_url}",
  "Hey {client}, {business} here! Still want to get {pet} pampered? Pick a time that works for you: {booking_url} 🛁",
  "Hi {client}! Just checking in from {business}. Did something stop you from booking {pet}? You can finish here: {booking_url} or reply with a day that works.",
  "{client}, {pet} deserves a spa day! 🐶 Your booking with {business} is almost done. Grab a time here: {booking_url}",
  "Hi {client}, this is {business}. Our calendar fills up fast. Want us to hold a time for {pet}? Book here: {booking_url}",
  "Hello {client}! {business} here. Questions about prices or services for {pet}? Just reply to this text. Or finish booking anytime: {booking_url}",
  "Hi {client}! Friendly reminder from {business}: {pet}'s visit is only a few taps away 🐾 {booking_url}",
  "Hey {client}! We come to you, so {pet} stays relaxed at home 🚐 Finish booking with {business} here: {booking_url}",
  "Hi {client}, {business} here. If online booking was a hassle, no worries: reply with a day and time and we'll set it up for {pet}.",
  "{client}, {pet} is going to look (and smell) amazing ✨ Finish your booking with {business}: {booking_url}",
  "Hi {client}! We'd love to meet {pet}. Openings this week and next with {business}: {booking_url}",
  "Hey {client}, it's {business}. Busy day? Totally get it. Your info for {pet} is saved. Pick a time whenever you're ready: {booking_url}",
  "Hi {client}! Did the booking page give you any trouble? Let {business} know and we'll book {pet} for you. Or try again here: {booking_url}",
  "Hello {client} 🐾 Spots for {pet} are still open at {business}. Book now before they're gone: {booking_url}",
  "Hi {client}! A clean, happy pup is one tap away. Finish {pet}'s booking with {business}: {booking_url}",
  "Hey {client}, {business} here 👋 We noticed {pet}'s booking wasn't finished. Want help? Reply here, or book in a minute: {booking_url}",
  "Hi {client}! New times just opened up at {business}. Want one for {pet}? {booking_url}",
  "{client}, thanks for thinking of {business} for {pet}! Finish booking whenever it suits you: {booking_url}",
  "Hi {client}! No pressure: when {pet} is ready for a bath or a trim, {business} is here. Book here: {booking_url}",
  "Hey {client}! It's {business}. Your pup's spa day is waiting 🛁 Tap to finish booking {pet}: {booking_url}",
];

/** The menu label for a ready message: its first words. */
export const templateLabel = (text: string, n: number) => `${n}. ${text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text}`;

/**
 * One ready message per person, no repeats until all 20 are used (then the order starts over),
 * so a "send to all" never sends two people the same text when there are 20 or fewer.
 */
export function shuffledTemplates(count: number, rand: () => number = Math.random): string[] {
  const out: string[] = [];
  while (out.length < count) {
    const deck = [...ABANDONED_TEMPLATES];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    out.push(...deck);
  }
  return out.slice(0, count);
}
