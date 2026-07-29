import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../../api"
import { isConfigured } from "../../lib/supabase"
import { BoothAdminApp, type BoothAdminSessionSnapshot } from "./admin-app"
import { BoothMapApp } from "./app"
import { createBoothLayoutRepository } from "./booth-layout-repository"
import { toBoothProject } from "./project-adapter"
import "./style.css"

type PageState = "loading" | "ready" | "error"
const boothEligibleStatuses = new Set(["RECRUITING", "CLOSED", "CONFIRMED"])
const adminSessionKey = "meeteam.booths.admin-session.v1"

function readAdminSession(): BoothAdminSessionSnapshot | null {
  try {
    const raw = sessionStorage.getItem(adminSessionKey)
    if (!raw) {
      return null
    }
    const value = JSON.parse(raw) as Partial<BoothAdminSessionSnapshot>
    if (!value.layout || !value.roomSizeModes || typeof value.scrollY !== "number") {
      return null
    }
    return value as BoothAdminSessionSnapshot
  } catch {
    return null
  }
}

function boothEligibleProjects(projects: Awaited<ReturnType<typeof api.projects>>) {
  return projects.filter((project) => boothEligibleStatuses.has(project.status))
}

function BoothPageStatus({ state, message }: { state: PageState; message: string }) {
  if (state === "ready") {
    return null
  }

  return (
    <main className="booth-page-status" role={state === "error" ? "alert" : "status"}>
      <p className="site-label">MEETEAM BOOTH MAP</p>
      <h1>{state === "loading" ? "부스 지도를 준비하고 있어요." : "부스 지도를 열지 못했어요."}</h1>
      <p>{message}</p>
      {state === "error" && (
        <a className="admin-secondary" href="/booths">
          다시 시도
        </a>
      )}
    </main>
  )
}

function configurationError(): string {
  return "프로젝트 루트의 .env.local에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정해 주세요."
}

export function BoothMapPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<PageState>("loading")
  const [message, setMessage] = useState("게시된 배치와 프로젝트 정보를 불러오는 중입니다.")

  useEffect(() => {
    let disposed = false
    let boothApp: BoothMapApp | null = null

    async function mount() {
      if (!isConfigured) {
        setState("error")
        setMessage(configurationError())
        return
      }

      try {
        const repository = createBoothLayoutRepository()
        const [projects, revision] = await Promise.all([api.projects(), repository.loadPublished()])
        if (disposed || !rootRef.current) {
          return
        }
        boothApp = new BoothMapApp(
          rootRef.current,
          boothEligibleProjects(projects).map(toBoothProject),
          revision.layout,
          {
            initialProjectId: new URLSearchParams(window.location.search).get("projectId"),
            onToggleReaction: (projectId, kind, nextValue) =>
              api.toggleReaction(projectId, kind, nextValue),
          },
        )
        setState("ready")
      } catch (error) {
        if (disposed) {
          return
        }
        setState("error")
        setMessage(error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.")
      }
    }

    void mount()
    return () => {
      disposed = true
      boothApp?.destroy()
    }
  }, [])

  return (
    <div className="booth-feature" data-booth-app>
      <BoothPageStatus state={state} message={message} />
      <div ref={rootRef} hidden={state !== "ready"} />
    </div>
  )
}

export function BoothAdminPage() {
  const navigate = useNavigate()
  const rootRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<PageState>("loading")
  const [message, setMessage] = useState("관리자 권한과 저장된 초안을 확인하는 중입니다.")

  useEffect(() => {
    let disposed = false
    let adminApp: BoothAdminApp | null = null
    const session = readAdminSession()

    async function mount() {
      if (!isConfigured) {
        setState("error")
        setMessage(configurationError())
        return
      }

      try {
        const me = await api.me()
        if (!me.isAdmin) {
          navigate("/booths", { replace: true })
          return
        }

        const repository = createBoothLayoutRepository()
        const [projects, revision] = await Promise.all([api.projects(), repository.loadDraft()])
        if (disposed || !rootRef.current) {
          return
        }
        adminApp = new BoothAdminApp(
          rootRef.current,
          boothEligibleProjects(projects).map(toBoothProject),
          repository,
          session?.layout ?? revision.layout,
          session?.roomSizeModes ?? revision.roomSizeModes,
        )
        sessionStorage.removeItem(adminSessionKey)
        setState("ready")
        if (session) {
          requestAnimationFrame(() => window.scrollTo({ top: session.scrollY, behavior: "instant" }))
        }
      } catch (error) {
        if (disposed) {
          return
        }
        setState("error")
        setMessage(error instanceof Error ? error.message : "관리자 화면을 열지 못했습니다.")
      }
    }

    void mount()
    return () => {
      disposed = true
      if (adminApp) {
        sessionStorage.setItem(adminSessionKey, JSON.stringify(adminApp.sessionSnapshot))
      }
      adminApp?.destroy()
    }
  }, [navigate])

  return (
    <div className="booth-feature" data-booth-app>
      <BoothPageStatus state={state} message={message} />
      <div ref={rootRef} hidden={state !== "ready"} />
    </div>
  )
}
