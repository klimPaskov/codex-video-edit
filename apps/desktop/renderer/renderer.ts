import { assertPreferences } from "../../../packages/domain/src/preferences.ts";
import type { DesktopBridge } from "../src/bridge.ts";
import type { MediaSummary } from "../../../packages/domain/src/library.ts";
import type {
  ProjectStage,
  ProjectView,
} from "../../../packages/domain/src/project-view.ts";
declare global {
  interface Window {
    desktop: DesktopBridge;
  }
}
function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error("Missing control");
  return value as T;
}
const home = element("home"),
  viewer = element("viewer"),
  back = element<HTMLButtonElement>("back");
const importButton = element<HTMLButtonElement>("import"),
  progress = element("progress"),
  error = element("error");
const seek = element<HTMLInputElement>("seek"),
  canvas = element<HTMLCanvasElement>("frame");
const previous = element<HTMLButtonElement>("previous"),
  next = element<HTMLButtonElement>("next");
let selected: MediaSummary | undefined;
let selectedButton: HTMLButtonElement | undefined;
let requestedTime: number | undefined;
let decoding = false;
let selectionGeneration = 0;
let seekGeneration = 0;
let activeProject: ProjectView | undefined;
let routeGeneration = 0;
let loadingHome = 0;
let navigating = false;
const stageLabels: Record<ProjectStage, string> = {
  record_import: "Record or Import",
  auto_edit: "Auto Edit",
  edit: "Edit",
  review: "Review",
  export: "Export",
};
const stageMessages: Record<ProjectStage, string> = {
  record_import: "",
  auto_edit: "Automatic editing is not available yet.",
  edit: "Editing tools are not available yet.",
  review: "Review tools are not available yet.",
  export: "Export is not available yet.",
};
const stageSelect = element<HTMLSelectElement>("stage-select");
const stageButtons = new Map<ProjectStage, HTMLButtonElement>();
for (const stage of Object.keys(stageLabels) as ProjectStage[]) {
  const button = document.createElement("button");
  button.textContent = stageLabels[stage];
  button.addEventListener("click", () => {
    void navigate(stage);
  });
  element("stage-buttons").append(button);
  stageButtons.set(stage, button);
  const option = document.createElement("option");
  option.value = stage;
  option.textContent = stageLabels[stage];
  stageSelect.append(option);
}
stageSelect.addEventListener("change", () => {
  const value = stageSelect.value as ProjectStage;
  renderStage();
  void navigate(value);
});
function renderStage(): void {
  element("project-navigation").hidden = !activeProject;
  const message = element("stage-message");
  message.textContent = activeProject ? stageMessages[activeProject.stage] : "";
  message.hidden = !message.textContent;
  stageSelect.disabled = navigating;
  if (activeProject) stageSelect.value = activeProject.stage;
  for (const [stage, button] of stageButtons) {
    button.disabled = navigating;
    if (activeProject?.stage === stage)
      button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  }
}
async function navigate(stage: ProjectStage): Promise<void> {
  if (!activeProject || navigating || stage === activeProject.stage) return;
  const project = activeProject,
    generation = routeGeneration;
  const origin = document.activeElement;
  navigating = true;
  renderStage();
  clearError();
  try {
    const reply = await window.desktop.navigateProject({
      id: project.id,
      stage,
    });
    if (generation !== routeGeneration || activeProject?.id !== project.id)
      return;
    if (!reply.ok) showError(reply.message);
    else activeProject = reply.value;
  } catch {
    if (generation === routeGeneration)
      showError(
        "The stage could not be saved. Your previous stage is unchanged. Try again.",
      );
  } finally {
    if (generation === routeGeneration) {
      navigating = false;
      renderStage();
      if (
        !settingsDialog.open &&
        document.activeElement === document.body &&
        origin instanceof HTMLElement
      )
        origin.focus();
    }
  }
}
async function openProject(
  id: string,
  origin?: HTMLButtonElement,
): Promise<void> {
  const generation = ++routeGeneration;
  clearError();
  try {
    const reply = await window.desktop.openProject({ id });
    if (generation !== routeGeneration) return;
    if (!reply.ok) {
      showError(reply.message);
      return;
    }
    selectProject(reply.value, origin);
  } catch {
    if (generation === routeGeneration)
      showError("The project could not be opened. Try again.");
  }
}
function selectProject(project: ProjectView, origin?: HTMLButtonElement): void {
  activeProject = project;
  navigating = false;
  select(project.source);
  selectedButton =
    origin ??
    document.querySelector<HTMLButtonElement>(
      `[data-project-id="${project.id}"]`,
    ) ??
    undefined;
  element("source-name").textContent = project.name;
  renderStage();
}
async function createProject(
  media: MediaSummary,
  origin?: HTMLButtonElement,
): Promise<void> {
  const generation = ++routeGeneration;
  if (origin) origin.disabled = true;
  clearError();
  try {
    const reply = await window.desktop.createProject({ id: media.id });
    if (generation !== routeGeneration) return;
    await loadLibrary();
    if (generation !== routeGeneration) return;
    if (!reply.ok) {
      showError(reply.message);
      return;
    }
    selectProject(reply.value);
  } catch {
    if (generation === routeGeneration)
      showError(
        "The project could not be created. Your imported source is preserved. Try Create project again.",
      );
  } finally {
    if (origin) origin.disabled = false;
  }
}
function showError(message: string): void {
  error.textContent = message;
  error.hidden = false;
}
function clearError(): void {
  error.hidden = true;
  error.textContent = "";
}
function time(value: number): string {
  const seconds = value / 1_000_000;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;
}
async function loadLibrary(): Promise<void> {
  const generation = ++loadingHome;
  const [reply, projects] = await Promise.all([
    window.desktop.listMedia(),
    window.desktop.listProjects(),
  ]);
  if (generation !== loadingHome) return;
  if (!projects.ok) showError(projects.message);
  else {
    const list = element("projects");
    list.replaceChildren();
    element("projects-section").hidden = projects.value.length === 0;
    for (const project of projects.value) {
      const row = document.createElement("li"),
        button = document.createElement("button"),
        name = document.createElement("span"),
        detail = document.createElement("small");
      name.textContent = project.name;
      detail.textContent = `${time(project.timeline.durationUs)} · ${stageLabels[project.stage]}`;
      button.append(name, detail);
      button.dataset.projectId = project.id;
      button.addEventListener("click", () => {
        void openProject(project.id, button);
      });
      row.append(button);
      list.append(row);
    }
  }
  if (!reply.ok) {
    showError(reply.message);
    return;
  }
  const list = element("library");
  list.replaceChildren();
  element("library-section").hidden = reply.value.length === 0;
  for (const media of reply.value) {
    const row = document.createElement("li"),
      button = document.createElement("button");
    const name = document.createElement("span"),
      detail = document.createElement("small");
    name.textContent = media.name;
    detail.textContent = `${media.width} × ${media.height} · ${time(media.durationUs)}`;
    button.append(name, detail);
    button.dataset.mediaId = media.id;
    button.addEventListener("click", () => {
      routeGeneration++;
      activeProject = undefined;
      navigating = false;
      selectedButton = button;
      select(media);
      renderStage();
    });
    const create = document.createElement("button");
    create.className = "create-project";
    create.textContent = "Create project";
    create.setAttribute("aria-label", `Create project from ${media.name}`);
    create.addEventListener("click", () => {
      void createProject(media, create);
    });
    row.append(button, create);
    list.append(row);
  }
}
function select(media: MediaSummary): void {
  selected = media;
  selectedButton =
    document.querySelector<HTMLButtonElement>(
      `[data-media-id="${media.id}"]`,
    ) ?? undefined;
  setInspector(false);
  selectionGeneration++;
  requestedTime = undefined;
  clearError();
  canvas.width = 0;
  canvas.height = 0;
  element("time").textContent = "";
  home.hidden = true;
  viewer.hidden = false;
  back.hidden = false;
  element("source-name").textContent = media.name;
  seek.max = String(Math.max(0, media.durationUs - Math.ceil(frameInterval())));
  seek.step = "1";
  seek.value = "0";
  canvas.hidden = !media.previewAvailable;
  const message = element("preview-message");
  message.hidden = media.previewAvailable;
  message.textContent =
    "This video's format does not have a verified preview yet. Its original file has been preserved.";
  element("frame-controls").hidden = !media.previewAvailable;
  if (media.previewAvailable) requestFrame(0);
  back.focus();
}
function requestFrame(value: number): void {
  if (!selected?.previewAvailable) return;
  requestedTime = Math.min(Number(seek.max), Math.max(0, Math.round(value)));
  seekGeneration++;
  seek.value = String(requestedTime);
  const message = element("preview-message");
  message.textContent = "Reading frame…";
  message.hidden = false;
  canvas.hidden = true;
  previous.disabled = requestedTime === 0;
  next.disabled = requestedTime >= Number(seek.max);
  if (!decoding) void decodeFrames();
}
async function decodeFrames(): Promise<void> {
  decoding = true;
  try {
    while (selected && requestedTime !== undefined) {
      const requested = requestedTime,
        media = selected,
        generation = selectionGeneration,
        seekVersion = seekGeneration;
      requestedTime = undefined;
      const reply = await window.desktop.readFrame({
        id: media.id,
        timeUs: requested,
      });
      if (generation !== selectionGeneration || seekVersion !== seekGeneration)
        continue;
      if (!reply.ok) {
        showError(reply.message);
        element("preview-message").textContent =
          "Move the position control to retry this frame.";
        continue;
      }
      const frame = reply.value;
      const bytes = Uint8ClampedArray.from(
        atob(frame.rgbaBase64),
        (character) => character.charCodeAt(0),
      );
      canvas.width = frame.width;
      canvas.height = frame.height;
      canvas
        .getContext("2d")
        ?.putImageData(new ImageData(bytes, frame.width, frame.height), 0, 0);
      element("time").textContent = time(requested);
      canvas.hidden = false;
      element("preview-message").hidden = true;
    }
  } catch {
    showError("The frame could not be shown. Select the video again to retry.");
  } finally {
    decoding = false;
  }
}
importButton.addEventListener("click", async () => {
  const generation = ++routeGeneration;
  clearError();
  importButton.disabled = true;
  progress.hidden = false;
  try {
    const reply = await window.desktop.importVideo();
    if (generation !== routeGeneration) {
      await loadLibrary();
      return;
    }
    if (!reply.ok) showError(reply.message);
    else if (reply.value) {
      element("progress-label").textContent = "Creating project…";
      element("cancel").hidden = true;
      await createProject(reply.value);
    }
  } catch {
    showError("Import could not finish. Please try again.");
  } finally {
    importButton.disabled = false;
    progress.hidden = true;
    element("progress-label").textContent = "Importing video…";
    element("cancel").hidden = false;
  }
});
element("cancel").addEventListener("click", () => {
  void window.desktop.cancelImport();
});
back.addEventListener("click", () => {
  routeGeneration++;
  activeProject = undefined;
  navigating = false;
  renderStage();
  selected = undefined;
  selectionGeneration++;
  requestedTime = undefined;
  viewer.hidden = true;
  home.hidden = false;
  back.hidden = true;
  clearError();
  setInspector(false);
  (selectedButton?.isConnected ? selectedButton : importButton).focus();
  // Keep cards current after stage persistence without stealing restored focus.
  const restoreProjectId = selectedButton?.dataset.projectId;
  const restoreMediaId = selectedButton?.dataset.mediaId;
  const restoreSelector = restoreProjectId
    ? `[data-project-id="${restoreProjectId}"]`
    : restoreMediaId
      ? `[data-media-id="${restoreMediaId}"]`
      : undefined;
  const homeGeneration = routeGeneration;
  const focused = document.activeElement;
  void loadLibrary()
    .then(() => {
      if (
        home.hidden ||
        !restoreSelector ||
        homeGeneration !== routeGeneration ||
        settingsDialog.open ||
        (document.activeElement !== document.body &&
          document.activeElement !== focused)
      )
        return;
      document.querySelector<HTMLButtonElement>(restoreSelector)?.focus();
    })
    .catch(() =>
      showError("Home could not be refreshed. Try reopening the application."),
    );
});
seek.addEventListener("input", () => requestFrame(Number(seek.value)));
previous.addEventListener("click", () => {
  if (selected) requestFrame(Number(seek.value) - frameInterval());
});
next.addEventListener("click", () => {
  if (selected) requestFrame(Number(seek.value) + frameInterval());
});
function frameInterval(): number {
  return activeProject
    ? (1_000_000 * activeProject.timeline.frameRate.denominator) /
        activeProject.timeline.frameRate.numerator
    : 1_000_000 / (selected?.frameRate ?? 1);
}
void loadLibrary().catch(() =>
  showError(
    "The library could not be opened. Restart the application to retry.",
  ),
);

