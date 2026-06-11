const fetch = require("node-fetch");

module.exports = async (req, res) => {

    try {

        const event = req.body.events[0];
        const msg = event.message.text;
        const replyToken = event.replyToken;

        console.log("收到訊息：", msg);

        // 👉 先不接 Dialogflow，測 LINE 是否正常
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
                    { type: "text", text: replyText }
                ]
            })
        });

        return res.status(200).end();

    } catch (err) {
        console.log("ERROR:", err);
        return res.status(200).end();
    }
};
