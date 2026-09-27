/**
 * Datas da agenda no fuso da imobiliária.
 *
 * O servidor (Vercel) roda em UTC e o banco guarda timestamptz; quem usa o
 * painel pensa no horário de Arujá. Toda conversão entre o que a pessoa
 * digita num <input type="datetime-local"> e o instante gravado passa por
 * aqui, sempre em CRM_TIME_ZONE — nunca no fuso do servidor.
 *
 * Arquivo neutro: roda no servidor e no navegador.
 */
import { CRM_TIME_ZONE } from "@/lib/crm";

export interface ZonedParts {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CRM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Data e hora de um instante no fuso da imobiliária. */
export function zonedParts(value: Date | string): ZonedParts {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = Object.fromEntries(partsFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday] ?? 0,
  };
}

/** Diferença (ms) entre o relógio de Arujá e o UTC naquele instante. */
function zoneOffset(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(date.getTime() / 60000) * 60000;
}

/** Instante correspondente a uma data/hora "de parede" em Arujá. */
export function zonedToDate(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Duas passadas acertam inclusive perto de uma eventual mudança de horário.
  let result = guess - zoneOffset(new Date(guess));
  result = guess - zoneOffset(new Date(result));
  return new Date(result);
}

/** "2026-09-27T14:30" (datetime-local, horário de Arujá) → Date. */
export function parseLocalInput(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  if (!match) return null;
  const [, y, m, d, h = "0", min = "0"] = match;
  const date = zonedToDate(Number(y), Number(m), Number(d), Number(h), Number(min));
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Date/ISO → "2026-09-27T14:30" para preencher um datetime-local. */
export function toLocalInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const p = zonedParts(value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Date/ISO → "2026-09-27" (dia em Arujá). */
export function toLocalDateKey(value: Date | string): string {
  const p = zonedParts(value);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Início do dia (00:00 em Arujá) que contém o instante. */
export function startOfLocalDay(value: Date | string = new Date()): Date {
  const p = zonedParts(value);
  return zonedToDate(p.year, p.month, p.day);
}

/** Soma dias de calendário (no fuso da imobiliária). */
export function addLocalDays(value: Date, days: number): Date {
  const p = zonedParts(value);
  return zonedToDate(p.year, p.month, p.day + days, p.hour, p.minute);
}

/** Domingo 00:00 da semana que contém o instante. */
export function startOfLocalWeek(value: Date | string = new Date()): Date {
  const start = startOfLocalDay(value);
  return addLocalDays(start, -zonedParts(start).weekday);
}

/** "2026-09-27" → Date do início desse dia em Arujá; inválido → null. */
export function parseDateKey(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return parseLocalInput(value);
}

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: CRM_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const dayFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: CRM_TIME_ZONE, day: "2-digit", month: "2-digit" });
const longDayFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: CRM_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: CRM_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatLocalTime = (value: Date | string) => timeFormatter.format(new Date(value));
export const formatLocalDay = (value: Date | string) => dayFormatter.format(new Date(value));
export const formatLocalLongDay = (value: Date | string) => longDayFormatter.format(new Date(value));
export const formatLocalDateTime = (value: Date | string) => dateTimeFormatter.format(new Date(value));

/** Dias inteiros desde o instante até agora. */
export function daysSince(value: Date | string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000));
}
