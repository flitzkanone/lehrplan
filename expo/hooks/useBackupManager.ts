import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { useApp } from '@/context/AppContext';

export type BackupSchedule = 'daily' | 'weekly' | 'monthly';

const BACKUP_SCHEDULE_KEY = 'teacher_app_backup_schedule';
const BACKUP_LAST_RUN_AT_KEY = 'teacher_app_backup_last_run_at';

const INTERVAL_MS: Record<BackupSchedule, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function useBackupManager() {
  const { isAuthenticated, data, createEncryptedBackup, listBackupFiles, restoreEncryptedBackup } = useApp();
  const [schedule, setSchedule] = useState<BackupSchedule>('weekly');
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [knownBackups, setKnownBackups] = useState<string[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const runningRef = useRef(false);

  const refreshBackups = useCallback(async () => {
    const files = await listBackupFiles();
    setKnownBackups(files);
  }, [listBackupFiles]);

  const loadMeta = useCallback(async () => {
    const [storedSchedule, storedLastRun] = await Promise.all([
      AsyncStorage.getItem(BACKUP_SCHEDULE_KEY),
      AsyncStorage.getItem(BACKUP_LAST_RUN_AT_KEY),
    ]);
    if (storedSchedule === 'daily' || storedSchedule === 'weekly' || storedSchedule === 'monthly') {
      setSchedule(storedSchedule);
    }
    if (storedLastRun) {
      setLastBackupAt(storedLastRun);
    }
  }, []);

  useEffect(() => {
    loadMeta();
    refreshBackups();
  }, [loadMeta, refreshBackups]);

  const setBackupSchedule = useCallback(async (next: BackupSchedule) => {
    setSchedule(next);
    await AsyncStorage.setItem(BACKUP_SCHEDULE_KEY, next);
  }, []);

  const runManualBackup = useCallback(async () => {
    const result = await createEncryptedBackup('manual');
    await AsyncStorage.setItem(BACKUP_LAST_RUN_AT_KEY, result.createdAt);
    setLastBackupAt(result.createdAt);
    await refreshBackups();
    return result;
  }, [createEncryptedBackup, refreshBackups]);

  const maybeRunScheduledBackup = useCallback(async () => {
    if (!isAuthenticated || !data.onboardingComplete || runningRef.current) return;

    const now = Date.now();
    const dueMs = INTERVAL_MS[schedule];
    const lastRunRaw = await AsyncStorage.getItem(BACKUP_LAST_RUN_AT_KEY);
    const lastRunMs = lastRunRaw ? new Date(lastRunRaw).getTime() : 0;
    const isDue = !lastRunMs || now - lastRunMs >= dueMs;
    if (!isDue) return;

    runningRef.current = true;
    try {
      const result = await createEncryptedBackup('auto');
      await AsyncStorage.setItem(BACKUP_LAST_RUN_AT_KEY, result.createdAt);
      setLastBackupAt(result.createdAt);
      await refreshBackups();
    } finally {
      runningRef.current = false;
    }
  }, [createEncryptedBackup, data.onboardingComplete, isAuthenticated, refreshBackups, schedule]);

  useEffect(() => {
    maybeRunScheduledBackup();
  }, [maybeRunScheduledBackup]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackground = appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextState;
      if (wasBackground && nextState === 'active') {
        maybeRunScheduledBackup();
      }
    });
    return () => subscription.remove();
  }, [maybeRunScheduledBackup]);

  const restoreBackup = useCallback(
    async (path: string, password?: string) => {
      await restoreEncryptedBackup(path, password);
      await refreshBackups();
    },
    [refreshBackups, restoreEncryptedBackup]
  );

  const latestBackup = useMemo(() => knownBackups[0] ?? null, [knownBackups]);

  return {
    schedule,
    lastBackupAt,
    knownBackups,
    latestBackup,
    setBackupSchedule,
    runManualBackup,
    restoreBackup,
    refreshBackups,
  };
}
