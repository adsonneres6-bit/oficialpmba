import assert from "node:assert/strict";
import test from "node:test";
import {
  createProfileStorageMatcher,
  deleteProfileRowsFromSupabase,
  resetProfilePersistence,
  ResetPersistenceError,
} from "./resetPersistence.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] || null;
    },
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    entries() {
      return [...values.entries()];
    },
  };
}

function mockSupabase(rows, { denyDelete = false } = {}) {
  const queriedPatterns = [];
  return {
    queriedPatterns,
    rows,
    from(table) {
      assert.equal(table, "study_app_states");
      const query = { deleting: false, pattern: "" };
      const builder = {
        delete() {
          query.deleting = true;
          return builder;
        },
        select() {
          return builder;
        },
        like(column, pattern) {
          assert.equal(column, "device_id");
          query.pattern = pattern;
          queriedPatterns.push(pattern);
          return builder;
        },
        limit() {
          return builder;
        },
        then(resolve, reject) {
          try {
            const matcher = (deviceId) => {
              const literalPrefix = query.pattern
                .slice(0, -1)
                .replace(/\\([\\%_])/g, "$1");
              return deviceId.startsWith(literalPrefix);
            };
            if (query.deleting && !denyDelete) {
              for (const [deviceId] of rows) {
                if (matcher(deviceId)) rows.delete(deviceId);
              }
              resolve({ data: null, error: null });
            } else {
              resolve({
                data: [...rows.keys()]
                  .filter(matcher)
                  .slice(0, 1)
                  .map((device_id) => ({ device_id })),
                error: null,
              });
            }
          } catch (error) {
            reject(error);
          }
        },
      };
      return builder;
    },
  };
}

test("clears all profile exam caches but keeps unrelated application storage", async () => {
  const storage = memoryStorage({
    "study_app_active_exam__usuario_principal": "edital-a",
    "study_app_state_cache__usuario_principal__": "legacy",
    "study_app_state_cache__usuario_principal__edital-a": "a",
    "study_app_state_cache__usuario_principal__edital-b": "b",
    "study_app_previous_day_question_alert_ack__usuario_principal__edital-a":
      "2026-10-13",
    "study_app_state_cache__other_user__exam": "other",
    "unrelated-preference": "keep",
  });
  const remote = mockSupabase(
    new Map([
      ["usuario_principal__edital-a", { state: { notes: ["a"] } }],
      ["usuario_principal__edital-b", { state: { notes: ["b"] } }],
      ["usuario_principal__profile_index", { state: { customExams: ["a"] } }],
      ["other_user__edital", { state: { notes: ["other"] } }],
    ]),
  );
  const queueRef = { current: Promise.resolve() };

  const result = await resetProfilePersistence({
    queueRef,
    localStorage: storage,
    localKeyMatcher: createProfileStorageMatcher("usuario_principal"),
    deleteRemote: () =>
      deleteProfileRowsFromSupabase(
        remote,
        "study_app_states",
        "usuario_principal",
      ),
  });

  assert.equal(result.remoteCleared, true);
  assert.equal(
    storage.entries().some(([key]) =>
      createProfileStorageMatcher("usuario_principal")(key),
    ),
    false,
  );
  assert.equal(storage.getItem("unrelated-preference"), "keep");
  assert.equal(
    storage.getItem("study_app_state_cache__other_user__exam"),
    "other",
  );
  assert.deepEqual([...remote.rows.keys()], ["other_user__edital"]);
  assert.deepEqual(remote.queriedPatterns, [
    "usuario\\_principal\\_\\_%",
    "usuario\\_principal\\_\\_%",
  ]);
});

