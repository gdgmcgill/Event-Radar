# Runbook: McGill Instagram ingestion

Status: operator-run, local stack only (M3). A hosted schedule is an M4 decision.

## Who

- **Operator:** Ady.
- **Backup operator:** to be named by the owner.

## What it does

```
Apify instagram-profile-scraper  →  scripts/ingest/instagram.ts (classify, sign)
  →  events-webhook (HMAC over the raw body)  →  public.events (status pending)
  →  /moderation/pending (a person approves)  →  /discover
```

Every event arrives as `pending`. Nothing reaches students until a moderator approves it. Each signed
request is also recorded in `public.ingestion_deliveries` (counts, run id and a short error code only).

## Prerequisites

- Node 24, `npm ci`, Docker, the Supabase CLI (`supabase start` running, seed loaded with
  `npx tsx scripts/seed/load.ts`).
- `APIFY_API_TOKEN` in the environment or in `.env`. The producer reads only that key from `.env`
  (through `dotenv.parse`) and never prints it.
- No `WEBHOOK_SECRET` setup is needed locally: `run-local.ts` generates a random one per run.

## Run it locally

```bash
npx tsx scripts/ingest/run-local.ts --handles mcgillhacks,mcgillwics,mcgillesports --days 45
```

- `--handles` is required, at most 10 Instagram usernames per run (Apify bills per profile).
- `--days` (default 14, at most 60) is the post window.
- `--dry-run` classifies and prints counts without sending anything to the webhook. **It still calls
  (and bills) Apify** for every handle unless `--fixture` is also given.
- `--fixture src/lib/ingest/__fixtures__/apify-profiles.json` skips Apify (synthetic data). Use
  `--dry-run --fixture …` for a free check of the classifier.

`run-local.ts` refuses anything but the local stack, serves `events-webhook` with the random secret,
waits until the function answers, runs the producer, and stops the function afterwards.

The output is counts and HTTP statuses only, one line per batch of 25 and a final summary. It never
prints captions, tokens or payloads, so it is safe to keep as evidence.

The producer itself (`scripts/ingest/instagram.ts`) refuses a webhook URL that is not `127.0.0.1` or
`localhost` unless `INGEST_ALLOW_REMOTE_TARGET=I_UNDERSTAND_THIS_WRITES_TO_A_REMOTE_PROJECT`. Do not set
that without the owner.

## Replay is safe

Rerunning the same command inserts nothing new: the webhook dedupes on `content_hash` (title, date,
organizer), reports each event as `duplicate`, and records the delivery as `duplicate`. The producer
treats an all-duplicate batch as delivered and exits 0. Batches are retried at most three times on a
network error or 5xx (1 s, 2 s, 4 s) for the same reason.

## Diagnosing a failure

Open `/moderation/ingestion` (admins), or read `checks.webhook` in the admin `/api/health` report.

| Delivery outcome | Meaning |
|---|---|
| `succeeded` | Every event in the batch was inserted as pending |
| `partial` | Some inserted; the rest were duplicates or failed |
| `duplicate` | Nothing new: every event was already stored (a replay) |
| `heartbeat` | The producer ran fine and found no events to send |
| `failed` | The producer reported a failed run, or no event could be stored |
| `rejected` | The payload was malformed (bad JSON, envelope or events) |

| Error code | Where to look |
|---|---|
| `apify_http_401` / `apify_http_403` | The Apify token is wrong or expired |
| `apify_http_402` / `apify_http_429` | Apify credit or rate limit |
| `apify_timeout` | Apify took over 300 s; try fewer handles |
| `apify_network` / `apify_bad_response` | Network trouble or an unexpected Apify answer; retry later |
| `invalid_json` / `invalid_envelope` / `invalid_events` | A producer bug: the payload broke the contract |
| `insert_failed` | A database write failed; check the local stack |
| `internal_error` | The function threw; see below: `run-local.ts` discards the function's output |

Unsigned or wrongly signed requests are never recorded; the producer reports them as `status=401`.

**Seeing the function's output (`internal_error`).** `run-local.ts` starts `supabase functions serve`
itself and discards its output, so a thrown error is visible only as the code. To see it:

1. Write a private env file with a random secret, for example
   `umask 077; printf 'WEBHOOK_SECRET=%s\n' "$(openssl rand -hex 32)" > /tmp/edge.env`.
2. In one terminal, run
   `supabase functions serve events-webhook --env-file /tmp/edge.env --no-verify-jwt` and watch its
   output.
3. In another terminal, export the same `WEBHOOK_SECRET`. Run the producer directly against the served
   function, preferably with a fixture:
   `npx tsx scripts/ingest/instagram.ts --handles … --fixture … --webhook-url http://127.0.0.1:54321/functions/v1/events-webhook`.
4. Delete the env file afterwards. Never paste the secret or the function's payload output into
   evidence.

"No successful ingestion in the last 48 hours" on `/moderation/ingestion` means no `succeeded`,
`partial`, `duplicate` or `heartbeat` delivery arrived in that time: run the producer.

## Images and expiry

Instagram CDN image URLs expire within days. On `/moderation/ingestion`, **Persist images** copies up
to 10 still-remote images (newest first) into the public `event-images` bucket at
`ingest/<event id>.<ext>` and points the event at the copy. The fetch accepts only `https` URLs on
`*.cdninstagram.com` or `*.fbcdn.net`, refuses any private or reserved address on every redirect hop,
follows at most 3 redirects, and stops at 5 MB or 10 s per image (DNS lookup included); the bytes
must be a JPEG, PNG, WEBP or GIF. The route declares `maxDuration = 60`. Ten images that each hit the
10 s timeout would still exceed that, so a hosted schedule needs a batch time budget first (M4).
An image already gone (403, 404, 410) is cleared so the placeholder renders; other failures leave the
event unchanged for the next attempt. Run it soon after ingesting.

## The stale queue

Pending Review hides events whose date has passed. `/moderation/ingestion` lists every pending event
created more than 72 hours ago or already past its start, oldest first.

- "Past" follows the legacy wall-clock convention: a stored start is Toronto time labelled UTC. The
  server decides it (see [time-semantics.md](../time-semantics.md)).
- Upcoming items get **Review**, which links to Pending Review.
- Past items get only **Reject as expired**: a normal moderation rejection with category "Incorrect
  details". Pending Review hides past items, so they have no Review link.

Pending Review shows a banner linking there whenever such events exist.

## Never

- Run against production, or set `INGEST_ALLOW_REMOTE_TARGET`, without the owner.
- Print, log, paste or commit a token or secret, or a payload with captions.
- Bypass moderation by inserting `approved` rows, or approve ingested events in bulk without reading
  them.
- Delete accounts or events to "clean up" a run; reject through moderation instead.

## History

`LAST_SCRAPE.md` keeps the log of the 2026 manual scrapes that preceded this producer.
