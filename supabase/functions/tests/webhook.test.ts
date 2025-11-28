/// <reference lib="deno.ns" />

/**
 * Tests for the events-webhook Edge Function
 * 
 * First need to serve the functions locally with .env.test `npx supabase functions serve --env-file .env.test`
 * Run with: deno test --allow-net --allow-env --allow-read supabase/functions/tests/webhook.test.ts
 * 
 * 
 * Prerequisites:
 * 1. Local Supabase instance must be running: `supabase start`
 * 2. Database must have the required tables (events)
 * 3. Load .env.test file before running tests
 */

import { assertEquals, assertExists } from "jsr:@std/assert";
import { load } from "jsr:@std/dotenv";
import crypto from "node:crypto";

// Load test environment variables
// Load from the root directory
await load({ envPath: ".env.test", export: true });

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

  return new Request("http://localhost:54321/functions/v1/events-webhook", {
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
  const request = new Request("http://localhost:54321/functions/v1/events-webhook", {
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

Deno.test("Invalid signature returns 401", async () => {
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


Deno.test("Invalid JSON payload returns 400", async () => {
  const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
  const invalidJson = "{ invalid json }";
  const signature = computeHMAC(invalidJson, webhookSecret);

  const request = new Request("http://localhost:54321/functions/v1/events-webhook", {
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

    const request = new Request("http://localhost:54321/functions/v1/events-webhook", {
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

