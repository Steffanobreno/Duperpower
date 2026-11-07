// "Send from my phone": opens WhatsApp or the Messages app on the groomer's own phone with the
// text already written. Pure links (no client state), so server components can use it too.

export const whatsappHref = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;

export const smsHref = (phone: string, text: string) => `sms:${phone}?&body=${encodeURIComponent(text)}`;

/** Two links, WhatsApp and text message. `className` is added to each. Renders nothing without a phone. */
export function SendFromPhone({ phone, text, smsAllowed = true, className = "", t }: {
  phone: string | null;
  text: string;
  smsAllowed?: boolean;
  className?: string;
  t: (s: string) => string;
}) {
  if (!phone) return null;
  return (
    <>
      {smsAllowed && (
        <a href={smsHref(phone, text)} className={`rounded-full border-2 border-brand py-2.5 text-center text-brand ${className}`.trim()}>
          {t("Text message")}
        </a>
      )}
      <a href={whatsappHref(phone, text)} target="_blank" rel="noreferrer"
        className={`rounded-full border-2 border-[#13703a] py-2.5 text-center text-[#13703a] ${className}`.trim()}>
        {t("WhatsApp")}
      </a>
    </>
  );
}
