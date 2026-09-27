import { getApiDocs } from "@/lib/swagger";
import ReactSwagger from "@/components/redoc/RedocUI";
import { requireAdminPage } from "@/server/authz/requireAdminPage";

export default async function IndexPage() {
    // A partial RSC render can execute the page without re-running its layout.
    await requireAdminPage("/");
    const spec = await getApiDocs();
    return (
        <section className="container">
            <ReactSwagger spec={ spec as Record<string, unknown> } />
        </section>
    );
}
