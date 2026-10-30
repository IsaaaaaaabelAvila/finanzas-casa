import { useState } from 'react';
import { cloudEnabled } from '../supabase';
import { getState, save, setState, useStore } from '../store';
import { syncNow } from '../sync';
import { getNotifSettings, isNative, requestPermission, saveNotifSettings } from '../notifications';
import { splitAt, ym } from '../calc';
import { Card, Data, num } from '../ui';

export default function Settings({ d, onSignOut, onLocalSetup }: { d: Data; onSignOut: () => void; onLocalSetup: () => void }) {
  const s = useStore();
  const [cfg, setCfg] = useState(getNotifSettings());
  const [msg, setMsg] = useState('');
  void onLocalSetup;
  const cur = ym(new Date());
  const splitNow = splitAt(d.setting?.data ?? null, cur);
  const [sAhorro, setSAhorro] = useState(String(splitNow.ahorro));
  const [sPres, setSPres] = useState(String(splitNow.presupuesto));
  const [sRes, setSRes] = useState(String(splitNow.reserva));
  const [sFrom, setSFrom] = useState(cur);

  function saveSplit() {
    const a = num(sAhorro), p = num(sPres), r = num(sRes);
    if (Math.abs(a + p + r - 100) > 0.01) { setMsg('El reparto debe sumar 100%'); return; }
    const base = d.setting?.data ?? {};
    const f = sFrom < cur ? cur : sFrom;
    const split = [...(base.split ?? []).filter(c => c.from !== f), { from: f, ahorro: a, presupuesto: p, reserva: r }].sort((x, y) => x.from.localeCompare(y.from));
    save('setting', { ...base, split }, d.me, d.setting?.id);
    setMsg(`Reparto guardado: aplica a las nominas desde ${f}; las anteriores no cambian.`);
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

      <Card title="Semaforo">
        <label className="check"><input type="checkbox" checked={Boolean(d.setting?.data.shareStatus)} onChange={e => save('setting', { ...(d.setting?.data ?? {}), shareStatus: e.target.checked }, d.me, d.setting?.id)} />
          Compartir mi semaforo con mi pareja (solo ve verde, ambar o rojo, sin numeros)</label>
      </Card>

      <Card title="Reparto de la nomina">
        <p className="hint">Cada nomina que registres se reparte sola, sin mover dinero: una parte a la bolsa de ahorro, otra a presupuesto y otra a reserva de imprevistos (estas dos quedan en la bolsa de gasto).</p>
        <div className="row" style={{ gap: 8 }}>
          <label className="field" style={{ flex: 1 }}><span>Ahorro %</span><input inputMode="decimal" value={sAhorro} onChange={e => setSAhorro(e.target.value)} /></label>
          <label className="field" style={{ flex: 1 }}><span>Presupuesto %</span><input inputMode="decimal" value={sPres} onChange={e => setSPres(e.target.value)} /></label>
          <label className="field" style={{ flex: 1 }}><span>Reserva %</span><input inputMode="decimal" value={sRes} onChange={e => setSRes(e.target.value)} /></label>
        </div>
        <label className="field"><span>Aplicar desde el mes</span><input type="month" min={cur} value={sFrom} onChange={e => setSFrom(e.target.value)} /></label>
        <button onClick={saveSplit}>Guardar reparto</button>
        {(d.setting?.data.split?.length ?? 0) > 0 && (
          <p className="hint">Historial: {(d.setting?.data.split ?? []).map(c => `${c.from}: ${c.ahorro}/${c.presupuesto}/${c.reserva}`).join(' · ')}</p>
        )}
        {msg && <p className="hint">{msg}</p>}
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
