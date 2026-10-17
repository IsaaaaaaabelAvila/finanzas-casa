import { useState } from 'react';
import { goalPlan, money } from '../calc';
import { remove, save } from '../store';
import { Bar, Card, Data, Empty, Field, num, ownerLabel } from '../ui';

export default function Goals({ d }: { d: Data }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState('');
  const [shared, setShared] = useState(false);
  const [link, setLink] = useState(false);

  function submit() {
    if (!name.trim() || !num(target)) return;
    save('goal', { name: name.trim(), target: num(target), saved: num(saved), deadline: deadline || undefined, linkTotal: link || undefined }, shared ? null : d.me);
    setName(''); setTarget(''); setSaved(''); setDeadline(''); setOpen(false);
  }
  function contribute(id: string) {
    const v = num(prompt('¿Cuanto abonas a esta meta? (usa negativo para retirar)') || '0');
    if (!v) return;
    const g = d.goals.find(x => x.id === id)!;
    save('goal', { ...g.data, saved: Math.max(0, g.data.saved + v) }, g.owner, id);
  }

  return (
    <>
      <div className="month-nav"><b>Metas financieras</b><button className="primary" onClick={() => setOpen(!open)}>{open ? 'Cerrar' : '+ Nueva'}</button></div>

      {open && (
        <Card title="Nueva meta">
          <Field label="Nombre"><input value={name} onChange={e => setName(e.target.value)} placeholder="Fondo de emergencia, viaje…" /></Field>
          <Field label="Monto objetivo"><input inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} /></Field>
          <Field label="Ya llevas ahorrado"><input inputMode="decimal" value={saved} onChange={e => setSaved(e.target.value)} /></Field>
          <Field label="Fecha limite (opcional)"><input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></Field>
          <label className="check"><input type="checkbox" checked={link} onChange={e => setLink(e.target.checked)} /> Ligar al total de mis cuentas (el ahorro se calcula solo)</label>
          <label className="check"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Meta de la casa (la ven los dos)</label>
          <button className="primary" onClick={submit}>Guardar</button>
        </Card>
      )}

      {d.goals.length === 0 && <Card><Empty>Aun no hay metas.</Empty></Card>}
      {d.goals.map(g => {
        const savedNow = g.data.linkTotal ? d.total : g.data.saved;
        const p = goalPlan(g.data.target, savedNow, g.data.deadline);
        return (
          <Card key={g.id}>
            <div className="row"><b>{g.data.name}</b><span>{ownerLabel(g.owner)}</span></div>
            <Bar pct={p.pct} tone={p.pct >= 100 ? 'good' : 'warn'} />
            <div className="row"><span>{money(savedNow)} de {money(g.data.target)}</span><b>{p.pct.toFixed(0)}%</b></div>
            <small>
              {p.left === 0 ? '¡Meta alcanzada!' : <>Te faltan <b>{money(p.left)}</b>{p.perMonth !== null && <> · {p.monthsLeft} meses → <b>{money(p.perMonth)}/mes</b></>}</>}
            </small>
            <div className="row-actions">
              {!g.data.linkTotal && <button className="link" onClick={() => contribute(g.id)}>Abonar</button>}
              <button className="link danger" onClick={() => confirm('¿Borrar meta?') && remove(g.id)}>Borrar</button>
            </div>
          </Card>
        );
      })}
    </>
  );
}
