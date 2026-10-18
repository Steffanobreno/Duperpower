// Creates the Woofers Dog Spa business with its services, hours and SMS texts.
// Safe to run more than once: it does nothing if a business already exists.
// Usage: npm run db:seed
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const sql = postgres(url, { max: 1, onnotice: () => {} });

type Size = "small" | "medium" | "large" | "xlarge";
const SIZE_LABEL: Record<Size, string> = {
  small: 'Small (12" or less)',
  medium: 'Medium (12"-16")',
  large: 'Large (16"-20")',
  xlarge: 'X-Large (20" or up)',
};

const haircut: [Size, number, number][] = [
  ["small", 120, 12900],
  ["medium", 120, 14900],
  ["large", 120, 17900],
  ["xlarge", 180, 19900],
];
const bath: [Size, number, number][] = [
  ["small", 120, 9900],
  ["medium", 120, 10900],
  ["large", 120, 12900],
  ["xlarge", 120, 14900],
];
const addons: [string, number, number][] = [
  ["Nail trim (included in every package)", 0, 0],
  ["Dematting or shave-down fee", 0, 4500],
  ["De-shedding", 0, 4500],
  ["Nail painting", 0, 1500],
  ["Sensitive care shampoo", 0, 2000],
  ["Flea treatment bath", 0, 2000],
  ["Hypoallergenic fragrance-free shampoo", 0, 1500],
  ["Skunk odor removal", 180, 28000],
];

// The owner's own message texts. Variables in {braces} are filled in when sending.
const templates = [
  { trigger: "booked", body: "From {business}, {client}, your appointment is booked for {date} {time}." },
  {
    trigger: "reminder",
    offset_days: 2,
    send_at_time: "10:00",
    only_if_unconfirmed: true,
    body: "From {business}, {client}, your next appointment is coming up on {date} {time}. Reply Y to confirm or N to cancel.",
  },
  { trigger: "confirmed", body: "Thank you, {client}! Your appointment on {date} {time} is confirmed." },
  { trigger: "cancelled", body: "{client}, your appointment on {date} {time} has been cancelled. Text us anytime to book again." },
  { trigger: "on_my_way", body: "Hi {client}! {business} is on the way, arriving around {eta}." },
  {
    trigger: "rebook",
    offset_days: 0,
    send_at_time: "10:00",
    body: "From {business}, Hello {client}, it has been almost {days} days since {pet} last service. Would you like to book a new appointment? Book online: {booking_url} or text us {business_phone}",
  },
  {
    trigger: "review_request",
    offset_minutes: 30,
    body: "Hi! 😊🐾 It was a pleasure taking care of your pet today! We hope you loved your experience with {business}. If you have a moment, your review truly means a lot to us 💙 👉 Leave your review here: https://g.page/r/CQs7lH-SjO5jEAE/review Thank you so much for your trust, and we hope to see you again soon! 🚐✨",
  },
  {
    trigger: "feedback_positive",
    body: "We are so excited that you liked our service! It would be great if you could share your experience on Yelp, Facebook or Google.",
  },
  {
    trigger: "feedback_negative",
    body: "We are sorry that you are not 100% happy with us! Please let us know anything we could improve so we can do much better next time. Thank you!",
  },
];

async function main() {
  const [existing] = await sql`select id from businesses limit 1`;
  if (existing) {
    console.log("business already exists, nothing to seed");
    return sql.end();
  }

  await sql.begin(async (tx) => {
    const [biz] = await tx`
      insert into businesses (name, phone, booking_slug)
      values ('Woofers Dog Spa', '+16506276745', 'woofers')
      returning id`;
    const [staff] = await tx`
      insert into staff (business_id, name, role, color)
      values (${biz.id}, 'Steffano', 'owner', '#1d6fb8')
      returning id`;

    // Monday-Saturday 7am-7pm, Sunday off.
    for (const weekday of [1, 2, 3, 4, 5, 6]) {
      await tx`insert into working_hours (staff_id, weekday, start_time, end_time)
               values (${staff.id}, ${weekday}, '07:00', '19:00')`;
    }

    let order = 0;
    for (const [size, min, cents] of haircut) {
      await tx`insert into services (business_id, name, kind, category, size_class, duration_min, price_cents, sort_order)
               values (${biz.id}, ${"Full Haircut - " + SIZE_LABEL[size]}, 'service', 'Haircut + Bath', ${size}, ${min}, ${cents}, ${order++})`;
    }
    for (const [size, min, cents] of bath) {
      await tx`insert into services (business_id, name, kind, category, size_class, duration_min, price_cents, sort_order)
               values (${biz.id}, ${"Bath - " + SIZE_LABEL[size]}, 'service', 'Bath', ${size}, ${min}, ${cents}, ${order++})`;
    }
    for (const [name, min, cents] of addons) {
      await tx`insert into services (business_id, name, kind, category, duration_min, price_cents, sort_order)
               values (${biz.id}, ${name}, 'addon', 'Add-on', ${min}, ${cents}, ${order++})`;
    }

    for (const t of templates) {
      await tx`insert into message_templates (business_id, trigger, body, offset_days, offset_minutes, send_at_time, only_if_unconfirmed)
               values (${biz.id}, ${t.trigger}, ${t.body}, ${t.offset_days ?? null}, ${t.offset_minutes ?? null},
                       ${t.send_at_time ?? null}, ${t.only_if_unconfirmed ?? false})`;
    }
  });
  console.log("seeded Woofers Dog Spa");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
