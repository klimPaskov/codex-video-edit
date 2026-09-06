import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { mediaIdPattern } from "../../domain/src/library.ts";
import {
  assertInitialProjectSnapshot,
  createInitialProject,
  projectCanonicalJson,
  projectStages,
} from "../../domain/src/project.ts";
import type {
  InitialProjectSnapshot,
  ProjectStage,
} from "../../domain/src/project.ts";
import type { MediaLibrary } from "../../media-engine/src/library.ts";

const pending = new Map<string, Promise<unknown>>();
const jsonLimit = 8 * 1024 * 1024;
function invalid(): never {
  throw new Error(
    "The project could not be opened or saved. Check its local files and try again.",
  );
}
async function safeDirectory(path: string): Promise<void> {
  const stat = await lstat(path);
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    resolve(await realpath(path)) !== path
  )
    invalid();
}
async function json(path: string): Promise<unknown> {
  const stat = await lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.nlink !== 1 ||
    stat.size > jsonLimit
  )
    invalid();
  const handle = await open(
    path,
    constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
  );
  try {
    const actual = await handle.stat();
    if (!actual.isFile() || actual.nlink !== 1 || actual.size > jsonLimit)
      invalid();
    return JSON.parse(await handle.readFile("utf8")) as unknown;
  } finally {
    await handle.close();
  }
}
async function writeNew(path: string, value: unknown): Promise<void> {
  const content = projectCanonicalJson(value);
  if (Buffer.byteLength(content) > jsonLimit) invalid();
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(`${content}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/** Initial project baseline and stage persistence; later edits use the shared transaction engine. */
export class ProjectStore {
  private readonly root: string;
  private readonly library: MediaLibrary;
  constructor(rootAbsolute: string, library: MediaLibrary) {
    if (!isAbsolute(rootAbsolute)) invalid();
    this.root = resolve(rootAbsolute);
    this.library = library;
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
  private async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await safeDirectory(this.root);
  }
  private folder(id: string): string {
    if (!mediaIdPattern.test(id)) invalid();
    return join(this.root, id);
  }
  private async read(id: string): Promise<InitialProjectSnapshot> {
    const folder = this.folder(id);
    await safeDirectory(folder);
    const baseline = await json(join(folder, "baseline.json"));
    assertInitialProjectSnapshot(baseline);
    if (
      baseline.project.project_id !== id ||
      baseline.project.storage.project_root !== folder ||
      baseline.project.workflow_step !== "record_import" ||
      baseline.project.updated_at !== baseline.project.created_at
    )
      invalid();
    const project = await json(join(folder, "project.json"));
    const combined: unknown = { ...baseline, project };
    assertInitialProjectSnapshot(combined);
    const expected = {
      ...baseline.project,
      workflow_step: combined.project.workflow_step,
      updated_at: combined.project.updated_at,
    };
    if (
      projectCanonicalJson(expected) !== projectCanonicalJson(combined.project)
    )
      invalid();
    const source = await this.library.verifiedSource(baseline.source.source_id);
    if (
      source.managedPath !== baseline.source.managed_path ||
      source.originalPath !== baseline.source.original_path ||
      source.sha256 !== baseline.source.sha256 ||
      source.sizeBytes !== baseline.source.size_bytes ||
      projectCanonicalJson(source.probe) !==
        projectCanonicalJson(baseline.source_probe)
    )
      invalid();
    return combined;
  }
  createFromMedia(mediaId: string): Promise<InitialProjectSnapshot> {
    return this.serialize(async () => {
      await this.initialize();
      const source = await this.library.verifiedSource(mediaId);
      const projectId = randomUUID(),
        timelineId = randomUUID(),
        revisionId = randomUUID();
      const folder = this.folder(projectId);
      const snapshot = createInitialProject({
        projectId,
        timelineId,
        revisionId,
        sourceId: mediaId,
        name: source.summary.name.slice(0, 160),
        createdAt: new Date().toISOString(),
        projectRoot: folder,
        originalPath: source.originalPath,
        managedPath: source.managedPath,
        sha256: source.sha256,
        sizeBytes: source.sizeBytes,
        probe: source.probe,
      });
      assertInitialProjectSnapshot(snapshot);
      const staged = join(this.root, `.creating-${projectId}`);
      await mkdir(staged, { mode: 0o700 });
      await writeNew(join(staged, "baseline.json"), snapshot);
      await writeNew(join(staged, "project.json"), snapshot.project);
      await safeDirectory(this.root);
      await safeDirectory(staged);
      // Random UUID and in-process serialization avoid collisions; never reuse a published folder.
      try {
        await lstat(folder);
        invalid();
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          error.code !== "ENOENT"
        )
          throw error;
      }
      await rename(staged, folder);
      return snapshot;
    });
  }
  list(): Promise<InitialProjectSnapshot[]> {
    return this.serialize(async () => {
      await this.initialize();
      const entries = await readdir(this.root);
      if (entries.length > 1000) invalid();
      const result: InitialProjectSnapshot[] = [];
      for (const entry of entries.sort()) {
        // Interrupted, unpublished directories remain private for explicit later recovery/cleanup.
        if (
          entry.startsWith(".creating-") &&
          mediaIdPattern.test(entry.slice(10))
        ) {
          await safeDirectory(join(this.root, entry));
          continue;
        }
        result.push(await this.read(entry));
      }
      return result;
    });
  }
  open(projectId: string): Promise<InitialProjectSnapshot> {
    return this.serialize(async () => {
      await this.initialize();
      return this.read(projectId);
    });
  }
  navigate(
    projectId: string,
    stage: ProjectStage,
  ): Promise<InitialProjectSnapshot> {
    return this.serialize(async () => {
      if (!projectStages.includes(stage)) invalid();
      await this.initialize();
      const snapshot = await this.read(projectId);
      snapshot.project.workflow_step = stage;
      snapshot.project.updated_at = new Date(
        Math.max(Date.now(), Date.parse(snapshot.project.updated_at)),
      ).toISOString();
      assertInitialProjectSnapshot(snapshot);
      const folder = this.folder(projectId),
        staged = join(folder, `.project-${randomUUID()}.tmp`);
      let unpublished = true;
      try {
        await writeNew(staged, snapshot.project);
        await safeDirectory(this.root);
        await safeDirectory(folder);
        // Revalidate committed state before replacing only navigation metadata.
        await this.read(projectId);
        await rename(staged, join(folder, "project.json"));
        unpublished = false;
        return snapshot;
      } finally {
        if (unpublished) await unlink(staged).catch(() => undefined);
      }
    });
  }
}
