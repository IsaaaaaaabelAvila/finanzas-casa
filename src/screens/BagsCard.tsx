import { useState } from 'react';
import { money, today } from '../calc';
import { save } from '../store';
import { Card, Data, num } from '../ui';

/** Las dos bolsas, sin importar en que cuenta vive el dinero. */
export default function BagsCard({ d }: { d: Data }) {
  const b = d.bags;
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState('');
  const [dir, setDir] = useState<1 | -1>(1);
  if (!b) return null;

  const apply = () => {
    const v = num(amt);
    if (!v) return;
    save('bagmove', { date: today(), amount: dir * Math.abs(v), note: dir === 1 ? 'De gasto a ahorro' : 'De ahorro a gasto' }, d.me);
    setAmt(''); setOpen(false);
  };

  return (
    <Card title="Bolsas">
      {!b.started && <small>EL ESQUEMA ARRANCA EL {b.from} · ASI SE VERIA HOY</small>}
      <div className="row" style={{ marginTop: 6 }}><span>Bolsa de gasto</span><b>{money(b.gasto)}</b></div>
      <div className="row"><span>Bolsa de ahorro</span><b>{money(b.ahorro)}</b></div>
      <div className="row"><small>Patrimonio (gasto + ahorro)</small><small className={b.patrimonio < 0 ? 'neg' : ''}>{money(b.patrimonio)}</small></div>
      <div className="row"><small>Dinero en cuentas</small><small>{money(b.cash)}</small></div>
      <div className="row"><small>De ese dinero, respalda lo que debes</small><small>{money(b.respaldo)}</small></div>
      {b.capped && <small>El ahorro no puede superar tu patrimonio: lo que falta se repone con tus siguientes ingresos.</small>}
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
