import type {
  CodexView,
  CodexSelection,
} from "../../../packages/domain/src/codex-view.ts";
import type { Preferences } from "../../../packages/domain/src/preferences.ts";
import type {
  ProjectDraftView,
  ProjectFrameRequest,
  ProjectFrameResult,
  ProjectView,
  ProjectRequest,
  ProjectNavigation,
} from "../../../packages/domain/src/project-view.ts";
import type {
  FrameRequest,
  MediaFrame,
  MediaSummary,
} from "../../../packages/domain/src/library.ts";
import type {
  CodexThreadProjectRequest,
  CodexThreadSendRequest,
  CodexThreadView,
} from "../../../packages/domain/src/codex-thread-view.ts";

export type Reply<T> = { ok: true; value: T } | { ok: false; message: string };
export interface DesktopBridge {
  getCodex(): Promise<Reply<CodexView>>;
  reconnectCodex(): Promise<Reply<CodexView>>;
  loginCodex(): Promise<Reply<CodexView>>;
  cancelCodexLogin(): Promise<Reply<CodexView>>;
  logoutCodex(): Promise<Reply<CodexView>>;
  selectCodexModel(value: CodexSelection): Promise<Reply<CodexView>>;
  getCodexThread(
    request: CodexThreadProjectRequest,
  ): Promise<Reply<CodexThreadView>>;
  openCodexThread(
    request: CodexThreadProjectRequest,
  ): Promise<Reply<CodexThreadView>>;
  sendCodexThread(
    request: CodexThreadSendRequest,
  ): Promise<Reply<CodexThreadView>>;
  interruptCodexThread(
    request: CodexThreadProjectRequest,
  ): Promise<Reply<CodexThreadView>>;
  listProjects(): Promise<Reply<ProjectView[]>>;
  createProject(request: ProjectRequest): Promise<Reply<ProjectView>>;
  openProject(request: ProjectRequest): Promise<Reply<ProjectView>>;
  closeProject(request: ProjectRequest): Promise<Reply<null>>;
  navigateProject(request: ProjectNavigation): Promise<Reply<ProjectView>>;
  readProjectFrame(
    request: ProjectFrameRequest,
  ): Promise<Reply<ProjectFrameResult>>;
  onProjectDraftChanged(
    listener: (reply: Reply<ProjectDraftView>) => void,
  ): () => void;
  getPreferences(): Promise<Reply<Preferences>>;
  setPreferences(value: Preferences): Promise<Reply<Preferences>>;
  listMedia(): Promise<Reply<MediaSummary[]>>;
  importVideo(): Promise<Reply<MediaSummary | null>>;
  readFrame(request: FrameRequest): Promise<Reply<MediaFrame>>;
  cancelImport(): Promise<Reply<null>>;
}
export const channels = Object.freeze({
  codexGet: "codex:get",
  codexReconnect: "codex:reconnect",
  codexLogin: "codex:login",
  codexCancelLogin: "codex:cancel-login",
  codexLogout: "codex:logout",
  codexSelect: "codex:select",
  codexThreadGet: "codex-thread:get",
  codexThreadOpen: "codex-thread:open",
  codexThreadSend: "codex-thread:send",
  codexThreadInterrupt: "codex-thread:interrupt",
  projectList: "projects:list",
  projectCreate: "projects:create",
  projectOpen: "projects:open",
  projectClose: "projects:close",
  projectNavigate: "projects:navigate",
  projectFrame: "projects:frame",
  projectDraftChanged: "projects:draft-changed",
  preferencesGet: "preferences:get",
  preferencesSet: "preferences:set",
  list: "library:list",
  import: "library:import",
  frame: "library:frame",
  cancel: "library:cancel",
});
export function assertEmptyRequest(value: unknown): void {
  if (value !== undefined) throw new Error("Unexpected request parameters");
}
