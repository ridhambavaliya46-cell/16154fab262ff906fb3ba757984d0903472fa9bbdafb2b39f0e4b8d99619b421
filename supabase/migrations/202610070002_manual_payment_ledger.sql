begin;

-- Revenue is recorded only when an admin verifies an actual payment receipt.
-- A user's PRO plan flag is access state, not accounting data.
create table if not exists public.manual_payment_records (
  id text primary key,
  user_id text not null references public.users(id) on delete restrict,
  amount_inr integer not null check (amount_inr > 0),
  payment_method text not null check (payment_method in ('upi', 'bank_transfer', 'cash', 'other')),
  transaction_reference text not null check (char_length(transaction_reference) between 4 and 128),
  payment_request_reference text not null check (payment_request_reference ~ '^RSA-([A-Z2-7]{8}|[A-Z2-7]{16})-[A-F0-9]{10}$'),
  note text not null default '' check (char_length(note) <= 500),
  recorded_by text not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint manual_payment_transaction_unique unique (payment_method, transaction_reference)
);

create index if not exists manual_payment_user_created_idx
  on public.manual_payment_records (user_id, created_at desc);
create index if not exists manual_payment_created_idx
  on public.manual_payment_records (created_at desc);
alter table public.manual_payment_records enable row level security;

create or replace function public.record_manual_payment(
  p_id text,
  p_user_id text,
  p_amount_inr integer,
  p_payment_method text,
  p_transaction_reference text,
  p_payment_request_reference text,
  p_required_amount_inr integer,
  p_note text,
  p_recorded_by text
)
returns setof public.manual_payment_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_received integer;
begin
  if p_amount_inr <= 0
    or p_required_amount_inr <= 0
    or p_payment_method not in ('upi', 'bank_transfer', 'cash', 'other')
    or char_length(trim(p_transaction_reference)) not between 4 and 128
    or p_payment_request_reference !~ '^RSA-([A-Z2-7]{8}|[A-Z2-7]{16})-[A-F0-9]{10}$'
    or char_length(coalesce(p_note, '')) > 500 then
    raise exception 'invalid manual payment details';
  end if;

  if not exists (select 1 from public.users where id = p_user_id)
    or not exists (select 1 from public.users where id = p_recorded_by and (is_admin or role in ('ADMIN', 'OWNER'))) then
    raise exception 'payment user or recording admin is invalid';
  end if;

  -- Serialize receipts for this account so simultaneous partial payments
  -- cannot both calculate totals from an incomplete snapshot.
  perform 1 from public.users where id = p_user_id for update;

  insert into public.manual_payment_records (
    id, user_id, amount_inr, payment_method, transaction_reference,
    payment_request_reference, note, recorded_by
  ) values (
    p_id, p_user_id, p_amount_inr, p_payment_method, trim(p_transaction_reference),
    p_payment_request_reference, coalesce(p_note, ''), p_recorded_by
  );

  select coalesce(sum(amount_inr), 0)::integer into v_total_received
    from public.manual_payment_records
    where payment_request_reference = p_payment_request_reference
      and user_id = p_user_id;

  -- Partial receipts are recorded, but Pro only activates after the verified
  -- total for this signed request reaches the server's current monthly price.
  if v_total_received >= p_required_amount_inr then
    update public.users set current_plan = 'PRO' where id = p_user_id;
  end if;
  return query select * from public.manual_payment_records where id = p_id;
end;
$$;

revoke all on table public.manual_payment_records from public, anon, authenticated;
revoke all on function public.record_manual_payment(text, text, integer, text, text, text, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.record_manual_payment(text, text, integer, text, text, text, integer, text, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
