/**
 * LockScreen — Banking-App Style
 *
 * Kein Button, kein NumPad. Die Authentifizierung startet sofort beim Mount
 * via expo-local-authentication (Face ID / Fingerprint / OS Passcode).
 *
 * Flow:
 *  1. useEffect → triggerOSUnlock() sofort
 *  2. Spinner + "Entsperren…" vor dem OS-Prompt sichtbar (kein Weißblitz)
 *  3. Nach OS-Erfolg → PIN aus SecureStore → v3 AES Chunked Decrypt
 *  4. App öffnet sich ohne weitere User-Interaktion
 *
 * App Resume: AppState Listener reaktiviert Auth bei Rückkehr aus dem Background.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  AppState,
  AppStateStatus,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Lock, RefreshCw, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';
import { useApp } from '@/context/AppContext';

const BIOMETRIC_PIN_KEY = 'teacher_app_biometric_pin';

export default function LockScreen() {
  const router = useRouter();
  const { authenticateWithPin, resetApp } = useApp();

  // isAuthInProgress: OS-Prompt ist gerade offen
  const [isAuthInProgress, setIsAuthInProgress] = useState(false);
  // isChecking: AES Chunked Decrypt läuft
  const [isChecking, setIsChecking] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState('Entsperren…');
  const [errorMsg, setErrorMsg] = useState('');
  const [successUnlock, setSuccessUnlock] = useState(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const successScaleAnim = useRef(new Animated.Value(1)).current;

  // Yield one animation frame so the spinner renders before the OS sheet pops up
  const waitForNextFrame = useCallback(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    []
  );

  const playSuccessAnimation = useCallback(() => {
    setSuccessUnlock(true);
    Animated.sequence([
      Animated.timing(successScaleAnim, { toValue: 1.25, duration: 130, useNativeDriver: true }),
      Animated.timing(successScaleAnim, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start();
  }, [successScaleAnim]);

  const triggerOSUnlock = useCallback(async () => {
    if (isAuthInProgress || isChecking || successUnlock) return;

    // 1. Spinner sofort sichtbar machen – kein Weißblitz
    setIsAuthInProgress(true);
    setErrorMsg('');
    setUnlockMessage('Entsperren…');

    if (Platform.OS === 'web') {
      setIsAuthInProgress(false);
      setErrorMsg('Biometrie wird im Web nicht unterstützt.');
      return;
    }

    try {
      // 2. Einen Frame warten damit Spinner gerendert wird, bevor OS-Sheet öffnet
      await waitForNextFrame();

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const supportedTypes = hasHardware
        ? await LocalAuthentication.supportedAuthenticationTypesAsync()
        : [];

      const hasFaceID = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
      const hasFingerprint = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
      const hasBiometric = hasFaceID || hasFingerprint ||
        supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS);

      console.log('[Lock] →', { hasHardware, hasFaceID, hasFingerprint });

      // Kein Auth-Hardware überhaupt vorhanden → Fehler (sehr seltener Edge-case)
      if (!hasHardware) {
        setIsAuthInProgress(false);
        setErrorMsg('Dieses Gerät unterstützt keine Authentifizierung.');
        return;
      }

      // Prompt-Text:
      //  → Face ID verfügbar: "Mit Face ID entsperren"
      //  → Fingerabdruck:     "Mit Fingerabdruck entsperren"
      //  → Keine Biometrie:   "Mit Geräte-PIN entsperren" (Fallback via OS)
      // disableDeviceFallback: false stellt sicher, dass der OS-Passcode/PIN
      // IMMER als Fallback angeboten wird, auch wenn keine Biometrie eingerichtet ist.
      const promptMessage = hasFaceID
        ? 'Mit Face ID entsperren'
        : hasFingerprint
        ? 'Mit Fingerabdruck entsperren'
        : 'Mit Geräte-PIN entsperren';

      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Passcode verwenden',
        disableDeviceFallback: false, // OS-Passcode IMMER als Fallback erlaubt
      });

      if (!authResult.success) {
        setIsAuthInProgress(false);
        const reason = (authResult as any).error ?? '';
        setErrorMsg(
          reason === 'user_cancel' || reason === 'system_cancel'
            ? 'Entsperrung abgebrochen.'
            : hasBiometric
            ? 'Authentifizierung fehlgeschlagen. Bitte erneut versuchen.'
            : 'Geräte-PIN falsch. Bitte erneut versuchen.'
        );
        return;
      }

      // 4. PIN aus Keychain holen — stumm, kein UI-Input nötig
      const storedAppPin = await SecureStore.getItemAsync(BIOMETRIC_PIN_KEY);
      if (!storedAppPin) {
        setIsAuthInProgress(false);
        setErrorMsg('Kein Schlüssel gefunden. Bitte App zurücksetzen.');
        return;
      }

      // 5. v3 AES Chunked Decrypt starten
      setIsAuthInProgress(false);
      setIsChecking(true);
      setUnlockMessage('Daten werden entschlüsselt…');

      const authSuccess = await authenticateWithPin(storedAppPin, (msg) => {
        // Progress-Callback aus dem Chunked Decrypt
        setUnlockMessage(msg || 'Entschlüsseln…');
      });

      if (!authSuccess) {
        setIsChecking(false);
        setErrorMsg('Entschlüsselung fehlgeschlagen. Bitte erneut versuchen.');
        return;
      }

      // 6. Erfolg
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSuccessAnimation();
      setTimeout(() => router.replace('/'), 350);
    } catch (e) {
      console.log('[Lock] Fehler:', e);
      setIsAuthInProgress(false);
      setIsChecking(false);
      setErrorMsg('Systemfehler. Bitte erneut versuchen.');
    }
  }, [authenticateWithPin, isAuthInProgress, isChecking, playSuccessAnimation, router, successUnlock, waitForNextFrame]);

  // Automatischer Start beim Mount
  useEffect(() => {
    triggerOSUnlock();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // App Resume → Auth erneut starten
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const fromBackground =
        (appStateRef.current === 'background' || appStateRef.current === 'inactive') &&
        next === 'active';
      appStateRef.current = next;
      if (fromBackground && !successUnlock) {
        triggerOSUnlock();
      }
    });
    return () => sub.remove();
  }, [successUnlock, triggerOSUnlock]);

  // Reset-Bestätigung (zweistufig)
  const handleReset = useCallback(() => {
    Alert.alert('App zurücksetzen?', 'Alle Daten werden unwiderruflich gelöscht.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Zurücksetzen',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Wirklich löschen?', 'Klassen, Notizen, PIN und Schlüssel werden dauerhaft entfernt.', [
            { text: 'Abbrechen', style: 'cancel' },
            { text: 'Alles löschen', style: 'destructive', onPress: resetApp },
          ]),
      },
    ]);
  }, [resetApp]);

  const isBusy = isAuthInProgress || isChecking;

  return (
    <BlurView intensity={40} tint="light" style={styles.root}>
      <View style={styles.dimmer} />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.authCard}>

          {/* App-Icon / Lock-Icon — immer sichtbar als Anker */}
          <Animated.View
            style={[styles.iconWrap, { transform: [{ scale: successScaleAnim }] }]}
          >
            <Lock size={24} color={successUnlock ? Colors.positive : Colors.primary} strokeWidth={2} />
          </Animated.View>

          <Text style={styles.appName}>LehrPlan</Text>

          {/* Spinner oder Erfolg */}
          <View style={styles.stateBox}>
            {isBusy && !successUnlock && (
              <ActivityIndicator size="small" color={Colors.primary} />
            )}
            {successUnlock && (
              <Text style={styles.successText}>✓</Text>
            )}
          </View>

          <Text style={styles.statusText}>
            {successUnlock ? 'Erfolgreich entsperrt' : unlockMessage}
          </Text>

          {/* Fehlermeldung + Retry — nur nach Fehler sichtbar */}
          {!isBusy && !successUnlock && errorMsg ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMsg}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={triggerOSUnlock} activeOpacity={0.8}>
                <RefreshCw size={14} color={Colors.primary} />
                <Text style={styles.retryText}>Erneut versuchen</Text>
              </TouchableOpacity>
            </View>
          ) : null}

        </View>

        {/* Reset-Link — dezent unten, immer erreichbar */}
        {!isBusy && !successUnlock && (
          <TouchableOpacity style={styles.resetLink} onPress={handleReset}>
            <Trash2 size={13} color={Colors.textLight} />
            <Text style={styles.resetLinkText}>App zurücksetzen</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  authCard: {
    backgroundColor: Colors.white,
    borderRadius: UI.radius.xl,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 290, // Compact iOS alert width
    ...UI.shadows.lg,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: UI.spacing.sm,
  },
  appName: {
    ...UI.font.headline,
    color: Colors.text,
    marginBottom: UI.spacing.md,
  },
  stateBox: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: {
    fontSize: 24,
    color: Colors.positive,
    fontWeight: '700',
  },
  statusText: {
    ...UI.font.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  errorBox: {
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    width: '100%',
  },
  errorText: {
    ...UI.font.caption,
    color: Colors.negative,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: UI.button.radius,
    width: '100%',
  },
  retryText: {
    color: Colors.primary,
    ...UI.font.body,
    fontWeight: '600' as const,
  },
  resetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    position: 'absolute',
    bottom: 32,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  resetLinkText: {
    fontSize: 13,
    color: Colors.textLight,
    fontWeight: '500',
  },
});
