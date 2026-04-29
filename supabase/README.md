# Supabase Portal Schema

This directory contains the Supabase-side schema for the hybrid client portal.

## What lives in Supabase

- Auth users and sessions
- Client profiles
- Portal requests/actions
- Client documents metadata
- Private client files in Supabase Storage

## What stays in Strapi

- Marketing/site CMS content
- Blog and editorial workflows
- Internal staff-managed website data
- Optional reference fields that point to Supabase users

## Apply the schema

Run [migrations/20260428_client_portal.sql](migrations/20260428_client_portal.sql) in the Supabase SQL editor, or add it to a Supabase CLI project if you are managing migrations in git.

## Important conventions

- Canonical client ID is `auth.users.id`.
- Strapi should reference that value with `supabase_user_id` on client-linked records.
- Client document object keys must start with the client UUID:
  - `<client_uuid>/<document_uuid>/<filename>`
- The `client-documents` storage bucket is private.
- Client read access is enforced through RLS on both tables and `storage.objects`.

## Notes

- The SQL creates `profiles`, `documents`, and `requests` tables.
- `profiles.id` references `auth.users(id)` directly and is created automatically by an `auth.users` trigger.
- Document writes are intentionally left to trusted staff/service-role flows by default.
