-- Moderators: appointed (and removed) by admins only. They can read reports, dismiss them,
-- and remove posts and chat messages THAT HAVE BEEN REPORTED, and nothing else.
-- They can't suspend people, verify businesses, delete groups, post events or appoint anyone.

create table public.moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now()
);
alter table public.moderators enable row level security;
create policy "You can see if you're a moderator; admins see all" on public.moderators
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins can appoint moderators" on public.moderators
  for insert to authenticated with check ((select private.is_admin()) and added_by = (select auth.uid()));
create policy "Admins can remove moderators" on public.moderators
  for delete to authenticated using ((select private.is_admin()));

-- Admins, or moderators who aren't suspended.
create or replace function private.can_moderate() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
      or (exists (select 1 from public.moderators where user_id = (select auth.uid()))
          and not exists (select 1 from public.suspended_users where user_id = (select auth.uid())));
$$;
grant execute on function private.can_moderate() to authenticated;

-- Moderators read and clear reports (admins already can).
create policy "Moderators can read reports" on public.reports
  for select to authenticated using ((select private.can_moderate()));
create policy "Moderators can clear reports" on public.reports
  for delete to authenticated using ((select private.can_moderate()));

-- Remove a post, only if someone has reported it.
create or replace function public.remove_reported_post(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_moderate() then raise exception 'Only moderators and admins can do this.'; end if;
  if not exists (select 1 from public.reports where post_id = target) then raise exception 'This post hasn''t been reported.'; end if;
  delete from public.posts where id = target;
end $$;
revoke execute on function public.remove_reported_post(uuid) from public, anon;
grant execute on function public.remove_reported_post(uuid) to authenticated;

-- Remove a chat message, only if someone has reported it (without being able to read the chat).
create or replace function public.remove_reported_message(target bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_moderate() then raise exception 'Only moderators and admins can do this.'; end if;
  if not exists (select 1 from public.reports where message_id = target) then raise exception 'This message hasn''t been reported.'; end if;
  delete from public.messages_chat where id = target;
end $$;
revoke execute on function public.remove_reported_message(bigint) from public, anon;
grant execute on function public.remove_reported_message(bigint) to authenticated;

-- Moderators can delete the photo of a reported post (the app does this just before removing the post).
create policy "Moderators can remove photos of reported posts" on storage.objects
  for delete to authenticated using (
    bucket_id = 'post-images'
    and (select private.can_moderate())
    and exists (select 1 from public.posts p join public.reports r on r.post_id = p.id where p.image_path = objects.name)
  );
