-- ============================================================================
-- 07_phase2_table_grants.sql
-- Must run AFTER 06_phase2_missing_tables.sql (which creates these tables in
-- the first place on databases where 04_phase2_schema.sql's CREATE TABLE
-- statements never actually landed).
--
-- Fixes a gap in 04_phase2_schema.sql: render_jobs, publish_jobs,
-- platform_connections, character_profiles were created with RLS policies but
-- ended up with ZERO table-level grants for any role (confirmed live via
-- information_schema.role_table_grants returning 0 rows for render_jobs) --
-- unlike the Phase 1 tables, whose grants came from this project's default
-- privileges rather than an explicit statement in 01_initial_schema.sql.
--
-- RLS policies only restrict ROWS after a privilege check already passes;
-- without the GRANTs below, Postgres rejects the operation before RLS is
-- ever evaluated, which is why PostgREST reported the table as unreachable
-- for INSERT/UPDATE even though SELECT/DELETE (where grants happened to
-- exist for some roles) worked.
--
-- Each table is granted exactly the operations its RLS policies define
-- (see 04_phase2_schema.sql section 7) for `authenticated`, plus full access
-- for `service_role` since the render/publish background workers operate
-- under the service role key and must be able to read/update/insert freely.
-- ============================================================================

-- render_jobs: policies are select/insert/update only (no delete policy)
grant select, insert, update on public.render_jobs to authenticated;
grant select, insert, update, delete on public.render_jobs to service_role;

-- publish_jobs: policies are select/insert/update only (no delete policy)
grant select, insert, update on public.publish_jobs to authenticated;
grant select, insert, update, delete on public.publish_jobs to service_role;

-- platform_connections: policies include select/insert/update/delete
grant select, insert, update, delete on public.platform_connections to authenticated;
grant select, insert, update, delete on public.platform_connections to service_role;

-- character_profiles: policies include select/insert/update/delete
grant select, insert, update, delete on public.character_profiles to authenticated;
grant select, insert, update, delete on public.character_profiles to service_role;

NOTIFY pgrst, 'reload schema';
