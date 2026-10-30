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
  const libre = Math.abs(b.libre) < 0.005 ? 0 : b.libre;
  const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 } as const;

  // Cierre de mes: el ultimo dia del mes y los primeros dias del siguiente; el sobrante incluye la provision de casa que no se uso
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const cut = now.getDate() === lastDay ? ym(now) : now.getDate() <= 3 ? addMonthsYm(ym(now), -1) : null;
  const cutKey = cut ? `cierre:${cut}` : '';
  const closing = Boolean(cut && b.started && cut >= b.from.slice(0, 7) && !d.bagmoves.some(x => x.data.key === cutKey));
  const sob = libre + b.O;
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
    <>
      {!b.started && <small>EL ESQUEMA ARRANCA EL {b.from} · ASI SE VERIA HOY</small>}
      <Card className="total">
        <small>LIBRE PARA GASTAR</small>
        <div className="big" style={{ color: libre >= 0 ? 'var(--good)' : 'var(--bad)' }}>{money(libre)}</div>
        {libre < 0 && <small>Faltante</small>}
        <div className="row" style={{ marginTop: 10 }}><span>Deuda comprometida</span><b>{money(b.comprometida)}</b></div>
        <div className="row"><small>· Banco (deuda personal)</small><small>{money(d.pat.deudaPropia)}</small></div>
        <div className="row"><small>· Otros (personas)</small><small>{money(d.pat.porPagarPersonas)}</small></div>
        <div className="row"><small>· Casa</small><small>{money(d.pat.porPagarCasa)}</small></div>
        {b.sinCobertura > 0.5 && <div className="row"><small className="neg">· Sin cobertura (aun no apartada)</small><small className="neg">−{money(b.sinCobertura)}</small></div>}
        <div className="row"><span>Ahorro real</span><b>{money(b.ahorro)}</b></div>
      </Card>

      <div style={{ ...grid, alignItems: 'start' }}>
        <Card title="Bolsa de gasto">
          <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 6 }}><small>TOTAL</small><div style={{ fontSize: 22, fontWeight: 400, lineHeight: 1.2 }}>{money(b.gastoBag)}</div></div>
          <div className="row"><small>Deuda inmediata</small><b>−{money(b.D1)}</b></div>
          {b.d1.own > 0.5 && <div className="row"><small>· Mensualidades</small><small>{money(b.d1.own)}</small></div>}
          {b.d1.casa > 0.5 && <div className="row"><small>· Mi parte de casa</small><small>{money(b.d1.casa)}</small></div>}
          {b.d1.owe > 0.5 && <div className="row"><small>· A personas</small><small>{money(b.d1.owe)}</small></div>}
          {b.d1.cards.map((c, i) => <div key={i} className="row"><small>· {c.name}{c.stmt ? ' (estado)' : ''}</small><small>{money(c.v)}</small></div>)}
          {Math.abs(b.d1.adjust) > 0.5 && <div className="row"><small>· Ajuste</small><small>{money(b.d1.adjust)}</small></div>}
          {b.O > 0.5 && <div className="row"><small>Provision de casa</small><b>−{money(b.O)}</b></div>}
          {b.A > 0.5 && <div className="row"><small>Parte ajena por reembolsar</small><b>−{money(b.A)}</b></div>}
          <div className="row"><b>Libre</b><b className={libre < 0 ? 'neg' : 'pos'}>{money(libre)}</b></div>
        </Card>
        <Card title="Bolsa de ahorro">
          <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 8, marginBottom: 6 }}><small>TOTAL</small><div style={{ fontSize: 22, fontWeight: 400, lineHeight: 1.2 }}>{money(b.ahorroBag)}</div></div>
          <div className="row"><small>Comprometido a deuda</small><b>−{money(b.B2)}</b></div>
          {b.d2.casa > 0.5 && <div className="row"><small>· Casa (meses futuros)</small><small>{money(b.d2.casa)}</small></div>}
          {b.d2.otros > 0.5 && <div className="row"><small>· Otros (meses futuros)</small><small>{money(b.d2.otros)}</small></div>}
          {b.d2.banco > 0.5 && <div className="row"><small>· Banco (tarjetas, resto)</small><small>{money(b.d2.banco)}</small></div>}
          {b.DM > 0.5 && <div className="row"><small>Deuda de metas</small><small>−{money(b.DM)}</small></div>}
          <div className="row"><b>Ahorro real</b><b>{money(b.ahorro)}</b></div>
        </Card>
      </div>

      <Card title="Bolsas">
      {!b.fixed && d.setting && (
        <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
          <button className="link" onClick={() => confirm(`Fijar el arranque: bolsa de ahorro inicial de ${money(b.S0)} (ahorro real ${money(b.ahorro)}, libre ${money(libre)}). ¿Guardar?`) && save('setting', { ...d.setting!.data, bagStart: { ...d.setting!.data.bagStart!, ahorro: Math.round(b.S0 * 100) / 100 } }, d.me, d.setting!.id)}>Fijar arranque ({money(b.S0)})</button>
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
    </>
  );
}
