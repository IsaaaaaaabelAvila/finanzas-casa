import { useState } from 'react';
import { cloudEnabled, supabase } from './supabase';
import { setState } from './store';
import { syncNow } from './sync';
import { Card, Field } from './ui';

/** Pantalla de entrada: login/registro y creacion o union a la casa. */
export default function Auth({ userId }: { userId: string | null }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [houseName, setHouseName] = useState('Nuestra casa');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true); setMsg('');
    try { await fn(); } catch (e: any) { setMsg(e?.message ?? 'Error'); }
    setBusy(false);
  }

  const auth = () => run(async () => {
    const r = mode === 'in'
      ? await supabase!.auth.signInWithPassword({ email, password: pass })
      : await supabase!.auth.signUp({ email, password: pass });
    if (r.error) throw r.error;
    if (mode === 'up' && !r.data.session) setMsg('Revisa tu correo para confirmar la cuenta y luego inicia sesion.');
  });

  const setupHouse = (join: boolean) => run(async () => {
    if (!name.trim()) throw new Error('Escribe tu nombre');
    const { data, error } = join
      ? await supabase!.rpc('join_household', { code, my_name: name.trim() })
      : await supabase!.rpc('create_household', { h_name: houseName, my_name: name.trim() });
    if (error) throw error;
    setState({ me: userId, household: data.household_id, inviteCode: data.invite_code, displayName: name.trim(), lastPull: null });
    syncNow();
  });

  if (!cloudEnabled) {
    return (
      <div className="auth">
        <Card title="Finanzas Casa">
          <p>La nube no esta configurada, asi que la app funciona <b>solo en este dispositivo</b>. Para sincronizar con tu pareja sigue el README (Supabase).</p>
          <button className="primary" onClick={() => setState({ me: 'local', displayName: 'Yo' })}>Usar sin nube</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth">
      <Card title={userId ? 'Configura tu casa' : mode === 'in' ? 'Iniciar sesion' : 'Crear cuenta'}>
        {!userId ? (
          <>
            <Field label="Correo"><input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></Field>
            <Field label="Contrasena"><input type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></Field>
            <button className="primary" disabled={busy || !email || pass.length < 6} onClick={auth}>{mode === 'in' ? 'Entrar' : 'Registrarme'}</button>
            <button className="link" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'No tengo cuenta' : 'Ya tengo cuenta'}</button>
          </>
        ) : (
          <>
            <Field label="Tu nombre"><input value={name} onChange={e => setName(e.target.value)} /></Field>
            <h4>Opcion A: primera persona (crea la casa)</h4>
            <Field label="Nombre de la casa"><input value={houseName} onChange={e => setHouseName(e.target.value)} /></Field>
            <button className="primary" disabled={busy} onClick={() => setupHouse(false)}>Crear casa</button>
            <h4>Opcion B: tu pareja ya creo la casa</h4>
            <Field label="Codigo de invitacion"><input value={code} onChange={e => setCode(e.target.value)} /></Field>
            <button disabled={busy || !code} onClick={() => setupHouse(true)}>Unirme con codigo</button>
          </>
        )}
        {msg && <p className="error">{msg}</p>}
      </Card>
    </div>
  );
}
