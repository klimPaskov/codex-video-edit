import type {
  ApiProviderId,
  ApiProvidersView,
} from "../../../packages/domain/src/api-providers.ts";

/** API keys exist only in the password input until one explicit IPC action. */
export function setupProviderSettings(dialog: HTMLDialogElement): {
  activate: () => void;
  deactivate: () => void;
} {
  const element = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id)! as T;
  const panel = element("api-provider-settings");
  const provider = element<HTMLSelectElement>("api-provider-id");
  const key = element<HTMLInputElement>("api-provider-key");
  const remember = element<HTMLInputElement>("api-provider-remember");
  const model = element<HTMLSelectElement>("api-provider-model");
  const connect = element<HTMLButtonElement>("api-provider-connect");
  const remove = element<HTMLButtonElement>("api-provider-remove");
  const issue = element("api-provider-error");
  const status = element("api-provider-status");
  let current: ApiProvidersView | undefined;
  let epoch = 0;
  let pending = false;
  let localError: string | null = null;
  const active = () => dialog.open && !panel.hidden;
  const selected = () => provider.value as ApiProviderId;
  function clearKey(): void {
    key.value = "";
  }
  function showError(message: string | null): void {
    issue.textContent = message ?? "";
    issue.hidden = !message;
  }
  function render(view: ApiProvidersView): void {
    current = view;
    const entry = view.providers.find((item) => item.id === selected());
    if (!entry) return;
    status.textContent = entry.connected
      ? entry.remembered
        ? "Key saved on this device"
        : "Key available for this session"
      : entry.remembered
        ? "Saved key unavailable"
        : "Add a key to discover models";
    remember.disabled = !entry.canRemember || pending;
    if (!entry.canRemember) remember.checked = false;
    element("api-provider-session-note").hidden = entry.canRemember;
    key.disabled = pending;
    provider.disabled = pending;
    connect.disabled = pending || key.value.length === 0;
    remove.hidden = !entry.connected && !entry.remembered;
    remove.disabled = pending;
    const choices = [
      { value: "", label: "Choose a model" },
      ...entry.models.map((id) => ({ value: id, label: id })),
    ];
    model.replaceChildren(
      ...choices.map(({ value, label }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
      }),
    );
    model.value = entry.selectedModel ?? "";
    model.disabled = pending || !entry.connected || entry.models.length === 0;
    element("api-provider-model-settings").hidden = !entry.connected;
    showError(entry.message ?? localError);
  }
  async function refresh(): Promise<void> {
    if (!active() || pending) return;
    const request = epoch;
    try {
      const reply = await window.desktop.getApiProviders();
      if (request !== epoch || !active()) return;
      if (!reply.ok) throw new Error();
      render(reply.value);
    } catch {
      if (request === epoch && active())
        showError("API provider settings could not be loaded. Try again.");
    }
  }
  async function action(
    work: () => ReturnType<typeof window.desktop.getApiProviders>,
  ): Promise<void> {
    if (!active() || pending) return;
    const request = ++epoch;
    pending = true;
    localError = null;
    if (current) render(current);
    showError(null);
    try {
      const reply = await work();
      if (request !== epoch || !active()) return;
      if (!reply.ok) throw new Error();
      render(reply.value);
    } catch {
      if (request === epoch && active())
        localError = "This provider action could not finish. Try again.";
    } finally {
      if (request === epoch && active()) {
        pending = false;
        if (current) render(current);
      }
    }
  }
  provider.addEventListener("change", () => {
    clearKey();
    remember.checked = false;
    if (current) render(current);
  });
  key.addEventListener("input", () => {
    connect.disabled = pending || key.value.length === 0;
  });
  connect.addEventListener("click", () => {
    const request = {
      provider: selected(),
      key: key.value,
      remember: remember.checked,
    };
    clearKey();
    void action(() => window.desktop.connectApiProvider(request));
  });
  remove.addEventListener("click", () => {
    clearKey();
    void action(() =>
      window.desktop.removeApiProvider({ provider: selected() }),
    );
  });
  model.addEventListener("change", () => {
    const value = model.value;
    if (value)
      void action(() =>
        window.desktop.selectApiProviderModel({
          provider: selected(),
          model: value,
        }),
      );
    else if (current) render(current);
  });
  const deactivate = () => {
    epoch++;
    pending = false;
    localError = null;
    clearKey();
    remember.checked = false;
  };
  dialog.addEventListener("close", deactivate);
  return {
    activate: () => {
      status.textContent = "Checking providers…";
      void refresh();
    },
    deactivate,
  };
}
