const fetch = require("node-fetch");
const admin = require("firebase-admin");

// 初始化 Firebase（只會跑一次）
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
    let risk = "🟢 低風險";

    // ---------------- AI 判斷 ----------------
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
        risk = "🟢 低風險";
        replyText = "請描述更詳細症狀";
    }

    // ---------------- 存 Firebase ----------------
    try {
        await db.collection("health_logs").add({
            userId,
            message: msg,
            risk,
            result: replyText,
            timestamp: Date.now()
        });

        console.log("🔥 已寫入 Firebase");
    } catch (err) {
        console.log("❌ Firebase error:", err);
    }

    // ---------------- 回 LINE ----------------
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
                    text: `【健康評估】${risk}\n\n${replyText}`
                }
            ]
        })
    });

    return res.status(200).end();
};
