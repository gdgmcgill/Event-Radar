export const CONTACT_EMAILS = {
  owner: "adyan@universeapp.ca",
  inquiries: "inquiries@universeapp.ca",
  support: "support@universeapp.ca",
  hello: "hello@universeapp.ca",
} as const;

export const CONTACT_LINKS = {
  supportMailto: `mailto:${CONTACT_EMAILS.support}`,
  inquiriesMailto: `mailto:${CONTACT_EMAILS.inquiries}`,
  helloMailto: `mailto:${CONTACT_EMAILS.hello}`,
} as const;
