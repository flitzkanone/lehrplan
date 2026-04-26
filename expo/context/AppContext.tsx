import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import createContextHook from '@nkzw/create-context-hook';
import CryptoJS from 'crypto-js';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
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

const PIN_HASH_KEY = 'teacher_app_pin_hash';
const PRIVACY_ACCEPTED_KEY = 'teacher_app_privacy_accepted';
const PIN_LENGTH_KEY = 'teacher_app_pin_length';
const PIN_HASH_VERSION_KEY = 'teacher_app_pin_hash_version';
const BIOMETRIC_PIN_KEY = 'teacher_app_biometric_pin';
const BACKUP_MAGIC = 'teacher_app_backup_v1';
const BACKUP_VERSION = 1;
const BACKUP_DIR = `${FileSystem.documentDirectory}backups`;

// ─── Subscription Storage Keys ────────────────────────────────────────────────
const SUB_DATA_KEY = 'teacher_app_subscription_data';
const TRIAL_DATA_KEY = 'teacher_app_trial_data';

export interface SubscriptionData {
  status: 'active' | 'expired';
  expiresAt: number;
  lastKnownTime: number;
  storeReceipt: string | null;
}

export interface TrialData {
  trialActive: boolean;
  trialEndDate: number | null; // unix ms
}

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
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export const [AppProvider, useApp] = createContextHook(() => {
  const [data, setData] = useState<AppData>(defaultData);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);
  const [storedPinHash, setStoredPinHash] = useState<string>('');
  const [pinLength, setPinLength] = useState<number>(6);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);

  // ─── Subscription / Trial State ────────────────────────────────────────────
  // null = not yet checked (loading), false = no sub, true = active
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [trialActive, setTrialActive] = useState<boolean>(false);
  const [trialEndDate, setTrialEndDate] = useState<number | null>(null);

  const currentPinRef = useRef<string>('');
  const deviceSaltRef = useRef<string>('');
  const latestDataRef = useRef<AppData>(defaultData);

  const appProviderLogged = useRef(false);

  const ensureBackupDir = useCallback(async (): Promise<void> => {
    const info = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
    }
  }, []);

  const resolveBackupKey = useCallback(async (fallbackPassword?: string): Promise<string | null> => {
    if (currentPinRef.current) return currentPinRef.current;
    const securePin = await SecureStore.getItemAsync(BIOMETRIC_PIN_KEY);
    if (securePin) return securePin;
    if (fallbackPassword?.trim()) return fallbackPassword.trim();
    return null;
  }, []);

  useEffect(() => {
    if (!appProviderLogged.current) {
      appProviderLogged.current = true;
      logModuleStarting('AppProvider');
    }
  }, []);

  // ─── Subscription / Trial Check ────────────────────────────────────────────
  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const now = Date.now();

      // 1. Check paid subscription
      const subStr = await SecureStore.getItemAsync(SUB_DATA_KEY);
      if (subStr) {
        const sub: SubscriptionData = JSON.parse(subStr);
        if (sub.status === 'active' && now < sub.expiresAt) {
          setIsSubscribed(true);
          return;
        }
        // Expired — mark as expired in store
        const expired: SubscriptionData = { ...sub, status: 'expired' };
        await SecureStore.setItemAsync(SUB_DATA_KEY, JSON.stringify(expired));
      }

      // 2. Check trial
      const trialStr = await AsyncStorage.getItem(TRIAL_DATA_KEY);
      if (trialStr) {
        const trial: TrialData = JSON.parse(trialStr);
        if (trial.trialActive && trial.trialEndDate && now < trial.trialEndDate) {
          setTrialActive(true);
          setTrialEndDate(trial.trialEndDate);
          setIsSubscribed(true); // trial counts as "subscribed" for access
          return;
        }
        // Trial expired — reset
        if (trial.trialActive) {
          const expiredTrial: TrialData = { trialActive: false, trialEndDate: trial.trialEndDate };
          await AsyncStorage.setItem(TRIAL_DATA_KEY, JSON.stringify(expiredTrial));
          setTrialActive(false);
          setTrialEndDate(null);
        }
      }

      setIsSubscribed(false);
    } catch (e) {
      console.error('[Subscription] Check failed:', e);
      setIsSubscribed(false);
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

        // Always check subscription on boot
        await checkSubscriptionStatus();
        
      } catch (e) {
        console.error('Initialization error:', e);
      } finally {
        setIsLoading(false);
        logModuleReady('AppProvider');
      }
    };
    initApp();
  }, [checkSubscriptionStatus]);

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

      const encCore = encrypt(JSON.stringify(core), currentPinRef.current, salt);
      await new Promise((r) => setTimeout(r, 15));

      const encClasses = encrypt(JSON.stringify(classes), currentPinRef.current, salt);
      await new Promise((r) => setTimeout(r, 15));

      const encHistory = encrypt(JSON.stringify(history), currentPinRef.current, salt);

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

  const completeOnboarding = useCallback(
    async (profile: TeacherProfile, pin: string, onProgress?: (msg: string, percent: number) => void) => {
      onProgress?.('Generiere sicheren Schlüssel...', 10);
      await new Promise((r) => setTimeout(r, 30));

      const salt = await getOrCreateDeviceSalt();
      deviceSaltRef.current = salt;
      currentPinRef.current = pin;
      const pinHashValue = hashPin(pin, salt);
      await SecureStore.setItemAsync(PIN_HASH_KEY, pinHashValue);
      await SecureStore.setItemAsync(PIN_LENGTH_KEY, String(pin.length));
      await SecureStore.setItemAsync(PIN_HASH_VERSION_KEY, 'v3');
      setStoredPinHash(pinHashValue);
      setPinLength(pin.length);

      const newData: AppData = {
        ...defaultData,
        profile,
        onboardingComplete: true,
        pinHash: pinHashValue,
      };

      onProgress?.('Profildaten werden verschlüsselt...', 40);
      await new Promise((r) => setTimeout(r, 30));
      const core = {
        profile: newData.profile,
        activeSession: newData.activeSession,
        onboardingComplete: newData.onboardingComplete,
        pinHash: newData.pinHash
      };
      const encCore = encrypt(JSON.stringify(core), pin, salt);
      await AsyncStorage.setItem(STORAGE_KEY_CORE, encCore);

      onProgress?.('Klassendaten werden verschlüsselt...', 70);
      await new Promise((r) => setTimeout(r, 30));
      const classes = newData.classes;
      const encClasses = encrypt(JSON.stringify(classes), pin, salt);
      await AsyncStorage.setItem(STORAGE_KEY_CLASSES, encClasses);

      onProgress?.('Historie wird gespeichert...', 90);
      await new Promise((r) => setTimeout(r, 30));
      const history = {
        participations: newData.participations,
        homeworkEntries: newData.homeworkEntries,
        absenceEntries: newData.absenceEntries,
        lateEntries: newData.lateEntries
      };
      const encHistory = encrypt(JSON.stringify(history), pin, salt);
      await AsyncStorage.setItem(STORAGE_KEY_HISTORY, encHistory);

      onProgress?.('Abgeschlossen', 100);
      await new Promise((r) => setTimeout(r, 30));

      setData(newData);
      latestDataRef.current = newData;
      setIsAuthenticated(true);
    },
    []
  );

  const updateProfile = useCallback(
    (profile: Partial<TeacherProfile>) => {
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return;
      }
      save((prev) => ({
        ...prev,
        profile: { ...prev.profile, ...profile },
      }));
    },
    [save, isPreviewMode]
  );

  const updatePin = useCallback(
    async (newPin: string) => {
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return false;
      }
      const salt = deviceSaltRef.current || (await getOrCreateDeviceSalt());
      deviceSaltRef.current = salt;
      const newPinHash = hashPin(newPin, salt);
      currentPinRef.current = newPin;
      await SecureStore.setItemAsync(PIN_HASH_KEY, newPinHash);
      await SecureStore.setItemAsync(PIN_LENGTH_KEY, String(newPin.length));
      await SecureStore.setItemAsync(PIN_HASH_VERSION_KEY, 'v3');
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
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return null;
      }
      const student: Student = { id: generateId(), firstName, lastName, note };
      save((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId ? { ...c, students: [...c.students, student] } : c
        ),
      }));
      return student;
    },
    [save, isPreviewMode]
  );

  const updateStudent = useCallback(
    (classId: string, studentId: string, updates: Partial<Student>) => {
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return;
      }
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
    [save, isPreviewMode]
  );

  const deleteStudent = useCallback(
    (classId: string, studentId: string) => {
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return;
      }
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
    [save, isPreviewMode]
  );

  const startSession = useCallback(
    (classId: string, subject: string) => {
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return null;
      }
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
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return;
      }
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
    [save, isPreviewMode]
  );

  const rateHomework = useCallback(
    (studentId: string, status: HomeworkStatus) => {
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return;
      }
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
    [save, isPreviewMode]
  );

  const markAbsent = useCallback(
    (studentId: string, isAbsent: boolean) => {
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return;
      }
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
    [save, isPreviewMode]
  );

  const markLate = useCallback(
    (studentId: string, minutes: number | null) => {
      if (isPreviewMode) {
        Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
        return;
      }
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
    [save, isPreviewMode]
  );

  const endSession = useCallback(async () => {
    if (isPreviewMode) {
      Alert.alert('Vorschaumodus', 'Im Vorschaumodus können keine Änderungen vorgenommen werden.');
      return;
    }
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
    async (pin: string, onProgress?: (msg: string, percent: number) => void): Promise<boolean> => {
      onProgress?.('Verifiziere PIN...', 10);
      await new Promise(r => setTimeout(r, 15));

      if (!storedPinHash) return false;

      const salt = deviceSaltRef.current || (await getOrCreateDeviceSalt());
      deviceSaltRef.current = salt;

      const hashVersion = await SecureStore.getItemAsync(PIN_HASH_VERSION_KEY);
      let pinVerified = false;
      let needsHashMigration = false;

      if (!hashVersion || hashVersion === 'v1') {
        pinVerified = verifyPinLegacy(pin, storedPinHash);
        if (pinVerified) needsHashMigration = true;
      } else if (hashVersion === 'v2') {
        // We import ITERATIONS_V2 mentally by just passing 100000 here
        pinVerified = verifyPin(pin, storedPinHash, salt, 100000);
        if (pinVerified) needsHashMigration = true;
      } else {
        pinVerified = verifyPin(pin, storedPinHash, salt);
      }

      if (!pinVerified) return false;

      if (needsHashMigration) {
        const newHash = hashPin(pin, salt);
        await SecureStore.setItemAsync(PIN_HASH_KEY, newHash);
        await SecureStore.setItemAsync(PIN_HASH_VERSION_KEY, 'v3');
        setStoredPinHash(newHash);
      }

      currentPinRef.current = pin;

      onProgress?.('Lese Speicherplätze...', 20);
      await new Promise(r => setTimeout(r, 15));

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
          onProgress?.('Entschlüssele Profil...', 40);
          await new Promise(r => setTimeout(r, 15));
          const uCore = JSON.parse(decrypt(core, pin, salt) || '{}');

          onProgress?.('Entschlüssele Klassen...', 60);
          await new Promise(r => setTimeout(r, 15));
          const uClasses = classes ? JSON.parse(decrypt(classes, pin, salt) || '[]') : [];

          onProgress?.('Lade Historie...', 80);
          await new Promise(r => setTimeout(r, 15));
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
        onProgress?.('Migriere alte Daten...', 50);
        await new Promise(r => setTimeout(r, 15));
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

  // ─── Start Trial (Mock) ────────────────────────────────────────────────────
  const startTrial = useCallback(async () => {
    const trialEnd = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
    const trialData: TrialData = { trialActive: true, trialEndDate: trialEnd };
    await AsyncStorage.setItem(TRIAL_DATA_KEY, JSON.stringify(trialData));
    setTrialActive(true);
    setTrialEndDate(trialEnd);
    setIsSubscribed(true);
  }, []);

  // ─── Set Subscribed (after real IAP purchase) ──────────────────────────────
  const setSubscribedState = useCallback(async (expiresAt: number, receipt: string) => {
    const subData: SubscriptionData = {
      status: 'active',
      expiresAt,
      lastKnownTime: Date.now(),
      storeReceipt: receipt,
    };
    await SecureStore.setItemAsync(SUB_DATA_KEY, JSON.stringify(subData));
    setIsSubscribed(true);
  }, []);

  const resetApp = useCallback(async () => {
    await AsyncStorage.multiRemove([
      LEGACY_STORAGE_KEY,
      STORAGE_KEY_CORE,
      STORAGE_KEY_CLASSES,
      STORAGE_KEY_HISTORY,
      PRIVACY_ACCEPTED_KEY,
      TRIAL_DATA_KEY,
    ]);
    await SecureStore.deleteItemAsync(PIN_HASH_KEY);
    await SecureStore.deleteItemAsync(PIN_LENGTH_KEY);
    await SecureStore.deleteItemAsync(PIN_HASH_VERSION_KEY);
    await SecureStore.deleteItemAsync(SUB_DATA_KEY);
    
    currentPinRef.current = '';
    setData(defaultData);
    setIsAuthenticated(false);
    setPrivacyAccepted(false);
    setStoredPinHash('');
    setPinLength(6);
    setIsSubscribed(false);
    setTrialActive(false);
    setTrialEndDate(null);
    setIsPreviewMode(false);
  }, []);

  const acceptPrivacy = useCallback(async () => {
    await AsyncStorage.setItem(PRIVACY_ACCEPTED_KEY, 'true');
    setPrivacyAccepted(true);
  }, []);

  const getCurrentPin = useCallback(() => currentPinRef.current, []);

  const listBackupFiles = useCallback(async (): Promise<string[]> => {
    await ensureBackupDir();
    const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
    return files
      .filter((name) => name.endsWith('.backup'))
      .map((name) => `${BACKUP_DIR}/${name}`)
      .sort((a, b) => b.localeCompare(a));
  }, [ensureBackupDir]);

  const createEncryptedBackup = useCallback(
    async (reason: 'manual' | 'auto' = 'manual', fallbackPassword?: string): Promise<{ path: string; createdAt: string }> => {
      const key = await resolveBackupKey(fallbackPassword);
      if (!key) {
        throw new Error('Kein Backup-Schlüssel verfügbar (SecureStore/Passwort fehlt).');
      }
      const salt = deviceSaltRef.current || (await getOrCreateDeviceSalt());
      deviceSaltRef.current = salt;

      const snapshot = latestDataRef.current;
      const payload = {
        core: {
          profile: snapshot.profile,
          activeSession: snapshot.activeSession,
          onboardingComplete: snapshot.onboardingComplete,
          pinHash: snapshot.pinHash,
        },
        classes: snapshot.classes,
        history: {
          participations: snapshot.participations,
          homeworkEntries: snapshot.homeworkEntries,
          absenceEntries: snapshot.absenceEntries,
          lateEntries: snapshot.lateEntries,
        },
      };

      const createdAt = new Date().toISOString();
      const encryptedPayload = encrypt(JSON.stringify(payload), key, salt);
      const envelope = {
        magic: BACKUP_MAGIC,
        version: BACKUP_VERSION,
        createdAt,
        reason,
        algorithm: 'aes-256-cbc+hmac-sha256',
        salt,
        encryptedPayload,
      };

      await ensureBackupDir();
      const safeTs = createdAt.replace(/[:.]/g, '-');
      const path = `${BACKUP_DIR}/teacher_backup_${safeTs}.backup`;
      await FileSystem.writeAsStringAsync(path, JSON.stringify(envelope));
      return { path, createdAt };
    },
    [ensureBackupDir, resolveBackupKey]
  );

  const restoreEncryptedBackup = useCallback(
    async (path: string, fallbackPassword?: string): Promise<void> => {
      if (!path.startsWith(BACKUP_DIR)) {
        throw new Error('Ungültiger Backup-Pfad.');
      }
      const raw = await FileSystem.readAsStringAsync(path);
      const parsed = JSON.parse(raw);
      if (
        parsed?.magic !== BACKUP_MAGIC ||
        parsed?.version !== BACKUP_VERSION ||
        typeof parsed?.encryptedPayload !== 'string'
      ) {
        throw new Error('Ungültige Backup-Datei (Header/Signatur passt nicht).');
      }

      const key = await resolveBackupKey(fallbackPassword);
      if (!key) {
        throw new Error('Kein Schlüssel zur Wiederherstellung verfügbar.');
      }
      const salt = String(parsed.salt || '');
      if (!salt) {
        throw new Error('Backup-Datei enthält keinen gültigen Salt.');
      }

      const decrypted = decrypt(parsed.encryptedPayload, key, salt);
      if (!decrypted) {
        throw new Error('Backup konnte nicht entschlüsselt werden (Schlüssel/Integrität fehlgeschlagen).');
      }

      const payload = JSON.parse(decrypted);
      // Security hardening: if this device/profile already has a PIN hash,
      // reject backups from a different cryptographic identity.
      const incomingPinHash = payload?.core?.pinHash;
      if (storedPinHash && incomingPinHash && incomingPinHash !== storedPinHash) {
        throw new Error('Backup stammt von einer anderen App-Identität und wurde blockiert.');
      }

      const nextData: AppData = {
        ...defaultData,
        ...(payload.core || {}),
        classes: payload.classes || [],
        participations: payload.history?.participations || [],
        homeworkEntries: payload.history?.homeworkEntries || [],
        absenceEntries: payload.history?.absenceEntries || [],
        lateEntries: payload.history?.lateEntries || [],
      };

      deviceSaltRef.current = salt;
      currentPinRef.current = key;
      await saveToStorage(nextData);
      latestDataRef.current = nextData;
      setData(nextData);

      if (nextData.pinHash) {
        await SecureStore.setItemAsync(PIN_HASH_KEY, nextData.pinHash);
        await SecureStore.setItemAsync(PIN_HASH_VERSION_KEY, 'v3');
        setStoredPinHash(nextData.pinHash);
      }
    },
    [resolveBackupKey, storedPinHash]
  );

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
    getCurrentPin,
    createEncryptedBackup,
    restoreEncryptedBackup,
    listBackupFiles,
    isPreviewMode,
    setIsPreviewMode,
    // Subscription / Trial
    isSubscribed,
    trialActive,
    trialEndDate,
    startTrial,
    setSubscribedState,
    checkSubscriptionStatus,
  };
});
