import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import ProjectsShowcase from './components/ProjectsShowcase';
import FeatureMatch from './components/FeatureMatch';
import SkillCloud from './components/SkillCloud';
import Steps from './components/Steps';
import FinalCTA from './components/FinalCTA';
import Onboarding from './components/Onboarding';
import ProjectForm from './components/ProjectForm';
import ProfileEdit from './components/ProfileEdit';
import Crews from './components/Crews';
import AllProjects from './components/AllProjects';
import CrewDetail from './components/CrewDetail';
import Admin from './components/Admin';
import FeedbackWidget from './components/FeedbackWidget';
import ProjectDetail from './components/ProjectDetail';
import MyPage from './components/MyPage';
import ApplicantManage from './components/ApplicantManage';
import { GuideLine } from './components/primitives';
import { api } from './api';
import { supabase } from './lib/supabase';

const BoothMapPage = lazy(() =>
  import('./features/booths/pages').then((module) => ({ default: module.BoothMapPage })),
);
const BoothAdminPage = lazy(() =>
  import('./features/booths/pages').then((module) => ({ default: module.BoothAdminPage })),
);

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4';

/** GitHub OAuth 콜백 — 세션이 잡히면 온보딩 여부로 분기 (FR-AUTH-03) */
function AuthCallback() {
  const navigate = useNavigate();
  useEffect(() => {
    let done = false;
    const settle = async () => {
      if (done) return;
      try {
        const me = await api.me();
        done = true;
        navigate(me.onboarded ? '/' : '/onboarding', { replace: true });
      } catch {
        /* 아직 세션 반영 전 — onAuthStateChange 를 기다립니다 */
      }
    };
    const { data } = supabase.auth.onAuthStateChange(() => settle());
    settle();
    const timeout = setTimeout(() => {
      if (!done) navigate('/', { replace: true });
    }, 8000);
    return () => {
      data.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="relative z-20 min-h-screen grid place-items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
        <p className="text-sm text-white/50">GitHub 계정을 확인하고 있어요…</p>
      </div>
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, []);

  // GitHub OAuth 로 이동 (리다이렉트). 이미 로그인 상태면 바로 분기.
  const handleStart = async () => {
    try {
      const me = await api.me();
      navigate(me.onboarded ? '/my' : '/onboarding');
    } catch {
      await api.login().catch(() => navigate('/onboarding'));
    }
  };

  const explore = () =>
    document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <Navbar onStart={handleStart} onMyPage={() => navigate('/my')} />
      <Hero onStart={handleStart} loggedIn={loggedIn} onExplore={explore} />
      <ProjectsShowcase
        onRegister={() => navigate('/projects/new')}
        onSelect={(id) => navigate(`/projects/${id}`)}
      />
      <FeatureMatch />
      <SkillCloud />
      <Steps />
      <FinalCTA onStart={handleStart} loggedIn={loggedIn} onExplore={explore} />
      <FeedbackWidget />
    </>
  );
}

function BoothRoute({ admin = false }: { admin?: boolean }) {
  const navigate = useNavigate();
  const Page = admin ? BoothAdminPage : BoothMapPage;

  const handleStart = async () => {
    try {
      const me = await api.me();
      navigate(me.onboarded ? '/my' : '/onboarding');
    } catch {
      await api.login().catch(() => navigate('/onboarding'));
    }
  };

  return (
    <>
      <Navbar fixed onStart={handleStart} onMyPage={() => navigate('/my')} />
      <Suspense
        fallback={
          <div className="relative z-20 min-h-screen grid place-items-center">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          </div>
        }
      >
        <Page />
      </Suspense>
    </>
  );
}

export default function App() {
  const { pathname } = useLocation();
  const showGuideLines = pathname !== '/booths';

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#0c0c0c] text-white">
      {/* Root SVG noise filter (shiny headline) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="c3-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" />
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
        </filter>
      </svg>

      {/* Fixed full-screen background video */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover pointer-events-none"
          src={VIDEO_SRC}
        />
        <div className="absolute inset-0 bg-[#0c0c0c]/60" />
      </div>

      {/* Vertical guide lines */}
      {showGuideLines && (
        <>
          <GuideLine side="left" />
          <GuideLine side="right" />
        </>
      )}

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/projects/new" element={<ProjectForm />} />
        <Route path="/projects/:id/edit" element={<ProjectForm />} />
        <Route path="/profile/edit" element={<ProfileEdit />} />
        <Route path="/projects" element={<AllProjects />} />
        <Route path="/crews" element={<Crews />} />
        <Route path="/crews/:id" element={<CrewDetail />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/booths" element={<BoothRoute />} />
        <Route path="/booths/admin" element={<BoothRoute admin />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/projects/:id/applicants" element={<ApplicantManage />} />
        <Route path="/my" element={<MyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
