module.exports = async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
        const event = req.body.events?.[0];

        if (!event) {
            return res.status(200).end();
        }

        const msg = event.message?.text || "no message";
        const replyToken = event.replyToken;

        console.log("USER:", msg);

        // 👉 直接回覆（測試用）
        const replyText = "收到：" + msg;

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

        console.log("✅ REPLY OK");

    } catch (err) {
        console.log("❌ ERROR:", err);
    }

    return res.status(200).end();
};
