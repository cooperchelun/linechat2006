module.exports = async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

    try {
        const event = req.body.events?.[0];

        if (!event) {
            console.log("❌ NO EVENT");
            return res.status(200).end();
        }

        const msg = event.message?.text || "";
        const replyToken = event.replyToken;

        console.log("USER MSG:", msg);

        let replyText = "收到：" + msg;

        // 👉 最簡單測試（先不要 Gemini / Firebase）
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
