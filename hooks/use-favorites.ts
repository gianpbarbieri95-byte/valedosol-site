"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "vds:favoritos";
/** Mantém todos os corações da página em sincronia sem estado global. */
const CHANGE_EVENT = "vds:favoritos-alterados";

const EMPTY: string[] = [];

/**
 * O snapshot precisa ser referencialmente estável: devolver um array novo a
 * cada leitura faria o React entrar em laço infinito. Guardamos o texto cru
 * do localStorage e só refazemos o array quando ele realmente muda.
 */
let cachedRaw: string | null = null;
let cachedIds: string[] = EMPTY;

function parseIds(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Modo privado ou armazenamento bloqueado: favoritos só não persistem.
    return EMPTY;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedIds = parseIds(raw);
  }
  return cachedIds;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readLocal(): string[] {
  if (typeof window === "undefined") return EMPTY;
  return getSnapshot();
}

function writeLocal(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* sem persistência disponível */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/**
 * Favoritos do visitante.
 *
 * Sem login, ficam no localStorage. Com login, são gravados também na tabela
 * favorites — e o que já estava salvo no navegador sobe junto na primeira vez,
 * para ninguém perder o que marcou antes de entrar.
 */
export function useFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;

    const supabase = createClient();
    let active = true;

    void supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      if (!active || !user) return;

      const { data: rows } = await supabase.from("favorites").select("property_id");
      if (!active) return;

      const remote = (rows ?? []).map((row) => row.property_id as string);
      const local = readLocal();
      const missing = local.filter((id) => !remote.includes(id));

      if (missing.length) {
        await supabase
          .from("favorites")
          .upsert(
            missing.map((property_id) => ({ user_id: user.id, property_id })),
            { onConflict: "user_id,property_id" }
          );
      }

      if (!active) return;
      setUserId(user.id);
      writeLocal([...new Set([...remote, ...local])]);
    });

    return () => {
      active = false;
    };
  }, []);

  const toggle = useCallback(
    async (propertyId: string) => {
      const current = readLocal();
      const isFavorite = current.includes(propertyId);
      const next = isFavorite ? current.filter((id) => id !== propertyId) : [...current, propertyId];

      writeLocal(next);

      if (userId && process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const supabase = createClient();
        if (isFavorite) {
          await supabase.from("favorites").delete().eq("user_id", userId).eq("property_id", propertyId);
        } else {
          await supabase
            .from("favorites")
            .upsert({ user_id: userId, property_id: propertyId }, { onConflict: "user_id,property_id" });
        }
      }

      return !isFavorite;
    },
    [userId]
  );

  return { ids, ready, toggle, isSignedIn: Boolean(userId) };
}
