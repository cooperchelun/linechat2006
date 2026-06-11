const fetch = require("node-fetch");
const admin = require("firebase-admin");

// ---------------- Firebase 初始化 ----------------
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(
                JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            )
        });
        console.log("🔥 Firebase INIT OK");
    } catch (err) {
        console.log("❌ FIREBASE INIT ERROR:", err);
    }
}

const db = admin.firestore();

// ---------------- 主 webhook ----------------
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

    // =========================
    // 📊 查詢「我的紀錄」
    // =========================
    if (msg.includes("我的紀錄")) {

        try {
            const snapshot = await db.collection("health_logs")
                .where("userId", "==", userId)
                .get();

            let docs = [];

            snapshot.forEach(doc => {
                docs.push(doc.data());
            });

            // 手動排序（避免 firestore orderBy 問題）
            docs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

            docs = docs.slice(0, 5);

            if (docs.length === 0) {
                replyText = "目前沒有健康紀錄喔～";
            } else {
                replyText = "📊 最近健康紀錄：\n\n";

                docs.forEach((d, i) => {
                    replyText += `${i + 1}. ${d.message}（${d.risk || "無風險"}）\n`;
                });
            }

        } catch (err) {
            console.log("❌ QUERY ERROR:", err);
            replyText = "查詢失敗，請稍後再試";
        }
    }

    // =========================
    // 🧠 症狀判斷 + 存資料
    // =========================
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
            replyText = "請描述更詳細症狀（例如：發燒、頭痛、喉嚨痛）";
        }

        // 存 Firebase
        try {
            await db.collection("health_logs").add({
                userId: userId,
                message: msg,
                risk: risk,
                timestamp: Date.now() // int64 OK
            });

            console.log("🔥 FIREBASE WRITE OK");

        } catch (err) {
            console.log("❌ FIREBASE WRITE ERROR:", err);
        }
    }

    // =========================
    // LINE 回覆
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

    return res.status(200).end();
};
