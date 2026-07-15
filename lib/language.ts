export type InputLanguage = "zh" | "en";

export function detectInputLanguage(text: string): InputLanguage {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) ?? []).length;
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length;

  if (cjk === 0 && latin > 0) return "en";
  if (latin === 0 && cjk > 0) return "zh";
  return cjk >= latin ? "zh" : "en";
}
