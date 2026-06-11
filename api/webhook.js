const fetch = require("node-fetch");
const admin = require("firebase-admin");

// Firebase 初始化（防止重複初始化）
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(
            JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        )
    });
}

const db = admin.firestore();

module.exports = async (req, res) => {

    const event = req.body.events?.[0];
    if (!event || event.type !== "message") {
        return res.status(200).end();
    }

    const msg = event.message.text;
    const replyToken = event.replyToken;
    const userId = event.source.userId;

    console.log("USER:", msg);

    let replyText = "";

    // -------------------------------
    // 🔍 查詢功能（重點）
    // -------------------------------
    if (msg.includes("我的紀錄")) {

        try {
            const snapshot = await db.collection("health_logs")
                .where("userId", "==", userId)
                .orderBy("timestamp", "desc")
                .limit(5)
                .get();

            if (snapshot.empty) {
                replyText = "目前沒有健康紀錄喔～";
            } else {
                let list = "📊 最近健康紀錄：\n";

                let index = 1;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    list += `${index}. ${data.message}\n`;
                    index++;
                });

                replyText = list;
            }

        } catch (err) {
            console.log("❌ QUERY ERROR:", err);
            replyText = "查詢失敗，請稍後再試";
        }

    }

    // -------------------------------
    // 🧠 一般症狀判斷 + 存資料
    // -------------------------------
    else {

        let risk = "🟢 低風險";

        if (msg.includes("發燒") && msg.includes("喉嚨痛")) {
            risk = "🔴 中高風險";
            replyText = "可能是流感或上呼吸道感染\n建議多休息、多喝水";
        }
        else if (msg.includes("發燒")) {
            risk = "🟠 中風險";
            replyText = "可能是病毒感染\n建議休息觀察";
        }
        else if (msg.includes("頭痛")) {
            risk = "🟡 低中風險";
            replyText = "可能是壓力或睡眠不足";
        }
        else {
            replyText = "請描述更詳細症狀";
        }

        // 存 Firebase
        try {
            await db.collection("health_logs").add({
                userId,
                message: msg,
                risk,
                timestamp: Date.now()
            });

            console.log("🔥 FIREBASE WRITE OK");

        } catch (err) {
            console.log("❌ FIREBASE ERROR:", err);
        }
    }

    // -------------------------------
    // LINE 回覆
    // -------------------------------
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

    return res.status(200).end();
};
