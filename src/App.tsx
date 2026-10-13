import { useEffect, useMemo, useState } from 'react';
import { cloudEnabled, supabase } from './supabase';
import { resetAll, setState, useStore } from './store';
import { startAutoSync, syncNow } from './sync';
import { scheduleAll } from './notifications';
import Auth from './Auth';
import { Scope, selectData } from './ui';
import Dashboard from './screens/Dashboard';
import Movements from './screens/Movements';
import Accounts from './screens/Accounts';
import Plans from './screens/Plans';
import Goals from './screens/Goals';
import Settings from './screens/Settings';

export type Tab = 'home' | 'mov' | 'acc' | 'plans' | 'goals' | 'set';
const ICONS: Record<Tab, string> = {
  home: 'M4 11l8-7 8 7v9H4z',
  mov: 'M4 8h16M16 4l4 4-4 4M20 16H4M8 12l-4 4 4 4',
  acc: 'M3 6h18v12H3zM3 10h18',
  plans: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  goals: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z',
  set: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6'
};
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Resumen' },
  { id: 'mov', label: 'Movimientos' },
  { id: 'acc', label: 'Cuentas' },
  { id: 'plans', label: 'A meses' },
  { id: 'goals', label: 'Metas' },
  { id: 'set', label: 'Ajustes' }
];

export default function App() {
  const s = useStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(!cloudEnabled);
  const [tab, setTab] = useState<Tab>('home');
  const [scope, setScope] = useState<Scope>('all');

  // Sesion de Supabase
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setUserId(data.session?.user.id ?? null); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Si entra otra persona en este dispositivo, limpia los datos locales anteriores
  useEffect(() => {
    if (cloudEnabled && userId && s.me && s.me !== userId) resetAll();
  }, [userId, s.me]);

  const signedIn = cloudEnabled ? Boolean(userId && s.me === userId && s.household) : s.me === 'local';

  useEffect(() => { if (signedIn) startAutoSync(); }, [signedIn]);

  const data = useMemo(() => selectData(s, scope), [s.recs, s.me, scope]);

  // Reprograma recordatorios (semanales + gasto minimo) cuando cambian los datos
  useEffect(() => {
    if (!signedIn) return;
    const all = selectData(s, 'all');
    scheduleAll(all.accounts, all.txns, all.plans);
  }, [s.recs, signedIn]);

  if (!ready) return <div className="splash">Cargando…</div>;
  if (!signedIn) return <Auth userId={userId} />;

  const signOut = async () => { await supabase?.auth.signOut(); resetAll(); };

  return (
    <div className="shell">
      <header className="top">
        <h1>Finanzas Casa</h1>
        <div className="scope">
          {(['all', 'mine', 'shared'] as Scope[]).map(k => (
            <button key={k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>
              {k === 'all' ? 'Todo' : k === 'mine' ? 'Mio' : 'Casa'}
            </button>
          ))}
        </div>
        <button className="sync" onClick={syncNow} title={s.syncError ?? 'Sincronizar'}>
          {s.syncing ? '↻' : s.syncError ? '!' : cloudEnabled ? '●' : '○'}
        </button>
      </header>
      <main>
        {tab === 'home' && <Dashboard d={data} go={setTab} />}
        {tab === 'mov' && <Movements d={data} />}
        {tab === 'acc' && <Accounts d={data} />}
        {tab === 'plans' && <Plans d={data} />}
        {tab === 'goals' && <Goals d={data} />}
        {tab === 'set' && <Settings d={data} onSignOut={signOut} onLocalSetup={() => setState({ me: 'local' })} />}
      </main>
      <nav className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <svg viewBox="0 0 24 24"><path d={ICONS[t.id]} /></svg><small>{t.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
