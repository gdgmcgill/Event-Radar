// @ts-nocheck
/**
 * POST /functions/v1/events-webhook
 * Webhook endpoint for receiving events from external resources.
 *
 * A thin Deno adapter since plan 06-03: it reads the environment, creates the
 * service-role client, and hands every request to handleWebhook in
 * ../_shared/webhook-handler.ts with the insert injected. The request logic
 * (CORS, the HMAC over the raw body with its three accepted headers, payload
 * validation through the shared zod contract, content_hash dedupe and the
 * 200/207/400/500 rules) lives there and is proven under Jest by
 * src/__tests__/webhook/webhook-handler.test.ts.
 *
 * The behaviour changes only when the owner redeploys this function (DI-81).
 */

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

import { handleWebhook } from "../_shared/webhook-handler.ts";

Deno.serve((req) => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SUPABASE_SERVICE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Created on the first insert, as the handler did before (after every
  // check had passed), and reused for the rest of the request.
  let supabase = null;

  return handleWebhook(req, {
    secret: webhookSecret,
    configured: Boolean(supabaseUrl && supabaseServiceKey && webhookSecret),
    insertEvent: async (row) => {
      // Service role key: bypasses RLS. Rows are always status "pending".
      supabase ??= createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const { data, error } = await supabase
        .from("events")
        .insert(row)
        .select()
        .single();
      return { data, error };
    },
    // M3 P1-07: one delivery row per signed request, same service-role client.
    recordDelivery: async (row) => {
      supabase ??= createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      const { error } = await supabase.from("ingestion_deliveries").insert(row);
      return { error };
    },
  });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Set environment variables:
     export WEBHOOK_SECRET=your-secret-key
  3. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/events-webhook' \
    --header 'Content-Type: application/json' \
    --header 'x-signature: <computed-hmac-signature>' \
    --data '{
      "event_count": 1,
      "events": [{
        "title": "Test Event",
        "description": "Test Description",
        "category": "workshop",
        "date": "2024-12-31",
        "time": "14:00",
        "location": "Test Location",
        "organizer": "Test Organizer"
      }]
    }'

  Sending the same signed body twice now reports each event as "duplicate"
  the second time (content_hash, plan 06-03).

*/
