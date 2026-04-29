# Client Portal Integration

This project uses a hybrid architecture:

- Strapi is the CMS for website and editorial content.
- Supabase is the portal backend for client authentication, portal data, and private document delivery.

## Identity model

- Canonical portal user ID: `supabase.auth.users.id`
- Strapi never owns portal passwords or sessions.
- Strapi admin users remain separate for staff workflows.

## Strapi reference fields

Use `supabase_user_id` as the stable cross-system reference when a Strapi record needs to point at a portal client.

The initial Strapi-side implementation adds `supabase_user_id` to:

- `api::lead.lead`
- `api::audit.audit`

These fields are optional and purely referential.

## Legacy UUID fields

These fields already exist in the codebase and should be treated as legacy/internal identifiers unless intentionally migrated:

- `api::audit.audit.uuid`
- `api::lead.lead.lead_uuid`
- `plugin::users-permissions.user.user_uuid`
- `api::post.post.author_uuid`

Do not reuse them as the canonical portal identity key.

## Supabase schema

The Supabase schema lives in:

- [supabase/migrations/20260428_client_portal.sql](../supabase/migrations/20260428_client_portal.sql)

It creates:

- `public.profiles`
- `public.documents`
- `public.requests`
- RLS policies for portal access
- a private `client-documents` storage bucket

## Storage path convention

Client documents must use this object path pattern:

```text
<client_uuid>/<document_uuid>/<filename>
```

This is required because the storage RLS policy scopes downloads by the first folder segment matching `auth.uid()`.

## Portal app behavior

- Portal frontend authenticates with Supabase Auth.
- Portal data reads and writes go to Supabase tables with RLS.
- Document downloads come from Supabase Storage.
- If the portal needs CMS content from Strapi, it should fetch Strapi content read-only via API.

## Recommended next step outside this repo

Build the portal app against Supabase first, then selectively connect it to Strapi content where CMS-backed data is actually needed.
