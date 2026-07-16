import Redis from "ioredis";
import { NextRequest, NextResponse } from "next/server";

const LETTERS_KEY = "riplora_letters";

export interface WindLetter {
  content: string;
  timestamp: number;
}

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

function getRedis(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }

  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(url);
  }

  return globalForRedis.redis;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function parseLetter(raw: string): WindLetter | null {
  try {
    const parsed = JSON.parse(raw) as WindLetter;
    if (typeof parsed.content === "string" && typeof parsed.timestamp === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
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
    const redis = getRedis();
    const letter: WindLetter = {
      content: content.slice(0, 2000),
      timestamp: Date.now(),
    };

    await redis.lpush(LETTERS_KEY, JSON.stringify(letter));
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
    const redis = getRedis();
    const rawLetters = await redis.lrange(LETTERS_KEY, 0, -1);
    const letters = rawLetters
      .map(parseLetter)
      .filter((letter): letter is WindLetter => letter !== null);

    return NextResponse.json({ letters });
  } catch (error) {
    console.error("[/api/letter] 读取失败：", error);
    return NextResponse.json(
      { error: errorMessage(error, "无法读取风中的信") },
      { status: 500 },
    );
  }
}
