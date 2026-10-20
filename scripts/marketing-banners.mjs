// Draws the holiday pictures used by the marketing templates (public/marketing/<key>.jpg).
// Everything is drawn here with shapes, so the pictures are ours to use.
// Needs the free fonts Pacifico and Fredoka (OFL) from @fontsource, installed anywhere:
//   npm install --prefix /tmp/fonts @fontsource/pacifico@5 @fontsource/fredoka@5
//   node scripts/marketing-banners.mjs /tmp/fonts/node_modules
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const FONTS = process.argv[2];
if (!FONTS) throw new Error("Usage: node scripts/marketing-banners.mjs <node_modules with @fontsource fonts>");
const OUT = "public/marketing";
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- shapes (100×100 boxes)
const star = (fill, points = 5) => {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? 20 : 48;
    const a = (Math.PI / points) * i - Math.PI / 2;
    pts.push(`${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`);
  }
  return `<polygon points="${pts.join(" ")}" fill="${fill}"/>`;
};
const heart = (fill) => `<path d="M50 90C18 66 4 46 14 28 24 10 44 14 50 30 56 14 76 10 86 28 96 46 82 66 50 90Z" fill="${fill}"/>`;
const paw = (fill) => `<g fill="${fill}"><ellipse cx="50" cy="66" rx="22" ry="19"/><ellipse cx="24" cy="40" rx="9" ry="12"/><ellipse cx="41" cy="24" rx="9" ry="12"/><ellipse cx="59" cy="24" rx="9" ry="12"/><ellipse cx="76" cy="40" rx="9" ry="12"/></g>`;
const bone = (fill) => `<g fill="${fill}" transform="rotate(-30 50 50)"><rect x="22" y="42" width="56" height="16" rx="6"/><circle cx="22" cy="40" r="10"/><circle cx="22" cy="60" r="10"/><circle cx="78" cy="40" r="10"/><circle cx="78" cy="60" r="10"/></g>`;
const snowflake = (stroke) => `<g stroke="${stroke}" stroke-width="5" stroke-linecap="round" fill="none">${[0, 60, 120].map((r) => `<g transform="rotate(${r} 50 50)"><path d="M50 8V92"/><path d="M50 24 40 14M50 24 60 14M50 76 40 86M50 76 60 86"/></g>`).join("")}</g>`;
const shamrock = (fill) => `<g fill="${fill}">${[0, 120, 240].map((r) => `<g transform="rotate(${r} 50 50)"><path d="M50 50C34 40 30 18 42 13 48 11 50 18 50 22 50 18 52 11 58 13 70 18 66 40 50 50Z"/></g>`).join("")}<path d="M50 50Q58 72 70 90" stroke="${fill}" stroke-width="6" fill="none" stroke-linecap="round"/></g>`;
const flower = (petal, center) => `<g>${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="50" cy="26" rx="15" ry="22" fill="${petal}" transform="rotate(${r} 50 50)"/>`).join("")}<circle cx="50" cy="50" r="13" fill="${center}"/></g>`;
const egg = (fill, stripe) => `<g><ellipse cx="50" cy="54" rx="32" ry="42" fill="${fill}"/><path d="M20 46 30 38 40 46 50 38 60 46 70 38 80 46" stroke="${stripe}" stroke-width="6" fill="none" stroke-linejoin="round"/><path d="M19 64H81" stroke="${stripe}" stroke-width="6"/><circle cx="38" cy="78" r="4" fill="${stripe}"/><circle cx="62" cy="78" r="4" fill="${stripe}"/><circle cx="50" cy="22" r="4" fill="${stripe}"/></g>`;
const pumpkin = (face = true) => `<g><path d="M50 22C52 12 58 8 64 8" stroke="#3f7d2a" stroke-width="7" fill="none" stroke-linecap="round"/><ellipse cx="30" cy="58" rx="24" ry="32" fill="#e86f10"/><ellipse cx="70" cy="58" rx="24" ry="32" fill="#e86f10"/><ellipse cx="50" cy="58" rx="24" ry="34" fill="#f5891f"/>${face ? '<path d="M36 50 44 44 46 54ZM64 50 56 44 54 54Z" fill="#3b1d06"/><path d="M32 66Q50 84 68 66L62 70 56 64 50 72 44 64 38 70Z" fill="#3b1d06"/>' : ""}</g>`;
const ghost = () => `<g><path d="M22 90V44a28 28 0 0 1 56 0v46l-9-8-9 8-10-8-10 8-9-8Z" fill="#ffffff"/><circle cx="40" cy="46" r="5" fill="#2b2140"/><circle cx="60" cy="46" r="5" fill="#2b2140"/><ellipse cx="50" cy="62" rx="6" ry="8" fill="#2b2140"/></g>`;
const leaf = (fill) => `<g transform="rotate(25 50 50)"><path d="M50 6C78 24 82 60 50 94 18 60 22 24 50 6Z" fill="${fill}"/><path d="M50 14V94M50 40 34 28M50 40 66 28M50 60 30 46M50 60 70 46" stroke="#00000033" stroke-width="3" fill="none"/></g>`;
const acorn = () => `<g><ellipse cx="50" cy="62" rx="24" ry="28" fill="#b9772b"/><path d="M22 46Q50 18 78 46Q50 54 22 46Z" fill="#6b4318"/><path d="M50 26V14" stroke="#6b4318" stroke-width="6" stroke-linecap="round"/></g>`;
const tree = () => `<g><rect x="44" y="80" width="12" height="14" fill="#7a4a1d"/><polygon points="50,6 80,44 64,44 88,80 12,80 36,44 20,44" fill="#1f8a3b"/><circle cx="38" cy="58" r="5" fill="#ffd34d"/><circle cx="60" cy="40" r="5" fill="#ff5a5a"/><circle cx="64" cy="66" r="5" fill="#ffffff"/><circle cx="46" cy="32" r="4" fill="#ffffff"/>${star("#ffd34d").replace("<polygon", '<polygon transform="translate(38 -6) scale(.24)"')}</g>`;
const gift = (box, ribbon) => `<g><rect x="16" y="40" width="68" height="52" rx="4" fill="${box}"/><rect x="10" y="28" width="80" height="16" rx="4" fill="${box}"/><rect x="44" y="28" width="12" height="64" fill="${ribbon}"/><path d="M50 28C38 10 22 16 30 26ZM50 28C62 10 78 16 70 26Z" fill="${ribbon}"/></g>`;
const firework = (c1, c2) => `<g stroke-linecap="round">${Array.from({ length: 12 }, (_, i) => `<path d="M50 50L${50 + 44 * Math.cos((i * Math.PI) / 6)} ${50 + 44 * Math.sin((i * Math.PI) / 6)}" stroke="${i % 2 ? c1 : c2}" stroke-width="5"/>`).join("")}<circle cx="50" cy="50" r="7" fill="${c2}"/></g>`;
const sun = () => `<g><g stroke="#ffcf3f" stroke-width="7" stroke-linecap="round">${Array.from({ length: 10 }, (_, i) => `<path d="M${50 + 32 * Math.cos((i * Math.PI) / 5)} ${50 + 32 * Math.sin((i * Math.PI) / 5)}L${50 + 46 * Math.cos((i * Math.PI) / 5)} ${50 + 46 * Math.sin((i * Math.PI) / 5)}"/>`).join("")}</g><circle cx="50" cy="50" r="24" fill="#ffd84f"/></g>`;
const confetti = (colors) => colors.map((c, i) => `<rect x="${10 + ((i * 37) % 80)}" y="${10 + ((i * 53) % 80)}" width="12" height="6" rx="2" fill="${c}" transform="rotate(${i * 47} ${16 + ((i * 37) % 80)} ${13 + ((i * 53) % 80)})"/>`).join("");
const dog = (fur, ear) => `<g><path d="M22 30C10 30 6 52 12 66 16 74 24 70 26 60Z" fill="${ear}"/><path d="M78 30C90 30 94 52 88 66 84 74 76 70 74 60Z" fill="${ear}"/><ellipse cx="50" cy="52" rx="30" ry="32" fill="${fur}"/><ellipse cx="50" cy="68" rx="17" ry="13" fill="#fff6e8"/><circle cx="39" cy="46" r="5" fill="#2b1d10"/><circle cx="61" cy="46" r="5" fill="#2b1d10"/><circle cx="40.5" cy="44.5" r="1.6" fill="#fff"/><circle cx="62.5" cy="44.5" r="1.6" fill="#fff"/><ellipse cx="50" cy="61" rx="7" ry="5" fill="#2b1d10"/><path d="M50 66V72M42 74Q50 80 58 74" stroke="#2b1d10" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M46 78Q50 88 54 78Z" fill="#ff7d8f"/></g>`;
const hat = (fill) => `<g><polygon points="30,70 50,8 70,70" fill="${fill}"/><circle cx="50" cy="8" r="7" fill="#ffffff"/><rect x="26" y="66" width="48" height="10" rx="5" fill="#ffffff"/></g>`;

