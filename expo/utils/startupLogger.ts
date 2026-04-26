type ModuleStatus = 'pending' | 'starting' | 'ready' | 'failed';

interface ModuleState {
  name: string;
  status: ModuleStatus;
  startedAt?: number;
  readyAt?: number;
}

const MODULES = [
  'QueryClient',
  'GestureHandler',
  'AppProvider',
  'TutorialProvider',
  'NotificationSystem',
  'Navigator',
] as const;

type ModuleName = (typeof MODULES)[number];

const TOTAL = MODULES.length;

const state: Record<string, ModuleState> = {};

for (const name of MODULES) {
  state[name] = { name, status: 'pending' };
}

let appStartTime = Date.now();
let hasBooted = false;

function readyCount(): number {
  return Object.values(state).filter((m) => m.status === 'ready').length;
}

function bar(done: number, total: number): string {
  const filled = Math.round((done / total) * 10);
  return '[' + '█'.repeat(filled) + '░'.repeat(10 - filled) + ']';
}

export function logAppBoot(): void {
  if (hasBooted) return;
  hasBooted = true;
  appStartTime = Date.now();
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║        APP STARTUP SEQUENCE          ║');
  console.log(`║        ${new Date().toISOString()}  ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log(`[STARTUP] Initializing ${TOTAL} modules...`);
  console.log('');
}

export function logModuleStarting(module: ModuleName): void {
  state[module] = { name: module, status: 'starting', startedAt: Date.now() };
  const done = readyCount();
  console.log(
    `[STARTUP] ○ ${module.padEnd(20)} | Starting...      | ${bar(done, TOTAL)} ${done}/${TOTAL} ready`
  );
}

export function logModuleReady(module: ModuleName): void {
  const prev = state[module];
  const now = Date.now();
  const elapsed = prev?.startedAt ? `${now - prev.startedAt}ms` : '?ms';
  state[module] = { name: module, status: 'ready', startedAt: prev?.startedAt, readyAt: now };
  const done = readyCount();
  console.log(
    `[STARTUP] ✓ ${module.padEnd(20)} | Ready (${elapsed.padStart(6)}) | ${bar(done, TOTAL)} ${done}/${TOTAL} ready`
  );
  if (done === TOTAL) {
    const total = Date.now() - appStartTime;
    console.log('');
    console.log('╔══════════════════════════════════════╗');
    console.log(`║  ✅ ALL ${TOTAL} MODULES READY               ║`);
    console.log(`║  Total boot time: ${String(total + 'ms').padEnd(18)} ║`);
    console.log('╚══════════════════════════════════════╝');
    console.log('');
  }
}

export function logModuleFailed(module: ModuleName, reason: string): void {
  state[module] = { name: module, status: 'failed' };
  const done = readyCount();
  console.log(
    `[STARTUP] ✗ ${module.padEnd(20)} | FAILED: ${reason} | ${bar(done, TOTAL)} ${done}/${TOTAL} ready`
  );
}

export function logStartupSummary(): void {
  console.log('');
  console.log('[STARTUP] ─── Module Status Summary ───────────────');
  for (const name of MODULES) {
    const m = state[name];
    const icon = m.status === 'ready' ? '✓' : m.status === 'failed' ? '✗' : '○';
    const elapsed =
      m.readyAt && m.startedAt ? `${m.readyAt - m.startedAt}ms` : m.status === 'pending' ? 'pending' : '…';
    console.log(`[STARTUP]   ${icon} ${name.padEnd(22)} ${m.status.padEnd(10)} ${elapsed}`);
  }
  console.log('[STARTUP] ───────────────────────────────────────────');
  console.log('');
}
