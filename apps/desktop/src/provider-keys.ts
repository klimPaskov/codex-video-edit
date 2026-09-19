import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { ProviderId } from "../../../packages/api-providers/src/types.ts";

const maxCiphertextBytes = 16 * 1024;
const envelopePrefix = "\0CVE_PROVIDER_KEY_1:";
const modelPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/u;
const pending = new Map<string, Promise<unknown>>();

export type ProviderKeyErrorCode =
  "invalid_key" | "secure_storage_unavailable" | "storage_failure";

export class ProviderKeyError extends Error {
  readonly code: ProviderKeyErrorCode;
  constructor(code: ProviderKeyErrorCode) {
    super(code);
    this.name = "ProviderKeyError";
    this.code = code;
  }
}

/** The main process injects Electron safeStorage; no Electron API enters the renderer. */
export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend?(): string;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface ProviderKeyStatus {
  hasKey: boolean;
  remembered: boolean;
  canRemember: boolean;
}

export interface ProviderKeyStoreOptions {
  platform?: NodeJS.Platform;
}

function assertProvider(provider: ProviderId): void {
  if (provider !== "deepseek" && provider !== "openai")
    throw new ProviderKeyError("invalid_key");
}

function assertKey(key: string): void {
  if (
    typeof key !== "string" ||
    key.length < 8 ||
    key.length > 4096 ||
    /[\r\n\0]/.test(key)
  )
    throw new ProviderKeyError("invalid_key");
}

function storedKey(plainText: string): { key: string; model: string | null } {
  if (!plainText.startsWith(envelopePrefix)) {
    // Keys saved before model persistence contained only the raw key.
    assertKey(plainText);
    return { key: plainText, model: null };
  }
  const value: unknown = JSON.parse(plainText.slice(envelopePrefix.length));
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).length !== 2 ||
    !Object.hasOwn(value, "key") ||
    !Object.hasOwn(value, "model")
  )
    throw new ProviderKeyError("storage_failure");
  const item = value as { key: unknown; model: unknown };
  assertKey(item.key as string);
  if (
    item.model !== null &&
    (typeof item.model !== "string" || !modelPattern.test(item.model))
  )
    throw new ProviderKeyError("storage_failure");
  return { key: item.key as string, model: item.model as string | null };
}

function envelope(key: string, model: string | null): string {
  return `${envelopePrefix}${JSON.stringify({ key, model })}`;
}

