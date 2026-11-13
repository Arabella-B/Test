-- Admin moderation, part 2:
--  * Suspend accounts: a suspended person can still log in and see things, but can't post,
--    message, like, create or join groups, or report. Admins can't be suspended.
--  * Admins can delete any group.
--  * Admins can remove a reported chat message without being able to read private group chats.

create table public.suspended_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 300),
  suspended_at timestamptz not null default now(),
  suspended_by uuid references auth.users(id) on delete set null
);
alter table public.suspended_users enable row level security;
create policy "You can see if you're suspended" on public.suspended_users
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins can suspend" on public.suspended_users
  for insert to authenticated with check (
    (select private.is_admin())
    and suspended_by = (select auth.uid())
    and not exists (select 1 from public.admins a where a.user_id = suspended_users.user_id)
  );
create policy "Admins can lift suspensions" on public.suspended_users
  for delete to authenticated using ((select private.is_admin()));

create or replace function private.is_suspended() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.suspended_users where user_id = (select auth.uid()));
$$;
grant execute on function private.is_suspended() to authenticated;

-- "Restrictive" rules are added on top of the existing ones: everything else still applies.
create policy "Suspended accounts can't post" on public.posts as restrictive
  for insert to authenticated with check (not (select private.is_suspended()));
create policy "Suspended accounts can't send messages" on public.messages_chat as restrictive
  for insert to authenticated with check (not (select private.is_suspended()));
create policy "Suspended accounts can't create groups" on public.groups as restrictive
  for insert to authenticated with check (not (select private.is_suspended()));
create policy "Suspended accounts can't join groups" on public.group_members as restrictive
  for insert to authenticated with check (not (select private.is_suspended()));
create policy "Suspended accounts can't like" on public.post_likes as restrictive
  for insert to authenticated with check (not (select private.is_suspended()));
create policy "Suspended accounts can't report" on public.reports as restrictive
  for insert to authenticated with check (not (select private.is_suspended()));
create policy "Suspended accounts can't upload photos" on storage.objects as restrictive
  for insert to authenticated with check (bucket_id <> 'post-images' or not (select private.is_suspended()));

-- Admins can delete any group (its messages go with it).
create policy "Admins can delete any group" on public.groups
  for delete to authenticated using ((select private.is_admin()));

-- Remove one chat message (from the reports inbox), without needing to read the chat.
create or replace function public.admin_remove_message(message_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Only admins can do this.'; end if;
  delete from public.messages_chat where id = message_id;
end $$;
revoke execute on function public.admin_remove_message(bigint) from public, anon;
grant execute on function public.admin_remove_message(bigint) to authenticated;

-- Remove everything someone has posted: all their posts and chat messages.
-- Returns the photo paths so the app can delete the photos from storage too.
create or replace function public.admin_remove_all_content(target uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare paths text[];
begin
  if not private.is_admin() then raise exception 'Only admins can do this.'; end if;
  select coalesce(array_agg(image_path), '{}') into paths from public.posts where user_id = target and image_path is not null;
  delete from public.posts where user_id = target;
  delete from public.messages_chat where user_id = target;
  return paths;
end $$;
revoke execute on function public.admin_remove_all_content(uuid) from public, anon;
grant execute on function public.admin_remove_all_content(uuid) to authenticated;

-- (The existing "Admins can remove any message" rule stays: it covers chats the admin has joined.)
