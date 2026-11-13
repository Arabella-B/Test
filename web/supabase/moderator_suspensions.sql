-- Moderators can suspend people who have been reported (and optionally remove everything they've posted).
-- They can't suspend admins or other moderators, and only admins can lift a suspension.

create or replace function private.is_moderator_user(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.moderators where user_id = target);
$$;
grant execute on function private.is_moderator_user(uuid) to authenticated;

create or replace function private.has_been_reported(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports where reported_user_id = target);
$$;
grant execute on function private.has_been_reported(uuid) to authenticated;

create policy "Moderators can suspend reported people" on public.suspended_users
  for insert to authenticated with check (
    (select private.can_moderate())
    and suspended_by = (select auth.uid())
    and private.has_been_reported(suspended_users.user_id)
    and not private.is_admin_user(suspended_users.user_id)
    and not private.is_moderator_user(suspended_users.user_id)
  );
create policy "Moderators can see suspensions" on public.suspended_users
  for select to authenticated using ((select private.can_moderate()));

-- Remove everything someone has posted: admins for anyone; moderators only for someone
-- who has been reported and is now suspended.
create or replace function public.admin_remove_all_content(target uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare paths text[];
begin
  if not (
    private.is_admin()
    or (private.can_moderate()
        and exists (select 1 from public.reports where reported_user_id = target)
        and exists (select 1 from public.suspended_users where user_id = target))
  ) then
    raise exception 'You can''t do this.';
  end if;
  select coalesce(array_agg(image_path), '{}') into paths from public.posts where user_id = target and image_path is not null;
  delete from public.posts where user_id = target;
  delete from public.messages_chat where user_id = target;
  return paths;
end $$;

-- Moderators can delete photos belonging to suspended people (when removing everything they posted).
create policy "Moderators can remove photos of suspended people" on storage.objects
  for delete to authenticated using (
    bucket_id = 'post-images'
    and (select private.can_moderate())
    and exists (select 1 from public.suspended_users s where s.user_id::text = (storage.foldername(objects.name))[1])
  );
