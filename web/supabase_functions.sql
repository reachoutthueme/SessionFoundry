-- Aggregated results per session: avg, stdev, count per submission
create or replace function sf_results_for_session(p_session_id uuid)
returns table (
  submission_id uuid,
  text text,
  avg numeric,
  stdev numeric,
  n integer
) language sql stable as $$
  select s.id as submission_id,
         s.text,
         avg(v.value)::numeric as avg,
         stddev_pop(v.value)::numeric as stdev,
         count(v.*) as n
  from submissions s
  join activities a on a.id = s.activity_id
  left join votes v on v.submission_id = s.id
  where a.session_id = p_session_id
  group by s.id, s.text
  order by n desc, avg desc nulls last;
$$;

