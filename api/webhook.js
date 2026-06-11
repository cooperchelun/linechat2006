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

// ================= Gemini AI =================
async function askGemini(message) {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `你是健康助理，分析症狀：${message}`
                                }
                            ]
                        }
                    ]
                })
            }
        );

        const data = await res.json();

        console.log("🔥 GEMINI RAW RESPONSE:", JSON.stringify(data, null, 2));

        if (data.error) {
            return "❌ Gemini API錯誤：" + data.error.message;
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return "❌ Gemini沒有回傳內容（可能被擋或API失敗）";
        }

        return text;

    } catch (err) {
        console.log("❌ GEMINI ERROR:", err);
        return "❌ Gemini請求失敗";
    }
}

// ================= 主 webhook =================
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

    // ================= 說明 / hi =================
    if (msg.includes("hi") || msg.includes("說明")) {

        replyText =
`歡迎使用「Line健指部｜健康AI助理」

📌 功能：
1. 症狀分析
2. 健康建議
3. 個人紀錄查詢

⚠️ 本系統僅供健康參考，不是醫療診斷

輸入症狀即可開始使用，例如：
👉 我發燒
👉 頭痛`;

    }

    // ================= 查詢紀錄 =================
    else if (msg.includes("我的紀錄")) {

        try {
            const snapshot = await db.collection("health_logs").get();

            let docs = [];

            snapshot.forEach(doc => {
                const d = doc.data();
                if (d.userId === userId) {
                    docs.push(d);
                }
            });

            docs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            docs = docs.slice(0, 5);

            if (docs.length === 0) {
                replyText = "目前沒有健康紀錄喔～";
            } else {
                replyText = "📊 最近健康紀錄：\n\n";
                docs.forEach((d, i) => {
                    replyText += `${i + 1}. ${d.message}（${d.risk || "無"}）\n`;
                });
            }

        } catch (err) {
            console.log("❌ QUERY ERROR:", err);
            replyText = "查詢失敗，請稍後再試";
        }
    }

    // ================= Gemini AI 分析 =================
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

            console.log("🔥 FIREBASE WRITE OK");

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
