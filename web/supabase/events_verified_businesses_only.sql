-- Only verified businesses can post events.
-- The list is edited by the site owner in the Supabase dashboard; the app can't change it.
create table public.verified_businesses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null check (char_length(trim(business_name)) between 2 and 60),
  verified_at timestamptz not null default now()
);
alter table public.verified_businesses enable row level security;
-- You can only see whether you yourself are verified. No insert/update/delete policies: app users can't edit it.
create policy "You can see your own verification" on public.verified_businesses
  for select to authenticated using (user_id = (select auth.uid()));

-- Event posts: must be from a verified business, and always carry that business's real name.
create or replace function public.stamp_event_business() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  if new.kind = 'event' then
    select vb.business_name into v_name from public.verified_businesses vb where vb.user_id = new.user_id;
    if v_name is null then
      raise exception 'Only verified businesses can post events.';
    end if;
    new.business_name := v_name;
  else
    new.business_name := null;
  end if;
  return new;
end $$;
revoke execute on function public.stamp_event_business() from public, anon, authenticated;

create trigger posts_stamp_event_business before insert on public.posts
  for each row execute function public.stamp_event_business();

drop policy "You can post as yourself" on public.posts;
create policy "You can post as yourself" on public.posts for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
    and (kind <> 'event' or exists (select 1 from public.verified_businesses vb where vb.user_id = (select auth.uid())))
  );

-- To verify a business (run in the Supabase SQL editor, using their account's user id):
--   insert into public.verified_businesses (user_id, business_name) values ('<user id>', 'Lucky Hostel');
-- To remove verification:
--   delete from public.verified_businesses where user_id = '<user id>';
