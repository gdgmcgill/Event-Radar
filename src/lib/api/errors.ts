import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { logger } from "./logger";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    request_id: string;
    timestamp: string;
    details?: unknown;
  };
}

function buildErrorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiErrorBody> {
  const request_id = randomUUID();
  const timestamp = new Date().toISOString();

  logger.error(message, undefined, { code, request_id, status, details });

  return NextResponse.json(
    {
      error: {
        code,
        message,
        request_id,
        timestamp,
        ...(details !== undefined && { details }),
      },
    },
    { status }
  );
}

export function apiError(
  code: string,
  message: string,
  status: number,
  details?: unknown
): NextResponse<ApiErrorBody> {
  return buildErrorResponse(code, message, status, details);
}

export function validationError(
  message: string,
  details?: unknown
): NextResponse<ApiErrorBody> {
  return buildErrorResponse("VALIDATION_ERROR", message, 400, details);
}

export function unauthorizedError(
  message = "Unauthorized"
): NextResponse<ApiErrorBody> {
  return buildErrorResponse("UNAUTHORIZED", message, 401);
}

export function forbiddenError(
  message = "Forbidden"
): NextResponse<ApiErrorBody> {
  return buildErrorResponse("FORBIDDEN", message, 403);
}

export function notFoundError(
  resource = "Resource"
): NextResponse<ApiErrorBody> {
  return buildErrorResponse("NOT_FOUND", `${resource} not found`, 404);
}

export function internalError(
  message = "Internal server error",
  details?: unknown
): NextResponse<ApiErrorBody> {
  return buildErrorResponse("INTERNAL_ERROR", message, 500, details);
}
