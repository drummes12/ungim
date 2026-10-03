begin;

select plan(3);

do $$
declare
  month_start date := date_trunc('month', current_date)::date - interval '1 month';
  first_full_week date;
begin
  first_full_week := month_start - (extract(isodow from month_start)::int - 1);
  if first_full_week < month_start then
    first_full_week := first_full_week + 7;
  end if;

  update public.competition_settings set starts_on = first_full_week where id;
  insert into public.plan_versions (id, profile_id, effective_week_start, workout_target)
  values ('77777777-7777-7777-7777-777777777771', '11111111-1111-1111-1111-111111111111', first_full_week, 7)
  on conflict (id) do nothing;
  insert into public.meal_slots (id, plan_version_id, name, rule, position)
  values ('88888888-8888-8888-8888-888888888881', '77777777-7777-7777-7777-777777777771', 'Desayuno', 'Plan', 1)
  on conflict (id) do nothing;

  insert into public.meal_entries (profile_id, meal_slot_id, entry_date, status)
  select '11111111-1111-1111-1111-111111111111',
         '88888888-8888-8888-8888-888888888881',
         first_full_week + day_offset,
         'met'
  from generate_series(0, 6) day_offset
  on conflict (profile_id, meal_slot_id, entry_date) do nothing;

  insert into public.workout_entries (profile_id, entry_date)
  select '11111111-1111-1111-1111-111111111111', first_full_week + day_offset
  from generate_series(0, 6) day_offset
  on conflict (profile_id, entry_date) do nothing;
end $$;

select is(
  (
    select public.is_perfect_week(
      '11111111-1111-1111-1111-111111111111',
      (select starts_on from public.competition_settings where id)
    )
  ),
  true,
  'a full week with all meals and workouts is perfect'
);

select is(
  (
    select participant->>'bonus'
    from public.compute_month_results(to_char((select starts_on from public.competition_settings where id), 'YYYY-MM'))
    cross join lateral jsonb_array_elements(compute_month_results->'participants') participant
    where participant->>'profileId' = '11111111-1111-1111-1111-111111111111'
  ),
  '2',
  'a perfect week awards two donuts'
);

select is(
  (
    select public.is_perfect_week(
      '11111111-1111-1111-1111-111111111111',
      ((select starts_on from public.competition_settings where id) - interval '7 days')::date
    )
  ),
  false,
  'a partial opening week does not award a bonus'
);

select finish();
rollback;