function missing(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

/** Main-owned userData directory only; never a project or media directory. */
export class ProviderKeyStore {
  private readonly root: string;
  private readonly storage: SafeStorageAdapter;
  private readonly platform: NodeJS.Platform;
  private readonly session = new Map<ProviderId, string>();

  constructor(
    root: string,
    storage: SafeStorageAdapter,
    options: ProviderKeyStoreOptions = {},
  ) {
    if (!isAbsolute(root)) throw new ProviderKeyError("storage_failure");
    this.root = resolve(root);
    this.storage = storage;
    this.platform = options.platform ?? process.platform;
  }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const result = (pending.get(this.root) ?? Promise.resolve())
      .catch(() => undefined)
      .then(work);
    pending.set(this.root, result);
    void result
      .finally(() => {
        if (pending.get(this.root) === result) pending.delete(this.root);
      })
      .catch(() => undefined);
    return result;
  }

  private secure(): boolean {
    try {
      if (!this.storage.isEncryptionAvailable()) return false;
      if (this.platform !== "linux") return true;
      const backend = this.storage.getSelectedStorageBackend?.();
      return !!backend && backend !== "basic_text" && backend !== "unknown";
    } catch {
      return false;
    }
  }

  private async directory(): Promise<void> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    // Reject linked ancestors directly. Windows realpath may change path
    // casing or namespace spelling without following a link.
    let current = this.root;
    for (;;) {
      const stat = await lstat(current);
      if (!stat.isDirectory() || stat.isSymbolicLink())
        throw new ProviderKeyError("storage_failure");
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  private path(provider: ProviderId): string {
    return join(this.root, `${provider}.key`);
  }

  private async readCiphertext(provider: ProviderId): Promise<Buffer | null> {
    await this.directory();
    const path = this.path(provider);
    try {
      const stat = await lstat(path);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        stat.nlink !== 1 ||
        stat.size < 1 ||
        stat.size > maxCiphertextBytes ||
        (process.platform !== "win32" && (stat.mode & 0o077) !== 0)
      )
        throw new ProviderKeyError("storage_failure");
    } catch (error) {
      if (missing(error)) return null;
      throw error;
    }
    const handle = await open(
      path,
      constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
    );
    try {
      const stat = await handle.stat();
      if (
        !stat.isFile() ||
        stat.nlink !== 1 ||
        stat.size < 1 ||
        stat.size > maxCiphertextBytes ||
        (process.platform !== "win32" && (stat.mode & 0o077) !== 0)
      )
        throw new ProviderKeyError("storage_failure");
      return await handle.readFile();
    } finally {
      await handle.close();
    }
  }

  private async readStored(
    provider: ProviderId,
  ): Promise<{ key: string; model: string | null } | null> {
    const ciphertext = await this.readCiphertext(provider);
    return ciphertext
      ? storedKey(this.storage.decryptString(ciphertext))
      : null;
  }

  private async removeCiphertext(provider: ProviderId): Promise<void> {
    await this.directory();
    try {
      await unlink(this.path(provider));
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }

  private async writeCiphertext(
    provider: ProviderId,
    ciphertext: Buffer,
  ): Promise<void> {
    await this.directory();
    // Refuse to overwrite damaged or redirected key files.
    await this.readCiphertext(provider);
    const staged = join(this.root, `.key-${randomUUID()}.tmp`);
    try {
      const handle = await open(staged, "wx", 0o600);
      try {
        await handle.writeFile(ciphertext);
        await handle.sync();
      } finally {
        await handle.close();
      }
      await this.readCiphertext(provider);
      await rename(staged, this.path(provider));
    } finally {
      await unlink(staged).catch(() => undefined);
    }
  }

  /** A rejected remember request leaves the old session and ciphertext untouched. */
  async set(
    provider: ProviderId,
    key: string,
    options: { remember: boolean },
  ): Promise<ProviderKeyStatus> {
    assertProvider(provider);
    assertKey(key);
    if (!options || typeof options.remember !== "boolean")
      throw new ProviderKeyError("invalid_key");
    return this.serialize(async () => {
      if (options.remember && !this.secure())
        throw new ProviderKeyError("secure_storage_unavailable");
      try {
        if (options.remember) {
          const ciphertext = this.storage.encryptString(envelope(key, null));
          if (
            !Buffer.isBuffer(ciphertext) ||
            ciphertext.length < 1 ||
            ciphertext.length > maxCiphertextBytes ||
            ciphertext.equals(Buffer.from(envelope(key, null), "utf8"))
          )
            throw new ProviderKeyError("storage_failure");
          await this.writeCiphertext(provider, ciphertext);
        } else {
          await this.removeCiphertext(provider);
        }
        this.session.set(provider, key);
        return {
          hasKey: true,
          remembered: options.remember,
          canRemember: this.secure(),
        };
      } catch {
        throw new ProviderKeyError("storage_failure");
      }
    });
  }

  async get(provider: ProviderId): Promise<string | null> {
    assertProvider(provider);
    return this.serialize(async () => {
      const sessionKey = this.session.get(provider);
      if (sessionKey) return sessionKey;
      if (!this.secure()) return null;
      try {
        return (await this.readStored(provider))?.key ?? null;
      } catch {
        throw new ProviderKeyError("storage_failure");
      }
    });
  }

  async getModel(provider: ProviderId): Promise<string | null> {
    assertProvider(provider);
    return this.serialize(async () => {
      if (!this.secure()) return null;
      try {
        return (await this.readStored(provider))?.model ?? null;
      } catch {
        throw new ProviderKeyError("storage_failure");
      }
    });
  }

  async setModel(provider: ProviderId, model: string): Promise<void> {
    assertProvider(provider);
    if (typeof model !== "string" || !modelPattern.test(model))
      throw new ProviderKeyError("storage_failure");
    return this.serialize(async () => {
      if (!this.secure())
        throw new ProviderKeyError("secure_storage_unavailable");
      try {
        const saved = await this.readStored(provider);
        if (!saved) throw new ProviderKeyError("storage_failure");
        const plainText = envelope(saved.key, model);
        const ciphertext = this.storage.encryptString(plainText);
        if (
          !Buffer.isBuffer(ciphertext) ||
          ciphertext.length < 1 ||
          ciphertext.length > maxCiphertextBytes ||
          ciphertext.equals(Buffer.from(plainText, "utf8"))
        )
          throw new ProviderKeyError("storage_failure");
        await this.writeCiphertext(provider, ciphertext);
      } catch {
        throw new ProviderKeyError("storage_failure");
      }
    });
  }

  async status(provider: ProviderId): Promise<ProviderKeyStatus> {
    assertProvider(provider);
    return this.serialize(async () => {
      try {
        const remembered = (await this.readCiphertext(provider)) !== null;
        return {
          hasKey: this.session.has(provider) || (remembered && this.secure()),
          remembered,
          canRemember: this.secure(),
        };
      } catch {
        throw new ProviderKeyError("storage_failure");
      }
    });
  }

  async remove(provider: ProviderId): Promise<void> {
    assertProvider(provider);
    return this.serialize(async () => {
      try {
        await this.removeCiphertext(provider);
        this.session.delete(provider);
      } catch {
        throw new ProviderKeyError("storage_failure");
      }
    });
  }
}
