begin;
-- An explicit deny documents the allowlist's access model. Only the owner-run
-- auth.uid()-checked helper reads it; neither normal users nor admins can list it.
create policy era_admin_emails_no_client_access
on jianghu_private.era_admin_emails for all to anon, authenticated
using (false) with check (false);
commit;
