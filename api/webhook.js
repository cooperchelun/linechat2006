const fetch = require("node-fetch");

module.exports = async (req, res) => {

    if (req.method === "POST") {

        const event = req.body.events[0];
        const msg = event.message.text;
        const replyToken = event.replyToken;

        let replyText = "";

        // 🧠 簡單症狀判斷
        if (msg.includes("發燒") && msg.includes("喉嚨痛")) {
            replyText = "可能是：流感或上呼吸道感染\n建議：多休息、多喝水";
        }
        else if (msg.includes("頭痛")) {
            replyText = "可能原因：壓力、睡眠不足或偏頭痛\n建議：休息與補充水分";
        }
        else {
            replyText = "我還在學習這個症狀，可以描述更詳細嗎？";
        }

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
    }
};
