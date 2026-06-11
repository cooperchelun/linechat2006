const fetch = require("node-fetch");

module.exports = async (req, res) => {

    const event = req.body.events?.[0];
    const msg = event.message.text;
    const replyToken = event.replyToken;

    let replyText = "";

    // 🧠 症狀判斷（核心邏輯）
    if (msg.includes("發燒") && msg.includes("喉嚨痛")) {
        replyText = "可能是：流感或上呼吸道感染\n建議：多休息、多喝水";
    }
    else if (msg.includes("頭痛")) {
        replyText = "可能原因：壓力、睡眠不足或偏頭痛\n建議：休息與補充水分";
    }
    else if (msg.includes("肚子痛")) {
        replyText = "可能是腸胃不適\n建議：避免油膩食物，多休息";
    }
    else {
        replyText = "我正在學習你的症狀，可以描述更詳細一點嗎？";
    }

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
};
