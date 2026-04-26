import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Shield,
  ChevronRight,
  LogOut,
  ChevronDown,
  Download,
  Trash2,
  Fingerprint,
  Info,
  Lock,
  CheckCircle,
  Clock,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';
import { useApp } from '@/context/AppContext';
import { useAutoLock } from '@/hooks/useAutoLock';
import { BackupSchedule, useBackupManager } from '@/hooks/useBackupManager';
import AppButton from '@/components/ui/AppButton';
import AppCard from '@/components/ui/AppCard';
import ExportModal from '@/components/modals/ExportModal';

const BIOMETRIC_ENABLED_KEY = 'teacher_app_biometric_enabled';
const BIOMETRIC_PIN_KEY = 'teacher_app_biometric_pin';
const APP_VERSION = '1.0.0';

// ─── Types ────────────────────────────────────────────────────────────────────
type ActiveModal = null | 'reset_confirm' | 'reset_final' | 'export' | 'auto_lock' | 'backup_schedule' | 'backup_restore';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data, lock, resetApp, getCurrentPin } = useApp();
  const { options: autoLockOptions, currentOptionLabel, setAutoLockTimeout } = useAutoLock();
  const {
    schedule,
    lastBackupAt,
    latestBackup,
    setBackupSchedule,
    runManualBackup,
    restoreBackup,
  } = useBackupManager();

  // ── UI State ──
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [restorePassword, setRestorePassword] = useState('');

  // ── Biometric State ──
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => false);
  
  // Load biometric preference once
  React.useEffect(() => {
    SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY).then(val => {
      setBiometricEnabled(val === 'true');
    });
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const showBusy = (text: string) => {
    setIsBusy(true);
    setBusyText(text);
  };
  const hideBusy = () => {
    setIsBusy(false);
    setBusyText('');
  };

  // ── Handlers ─────────────────────────────────────────────────────────────────

  /** Biometrie ein/ausschalten */
  const handleToggleBiometric = useCallback(async (value: boolean) => {
    if (value) {
      // Verify hardware is available before enabling
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometrie nicht verfügbar',
          'Kein Face ID oder Fingerabdruck auf diesem Gerät eingerichtet.'
        );
        return;
      }
      // Store the current pin for biometric unlock
      const currentPin = getCurrentPin();
      if (currentPin) {
        await SecureStore.setItemAsync(BIOMETRIC_PIN_KEY, currentPin);
      }
    } else {
      // Remove stored biometric pin
      await SecureStore.deleteItemAsync(BIOMETRIC_PIN_KEY);
    }
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, value ? 'true' : 'false');
    setBiometricEnabled(value);
  }, [getCurrentPin]);

  /** Zweistufiger App-Reset */
  const handleResetFinal = useCallback(async () => {
    setActiveModal(null);
    showBusy('Lösche alle Daten…');
    try {
      // clearKeyCache is called inside resetApp (via AppContext)
      await resetApp();
      // Also delete biometric stored pin
      await SecureStore.deleteItemAsync(BIOMETRIC_PIN_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    } catch (e) {
      Alert.alert('Reset-Fehler', String(e));
    } finally {
      hideBusy();
    }
  }, [resetApp]);

  const handleCreateBackup = useCallback(async () => {
    setActiveModal(null);
    showBusy('Erstelle verschlüsseltes Backup…');
    try {
      const result = await runManualBackup();
      Alert.alert('Backup erstellt', `Datei gespeichert:\n${result.path.split('/').pop()}`);
    } catch (e) {
      Alert.alert('Backup-Fehler', String(e));
    } finally {
      hideBusy();
    }
  }, [runManualBackup]);

  const handleRestoreBackup = useCallback(async () => {
    if (!latestBackup) {
      Alert.alert('Keine Backups', 'Es wurde keine Backup-Datei gefunden.');
      return;
    }
    setActiveModal(null);
    showBusy('Wiederherstellung läuft…');
    try {
      await restoreBackup(latestBackup, restorePassword || undefined);
      setRestorePassword('');
      Alert.alert('Wiederherstellung erfolgreich', 'Die Daten wurden verschlüsselt importiert.');
    } catch (e) {
      Alert.alert('Restore-Fehler', String(e));
    } finally {
      hideBusy();
    }
  }, [latestBackup, restoreBackup, restorePassword]);

  const scheduleLabel: Record<BackupSchedule, string> = {
    daily: 'Täglich',
    weekly: 'Wöchentlich',
    monthly: 'Monatlich',
  };

  // ── Sub-Components ────────────────────────────────────────────────────────────
  const Row = ({ label, right, icon, onPress, destructive, isLast }: {
    label: string;
    right?: React.ReactNode;
    icon?: React.ReactNode;
    onPress?: () => void;
    destructive?: boolean;
    isLast?: boolean;
  }) => (
    <TouchableOpacity style={[styles.row, isLast && styles.rowLast]} onPress={onPress} disabled={!onPress} activeOpacity={0.6}>
      {icon && <View style={styles.rowIconWrap}>{icon}</View>}
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {right !== undefined ? right : (onPress ? <ChevronRight size={16} color={Colors.textLight} /> : null)}
    </TouchableOpacity>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      >
        <Text style={styles.screenTitle}>Einstellungen</Text>

        {/* Profile Card */}
        <AppCard style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>
              {data.profile.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{data.profile.name || 'Kein Name'}</Text>
            <Text style={styles.profileSchool}>{data.profile.school || 'Keine Schule'}</Text>
          </View>
        </AppCard>

        {/* ── Security Section ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>SICHERHEIT</Text>
          <AppCard style={styles.sectionCard}>
            <Row
              label={`Auto-Lock (${currentOptionLabel})`}
              onPress={() => setActiveModal('auto_lock')}
              icon={<Shield size={18} color={Colors.primary} />}
            />
            <View style={[styles.row, styles.rowNoArrow]}>
              <View style={styles.rowIconWrap}>
                <Fingerprint size={18} color={Colors.primary} />
              </View>
              <Text style={styles.rowLabelText}>
                {Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'Fingerabdruck / Gesicht'}
              </Text>
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: Colors.divider, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
            <View style={[styles.row, styles.rowNoArrow, styles.rowLast]}>
              <View style={styles.rowIconWrap}>
                <CheckCircle size={18} color={Colors.positive} />
              </View>
              <Text style={styles.rowHintText}>
                AES-256 · PBKDF2 35k · v3 KeyCache aktiv
              </Text>
            </View>
          </AppCard>
        </View>

        {/* ── Export Section ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>BACKUP & EXPORT</Text>
          <AppCard style={styles.sectionCard}>
            <Row
              label="Backup erstellen"
              onPress={handleCreateBackup}
              icon={<Download size={18} color={Colors.primary} />}
            />
            <Row
              label={`Backup-Zyklus (${scheduleLabel[schedule]})`}
              onPress={() => setActiveModal('backup_schedule')}
              icon={<Clock size={18} color={Colors.primary} />}
            />
            <Row
              label="Backup wiederherstellen"
              onPress={() => setActiveModal('backup_restore')}
              icon={<Lock size={18} color={Colors.primary} />}
            />
            <Row
              label="Daten exportieren (PDF, Excel, JSON)"
              onPress={() => setIsExportModalVisible(true)}
              icon={<Download size={18} color={Colors.primary} />}
            />
            <View style={[styles.row, styles.rowNoArrow]}>
              <Text style={styles.rowHintText}>
                Letztes Backup: {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'Noch keines'}
              </Text>
            </View>
            <View style={[styles.row, styles.rowNoArrow, styles.rowLast]}>
              <Text style={styles.rowHintText}>
                Automatische Backups bleiben lokal verschlüsselt (AES-256-CBC + HMAC).
              </Text>
            </View>
          </AppCard>
        </View>

        {/* ── About Section ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>ÜBER DIE APP</Text>
          <AppCard style={styles.sectionCard}>
            <View style={[styles.row, styles.rowNoArrow]}>
              <View style={[styles.rowIconWrap, { backgroundColor: Colors.neutralLight }]}>
                <Info size={18} color={Colors.textSecondary} />
              </View>
              <Text style={styles.rowLabelText}>App-Version</Text>
              <Text style={styles.rowHintText}>{APP_VERSION}</Text>
            </View>
            <View style={[styles.row, styles.rowNoArrow]}>
              <View style={[styles.rowIconWrap, { backgroundColor: Colors.neutralLight }]}>
                <Shield size={18} color={Colors.textSecondary} />
              </View>
              <Text style={styles.rowLabelText}>Datenspeicherung</Text>
              <Text style={styles.rowHintText}>Lokal · Offline-First</Text>
            </View>
            <View style={[styles.row, styles.rowNoArrow, styles.rowLast]}>
              <Text style={styles.rowHintText}>
                Alle Daten werden ausschließlich lokal auf diesem Gerät gespeichert und mit AES-256 verschlüsselt. Kein Server, keine Cloud, 100% DSGVO-konform.
              </Text>
            </View>
          </AppCard>
        </View>

        {/* ── Danger Zone ── */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>GEFAHRENZONE</Text>
          <AppCard style={styles.sectionCard}>
            <Row
              label="App sperren"
              onPress={lock}
              icon={<LogOut size={18} color={Colors.warning} />}
            />
            <Row
              label="App zurücksetzen"
              onPress={() => setActiveModal('reset_confirm')}
              icon={<Trash2 size={18} color={Colors.negative} />}
              destructive
              isLast
            />
          </AppCard>
        </View>

      </ScrollView>

      {/* ── Full-screen Loading Overlay ── */}
      <Modal transparent visible={isBusy} animationType="fade">
        <View style={styles.overlayContainer}>
          <View style={styles.overlayContent}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.overlayText}>{busyText}</Text>
          </View>
        </View>
      </Modal>

      {/* ── Auto-lock modal ── */}
      <Modal transparent visible={activeModal === 'auto_lock'} animationType="slide">
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Lock size={20} color={Colors.primary} />
              <Text style={styles.modalTitle}>Auto-Lock</Text>
            </View>
            <Text style={styles.modalHint}>
              Legt fest, wann die App nach Inaktivität oder nach Rückkehr aus dem Hintergrund automatisch gesperrt wird.
            </Text>

            <View style={styles.modalOptionsContainer}>
              {autoLockOptions.map((option) => (
                <TouchableOpacity
                  key={option.valueMs}
                  style={[
                    styles.optionRow,
                    option.label === currentOptionLabel && styles.optionRowActive,
                  ]}
                  onPress={async () => {
                    await setAutoLockTimeout(option.valueMs);
                    setActiveModal(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionRowText,
                      option.label === currentOptionLabel && styles.optionRowTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {option.label === currentOptionLabel && (
                    <CheckCircle size={20} color={Colors.text} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setActiveModal(null)}>
              <Text style={styles.modalCancelText}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      {/* ── Backup schedule modal ── */}
      <Modal transparent visible={activeModal === 'backup_schedule'} animationType="slide">
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Lock size={20} color={Colors.primary} />
              <Text style={styles.modalTitle}>Geplante Backups</Text>
            </View>
            <Text style={styles.modalHint}>
              Backups werden automatisch beim Starten/Wiederaufnehmen geprüft und bei Fälligkeit erstellt.
            </Text>
            <View style={styles.modalOptionsContainer}>
              {(['daily', 'weekly', 'monthly'] as BackupSchedule[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionRow, 
                    option === schedule && styles.optionRowActive
                  ]}
                  onPress={async () => {
                    await setBackupSchedule(option);
                    setActiveModal(null);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionRowText, option === schedule && styles.optionRowTextActive]}>
                    {scheduleLabel[option]}
                  </Text>
                  {option === schedule && <CheckCircle size={20} color={Colors.text} />}
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setActiveModal(null)}>
              <Text style={styles.modalCancelText}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </Modal>

      {/* ── Backup restore modal ── */}
      <Modal transparent visible={activeModal === 'backup_restore'} animationType="slide">
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Lock size={20} color={Colors.primary} />
              <Text style={styles.modalTitle}>Backup wiederherstellen</Text>
            </View>
            <Text style={styles.modalHint}>
              Erkennt signierte Backup-Dateien und prüft Integrität via HMAC vor dem Import.
            </Text>
            <Text style={styles.modalHint}>
              Datei: {latestBackup ? latestBackup.split('/').pop() : 'Keine Backup-Datei gefunden'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={restorePassword}
              onChangeText={setRestorePassword}
              secureTextEntry
              placeholder="Optionales Backup-Passwort"
              placeholderTextColor={Colors.textLight}
            />
            <View style={styles.modalActions}>
              <View style={{flex: 1}}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setActiveModal(null)} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>Abbrechen</Text>
                </TouchableOpacity>
              </View>
              <View style={{flex: 1}}>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, !latestBackup && styles.modalBtnDisabled]}
                  disabled={!latestBackup}
                  onPress={handleRestoreBackup}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalConfirmText}>Jetzt wiederherstellen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* ── Reset Step 1: Confirm ── */}
      <Modal transparent visible={activeModal === 'reset_confirm'} animationType="slide">
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Trash2 size={20} color={Colors.negative} />
              <Text style={[styles.modalTitle, { color: Colors.negative }]}>App zurücksetzen?</Text>
            </View>
            <Text style={styles.modalHint}>
              Dies löscht ALLE lokalen Daten unwiderruflich: Klassen, Schüler, Bewertungen, PIN und Schlüssel.
            </Text>
            <View style={styles.modalActions}>
              <View style={{flex: 1}}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setActiveModal(null)} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>Abbrechen</Text>
                </TouchableOpacity>
              </View>
              <View style={{flex: 1}}>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: Colors.negative }]}
                  onPress={() => setActiveModal('reset_final')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalConfirmText, { color: Colors.white }]}>Weiter</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* ── Reset Step 2: Final confirm ── */}
      <Modal transparent visible={activeModal === 'reset_final'} animationType="slide">
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Trash2 size={20} color={Colors.negative} />
              <Text style={[styles.modalTitle, { color: Colors.negative }]}>Wirklich löschen?</Text>
            </View>
            <Text style={styles.modalHint}>
              ⚠️ Letzter Schritt. Es gibt kein Zurück. AsyncStorage, SecureStore und KeyCache werden vollständig geleert.
            </Text>
            <View style={styles.modalActions}>
              <View style={{flex: 1}}>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setActiveModal(null)} activeOpacity={0.7}>
                  <Text style={styles.modalCancelText}>Abbrechen</Text>
                </TouchableOpacity>
              </View>
              <View style={{flex: 1}}>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, { backgroundColor: Colors.negative }]}
                  onPress={handleResetFinal}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalConfirmText, { color: Colors.white }]}>Alles löschen</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </BlurView>
      </Modal>

      <ExportModal 
        visible={isExportModalVisible}
        onClose={() => setIsExportModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: UI.spacing.screenMargin, paddingBottom: 130 },
  screenTitle: { ...UI.font.largeTitle, marginBottom: UI.spacing.md, color: Colors.text },

  // Profile
  profileCard: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { ...UI.font.title, color: Colors.primary },
  profileName: { ...UI.font.headline, color: Colors.text },
  profileSchool: { ...UI.font.body, color: Colors.textSecondary, marginTop: 2 },

  // Section Cards
  sectionContainer: {
    marginBottom: UI.spacing.xl,
  },
  sectionTitle: {
    ...UI.font.caption,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 1,
    paddingLeft: 12,
    marginBottom: 8,
  },
  sectionCard: {
    padding: 0,
    marginBottom: 0,
    borderRadius: UI.radius.xl,
    overflow: 'hidden',
    ...UI.shadows.lg,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowLast: { borderBottomWidth: 0 },
  rowNoArrow: { justifyContent: 'flex-start', gap: 0 },
  rowLabel: { ...UI.font.body, color: Colors.text, flex: 1 },
  rowIconWrap: {
    width: 34, height: 34, borderRadius: UI.radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    marginRight: 12,
  },
  rowLabelText: { ...UI.font.body, color: Colors.text, flex: 1 },
  rowHintText: { ...UI.font.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  rowLabelDestructive: { color: Colors.negative },

  // Action Buttons
  lockBtn: {
    marginBottom: 12,
  },
  resetBtn: {
    marginBottom: 32,
  },

  // Overlay
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayContent: {
    backgroundColor: Colors.white,
    padding: 32,
    borderRadius: UI.radius.xl,
    alignItems: 'center',
    minWidth: 200,
    gap: 16,
    ...UI.shadows.lg,
  },
  overlayText: { ...UI.font.body, color: Colors.text, fontWeight: '500' as const, textAlign: 'center' },

  // Modals
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: UI.radius.xl,
    borderTopRightRadius: UI.radius.xl,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { ...UI.font.headline, color: Colors.text },
  modalHint: { ...UI.font.body, color: Colors.textSecondary, lineHeight: 20 },
  modalInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: UI.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    ...UI.font.body,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalCancelBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  modalCancelText: { ...UI.font.body, fontWeight: '600' as const, color: Colors.textSecondary },
  modalConfirmBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...UI.shadows.sm,
  },
  modalConfirmText: { ...UI.font.body, fontWeight: '600' as const, color: Colors.white },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  modalOptionsContainer: {
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: UI.radius.lg,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  optionRowActive: {
    backgroundColor: Colors.inputBg,
    borderColor: 'transparent',
  },
  optionRowText: {
    ...UI.font.body,
    color: Colors.textSecondary,
  },
  optionRowTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
});