const svg = (inner, size, x, y, rot = 0, opacity = 1) =>
  `<svg viewBox="0 0 100 100" width="${size}" height="${size}" style="position:absolute;left:${x}px;top:${y}px;transform:rotate(${rot}deg);opacity:${opacity}">${inner}</svg>`;

// Little shapes scattered around the edges, the same every run.
function scatter(shapes, n, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const out = [];
  for (let i = 0; i < n; i++) {
    let x, y;
    do {
      x = rnd() * 1160 - 20;
      y = rnd() * 440 - 20;
    } while (x > 10 && x < 790 && y > 40 && y < 420); // keep the words readable
    out.push(svg(shapes[i % shapes.length], 34 + rnd() * 46, x, y, rnd() * 60 - 30, 0.55 + rnd() * 0.45));
  }
  return out.join("");
}

// ---------------------------------------------------------------- the pictures
const B = [
  { key: "we-miss-you", bg: "linear-gradient(120deg,#0a84cc,#36b3f0)", title: "We miss you!", sub: "Your pup's spa day is waiting", ink: "#ffffff",
    hero: [svg(dog("#d99a4e", "#a8692c"), 330, 790, 70)], bits: [paw("#ffffff"), bone("#ffe08a"), heart("#ff8fab")] },
  { key: "new-year", bg: "linear-gradient(120deg,#132039,#3a2a6b)", title: "Happy New Year", sub: "Fresh year, fresh look", ink: "#ffd34d",
    hero: [svg(firework("#ffd34d", "#ffffff"), 260, 820, 40), svg(firework("#ff7eb6", "#7ee0ff"), 180, 980, 240), svg(hat("#ff5a8a"), 150, 760, 260, -15)], bits: [star("#ffd34d"), confetti(["#ffd34d", "#ff7eb6", "#7ee0ff", "#ffffff"])] },
  { key: "valentines", bg: "linear-gradient(120deg,#ff5d8f,#ff9fbf)", title: "Happy Valentine's", sub: "Show your pup some love", ink: "#ffffff",
    hero: [svg(heart("#e8124f"), 300, 800, 70, -8), svg(heart("#ffffff"), 140, 1020, 40, 14), svg(paw("#ffffff"), 110, 760, 300, -20)], bits: [heart("#ffffff"), heart("#c80e46"), paw("#ffe0ea")] },
  { key: "st-patricks", bg: "linear-gradient(120deg,#118a3e,#4cc36c)", title: "Happy St. Patrick's", sub: "We're lucky to have you", ink: "#ffffff",
    hero: [svg(shamrock("#0b6b2e"), 300, 820, 60, 10), svg(shamrock("#bdf5c9"), 150, 1010, 280, -18)], bits: [shamrock("#ffffff"), star("#ffd34d"), paw("#c9f7d4")] },
  { key: "spring", bg: "linear-gradient(120deg,#ffb3c7,#ffe2a8)", title: "Spring is here!", sub: "Time for a fresh groom", ink: "#7a2e4a",
    hero: [svg(flower("#ff6f9a", "#ffd34d"), 230, 800, 50), svg(flower("#ffffff", "#ff9f43"), 170, 1000, 220), svg(flower("#b38cff", "#ffe066"), 140, 780, 290)], bits: [flower("#ffffff", "#ffd34d"), leaf("#69c06b"), paw("#ffffff")] },
  { key: "easter", bg: "linear-gradient(120deg,#9fd8ff,#d8c4ff)", title: "Happy Easter", sub: "Hop in for a fresh look", ink: "#3b2a7a",
    hero: [svg(egg("#ffd166", "#ff6f9a"), 220, 800, 90, -12), svg(egg("#7ee0b3", "#ffffff"), 180, 980, 160, 14), svg(egg("#ff9fbf", "#7a5cff"), 140, 900, 300, 4)], bits: [flower("#ffffff", "#ffd34d"), egg("#fff4b8", "#ff9fbf"), paw("#ffffff")] },
  { key: "mothers-day", bg: "linear-gradient(120deg,#c65fbf,#ff9fb5)", title: "Happy Mother's Day", sub: "To every dog mom", ink: "#ffffff",
    hero: [svg(flower("#ffffff", "#ffd34d"), 220, 830, 60), svg(flower("#ffd1e6", "#ff7aa8"), 160, 1010, 230), svg(heart("#ffffff"), 120, 780, 300, -12)], bits: [heart("#ffe0ef"), flower("#ffffff", "#ff7aa8"), paw("#ffffff")] },
  { key: "summer", bg: "linear-gradient(120deg,#00a6d6,#64e0d0)", title: "Hello, summer!", sub: "Stay cool with a fresh cut", ink: "#ffffff",
    hero: [svg(sun(), 280, 840, 40), svg(dog("#f2c48d", "#c98c4a"), 200, 760, 250)], bits: [sun(), paw("#ffffff"), bone("#fff1a8")] },
  { key: "fathers-day", bg: "linear-gradient(120deg,#1e4f91,#3d8bd9)", title: "Happy Father's Day", sub: "Here's to the dog dads", ink: "#ffffff",
    hero: [svg(dog("#8a5a33", "#5a3a20"), 300, 810, 80), svg(bone("#ffd34d"), 140, 1030, 40, 20)], bits: [bone("#ffffff"), paw("#bcd9ff"), star("#ffd34d")] },
  { key: "july-4th", bg: "linear-gradient(120deg,#0d2a6b,#1f4fae)", title: "Happy 4th of July", sub: "Keep your pup safe and calm", ink: "#ffffff",
    hero: [svg(firework("#ff3b4d", "#ffffff"), 260, 810, 30), svg(firework("#ffffff", "#5ab0ff"), 200, 1000, 210), svg(star("#ff3b4d"), 130, 780, 300, 10)], bits: [star("#ffffff"), star("#ff3b4d"), paw("#bcd9ff")] },
  { key: "dog-day", bg: "linear-gradient(120deg,#ff9f1c,#ffcf5c)", title: "National Dog Day", sub: "Celebrating our best friends", ink: "#5a2d00",
    hero: [svg(dog("#ffffff", "#e3b98a"), 300, 800, 70), svg(heart("#ff5a5f"), 110, 1050, 60, 15)], bits: [paw("#ffffff"), bone("#ffffff"), heart("#ff5a5f")] },
  { key: "fall", bg: "linear-gradient(120deg,#c2571a,#f2a03d)", title: "Hello, fall!", sub: "Cozy season grooming", ink: "#ffffff",
    hero: [svg(leaf("#ffd34d"), 230, 820, 50, -20), svg(leaf("#e04a1f"), 180, 990, 200, 30), svg(acorn(), 130, 790, 300, -10)], bits: [leaf("#ffe08a"), leaf("#a8321a"), acorn()] },
  { key: "halloween", bg: "linear-gradient(120deg,#4b2a8a,#8a4fd6)", title: "Happy Halloween", sub: "No tricks, just treats", ink: "#ffffff",
    hero: [svg(pumpkin(), 300, 810, 110), svg(ghost(), 150, 1020, 20, 10)], bits: [star("#ffd34d"), ghost(), paw("#d9c4ff")] },
  { key: "thanksgiving", bg: "linear-gradient(120deg,#b4521c,#e8892b)", title: "Happy Thanksgiving", sub: "Thankful for you", ink: "#ffffff",
    hero: [svg(pumpkin(false), 220, 830, 160), svg(leaf("#ffd34d"), 180, 1000, 30, 25), svg(acorn(), 140, 800, 40, -12)], bits: [leaf("#ffe08a"), leaf("#8a2f12"), acorn()] },
  { key: "holidays", bg: "linear-gradient(120deg,#d62b2b,#ff5a4a)", title: "Happy Holidays", sub: "Holiday-ready pups", ink: "#ffffff",
    hero: [svg(tree(), 300, 810, 70), svg(gift("#1f8a3b", "#ffd34d"), 150, 1030, 270, 6)], bits: [snowflake("#ffffff"), star("#ffd34d"), gift("#ffffff", "#1f8a3b")] },
];

