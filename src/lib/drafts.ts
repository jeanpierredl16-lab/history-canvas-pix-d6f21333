import { useEffect, useRef, useState } from "react";

/**
 * Pequeño hook para mantener un borrador de formulario en localStorage.
 * Persiste a medida que el usuario escribe — sobrevive a recargas y a
 * cierres accidentales de la tablet sin conexión.
 */
export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) return { ...(initial as any), ...JSON.parse(raw) } as T;
    } catch {
      /* ignore */
    }
    return initial;
  });

  const tRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (tRef.current) window.clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* quota — silencioso */
      }
    }, 400);
    return () => {
      if (tRef.current) window.clearTimeout(tRef.current);
    };
  }, [key, value]);

  function clear() {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    setValue(initial);
  }

  return [value, setValue, clear] as const;
}

/** Helpers crudos para componentes no controlados (Canvas, etc.). */
export const draftStore = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, val: string) {
    try {
      window.localStorage.setItem(key, val);
    } catch {
      /* ignore */
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}