import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { useApp } from '@/context/AppContext';

export const AUTO_LOCK_TIMEOUT_KEY = 'teacher_app_auto_lock_timeout_ms';

export const AUTO_LOCK_OPTIONS = [
  { label: 'Sofort', valueMs: 0 },
  { label: '1 Minute', valueMs: 60 * 1000 },
  { label: '5 Minuten', valueMs: 5 * 60 * 1000 },
  { label: '10 Minuten', valueMs: 10 * 60 * 1000 },
  { label: '30 Minuten', valueMs: 30 * 60 * 1000 },
] as const;

const DEFAULT_TIMEOUT_MS = AUTO_LOCK_OPTIONS[2].valueMs;

export function useAutoLock() {
  const { isAuthenticated, data, lock } = useApp();
  const [timeoutMs, setTimeoutMs] = useState<number>(DEFAULT_TIMEOUT_MS);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundAtRef = useRef<number | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
  }, []);

  const shouldProtect = isAuthenticated && data.onboardingComplete;

  const scheduleInactivityLock = useCallback(
    (overrideMs?: number) => {
      clearInactivityTimer();
      if (!shouldProtect) return;

      const delay = overrideMs ?? timeoutMs;
      if (delay < 0) return;
      inactivityTimerRef.current = setTimeout(() => {
        lock();
      }, delay);
    },
    [clearInactivityTimer, lock, shouldProtect, timeoutMs]
  );

  const registerInteraction = useCallback(() => {
    // "Sofort" is interpreted as immediate lock on background.
    // While active, we keep the session alive and only reset timer when timeout > 0.
    if (timeoutMs > 0) {
      scheduleInactivityLock();
    }
  }, [scheduleInactivityLock, timeoutMs]);

  const setAutoLockTimeout = useCallback(async (nextTimeoutMs: number) => {
    setTimeoutMs(nextTimeoutMs);
    await AsyncStorage.setItem(AUTO_LOCK_TIMEOUT_KEY, String(nextTimeoutMs));
  }, []);

  useEffect(() => {
    const loadStoredTimeout = async () => {
      const raw = await AsyncStorage.getItem(AUTO_LOCK_TIMEOUT_KEY);
      if (!raw) return;
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        setTimeoutMs(parsed);
      }
    };
    loadStoredTimeout();
  }, []);

  useEffect(() => {
    if (!shouldProtect) {
      clearInactivityTimer();
      return;
    }
    if (timeoutMs > 0) {
      scheduleInactivityLock();
    }
    return clearInactivityTimer;
  }, [clearInactivityTimer, scheduleInactivityLock, shouldProtect, timeoutMs]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (!shouldProtect) return;

      if (nextState === 'background' || nextState === 'inactive') {
        backgroundAtRef.current = Date.now();
        clearInactivityTimer();
        if (timeoutMs === 0) {
          lock();
        }
        return;
      }

      if ((prevState === 'background' || prevState === 'inactive') && nextState === 'active') {
        const startedAt = backgroundAtRef.current;
        backgroundAtRef.current = null;

        if (timeoutMs === 0) {
          lock();
          return;
        }

        const elapsed = startedAt ? Date.now() - startedAt : 0;
        if (elapsed >= timeoutMs) {
          lock();
          return;
        }

        scheduleInactivityLock(timeoutMs - elapsed);
      }
    });

    return () => subscription.remove();
  }, [clearInactivityTimer, lock, scheduleInactivityLock, shouldProtect, timeoutMs]);

  const currentOptionLabel = useMemo(() => {
    return AUTO_LOCK_OPTIONS.find((option) => option.valueMs === timeoutMs)?.label ?? '5 Minuten';
  }, [timeoutMs]);

  return {
    timeoutMs,
    currentOptionLabel,
    options: AUTO_LOCK_OPTIONS,
    setAutoLockTimeout,
    registerInteraction,
  };
}
