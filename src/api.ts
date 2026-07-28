/* meeTeam 데이터 계층 — Supabase (Postgres + Auth + Storage)
 *
 * 비즈니스 규칙은 여기서 방어하지 않습니다. DB가 강제합니다:
 *  - 1인 1지원        → applications_one_active (partial unique index)
 *  - 본인 프로젝트 지원 → applications_insert RLS 정책
 *  - 정원 초과 방지    → accept_application() RPC 의 FOR UPDATE 락
 *  - 오너만 수락/거절  → RLS + RPC 내부 auth.uid() 검사
 * 클라이언트 체크는 UI 힌트일 뿐이라, 요청을 조작해도 뚫리지 않습니다.
 */
import { supabase, gradientFor } from './lib/supabase';

export type User = {
  id: string;
  githubLogin: string;
  crewName: string | null;
  fields: string[];
  skills: string[];
  avatarGradient: string;
  avatarUrl?: string | null;
  bio?: string | null;
  isAdmin?: boolean;
  onboarded: boolean;
};

export type ProjectStatus = 'PENDING' | 'RECRUITING' | 'CLOSED' | 'CONFIRMED' | 'REJECTED';

export type Slot = { field: string; capacity: number; confirmed: number; skills: string[] };
export type Member = { name: string; field: string; avatarGradient: string; avatarUrl?: string | null };

export type Project = {
  id: string;
  title: string;
  desc: string;
  /** 마크다운 원문. 빈 줄까지 그대로 — 문단·목록 구분이 여기에 달려 있어요 */
  description: string;
  prototype: string | null;
  coverImage: string | null;
  summary: string | null;
  deadline: string | null;
  dday: string;
  status: ProjectStatus;
  closed: boolean;      // 모집중이 아님(마감/확정/승인대기)
  confirmed: boolean;   // 팀 확정됨
  applicants: number;   // 대기 + 확정
  pending: number;      // 대기중
  likes: number;
  bookmarks: number;
  /** 누적 조회수 — 오너 본인이 연 건 빼고, 열람할 때마다 1씩 */
  views: number;
  myLike: boolean;
  myBookmark: boolean;
  slots: Slot[];
  owner: { id: string; name: string; field: string; avatarGradient: string; avatarUrl?: string | null } | null;
  members: Member[];
};

export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'canceled';

export type Application = {
  id: string;
  projectId: string;
  projectTitle: string;
  projectOwner: string;
  field: string;
  message: string;
  status: ApplicationStatus;
  applicant: {
    id: string;
    name: string;
    fields: string[];
    skills: string[];
    avatarGradient: string;
    avatarUrl?: string | null;
  } | null;
};

/** 현재 운영하는 모집 분야. 과거에 있던 기획 · 디자인 · iOS 는 더 이상 쓰지 않습니다. */
export const FIELDS = ['백엔드', '프론트엔드', '안드로이드'];

const CURRENT_FIELDS = new Set(FIELDS);

/**
 * 프로필에 남아 있는 과거 분야를 걷어냅니다.
 * 선택지에서만 빼면 화면엔 안 보여도 값은 그대로 남아, 프로필을 저장할 때 다시 따라 들어옵니다.
 * DB 정리(마이그레이션)와 별개로 읽는 쪽에서도 한 번 더 막아 둡니다.
 */
export const currentFields = (fields: string[] | null | undefined): string[] =>
  (fields ?? []).filter((f) => CURRENT_FIELDS.has(f));

export const FIELD_SHORT: Record<string, string> = {
  백엔드: 'BE',
  프론트엔드: 'FE',
  안드로이드: 'AOS',
};

export type FeedbackKind = 'BUG' | 'IMPROVEMENT' | 'FEATURE' | 'ETC';

export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  BUG: '버그 제보',
  IMPROVEMENT: '개선 제안',
  FEATURE: '기능 요청',
  ETC: '기타',
};

export type Feedback = {
  id: string;
  kind: FeedbackKind;
  message: string;
  status: 'OPEN' | 'DONE';
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null; avatarGradient: string } | null;
};

type FeedbackRow = {
  id: string;
  kind: FeedbackKind;
  message: string;
  status: 'OPEN' | 'DONE';
  created_at: string;
  author: { id: string; crew_name: string | null; avatar_url: string | null } | null;
};

