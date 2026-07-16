import { del, get, set } from "idb-keyval";

const KEYS_KEY = "riplora-background-keys";
const ACTIVE_ID_KEY = "riplora-background-active-id";

export interface StoredBackground {
  id: string;
  dataUrl: string;
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

async function loadBackgroundKeys(): Promise<string[]> {
  return (await get<string[]>(KEYS_KEY)) ?? [];
}

/** 从 IndexedDB 读取全部已保存背景。 */
export async function getAllBackgrounds(): Promise<StoredBackground[]> {
  const keys = await loadBackgroundKeys();
  const records: StoredBackground[] = [];

  for (const id of keys) {
    const raw = await get<string>(id);
    if (raw) {
      records.push({ id, dataUrl: toDisplayUrl(raw) });
    }
  }

  return records;
}

/** 添加背景并返回唯一 ID。 */
export async function addBackgroundToStorage(dataUrl: string): Promise<string> {
  const id = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const keys = await loadBackgroundKeys();
  keys.push(id);
  await set(id, dataUrl);
  await set(KEYS_KEY, keys);
  return id;
}

/** 从 IndexedDB 删除指定背景。 */
export async function removeBackgroundFromStorage(id: string): Promise<void> {
  const keys = await loadBackgroundKeys();
  await del(id);
  await set(
    KEYS_KEY,
    keys.filter((key) => key !== id),
  );
}

export async function getActiveBackgroundId(): Promise<string | null> {
  const value = await get<string | null>(ACTIVE_ID_KEY);
  return value ?? null;
}

export async function setActiveBackgroundId(id: string | null): Promise<void> {
  await set(ACTIVE_ID_KEY, id);
}
