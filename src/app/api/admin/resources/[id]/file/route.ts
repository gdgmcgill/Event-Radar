import { NextResponse, type NextRequest } from "next/server";
import { DetailParams } from "@/contracts/discovery";
import { RESOURCE_FILE_UPLOAD, ResourceFileUploadFields } from "@/contracts/resources";
import { checkFile, parseForm, parseWith } from "@/server/body";
import { getElevatedClient } from "@/server/db/elevated";
import { adminContext, mutationError } from "@/server/opportunities/admin";
import { adminResource, checkResourceFileContent, uploadResourceFile } from "@/server/resources/admin";
import { withRoute } from "@/server/route";

type RouteContext = { params: Promise<{ id: string }> };

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
  const uploaded = await uploadResourceFile(id.data.id, file);
  const { error } = await getElevatedClient().rpc("curate_resource", {
    p_actor: auth.user.id,
    p_id: id.data.id,
    p_action: "edit",
    p_data: uploaded,
    p_expected: parsed.data.fields.expected_updated_at,
  });
  if (error) return mutationError(error);
  return NextResponse.json({ item: await adminResource(id.data.id) });
});
