drop extension if exists "pg_net";


  create table "public"."events" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "title" text not null,
    "description" text,
    "start_date" timestamp with time zone not null,
    "end_date" timestamp with time zone not null,
    "location" text,
    "category" text,
    "tags" text[],
    "image_url" text,
    "organizer" text,
    "rsvp_count" integer default 0,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."events" enable row level security;


  create table "public"."rsvps" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid,
    "event_id" uuid,
    "status" text default 'going'::text,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."rsvps" enable row level security;


  create table "public"."saved_events" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "user_id" uuid,
    "event_id" uuid,
    "created_at" timestamp with time zone default now()
      );


alter table "public"."saved_events" enable row level security;


  create table "public"."users" (
    "id" uuid not null default extensions.uuid_generate_v4(),
    "email" text not null,
    "name" text,
    "avatar_url" text,
    "preferences" jsonb default '{}'::jsonb,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
      );


alter table "public"."users" enable row level security;

CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id);

CREATE INDEX idx_events_category ON public.events USING btree (category);

CREATE INDEX idx_events_start_date ON public.events USING btree (start_date);

CREATE INDEX idx_rsvps_event_id ON public.rsvps USING btree (event_id);

CREATE INDEX idx_rsvps_user_id ON public.rsvps USING btree (user_id);

CREATE INDEX idx_saved_events_event_id ON public.saved_events USING btree (event_id);

CREATE INDEX idx_saved_events_user_id ON public.saved_events USING btree (user_id);

CREATE UNIQUE INDEX rsvps_pkey ON public.rsvps USING btree (id);

CREATE UNIQUE INDEX rsvps_user_id_event_id_key ON public.rsvps USING btree (user_id, event_id);

CREATE UNIQUE INDEX saved_events_pkey ON public.saved_events USING btree (id);

CREATE UNIQUE INDEX saved_events_user_id_event_id_key ON public.saved_events USING btree (user_id, event_id);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

alter table "public"."events" add constraint "events_pkey" PRIMARY KEY using index "events_pkey";

alter table "public"."rsvps" add constraint "rsvps_pkey" PRIMARY KEY using index "rsvps_pkey";

alter table "public"."saved_events" add constraint "saved_events_pkey" PRIMARY KEY using index "saved_events_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."rsvps" add constraint "rsvps_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE not valid;

alter table "public"."rsvps" validate constraint "rsvps_event_id_fkey";

alter table "public"."rsvps" add constraint "rsvps_user_id_event_id_key" UNIQUE using index "rsvps_user_id_event_id_key";

alter table "public"."rsvps" add constraint "rsvps_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."rsvps" validate constraint "rsvps_user_id_fkey";

alter table "public"."saved_events" add constraint "saved_events_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE not valid;

alter table "public"."saved_events" validate constraint "saved_events_event_id_fkey";

alter table "public"."saved_events" add constraint "saved_events_user_id_event_id_key" UNIQUE using index "saved_events_user_id_event_id_key";

alter table "public"."saved_events" add constraint "saved_events_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."saved_events" validate constraint "saved_events_user_id_fkey";

alter table "public"."users" add constraint "users_email_key" UNIQUE using index "users_email_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

grant delete on table "public"."events" to "anon";

grant insert on table "public"."events" to "anon";

grant references on table "public"."events" to "anon";

grant select on table "public"."events" to "anon";

grant trigger on table "public"."events" to "anon";

grant truncate on table "public"."events" to "anon";

grant update on table "public"."events" to "anon";

grant delete on table "public"."events" to "authenticated";

grant insert on table "public"."events" to "authenticated";

grant references on table "public"."events" to "authenticated";

grant select on table "public"."events" to "authenticated";

grant trigger on table "public"."events" to "authenticated";

grant truncate on table "public"."events" to "authenticated";

grant update on table "public"."events" to "authenticated";

grant delete on table "public"."events" to "service_role";

grant insert on table "public"."events" to "service_role";

grant references on table "public"."events" to "service_role";

