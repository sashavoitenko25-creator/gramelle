-- Task completions (one reward per user per task)
create table if not exists task_completions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  task_id text not null,
  reward_gram numeric not null,
  created_at timestamptz not null default now(),
  unique (telegram_id, task_id)
);

create index if not exists task_completions_tg_idx on task_completions(telegram_id);

alter table task_completions enable row level security;
