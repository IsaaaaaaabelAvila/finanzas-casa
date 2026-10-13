import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Account, Item, Plan, Txn } from './types';
import { minSpend, money, parse, iso } from './calc';

const SETTINGS_KEY = 'finanzas_notif';
export interface NotifSettings { hour: number; minute: number; enabled: boolean }
export function getNotifSettings(): NotifSettings {
  try { const s = localStorage.getItem(SETTINGS_KEY); if (s) return JSON.parse(s); } catch { /* */ }
  return { hour: 20, minute: 0, enabled: true };
}
export function saveNotifSettings(s: NotifSettings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* */ } }

export const isNative = () => Capacitor.isNativePlatform();

export async function requestPermission(): Promise<boolean> {
  if (isNative()) {
    const r = await LocalNotifications.requestPermissions();
    return r.display === 'granted';
  }
  if ('Notification' in window) return (await Notification.requestPermission()) === 'granted';
  return false;
}

/** Programa: recordatorio semanal (vie, sab, dom, lun) + avisos de gasto minimo de tarjetas. Solo en la app Android. */
export async function scheduleAll(accounts: Item<Account>[], txns: Item<Txn>[], plans: Item<Plan>[]) {
  if (!isNative()) return;
  const cfg = getNotifSettings();
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
    if (!cfg.enabled) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;

    // weekday de Capacitor: 1 = domingo ... 7 = sabado
    const days = [{ id: 101, weekday: 6, t: 'viernes' }, { id: 102, weekday: 7, t: 'sabado' }, { id: 103, weekday: 1, t: 'domingo' }, { id: 104, weekday: 2, t: 'lunes' }];
    const notifications: any[] = days.map(d => ({
      id: d.id,
      title: 'Registra tus movimientos',
      body: `Es ${d.t}: anota tus ingresos y egresos para no perder el hilo.`,
      schedule: { on: { weekday: d.weekday, hour: cfg.hour, minute: cfg.minute }, allowWhileIdle: true }
    }));

    // Avisos de gasto minimo: 5, 3 y 1 dia antes del corte, solo si aun falta
    let n = 1000;
    for (const acc of accounts) {
      const ms = minSpend(acc, txns, plans);
      if (!ms || ms.remaining <= 0) continue;
      const end = parse(ms.end);
      for (const before of [5, 3, 1]) {
        const at = new Date(end.getFullYear(), end.getMonth(), end.getDate() - before, 10, 0, 0);
        if (at.getTime() <= Date.now()) continue;
        notifications.push({
          id: n++,
          title: `${acc.data.name}: gasto minimo`,
          body: `Te faltan ${money(ms.remaining)} para llegar al minimo antes del corte (${iso(end)}).`,
          schedule: { at, allowWhileIdle: true }
        });
      }
    }
    await LocalNotifications.schedule({ notifications });
  } catch (e) {
    console.warn('No se pudieron programar notificaciones', e);
  }
}
