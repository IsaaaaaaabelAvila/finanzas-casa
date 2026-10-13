import { useState } from 'react';
import { accountBalance, minSpend, money } from '../calc';
import { remove, save } from '../store';
import { Account, AccountType } from '../types';
import { Card, Data, Empty, Field, num, ownerLabel } from '../ui';

const TYPE_LABEL: Record<AccountType, string> = { debit: 'Debito', credit: 'Credito', cash: 'Efectivo' };

export default function Accounts({ d }: { d: Data }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', type: 'debit' as AccountType, initial: '', cutDay: '', payDay: '', limit: '', minSpend: '', shared: false });
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }));

  function startEdit(id: string) {
    const a = d.allAccounts.find(x => x.id === id)!;
    setF({ name: a.data.name, type: a.data.type, initial: String(a.data.initial), cutDay: a.data.cutDay ? String(a.data.cutDay) : '', payDay: a.data.payDay ? String(a.data.payDay) : '', limit: a.data.limit ? String(a.data.limit) : '', minSpend: a.data.minSpend ? String(a.data.minSpend) : '', shared: a.owner === null });
    setEditId(id); setOpen(true);
  }
  function reset() { setF({ name: '', type: 'debit', initial: '', cutDay: '', payDay: '', limit: '', minSpend: '', shared: false }); setEditId(null); setOpen(false); }

  function submit() {
    if (!f.name.trim()) return;
    const a: Account = { name: f.name.trim(), type: f.type, initial: num(f.initial) };
    if (f.type === 'credit') {
      a.cutDay = Math.min(31, Math.max(1, Math.round(num(f.cutDay)))) || undefined;
      a.payDay = Math.round(num(f.payDay)) || undefined;
      a.limit = num(f.limit) || undefined;
      a.minSpend = num(f.minSpend) || undefined;
    }
    save('account', a, f.shared ? null : d.me, editId ?? undefined);
    reset();
  }

  return (
    <>
      <div className="month-nav"><b>Cuentas y tarjetas</b><button className="primary" onClick={() => (open ? reset() : setOpen(true))}>{open ? 'Cerrar' : '+ Nueva'}</button></div>

      {open && (
        <Card title={editId ? 'Editar cuenta' : 'Nueva cuenta'}>
          <Field label="Nombre"><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="BBVA debito, Nu credito…" /></Field>
          <Field label="Tipo">
            <select value={f.type} onChange={e => set('type', e.target.value)}>
              <option value="debit">Debito</option><option value="credit">Credito</option><option value="cash">Efectivo</option>
            </select>
          </Field>
          <Field label={f.type === 'credit' ? 'Deuda actual (saldo inicial)' : 'Saldo inicial'}><input inputMode="decimal" value={f.initial} onChange={e => set('initial', e.target.value)} /></Field>
          {f.type === 'credit' && (
            <>
              <Field label="Dia de corte (1-31)"><input inputMode="numeric" value={f.cutDay} onChange={e => set('cutDay', e.target.value)} /></Field>
              <Field label="Dia limite de pago"><input inputMode="numeric" value={f.payDay} onChange={e => set('payDay', e.target.value)} /></Field>
              <Field label="Limite de credito"><input inputMode="decimal" value={f.limit} onChange={e => set('limit', e.target.value)} /></Field>
              <Field label="Gasto minimo por periodo (para evitar cobro por falta de uso; vacio si no aplica)"><input inputMode="decimal" value={f.minSpend} onChange={e => set('minSpend', e.target.value)} /></Field>
            </>
          )}
          {!editId && <label className="check"><input type="checkbox" checked={f.shared} onChange={e => set('shared', e.target.checked)} /> Cuenta compartida de la casa</label>}
          <button className="primary" onClick={submit}>Guardar</button>
        </Card>
      )}

      {d.accounts.length === 0 && <Card><Empty>Aun no hay cuentas en esta vista.</Empty></Card>}
      {d.accounts.map(a => {
        const bal = accountBalance(a, d.allTxns, d.allPlans);
        const ms = minSpend(a, d.allTxns, d.allPlans);
        return (
          <Card key={a.id}>
            <div className="row">
              <div><b>{a.data.name}</b><small> {TYPE_LABEL[a.data.type]} · {ownerLabel(a.owner)}</small></div>
              <b className={bal < 0 ? 'neg' : ''}>{money(bal)}</b>
            </div>
            {a.data.type === 'credit' && (
              <small>
                Corte dia {a.data.cutDay ?? '—'} · pago dia {a.data.payDay ?? '—'}
                {a.data.limit ? ` · disponible ${money(a.data.limit + bal)}` : ''}
                {ms ? ` · minimo ${money(ms.spent)}/${money(ms.min)}` : ''}
              </small>
            )}
            <div className="row-actions">
              <button className="link" onClick={() => startEdit(a.id)}>Editar</button>
              <button className="link danger" onClick={() => confirm('¿Borrar cuenta? Sus movimientos quedaran sin cuenta.') && remove(a.id)}>Borrar</button>
            </div>
          </Card>
        );
      })}
    </>
  );
}
