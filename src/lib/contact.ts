export const CONTACT = {
  instagramHandle: "@trevor_mukisa_",
  instagramUrl: "https://instagram.com/trevor_mukisa_",
  email: "trevormukisa185@gmail.com",
  emailHref: "mailto:trevormukisa185@gmail.com",
  phoneDisplay: "+256 743274325",
  phoneHref: "tel:+256743274325",
  whatsappUrl: "https://wa.me/256743274325",
  owner: "Trevor Mukisa",
} as const;

export function whatsappMessageHref(message: string) {
  return `${CONTACT.whatsappUrl}?text=${encodeURIComponent(message)}`;
}

export function emailMessageHref(subject: string, body: string) {
  return `mailto:${CONTACT.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const NOT_AFFILIATED_NOTICE =
  "VORTEX TERMINAL is an independent interface for the Deriv WebSocket API. It is not affiliated with, endorsed by, or operated by Deriv unless officially registered as a Deriv partner.";
