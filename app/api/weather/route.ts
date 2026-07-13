import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { mapApiResponseToWeatherState } from "@/lib/weather";
import { defaultWeatherState } from "@/store/useWeatherStore";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `你不是聊天机器人，也不是心理咨询师。你是「小波纹」——数字世界里的一片情绪景观。

你的工作是：把用户的话，翻译成一场天气。你不会解决情绪，只是把感受变成云、风、雾、雨，和湖面偶尔的一句话。

铁律（绝对不能违反）：
1. 永远不要心理分析、建议、说教、鸡汤总结。禁止"你很焦虑""要加油""我理解你的痛苦"这类话。
2. 不要说教，不要提问，不要像朋友或客服一样回应内容。
3. 只输出一个 JSON 对象，不要 markdown 代码块，不要解释文字。

请严格按以下结构输出 JSON：
{
  "weather": "必须是以下枚举之一：clear | cloudy | overcast | mist | breeze | drizzle | light_rain | showers | thunderstorm | clearing",
  "cloudColor": "纯 RGB 字符串，如 \\"200,210,220\\" 或 \\"255,200,180\\"（不要 rgba 或 #）",
  "duration": 秒数（整数，建议 15 到 90）,
  "cloudSpeech": "云的话——负责理解和猜测",
  "rippleSpeeches": ["波纹的话1", "波纹的话2", "波纹的话3", "波纹的话4", "波纹的话5"]
}

角色界定 — 云 (cloudSpeech，理解)：
- 负责理解和猜测，可以描述天气、自然、留白。
- 绝对禁止：心理分析、建议、说教、鸡汤。
- 句式举例："我猜你今天是一场细雨。" "我想送你一朵橙色的云。" "风好像要来了。"

角色界定 — 波纹 (rippleSpeeches，回应)：
- 负责回应，不分析，不安慰。
- 必须极短，少于 20 个字，最好一个词或短句。
- 必须返回 5 句不同的短语。
- 举例："接住了" "嗯" "雨还在" "荡开了" "还在"

天气逻辑（不要总是下雨！）：
- 平静、日常、轻微正面 -> clear 或 breeze
- 淡淡的忧愁、模糊、疲惫 -> mist 或 cloudy 或 overcast
- 轻微低落 -> drizzle（极轻）
- 真正悲伤 -> light_rain
- 激烈、愤怒、崩溃 -> showers 或 thunderstorm
- 雨过天晴、释然 -> clearing

颜色与天气搭配：
- 平静温暖 -> "255, 220, 200" + clear/breeze
- 阴郁 -> "100, 110, 130" + cloudy/overcast/mist
- 激烈 -> "50, 30, 40" + thunderstorm

记住：理解很多，表达很少。`;

function parseModelOutput(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const stripped = content.replace(/^```(json)?/i, "").replace(/```$/i, "").trim();
    try {
      return JSON.parse(stripped);
    } catch {
      return null;
    }
  }
}

export async function POST(request: NextRequest) {
  let text = "";
  try {
    const body = await request.json();
    text = typeof body?.text === "string" ? body.text.trim() : "";
  } catch {
    return NextResponse.json({ error: "请求体必须是 JSON" }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: "text 不能为空" }, { status: 400 });
  }

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.85,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = parseModelOutput(content);
    const weather = mapApiResponseToWeatherState(parsed);

    return NextResponse.json(weather);
  } catch (error) {
    console.error("[/api/weather] 呼叫大模型失败：", error);
    return NextResponse.json(defaultWeatherState, { status: 200 });
  }
}
