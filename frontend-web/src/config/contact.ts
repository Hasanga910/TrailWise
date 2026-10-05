/**
 * Public contact details shown in the site footer and anywhere else visitors can reach TrailWise.
 *
 * TODO(before launch): these are placeholders. Replace them here and nowhere else.
 */

/** Support email address. */
export const CONTACT_EMAIL = 'support@trailwise.com';

/** Support phone number in international format, digits and a leading + only (used for the tel: link). */
export const CONTACT_PHONE = '+10000000000';

/** The same number as shown on screen. */
export const CONTACT_PHONE_DISPLAY = '+1 (000) 000-0000';

/** WhatsApp number in international format (digits and a leading + only). */
export const CONTACT_WHATSAPP = '+10000000000';

export const contactLinks = {
  email: `mailto:${CONTACT_EMAIL}`,
  phone: `tel:${CONTACT_PHONE}`,
  /** wa.me wants the number as digits only, without the +. */
  whatsapp: `https://wa.me/${CONTACT_WHATSAPP.replace(/\D/g, '')}`,
} as const;
