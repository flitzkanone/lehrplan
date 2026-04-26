import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoCrypto from 'expo-crypto';

const AUDIT_LOG_KEY = 'teacher_app_audit_log_v1';
const MAX_AUDIT_ENTRIES = 500;

export type AuditEventType =
  | 'auth_success'
  | 'auth_failed'
  | 'auth_locked'
  | 'pin_changed'
  | 'data_export'
  | 'data_deleted'
  | 'backup_created'
  | 'backup_restored'
  | 'backup_deleted'
  | 'p2p_sync'
  | 'p2p_paired'
  | 'app_start'
  | 'onboarding_complete'
  | 'app_reset';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  event: AuditEventType;
  details: string;
}

function generateId(): string {
  const bytes = ExpoCrypto.getRandomBytes(6);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function logAuditEvent(event: AuditEventType, details: string = ''): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(AUDIT_LOG_KEY);
    const entries: AuditLogEntry[] = stored ? JSON.parse(stored) : [];

    const newEntry: AuditLogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      event,
      details,
    };

    entries.unshift(newEntry);
    const trimmed = entries.slice(0, MAX_AUDIT_ENTRIES);
    await AsyncStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(trimmed));
    console.log(`[AuditLog] ${event}: ${details}`);
  } catch (error) {
    console.log('[AuditLog] Failed to log event:', error);
  }
}

export async function getAuditLog(): Promise<AuditLogEntry[]> {
  try {
    const stored = await AsyncStorage.getItem(AUDIT_LOG_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function clearAuditLogStorage(): Promise<void> {
  try {
    await AsyncStorage.removeItem(AUDIT_LOG_KEY);
  } catch {
    // silent
  }
}

export function formatAuditEvent(event: AuditEventType): string {
  const labels: Record<AuditEventType, string> = {
    auth_success: '✓ Anmeldung erfolgreich',
    auth_failed: '✗ Anmeldung fehlgeschlagen',
    auth_locked: '🔒 App gesperrt',
    pin_changed: '🔑 PIN geändert',
    data_export: '↑ Daten exportiert',
    data_deleted: '✗ Daten gelöscht',
    backup_created: '↓ Backup erstellt',
    backup_restored: '↑ Backup wiederhergestellt',
    backup_deleted: '✗ Backup gelöscht',
    p2p_sync: '⇄ Synchronisation',
    p2p_paired: '⇄ Gerät gekoppelt',
    app_start: '▷ App gestartet',
    onboarding_complete: '✓ Einrichtung abgeschlossen',
    app_reset: '✗ App zurückgesetzt',
  };
  return labels[event] || event;
}

export function formatAuditTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}
