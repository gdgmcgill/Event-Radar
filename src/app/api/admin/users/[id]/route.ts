import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireRole } from "@/server/authz/requireRole";
import { getElevatedClient } from "@/server/db/elevated";
import { logAdminAction } from "@/lib/audit";
import type { TablesUpdate } from "@/lib/supabase/types";
import { parseBody, parseWith } from "@/server/body";
import { CanonicalId } from "@/contracts/common";
import {
  AdminUserNameBody,
  AdminUserUpdateBody,
  type UserRoleValue,
} from "@/contracts/admin";
import { withRoute } from "@/server/route";

export const PATCH = withRoute({ cache: "private", action: "update user" }, async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const ctx = await createRequestContext();
  const activeUser = requireActiveUser(ctx);
  if (!activeUser.ok) return activeUser.response;
  const auth = requireRole(ctx, "admin");
  if (!auth.ok) return auth.response;

  // The canonical (lower-case) id, so the own-roles check below cannot be
  // sidestepped by sending the caller's own id in another case (DI-64,
  // DEC-66). Any other string passes through unchanged.
  const id = CanonicalId.parse((await params).id);

  // The roles first; the name is checked after the own-roles 403, as before
  // (src/contracts/admin.ts). Both 400s carry `field` (C10).
  const parsed = await parseBody(request, AdminUserUpdateBody, {
    fieldFor: ["roles"],
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const updateData: TablesUpdate<"users"> = {
    updated_at: new Date().toISOString(),
  };

  let roles: UserRoleValue[] | null = null;
  if (body.roles !== undefined) {
    // Every value is a user_role enum member (F-091, DEC-45; the contract
    // refused anything else). The admin role is no longer stripped: after
    // F-004 this route is the only path that grants admin.
    const submitted = body.roles;
    // An admin never changes their own roles, so no admin can demote or
    // re-grant themselves through this route.
    if (id === CanonicalId.parse(auth.user.id)) {
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
  const nameBody = parseWith(AdminUserNameBody, body, { fieldFor: ["name"] });
  if (!nameBody.ok) return nameBody.response;
  let name: string | null = null;
  if (nameBody.data.name !== undefined) {
    name = nameBody.data.name;
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
});
