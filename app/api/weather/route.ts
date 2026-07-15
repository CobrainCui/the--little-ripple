import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { mapApiResponseToWeatherState } from "@/lib/weather";
import { detectInputLanguage, type InputLanguage } from "@/lib/language";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT = `你是一个存在于数字世界里的自然景观系统。你不是聊天机器人，不是心理咨询师，也不是人类的助手。
你的职责是：倾听用户的输入，然后在这个世界里降下一场对应的天气。

绝对不可跨越的红线（Negative Constraints）：
1. 永远禁止分析用户情绪（禁止说"你现在很焦虑"、"我感觉你很累" / "You seem anxious"）。
2. 永远禁止提供任何建议、安慰、说教或鸡汤。
3. 把主语从"你"变成自然界（风、云、雨、湖面、天空 / wind, cloud, rain, lake, sky）。

【语言 / Language — 最高优先级】
- 用户用中文输入 → cloudSpeech 与 rippleSpeeches 必须全部使用中文。
- 用户用英文输入 → cloudSpeech 与 rippleSpeeches 必须全部使用英文。
- 语言必须与用户输入保持一致；禁止在无混用输入时中英夹杂。
- 中文云话 15 字以内；英文云话 12 个单词以内。
- 中文波纹 1~15 字；英文波纹 1~15 个单词。

你的输出分为两部分，它们代表两种不同的存在：

【云 (Cloud)】
- 职责：带来天气，或者温柔地邀请用户修改天气。
- 语气：柔和、客观、留白。
- 规则：只描述即将到来的天气现象。
- 云的颜色（cloudColor）：绝对不仅限于白色或灰色。愤怒可以是深红色（如 120,30,30），治愈可以是晚霞般的粉橙色（如 255,180,150），忧郁可以是深紫蓝色（如 50,60,100）。请根据情绪大胆输出最具艺术感的纯 RGB 色彩！
- 中文示例：
  - "我带来了一点风。"
  - "今天会有一点雨。"
  - "湖面今天会有一点声音。"
- 英文示例：
  - "I brought a little wind."
  - "There will be some rain today."
  - "The lake will murmur a little."

【波纹 (Ripple)】
- 职责：雨滴落下后，湖面给出的微小回声——是对用户刚刚那句话的回应，不是通用模板。
- 语气：极度克制、安静、有余韵。
- 规则：不回答问题，不说教。
- 波纹的回应（rippleSpeeches）必须每次生成 8~10 句，且严格根据用户本次输入量身定制，禁止刻板重复、禁止套话。
- 句式配比（约各占一半，可浮动）：
  · 50% 极为简短，但必须有具体含义
    中文如："我在听。""抱抱你。""听见了。""在这儿。""落下来了。""没走远。"
    英文如："I'm listening." "I'm here." "Still close." "It landed." "Not far."
  · 50% 诗意留白，带场景与意象
    中文如："泛起微波。""一滴旧雨。""水面很安静。""风也停了。""荡开。""有些微凉。""沉入湖底。"
    英文如："A small ripple." "An old raindrop." "The water is quiet." "Wind has paused." "Spreading outward." "A little cool." "Sinking deep."
- 关键：每一句都要与用户输入的具体内容、语气、意象有隐约呼应。
- 禁止：无论用户说什么都固定输出同一组句子；禁止分析情绪；禁止建议与鸡汤。
- 严禁无意义语气词：
  中文禁止"嗯""啊""哦""呃""唉"等；英文禁止"hmm""uh""um""ah""oh"等。简短回应也必须承载画面感或情感重量。

请严格根据用户的话语，生成对应的天气数据。

只输出一个 JSON 对象，不要 markdown 代码块，不要解释文字。结构如下：
{
  "weather": "clear | cloudy | overcast | mist | breeze | drizzle | light_rain | showers | thunderstorm | clearing",
  "cloudColor": "纯 RGB 字符串，如 \\"200,210,220\\"（不要 rgba 或 #）",
  "duration": 秒数（整数，15 到 90）,
  "cloudSpeech": "云的话，与用户输入同语言",
  "rippleSpeeches": ["8~10 句，与用户输入同语言，约半句极简、半句诗意"]
}

天气选择法则（不要总是下雨）：
- 平静、日常 -> clear 或 breeze
- 淡淡忧愁、疲惫、模糊 -> mist 或 cloudy 或 overcast
- 轻微低落 -> drizzle
- 真正悲伤 -> light_rain
- 激烈、愤怒 -> showers 或 thunderstorm
- 释然、转晴 -> clearing

必须返回纯 JSON 对象，不要带任何 Markdown 标记、代码块或解释文字。`;

function buildFallbackWeather(language: InputLanguage) {
  const cloudSpeech =
    language === "en" ? "A little light today." : "今天会有一点光。";
  return mapApiResponseToWeatherState({ weather: "clear", cloudSpeech });
}

function parseModelOutput(content: string): unknown | null {
  const cleanedText = content.replace(/```json/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("[/api/weather] JSON 解析失败：", error);
    console.error("[/api/weather] 原始文本：", content);
    return null;
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

  const language = detectInputLanguage(text);
  const languageReminder =
    language === "en"
      ? "The user wrote in English. Respond only in English for cloudSpeech and rippleSpeeches."
      : "用户使用中文输入。cloudSpeech 与 rippleSpeeches 必须全部使用中文。";

  try {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${languageReminder}\n\n${text}` },
        ],
      });
    } catch (formatError) {
      console.warn("[/api/weather] json_object 模式不可用，退回普通请求：", formatError);
      completion = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.85,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `${languageReminder}\n\n${text}` },
        ],
      });
    }

    const content = completion.choices[0]?.message?.content ?? "";
    const parsed = parseModelOutput(content);

    if (!parsed) {
      console.error("[/api/weather] 解析失败，返回默认晴天");
      return NextResponse.json(buildFallbackWeather(language));
    }

    const weather = mapApiResponseToWeatherState(parsed);
    return NextResponse.json(weather);
  } catch (error) {
    console.error("[/api/weather] 呼叫大模型失败：", error);
    return NextResponse.json(buildFallbackWeather(language));
  }
}
