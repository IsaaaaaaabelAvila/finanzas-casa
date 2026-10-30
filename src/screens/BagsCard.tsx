import { useState } from 'react';
import { addMonthsYm, money, today, ym } from '../calc';
import { save } from '../store';
import { Card, Data, num } from '../ui';

/** Las dos bolsas, sin importar en que cuenta vive el dinero. */
export default function BagsCard({ d }: { d: Data }) {
  const b = d.bags;
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState('');
  const [dir, setDir] = useState<1 | -1>(1);
  const [toSave, setToSave] = useState('');
  if (!b) return null;

  // Cierre de mes: el ultimo dia del mes y los primeros dias del siguiente; el sobrante incluye la provision de casa que no se uso
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cut = now.getDate() === lastDay ? ym(now) : now.getDate() <= 3 ? addMonthsYm(ym(now), -1) : null;
  const cutKey = cut ? `cierre:${cut}` : '';
  const closing = Boolean(cut && b.started && cut >= b.from.slice(0, 7) && !d.bagmoves.some(x => x.data.key === cutKey));
  const sob = b.libre + b.O;
  const close = (amount: number) => {
    save('bagmove', { date: today(), amount, note: `Cierre ${cut}`, key: cutKey }, d.me);
    setToSave('');
  };

  const apply = () => {
    const v = num(amt);
    if (!v) return;
    save('bagmove', { date: today(), amount: dir * Math.abs(v), note: dir === 1 ? 'De gasto a ahorro' : 'De ahorro a gasto' }, d.me);
    setAmt(''); setOpen(false);
  };

  return (
    <Card title="Bolsas">
      {!b.started && <small>EL ESQUEMA ARRANCA EL {b.from} · ASI SE VERIA HOY</small>}
      <div className="row" style={{ marginTop: 6 }}><span>Libre para gastar</span><b className={b.libre < 0 ? 'neg' : 'pos'}>{money(b.libre)}</b></div>
      <div className="row"><span>Ahorro real</span><b>{money(b.ahorro)}</b></div>
      <div className="row"><span>Deuda comprometida</span><b>{money(b.comprometida)}</b></div>
      {b.sinCobertura > 0.5 && <div className="row"><span>Deuda sin cobertura</span><b className="neg">{money(b.sinCobertura)}</b></div>}
      <div className="row"><span>Patrimonio</span><b className={d.pat.a < 0 ? 'neg' : ''}>{money(d.pat.a)} <small>/ con por cobrar {money(d.pat.b)}</small></b></div>
      <div className="row" style={{ marginTop: 10 }}><span>Bolsa de gasto</span><b>{money(b.gastoBag)}</b></div>
      <div className="row"><small>Comprometido en deuda inmediata</small><small>{money(b.D1)}</small></div>
      {b.O > 0.5 && <div className="row"><small>Provision de casa pendiente</small><small>{money(b.O)}</small></div>}
      {b.A > 0.5 && <div className="row"><small>Parte ajena por reembolsar</small><small>{money(b.A)}</small></div>}
      <div className="row"><small>Libre</small><small>{money(b.libre)}</small></div>
      <div className="row" style={{ marginTop: 6 }}><span>Bolsa de ahorro</span><b>{money(b.ahorroBag)}</b></div>
      <div className="row"><small>Comprometido a deuda</small><small>{money(b.B2)}</small></div>
      {b.DM > 0.5 && <div className="row"><small>Deuda financiada por metas</small><small>{money(b.DM)}</small></div>}
      <div className="row"><small>Ahorro real</small><small>{money(b.ahorro)}</small></div>
      {!b.fixed && d.setting && (
        <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="link" onClick={() => confirm(`Fijar el arranque: bolsa de ahorro inicial de ${money(b.S0)} (ahorro real ${money(b.ahorro)}, libre ${money(b.libre)}). ¿Guardar?`) && save('setting', { ...d.setting!.data, bagStart: { ...d.setting!.data.bagStart!, ahorro: Math.round(b.S0 * 100) / 100 } }, d.me, d.setting!.id)}>Fijar arranque ({money(b.S0)})</button>
        </div>
      )}
      {closing && (
        <div className="settle">
          <small>CIERRE DE {cut}</small>
          <div className="row"><span>{sob >= 0 ? 'Sobrante' : 'Faltante'}</span><b className={sob < 0 ? 'neg' : 'pos'}>{money(sob)}</b></div>
          {sob >= 0 ? (
            <>
              <label className="field"><span>Pasar a ahorro (lo demas se arrastra al mes siguiente)</span><input inputMode="decimal" value={toSave} onChange={e => setToSave(e.target.value)} placeholder="0.00" /></label>
              <div className="row-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
                <button className="primary" onClick={() => close(Math.min(sob, Math.abs(num(toSave))))}>{num(toSave) > 0 ? 'Pasar a ahorro' : 'Arrastrar todo'}</button>
              </div>
            </>
          ) : (
            <div className="row-actions" style={{ justifyContent: 'flex-start', gap: 8 }}>
              <button className="primary" onClick={() => close(sob)}>Cubrir con ahorro</button>
              <button onClick={() => close(0)}>Arrastrar faltante</button>
            </div>
          )}
        </div>
      )}
      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="link" onClick={() => setOpen(!open)}>Mover entre bolsas</button>
      </div>
      {open && (
        <div className="settle">
          <div className="seg">
            <button className={dir === 1 ? 'on' : ''} onClick={() => setDir(1)}>Gasto → Ahorro</button>
            <button className={dir === -1 ? 'on' : ''} onClick={() => setDir(-1)}>Ahorro → Gasto</button>
          </div>
          <label className="field"><span>Monto</span><input inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} placeholder="0.00" /></label>
          <button className="primary" onClick={apply} disabled={!num(amt)}>Mover</button>
        </div>
      )}
    </Card>
  );
}
