-- 执行完成后，还需要到 Supabase 的 Realtime / Replication 页面，把 public.scores 加入 realtime publication。

create extension if not exists pgcrypto;

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  player_name text not null check (char_length(trim(player_name)) between 1 and 20),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index if not exists scores_rank_idx on public.scores (score desc, created_at asc);

alter table public.scores enable row level security;

drop policy if exists "anon can read scores" on public.scores;
create policy "anon can read scores"
on public.scores
for select
to anon
using (true);

drop policy if exists "anon can insert scores" on public.scores;
create policy "anon can insert scores"
on public.scores
for insert
to anon
with check (
  char_length(trim(player_name)) between 1 and 20
  and score >= 0
);

create or replace function public.get_leaderboard(limit_count integer default 10)
returns table (
  player_name text,
  best_score integer,
  achieved_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with ranked as (
    select
      s.player_name,
      s.score as best_score,
      s.created_at as achieved_at,
      row_number() over (
        partition by s.player_name
        order by s.score desc, s.created_at asc
      ) as player_rank
    from public.scores s
  )
  select
    ranked.player_name,
    ranked.best_score,
    ranked.achieved_at
  from ranked
  where ranked.player_rank = 1
  order by ranked.best_score desc, ranked.achieved_at asc
  limit greatest(limit_count, 1);
$$;

grant execute on function public.get_leaderboard(integer) to anon;
