-- Admins: run Wayfund. They can post events (as "Wayfund team"), verify businesses,
-- read and act on reports, and remove any post or chat message.
-- Who is an admin is set only in the Supabase dashboard; the app can't change it.
create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
create policy "You can see if you're an admin" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

-- The name your events are posted under: your verified business, "Wayfund team" for admins, or null.
create or replace function public.my_event_name() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select business_name from public.verified_businesses where user_id = (select auth.uid())),
    case when exists (select 1 from public.admins where user_id = (select auth.uid())) then 'Wayfund team' end
  );
$$;
revoke execute on function public.my_event_name() from public, anon;
grant execute on function public.my_event_name() to authenticated;

create or replace function public.stamp_event_business() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if new.kind = 'event' then
    select coalesce(
      (select vb.business_name from public.verified_businesses vb where vb.user_id = new.user_id),
      case when exists (select 1 from public.admins a where a.user_id = new.user_id) then 'Wayfund team' end
    ) into v_name;
    if v_name is null then
      raise exception 'Only verified businesses can post events.';
    end if;
    new.business_name := v_name;
  else
    new.business_name := null;
  end if;
  return new;
end $$;

drop policy "You can post as yourself" on public.posts;
create policy "You can post as yourself" on public.posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
    and (kind <> 'event'
         or exists (select 1 from public.verified_businesses vb where vb.user_id = (select auth.uid()))
         or (select private.is_admin()))
  );

-- Admins can remove any post, photo or chat message.
create policy "Admins can remove any post" on public.posts
  for delete to authenticated using ((select private.is_admin()));
create policy "Admins can remove any post photo" on storage.objects
  for delete to authenticated using (bucket_id = 'post-images' and (select private.is_admin()));
create policy "Admins can remove any message" on public.messages_chat
  for delete to authenticated using ((select private.is_admin()));

-- Admins read reports and clear them once dealt with.
create policy "Admins can read reports" on public.reports
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can clear reports" on public.reports
  for delete to authenticated using ((select private.is_admin()));

-- Admins manage the verified businesses list.
create policy "Admins can see all verified businesses" on public.verified_businesses
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can verify businesses" on public.verified_businesses
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can un-verify businesses" on public.verified_businesses
  for delete to authenticated using ((select private.is_admin()));

-- To make someone an admin (Supabase SQL editor):
--   insert into public.admins (user_id) values ('<user id>');
