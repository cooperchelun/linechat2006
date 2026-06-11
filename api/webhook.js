const admin = require("firebase-admin");

// =========================
// 🔥 Firebase Init（穩定版）
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
// 🚀 MAIN WEBHOOK
// =========================
module.exports = async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
        const event = req.body.events?.[0];
        if (!event || !event.message) return res.status(200).end();

        const msg = (event.message.text || "").trim();
        const userId = event.source?.userId || "unknown";
        const replyToken = event.replyToken;

        console.log("USER MSG:", msg);

        let replyText = "";

        // =========================
        // 🧠 1. ROUTER（超重要）
        // =========================
        const isQuery = /紀錄|查詢|查看|歷史|我的紀錄/.test(msg);

        // =========================
        // 📌 2. Firebase 查詢（最高優先）
        // =========================
        if (isQuery) {

            console.log("📊 FIREBASE QUERY MODE");

            const snapshot = await db.collection("health_logs")
                .where("userId", "==", userId)
                .orderBy("timestamp", "desc")
                .limit(5)
                .get();

            if (snapshot.empty) {
                replyText = "📭 你還沒有健康紀錄喔";
            } else {
                let list = "📋 你的最近紀錄：\n";

                let i = 1;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    list += `${i}. ${data.message}\n`;
                    i++;
                });

                replyText = list;
            }
        }

        // =========================
        // 🤖 3. Gemini（症狀 + 一般）
        // =========================
        else {

            replyText = await askGemini(msg);

            // 💾 存 Firebase（只存症狀）
            try {
                await db.collection("health_logs").add({
                    userId,
                    message: msg,
                    reply: replyText,
                    timestamp: Date.now()
                });

                console.log("✅ SAVED TO FIREBASE");
            } catch (err) {
                console.log("❌ SAVE ERROR:", err);
            }
        }

        // =========================
        // 📩 LINE 回覆
        // =========================
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


// =========================
// 🤖 Gemini（穩定健康版）
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
你是一個LINE健康助理。

請用繁體中文、超簡短回答：

格式：
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
