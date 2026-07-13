import { get, set } from "idb-keyval";

const KEYS_KEY = "ripple-background-keys";
const ACTIVE_KEY = "ripple-background-active";

export async function loadBackgroundKeys(): Promise<string[]> {
  return (await get<string[]>(KEYS_KEY)) ?? [];
}

export async function loadBackgroundData(id: string): Promise<string | undefined> {
  return get<string>(id);
}

export async function loadActiveBackgroundIndex(): Promise<number> {
  const index = await get<number>(ACTIVE_KEY);
  return typeof index === "number" ? index : 0;
}

export async function saveBackgroundData(base64: string): Promise<string> {
  const id = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const keys = await loadBackgroundKeys();
  keys.push(id);
  await set(id, base64);
  await set(KEYS_KEY, keys);
  await set(ACTIVE_KEY, keys.length - 1);
  return id;
}

export async function setActiveBackgroundIndex(index: number): Promise<void> {
  await set(ACTIVE_KEY, index);
}

export function toDisplayUrl(data: string): string {
  if (data.startsWith("data:") || data.startsWith("blob:")) return data;
  return `data:image/jpeg;base64,${data}`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