const inspector = element("inspector");
const detailsButton = element<HTMLButtonElement>("source-details");
const settingsButton = element<HTMLButtonElement>("settings");
const settingsDialog = element<HTMLDialogElement>("settings-dialog");
const scaleSelect = element<HTMLSelectElement>("interface-scale");
let savingPreferences = false;
let settingsLoad = 0;
let restoreInspector = false;
let dialogOrigin: HTMLElement | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function setInspector(open: boolean): void {
  inspector.hidden = !open;
  detailsButton.setAttribute("aria-expanded", String(open));
  if (open && selected) {
    const list = element("source-properties");
    list.replaceChildren();
    for (const [label, value] of [
      ["File", selected.name],
      ["Dimensions", `${selected.width} × ${selected.height}`],
      ["Duration", time(selected.durationUs)],
      ["Frame rate", `${Number(selected.frameRate.toFixed(3))} fps`],
    ]) {
      const term = document.createElement("dt"),
        definition = document.createElement("dd");
      term.textContent = label!;
      definition.textContent = value!;
      list.append(term, definition);
    }
  }
}
detailsButton.addEventListener("click", () => {
  setInspector(inspector.hidden === true);
  if (!inspector.hidden) element("close-inspector").focus();
});
element("close-inspector").addEventListener("click", () => {
  setInspector(false);
  detailsButton.focus();
});
function showToast(message: string): void {
  const toast = element("toast");
  if (toastTimer) clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}
