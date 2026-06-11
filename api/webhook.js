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
- 最多6行
- 不要長文章
- 不要醫療論文
- 不要條列太多
- 直接重點

格式：

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

        // 🚨 HTTP錯誤先抓
        if (!res.ok) {
            const errText = await res.text();
            console.log("❌ HTTP ERROR:", errText);
            return "AI服務請求失敗，請稍後再試";
        }

        const data = await res.json();

        console.log("🔥 GEMINI RAW:", JSON.stringify(data, null, 2));

        if (data.error) {
            return "AI錯誤：" + data.error.message;
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return "AI沒有回應內容（可能被安全機制擋掉）";
        }

        return text;

    } catch (err) {
        console.log("❌ GEMINI ERROR:", err);
        return "AI系統錯誤，請稍後再試";
    }
}
