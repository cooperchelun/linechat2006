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

請用「超簡短、口語、像LINE聊天」的繁體中文回答。

規則：
- 最多 6 行
- 不要長文章
- 不要醫療論文語氣
- 不要條列太多
- 直接講重點

輸出格式固定：

💡可能原因：一句話

🩺建議：一句話 + 1~2個做法

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

        const data = await res.json();

        console.log("🔥 GEMINI RAW:", JSON.stringify(data));

        if (data.error) {
            return "AI錯誤：" + data.error.message;
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return "AI暫時沒有回應，請再試一次";
        }

        return text;

    } catch (err) {
        console.log("❌ GEMINI ERROR:", err);
        return "AI系統錯誤，請稍後再試";
    }
}
