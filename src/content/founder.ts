/**
 * The founder story shown on the editorial About page (Task 7). Only
 * owner-supplied factual copy belongs here — never fabricated biography,
 * credentials or endorsements (Global Constraint: never fabricate founder
 * copy). `null` renders no founder section at all.
 */
export const FOUNDER_STORY: {
  heading: string;
  paragraphs: string[];
  link?: { label: string; href: string };
} | null = null;