/** 프로젝트 등록/수정 공용 입력 */
export type ProjectInput = {
  title: string;
  summary?: string;
  desc: string;
  prototype?: string;
  coverImage?: string;
  slots: { field: string; capacity: number; skills: string[] }[];
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Postgres 에러를 사용자 언어로 옮깁니다. */
function toApiError(error: { message: string; code?: string } | null, fallback: string): ApiError {
  if (!error) return new ApiError(500, fallback);
  const msg = error.message ?? '';
  // 23505(unique 위반)는 제약 이름을 먼저 봐야 합니다.
  // 코드만 보고 뭉뚱그리면 크루명 중복에도 "이미 지원한 프로젝트예요"가 나가요.
  if (msg.includes('projects_one_per_owner'))
    return new ApiError(
      409,
      '이미 등록한 프로젝트가 있어요. 하나만 등록할 수 있으니 기존 프로젝트를 삭제한 뒤 다시 등록해 주세요',
    );
  if (msg.includes('applications_one_active'))
    return new ApiError(409, '이미 지원한 프로젝트예요');
  if (msg.includes('crews_crew_name_key'))
    return new ApiError(409, '이미 사용 중인 크루명이에요');
  if (error.code === '23505') return new ApiError(409, msg || '이미 등록된 내용이에요');
  if (error.code === '42501' || msg.includes('row-level security'))
    return new ApiError(403, '권한이 없어요. 내 프로젝트에는 지원할 수 없어요');
  if (msg.includes('정원이 찼어요')) return new ApiError(409, msg.replace(/^.*?:\s*/, ''));
  if (msg.includes('오너만')) return new ApiError(403, '오너만 처리할 수 있어요');
  return new ApiError(400, msg || fallback);
}

const toStatus = (s: string): ApplicationStatus =>
  s.toLowerCase() as ApplicationStatus;

/** 카드 미리보기용 — 마크다운 기호를 걷어내고 평문만 남깁니다 */
export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/^\s*[-*_]{3,}\s*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function ddayFrom(deadline: string | null): string {
  if (!deadline) return 'D-14';
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  return days <= 0 ? '마감' : `D-${days}`;
}

/* ── row → 도메인 객체 ─────────────────────────────────────── */

type CrewRow = {
  id: string;
  github_login: string;
  crew_name: string | null;
  fields: string[] | null;
  skills: string[] | null;
  avatar_url: string | null;
  bio: string | null;
  is_admin?: boolean;
  onboarded: boolean;
};

const toUser = (c: CrewRow): User => ({
  id: c.id,
  githubLogin: c.github_login,
  crewName: c.crew_name,
  fields: currentFields(c.fields),
  skills: c.skills ?? [],
  avatarUrl: c.avatar_url,
  bio: c.bio,
  isAdmin: c.is_admin ?? false,
  avatarGradient: gradientFor(c.id),
  onboarded: c.onboarded,
});

const PROJECT_SELECT = `
  id, title, summary, description, cover_image, prototype_url, deadline, status,
  owner:crews!projects_owner_id_fkey ( id, crew_name, fields, avatar_url )
`;

type ProjectRow = {
  id: string;
  title: string;
  summary: string | null;
  description: string;
  cover_image: string | null;
  prototype_url: string | null;
  deadline: string | null;
  status: string;
  owner: { id: string; crew_name: string | null; fields: string[] | null; avatar_url: string | null } | null;
};

type SlotRow = {
  project_id: string;
  field: string;
  capacity: number;
  confirmed: number;
  skills: string[] | null;
};
type MemberRow = {
  project_id: string;
  crew_id: string;
  crew_name: string | null;
  avatar_url: string | null;
  field: string;
};

function toProject(row: ProjectRow, slots: SlotRow[], members: MemberRow[]): Project {
  const mySlots = slots
    .filter((s) => s.project_id === row.id)
    .map((s) => ({
      field: s.field,
      capacity: s.capacity,
      confirmed: s.confirmed,
      skills: s.skills ?? [],
    }));

  return {
    id: row.id,
    title: row.title,
    desc: row.summary?.trim() || stripMarkdown(row.description).slice(0, 90),
    description: row.description,
    prototype: row.prototype_url,
    coverImage: row.cover_image,
    summary: row.summary,
    deadline: row.deadline,
    dday: ddayFrom(row.deadline),
    status: row.status as ProjectStatus,
    closed: row.status !== 'RECRUITING',
    confirmed: row.status === 'CONFIRMED',
    applicants: 0,
    pending: 0,
    likes: 0,
    bookmarks: 0,
    views: 0,
    myLike: false,
    myBookmark: false,
    slots: mySlots,
    owner: row.owner
      ? {
          id: row.owner.id,
          name: row.owner.crew_name ?? '크루',
          field: currentFields(row.owner.fields)[0] ?? '',
          avatarGradient: gradientFor(row.owner.id),
          avatarUrl: row.owner.avatar_url,
        }
      : null,
    members: members
      .filter((m) => m.project_id === row.id)
      .map((m) => ({
        name: m.crew_name ?? '크루',
        field: m.field,
        avatarGradient: gradientFor(m.crew_id),
        avatarUrl: m.avatar_url,
      })),
  };
}

/** 여러 프로젝트의 슬롯/멤버/집계를 한 번에 가져와 N+1 을 피합니다. */
async function hydrate(rows: ProjectRow[]): Promise<Project[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const { data: auth } = await supabase.auth.getUser();
  const myId = auth.user?.id;

  const [slotsRes, membersRes, applicantRes, reactionRes, viewRes, myReactRes] = await Promise.all([
    supabase.from('project_slot_status').select('*').in('project_id', ids),
    supabase.from('project_members').select('*').in('project_id', ids),
    supabase.from('project_applicant_counts').select('*').in('project_id', ids),
    supabase.from('project_reaction_counts').select('*').in('project_id', ids),
    supabase.from('project_view_counts').select('*').in('project_id', ids),
    myId
      ? supabase.from('project_reactions').select('project_id, kind').in('project_id', ids)
      : Promise.resolve({ data: [] as { project_id: string; kind: string }[] }),
  ]);

  const slots = (slotsRes.data ?? []) as SlotRow[];
  const members = (membersRes.data ?? []) as MemberRow[];
  const applicants = new Map(
    ((applicantRes.data ?? []) as { project_id: string; pending: number; applicants: number }[]).map(
      (a) => [a.project_id, a],
    ),
  );
  const reactions = new Map(
    ((reactionRes.data ?? []) as { project_id: string; likes: number; bookmarks: number }[]).map(
      (r) => [r.project_id, r],
    ),
  );
  const views = new Map(
    ((viewRes.data ?? []) as { project_id: string; views: number }[]).map((v) => [
      v.project_id,
      v.views,
    ]),
  );
  const mine = new Set(
    ((myReactRes.data ?? []) as { project_id: string; kind: string }[]).map(
      (r) => `${r.project_id}:${r.kind}`,
    ),
  );

  return rows.map((r) => {
    const p = toProject(r, slots, members);
    const a = applicants.get(r.id);
    const rc = reactions.get(r.id);
    p.pending = a?.pending ?? 0;
    p.applicants = a?.applicants ?? 0;
    p.likes = rc?.likes ?? 0;
    p.views = views.get(r.id) ?? 0;
    p.bookmarks = rc?.bookmarks ?? 0;
    p.myLike = mine.has(`${r.id}:LIKE`);
    p.myBookmark = mine.has(`${r.id}:BOOKMARK`);
    return p;
  });
}

/* ── API ───────────────────────────────────────────────────── */

export const api = {
  /** GitHub OAuth 시작 — 리다이렉트되므로 반환되지 않습니다 (FR-AUTH-01) */
  async login() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw toApiError(error, '로그인에 실패했어요');
  },

  async logout() {
    await supabase.auth.signOut();
  },

  /** 로그인한 크루 프로필. 미로그인이면 401 */
  async me(): Promise<User> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new ApiError(401, '로그인이 필요해요');
    const { data, error } = await supabase
      .from('crews')
      .select('*')
      .eq('id', auth.user.id)
      .single();
    if (error || !data) throw new ApiError(401, '프로필을 불러오지 못했어요');
    return toUser(data as CrewRow);
  },

  /** 프로필 저장 — 온보딩/부분 수정 공용. 준 필드만 갱신합니다 (FR-ONB, FR-MY-01) */
  async updateMe(body: {
    crewName?: string;
    fields?: string[];
    skills?: string[];
    bio?: string | null;
    onboarded?: boolean;
  }): Promise<User> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new ApiError(401, '로그인이 필요해요');

    const patch: Record<string, unknown> = {};
    if (body.crewName !== undefined) patch.crew_name = body.crewName.trim();
    if (body.fields !== undefined) patch.fields = body.fields;
    if (body.skills !== undefined) patch.skills = body.skills;
    if (body.bio !== undefined) patch.bio = body.bio?.trim() || null;
    if (body.onboarded !== undefined) patch.onboarded = body.onboarded;

    const { data, error } = await supabase
      .from('crews')
      .update(patch)
      .eq('id', auth.user.id)
      .select()
      .single();
    if (error) throw toApiError(error, '프로필 저장에 실패했어요');
    const user = toUser(data as CrewRow);

    /* 온보딩을 끝까지 누르지 않고 나간 크루는 onboarded 가 false 로 남습니다.
     * 이후 프로필 수정으로 이름·분야·스킬을 다 채워도 이 값은 그대로라,
     * 본인은 멀쩡히 쓰는데 크루 목록에서는 계속 빠져 보이지 않아요.
     * 프로필이 갖춰졌다면 온보딩을 마친 것으로 봅니다. */
    if (!user.onboarded && user.crewName && user.fields.length > 0 && user.skills.length > 0) {
      const { error: promoteError } = await supabase
        .from('crews')
        .update({ onboarded: true })
        .eq('id', auth.user.id);
      if (!promoteError) user.onboarded = true;
    }
    return user;
  },

  /** 크루 한 명 상세 */
  async crew(id: string): Promise<User> {
    const { data, error } = await supabase.from('crews').select('*').eq('id', id).single();
    if (error || !data) throw new ApiError(404, '크루를 찾을 수 없어요');
    return toUser(data as CrewRow);
  },

  /** 특정 크루가 등록한 프로젝트 */
  async projectsByOwner(ownerId: string): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });
    if (error) throw toApiError(error, '프로젝트를 불러오지 못했어요');
    return hydrate((data ?? []) as unknown as ProjectRow[]);
  },

  /* ── 제보 ─────────────────────────────────────────────── */

  /** 불편사항 · 개선 · 기능 제안 보내기 */
  async sendFeedback(body: { kind: FeedbackKind; message: string }): Promise<void> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new ApiError(401, '로그인이 필요해요');
    const { error } = await supabase.from('feedbacks').insert({
      author_id: auth.user.id,
      kind: body.kind,
      message: body.message.trim(),
    });
    if (error) throw toApiError(error, '제보 전송에 실패했어요');
  },

  /** 제보 목록 — 본인 것 + (관리자면) 전체. RLS 가 범위를 결정합니다 */
  async feedbacks(): Promise<Feedback[]> {
    const { data, error } = await supabase
      .from('feedbacks')
      .select('id, kind, message, status, created_at, author:crews(id, crew_name, avatar_url)')
      .order('created_at', { ascending: false });
    if (error) throw toApiError(error, '제보를 불러오지 못했어요');
    return (data ?? []).map((r) => {
      const row = r as unknown as FeedbackRow;
      return {
        id: row.id,
        kind: row.kind,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
        author: row.author
          ? {
              id: row.author.id,
              name: row.author.crew_name ?? '크루',
              avatarUrl: row.author.avatar_url,
              avatarGradient: gradientFor(row.author.id),
            }
          : null,
      };
    });
  },

  /** 제보 처리 상태 변경 (관리자 전용 — RLS 강제) */
  async setFeedbackStatus(id: string, status: 'OPEN' | 'DONE'): Promise<void> {
    const { error } = await supabase.from('feedbacks').update({ status }).eq('id', id);
    if (error) throw toApiError(error, '상태 변경에 실패했어요');
  },

  /** 관리자 대시보드용 간단 집계 */
  async adminStats(): Promise<{
    crews: number;
    projects: number;
    recruiting: number;
    pending: number;
    feedbacks: number;
  }> {
    const [c, p, f] = await Promise.all([
      supabase.from('crews').select('id', { count: 'exact', head: true }).eq('onboarded', true),
      supabase.from('projects').select('id,status', { count: 'exact' }),
      supabase.from('feedbacks').select('id', { count: 'exact', head: true }),
    ]);
    const projects = (p.data ?? []) as { status: string }[];
    return {
      crews: c.count ?? 0,
      projects: p.count ?? 0,
      recruiting: projects.filter((x) => x.status === 'RECRUITING').length,
      pending: projects.filter((x) => x.status === 'PENDING').length,
      feedbacks: f.count ?? 0,
    };
  },

  /** 온보딩을 마친 크루 목록 (네비게이션 → 크루) */
  async crews(): Promise<User[]> {
    const { data, error } = await supabase
      .from('crews')
      .select('*')
      .eq('onboarded', true)
      .order('created_at', { ascending: false });
    if (error) throw toApiError(error, '크루를 불러오지 못했어요');
    return (data ?? []).map((c) => toUser(c as CrewRow));
  },

  async projects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .order('created_at', { ascending: false });
    if (error) throw toApiError(error, '프로젝트를 불러오지 못했어요');
    return hydrate((data ?? []) as unknown as ProjectRow[]);
  },

  async myProjects(): Promise<Project[]> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new ApiError(401, '로그인이 필요해요');
    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('owner_id', auth.user.id)
      .order('created_at', { ascending: false });
    if (error) throw toApiError(error, '프로젝트를 불러오지 못했어요');
    return hydrate((data ?? []) as unknown as ProjectRow[]);
  },

  async project(id: string): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('id', id)
      .single();
    if (error || !data) throw new ApiError(404, '프로젝트를 찾을 수 없어요');
    const [project] = await hydrate([data as unknown as ProjectRow]);
    return project;
  },

  /** 커버 이미지를 Storage 에 올리고 공개 URL 을 돌려줍니다 (base64 대신) */
  async uploadCover(file: File): Promise<string> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new ApiError(401, '로그인이 필요해요');
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${auth.user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from('project-covers')
      .upload(path, file, { cacheControl: '31536000', upsert: false });
    if (error) throw toApiError(error, '이미지 업로드에 실패했어요');
    return supabase.storage.from('project-covers').getPublicUrl(path).data.publicUrl;
  },

  /** 프로젝트 + 슬롯을 한 트랜잭션으로 생성 (FR-PRJ-01) */
  async createProject(body: ProjectInput): Promise<Project> {
    const { data, error } = await supabase.rpc('create_project', {
      p_title: body.title.trim(),
      p_summary: body.summary ?? '',
      p_description: body.desc.trim(),
      p_cover_image: body.coverImage ?? '',
      p_prototype: body.prototype ?? '',
      p_slots: body.slots,
    });
    if (error) throw toApiError(error, '등록에 실패했어요');
    return api.project((data as { id: string }).id);
  },

  /** 오너가 등록한 프로젝트 수정 (FR-PRJ-06) — 확정 인원 훼손은 DB가 거부 */
  async updateProject(id: string, body: ProjectInput): Promise<Project> {
    const { error } = await supabase.rpc('update_project', {
      p_id: id,
      p_title: body.title.trim(),
      p_summary: body.summary ?? '',
      p_description: body.desc.trim(),
      p_cover_image: body.coverImage ?? '',
      p_prototype: body.prototype ?? '',
      p_slots: body.slots,
    });
    if (error) throw toApiError(error, '수정에 실패했어요');
    return api.project(id);
  },

  /** 조회 기록 — 열 때마다 한 번씩 쌓이는 누적 조회수입니다.
   *  내 프로젝트를 내가 연 건 DB 가 걸러내요.
   *  실패해도 화면에는 영향이 없어야 하므로 조용히 넘어갑니다. */
  async recordView(projectId: string): Promise<void> {
    // 누적 조회수라 비로그인 방문도 함께 셉니다. 오너 본인 조회 제외는 DB 가 맡아요.
    await supabase.rpc('record_project_view', { p_id: projectId });
  },

  /** 좋아요 · 북마크 토글 (익명 카운트) */
  async toggleReaction(projectId: string, kind: 'LIKE' | 'BOOKMARK', on: boolean) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new ApiError(401, '로그인이 필요해요');
    if (on) {
      const { error } = await supabase
        .from('project_reactions')
        .insert({ project_id: projectId, crew_id: auth.user.id, kind });
      if (error && error.code !== '23505') throw toApiError(error, '처리에 실패했어요');
    } else {
      const { error } = await supabase
        .from('project_reactions')
        .delete()
        .match({ project_id: projectId, crew_id: auth.user.id, kind });
      if (error) throw toApiError(error, '처리에 실패했어요');
    }
  },

  /** 마크다운 본문용 이미지 업로드 → 공개 URL */
  async uploadImage(file: File): Promise<string> {
    return api.uploadCover(file);
  },

  /** 프로젝트 삭제 (FR-PRJ-06) — RLS 로 오너만. 슬롯·지원서는 cascade */
  async deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw toApiError(error, '삭제에 실패했어요');
    return { ok: true as const };
  },

  /* ── 생명주기 ──────────────────────────────────────────── */

  /** 코치(관리자) 승인/반려 — PENDING 프로젝트만 */
  async approveProject(id: string, approve: boolean): Promise<void> {
    const { error } = await supabase.rpc('approve_project', { p_id: id, p_approve: approve });
    if (error) throw toApiError(error, '승인 처리에 실패했어요');
  },

  /** 팀 확정 (오너, 정원 충족 시) — 1인 1팀을 DB 가 강제 */
  async confirmTeam(id: string): Promise<Project> {
    const { error } = await supabase.rpc('confirm_team', { p_id: id });
    if (error) throw toApiError(error, '팀 확정에 실패했어요');
    return api.project(id);
  },

  /** 팀 확정 되돌리기 — 되돌리면 다시 모집중으로 돌아옵니다.
   *  (unconfirm_team 은 CLOSED 로만 내려주기 때문에, 그대로 두면 '모집 마감'에 갇혀요) */
  async unconfirmTeam(id: string): Promise<Project> {
    const { error } = await supabase.rpc('unconfirm_team', { p_id: id });
    if (error) throw toApiError(error, '되돌리기에 실패했어요');
    const { error: reopenError } = await supabase.rpc('set_recruiting', { p_id: id, p_open: true });
    if (reopenError) throw toApiError(reopenError, '모집 상태를 되돌리지 못했어요');
    return api.project(id);
  },

  /** 모집 중단/재개 (오너가 다른 팀에 합류하려 할 때 등) */
  async setRecruiting(id: string, open: boolean): Promise<Project> {
    const { error } = await supabase.rpc('set_recruiting', { p_id: id, p_open: open });
    if (error) throw toApiError(error, '상태 변경에 실패했어요');
    return api.project(id);
  },

  /** 승인 대기 중인 프로젝트 (관리자) */
  async pendingProjects(): Promise<Project[]> {
    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .in('status', ['PENDING', 'REJECTED'])
      .order('created_at', { ascending: true });
    if (error) throw toApiError(error, '프로젝트를 불러오지 못했어요');
    return hydrate((data ?? []) as unknown as ProjectRow[]);
  },

  /** 내가 속한 확정된 팀 (오너이거나 수락된 멤버) */
  async myTeams(): Promise<Project[]> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new ApiError(401, '로그인이 필요해요');
    const uid = auth.user.id;

    // 내가 오너인 확정 팀
    const owned = await supabase
      .from('projects')
      .select(PROJECT_SELECT)
      .eq('owner_id', uid)
      .eq('status', 'CONFIRMED');
    // 내가 수락된 확정 팀
    const memberApps = await supabase
      .from('applications')
      .select('project_id')
      .eq('applicant_id', uid)
      .eq('status', 'ACCEPTED');
    const memberIds = ((memberApps.data ?? []) as { project_id: string }[]).map((a) => a.project_id);
    const member = memberIds.length
      ? await supabase
          .from('projects')
          .select(PROJECT_SELECT)
          .in('id', memberIds)
          .eq('status', 'CONFIRMED')
      : { data: [] as unknown[] };

    const rows = [
      ...((owned.data ?? []) as unknown[]),
      ...((member.data ?? []) as unknown[]),
    ] as ProjectRow[];
    // 중복 제거
    const uniq = Array.from(new Map(rows.map((r) => [r.id, r])).values());
    return hydrate(uniq);
  },

  /** 아직 확정된 팀이 없는 크루 (도움이 필요한 크루) */
  async crewsLookingForTeam(): Promise<User[]> {
    const [crews, status] = await Promise.all([
      supabase.from('crews').select('*').eq('onboarded', true),
      supabase.from('crew_team_status').select('*'),
    ]);
    if (crews.error) throw toApiError(crews.error, '크루를 불러오지 못했어요');
    const teamed = new Set(
      ((status.data ?? []) as { crew_id: string; teamed: boolean }[])
        .filter((s) => s.teamed)
        .map((s) => s.crew_id),
    );
    return ((crews.data ?? []) as CrewRow[]).map(toUser).filter((c) => !teamed.has(c.id));
  },

  /** 지원 (FR-APP) — 중복/본인/마감 차단은 DB가 담당 */
  async apply(projectId: string, body: { field: string; message: string }): Promise<Application> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new ApiError(401, '로그인이 필요해요');
    const { data, error } = await supabase
      .from('applications')
      .insert({
        project_id: projectId,
        applicant_id: auth.user.id,
        field: body.field,
        message: body.message.trim(),
      })
      .select()
      .single();
    if (error) throw toApiError(error, '지원에 실패했어요');
    const list = await api.myApplications();
    return list.find((a) => a.id === (data as { id: string }).id) ?? (data as unknown as Application);
  },

  /** 지원 취소 (FR-APP-06) — 대기 중에만 가능하도록 RLS 가 강제 */
  async cancelApplication(id: string) {
    const { error } = await supabase.from('applications').update({ status: 'CANCELED' }).eq('id', id);
    if (error) throw toApiError(error, '취소에 실패했어요');
    return { ok: true as const };
  },

  async myApplications(): Promise<Application[]> {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new ApiError(401, '로그인이 필요해요');
    const { data, error } = await supabase
      .from('applications')
      .select(
        `id, project_id, field, message, status,
         project:projects ( title, owner:crews!projects_owner_id_fkey ( crew_name ) ),
         applicant:crews!applications_applicant_id_fkey ( id, crew_name, fields, skills, avatar_url )`,
      )
      .eq('applicant_id', auth.user.id)
      .neq('status', 'CANCELED')
      .order('created_at', { ascending: false });
    if (error) throw toApiError(error, '지원 내역을 불러오지 못했어요');
    return (data ?? []).map((r) => mapApplication(r as unknown as ApplicationRow));
  },

  /** 오너용 지원자 목록 (FR-MEM-01) — RLS 로 오너만 조회 가능 */
  async projectApplications(projectId: string): Promise<{ project: Project; applications: Application[] }> {
    const [project, res] = await Promise.all([
      api.project(projectId),
      supabase
        .from('applications')
        .select(
          `id, project_id, field, message, status,
           project:projects ( title, owner:crews!projects_owner_id_fkey ( crew_name ) ),
           applicant:crews!applications_applicant_id_fkey ( id, crew_name, fields, skills, avatar_url )`,
        )
        .eq('project_id', projectId)
        .neq('status', 'CANCELED')
        .order('created_at', { ascending: true }),
    ]);
    if (res.error) throw toApiError(res.error, '지원자를 불러오지 못했어요');
    return {
      project,
      applications: (res.data ?? []).map((r) => mapApplication(r as unknown as ApplicationRow)),
    };
  },

  /** 수락/거절/되돌리기 (FR-MEM-02/03/05) */
  async setApplicationStatus(
    id: string,
    status: 'accepted' | 'rejected' | 'pending',
  ): Promise<{ application: Application; project: Project }> {
    let projectId: string;

    if (status === 'accepted') {
      // 정원 가드를 원자적으로 처리하는 RPC
      const { data, error } = await supabase.rpc('accept_application', { app_id: id });
      if (error) throw toApiError(error, '수락에 실패했어요');
      projectId = (data as { project_id: string }).project_id;
    } else {
      const { data, error } = await supabase
        .from('applications')
        .update({ status: status.toUpperCase() })
        .eq('id', id)
        .select('project_id')
        .single();
      if (error) throw toApiError(error, '처리에 실패했어요');
      projectId = (data as { project_id: string }).project_id;
    }

    const { project, applications } = await api.projectApplications(projectId);
    const application = applications.find((a) => a.id === id)!;
    return { application, project };
  },
};

type ApplicationRow = {
  id: string;
  project_id: string;
  field: string;
  message: string;
  status: string;
  project: { title: string; owner: { crew_name: string | null } | null } | null;
  applicant: {
    id: string;
    crew_name: string | null;
    fields: string[] | null;
    skills: string[] | null;
    avatar_url: string | null;
  } | null;
};

function mapApplication(r: ApplicationRow): Application {
  return {
    id: r.id,
    projectId: r.project_id,
    projectTitle: r.project?.title ?? '',
    projectOwner: r.project?.owner?.crew_name ?? '',
    field: r.field,
    message: r.message,
    status: toStatus(r.status),
    applicant: r.applicant
      ? {
          id: r.applicant.id,
          name: r.applicant.crew_name ?? '크루',
          fields: currentFields(r.applicant.fields),
          skills: r.applicant.skills ?? [],
          avatarGradient: gradientFor(r.applicant.id),
          avatarUrl: r.applicant.avatar_url,
        }
      : null,
  };
}
