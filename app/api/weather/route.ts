import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { mapApiResponseToWeatherState } from "@/lib/weather";
import { detectInputLanguage, type InputLanguage } from "@/lib/language";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

const MODEL = process.env.OPENAI_MODEL || "deepseek/deepseek-v4-pro-202606";

const GRACEFUL_FALLBACK = {
  weather: "breeze",
  cloudColor: "220, 230, 240",
  duration: 60,
  cloudSpeech: "云朵刚才走神了，给你带来了一阵微风。",
  rippleSpeeches: [
    "我听见了。",
    "我就在这里。",
    "这朵云携带着很重的阴影。",
    "有些雨，不需要马上停。",
    "可以在这里待一会儿。",
    "不急着让天空放晴。",
  ],
} as const;

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
- 中文波纹每句 1~25 字；英文波纹每句 1~20 个单词。

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

【波纹 — 三段式线性叙事】
- 职责：雨滴落下后，湖面给出的微小回声——是对用户刚刚那句话的回应，不是通用模板。
- 语气：极度克制、安静、有余韵。不回答问题，不说教。
- rippleSpeeches 必须是一个包含 **3 到 8 句话** 的数组，严格按以下**三段式情绪递进**顺序生成，前后须具有诗意的连贯性：
  · **阶段一：存在确认（1~2 句）**
    必须明确使用波纹的**第一人称（"我" / "I"）**向用户表示接纳和倾听。语气轻盈、笃定、温柔。
    句子要清晰、可感；每次必须用**全新措辞**，禁止复读固定套句。
  · **阶段二：情绪映射（1~3 句）**
    把用户话语中的意象与情绪，倒影在天气、云、雨、风、湖面等自然现象上，可稍长，绝不直接分析或点名用户情绪。
    每次须根据本次输入**自由创作**，意象与句式都要变化。
  · **阶段三：陪伴邀请（1~2 句）**
    提示互动即将结束，留下余韵；不催促、不说教。措辞须随本次输入而变，保持新鲜。
- **创作自由度（极重要）**：
  · 下文若出现任何「示例句」，仅用于说明**结构与前后的语气方向**，绝不是可照搬的模板。
  · 严禁直接复制、改写示例句，或每次输出高度相似的句子组合。
  · 你必须像一位沉默的诗人，针对用户**这一句**即兴写出独一无二的 3~8 句短诗；用词、意象、节奏均可大胆发挥，只要遵守三段式顺序与红线即可。
- **展示机制**：用户每点击水面一次，按数组顺序展示下一句。三阶段之间须像一首渐次展开的诗，语义自然衔接。
- 严格根据用户本次输入量身定制；禁止刻板重复、禁止套话、禁止分析情绪、禁止建议与鸡汤。
- 严禁无意义语气词：
  中文禁止"嗯""啊""哦""呃""唉"等；英文禁止"hmm""uh""um""ah""oh"等。

请严格根据用户的话语，生成对应的天气数据。

只输出一个 JSON 对象，不要 markdown 代码块，不要解释文字。结构如下：
{
  "weather": "clear | cloudy | overcast | mist | breeze | drizzle | light_rain | showers | thunderstorm | clearing",
  "cloudColor": "纯 RGB 字符串，如 \\"200,210,220\\"（不要 rgba 或 #）",
  "duration": 秒数（整数，15 到 90）,
  "cloudSpeech": "云的话，与用户输入同语言",
  "rippleSpeeches": ["3~8 句，与用户输入同语言，严格按三段式叙事顺序排列"]
}

天气选择法则（不要总是下雨）：
- 平静、日常 -> clear 或 breeze
- 淡淡忧愁、疲惫、模糊 -> mist 或 cloudy 或 overcast
- 轻微低落 -> drizzle
- 真正悲伤 -> light_rain
- 激烈、愤怒 -> showers 或 thunderstorm
- 释然、转晴 -> clearing

必须返回纯 JSON 对象，不要带任何 Markdown 标记、代码块或解释文字。`;

function buildGracefulFallback() {
  return mapApiResponseToWeatherState(GRACEFUL_FALLBACK);
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
      console.error("[/api/weather] 解析失败，返回微风兜底");
      return NextResponse.json(buildGracefulFallback());
    }

    const weather = mapApiResponseToWeatherState(parsed);
    return NextResponse.json(weather);
  } catch (error) {
    console.error("[Weather API Error]:", error);
    return NextResponse.json(buildGracefulFallback());
  }
}
