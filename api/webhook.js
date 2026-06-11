const fetch = require("node-fetch");

module.exports = async (req, res) => {

    console.log("🔥 WEBHOOK HIT");

    const event = req.body.events?.[0];

    if (!event) return res.status(200).end();

    const msg = event.message.text;
    const replyToken = event.replyToken;

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

    console.log("TOKEN EXISTS?", !!token);

    const replyText = "收到：" + msg;

    const result = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
            replyToken,
            messages: [{ type: "text", text: replyText }]
        })
    });

    const data = await result.text();

    console.log("LINE RESPONSE STATUS:", result.status);
    console.log("LINE RESPONSE:", data);

    return res.status(200).end();
};
