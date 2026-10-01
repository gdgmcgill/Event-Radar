import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createRequestContext } from "@/server/context";
import { requireActiveUser } from "@/server/authz/requireActiveUser";
import { requireOnboarded } from "@/server/authz/requireOnboarded";
import { parseForm } from "@/server/body";
import { EVENT_IMAGE_UPLOAD, UploadImageForm } from "@/contracts/events";
import { withRoute } from "@/server/route";
import { log } from "@/server/log";

export const POST = withRoute({ cache: "private", action: "upload image" }, async (request: NextRequest) => {
    try {
        const ctx = await createRequestContext();
        const active = requireActiveUser(ctx);
        if (!active.ok) return active.response;
        const onboarded = requireOnboarded(ctx);
        if (!onboarded.ok) return onboarded.response;
        const supabase = ctx.supabase;

        // The multipart contract (plan 06-08, REFAC-15): the route's own
        // texts and order (missing, size, then type). Malformed multipart
        // is a 400 client error; the bounded signature check follows.
        const parsed = await parseForm(request, UploadImageForm, EVENT_IMAGE_UPLOAD);
        if (!parsed.ok) return parsed.response;
        const { file } = parsed.data;

        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

        const arrayBuffer = await file.arrayBuffer();

        const { error: uploadError } = await supabase.storage
            .from("event-images")
            .upload(fileName, arrayBuffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            log.error("Storage upload error", { error: uploadError });
            return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
        }

        const { data: urlData } = supabase.storage
            .from("event-images")
            .getPublicUrl(fileName);

        return NextResponse.json({ url: urlData.publicUrl }, { status: 200 });
    } catch (error) {
        log.error("Error uploading image", { error });
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
});
