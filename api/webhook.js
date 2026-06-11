const admin = require("firebase-admin");

// =========================
// 🔥 Firebase Init（安全版）
// =========================
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log("🔥 Firebase INIT OK");
    } catch (err) {
        console.log("❌ Firebase INIT ERROR:", err.message);
    }
}

const db = admin.firestore();

// =========================
// 🚀 SAFE QUERY（完全不吃 index）
// =========================
async function safeGetHealthLogs(db, userId, limit = 5) {
    try {
        if (!userId) return { ok: false, data: [] };

        const snapshot = await db.collection("health_logs")
            .where("userId", "==", userId)
            .get();

        let list = [];

        snapshot.forEach(doc => {
            const d = doc.data();

            list.push({
                message: d.message || "（無內容）",
                timestamp:
                    typeof d.timestamp === "number"
                        ? d.timestamp
                        : d.timestamp?.toMillis?.() || 0
            });
        });

        list.sort((a, b) => b.timestamp - a.timestamp);

        return {
            ok: true,
            data: list.slice(0, limit)
        };

    } catch (err) {
        console.log("❌ FIREBASE QUERY ERROR:", err.message);
        return { ok: false, data: [] };
    }
}

// =========================
// 🚀 WEBHOOK MAIN
// =========================
module.exports = async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
        const event = req.body.events?.[0];
        if (!event || !event.message) return res.status(200).end();

        const msg = (event.message.text || "").trim();
        const userId = event.source?.userId;
        const replyToken = event.replyToken;

        console.log("USER:", msg);

        let replyText = "";

        // =========================
        // 🧠 COMMAND 判斷
        // =========================
        const isQuery = /紀錄|查詢|查看|我的紀錄|歷史/.test(msg);

        // =========================
        // 📊 查詢模式（不寫入）
        // =========================
        if (isQuery) {

            const result = await safeGetHealthLogs(db, userId, 5);

            if (!result.ok || result.data.length === 0) {
                replyText = "📭 目前沒有健康紀錄";
            } else {
                let text = "📋 最近健康紀錄：\n";

                result.data.forEach((d, i) => {
                    text += `${i + 1}. ${d.message}\n`;
                });

                replyText = text;
            }
        }

        // =========================
        // 🤖 AI 症狀模式（寫入 Firebase）
        // =========================
        else {
            replyText = await askGemini(msg);

            // ❗ 只存「非查詢」
            try {
                await db.collection("health_logs").add({
                    userId,
                    message: msg,
                    timestamp: Date.now()
                });

                console.log("✅ SAVED");
            } catch (err) {
                console.log("❌ SAVE ERROR:", err.message);
            }
        }

        // =========================
        // 📩 LINE REPLY
        // =========================
        if (!replyText) replyText = "⚠️ 系統暫時無回應";

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
                        text: replyText.slice(0, 1800)
                    }
                ]
            })
        });

        console.log("📡 LINE REPLIED");

    } catch (err) {
        console.log("❌ WEBHOOK ERROR:", err.message);
    }

    return res.status(200).end();
};

// =========================
// 🤖 GEMINI
// =========================
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

請用繁體中文、超簡短回答：

💡可能原因：一句話
🩺建議：一句話
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

        return (
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            "AI暫時無法回應"
        );

    } catch (err) {
        console.log("❌ GEMINI ERROR:", err.message);
        return "AI錯誤，請稍後再試";
    }
}
