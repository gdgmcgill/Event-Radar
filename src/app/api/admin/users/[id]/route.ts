import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { getElevatedClient } from "@/server/db/elevated";
import { logAdminAction } from "@/lib/audit";
import { Constants, type TablesUpdate } from "@/lib/supabase/types";
import { readJsonObject } from "@/server/body";

/** Bounds on an admin-set display name (REVIEW-05 WR-08). */
const NAME_MIN = 2;
const NAME_MAX = 50;

type UserRoleValue = (typeof Constants.public.Enums.user_role)[number];

const USER_ROLES: readonly string[] = Constants.public.Enums.user_role;

function isUserRole(value: unknown): value is UserRoleValue {
  return typeof value === "string" && USER_ROLES.includes(value);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsedBody = await readJsonObject(request);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.body;

  const updateData: TablesUpdate<"users"> = {
    updated_at: new Date().toISOString(),
  };

  let roles: UserRoleValue[] | null = null;
  if ("roles" in body) {
    // Every value must be a user_role enum member (F-091, DEC-45). The admin
    // role is no longer stripped: after F-004 this route is the only path
    // that grants admin.
    const submitted: unknown = body.roles;
    if (!Array.isArray(submitted) || !submitted.every(isUserRole)) {
      return NextResponse.json(
        { error: "Invalid role", field: "roles" },
        { status: 400 }
      );
    }
    // An admin never changes their own roles, so no admin can demote or
    // re-grant themselves through this route.
    if (id === auth.user.id) {
      return NextResponse.json(
        { error: "You cannot change your own roles" },
        { status: 403 }
      );
    }
    roles = [...submitted];
    if (!roles.includes("user")) roles.unshift("user");
    updateData.roles = roles;
  }
  // The name is validated before it reaches the elevated write (REVIEW-05
  // WR-08): a trimmed string of 2 to 50 characters, the same bounds the
  // self-profile PATCH (/api/users/[id]) enforces. It used to write any JSON
  // type, unaudited.
  let name: string | null = null;
  if ("name" in body) {
    const submitted: unknown = body.name;
    const trimmed = typeof submitted === "string" ? submitted.trim() : "";
    if (trimmed.length < NAME_MIN || trimmed.length > NAME_MAX) {
      return NextResponse.json(
        {
          error: `Name must be between ${NAME_MIN} and ${NAME_MAX} characters long`,
          field: "name",
        },
        { status: 400 }
      );
    }
    name = trimmed;
    updateData.name = name;
  }

  // users has no admin UPDATE policy and the F-006 column grant withholds
  // roles from authenticated, so the write goes through the elevated door.
  // REGISTRY.md row: admin role change.
  const supabase = getElevatedClient();
  const { data, error } = await supabase
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  // Roles and name changes are both audited (REVIEW-05 WR-08); the metadata
  // carries only the fields this request changed.
  if (roles !== null || name !== null) {
    await logAdminAction({
      adminUserId: auth.user.id,
      action: "updated",
      targetType: "user",
      targetId: id,
      metadata: {
        ...(roles !== null ? { roles } : {}),
        ...(name !== null ? { name } : {}),
      },
      requestId: ctx.requestId,
    });
  }

  return NextResponse.json({ user: data });
}
