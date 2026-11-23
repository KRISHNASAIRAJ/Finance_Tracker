/**
 * useNotesBootstrap — initialises the v2 store and runs the one-time migration
 * the first time the feature is opened. Screens only mount when `notes_v2` is
 * on, so the old Personal Notes screen stays untouched by default.
 */
import { useEffect, useState } from 'react';

import { useAuth } from '../../../services/AuthProvider';
import { getDeviceId } from '../id';
import { isMigrationDone } from '../migration';
import { useNotesStore } from '../store';

export function useNotesBootstrap() {
  const { user } = useAuth();
  const initialize = useNotesStore((s) => s.initialize);
  const migrate = useNotesStore((s) => s.migrate);
  const hydrated = useNotesStore((s) => s.hydrated);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!user?.id) return;
    getDeviceId()
      .then((deviceId) => initialize(user.id!, deviceId))
      .then(async () => {
        if (!(await isMigrationDone())) await migrate();
      })
      .then(() => { if (alive) setError(null); })
      .catch((e) => {
        if (alive) setError(e?.message ?? 'Could not load notes');
      });
    return () => { alive = false; };
  }, [user?.id, initialize, migrate]);

  return { hydrated, error };
}
