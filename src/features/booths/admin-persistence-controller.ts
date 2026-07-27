import type { AdminLayoutState } from "./admin-layout-state"
import { type BoothLayoutRepository, BoothLayoutRepositoryError } from "./booth-layout-repository"
import { queryRequired } from "./view-templates"

export class AdminPersistenceController {
  private busy = false

  public constructor(
    private readonly root: HTMLDivElement,
    private readonly state: AdminLayoutState,
    private readonly repository: BoothLayoutRepository,
  ) {}

  public bindActions(): void {
    queryRequired<HTMLButtonElement>(this.root, '[data-admin-action="save"]').addEventListener(
      "click",
      () => void this.saveDraft(),
    )
    queryRequired<HTMLButtonElement>(this.root, '[data-admin-action="publish"]').addEventListener(
      "click",
      () => void this.publishDraft(),
    )
    this.syncState()
  }

  public updateState(message: string): void {
    this.syncState()
    queryRequired<HTMLElement>(this.root, "[data-admin-status]").textContent = message
  }

  public syncState(): void {
    const saveState = this.root.querySelector<HTMLElement>(".admin-save-state")
    if (saveState) {
      saveState.setAttribute("data-saved", String(this.state.isSaved))
      saveState.textContent = this.state.isSaved
        ? "초안이 저장된 상태입니다."
        : "저장하지 않은 초안 변경사항이 있습니다."
    }
    this.updateButtonStates()
  }

  private async saveDraft(): Promise<void> {
    this.setBusy(true)
    try {
      await this.repository.saveDraft({
        layout: this.state.layoutSnapshot,
        roomSizeModes: this.state.roomSizeModesSnapshot,
      })
      this.state.markSaved()
      this.updateState("초안을 저장했습니다. 공개 지도는 아직 바뀌지 않았습니다.")
    } catch (error) {
      if (error instanceof BoothLayoutRepositoryError || error instanceof DOMException) {
        this.updateState(`초안을 저장하지 못했습니다. ${error.message}`)
      } else {
        throw error
      }
    } finally {
      this.setBusy(false)
    }
  }

  private async publishDraft(): Promise<void> {
    if (!this.state.isSaved) {
      this.updateState("게시하기 전에 현재 변경사항을 초안으로 저장해 주세요.")
      return
    }
    this.setBusy(true)
    try {
      await this.repository.publishDraft()
      this.updateState("저장된 초안을 게시했습니다. 공개 지도를 새로 열면 반영됩니다.")
    } catch (error) {
      if (error instanceof BoothLayoutRepositoryError || error instanceof DOMException) {
        this.updateState(`초안을 게시하지 못했습니다. ${error.message}`)
      } else {
        throw error
      }
    } finally {
      this.setBusy(false)
    }
  }

  private setBusy(busy: boolean): void {
    this.busy = busy
    this.updateButtonStates()
  }

  private updateButtonStates(): void {
    queryRequired<HTMLButtonElement>(this.root, '[data-admin-action="save"]').disabled = this.busy
    queryRequired<HTMLButtonElement>(this.root, '[data-admin-action="publish"]').disabled =
      this.busy || !this.state.isSaved
  }
}
