const fetch = require("node-fetch");

module.exports = async (req, res) => {

    console.log("🔥 LINE HIT");

    try {
        const event = req.body.events?.[0];
        const msg = event.message.text;
        const replyToken = event.replyToken;

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
                        text: "收到：" + msg
                    }
                ]
            })
        });

    } catch (err) {
        console.log(err);
    }

    return res.status(200).end();
};
