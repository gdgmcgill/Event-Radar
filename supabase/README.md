# Supabase Setup

Quick guide for set up the Supabase project.

## Prerequisites

The supabase cli tool is defined in package.json as a dev tool, so if you have run `npm install` you should have it. Use it by doing `npx supabase <cmd>`
## System Requirements

To run Supabase services locally, you must have [Docker](https://www.docker.com/get-started/) installed on your machine.  
Supabase relies on Docker containers for running its local development environment. Make sure to:

- [Download and install Docker Desktop](https://docs.docker.com/get-docker/) for your OS.
- Start Docker and ensure it is running before using local Supabase CLI commands (e.g., `supabase start`).

You can verify your Docker installation with:
```bash
docker version
```
If this command outputs version info, Docker is set up correctly.


## Initial Setup
1. **Login to Supabase**
   ```bash
   npx supabase login
   ```
   Follow the prompts to authenticate with your Supabase account.

2. **List your Supabase projects**
   ```bash
   npx supabase projects list
   ```
   This will display all projects associated with your account. Note the project reference for your target project.

3. **Link to remote project**
   ```bash
   npx supabase link --project-ref <your-project-ref>
   ```
   You'll be prompted to enter your database password.

4. **Start local development**
   ```bash
   supabase start
   ```
   This will start all Supabase services locally (database, API, Studio, etc.)

5. **Access local services**
   - **Supabase Studio**: http://localhost:54323
   - **API URL**: http://127.0.0.1:54321
   - **Database**: localhost:54322

## Important CLI Commands

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Reset local database (applies all migrations)
supabase db reset

# Pull remote schema changes
supabase db pull

# Push local migrations to remote. NOTE: Do not push changes that have not been merged in main to remote!
supabase db push

# Create a new migration
supabase migration new <migration_name>

# View local database status
supabase status

# View logs
supabase logs
```

## Edge Functions

Edge functions are located in `functions/`. To test locally:
```bash
supabase functions serve
```

## Notes
- Migrations are in the `migrations/` folder
- Always run `supabase db pull` before making schema changes to sync with remote