grant select on table "public"."events" to "service_role";

grant trigger on table "public"."events" to "service_role";

grant truncate on table "public"."events" to "service_role";

grant update on table "public"."events" to "service_role";

grant delete on table "public"."rsvps" to "anon";

grant insert on table "public"."rsvps" to "anon";

grant references on table "public"."rsvps" to "anon";

grant select on table "public"."rsvps" to "anon";

grant trigger on table "public"."rsvps" to "anon";

grant truncate on table "public"."rsvps" to "anon";

grant update on table "public"."rsvps" to "anon";

grant delete on table "public"."rsvps" to "authenticated";

grant insert on table "public"."rsvps" to "authenticated";

grant references on table "public"."rsvps" to "authenticated";

grant select on table "public"."rsvps" to "authenticated";

grant trigger on table "public"."rsvps" to "authenticated";

grant truncate on table "public"."rsvps" to "authenticated";

grant update on table "public"."rsvps" to "authenticated";

grant delete on table "public"."rsvps" to "service_role";

grant insert on table "public"."rsvps" to "service_role";

grant references on table "public"."rsvps" to "service_role";

grant select on table "public"."rsvps" to "service_role";

grant trigger on table "public"."rsvps" to "service_role";

grant truncate on table "public"."rsvps" to "service_role";

grant update on table "public"."rsvps" to "service_role";

grant delete on table "public"."saved_events" to "anon";

grant insert on table "public"."saved_events" to "anon";

grant references on table "public"."saved_events" to "anon";

grant select on table "public"."saved_events" to "anon";

grant trigger on table "public"."saved_events" to "anon";

grant truncate on table "public"."saved_events" to "anon";

grant update on table "public"."saved_events" to "anon";

grant delete on table "public"."saved_events" to "authenticated";

grant insert on table "public"."saved_events" to "authenticated";

grant references on table "public"."saved_events" to "authenticated";

grant select on table "public"."saved_events" to "authenticated";

grant trigger on table "public"."saved_events" to "authenticated";

grant truncate on table "public"."saved_events" to "authenticated";

grant update on table "public"."saved_events" to "authenticated";

grant delete on table "public"."saved_events" to "service_role";

grant insert on table "public"."saved_events" to "service_role";

grant references on table "public"."saved_events" to "service_role";

grant select on table "public"."saved_events" to "service_role";

grant trigger on table "public"."saved_events" to "service_role";

grant truncate on table "public"."saved_events" to "service_role";

grant update on table "public"."saved_events" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


  create policy "Authenticated users can insert events"
  on "public"."events"
  as permissive
  for insert
  to public
with check ((auth.role() = 'authenticated'::text));



  create policy "Authenticated users can update events"
  on "public"."events"
  as permissive
  for update
  to public
using ((auth.role() = 'authenticated'::text));



  create policy "Events are viewable by everyone"
  on "public"."events"
  as permissive
  for select
  to public
using (true);



  create policy "Users can delete their own RSVPs"
  on "public"."rsvps"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own RSVPs"
  on "public"."rsvps"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can update their own RSVPs"
  on "public"."rsvps"
  as permissive
  for update
  to public
using ((auth.uid() = user_id));



  create policy "Users can view their own RSVPs"
  on "public"."rsvps"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can delete their own saved events"
  on "public"."saved_events"
  as permissive
  for delete
  to public
using ((auth.uid() = user_id));



  create policy "Users can insert their own saved events"
  on "public"."saved_events"
  as permissive
  for insert
  to public
with check ((auth.uid() = user_id));



  create policy "Users can view their own saved events"
  on "public"."saved_events"
  as permissive
  for select
  to public
using ((auth.uid() = user_id));



  create policy "Users can update their own profile"
  on "public"."users"
  as permissive
  for update
  to public
using ((auth.uid() = id));



  create policy "Users can view all profiles"
  on "public"."users"
  as permissive
  for select
  to public
using (true);


CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rsvps_updated_at BEFORE UPDATE ON public.rsvps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


