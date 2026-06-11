const admin = require("firebase-admin");

// =========================
// 🔥 Firebase Init（防重複 + 防 JSON 錯）
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
// 🚀 SAFE FIREBASE QUERY（完全不吃 index）
// =========================
async function safeGetHealthLogs(db, userId, limit = 5) {
    try {
        const snapshot = await db.collection("health_logs")
            .where("userId", "==", userId)
            .get();

        let list = [];

        snapshot.forEach(doc => {
            const d = doc.data();

            list.push({
                message: d.message || "（無內容）",
                timestamp: typeof d.timestamp === "number"
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
        console.log("❌ FIREBASE ERROR:", err.message);
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

        console.log("USER MSG:", msg);

        let replyText = "";

        // =========================
        // 🧠 判斷查詢
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
        // 🤖 AI 模式（寫入 Firebase）
        // =========================
        else {
            replyText = await askGemini(msg);

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
        // 📩 LINE REPLY（保護）
        // =========================
        if (!replyText) replyText = "⚠️ 系統暫時無回應";

        const lineRes = await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                replyToken,
                messages: [{
                    type: "text",
                    text: replyText.slice(0, 1800)
                }]
            })
        });

        console.log("📡 LINE STATUS:", lineRes.status);

    } catch (err) {
        console.log("❌ WEBHOOK ERROR:", err.message);
    }

    return res.status(200).end();
};

// =========================
// 🤖 GEMINI（穩定 + debug 版）
// =========================
async function askGemini(message) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `
你是一個LINE健康助理AI。

請用繁體中文、超簡短回答：

💡可能原因：一句話
🩺建議：一句話
⚠️就醫判斷：一句話

症狀：${message}
`
                    }]
                }]
            })
        });

        const data = await res.json();

        // 🔥 一定要看得到錯誤
        console.log("🔥 GEMINI RESPONSE:", JSON.stringify(data));

        if (data.error) {
            return "❌ Gemini錯誤：" + data.error.message;
        }

        const text =
            data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            console.log("❌ NO TEXT:", data);
            return "❌ AI沒有回應內容";
        }

        return text;

    } catch (err) {
        console.log("❌ GEMINI ERROR:", err.message);
        return "❌ AI請求失敗";
    }
}
