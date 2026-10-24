import { useState } from 'react';
import { cloudEnabled } from '../supabase';
import { getState, save, setState, useStore } from '../store';
import { syncNow } from '../sync';
import { getNotifSettings, isNative, requestPermission, saveNotifSettings } from '../notifications';
import { cfgAt, ym } from '../calc';
import { Card, Data, num } from '../ui';

export default function Settings({ d, onSignOut, onLocalSetup }: { d: Data; onSignOut: () => void; onLocalSetup: () => void }) {
  const s = useStore();
  const [cfg, setCfg] = useState(getNotifSettings());
  const [msg, setMsg] = useState('');
  void onLocalSetup;
  const cur = ym(new Date());
  const eff = cfgAt(d.setting?.data ?? null, cur) ?? cfgAt(d.setting?.data ?? null, d.setting?.data.startMonth ?? '2026-11');
  const [mode, setMode] = useState<'budget' | 'saving'>(eff?.mode ?? 'budget');
  const [amount, setAmount] = useState(eff ? String(eff.amount) : (d.setting?.data.monthlyBudget ? String(d.setting.data.monthlyBudget) : ''));
  const startMonth = d.setting?.data.startMonth ?? '2026-11';
  const prevStart = (() => { const [y, mo] = (d.setting?.data.startMonth ?? '2026-11').split('-').map(Number); return ym(new Date(y, mo - 2, 1)); })();
  const [prevIncome, setPrevIncome] = useState(d.setting?.data.incomeOverrides?.[prevStart] !== undefined ? String(d.setting!.data.incomeOverrides![prevStart]) : '');
  const [from, setFrom] = useState(cur < startMonth ? startMonth : cur);

  function saveCfg() {
    const base = d.setting?.data ?? {};
    const f = from < startMonth ? startMonth : from;
    const entry = { from: f, mode, amount: num(amount) };
    const plan = [...(base.plan ?? []).filter(c => c.from !== f), entry].sort((a, b) => a.from.localeCompare(b.from));
    const incomeOverrides = { ...(base.incomeOverrides ?? {}), ...(mode === 'saving' && prevIncome !== '' ? { [prevStart]: num(prevIncome) } : {}) };
    save('setting', { ...base, startMonth, plan, incomeOverrides }, d.me, d.setting?.id);
    setMsg(`Guardado: aplica desde ${f}. Los meses anteriores y su arrastre no cambian.`);
  }

  const update = (p: Partial<typeof cfg>) => { const n = { ...cfg, ...p }; setCfg(n); saveNotifSettings(n); setState({}, false); };

  async function perm() {
    const ok = await requestPermission();
    setMsg(ok ? 'Notificaciones activadas' : 'Permiso denegado. Actívalo en los ajustes del sistema.');
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(getState().recs, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `finanzas-respaldo-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  }
  function importJson(file: File) {
    file.text().then(t => {
      const incoming = JSON.parse(t) as Record<string, any>;
      const recs = { ...getState().recs };
      for (const [id, r] of Object.entries(incoming)) recs[id] = { ...r, dirty: true };
      setState({ recs }, true);
      setMsg('Respaldo importado');
    }).catch(() => setMsg('Archivo invalido'));
  }

  const hh = String(cfg.hour).padStart(2, '0') + ':' + String(cfg.minute).padStart(2, '0');

  return (
    <>
      <Card title="Sincronizacion">
        <p>{cloudEnabled ? (s.syncError ? <span className="error">Error: {s.syncError}</span> : s.lastSync ? `Ultima sincronizacion: ${new Date(s.lastSync).toLocaleString('es-MX')}` : 'Aun no sincroniza') : 'Modo local (sin nube).'}</p>
        {cloudEnabled && <button className="primary" onClick={syncNow} disabled={s.syncing}>{s.syncing ? 'Sincronizando…' : 'Sincronizar ahora'}</button>}
        {s.inviteCode && <p>Codigo para invitar a tu pareja: <b className="code">{s.inviteCode}</b></p>}
        <p className="hint">Se sincroniza solo al abrir la app, al volver a tener internet, despues de cada cambio y cada minuto. Sin internet todo se guarda en el dispositivo y se sube despues.</p>
      </Card>

      <Card title="Presupuesto y ahorro">
        <p className="hint">Elige como repartes tu ingreso: una parte es fija y la otra es el resto. El "libre para gastar" arrastra lo que sobra o falta de cada mes que cierra, a partir de {startMonth}.</p>
        <div className="seg">
          <button className={mode === 'budget' ? 'on' : ''} onClick={() => setMode('budget')}>Presupuesto fijo (el resto lo ahorro)</button>
          <button className={mode === 'saving' ? 'on' : ''} onClick={() => setMode('saving')}>Ahorro fijo (el resto es mi presupuesto)</button>
        </div>
        <label className="field"><span>{mode === 'budget' ? 'Presupuesto al mes' : 'Ahorro fijo al mes'}</span>
          <input inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="20000" />
        </label>
        {mode === 'saving' && (
          <>
            <p className="hint">Con ahorro fijo, tu mes se gasta de lo que ya recibiste el mes anterior, no de lo que esperas recibir.</p>
            <label className="field"><span>Ingresos recibidos en {prevStart} (de ahi sale el primer mes, si no estan registrados)</span>
              <input inputMode="decimal" value={prevIncome} onChange={e => setPrevIncome(e.target.value)} placeholder="28000" />
            </label>
          </>
        )}
        <label className="field"><span>Aplicar desde el mes</span>
          <input type="month" min={startMonth} value={from} onChange={e => setFrom(e.target.value)} />
        </label>
        <button onClick={saveCfg} disabled={!num(amount)}>Guardar</button>
        {(d.setting?.data.plan?.length ?? 0) > 0 && (
          <p className="hint">Historial: {(d.setting?.data.plan ?? []).map(c => `${c.from}: ${c.mode === 'budget' ? 'presupuesto' : 'ahorro fijo'} ${c.amount}`).join(' · ')}</p>
        )}
        <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={Boolean(d.setting?.data.shareStatus)} onChange={e => save('setting', { ...(d.setting?.data ?? {}), shareStatus: e.target.checked }, d.me, d.setting?.id)} />
          Compartir mi semaforo con mi pareja (solo ve verde, ambar o rojo, sin numeros)</label>
      </Card>

      <Card title="Recordatorios">
        {!isNative() && <p className="hint">Las notificaciones programadas funcionan en la app de Android (APK). En el navegador solo veras el aviso dentro de la app.</p>}
        <label className="check"><input type="checkbox" checked={cfg.enabled} onChange={e => update({ enabled: e.target.checked })} /> Recordarme registrar movimientos (viernes, sabado, domingo y lunes)</label>
        <label className="field"><span>Hora del recordatorio</span>
          <input type="time" value={hh} onChange={e => { const [h, m] = e.target.value.split(':').map(Number); update({ hour: h || 0, minute: m || 0 }); }} />
        </label>
        <button onClick={perm}>Permitir notificaciones</button>
        <p className="hint">Tambien te aviso 5, 3 y 1 dia antes del corte si aun te falta gasto minimo en alguna tarjeta.</p>
        {msg && <p>{msg}</p>}
      </Card>

      <Card title="Respaldo">
        <button onClick={exportJson}>Exportar respaldo (.json)</button>
        <label className="file">Importar respaldo<input type="file" accept="application/json" onChange={e => e.target.files?.[0] && importJson(e.target.files[0])} /></label>
      </Card>

      <Card title="Cuenta">
        <p>{s.displayName || 'Usuario'}</p>
        {cloudEnabled && <button className="danger" onClick={onSignOut}>Cerrar sesion</button>}
      </Card>
    </>
  );
}
