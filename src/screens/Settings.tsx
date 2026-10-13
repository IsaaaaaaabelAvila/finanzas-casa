import { useState } from 'react';
import { cloudEnabled } from '../supabase';
import { getState, setState, useStore } from '../store';
import { syncNow } from '../sync';
import { getNotifSettings, isNative, requestPermission, saveNotifSettings } from '../notifications';
import { Card, Data } from '../ui';

export default function Settings({ d, onSignOut, onLocalSetup }: { d: Data; onSignOut: () => void; onLocalSetup: () => void }) {
  const s = useStore();
  const [cfg, setCfg] = useState(getNotifSettings());
  const [msg, setMsg] = useState('');
  void d; void onLocalSetup;

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
