/**
 * The events-webhook payload contract, for the app (plan 06-03, DEC-64).
 *
 * The schema lives in supabase/functions/_shared/webhook-contract.ts so the
 * Deno edge function and Jest share one definition; this file re-exports it.
 * It deliberately does NOT re-export the signature or handler modules: the
 * app has no reason to verify webhook signatures or run the handler.
 */
export {
  ERROR_CODE_PATTERN,
  PRODUCER_PATTERN,
  WEBHOOK_MESSAGES,
  WebhookEvent,
  WebhookRun,
  WebhookPayload,
  webhookEventErrors,
  webhookPayloadError,
} from "../../supabase/functions/_shared/webhook-contract";

export type {
  WebhookEventInput,
  WebhookEventOutput,
  WebhookPayloadInput,
  WebhookPayloadOutput,
  WebhookRunInput,
  WebhookRunOutput,
} from "../../supabase/functions/_shared/webhook-contract";
