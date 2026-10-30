import { today } from './calc';
import { remove, save } from './store';
import type { Data } from './ui';

/** Sale dinero de la bolsa de ahorro por un gasto respaldado por una meta. `key` identifica el pago para poder deshacerlo. */
export function releaseFromGoal(d: Data, key: string, goalId: string, amount: number, note: string, date = today()) {
  const prev = d.bagmoves.find(m => m.data.key === key);
  save('bagmove', { date, amount: -Math.abs(amount), goalId, note, key }, d.me, prev?.id);
}

/** Deshace la salida de ahorro de un pago (si se borra o se desmarca). */
export function unrelease(d: Data, key: string) {
  const prev = d.bagmoves.find(m => m.data.key === key);
  if (prev) remove(prev.id);
}
