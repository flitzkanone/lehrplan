import re

content = """import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import createContextHook from '@nkzw/create-context-hook';
import CryptoJS from 'crypto-js';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { logModuleStarting, logModuleReady } from '@/utils/startupLogger';
import { logAuditEvent } from '@/utils/auditLog';
import type {
  AppData,
  SchoolClass,
  Student,
  ParticipationEntry,
  HomeworkEntry,
  AbsenceEntry,
  LateEntry,
  LessonSession,
  TeacherProfile,
  ParticipationRating,
  ParticipationReason,
  HomeworkStatus,
} from '@/types';
import {
  encrypt,
  decrypt,
  decryptLegacy,
  hashPin,
  verifyPin,
  verifyPinLegacy,
  isLegacyFormat,
  getOrCreateDeviceSalt,
  clearKeyCache,
} from '@/utils/encryption';
import {
  showLessonNotification,
  updateLessonNotification,
  dismissLessonNotification,
  setupNotificationCategories,
} from '@/utils/lessonNotification';

const STORAGE_KEY_CORE = 'teacher_app_core_encrypted';
const STORAGE_KEY_CLASSES = 'teacher_app_classes_encrypted';
const STORAGE_KEY_HISTORY = 'teacher_app_history_encrypted';
const LEGACY_STORAGE_KEY = 'teacher_app_data_encrypted';

const AUTO_LOCK_TIMEOUT_MS = 30 * 1000;
const PIN_HASH_KEY = 'teacher_app_pin_hash';
const PRIVACY_ACCEPTED_KEY = 'teacher_app_privacy_accepted';
const PIN_LENGTH_KEY = 'teacher_app_pin_length';
const PIN_HASH_VERSION_KEY = 'teacher_app_pin_hash_version';

const defaultData: AppData = {
  profile: { name: '', school: '', subjects: [] },
  classes: [],
  participations: [],
  homeworkEntries: [],
  absenceEntries: [],
  lateEntries: [],
  activeSession: null,
  onboardingComplete: false,
  pinHash: '',
};

function generateId(): string {
  return Date.now().toString(36) + CryptoJS.lib.WordArray.random(8).toString();
}

export const [AppProvider, useApp] = createContextHook(() => {
  const [data, setData] = useState<AppData>(defaultData);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);
  const [storedPinHash, setStoredPinHash] = useState<string>('');
  const [pinLength, setPinLength] = useState<number>(6);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const currentPinRef = useRef<string>('');
  const deviceSaltRef = useRef<string>('');
  const latestDataRef = useRef<AppData>(defaultData);
  const backgroundTimestampRef = useRef<number>(0);

  const appProviderLogged = useRef(false);

  useEffect(() => {
    if (!appProviderLogged.current) {
      appProviderLogged.current = true;
      logModuleStarting('AppProvider');
    }
  }, []);

  useEffect(() => {
    const initApp = async () => {
      try {
        const salt = await getOrCreateDeviceSalt();
        deviceSaltRef.current = salt;
        
        const hash = await SecureStore.getItemAsync(PIN_HASH_KEY);
        if (hash) setStoredPinHash(hash);
        
        const len = await SecureStore.getItemAsync(PIN_LENGTH_KEY);
        if (len) setPinLength(parseInt(len, 10));

        const privacy = await AsyncStorage.getItem(PRIVACY_ACCEPTED_KEY);
        setPrivacyAccepted(privacy === 'true');
        
      } catch (e) {
        console.error('Initialization error:', e);
      } finally {
        setIsLoading(false);
        logModuleReady('AppProvider');
      }
    };
    initApp();
  }, []);

  const saveToStorage = async (newData: AppData) => {
    if (!currentPinRef.current) return;
    const salt = deviceSaltRef.current;
    if (!salt) return;
    
    try {
      const core = {
        profile: newData.profile,
        activeSession: newData.activeSession,
        onboardingComplete: newData.onboardingComplete,
        pinHash: newData.pinHash
      };
      const classes = newData.classes;
      const history = {
        participations: newData.participations,
        homeworkEntries: newData.homeworkEntries,
        absenceEntries: newData.absenceEntries,
        lateEntries: newData.lateEntries
      };

      const [encCore, encClasses, encHistory] = await Promise.all([
        Promise.resolve(encrypt(JSON.stringify(core), currentPinRef.current, salt)),
        Promise.resolve(encrypt(JSON.stringify(classes), currentPinRef.current, salt)),
        Promise.resolve(encrypt(JSON.stringify(history), currentPinRef.current, salt))
      ]);

      await AsyncStorage.multiSet([
        [STORAGE_KEY_CORE, encCore],
        [STORAGE_KEY_CLASSES, encClasses],
        [STORAGE_KEY_HISTORY, encHistory]
      ]);
    } catch (e) {
      console.error('Failed to persist chunked state:', e);
    }
  };

  const save = useCallback(
    (updater: (prev: AppData) => AppData) => {
      setData((prev) => {
        try {
          const next = updater(prev);
          latestDataRef.current = next;
          // Synchronous memory update. Persisted later to avoid lag.
          return next;
        } catch (error) {
          console.error('[AppContext] Error in save updater:', error);
          return prev;
        }
      });
    },
    []
  );

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        backgroundTimestampRef.current = Date.now();
        if (currentPinRef.current && latestDataRef.current.onboardingComplete) {
          saveToStorage(latestDataRef.current);
        }
      } else if (nextAppState === 'active') {
        if (backgroundTimestampRef.current > 0) {
          const elapsed = Date.now() - backgroundTimestampRef.current;
          if (elapsed >= AUTO_LOCK_TIMEOUT_MS && latestDataRef.current.onboardingComplete && currentPinRef.current) {
            setIsAuthenticated(false);
          }
          backgroundTimestampRef.current = 0;
        }
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const completeOnboarding = useCallback(
    async (profile: TeacherProfile, pin: string) => {
      const salt = await getOrCreateDeviceSalt();
      deviceSaltRef.current = salt;
      currentPinRef.current = pin;
      const pinHashValue = hashPin(pin, salt);
      await SecureStore.setItemAsync(PIN_HASH_KEY, pinHashValue);
      await SecureStore.setItemAsync(PIN_LENGTH_KEY, String(pin.length));
      await SecureStore.setItemAsync(PIN_HASH_VERSION_KEY, 'v2');
      setStoredPinHash(pinHashValue);
      setPinLength(pin.length);

      const newData: AppData = {
        ...defaultData,
        profile,
        onboardingComplete: true,
        pinHash: pinHashValue,
      };
      
      setData(newData);
      latestDataRef.current = newData;
      await saveToStorage(newData);
      setIsAuthenticated(true);
    },
    []
  );

  const updateProfile = useCallback(
    (profile: Partial<TeacherProfile>) => {
      save((prev) => ({
        ...prev,
        profile: { ...prev.profile, ...profile },
      }));
    },
    [save]
  );

  const updatePin = useCallback(
    async (newPin: string) => {
      const salt = deviceSaltRef.current || (await getOrCreateDeviceSalt());
      deviceSaltRef.current = salt;
      const newPinHash = hashPin(newPin, salt);
      currentPinRef.current = newPin;
      await SecureStore.setItemAsync(PIN_HASH_KEY, newPinHash);
      await SecureStore.setItemAsync(PIN_LENGTH_KEY, String(newPin.length));
      await SecureStore.setItemAsync(PIN_HASH_VERSION_KEY, 'v2');
      setStoredPinHash(newPinHash);
      setPinLength(newPin.length);
      
      if (latestDataRef.current.onboardingComplete) {
        await saveToStorage(latestDataRef.current);
      }
      save((prev) => ({ ...prev, pinHash: newPinHash }));
    },
    [save]
  );

  const addClass = useCallback(
    (name: string) => {
      const newClass: SchoolClass = {
        id: generateId(),
        name,
        students: [],
        createdAt: new Date().toISOString(),
      };
      save((prev) => ({ ...prev, classes: [...prev.classes, newClass] }));
      return newClass;
    },
    [save]
  );

  const deleteClass = useCallback(
    (classId: string) => {
      save((prev) => ({
        ...prev,
        classes: prev.classes.filter((c) => c.id !== classId),
        participations: prev.participations.filter((p) => p.classId !== classId),
        homeworkEntries: (prev.homeworkEntries || []).filter((h) => h.classId !== classId),
        absenceEntries: (prev.absenceEntries || []).filter((a) => a.classId !== classId),
        lateEntries: (prev.lateEntries || []).filter((l) => l.classId !== classId),
      }));
    },
    [save]
  );

  const addStudent = useCallback(
    (classId: string, firstName: string, lastName: string, note: string) => {
      const student: Student = { id: generateId(), firstName, lastName, note };
      save((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId ? { ...c, students: [...c.students, student] } : c
        ),
      }));
      return student;
    },
    [save]
  );

  const updateStudent = useCallback(
    (classId: string, studentId: string, updates: Partial<Student>) => {
      save((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? {
              ...c,
              students: c.students.map((s) =>
                s.id === studentId ? { ...s, ...updates } : s
              ),
            }
            : c
        ),
      }));
    },
    [save]
  );

  const deleteStudent = useCallback(
    (classId: string, studentId: string) => {
      save((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? { ...c, students: c.students.filter((s) => s.id !== studentId) }
            : c
        ),
        participations: prev.participations.filter((p) => p.studentId !== studentId),
        homeworkEntries: (prev.homeworkEntries || []).filter((h) => h.studentId !== studentId),
        absenceEntries: (prev.absenceEntries || []).filter((a) => a.studentId !== studentId),
        lateEntries: (prev.lateEntries || []).filter((l) => l.studentId !== studentId),
      }));
    },
    [save]
  );

  const startSession = useCallback(
    (classId: string, subject: string) => {
      const session: LessonSession = {
        id: generateId(),
        classId,
        subject,
        startedAt: new Date().toISOString(),
        ratings: {},
        reasons: {},
        homework: {},
      };
      save((prev) => {
        const schoolClass = prev.classes.find((c) => c.id === classId);
        const totalStudents = schoolClass?.students.length || 0;
        showLessonNotification(session, schoolClass, 0, totalStudents);
        return { ...prev, activeSession: session };
      });
      return session;
    },
    [save]
  );

  const rateStudent = useCallback(
    (studentId: string, rating: ParticipationRating, reason: ParticipationReason = null) => {
      save((prev) => {
        if (!prev.activeSession) return prev;
        const newRatings = { ...prev.activeSession.ratings, [studentId]: rating };
        const newReasons = { ...(prev.activeSession.reasons || {}), [studentId]: reason };
        const schoolClass = prev.classes.find((c) => c.id === prev.activeSession!.classId);
        const totalStudents = schoolClass?.students.length || 0;
        const ratedCount = Object.keys(newRatings).length;

        updateLessonNotification(
          { ...prev.activeSession, ratings: newRatings },
          schoolClass,
          ratedCount,
          totalStudents
        );

        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            ratings: newRatings,
            reasons: newReasons,
          },
        };
      });
    },
    [save]
  );

  const rateHomework = useCallback(
    (studentId: string, status: HomeworkStatus) => {
      save((prev) => {
        if (!prev.activeSession) return prev;
        const newHomework = { ...prev.activeSession.homework, [studentId]: status };
        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            homework: newHomework,
          },
        };
      });
    },
    [save]
  );

  const markAbsent = useCallback(
    (studentId: string, isAbsent: boolean) => {
      save((prev) => {
        if (!prev.activeSession) return prev;
        const newAbsent = { ...(prev.activeSession.absent || {}) };
        if (isAbsent) {
          newAbsent[studentId] = true;
        } else {
          delete newAbsent[studentId];
        }
        return {
          ...prev,
          activeSession: { ...prev.activeSession, absent: newAbsent },
        };
      });
    },
    [save]
  );

  const markLate = useCallback(
    (studentId: string, minutes: number | null) => {
      save((prev) => {
        if (!prev.activeSession) return prev;
        const newLate = { ...(prev.activeSession.lateMinutes || {}) };
        if (minutes === null) {
          delete newLate[studentId];
        } else {
          newLate[studentId] = minutes;
        }
        return {
          ...prev,
          activeSession: { ...prev.activeSession, lateMinutes: newLate },
        };
      });
    },
    [save]
  );

  const endSession = useCallback(async () => {
    dismissLessonNotification();
    save((prev) => {
      if (!prev.activeSession) return prev;
      const session = prev.activeSession;
      const classObj = prev.classes.find((c) => c.id === session.classId);
      if (!classObj) return { ...prev, activeSession: null };

      const newEntries: ParticipationEntry[] = classObj.students
        .filter((s) => !(session.absent?.[s.id]))
        .map((s) => ({
        id: generateId(),
        studentId: s.id,
        classId: session.classId,
        subject: session.subject,
        rating: session.ratings[s.id] || 'o',
        reason: session.reasons?.[s.id] || null,
        date: session.startedAt,
        sessionId: session.id,
      }));

      const newHomeworkEntries: HomeworkEntry[] = Object.entries(session.homework || {}).map(
        ([studentId, status]) => ({
          id: generateId(),
          studentId,
          classId: session.classId,
          subject: session.subject,
          status: status as HomeworkStatus,
          date: session.startedAt,
          sessionId: session.id,
        })
      );

      const newAbsenceEntries: AbsenceEntry[] = Object.entries(session.absent || {})
        .filter(([, isAbsent]) => isAbsent)
        .map(([studentId]) => ({
          id: generateId(),
          studentId,
          classId: session.classId,
          subject: session.subject,
          date: session.startedAt,
          sessionId: session.id,
        }));

      const newLateEntries: LateEntry[] = Object.entries(session.lateMinutes || {})
        .map(([studentId, minutes]) => ({
          id: generateId(),
          studentId,
          classId: session.classId,
          subject: session.subject,
          minutes,
          date: session.startedAt,
          sessionId: session.id,
        }));

      return {
        ...prev,
        participations: [...prev.participations, ...newEntries],
        homeworkEntries: [...(prev.homeworkEntries || []), ...newHomeworkEntries],
        absenceEntries: [...(prev.absenceEntries || []), ...newAbsenceEntries],
        lateEntries: [...(prev.lateEntries || []), ...newLateEntries],
        activeSession: null,
      };
    });
    
    // Explicitly commit to storage after completing history manipulation
    setTimeout(() => {
      saveToStorage(latestDataRef.current);
    }, 50);
  }, [save]);

  const authenticateWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      if (!storedPinHash) return false;

      const salt = deviceSaltRef.current || (await getOrCreateDeviceSalt());
      deviceSaltRef.current = salt;

      const hashVersion = await SecureStore.getItemAsync(PIN_HASH_VERSION_KEY);
      let pinVerified = false;
      let needsHashMigration = false;

      if (!hashVersion || hashVersion === 'v1') {
        pinVerified = verifyPinLegacy(pin, storedPinHash);
        if (pinVerified) needsHashMigration = true;
      } else {
        pinVerified = verifyPin(pin, storedPinHash, salt);
      }

      if (!pinVerified) return false;

      if (needsHashMigration) {
        const newHash = hashPin(pin, salt);
        await SecureStore.setItemAsync(PIN_HASH_KEY, newHash);
        await SecureStore.setItemAsync(PIN_HASH_VERSION_KEY, 'v2');
        setStoredPinHash(newHash);
      }

      currentPinRef.current = pin;

      // Load data chunks or legacy
      const [legacy, core, classes, history] = await Promise.all([
        AsyncStorage.getItem(LEGACY_STORAGE_KEY),
        AsyncStorage.getItem(STORAGE_KEY_CORE),
        AsyncStorage.getItem(STORAGE_KEY_CLASSES),
        AsyncStorage.getItem(STORAGE_KEY_HISTORY)
      ]);

      let parsedData: AppData = defaultData;

      if (core) {
        try {
          const uCore = JSON.parse(decrypt(core, pin, salt) || '{}');
          const uClasses = classes ? JSON.parse(decrypt(classes, pin, salt) || '[]') : [];
          const uHistory = history ? JSON.parse(decrypt(history, pin, salt) || '{}') : {};

          parsedData = {
            ...defaultData,
            ...uCore,
            classes: uClasses,
            participations: uHistory.participations || [],
            homeworkEntries: uHistory.homeworkEntries || [],
            absenceEntries: uHistory.absenceEntries || [],
            lateEntries: uHistory.lateEntries || [],
          };
        } catch(e) {
          console.error("V3 decrypt error", e);
          return false;
        }
      } else if (legacy) {
        // Fallback backward-compatibility parsing
        let decrypted = decrypt(legacy, pin, salt);
        if (!decrypted && isLegacyFormat(legacy)) {
           decrypted = decryptLegacy(legacy, pin);
        }
        if (decrypted) {
          parsedData = JSON.parse(decrypted) as AppData;
          // Trigger migration to chunked format on next save
          setTimeout(() => saveToStorage(parsedData), 100);
        } else {
          return false;
        }
      }

      setData(parsedData);
      latestDataRef.current = parsedData;

      if (parsedData.activeSession) {
        const schoolClass = parsedData.classes.find((c) => c.id === parsedData.activeSession!.classId);
        showLessonNotification(
          parsedData.activeSession, schoolClass, 
          Object.keys(parsedData.activeSession.ratings).length, 
          schoolClass?.students.length || 0
        );
      }

      setIsAuthenticated(true);
      setupNotificationCategories();
      return true;
    },
    [storedPinHash]
  );

  const authenticate = useCallback(() => setIsAuthenticated(true), []);

  const lock = useCallback(() => {
    currentPinRef.current = '';
    clearKeyCache();
    setIsAuthenticated(false);
  }, []);

  const resetApp = useCallback(async () => {
    await AsyncStorage.multiRemove([
      LEGACY_STORAGE_KEY,
      STORAGE_KEY_CORE,
      STORAGE_KEY_CLASSES,
      STORAGE_KEY_HISTORY,
      PRIVACY_ACCEPTED_KEY
    ]);
    await SecureStore.deleteItemAsync(PIN_HASH_KEY);
    await SecureStore.deleteItemAsync(PIN_LENGTH_KEY);
    await SecureStore.deleteItemAsync(PIN_HASH_VERSION_KEY);
    
    currentPinRef.current = '';
    setData(defaultData);
    setIsAuthenticated(false);
    setPrivacyAccepted(false);
    setStoredPinHash('');
    setPinLength(6);
  }, []);

  const acceptPrivacy = useCallback(async () => {
    await AsyncStorage.setItem(PRIVACY_ACCEPTED_KEY, 'true');
    setPrivacyAccepted(true);
  }, []);

  const getCurrentPin = useCallback(() => currentPinRef.current, []);

  return {
    data,
    isLoading,
    isAuthenticated,
    storedPinHash,
    pinLength,
    privacyAccepted,
    authenticate,
    authenticateWithPin,
    lock,
    completeOnboarding,
    updateProfile,
    updatePin,
    addClass,
    deleteClass,
    addStudent,
    updateStudent,
    deleteStudent,
    startSession,
    rateStudent,
    rateHomework,
    markAbsent,
    markLate,
    endSession,
    resetApp,
    acceptPrivacy,
    getCurrentPin
  };
});
"""

with open("utils/AppContext.tsx", "w") as f:
    f.write(content)
