module.exports = async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
        const event = req.body.events?.[0];

        if (!event || !event.message) {
            return res.status(200).end();
        }

        const msg = event.message.text || "";
        const replyToken = event.replyToken;

        console.log("USER:", msg);

        // ===== 呼叫 Gemini =====
        const replyText = await askGemini(msg);

        // ===== 回覆 LINE =====
        await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                replyToken,
                messages: [
                    {
                        type: "text",
                        text: replyText
                    }
                ]
            })
        });

        console.log("✅ REPLY SENT");

    } catch (err) {
        console.log("❌ WEBHOOK ERROR:", err);
    }

    return res.status(200).end();
};


// ============================
// 🤖 Gemini Function
// ============================
async function askGemini(message) {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `
你是一個LINE健康助理AI。

請用超簡短、口語繁體中文回答（像LINE聊天）。

規則：
- 最多6行
- 不要長文
- 不要醫療論文
- 直接重點

格式：

💡可能原因：一句話
🩺建議：一句話 + 1~2做法
⚠️就醫判斷：一句話

症狀：${message}
`
                                }
                            ]
                        }
                    ]
                })
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.log("❌ GEMINI HTTP ERROR:", errText);
            return "AI服務異常，請稍後再試";
        }

        const data = await res.json();

        console.log("🔥 GEMINI RAW:", JSON.stringify(data));

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return "AI暫時無法回應";
        }

        return text;

    } catch (err) {
        console.log("❌ GEMINI ERROR:", err);
        return "AI系統錯誤";
    }
}
