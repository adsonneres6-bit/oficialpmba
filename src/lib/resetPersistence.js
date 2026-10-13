export class ResetPersistenceError extends Error {
  constructor(step, cause, rollbackError = null) {
    super(`Reset failed during ${step}.`, { cause });
    this.name = "ResetPersistenceError";
    this.step = step;
    this.rollbackError = rollbackError;
  }
}

export function createProfileStorageMatcher(profileKey) {
  const profilePrefix = `${profileKey}__`;
  return (key) =>
    key === `study_app_active_exam__${profileKey}` ||
    key === "study_app_device_id" ||
    key.startsWith(`study_app_state_cache__${profilePrefix}`) ||
    key.startsWith(
      `study_app_previous_day_question_alert_ack__${profilePrefix}`,
    );
}

export async function deleteProfileRowsFromSupabase(
  supabase,
  table,
  profileKey,
) {
  const escapedPrefix = `${profileKey}__`.replace(/[\\%_]/g, "\\$&");
  const pattern = `${escapedPrefix}%`;
  const { data: matchingRows, error: listError } = await supabase
    .from(table)
    .select("device_id")
    .like("device_id", pattern);
  if (listError) throw listError;
  const deviceIds = [
    ...new Set((matchingRows || []).map((row) => row.device_id).filter(Boolean)),
  ];
  if (!deviceIds.length) return;

  const { data: deletedRows, error: deleteError } = await supabase
    .from(table)
    .delete()
    .in("device_id", deviceIds)
    .select("device_id");
  if (deleteError) throw deleteError;
  if ((deletedRows || []).length !== deviceIds.length) {
    const error = new Error(
      "Supabase did not authorize deleting every profile row. Check the table's DELETE RLS policy and the user's database authorization.",
    );
    error.code = "RESET_REMOTE_DELETE_DENIED";
    throw error;
  }

  const { data, error: verifyError } = await supabase
    .from(table)
    .select("device_id")
    .like("device_id", pattern)
    .limit(1);
  if (verifyError) throw verifyError;
  if (data?.length) {
    const error = new Error(
      "Profile rows remain after deletion verification. Another client may have recreated a row during reset.",
    );
    error.code = "RESET_REMOTE_ROWS_REMAIN";
    throw error;
  }
}

function clearMatchingStorage(storage, matcher) {
  const snapshot = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key && matcher(key)) snapshot.push([key, storage.getItem(key)]);
  }

  try {
    snapshot.forEach(([key]) => storage.removeItem(key));
    const remaining = snapshot.find(([key]) => storage.getItem(key) !== null);
    if (remaining) throw new Error("Some application storage keys remain.");
  } catch (error) {
    let rollbackError = null;
    try {
      snapshot.forEach(([key, value]) => {
        if (value !== null) storage.setItem(key, value);
      });
    } catch (restoreError) {
      rollbackError = restoreError;
    }
    throw new ResetPersistenceError("local storage cleanup", error, rollbackError);
  }

  return {
    removedCount: snapshot.length,
    restore() {
      snapshot.forEach(([key, value]) => {
        if (value !== null) storage.setItem(key, value);
      });
    },
  };
}

export async function resetProfilePersistence({
  queueRef,
  localStorage,
  localKeyMatcher,
  deleteRemote,
}) {
  try {
    await queueRef.current;
  } catch (error) {
    throw new ResetPersistenceError("waiting for pending saves", error);
  }

  const clearedLocal = clearMatchingStorage(localStorage, localKeyMatcher);
  if (typeof deleteRemote !== "function") {
    return {
      localRemovedCount: clearedLocal.removedCount,
      remoteCleared: false,
    };
  }

  try {
    await deleteRemote();
  } catch (error) {
    let rollbackError = null;
    try {
      clearedLocal.restore();
    } catch (restoreError) {
      rollbackError = restoreError;
    }
    throw new ResetPersistenceError(
      "remote storage cleanup",
      error,
      rollbackError,
    );
  }

  return {
    localRemovedCount: clearedLocal.removedCount,
    remoteCleared: true,
  };
}
