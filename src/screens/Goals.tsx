import { useState } from 'react';
import { allocateGoals, goalPlan, goalSaved, money } from '../calc';
import { remove, save } from '../store';
import type { Goal } from '../types';
import { Bar, Card, Data, Empty, Field, num, ownerLabel } from '../ui';

const EMPTY = { name: '', target: '', saved: '', deadline: '', link: true, shared: false, kind: 'spend' as 'fund' | 'spend' };

export default function Goals({ d }: { d: Data }) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [f, setF] = useState(EMPTY);
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }));

  const sorted = [...d.goals].sort((a, b) => (a.data.order ?? 1e9) - (b.data.order ?? 1e9));
  const base = d.bags ? d.bags.ahorro : d.total;
  const spent = d.bags ? d.bags.goalHeld : d.goalCommitted;
  const al = allocateGoals(d.goals, base, spent);
  const progress = (g: (typeof d.goals)[number]) => goalSaved(g, al.alloc, spent);
  const targetSum = al.linked.reduce((a, g) => a + g.data.target, 0);
  const allocSum = al.linked.reduce((a, g) => a + progress(g), 0);

  function reset() { setF(EMPTY); setEditId(null); setOpen(false); }

  function startEdit(id: string) {
    const g = d.goals.find(x => x.id === id)!;
    setF({ name: g.data.name, target: String(g.data.target), saved: String(g.data.saved), deadline: g.data.deadline ?? '', link: Boolean(g.data.linkTotal), shared: g.owner === null, kind: g.data.kind ?? 'spend' });
    setEditId(id); setOpen(true);
  }

  function submit() {
    if (!f.name.trim() || !num(f.target)) return;
    const prev = editId ? d.goals.find(x => x.id === editId) : undefined;
    const nextOrder = prev?.data.order ?? (Math.max(0, ...d.goals.map(g => g.data.order ?? 0)) + 1);
    const goal: Goal = { name: f.name.trim(), target: num(f.target), saved: num(f.saved), deadline: f.deadline || undefined, linkTotal: f.link || undefined, order: nextOrder, kind: f.kind };
    save('goal', goal, f.shared ? null : d.me, editId ?? undefined);
    reset();
  }

  function contribute(id: string) {
    const v = num(prompt('¿Cuanto abonas a esta meta? (usa negativo para retirar)') || '0');
    if (!v) return;
    const g = d.goals.find(x => x.id === id)!;
    save('goal', { ...g.data, saved: Math.max(0, g.data.saved + v) }, g.owner, id);
  }

  // cambia el orden de prioridad: el dinero total se reparte primero a las metas de arriba
  function move(id: string, dir: -1 | 1) {
    const i = sorted.findIndex(g => g.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const arr = [...sorted];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    arr.forEach((g, k) => { if (g.data.order !== k + 1) save('goal', { ...g.data, order: k + 1 }, g.owner, g.id); });
  }

  const formCard = (
    <Card title={editId ? 'Editar meta' : 'Nueva meta'}>
      <Field label="Nombre"><input value={f.name} onChange={e => set('name', e.target.value)} placeholder="Fondo de emergencia, viaje…" /></Field>
      <Field label="Monto objetivo"><input inputMode="decimal" value={f.target} onChange={e => set('target', e.target.value)} /></Field>
      <Field label="Tipo de meta">
        <select value={f.kind} onChange={e => set('kind', e.target.value as 'fund' | 'spend')}>
          <option value="spend">Meta que se gasta (ej. viaje): al gastarla se cierra y empiezas de nuevo</option>
          <option value="fund">Fondo que se repone (ej. emergencia): si lo usas, lo repones</option>
        </select>
      </Field>
      <label className="check"><input type="checkbox" checked={f.link} onChange={e => set('link', e.target.checked)} /> Se llena con mi dinero total (por orden de prioridad)</label>
      {!f.link && <Field label="Ya llevas ahorrado"><input inputMode="decimal" value={f.saved} onChange={e => set('saved', e.target.value)} /></Field>}
      <Field label="Fecha limite (opcional)"><input type="date" value={f.deadline} onChange={e => set('deadline', e.target.value)} /></Field>
      {!editId && <label className="check"><input type="checkbox" checked={f.shared} onChange={e => set('shared', e.target.checked)} /> Meta de la casa (la ven los dos)</label>}
      <div className="row-actions" style={{ justifyContent: 'flex-start', gap: 8 }}><button className="primary" onClick={submit}>Guardar</button><button onClick={reset}>Cancelar</button></div>
    </Card>
  );

  return (
    <>
      <div className="month-nav"><b>Metas financieras</b><button className="primary" onClick={() => (open ? reset() : setOpen(true))}>{open ? 'Cerrar' : '+ Nueva'}</button></div>

      {open && !editId && formCard}

      {al.linked.length > 0 && (
        <Card className="total">
          <small>{d.bags ? 'BOLSA DE AHORRO REPARTIDA EN TUS METAS' : 'DINERO TOTAL REPARTIDO EN TUS METAS'}</small>
          <div className="big">{money(base)}</div>
          <Bar pct={targetSum > 0 ? (allocSum / targetSum) * 100 : 0} tone={allocSum >= targetSum ? 'good' : 'warn'} />
          <div className="row"><small>Asignado a metas</small><span>{money(allocSum)} de {money(targetSum)} ({targetSum > 0 ? ((allocSum / targetSum) * 100).toFixed(0) : 0}%)</span></div>
          <div className="row"><small>Sin asignar</small><span>{money(al.unassigned)}</span></div>
        </Card>
      )}

      {d.goals.length === 0 && <Card><Empty>Aun no hay metas.</Empty></Card>}
      {sorted.map((g, idx) => {
        if (open && editId === g.id) return <div key={g.id}>{formCard}</div>;
        const savedNow = g.data.linkTotal ? progress(g) : g.data.saved;
        const p = goalPlan(g.data.target, savedNow, g.data.deadline);
        return (
          <Card key={g.id}>
            <div className="row">
              <b>{idx + 1}. {g.data.name}</b>
              <span className="tx-r">
                <button className="x" title="Subir prioridad" onClick={() => move(g.id, -1)} disabled={idx === 0}>▲</button>
                <button className="x" title="Bajar prioridad" onClick={() => move(g.id, 1)} disabled={idx === sorted.length - 1}>▼</button>
                <span>{ownerLabel(g.owner)}</span>
              </span>
            </div>
            <Bar pct={p.pct} tone={p.pct >= 100 ? 'good' : 'warn'} />
            <div className="row"><span>{money(savedNow)} de {money(g.data.target)}</span><b>{p.pct.toFixed(0)}%</b></div>
            {(spent[g.id] ?? 0) > 0 && (g.data.kind === 'fund' ? <small>Pagado con este fondo: {money(spent[g.id])} (hay que reponerlo)</small> : <small>{d.bags ? <>Gastado {money(d.goalSpent[g.id] ?? 0)} · comprometido a pagos {money(d.bags.goalPending[g.id] ?? 0)} · disponible {money(al.alloc[g.id] ?? 0)}</> : <>Ya comprometido en esta meta: {money(spent[g.id])} · ahorrado: {money(al.alloc[g.id] ?? 0)}</>}</small>)}
            <small>
              {p.left === 0 ? '¡Meta completa!' : <>Te faltan <b>{money(p.left)}</b>{p.perMonth !== null && <> · {p.monthsLeft} meses → <b>{money(p.perMonth)}/mes</b></>}</>}
            </small>
            <div className="row-actions">
              {!g.data.linkTotal && <button className="link" onClick={() => contribute(g.id)}>Abonar</button>}
              {g.data.kind !== 'fund' && g.data.linkTotal && <button className="link" onClick={() => confirm('¿Ya la gastaste? Se cierra y dejas de verla; lo que pagaste con ella sigue sin restar de tu libre.') && save('goal', { ...g.data, closed: true }, g.owner, g.id)}>Cerrar meta (ya la gaste)</button>}
              <button className="link" onClick={() => startEdit(g.id)}>Editar</button>
              <button className="link danger" onClick={() => confirm('¿Borrar meta?') && remove(g.id)}>Borrar</button>
            </div>
          </Card>
        );
      })}
    </>
  );
}
