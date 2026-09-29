import { z } from 'zod';

/** Provider query values remain strings or null; redirect safety and verified
 * identity are server decisions. The OTP marker alone never establishes trust. */
const optionalQueryText = z.string().optional().transform(value => value ?? null);
export const AuthCallbackQuery = z.object({
  code: optionalQueryText,
  next: optionalQueryText,
  error: optionalQueryText,
  error_description: optionalQueryText,
  verified: z.string().optional().transform(value => value === '1'),
});
