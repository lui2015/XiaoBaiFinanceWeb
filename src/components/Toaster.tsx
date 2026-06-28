'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

type Toast = { id: number; type: 'info' | 'success' | 'error'; msg: string };
type Ctx = { push: (msg: string, type?: Toast['type']) => void };

const ToastCtx = createContext<Ctx | null>(null);
export const useToast = () => {
  const c = useContext(ToastCtx);
  return c ?? { push: (m: string) => alert(m) };
};

let _seq = 0;
let _ext: ((m: string, t: Toast['type']) => void) | null = null;
export function toast(msg: string, type: Toast['type'] = 'info') { _ext?.(msg, type); }

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, type: Toast['type'] = 'info') => {
    const id = ++_seq;
    setItems((s) => [...s, { id, msg, type }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 2500);
  }, []);
  useEffect(() => { _ext = push; return () => { _ext = null; }; }, [push]);
  return (
    <ToastCtx.Provider value={{ push }}>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {items.map((i) => (
          <div key={i.id}
            className={`px-4 py-2 rounded shadow text-sm text-white pointer-events-auto ${
              i.type === 'success' ? 'bg-emerald-500' :
              i.type === 'error' ? 'bg-rose-500' :
              'bg-gray-800'
            }`}>{i.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
