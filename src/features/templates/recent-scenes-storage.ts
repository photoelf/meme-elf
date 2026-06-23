export const RECENT_SCENES_STORAGE_KEY = 'meme-elf.recent-scenes';
const MAX_RECENT_SCENES = 10;

export type RecentSceneEntry = {
  id: string;
  name: string;
  updatedAt: string;
  document: string;
};

export function readRecentSceneEntries(storage: Storage): RecentSceneEntry[] {
  const rawEntries = storage.getItem(RECENT_SCENES_STORAGE_KEY);

  if (!rawEntries) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawEntries) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isRecentSceneEntry);
  } catch {
    return [];
  }
}

export function upsertRecentSceneEntry(
  storage: Storage,
  input: {
    name: string;
    updatedAt: string;
    document: string;
  },
) {
  const nextEntry: RecentSceneEntry = {
    id: normalizeRecentSceneId(input.name),
    name: normalizeRecentSceneName(input.name),
    updatedAt: input.updatedAt,
    document: input.document,
  };
  const nextEntries = [
    nextEntry,
    ...readRecentSceneEntries(storage).filter((entry) => entry.id !== nextEntry.id),
  ].slice(0, MAX_RECENT_SCENES);

  storage.setItem(RECENT_SCENES_STORAGE_KEY, JSON.stringify(nextEntries));
  return nextEntries;
}

export function removeRecentSceneEntry(storage: Storage, sceneId: string) {
  const nextEntries = readRecentSceneEntries(storage).filter((entry) => entry.id !== sceneId);
  storage.setItem(RECENT_SCENES_STORAGE_KEY, JSON.stringify(nextEntries));
  return nextEntries;
}

function isRecentSceneEntry(value: unknown): value is RecentSceneEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    typeof candidate.updatedAt === 'string' &&
    candidate.updatedAt.length > 0 &&
    typeof candidate.document === 'string';
}

function normalizeRecentSceneId(name: string) {
  const normalized = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized.length > 0 ? normalized : 'untitled-scene';
}

function normalizeRecentSceneName(name: string) {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'Untitled scene';
}
