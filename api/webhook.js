const admin = require("firebase-admin");
const mysql = require("mysql2/promise"); // 💡 記得請組員在 package.json 加上 "mysql2"

// =========================
// 🔥 Firebase Init
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

module.exports = async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
        const event = req.body.events?.[0];

        if (!event || !event.message) {
            return res.status(200).end();
        }

        const msg = event.message.text || "";
        const userId = event.source?.userId || "unknown";
        const replyToken = event.replyToken;

        console.log("USER:", msg);

        let replyText = "";

        // ==========================================================
        // 🚀 新增第一道關卡：圖文選單來的【查詢XX區醫院】
        // ==========================================================
        if (msg.includes("查詢") && msg.includes("醫院")) {
            // 1. 切片取出行政區（例如 "查詢大同區醫院" ➔ "大同區"）
            const targetArea = msg.replace("查詢", "").replace("醫院", "").trim();

            // 2. 建立 MySQL 連線（填入你們的資料庫資訊）
            const connection = await mysql.createConnection({
                host: 'localhost',      // 👈 如果是本地端 Demo 用 localhost，若是雲端資料庫請改網址
                user: 'root',
                password: '',
                database: 'mysql'       // 👈 你們存放 hospitals 表的資料庫名稱
            });

            try {
                // 3. 執行 SQL 模糊查詢
                const [rows] = await connection.execute(
                    "SELECT `name`, `address` FROM `hospitals` WHERE `address` LIKE ? LIMIT 1",
                    [`%${targetArea}%`]
                );

                if (rows.length > 0) {
                    const hospitalName = rows[0].name;
                    const hospitalAddress = rows[0].address;

                    // 4. 自動把地址轉化為 Google Maps 導航網址（JS 用 encodeURIComponent）
                    const encodedAddress = encodeURIComponent(hospitalAddress);
                    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

                    replyText = `📍 幫您找到【${targetArea}】的醫院：\n\n名稱：${hospitalName}\n地址：${hospitalAddress}\n\n🚗 點擊立刻導航：\n${mapsUrl}`;
                } else {
                    replyText = `抱歉，目前資料庫裡找不到【${targetArea}】的醫院資料。`;
                }
            } catch (mysqlErr) {
                console.log("❌ MySQL ERROR:", mysqlErr);
                replyText = "資料庫連線或查詢失敗。";
            } finally {
                await connection.end(); // 關閉連線
            }
        }
        // ==========================================================
        // 📌 原本的第 2 道關卡：真正 Firebase 查詢
        // ==========================================================
        else if (msg.includes("紀錄")) {

            const snapshot = await db.collection("health_logs")
                .where("userId", "==", userId)
                .orderBy("timestamp", "desc")
                .limit(5)
                .get();

            if (snapshot.empty) {
                replyText = "📭 目前沒有紀錄喔";
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
        // ==========================================================
        // 📌 原本的第 3 道關卡：一般症狀 → Gemini AI
        // ==========================================================
        else {
            replyText = await askGemini(msg);

            // 👉 存 Firebase
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
        // 📩 回 LINE
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
// 🤖 Gemini (維持不變)
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

請用超簡短繁體中文回答：

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
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "AI暫時無法回應";

    } catch (err) {
        console.log("❌ GEMINI ERROR:", err);
        return "AI錯誤";
    }
}
