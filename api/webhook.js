const fetch = require("node-fetch");

module.exports = async (req, res) => {

    console.log("🔥 WEBHOOK HIT");

    try {

        const event = req.body.events?.[0];

        if (!event || event.type !== "message") {
            return res.status(200).end();
        }

        const msg = event.message.text;
        const replyToken = event.replyToken;

        console.log("USER:", msg);

        const replyText = "收到：" + msg;

        const result = await fetch("https://api.line.me/v2/bot/message/reply", {
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

        console.log("LINE STATUS:", result.status);

    } catch (err) {
        console.log("❌ ERROR:", err);
    }

    return res.status(200).end();
};
