const fetch = require("node-fetch");

module.exports = async (req, res) => {

    if (req.method === "GET") {
        return res.status(200).json({
            message: "Line健指部 API 運作中"
        });
    }

    if (req.method === "POST") {

        const events = req.body.events;

        if (!events || events.length === 0) {
            return res.status(200).end();
        }

        const event = events[0];

        const userMessage = event.message.text;
        const replyToken = event.replyToken;

        // 回覆 LINE
        await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                replyToken: replyToken,
                messages: [
                    {
                        type: "text",
                        text: `你說的是：${userMessage}`
                    }
                ]
            })
        });

        return res.status(200).end();
    }
};
