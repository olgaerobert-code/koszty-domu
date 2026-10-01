-- Koszty wykończenia domu — baza w tym samym projekcie Supabase co „Plan 12 tygodni”.
-- Uruchom raz: Supabase → SQL Editor → wklej całość → Run.
--
-- Model dostępu jak w treningu: tabele są ZAMKNIĘTE dla klucza publikowalnego
-- (RLS włączony, zero polityk, odebrane uprawnienia). Cały ruch idzie przez funkcje
-- security definer, które wymagają kodu domu. Kod jest wpisany w aplikację.

-- ── dane: jeden dokument na dom ──────────────────────────────────────────────
create table if not exists public.koszty_dom (
  dom_key text        primary key check (char_length(dom_key) between 12 and 64),
  dane    jsonb       not null,
  wersja  bigint      not null default 1,
  ts      timestamptz not null default now()
);
alter table public.koszty_dom enable row level security;
revoke all on table public.koszty_dom from anon, authenticated;

-- Kopia każdej poprzedniej wersji (ostatnie 300), żeby dało się cofnąć zmianę.
create table if not exists public.koszty_historia (
  dom_key text        not null,
  wersja  bigint      not null,
  opis    text,
  dane    jsonb       not null,
  ts      timestamptz not null default now(),
  primary key (dom_key, wersja)
);
alter table public.koszty_historia enable row level security;
revoke all on table public.koszty_historia from anon, authenticated;

create or replace function public.koszty_pull(p_key text)
returns table (dane jsonb, wersja bigint, ts timestamptz)
language sql
security definer
set search_path = public
as $$
  select d.dane, d.wersja, d.ts
  from public.koszty_dom d
  where char_length(p_key) >= 12
    and d.dom_key = p_key;
$$;

-- Zapis z kontrolą wersji: przechodzi tylko, gdy p_wersja = wersja w bazie
-- (0 = pierwszy zapis). Zwraca nową wersję albo -1, gdy ktoś zapisał w międzyczasie;
-- wtedy aplikacja pobiera świeże dane i nakłada zmianę jeszcze raz.
create or replace function public.koszty_push(p_key text, p_dane jsonb, p_wersja bigint, p_opis text default null)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  stara public.koszty_dom%rowtype;
  nowa  bigint;
begin
  if char_length(p_key) < 12 then
    raise exception 'nieprawidlowy kod domu';
  end if;
  if jsonb_typeof(p_dane) <> 'object' or pg_column_size(p_dane) > 2000000 then
    raise exception 'nieprawidlowe dane';
  end if;

  select * into stara from public.koszty_dom where dom_key = p_key for update;

  if not found then
    if p_wersja <> 0 then return -1; end if;
    insert into public.koszty_dom (dom_key, dane, wersja, ts) values (p_key, p_dane, 1, now());
    return 1;
  end if;

  if stara.wersja <> p_wersja then
    return -1;
  end if;

  insert into public.koszty_historia (dom_key, wersja, opis, dane, ts)
  values (p_key, stara.wersja, left(p_opis, 300), stara.dane, stara.ts)
  on conflict do nothing;
  delete from public.koszty_historia
  where dom_key = p_key and wersja <= stara.wersja - 300;

  nowa := stara.wersja + 1;
  update public.koszty_dom set dane = p_dane, wersja = nowa, ts = now() where dom_key = p_key;
  return nowa;
end;
$$;

-- ── paragony i faktury (zdjęcia, PDF) ────────────────────────────────────────
create table if not exists public.koszty_pliki (
  dom_key text        not null,
  id      text        not null check (char_length(id) between 6 and 80),
  typ     text        not null check (typ in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  dane    text        not null,
  ts      timestamptz not null default now(),
  primary key (dom_key, id)
);
alter table public.koszty_pliki enable row level security;
revoke all on table public.koszty_pliki from anon, authenticated;

create or replace function public.koszty_plik_push(p_key text, p_id text, p_typ text, p_dane text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if char_length(p_key) < 12 then
    raise exception 'nieprawidlowy kod domu';
  end if;
  if char_length(p_dane) > 14000000 then
    raise exception 'plik za duzy';
  end if;
  insert into public.koszty_pliki (dom_key, id, typ, dane)
  values (p_key, p_id, p_typ, p_dane)
  on conflict (dom_key, id) do update set typ = excluded.typ, dane = excluded.dane, ts = now();
end;
$$;

create or replace function public.koszty_plik_pull(p_key text, p_id text)
returns table (typ text, dane text)
language sql
security definer
set search_path = public
as $$
  select f.typ, f.dane
  from public.koszty_pliki f
  where char_length(p_key) >= 12
    and f.dom_key = p_key
    and f.id = p_id;
$$;

create or replace function public.koszty_plik_usun(p_key text, p_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.koszty_pliki
  where char_length(p_key) >= 12 and dom_key = p_key and id = p_id;
$$;

revoke all on function public.koszty_pull(text)                         from public;
revoke all on function public.koszty_push(text, jsonb, bigint, text)    from public;
revoke all on function public.koszty_plik_push(text, text, text, text)  from public;
revoke all on function public.koszty_plik_pull(text, text)              from public;
revoke all on function public.koszty_plik_usun(text, text)              from public;
grant execute on function public.koszty_pull(text)                        to anon, authenticated;
grant execute on function public.koszty_push(text, jsonb, bigint, text)   to anon, authenticated;
grant execute on function public.koszty_plik_push(text, text, text, text) to anon, authenticated;
grant execute on function public.koszty_plik_pull(text, text)             to anon, authenticated;
grant execute on function public.koszty_plik_usun(text, text)             to anon, authenticated;

-- Sprawdzenie po uruchomieniu — powinno zwrócić pustą tabelę, nie błąd:
--   select * from public.koszty_pull('TEST-KOD-1234');
