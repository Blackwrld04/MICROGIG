/**
 * Anti-disintermediation detection — MSG-03 / PRD §13.4. Warn only; never blocks.
 * Patterns are from the PRD but WITHOUT the /g flag: a global regex reused with
 * .test() keeps `lastIndex` state and silently misses every other message.
 */
const LEAKAGE_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i, // Emails
  /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/, // Phone numbers
  /(t\.me|telegram\.me|wa\.me|whatsapp\.com|paypal\.me)/i, // Messaging / payment apps
  /(zoom\.us|meet\.google\.com|skype:)/i, // External video calls
];

export function detectContactLeakage(text: string): boolean {
  return LEAKAGE_PATTERNS.some((regex) => regex.test(text));
}

export const LEAKAGE_WARNING =
  "Keep payments and communication on the platform. Warning: Sharing contact details or taking payments outside microgig violates our Terms of Service and forfeits your escrow protections.";