const font = (file) => `url(data:font/woff2;base64,${readFileSync(`${FONTS}/@fontsource/${file}`).toString("base64")})`;
const css = `
@font-face { font-family: Pacifico; src: ${font("pacifico/files/pacifico-latin-400-normal.woff2")}; }
@font-face { font-family: Fredoka; font-weight: 600; src: ${font("fredoka/files/fredoka-latin-600-normal.woff2")}; }
* { margin: 0; box-sizing: border-box; }
.b { position: relative; width: 1200px; height: 480px; overflow: hidden; border-radius: 0; }
.t { position: absolute; left: 90px; top: 120px; width: 700px; }
h1 { font: 92px/1.12 Pacifico; text-shadow: 0 6px 0 rgba(0,0,0,.14); }
p { margin-top: 18px; font: 600 38px Fredoka; opacity: .95; }`;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 480 } });
for (const [i, b] of B.entries()) {
  await page.setContent(`<style>${css}</style><div class="b" style="background:${b.bg};color:${b.ink}">
    ${scatter(b.bits, 16, 7 + i * 13)}${b.hero.join("")}
    <div class="t"><h1>${b.title}</h1><p>${b.sub}</p></div></div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".b").screenshot({ path: `${OUT}/${b.key}.jpg`, type: "jpeg", quality: 82 });
  console.log(`✓ ${b.key}`);
}
await browser.close();
