const LEAKAGE_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
  /(\+?\d{1,3}[.\-\s]?)?\(?\d{3}\)?[.\-\s]?\d{3}[.\-\s]?\d{4}/,
  /(t\.me|telegram\.me|wa\.me|whatsapp\.com|paypal\.me)/i,
  /(zoom\.us|meet\.google\.com|skype:)/i,
];

export function detectContactLeakage(text: string): boolean {
  return LEAKAGE_PATTERNS.some((regex) => regex.test(text));
}

export const LEAKAGE_WARNING =
  "Keep payments and communication on the platform. Sharing contact details or " +
  "taking payments outside Microgig violates our Terms of Service and forfeits " +
  "your escrow protections.";
