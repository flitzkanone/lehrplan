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
  Download,
  Trash2,
  Fingerprint,
  Info,
  Lock,
  CheckCircle,
  Clock,
  User,
} from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import Colors from '@/constants/colors';
import { UI } from '@/constants/ui';
import { useApp } from '@/context/AppContext';
import { useAutoLock } from '@/hooks/useAutoLock';
import { BackupSchedule, useBackupManager } from '@/hooks/useBackupManager';
import AppButton from '@/components/ui/AppButton';
import ExportModal from '@/components/modals/ExportModal';

const BIOMETRIC_ENABLED_KEY = 'teacher_app_biometric_enabled';
const BIOMETRIC_PIN_KEY = 'teacher_app_biometric_pin';
const APP_VERSION = '1.0.0';

type ActiveModal = null | 'reset_confirm' | 'reset_final' | 'export' | 'auto_lock' | 'backup_schedule' | 'backup_restore';

// ─── Trade Republic Style Row ─────────────────────────────────────────────────
function SettingRow({
  label,
  subtitle,
  icon,
  right,
  onPress,
  destructive,
  isLast,
}: {
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  isLast?: boolean;
}) {
  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={onPress}
        disabled={!onPress}
        activeOpacity={0.55}
      >
        <View style={[styles.rowIcon, destructive && styles.rowIconDestructive]}>
          {icon}
        </View>
        <View style={styles.rowBody}>
          <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
            {label}
          </Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {right !== undefined ? right : (
          onPress ? <ChevronRight size={17} color={Colors.textLight} strokeWidth={1.8} /> : null
        )}
      </TouchableOpacity>
      {!isLast && <View style={styles.rowDivider} />}
    </>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data, lock, resetApp, getCurrentPin } = useApp();
  const { options: autoLockOptions, currentOptionLabel, setAutoLockTimeout } = useAutoLock();
  const { schedule, lastBackupAt, latestBackup, setBackupSchedule, runManualBackup, restoreBackup } = useBackupManager();

  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [isExportModalVisible, setIsExportModalVisible] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [restorePassword, setRestorePassword] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => false);

  React.useEffect(() => {
    SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY).then(val => {
      setBiometricEnabled(val === 'true');
    });
  }, []);

  const showBusy = (text: string) => { setIsBusy(true); setBusyText(text); };
  const hideBusy = () => { setIsBusy(false); setBusyText(''); };

  const handleToggleBiometric = useCallback(async (value: boolean) => {
    if (value) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Biometrie nicht verfügbar', 'Kein Face ID oder Fingerabdruck auf diesem Gerät eingerichtet.');
        return;
      }
      const currentPin = getCurrentPin();
      if (currentPin) await SecureStore.setItemAsync(BIOMETRIC_PIN_KEY, currentPin);
    } else {
      await SecureStore.deleteItemAsync(BIOMETRIC_PIN_KEY);
    }
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, value ? 'true' : 'false');
    setBiometricEnabled(value);
  }, [getCurrentPin]);

  const handleResetFinal = useCallback(async () => {
    setActiveModal(null);
    showBusy('Lösche alle Daten…');
    try {
      await resetApp();
      await SecureStore.deleteItemAsync(BIOMETRIC_PIN_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
    } catch (e) {
      Alert.alert('Reset-Fehler', String(e));
    } finally { hideBusy(); }
  }, [resetApp]);

  const handleCreateBackup = useCallback(async () => {
    setActiveModal(null);
    showBusy('Erstelle verschlüsseltes Backup…');
    try {
      const result = await runManualBackup();
      Alert.alert('Backup erstellt', `Datei gespeichert:\n${result.path.split('/').pop()}`);
    } catch (e) {
      Alert.alert('Backup-Fehler', String(e));
    } finally { hideBusy(); }
  }, [runManualBackup]);

  const handleRestoreBackup = useCallback(async () => {
    if (!latestBackup) { Alert.alert('Keine Backups', 'Es wurde keine Backup-Datei gefunden.'); return; }
    setActiveModal(null);
    showBusy('Wiederherstellung läuft…');
    try {
      await restoreBackup(latestBackup, restorePassword || undefined);
      setRestorePassword('');
      Alert.alert('Wiederherstellung erfolgreich', 'Die Daten wurden importiert.');
    } catch (e) {
      Alert.alert('Restore-Fehler', String(e));
    } finally { hideBusy(); }
  }, [latestBackup, restoreBackup, restorePassword]);

  const scheduleLabel: Record<BackupSchedule, string> = { daily: 'Täglich', weekly: 'Wöchentlich', monthly: 'Monatlich' };

  const iconStyle = { size: 18, color: Colors.white, strokeWidth: 1.8 };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.screenTitle}>Einstellungen</Text>

        {/* Profile Row */}
        <View style={styles.profileRow}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>
              {data.profile.name?.charAt(0)?.toUpperCase() || '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{data.profile.name || 'Kein Name'}</Text>
            <Text style={styles.profileSchool}>{data.profile.school || 'Keine Schule'}</Text>
          </View>
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <SettingRow
            label={`Auto-Lock`}
            subtitle={currentOptionLabel}
            icon={<Shield {...iconStyle} />}
            onPress={() => setActiveModal('auto_lock')}
          />
          <SettingRow
            label={Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'Fingerabdruck'}
            icon={<Fingerprint {...iconStyle} />}
            right={
              <Switch
                value={biometricEnabled}
                onValueChange={handleToggleBiometric}
                trackColor={{ false: Colors.divider, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            }
          />
          <SettingRow
            label="Verschlüsselung"
            subtitle="AES-256 · PBKDF2 · Lokal"
            icon={<CheckCircle {...iconStyle} />}
            isLast
          />
        </View>

        {/* Backup Section */}
        <View style={styles.section}>
          <SettingRow
            label="Backup erstellen"
            icon={<Download {...iconStyle} />}
            onPress={handleCreateBackup}
          />
          <SettingRow
            label="Backup-Zyklus"
            subtitle={scheduleLabel[schedule]}
            icon={<Clock {...iconStyle} />}
            onPress={() => setActiveModal('backup_schedule')}
          />
          <SettingRow
            label="Backup wiederherstellen"
            subtitle={lastBackupAt ? `Zuletzt: ${new Date(lastBackupAt).toLocaleDateString()}` : 'Noch kein Backup'}
            icon={<Lock {...iconStyle} />}
            onPress={() => setActiveModal('backup_restore')}
          />
          <SettingRow
            label="Daten exportieren"
            subtitle="PDF, Excel, JSON"
            icon={<Download {...iconStyle} />}
            onPress={() => setIsExportModalVisible(true)}
            isLast
          />
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <SettingRow
            label="App-Version"
            subtitle={APP_VERSION}
            icon={<Info {...iconStyle} />}
          />
          <SettingRow
            label="Datenspeicherung"
            subtitle="Lokal · Offline-First · DSGVO"
            icon={<Shield {...iconStyle} />}
            isLast
          />
        </View>

        {/* Danger Section */}
        <View style={styles.section}>
          <SettingRow
            label="App sperren"
            icon={<LogOut size={18} color={Colors.white} strokeWidth={1.8} />}
            onPress={lock}
          />
          <SettingRow
            label="App zurücksetzen"
            icon={<Trash2 size={18} color={Colors.white} strokeWidth={1.8} />}
            onPress={() => setActiveModal('reset_confirm')}
            destructive
            isLast
          />
        </View>

        <Text style={styles.versionFooter}>LehrPlan v{APP_VERSION} · Alle Daten lokal verschlüsselt</Text>
      </ScrollView>

      {/* ── Loading Overlay ── */}
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
            <Text style={styles.modalTitle}>Auto-Lock</Text>
            <Text style={styles.modalHint}>Nach welcher Zeit soll die App gesperrt werden?</Text>
            <View style={styles.modalOptionsContainer}>
              {autoLockOptions.map((option) => (
                <TouchableOpacity
                  key={option.valueMs}
                  style={[styles.optionRow, option.label === currentOptionLabel && styles.optionRowActive]}
                  onPress={async () => { await setAutoLockTimeout(option.valueMs); setActiveModal(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionRowText, option.label === currentOptionLabel && styles.optionRowTextActive]}>
                    {option.label}
                  </Text>
                  {option.label === currentOptionLabel && <CheckCircle size={20} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
            <AppButton label="Schließen" variant="secondary" onPress={() => setActiveModal(null)} />
          </View>
        </BlurView>
      </Modal>

      {/* ── Backup schedule modal ── */}
      <Modal transparent visible={activeModal === 'backup_schedule'} animationType="slide">
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Backup-Zyklus</Text>
            <Text style={styles.modalHint}>Automatische Backups werden lokal erstellt.</Text>
            <View style={styles.modalOptionsContainer}>
              {(['daily', 'weekly', 'monthly'] as BackupSchedule[]).map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.optionRow, option === schedule && styles.optionRowActive]}
                  onPress={async () => { await setBackupSchedule(option); setActiveModal(null); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionRowText, option === schedule && styles.optionRowTextActive]}>
                    {scheduleLabel[option]}
                  </Text>
                  {option === schedule && <CheckCircle size={20} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
            <AppButton label="Schließen" variant="secondary" onPress={() => setActiveModal(null)} />
          </View>
        </BlurView>
      </Modal>

      {/* ── Backup restore modal ── */}
      <Modal transparent visible={activeModal === 'backup_restore'} animationType="slide">
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Backup wiederherstellen</Text>
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
              <AppButton label="Abbrechen" variant="secondary" onPress={() => setActiveModal(null)} style={{ flex: 1 }} />
              <AppButton
                label="Wiederherstellen"
                onPress={handleRestoreBackup}
                disabled={!latestBackup}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* ── Reset Step 1 ── */}
      <Modal transparent visible={activeModal === 'reset_confirm'} animationType="slide">
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>App zurücksetzen?</Text>
            <Text style={styles.modalHint}>
              Dies löscht ALLE lokalen Daten unwiderruflich: Klassen, Schüler, Bewertungen, PIN und Schlüssel.
            </Text>
            <View style={styles.modalActions}>
              <AppButton label="Abbrechen" variant="secondary" onPress={() => setActiveModal(null)} style={{ flex: 1 }} />
              <AppButton label="Weiter" variant="danger" onPress={() => setActiveModal('reset_final')} style={{ flex: 1 }} />
            </View>
          </View>
        </BlurView>
      </Modal>

      {/* ── Reset Step 2 ── */}
      <Modal transparent visible={activeModal === 'reset_final'} animationType="slide">
        <BlurView intensity={20} tint="light" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDimmer} activeOpacity={1} onPress={() => setActiveModal(null)} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Wirklich löschen?</Text>
            <Text style={styles.modalHint}>
              ⚠️ Letzter Schritt. Es gibt kein Zurück. AsyncStorage, SecureStore und KeyCache werden vollständig geleert.
            </Text>
            <View style={styles.modalActions}>
              <AppButton label="Abbrechen" variant="secondary" onPress={() => setActiveModal(null)} style={{ flex: 1 }} />
              <AppButton label="Alles löschen" variant="danger" onPress={handleResetFinal} style={{ flex: 1 }} />
            </View>
          </View>
        </BlurView>
      </Modal>

      <ExportModal visible={isExportModalVisible} onClose={() => setIsExportModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: UI.spacing.screenMargin, paddingBottom: 130 },

  screenTitle: {
    fontSize: 34,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.8,
    marginBottom: 28,
  },

  // Profile
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 36,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { fontSize: 22, fontWeight: '700' as const, color: Colors.white },
  profileInfo: { gap: 2 },
  profileName: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  profileSchool: { fontSize: 14, color: Colors.textSecondary },

  // Section = group of rows on white bg, no card
  section: {
    marginBottom: 32,
  },

  // Individual Row — Trade Republic style
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 16,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowIconDestructive: {
    backgroundColor: Colors.negative,
  },
  rowBody: { flex: 1 },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  rowLabelDestructive: { color: Colors.negative },
  rowSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginLeft: 54, // align with text, not icon
  },

  versionFooter: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center' as const,
    marginTop: 8,
    paddingBottom: 8,
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
    borderRadius: 24,
    alignItems: 'center',
    minWidth: 200,
    gap: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 28 },
      android: { elevation: 12 },
      default: {},
    }),
  },
  overlayText: { fontSize: 16, fontWeight: '500' as const, color: Colors.text, textAlign: 'center' as const },

  // Modals
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalDimmer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.28)' },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 28,
    paddingBottom: 48,
    gap: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, letterSpacing: -0.3 },
  modalHint: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  modalInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalOptionsContainer: { gap: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: Colors.inputBg,
  },
  optionRowActive: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  optionRowText: { fontSize: 16, color: Colors.textSecondary, fontWeight: '500' as const },
  optionRowTextActive: { color: Colors.text, fontWeight: '700' as const },
});
