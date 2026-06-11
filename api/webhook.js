const fetch = require("node-fetch");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(
                JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            )
        });
        console.log("🔥 Firebase OK");
    } catch (e) {
        console.log("❌ Firebase INIT ERROR:", e.message);
    }
}

const db = admin.firestore();

module.exports = async (req, res) => {

    console.log("🔥 WEBHOOK HIT");

    const event = req.body.events?.[0];
    if (!event) return res.status(200).end();

    const msg = event.message.text;
    const replyToken = event.replyToken;
    const userId = event.source.userId;

    let replyText = "收到：" + msg;

    // ---------------- Firebase（加保護） ----------------
    try {
        await db.collection("health_logs").add({
            userId,
            message: msg,
            timestamp: Date.now()
        });

        console.log("🔥 Firebase write OK");

    } catch (err) {
        console.log("❌ Firebase WRITE ERROR:", err.message);
    }

    // ---------------- reply LINE ----------------
    await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            replyToken,
            messages: [{ type: "text", text: replyText }]
        })
    });

    return res.status(200).end();
};
