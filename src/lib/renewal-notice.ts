// The auto-renewal notice shown next to the pay button (plan page and test checkout). It agrees
// with the Terms: the yearly plan mentions the pro rata refund within 14 days of the charge.
type T = (s: string, vars?: Record<string, string | number>) => string;

export function renewalNotice(t: T, interval: "month" | "year", price: string) {
  return interval === "month"
    ? t("Renews automatically every month for {price} until you cancel. Cancel anytime in Plan; you keep access until the end of the paid period.", { price })
    : t("Renews automatically every year for {price} until you cancel. Cancel anytime in Plan; you keep access until the end of the paid period. Yearly plans can be refunded pro rata if you ask within 14 days of the charge.", { price });
}
