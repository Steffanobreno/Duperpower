// The company details the Terms, the Privacy Policy and the site footer show, in one place.
// The company isn't registered yet: the bracketed placeholders show as they are, so nobody
// forgets to fill them in (see pendencias.md). SUPPORT_EMAIL is the public contact address
// (the first one, if it lists several, as the help page's "Talk to a person" reads it).

export const LEGAL: {
  company: string; address: string; jurisdiction: string; supportEmail: string; termsVersion: string;
  /** The data protection officer or contact channel (LGPD encarregado / GDPR DPO), if one is needed. */
  dpo: string;
} = {
  company: "[NOME DA EMPRESA]",
  address: "[ENDEREÇO]",
  jurisdiction: "[FORO E LEI APLICÁVEL]",
  supportEmail: process.env.SUPPORT_EMAIL?.split(",")[0]?.trim() || "[E-MAIL DE SUPORTE]",
  /** The date of the current Terms and Privacy Policy ("Last updated"). */
  termsVersion: "2026-11-08",
  dpo: "[ENCARREGADO / DPO]",
};