test("waits for queued old writes to finish before deleting remote profile data", async () => {
  let resolveQueuedWrite;
  const rows = new Map();
  const queueRef = {
    current: new Promise((resolve) => {
      resolveQueuedWrite = () => {
        rows.set("usuario_principal__edital", { stale: true });
        resolve();
      };
    }),
  };
  const storage = memoryStorage({
    "study_app_state_cache__usuario_principal__edital": "old",
  });
  const remote = mockSupabase(rows);
  let deleteStarted = false;
  const deleteRemote = async () => {
    deleteStarted = true;
    await deleteProfileRowsFromSupabase(
      remote,
      "study_app_states",
      "usuario_principal",
    );
  };

  const resetPromise = resetProfilePersistence({
    queueRef,
    localStorage: storage,
    localKeyMatcher: createProfileStorageMatcher("usuario_principal"),
    deleteRemote,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(deleteStarted, false);
  resolveQueuedWrite();
  const result = await resetPromise;

  assert.equal(result.remoteCleared, true);
  assert.deepEqual([...rows.keys()], []);
  assert.equal(
    storage.getItem("study_app_state_cache__usuario_principal__edital"),
    null,
  );
});

test("restores local state and rejects reset when remote deletion is denied", async () => {
  const storage = memoryStorage({
    "study_app_state_cache__usuario_principal__exam": "recoverable",
    "unrelated": "value",
  });
  const rows = new Map([
    ["usuario_principal__exam", { state: { schedule: ["old"] } }],
  ]);
  const remote = mockSupabase(rows, { denyDelete: true });

  await assert.rejects(
    resetProfilePersistence({
      queueRef: { current: Promise.resolve() },
      localStorage: storage,
      localKeyMatcher: createProfileStorageMatcher("usuario_principal"),
      deleteRemote: () =>
        deleteProfileRowsFromSupabase(
          remote,
          "study_app_states",
          "usuario_principal",
        ),
    }),
    (error) => {
      assert.equal(error instanceof ResetPersistenceError, true);
      assert.equal(error.step, "remote storage cleanup");
      assert.equal(error.rollbackError, null);
      return true;
    },
  );

  assert.equal(
    storage.getItem("study_app_state_cache__usuario_principal__exam"),
    "recoverable",
  );
  assert.equal(rows.has("usuario_principal__exam"), true);
  assert.equal(storage.getItem("unrelated"), "value");
});

test("restores all scanned local entries if local cleanup itself fails", async () => {
  const storage = memoryStorage({
    "study_app_state_cache__usuario_principal__one": "first",
    "study_app_state_cache__usuario_principal__two": "second",
  });
  const originalRemove = storage.removeItem;
  let shouldFail = true;
  storage.removeItem = (key) => {
    if (key.endsWith("__two") && shouldFail) {
      shouldFail = false;
      throw new Error("storage unavailable");
    }
    originalRemove(key);
  };
  let remoteDeleteCalled = false;

  await assert.rejects(
    resetProfilePersistence({
      queueRef: { current: Promise.resolve() },
      localStorage: storage,
      localKeyMatcher: createProfileStorageMatcher("usuario_principal"),
      deleteRemote: async () => {
        remoteDeleteCalled = true;
      },
    }),
    (error) => {
      assert.equal(error instanceof ResetPersistenceError, true);
      assert.equal(error.step, "local storage cleanup");
      return true;
    },
  );

  assert.equal(remoteDeleteCalled, false);
  assert.deepEqual(
    storage.entries().sort(([a], [b]) => a.localeCompare(b)),
    [
      ["study_app_state_cache__usuario_principal__one", "first"],
      ["study_app_state_cache__usuario_principal__two", "second"],
    ],
  );
});

test("does not report remote completion when the service is unconfigured", async () => {
  const storage = memoryStorage({
    "study_app_state_cache__usuario_principal__exam": "old",
  });
  const result = await resetProfilePersistence({
    queueRef: { current: Promise.resolve() },
    localStorage: storage,
    localKeyMatcher: createProfileStorageMatcher("usuario_principal"),
  });

  assert.equal(result.remoteCleared, false);
  assert.equal(result.localRemovedCount, 1);
});
