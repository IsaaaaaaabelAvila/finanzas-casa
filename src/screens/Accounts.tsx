import { useState } from 'react';
import { accountBalance, inTotal, minSpend, money, totalFunds } from '../calc';
import { remove, save } from '../store';
import { Account, AccountType } from '../types';
import { Card, Data, Empty, Field, num, ownerLabel } from '../ui';

const ORDER: AccountType[] = ['cash', 'debit', 'credit', 'investment', 'other'];
const TYPE_LABEL: Record<AccountType, string> = { debit: 'Debito', credit: 'Credito', cash: 'Efectivo', investment: 'Inversion', other: 'Prestamo / deuda' };

export default function Accounts({ d }: { d: Data }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState({ name: '', type: 'debit' as AccountType, initial: '', cutDay: '', payDay: '', limit: '', minSpend: '', maxSpend: '', inTotal: true, shared: false });
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }));

  function startEdit(id: string) {
    const a = d.allAccounts.find(x => x.id === id)!;
    setF({ name: a.data.name, type: a.data.type, initial: String(a.data.initial), cutDay: a.data.cutDay ? String(a.data.cutDay) : '', payDay: a.data.payDay ? String(a.data.payDay) : '', limit: a.data.limit ? String(a.data.limit) : '', minSpend: a.data.minSpend ? String(a.data.minSpend) : '', maxSpend: a.data.maxSpend ? String(a.data.maxSpend) : '', inTotal: inTotal(a), shared: a.owner === null });
    setEditId(id); setOpen(true);
  }
  function reset() { setF({ name: '', type: 'debit', initial: '', cutDay: '', payDay: '', limit: '', minSpend: '', maxSpend: '', inTotal: true, shared: false }); setEditId(null); setOpen(false); }

  function submit() {
    if (!f.name.trim()) return;
    const a: Account = { name: f.name.trim(), type: f.type, initial: num(f.initial), inTotal: f.inTotal };
    if (f.type === 'credit') {
      a.cutDay = Math.min(31, Math.max(1, Math.round(num(f.cutDay)))) || undefined;
      a.payDay = Math.round(num(f.payDay)) || undefined;
      a.limit = num(f.limit) || undefined;
      a.minSpend = num(f.minSpend) || undefined;
      a.maxSpend = num(f.maxSpend) || undefined;
    }
    save('account', a, f.shared ? null : d.me, editId ?? undefined);
    reset();
  }

  const formCard = (
        <Card title={editId ? 'Editar cuenta' : 'Nueva cuenta'}>
          <Field label="Nombre"><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="BBVA debito, Nu credito…" /></Field>
          <Field label="Tipo">
            <select value={f.type} onChange={e => set('type', e.target.value)}>
              <option value="debit">Debito</option><option value="credit">Credito</option><option value="cash">Efectivo</option><option value="investment">Inversion</option><option value="other">Prestamo / deuda</option>
            </select>
          </Field>
          <Field label={f.type === 'credit' ? 'Deuda actual (saldo inicial)' : 'Saldo inicial'}><input inputMode="decimal" value={f.initial} onChange={e => set('initial', e.target.value)} /></Field>
          {f.type === 'credit' && (
            <>
              <Field label="Dia de corte (1-31)"><input inputMode="numeric" value={f.cutDay} onChange={e => set('cutDay', e.target.value)} /></Field>
              <Field label="Dia limite de pago"><input inputMode="numeric" value={f.payDay} onChange={e => set('payDay', e.target.value)} /></Field>
              <Field label="Limite de credito"><input inputMode="decimal" value={f.limit} onChange={e => set('limit', e.target.value)} /></Field>
              <Field label="Gasto minimo por periodo (para evitar cobro por falta de uso; vacio si no aplica)"><input inputMode="decimal" value={f.minSpend} onChange={e => set('minSpend', e.target.value)} /></Field>
              <Field label="Tope maximo de gasto por periodo (vacio si no aplica)"><input inputMode="decimal" value={f.maxSpend} onChange={e => set('maxSpend', e.target.value)} /></Field>
            </>
          )}
          <label className="check"><input type="checkbox" checked={f.inTotal} onChange={e => set('inTotal', e.target.checked)} /> Contar en el total de mi dinero</label>
          {!editId && <label className="check"><input type="checkbox" checked={f.shared} onChange={e => set('shared', e.target.checked)} /> Cuenta compartida de la casa</label>}
          <div className="row-actions" style={{ justifyContent: "flex-start", gap: 8 }}><button className="primary" onClick={submit}>Guardar</button><button onClick={reset}>Cancelar</button></div>
        </Card>
  );

  return (
    <>
      <div className="month-nav"><b>Cuentas y tarjetas</b><button className="primary" onClick={() => (open ? reset() : setOpen(true))}>{open ? 'Cerrar' : '+ Nueva'}</button></div>

      {open && !editId && formCard}

      {d.accounts.length > 0 && (() => {
        const t = totalFunds(d.accounts, d.allTxns, d.allPlans);
        return (
          <Card className="total">
            <small>DINERO TOTAL</small>
            <div className="big">{money(t.total + d.extra)}</div>
            <div className="row"><small>Disponible (cuentas, efectivo, inversion)</small><span>{money(t.liquid)}</span></div>
            <div className="row"><small>Tarjetas de credito (deuda)</small><span className={t.cards < 0 ? 'neg' : ''}>{money(t.cards)}</span></div>
            {d.extra !== 0 && <div className="row"><small>Por cobrar y compras a meses pendientes</small><span>{money(d.extra)}</span></div>}
            {t.outside !== 0 && <div className="row"><small>Fuera del total</small><span>{money(t.outside)}</span></div>}
          </Card>
        );
      })()}

      {d.accounts.length === 0 && <Card><Empty>Aun no hay cuentas en esta vista.</Empty></Card>}
      {[...d.accounts].sort((x, y) => ORDER.indexOf(x.data.type) - ORDER.indexOf(y.data.type)).map(a => {
        const bal = accountBalance(a, d.allTxns, d.allPlans);
        const ms = minSpend(a, d.allTxns, d.allPlans);
        if (open && editId === a.id) return <div key={a.id}>{formCard}</div>;
        return (
          <Card key={a.id}>
            <div className="row">
              <div><b>{a.data.name}</b><small> {TYPE_LABEL[a.data.type]} · {ownerLabel(a.owner)}{inTotal(a) ? '' : ' · fuera del total'}</small></div>
              <b className={bal < 0 ? 'neg' : ''}>{a.data.type === 'credit' && bal < 0 ? `Debes ${money(-bal)}` : money(bal)}</b>
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
