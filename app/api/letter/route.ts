import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";

const LETTERS_KEY = "ripple_letters";

export interface WindLetter {
  content: string;
  timestamp: number;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export async function POST(request: NextRequest) {
  let content = "";

  try {
    const body = await request.json();
    content = typeof body?.content === "string" ? body.content.trim() : "";
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "content 不能为空" }, { status: 400 });
  }

  try {
    const letter: WindLetter = {
      content: content.slice(0, 2000),
      timestamp: Date.now(),
    };

    await kv.lpush(LETTERS_KEY, letter);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[/api/letter] 存储失败：", error);
    return NextResponse.json(
      { error: errorMessage(error, "信件未能存入风中") },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const agentSecret = process.env.AGENT_SECRET;

  if (!agentSecret || secret !== agentSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const letters = (await kv.lrange<WindLetter>(LETTERS_KEY, 0, -1)) ?? [];
    return NextResponse.json({ letters });
  } catch (error) {
    console.error("[/api/letter] 读取失败：", error);
    return NextResponse.json(
      { error: errorMessage(error, "无法读取风中的信") },
      { status: 500 },
    );
  }
}
