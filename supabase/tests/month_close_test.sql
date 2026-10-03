begin;

select plan(4);

do $$
declare
  month_key text := to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM');
  month_start date := (month_key || '-01')::date;
  week_start date := month_start - (extract(isodow from month_start)::int - 1);
begin
  update public.competition_settings set starts_on = month_start where id;
  insert into public.plan_versions (id, profile_id, effective_week_start, workout_target)
  values
    ('33333333-3333-3333-3333-333333333331', '11111111-1111-1111-1111-111111111111', week_start, 1),
    ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', week_start, 1)
  on conflict (id) do nothing;
  insert into public.meal_slots (id, plan_version_id, name, rule, position)
  values
    ('44444444-4444-4444-4444-444444444441', '33333333-3333-3333-3333-333333333331', 'Desayuno', 'Plan', 1),
    ('44444444-4444-4444-4444-444444444442', '33333333-3333-3333-3333-333333333332', 'Desayuno', 'Plan', 1)
  on conflict (id) do nothing;
  insert into public.meal_entries (profile_id, meal_slot_id, entry_date, status)
  values
    ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444441', month_start, 'met'),
    ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444442', month_start, 'met')
  on conflict (profile_id, meal_slot_id, entry_date) do nothing;
end $$;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select public.confirm_month(to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM')) is not null as first_confirmation;

select is(
  (select cardinality(confirmed_by) from public.months where month_key = to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM')),
  1,
  'first member confirmation is stored'
);

select public.upsert_meal_entry(
  '55555555-5555-5555-5555-555555555551',
  (date_trunc('month', current_date) - interval '1 month')::date,
  '44444444-4444-4444-4444-444444444441',
  'missed',
  1
) is not null as correction_applied;

select is(
  (select cardinality(confirmed_by) from public.months where month_key = to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM')),
  0,
  'a correction invalidates earlier confirmations'
);

select public.confirm_month(to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM')) is not null as first_reconfirmation;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select public.confirm_month(to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM')) is not null as second_confirmation;

select is(
  (select closed_at is not null from public.months where month_key = to_char(date_trunc('month', current_date) - interval '1 month', 'YYYY-MM')),
  true,
  'both confirmations close the month atomically'
);

select throws_ok(
  $$select public.upsert_workout_entry('66666666-6666-6666-6666-666666666661', (date_trunc('month', current_date) - interval '1 month')::date, null, null, 0)$$,
  'month_already_closed',
  'closed months reject later mutations'
);

select finish();
rollback;
