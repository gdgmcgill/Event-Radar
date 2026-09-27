/// <reference lib="deno.ns" />

/**
 * Tests for the events-webhook Edge Function
 * 
 * First need to serve the functions locally with .env.test `npx supabase functions serve --env-file .env.example`
 * also ensure that your db is up to date with any schema changes that you are testing
 * Run with: deno test --allow-net --allow-env --allow-read supabase/functions/tests/webhook.test.ts --env-file=supabase/functions/.env.example
 * 
 * 
 * Prerequisites:
 * 1. Local Supabase instance must be running: `supabase start`
 * 2. Database must have the required tables (events)
 * 3. Load .env.test file before running tests
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import crypto from "node:crypto";

// Never load .env.test: a stale hosted URL would make cleanup destructive.
// scripts/test-edge-local.ts injects credentials read from the local CLI only.
const testUrl = new URL(Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321");
if (!["localhost", "127.0.0.1"].includes(testUrl.hostname) || testUrl.port !== "54321") {
  throw new Error("REFUSED: webhook tests only support local Supabase on port 54321");
}
if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || !Deno.env.get("WEBHOOK_SECRET")) {
  throw new Error("Run with: npx tsx scripts/test-edge-local.ts");
}

// Helper function to compute HMAC SHA-256 signature
function computeHMAC(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

// Helper function to create a test request
function createRequest(
  payload: unknown,
  signature?: string,
  headerName: string = "x-signature"
): Request {
  const body = JSON.stringify(payload);
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (signature) {
    headers[headerName] = signature;
  }

  return new Request(`${testUrl.origin}/functions/v1/events-webhook`, {
    method: "POST",
    headers,
    body,
  });
}

// Helper to clean up test data by organizer name
async function cleanupTestData(organizerName: string) {
  if (!organizerName) return;
  
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  // Delete test events by organizer
  const response = await fetch(
    `${supabaseUrl}/rest/v1/events?organizer=eq.${encodeURIComponent(organizerName)}`,
    {
      method: "DELETE",
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
    }
  );
  
  // Consume response body to prevent leak detection
  if (!response.bodyUsed) {
    await response.body?.cancel();
  }
}

Deno.test("CORS preflight request", async () => {
  const request = new Request(`${testUrl.origin}/functions/v1/events-webhook`, {
    method: "OPTIONS",
  });

  const response = await fetch(request);
  assertEquals(response.status, 204);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  
  // Consume response body (OPTIONS requests typically have no body, but ensure it's consumed)
  if (!response.bodyUsed) {
    await response.body?.cancel();
  }
});

Deno.test("Missing signature header returns 401", async () => {
  const payload = {
    event_count: 1,
    events: [{
      title: "Test Event",
      description: "Test Description",
      category: "workshop",
      date: "2024-12-31",
      location: "Test Location",
      organizer: "Test Organizer",
    }],
  };

  const request = createRequest(payload); // No signature
  const response = await fetch(request);
  
  assertEquals(response.status, 401);
  const body = await response.json();
  assertEquals(body.error, "Missing signature header");
});

// Plan 06-03 (F-039, DEC-64): this signature is the WRONG LENGTH (23 characters,
// not 64). Before 06-03 the function passed it to crypto.timingSafeEqual, which
// throws on unequal lengths, so this test received 500 Internal server error.
// verifySignature now length-checks first and the answer is 401. The expectation
// holds only once the owner redeploys the function (DI-81).
Deno.test("Wrong-length signature returns 401 (was 500 before 06-03)", async () => {
  const payload = {
    event_count: 1,
    events: [{
      title: "Test Event",
      description: "Test Description",
      category: "workshop",
      date: "2024-12-31",
      location: "Test Location",
      organizer: "Test Organizer",
    }],
  };

  const invalidSignature = "invalid-signature-12345";

  const request = createRequest(payload, invalidSignature);
  const response = await fetch(request);

  assertEquals(response.status, 401);
  const responseBody = await response.json();
  assertEquals(responseBody.error, "Invalid signature");
});

Deno.test("Wrong signature of the right length returns 401", async () => {
  const payload = {
    event_count: 1,
    events: [{
      title: "Test Event",
      description: "Test Description",
      category: "workshop",
      date: "2024-12-31",
      location: "Test Location",
      organizer: "Test Organizer",
    }],
  };

  const request = createRequest(payload, "0".repeat(64));
  const response = await fetch(request);

  assertEquals(response.status, 401);
  const responseBody = await response.json();
  assertEquals(responseBody.error, "Invalid signature");
});

// Plan 06-03 (F-039, DEC-64): each row now carries content_hash, so the unique
// partial index idx_events_content_hash refuses a replayed event with 23505 and
// the function reports it per event as "duplicate". Before 06-03 the second send
// answered 200 and inserted a second set of pending rows. Holds once the owner
// redeploys the function (DI-81).
Deno.test("Replayed payload is reported as duplicate, not inserted again", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const organizerName = `Test Organizer ${Date.now()}`;

  try {
    const payload = {
      event_count: 2,
      events: [
        {
          title: "Replay Event A",
          description: "Replay Description",
          date: "2024-12-31",
          time: "14:00",
          location: "Test Location",
          organizer: organizerName,
        },
        {
          title: "Replay Event B",
          description: "Replay Description",
          date: "2024-12-31",
          time: "16:00",
          location: "Test Location",
          organizer: organizerName,
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const signature = computeHMAC(bodyString, webhookSecret);

    const first = await fetch(createRequest(payload, signature));
    assertEquals(first.status, 200);
    const firstBody = await first.json();
    assertEquals(firstBody.events.length, 2);
    assertExists(firstBody.events[0].content_hash);

    const replay = await fetch(createRequest(payload, signature));
    assertEquals(replay.status, 400);
    const replayBody = await replay.json();
    assertEquals(replayBody.success, false);
    assertEquals(replayBody.message, "Failed to process all events");
    assertEquals(replayBody.errors, [
      { index: 0, error: "duplicate" },
      { index: 1, error: "duplicate" },
    ]);
  } finally {
    await cleanupTestData(organizerName);
  }
});


Deno.test("Invalid JSON payload returns 400", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const invalidJson = "{ invalid json }";
  const signature = computeHMAC(invalidJson, webhookSecret);

  const request = new Request(`${testUrl.origin}/functions/v1/events-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-signature": signature,
    },
    body: invalidJson,
  });

  const response = await fetch(request);
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "Invalid JSON payload");
});

Deno.test("Invalid payload structure returns 400", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const payload = { invalid: "structure" };
  const bodyString = JSON.stringify(payload);
  const signature = computeHMAC(bodyString, webhookSecret);

  const request = createRequest(payload, signature);
  const response = await fetch(request);
  
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "Invalid payload structure. Expected event_count (number) and events (array)");
});

// M0 / DI-83 intentionally changes characterization rows 7, 11 and 12 from
// accidental 500s to validation 400s. Each fails before any database insert.
for (const [label, payload, expected] of [
  ["null envelope", null, {
    error: "Invalid payload structure. Expected event_count (number) and events (array)",
  }],
  ["null event", { event_count: 1, events: [null] }, {
    error: "Invalid events found",
    details: [{ index: 0, errors: [
      "title is required and must be a non-empty string",
      "description is required and must be a non-empty string",
      "date is required and must be a string",
      "location is required and must be a non-empty string",
    ] }],
  }],
  ["non-string tag", { event_count: 1, events: [{
    title: "Malformed tags", description: "Test", date: "2030-01-01",
    location: "Test", tags: [1],
  }] }, {
    error: "Invalid events found",
    details: [{ index: 0, errors: ["tags must contain only strings"] }],
  }],
] as const) {
  Deno.test(`DI-83: ${label} returns 400`, async () => {
    const secret = Deno.env.get("WEBHOOK_SECRET")!;
    const response = await fetch(createRequest(payload, computeHMAC(JSON.stringify(payload), secret)));
    assertEquals(response.status, 400);
    assertEquals(await response.json(), expected);
  });
}

Deno.test("Event count mismatch returns 400", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const payload = {
    event_count: 2,
    events: [{
      title: "Test Event",
      description: "Test Description",
      category: "workshop",
      date: "2024-12-31",
      location: "Test Location",
      organizer: "Test Organizer",
    }],
  };

  const bodyString = JSON.stringify(payload);
  const signature = computeHMAC(bodyString, webhookSecret);

  const request = createRequest(payload, signature);
  const response = await fetch(request);
  
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error.includes("event_count"), true);
});

Deno.test("Invalid event data returns 400", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET") || "test-webhook-secret-key-12345";
  const payload = {
    event_count: 1,
    events: [{
      // Missing required fields
      title: "",
    }],
  };

  const bodyString = JSON.stringify(payload);
  const signature = computeHMAC(bodyString, webhookSecret);

  const request = createRequest(payload, signature);
  const response = await fetch(request);
  
  assertEquals(response.status, 400);
  const body = await response.json();
  assertEquals(body.error, "Invalid events found");
  assertExists(body.details);
});

Deno.test("Valid webhook with organizer processes successfully", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const organizerName = `Test Organizer ${Date.now()}`;
  let response: Response | null = null;
  
  try {
    const payload = {
      event_count: 1,
      events: [{
        title: "Test Event",
        description: "Test Description",
        category: "workshop",
        date: "2024-12-31",
        time: "14:00",
        location: "Test Location",
        organizer: organizerName,
        tags: ["test", "workshop"],
      }],
    };

    const bodyString = JSON.stringify(payload);
    const signature = computeHMAC(bodyString, webhookSecret);

    const request = createRequest(payload, signature);
    response = await fetch(request);
    
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.success, true);
    assertEquals(body.events.length, 1);
    assertEquals(body.events[0].title, "Test Event");
    assertEquals(body.events[0].organizer, organizerName);
    assertExists(body.events[0].start_date);
    assertExists(body.events[0].end_date);
    // Plan 06-03: every webhook row carries its dedupe key.
    assertExists(body.events[0].content_hash);
  } finally {
    // Ensure response body is consumed even if test fails
    if (response && !response.bodyUsed) {
      await response.body?.cancel();
    }
    await cleanupTestData(organizerName);
  }
});

Deno.test("Valid webhook with organizer and image_url processes successfully", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const organizerName = `Test Organizer ${Date.now()}`;
  let response: Response | null = null;
  
  try {
    const payload = {
      event_count: 1,
      events: [{
        title: "Test Event 2",
        description: "Test Description 2",
        category: "seminar",
        date: "2025-01-15",
        time: "10:00",
        location: "Test Location 2",
        organizer: organizerName,
        image_url: "https://example.com/image.jpg",
      }],
    };

    const bodyString = JSON.stringify(payload);
    const signature = computeHMAC(bodyString, webhookSecret);

    const request = createRequest(payload, signature);
    response = await fetch(request);
    
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.success, true);
    assertEquals(body.events.length, 1);
    assertEquals(body.events[0].title, "Test Event 2");
    assertEquals(body.events[0].organizer, organizerName);
    assertEquals(body.events[0].image_url, "https://example.com/image.jpg");
  } finally {
    // Ensure response body is consumed even if test fails
    if (response && !response.bodyUsed) {
      await response.body?.cancel();
    }
    await cleanupTestData(organizerName);
  }
});

Deno.test("Multiple events processed successfully", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const organizerName = `Test Organizer ${Date.now()}`;
  
  try {
    const payload = {
      event_count: 2,
      events: [
        {
          title: "Event 1",
          description: "Description 1",
          category: "workshop",
          date: "2024-12-31",
          location: "Location 1",
          organizer: organizerName,
        },
        {
          title: "Event 2",
          description: "Description 2",
          category: "seminar",
          date: "2025-01-01",
          location: "Location 2",
          organizer: organizerName,
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const signature = computeHMAC(bodyString, webhookSecret);

    const request = createRequest(payload, signature);
    const response = await fetch(request);
    
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.success, true);
    assertEquals(body.events.length, 2);
  } finally {
    await cleanupTestData(organizerName);
  }
});

Deno.test("Partial failure returns 207 with errors", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const organizerName = `Test Organizer ${Date.now()}`;
  
  try {
    const payload = {
      event_count: 2,
      events: [
        {
          title: "Valid Event",
          description: "Valid Description",
          category: "workshop",
          date: "2024-12-31",
          location: "Valid Location",
          organizer: organizerName,
        },
        {
          // Invalid: missing required fields (empty title)
          title: "",
          description: "Invalid Description",
          category: "workshop",
          date: "2024-12-31",
          location: "Invalid Location",
        },
      ],
    };

    const bodyString = JSON.stringify(payload);
    const signature = computeHMAC(bodyString, webhookSecret);

    const request = createRequest(payload, signature);
    const response = await fetch(request);
    
    // Should return 400 because validation happens before processing
    assertEquals(response.status, 400);
    const body = await response.json();
    assertEquals(body.error, "Invalid events found");
  } finally {
    await cleanupTestData(organizerName);
  }
});

Deno.test("Supports x-hub-signature-256 header format", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const organizerName = `Test Organizer ${Date.now()}`;
  
  try {
    const payload = {
      event_count: 1,
      events: [{
        title: "Test Event",
        description: "Test Description",
        category: "workshop",
        date: "2024-12-31",
        location: "Test Location",
        organizer: organizerName,
      }],
    };

    const bodyString = JSON.stringify(payload);
    const signature = computeHMAC(bodyString, webhookSecret);
    // Format: sha256=<signature>
    const signatureWithPrefix = `sha256=${signature}`;

    const request = new Request(`${testUrl.origin}/functions/v1/events-webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signatureWithPrefix,
      },
      body: bodyString,
    });

    const response = await fetch(request);
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.success, true);
  } finally {
    await cleanupTestData(organizerName);
  }
});

Deno.test("Supports x-webhook-signature header", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const organizerName = `Test Organizer ${Date.now()}`;
  
  try {
    const payload = {
      event_count: 1,
      events: [{
        title: "Test Event",
        description: "Test Description",
        category: "workshop",
        date: "2024-12-31",
        location: "Test Location",
        organizer: organizerName,
      }],
    };

    const bodyString = JSON.stringify(payload);
    const signature = computeHMAC(bodyString, webhookSecret);

    const request = await createRequest(payload, signature, "x-webhook-signature");
    const response = await fetch(request);
    
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.success, true);
  } finally {
    await cleanupTestData(organizerName);
  }
});

Deno.test("Event tags and category are properly processed", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET") || "test-webhook-secret-key-12345";
  const organizerName = `Test Organizer ${Date.now()}`;
  
  try {
    const payload = {
      event_count: 1,
      events: [{
        title: "Tagged Event",
        description: "Event with tags",
        category: "workshop",
        date: "2024-12-31",
        location: "Test Location",
        organizer: organizerName,
        tags: ["tag1", "tag2", "TAG3"], // Should be lowercased
      }],
    };

    const bodyString = JSON.stringify(payload);
    const signature = computeHMAC(bodyString, webhookSecret);

    const request = createRequest(payload, signature);
    const response = await fetch(request);
    
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.success, true);
    assertEquals(body.events.length, 1);
    
    // Check that category is set from category field
    assertEquals(body.events[0].category, "workshop");
    
    // Check that tags include category and additional tags (all lowercased)
    const eventTags = body.events[0].tags;
    assertEquals(eventTags.includes("workshop"), true);
    assertEquals(eventTags.includes("tag1"), true);
    assertEquals(eventTags.includes("tag2"), true);
    assertEquals(eventTags.includes("tag3"), true); // Lowercased
  } finally {
    await cleanupTestData(organizerName);
  }
});
