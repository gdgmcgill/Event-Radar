/**
 * The seam's success vocabulary.
 *
 * Three shapes, all of which already exist in this tree:
 *   - a plain JSON body at 200      (src/app/api/clubs/[id]/route.ts)
 *   - `{ success: true }` at 200    (src/app/api/clubs/[id]/transfer/route.ts)
 *   - a created resource at 201     (src/app/api/clubs/route.ts)
 *
 * No envelope is added. Handlers that adopt the seam in later phases must emit
 * the same bytes they emit today.
 */

import { NextResponse } from "next/server";

/** 200 with the body echoed unchanged. */
export function ok<T>(body: T): NextResponse {
  return NextResponse.json(body, { status: 200 });
}

/** 201 with the created resource echoed unchanged. */
export function created<T>(body: T): NextResponse {
  return NextResponse.json(body, { status: 201 });
}

/** 200 `{ success: true }` — the existing acknowledgement for a mutation that
 * returns no resource. */
export function success(): NextResponse {
  return NextResponse.json({ success: true }, { status: 200 });
}
