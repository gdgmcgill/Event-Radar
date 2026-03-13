# MCP setup (Cursor / Claude Code)

## Supabase MCP

The project includes a Supabase MCP server in `.cursor/mcp.json` so Cursor (and Cloud Agents) can use Supabase tools (run SQL, list tables, migrations, logs, etc.).

### First-time setup

1. **Restart Cursor** after cloning so it picks up `.cursor/mcp.json`.
2. **Log in to Supabase** when prompted: the first time you use a Supabase MCP tool, Cursor may open a browser to sign in and authorize the MCP client. Choose the organization that contains the Event-Radar project.
3. **Verify**: In Cursor go to **Settings → Tools & MCP** and confirm the `supabase` server is listed and enabled. You can ask the agent to run a Supabase tool (e.g. “List tables in the database using MCP”) to confirm.

### Optional: personal access token (no browser)

If you need to use a personal access token instead of browser login (e.g. no browser or CI):

1. Create a token at [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens).
2. In your **global** MCP config (`~/.cursor/mcp.json`), add the same server with a `headers` block and your token (do not commit this file):

   ```json
   {
     "mcpServers": {
       "supabase": {
         "url": "https://mcp.supabase.com/mcp?project_ref=xgfetrzyjroiqpwhksjw",
         "headers": {
           "Authorization": "Bearer YOUR_SUPABASE_ACCESS_TOKEN"
         }
       }
     }
   }
   ```

   Project-level `.cursor/mcp.json` is merged with global; if the same server name exists in both, the project config wins. To use the token, either remove the `supabase` entry from the project config or override only the headers in your global config (check Cursor docs for merge behavior).

### Project reference

The configured project ref is `xgfetrzyjroiqpwhksjw` (from `NEXT_PUBLIC_SUPABASE_URL`). It is scoped so the MCP only has access to this project.

### Security

- Use the MCP with a **development** project and non-production data when possible.
- Prefer leaving “Ask before running” enabled for MCP tools so you can review SQL and other actions.
- See [Supabase MCP security](https://supabase.com/docs/guides/getting-started/mcp#security-risks) for more.
