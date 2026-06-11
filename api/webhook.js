const fetch = require("node-fetch");
const admin = require("firebase-admin");

console.log("🔥 FILE LOADED");

// ---------------- Firebase 初始化 ----------------
let db = null;

try {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        console.log("🔥 Firebase INIT OK");
    }

    db = admin.firestore();

} catch (err) {
    console.log("❌ FIREBASE INIT FAILED:");
    console.log(err);
}

module.exports = async (req, res) => {

    console.log("🔥 WEBHOOK HIT");

    try {

        const event = req.body.events?.[0];
        if (!event) return res.status(200).end();

        const msg = event.message.text;
        const replyToken = event.replyToken;
        const userId = event.source.userId;

        console.log("USER:", msg);

        // ---------------- Firebase 寫入 ----------------
        if (db) {
            try {
                await db.collection("health_logs").add({
                    userId,
                    message: msg,
                    timestamp: Date.now()
                });

                console.log("🔥 FIREBASE WRITE OK");

            } catch (err) {
                console.log("❌ FIREBASE WRITE ERROR:");
                console.log(err);
            }
        } else {
            console.log("⚠️ DB is NULL (Firebase not ready)");
        }

        // ---------------- LINE reply ----------------
        const result = await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                replyToken,
                messages: [
                    { type: "text", text: "收到：" + msg }
                ]
            })
        });

        console.log("LINE STATUS:", result.status);

    } catch (err) {
        console.log("❌ GLOBAL ERROR:");
        console.log(err);
    }

    return res.status(200).end();
};
