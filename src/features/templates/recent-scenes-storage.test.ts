import { describe, expect, it } from 'vitest';

describe('recent scenes storage', () => {
  it('upserts recent scene entries and keeps the newest first', async () => {
    const mod = await import('./recent-scenes-storage');
    const storage = createStorageStub();

    mod.upsertRecentSceneEntry(storage, {
      document: '{"name":"First"}',
      name: 'First',
      updatedAt: '2026-06-22T10:00:00.000Z',
    });
    mod.upsertRecentSceneEntry(storage, {
      document: '{"name":"Second"}',
      name: 'Second',
      updatedAt: '2026-06-22T11:00:00.000Z',
    });
    mod.upsertRecentSceneEntry(storage, {
      document: '{"name":"First updated"}',
      name: 'First',
      updatedAt: '2026-06-22T12:00:00.000Z',
    });

    expect(mod.readRecentSceneEntries(storage)).toEqual([
      {
        document: '{"name":"First updated"}',
        id: 'first',
        name: 'First',
        updatedAt: '2026-06-22T12:00:00.000Z',
      },
      {
        document: '{"name":"Second"}',
        id: 'second',
        name: 'Second',
        updatedAt: '2026-06-22T11:00:00.000Z',
      },
    ]);
  });

  it('removes malformed entries and caps the list length', async () => {
    const mod = await import('./recent-scenes-storage');
    const storage = createStorageStub();

    storage.setItem(mod.RECENT_SCENES_STORAGE_KEY, JSON.stringify([{ bad: true }]));
    expect(mod.readRecentSceneEntries(storage)).toEqual([]);

    for (let index = 0; index < 12; index += 1) {
      mod.upsertRecentSceneEntry(storage, {
        document: `{"index":${index}}`,
        name: `Scene ${index}`,
        updatedAt: `2026-06-22T12:${String(index).padStart(2, '0')}:00.000Z`,
      });
    }

    expect(mod.readRecentSceneEntries(storage)).toHaveLength(10);
    expect(mod.readRecentSceneEntries(storage)[0]?.name).toBe('Scene 11');
    expect(mod.readRecentSceneEntries(storage)[9]?.name).toBe('Scene 2');
  });

  it('removes entries by id', async () => {
    const mod = await import('./recent-scenes-storage');
    const storage = createStorageStub();

    mod.upsertRecentSceneEntry(storage, {
      document: '{"name":"Keep"}',
      name: 'Keep',
      updatedAt: '2026-06-22T10:00:00.000Z',
    });
    mod.upsertRecentSceneEntry(storage, {
      document: '{"name":"Delete"}',
      name: 'Delete',
      updatedAt: '2026-06-22T11:00:00.000Z',
    });

    mod.removeRecentSceneEntry(storage, 'delete');

    expect(mod.readRecentSceneEntries(storage)).toEqual([
      {
        document: '{"name":"Keep"}',
        id: 'keep',
        name: 'Keep',
        updatedAt: '2026-06-22T10:00:00.000Z',
      },
    ]);
  });
});

function createStorageStub(): Storage {
  const data = new Map<string, string>();

  return {
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null;
    },
    get length() {
      return data.size;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}
