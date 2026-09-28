import { getApiDocs } from "@/lib/swagger";
import ReactSwagger from "@/components/redoc/RedocUI";
import { requireAdminPage } from "@/server/authz/requireAdminPage";

export default async function IndexPage() {
    // A partial RSC render can execute the page without re-running its layout.
    await requireAdminPage("/");
    const spec = await getApiDocs();
    return (
        // Redoc's default theme uses dark text and a transparent content panel.
        // Give it a light surface even when the application shell is dark.
        <section className="container bg-white text-slate-900 [color-scheme:light]">
            <ReactSwagger spec={ spec as Record<string, unknown> } />
        </section>
    );
}
