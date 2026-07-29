-- 기존 프로젝트 분류를 현재 탐색용 분류 체계로 통합합니다.
-- 새 선택지는 src/api.ts 의 PROJECT_CATEGORIES 와 동일하게 유지합니다.

update public.projects
set category = case category
  when '생산성' then '생산성·관리'
  when '소셜·커뮤니티' then '모임·커뮤니티'
  when '여행·지도' then '여행'
  when '건강·운동' then '생활·유틸리티'
  when '금융·자산' then '생활·유틸리티'
  when '취미·엔터테인먼트' then '생활·유틸리티'
  when '쇼핑·중고거래' then '생활·유틸리티'
  when '개발자 도구' then '생산성·관리'
  when '기타' then '생활·유틸리티'
  else category
end
where category in (
  '생산성',
  '소셜·커뮤니티',
  '여행·지도',
  '건강·운동',
  '금융·자산',
  '취미·엔터테인먼트',
  '쇼핑·중고거래',
  '개발자 도구',
  '기타'
);
