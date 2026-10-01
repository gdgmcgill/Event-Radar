/**
 * Contracts for /api/notifications (plan 06-04, REFAC-15, DEC-65).
 *
 * Pinned by src/__tests__/api/notifications/notifications-characterization.test.ts.
 * No notifications arm reads a JSON body: GET reads `cursor`, POST reads
 * `action`, PATCH /[id] reads only its route param (UUID route params are
 * parsed from plan 06-10, DEC-66) and count reads nothing.
 */
import { z } from "zod";
import type { BodilessRequestInit } from "@/contracts/common";

/**
 * GET: `?cursor=<created_at ISO string>`. Not validated, as today: an absent
 * or empty cursor means the first page, any other value is the filter bound.
 */
export const NotificationsListQuery = z.object({
  cursor: z.string().optional(),
});

/**
 * POST: `?action=mark-all-read` is the only action. An absent, empty, unknown
 * or differently cased action answers 400 `Invalid action`.
 */
export const NotificationsQuery = z.object({
  action: z.literal("mark-all-read", { error: "Invalid action" }),
});

export type NotificationsListQueryOutput = z.infer<typeof NotificationsListQuery>;
export type NotificationsQueryInput = z.input<typeof NotificationsQuery>;
export type NotificationsQueryOutput = z.infer<typeof NotificationsQuery>;

/**
 * POST /api/notifications (its query is NotificationsQuery) and PATCH
 * /api/notifications/[id] read no body (plan 06-11, REFAC-16).
 */
export type NotificationsActionRequestInit = BodilessRequestInit;
export type NotificationReadRequestInit = BodilessRequestInit;

// ─── Responses the client reads (plan 06-11, REFAC-16, DEC-67) ───────────────

/**
 * GET /api/notifications/count, 200: `{ unread_count }` (a number; 0 when the
 * count read failed). Loose, as every response schema here is: an extra key
 * is not drift, so a development warning means a key the client reads has
 * changed. Checked in development only by useNotificationCount.
 */
export const NotificationCountResponse = z.looseObject({
  unread_count: z.number(),
});

export type NotificationCountResponseBody = z.infer<
  typeof NotificationCountResponse
>;
