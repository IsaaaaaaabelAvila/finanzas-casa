import { useEffect, useMemo, useState } from 'react';
import { cloudEnabled, supabase } from './supabase';
import { remove, resetAll, save, setState, useStore } from './store';
import { budgetCtx } from './budget';
import { budgetFor, budgetLevel, levelText, ym } from './calc';
import { startAutoSync, syncNow } from './sync';
import { scheduleAll } from './notifications';
import Auth from './Auth';
import { Scope, selectData } from './ui';
import Dashboard from './screens/Dashboard';
import Movements from './screens/Movements';
import Accounts from './screens/Accounts';
import Plans from './screens/Plans';
import Goals from './screens/Goals';
import House from './screens/House';
import Settings from './screens/Settings';

export type Tab = 'home' | 'mov' | 'acc' | 'house' | 'plans' | 'goals' | 'set';
const ICONS: Record<Tab, string> = {
  home: 'M4 11l8-7 8 7v9H4z',
  mov: 'M4 8h16M16 4l4 4-4 4M20 16H4M8 12l-4 4 4 4',
  acc: 'M3 6h18v12H3zM3 10h18',
  house: 'M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10',
  plans: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  goals: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z',
  set: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4v6M8 14v6'
};
const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Resumen' },
  { id: 'mov', label: 'Movs' },
  { id: 'acc', label: 'Cuentas' },
  { id: 'house', label: 'Casa' },
  { id: 'plans', label: 'Meses' },
  { id: 'goals', label: 'Metas' },
  { id: 'set', label: 'Ajustes' }
];

export default function App() {
  const s = useStore();
  const [userId, setUserId] = useState<string | null>(null);
  const [checkedFor, setCheckedFor] = useState<string | null>(null);
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

  // Vincula mi usuario con la persona de la casa que tenga mi nombre (primera palabra, sin acentos)
  useEffect(() => {
    if (!signedIn || !data.peopleId || data.myKey || !s.displayName) return;
    const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/)[0];
    const match = data.people.find(p => !p.userId && norm(p.name) === norm(s.displayName));
    if (match) save('people', { people: data.people.map(p => (p.key === match.key ? { ...p, userId: data.me } : p)) }, null, data.peopleId);
  }, [signedIn, data.peopleId, data.myKey, s.displayName]);

  // Mi nomina personal (ingresos con categoria "Nomina") se refleja sola en Casa; solo se comparte el total del mes
  useEffect(() => {
    if (!signedIn || !data.myKey) return;
    const all = selectData(s, 'all');
    const totals: Record<string, number> = {};
    for (const t of all.allTxns) if (t.owner === all.me && t.data.type === 'income' && t.data.category === 'Nomina') {
      const m = t.data.date.slice(0, 7);
      totals[m] = (totals[m] ?? 0) + t.data.amount;
    }
    const mine = all.payrolls.filter(p => p.data.person === data.myKey);
    for (const [month, amount] of Object.entries(totals)) {
      const total = Math.round(amount * 100) / 100;
      const cur = mine.find(p => p.data.month === month);
      if (!cur || !cur.data.auto || cur.data.amount !== total) save('payroll', { month, person: data.myKey, amount: total, auto: true }, null, cur?.id);
    }
    // si borre toda mi nomina de un mes que era automatica, vuelve a cero
    for (const cur of mine) if (cur.data.auto && !(cur.data.month in totals) && cur.data.amount !== 0) save('payroll', { ...cur.data, amount: 0 }, null, cur.id);
  }, [s.recs, signedIn, data.myKey]);

  // Si comparto mi semaforo, publica solo el color (sin numeros) para mi pareja; si lo apago, lo borra
  useEffect(() => {
    if (!signedIn || !data.myKey) return;
    const all = selectData(s, 'all');
    const existing = all.statuses.find(x => x.data.person === all.myKey);
    const st = all.setting?.data;
    if (!st?.shareStatus || !st.plan?.length) { if (existing) remove(existing.id); return; }
    const cur = ym(new Date());
    if (cur < (st.startMonth ?? '2026-11')) { if (existing) remove(existing.id); return; }
    const b = budgetFor(budgetCtx(all), cur);
    if (!b) return;
    const level = budgetLevel(b, new Date());
    if (existing && existing.data.level === level && existing.data.month === cur) return;
    save('status', { person: all.myKey!, level, month: cur, text: levelText(level) }, null, existing?.id);
  }, [s.recs, signedIn, data.myKey]);

  // Al iniciar sesion en un dispositivo sin datos locales, recupera mi casa desde la nube
  useEffect(() => { if (!userId) setCheckedFor(null); }, [userId]);
  const needsProfile =cloudEnabled && Boolean(userId) && !(s.me === userId && s.household);
  useEffect(() => {
    if (!supabase || !userId || !needsProfile) return;
    if (s.me && s.me !== userId) return; // el efecto de limpieza corre primero y vuelve a disparar este
    let cancelled = false;
    (async () => {
      try {
        const { data: prof } = await supabase.from('profiles').select('household_id, display_name').eq('user_id', userId).maybeSingle();
        if (prof?.household_id) {
          const { data: hh } = await supabase.from('households').select('invite_code').eq('id', prof.household_id).maybeSingle();
          if (!cancelled) setState({ me: userId, household: prof.household_id, inviteCode: hh?.invite_code ?? null, displayName: prof.display_name ?? '', lastPull: null });
          syncNow();
        }
      } finally {
        if (!cancelled) setCheckedFor(userId);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, needsProfile, s.me]);

  if (!ready || (needsProfile && checkedFor !== userId)) return <div className="splash">Cargando…</div>;
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
        {tab === 'home' && <Dashboard d={data} go={setTab} scope={scope} />}
        {tab === 'mov' && <Movements d={data} />}
        {tab === 'acc' && <Accounts d={data} />}
        {tab === 'house' && <House d={data} />}
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
