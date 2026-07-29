-- 동시에 지원해 둘 수 있는 프로젝트 수를 크루당 최대 3개로 제한합니다.
-- 취소/거절된 지원은 다시 지원할 수 있도록 active 집계에서 제외합니다.

create or replace function public.enforce_active_application_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_active_count int;
begin
  -- 같은 크루의 동시 지원 요청을 직렬화해 검사 우회를 막습니다.
  perform pg_advisory_xact_lock(hashtextextended(new.applicant_id::text, 0));

  if new.status in ('PENDING', 'ACCEPTED') then
    select count(*)::int
      into v_active_count
      from public.applications
     where applicant_id = new.applicant_id
       and status in ('PENDING', 'ACCEPTED')
       and (tg_op = 'INSERT' or id <> new.id);

    if v_active_count >= 3 then
      raise exception using
        errcode = 'check_violation',
        message = E'동시에 지원할 수 있는 프로젝트는 최대 3개예요.\n기존 지원을 하나 취소한 뒤 다시 시도해 주세요.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists applications_active_limit on public.applications;
create trigger applications_active_limit
  before insert or update of applicant_id, status on public.applications
  for each row execute function public.enforce_active_application_limit();
