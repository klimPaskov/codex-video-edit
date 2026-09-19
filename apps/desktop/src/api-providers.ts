import {
  apiProviderIds,
  assertApiProviderConnectRequest,
  assertApiProviderModelRequest,
  assertApiProviderRequest,
  assertApiProvidersView,
  type ApiProviderConnectRequest,
  type ApiProviderId,
  type ApiProviderModelRequest,
  type ApiProviderRequest,
  type ApiProvidersView,
} from "../../../packages/domain/src/api-providers.ts";
import type { ApiProviderClient } from "../../../packages/api-providers/src/client.ts";
import type { ProviderKeyStore } from "./provider-keys.ts";

type KeyStore = Pick<
  ProviderKeyStore,
  "get" | "getModel" | "status" | "set" | "setModel" | "remove"
>;
type CatalogClient = Pick<ApiProviderClient, "listModels">;
class UnsupportedCatalogError extends Error {}

/** /models proves account access, not compatibility with our chat tool path. */
export function editingModels(
  provider: ApiProviderId,
  catalog: string[],
): string[] {
  const supported =
    provider === "openai"
      ? /^gpt-4(?:\.1(?:-(?:mini|nano))?|o(?:-mini)?)(?:-\d{4}-\d{2}-\d{2})?$/u
      : /^deepseek-(?:chat|reasoner|flash|v4-(?:flash|pro))(?:-\d{4,8})?$/u;
  return catalog.filter((model) => supported.test(model));
}

/** Main-only account catalog. No key or provider error crosses IPC. */
export class DesktopApiProviders {
  private readonly keys: KeyStore;
  private readonly client: CatalogClient;
  private readonly models = new Map<ApiProviderId, string[]>();
  private readonly selections = new Map<ApiProviderId, string>();
  private readonly issues = new Map<
    ApiProviderId,
    ApiProvidersView["providers"][number]["message"]
  >();
  private readonly checked = new Set<ApiProviderId>();
  private readonly pending = new Set<ApiProviderId>();

  constructor(keys: KeyStore, client: CatalogClient) {
    this.keys = keys;
    this.client = client;
  }

  private async discover(provider: ApiProviderId): Promise<void> {
    if (this.checked.has(provider) || this.pending.has(provider)) return;
    this.pending.add(provider);
    try {
      const key = await this.keys.get(provider);
      if (!key) {
        this.checked.add(provider);
        return;
      }
      const models = editingModels(
        provider,
        await this.client.listModels(provider, key),
      );
      if (models.length === 0) throw new UnsupportedCatalogError();
      this.models.set(provider, models);
      const candidate =
        this.selections.get(provider) ?? (await this.keys.getModel(provider));
      if (candidate && models.includes(candidate))
        this.selections.set(provider, candidate);
      else this.selections.delete(provider);
      this.issues.delete(provider);
      this.checked.add(provider);
    } catch (error) {
      this.issues.set(
        provider,
        error instanceof UnsupportedCatalogError
          ? "No supported editing models are available for this key."
          : "Provider models are unavailable. Try reconnecting.",
      );
      this.checked.delete(provider);
    } finally {
      this.pending.delete(provider);
    }
  }

  async get(): Promise<ApiProvidersView> {
    await Promise.all(
      apiProviderIds.map((provider) => this.discover(provider)),
    );
    const providers = await Promise.all(
      apiProviderIds.map(async (id) => {
        const status = await this.keys.status(id);
        const models = status.hasKey ? [...(this.models.get(id) ?? [])] : [];
        return {
          id,
          connected: status.hasKey,
          remembered: status.remembered,
          canRemember: status.canRemember,
          models,
          selectedModel: models.includes(this.selections.get(id) ?? "")
            ? this.selections.get(id)!
            : null,
          busy: this.pending.has(id),
          message:
            !status.hasKey && status.remembered
              ? "Saved key is unavailable on this device. Remove it or connect again."
              : (this.issues.get(id) ?? null),
        };
      }),
    );
    const view: ApiProvidersView = { providers };
    assertApiProvidersView(view);
    return view;
  }

  async connect(request: ApiProviderConnectRequest): Promise<ApiProvidersView> {
    assertApiProviderConnectRequest(request);
    const { provider, key, remember } = request;
    if (this.pending.has(provider)) return this.get();
    this.pending.add(provider);
    this.issues.delete(provider);
    try {
      const status = await this.keys.status(provider);
      if (remember && !status.canRemember)
        this.issues.set(
          provider,
          "Secure storage is unavailable. Use this session only.",
        );
      else {
        const models = editingModels(
          provider,
          await this.client.listModels(provider, key),
        );
        if (models.length === 0) throw new UnsupportedCatalogError();
        await this.keys.set(provider, key, { remember });
        this.checked.add(provider);
        this.models.set(provider, models);
        // Replacing a credential never carries a previous account's choice.
        this.selections.delete(provider);
      }
    } catch (error) {
      this.issues.set(
        provider,
        error instanceof UnsupportedCatalogError
          ? "No supported editing models are available for this key."
          : "Connection failed. Check the key and try again.",
      );
    } finally {
      this.pending.delete(provider);
    }
    return this.get();
  }

  async remove(request: ApiProviderRequest): Promise<ApiProvidersView> {
    assertApiProviderRequest(request);
    if (this.pending.has(request.provider)) return this.get();
    await this.keys.remove(request.provider);
    this.models.delete(request.provider);
    this.selections.delete(request.provider);
    this.issues.delete(request.provider);
    this.checked.add(request.provider);
    return this.get();
  }

  async selectModel(
    request: ApiProviderModelRequest,
  ): Promise<ApiProvidersView> {
    assertApiProviderModelRequest(request);
    const state = await this.get();
    const provider = state.providers.find(
      (item) => item.id === request.provider,
    );
    if (!provider?.connected || !provider.models.includes(request.model))
      throw new Error("Model is unavailable");
    if (provider.remembered) {
      try {
        await this.keys.setModel(request.provider, request.model);
      } catch {
        this.issues.set(
          request.provider,
          "Model choice could not be saved. Try again.",
        );
        return this.get();
      }
    }
    this.selections.set(request.provider, request.model);
    this.issues.delete(request.provider);
    return this.get();
  }

  async selected(
    provider: ApiProviderId,
  ): Promise<{ key: string; model: string } | null> {
    const state = await this.get();
    const item = state.providers.find((entry) => entry.id === provider);
    if (!item?.selectedModel) return null;
    const key = await this.keys.get(provider);
    return key ? { key, model: item.selectedModel } : null;
  }
}