async function openSettings(): Promise<void> {
  if (settingsDialog.open || settingsButton.disabled) return;
  const load = ++settingsLoad;
  dialogOrigin =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : undefined;
  settingsButton.disabled = true;
  restoreInspector = !inspector.hidden;
  setInspector(false);
  const message = element("settings-error");
  message.hidden = true;
  element<HTMLButtonElement>("save-settings").disabled = true;
  settingsDialog.showModal();
  scaleSelect.disabled = true;
  element("close-settings").focus();
  try {
    const reply = await window.desktop.getPreferences();
    if (!settingsDialog.open || load !== settingsLoad) return;
    if (!reply.ok) throw new Error("load");
    scaleSelect.value = String(reply.value.interfaceScale);
    scaleSelect.disabled = false;
    element<HTMLButtonElement>("save-settings").disabled = false;
    scaleSelect.focus();
  } catch {
    if (settingsDialog.open && load === settingsLoad) {
      message.textContent =
        "Settings could not be loaded. Close this dialog and retry. Your saved settings have been preserved.";
      message.hidden = false;
    }
  } finally {
    if (load === settingsLoad) settingsButton.disabled = false;
  }
}
settingsButton.addEventListener("click", () => {
  void openSettings();
});
function closeSettings(): void {
  if (!savingPreferences) settingsDialog.close();
}
element("close-settings").addEventListener("click", closeSettings);
element("cancel-settings").addEventListener("click", closeSettings);
settingsDialog.addEventListener("cancel", (event) => {
  if (savingPreferences) event.preventDefault();
});
settingsDialog.addEventListener("close", () => {
  settingsLoad++;
  settingsButton.disabled = false;
  if (restoreInspector && selected) setInspector(true);
  if (dialogOrigin?.isConnected && !dialogOrigin.closest("[hidden]"))
    dialogOrigin.focus();
  else settingsButton.focus();
});
element("settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (savingPreferences || scaleSelect.disabled) return;
  void savePreferences();
});
async function savePreferences(): Promise<void> {
  savingPreferences = true;
  const message = element("settings-error");
  message.hidden = true;
  const controls = Array.from(
    settingsDialog.querySelectorAll<HTMLButtonElement | HTMLSelectElement>(
      "button, select",
    ),
  );
  controls.forEach((control) => {
    control.disabled = true;
  });
  try {
    const value = { interfaceScale: Number(scaleSelect.value) };
    assertPreferences(value);
    const reply = await window.desktop.setPreferences(value);
    if (!reply.ok) throw new Error("save");
    savingPreferences = false;
    settingsDialog.close();
    showToast("Interface size saved");
  } catch {
    message.textContent =
      "Settings could not be saved. Your previous interface size is unchanged. Try again.";
    message.hidden = false;
  } finally {
    savingPreferences = false;
    controls.forEach((control) => {
      control.disabled = false;
    });
  }
}
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === ",") {
    event.preventDefault();
    void openSettings();
  } else if (
    event.key === "Escape" &&
    !settingsDialog.open &&
    !inspector.hidden
  ) {
    event.preventDefault();
    setInspector(false);
    detailsButton.focus();
  }
});
void window.desktop
  .getPreferences()
  .then((reply) => {
    if (!reply.ok)
      showError(
        "Saved interface settings could not be loaded. Open Settings to retry.",
      );
  })
  .catch(() =>
    showError(
      "Saved interface settings could not be loaded. Open Settings to retry.",
    ),
  );
