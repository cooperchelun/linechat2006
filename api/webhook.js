const admin = require("firebase-admin");

// =========================
// 🔥 Firebase Init（防重複）
// =========================
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log("🔥 Firebase INIT OK");
    } catch (err) {
        console.log("❌ Firebase INIT ERROR:", err);
    }
}

const db = admin.firestore();

// =========================
// 🚀 WEBHOOK
// =========================
module.exports = async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
        const event = req.body.events?.[0];
        if (!event || !event.message) return res.status(200).end();

        const msg = (event.message.text || "").trim();
        const userId = event.source?.userId || "unknown";
        const replyToken = event.replyToken;

        console.log("USER:", msg);

        let replyText = "";

        // =========================
        // 🧠 ROUTER（穩定版）
        // =========================
        const isQuery = /紀錄|查詢|查看|歷史|我的紀錄/.test(msg);

        // =========================
        // 📊 Firebase 查詢
        // =========================
        if (isQuery) {

            console.log("📊 FIREBASE QUERY MODE");

            try {
                const snapshot = await db.collection("health_logs")
                    .where("userId", "==", userId)
                    .orderBy("timestamp", "desc")
                    .limit(5)
                    .get();

                if (snapshot.empty) {
                    replyText = "📭 目前沒有健康紀錄";
                } else {
                    let list = "📋 最近紀錄：\n";
                    let i = 1;

                    snapshot.forEach(doc => {
                        const data = doc.data();
                        list += `${i}. ${data.message}\n`;
                        i++;
                    });

                    replyText = list;
                }

            } catch (err) {
                console.log("❌ FIREBASE ERROR:", err);
                replyText = "⚠️ 查詢失敗，請稍後再試";
            }
        }

        // =========================
        // 🤖 Gemini（症狀）
        // =========================
        else {
            replyText = await askGemini(msg);

            // 💾 存 Firebase（只有症狀）
            try {
                await db.collection("health_logs").add({
                    userId,
                    message: msg,
                    reply: replyText,
                    timestamp: Date.now()
                });

                console.log("✅ SAVED");
            } catch (err) {
                console.log("❌ SAVE ERROR:", err);
            }
        }

        // =========================
        // 📩 LINE Reply（保護版）
        // =========================
        if (!replyText || replyText.trim() === "") {
            replyText = "⚠️ 系統暫時沒有回應";
        }

        console.log("📩 REPLY:", replyText);

        const lineRes = await fetch("https://api.line.me/v2/bot/message/reply", {
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

        console.log("📡 LINE STATUS:", lineRes.status);

    } catch (err) {
        console.log("❌ WEBHOOK ERROR:", err);
    }

    return res.status(200).end();
};

// =========================
// 🤖 Gemini
// =========================
async function askGemini(message) {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
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
            }
        );

        const data = await res.json();

        return data?.candidates?.[0]?.content?.parts?.[0]?.text
            || "AI暫時無法回應";

    } catch (err) {
        console.log("❌ GEMINI ERROR:", err);
        return "AI錯誤，請稍後再試";
    }
}
