const fetch = require("node-fetch");
const admin = require("firebase-admin");

// ================= Firebase 初始化 =================
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(
                JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            )
        });
        console.log("🔥 Firebase INIT OK");
    } catch (err) {
        console.log("❌ Firebase INIT ERROR:", err);
    }
}

const db = admin.firestore();

// ================= Gemini 設定 =================
const GEMINI_MODEL = "models/gemini-2.5-flash";

async function askGemini(message) {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `
你是一個健康助理（非醫療診斷），請用繁體中文回答：

請提供：
1. 可能原因（簡短）
2. 建議處理方式
3. 是否需要就醫判斷

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

        console.log("🔥 GEMINI RESPONSE:", JSON.stringify(data));

        if (data.error) {
            return "❌ Gemini錯誤：" + data.error.message;
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return "❌ AI沒有回傳內容（請稍後再試）";
        }

        return text;

    } catch (err) {
        console.log("❌ GEMINI ERROR:", err);
        return "❌ AI系統錯誤，請稍後再試";
    }
}

// ================= LINE Webhook =================
module.exports = async (req, res) => {

    console.log("🔥 WEBHOOK HIT");

    const event = req.body.events?.[0];
    if (!event || event.type !== "message") {
        return res.status(200).end();
    }

    const msg = event.message.text;
    const replyToken = event.replyToken;
    const userId = event.source.userId;

    console.log("USER:", msg);

    let replyText = "";

    // ================= hi / 說明 =================
    if (msg.includes("hi") || msg.includes("說明")) {

        replyText =
`👋 歡迎使用健康AI助理

功能：
1. 症狀分析
2. 健康建議
3. 紀錄查詢

輸入例如：
👉 我發燒
👉 頭痛`;
    }

    // ================= 查詢紀錄 =================
    else if (msg.includes("我的紀錄")) {

        try {
            const snapshot = await db.collection("health_logs").get();

            let list = [];

            snapshot.forEach(doc => {
                const d = doc.data();
                if (d.userId === userId) {
                    list.push(d);
                }
            });

            list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            list = list.slice(0, 5);

            if (list.length === 0) {
                replyText = "目前沒有紀錄";
            } else {
                replyText = "📊 最近紀錄：\n\n";
                list.forEach((d, i) => {
                    replyText += `${i + 1}. ${d.message}\n`;
                });
            }

        } catch (err) {
            console.log("❌ FIREBASE QUERY ERROR:", err);
            replyText = "查詢失敗，請稍後再試";
        }
    }

    // ================= Gemini 分析 =================
    else {

        replyText = await askGemini(msg);

        // 存 Firebase
        try {
            await db.collection("health_logs").add({
                userId,
                message: msg,
                aiReply: replyText,
                timestamp: Date.now()
            });

            console.log("🔥 FIREBASE SAVE OK");

        } catch (err) {
            console.log("❌ FIREBASE WRITE ERROR:", err);
        }
    }

    // ================= LINE 回覆 =================
    try {
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
    } catch (err) {
        console.log("❌ LINE REPLY ERROR:", err);
    }

    return res.status(200).end();
};
