const fetch = require("node-fetch");

module.exports = async (req, res) => {

    console.log("🔥 WEBHOOK HIT");

    const event = req.body.events?.[0];

    if (!event || event.type !== "message") {
        return res.status(200).end();
    }

    const msg = event.message.text;
    const replyToken = event.replyToken;

    console.log("USER MSG:", msg);

    let replyText = "";

    // 🧠 簡單AI判斷（先不要Dialogflow）
    if (msg.includes("發燒") && msg.includes("喉嚨痛")) {
        replyText = "可能是流感或上呼吸道感染\n建議多休息、多喝水";
    } else if (msg.includes("頭痛")) {
        replyText = "可能是壓力或睡眠不足\n建議休息與補水";
    } else {
        replyText = "收到：" + msg;
    }

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
                    text: replyText
                }
            ]
        })
    });

    return res.status(200).end();
};
