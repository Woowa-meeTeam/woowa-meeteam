import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);

if (!isConfigured) {
  // 배포 전 로컬에서 흔한 실수라 명확히 알려줍니다.
  console.warn(
    '[meeTeam] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 없습니다. .env.local 을 확인하세요.',
  );
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'anon', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // GitHub OAuth 리다이렉트 처리
  },
});

/** crews 테이블에는 그라데이션을 저장하지 않고 id로 결정적으로 파생합니다. */
const GRADIENTS = [
  'from-[#3182F6] to-[#00d2ff]',
  'from-[#8CE7C0] to-[#00C471]',
  'from-[#FFD18C] to-[#FF8A00]',
  'from-[#c4b5fd] to-[#6d28d9]',
  'from-[#fda4af] to-[#be123c]',
  'from-[#a5f3fc] to-[#0e7490]',
];

export function gradientFor(id: string | null | undefined): string {
  if (!id) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}
