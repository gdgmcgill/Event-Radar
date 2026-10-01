import { NextResponse, type NextRequest } from "next/server";
import { DetailParams } from "@/contracts/discovery";
import { RESOURCE_FILE_UPLOAD, ResourceFileUploadFields } from "@/contracts/resources";
import { checkFile, parseForm, parseWith } from "@/server/body";
import { getElevatedClient } from "@/server/db/elevated";
import { badRequest, notFound } from "@/server/errors";
import { adminContext, mutationError } from "@/server/opportunities/admin";
import {
  adminResource,
  checkResourceFileContent,
  removeResourceFile,
  uploadResourceFile,
} from "@/server/resources/admin";
import { withRoute } from "@/server/route";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Fix round 1, IMPORTANT: the resource is loaded and validated (exists, not
 * deleted, a template, and at the version the caller expects) BEFORE storage
 * is ever touched, so a stale or malformed request cannot reach the bucket.
 * The new file goes to a fresh path with `upsert: false` (never the live
 * file's own path), so the currently-published file is never overwritten in
 * place; a failed `curate_resource` edit discards the new object, and a
 * successful one removes the file it just replaced (best-effort, logged).
 */
export const POST = withRoute({ cache: "private", action: "upload resource file" }, async (request: NextRequest, { params }: RouteContext) => {
  const auth = await adminContext();
  if (!auth.ok) return auth.response;
  const id = parseWith(DetailParams, await params);
  if (!id.ok) return id.response;
  const parsed = await parseForm(request, ResourceFileUploadFields, RESOURCE_FILE_UPLOAD);
  if (!parsed.ok) return parsed.response;
  const { file } = parsed.data;
  const refused = checkFile(file, RESOURCE_FILE_UPLOAD.file) ?? (await checkResourceFileContent(file));
  if (refused) return refused;

  const existing = await adminResource(id.data.id);
  if (!existing) return notFound("Resource not found");
  if (existing.resource_type !== "template") {
    return badRequest("Only a template resource accepts a file upload");
  }
  if (existing.updated_at !== parsed.data.fields.expected_updated_at) {
    return NextResponse.json({ error: "Resource changed; reload before uploading" }, { status: 409 });
  }

  const uploaded = await uploadResourceFile(id.data.id, file);
  const { error } = await getElevatedClient().rpc("curate_resource", {
    p_actor: auth.user.id,
    p_id: id.data.id,
    p_action: "edit",
    p_data: uploaded,
    p_expected: parsed.data.fields.expected_updated_at,
  });
  if (error) {
    await removeResourceFile(uploaded.file_path);
    return mutationError(error);
  }
  if (existing.file_path && existing.file_path !== uploaded.file_path) {
    // Best-effort: the edit already succeeded and is what the response
    // reports; removeResourceFile only logs on failure, it never throws.
    await removeResourceFile(existing.file_path);
  }
  return NextResponse.json({ item: await adminResource(id.data.id) });
});
