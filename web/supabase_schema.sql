-- SessionFoundry schema: sessions, activities, submissions, votes, stocktake

-- enums
create type activity_type as enum ('brainstorm','stocktake','assignment');
create type activity_status as enum ('Draft','Active','Voting','Closed');
create type stocktake_choice as enum ('stop','less','same','more','begin');

-- sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'Inactive',
  join_code text not null unique,
  facilitator_user_id uuid,
  created_at timestamptz not null default now()
);

-- activities
create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  type activity_type not null,
  title text not null,
  instructions text,
  description text,
  config jsonb not null default '{}'::jsonb,
  order_index int not null default 0,
  status activity_status not null default 'Draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists activities_session_idx on activities(session_id);

-- brainstorming
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  participant_id text not null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists submissions_activity_idx on submissions(activity_id);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  submission_id uuid not null references submissions(id) on delete cascade,
  voter_id text not null,
  value int not null check (value between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists votes_activity_idx on votes(activity_id);
create unique index if not exists votes_unique on votes(activity_id, submission_id, voter_id);

-- stocktake
create table if not exists stocktake_initiatives (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  title text not null
);
create index if not exists stocktake_initiatives_activity_idx on stocktake_initiatives(activity_id);

create table if not exists stocktake_responses (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  initiative_id uuid not null references stocktake_initiatives(id) on delete cascade,
  participant_id text not null,
  choice stocktake_choice not null,
  created_at timestamptz not null default now()
);
create index if not exists stocktake_responses_activity_idx on stocktake_responses(activity_id);
create unique index if not exists stocktake_unique on stocktake_responses(activity_id, initiative_id, participant_id);
