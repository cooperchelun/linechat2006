const fetch = require("node-fetch");

module.exports = async (req, res) => {

    const event = req.body.events?.[0];
    if (!event || event.type !== "message") {
        return res.status(200).end();
    }

    const msg = event.message.text;
    const replyToken = event.replyToken;

    console.log("USER:", msg);

    let replyText = "";
    let level = "🟢 低風險";

    // -----------------------------
    // 🧠 症狀 AI 規則引擎
    // -----------------------------

    if (msg.includes("發燒") && msg.includes("喉嚨痛")) {
        level = "🔴 中高風險";
        replyText =
            "可能疾病：流感 / 上呼吸道感染\n" +
            "建議：多休息、多喝水、觀察體溫\n" +
            "⚠ 若持續高燒請就醫";
    }

    else if (msg.includes("發燒")) {
        level = "🟠 中風險";
        replyText =
            "可能原因：病毒感染或感冒\n" +
            "建議：補充水分、休息\n" +
            "⚠ 若超過3天未退燒請就醫";
    }

    else if (msg.includes("頭痛") && msg.includes("疲勞")) {
        level = "🟠 中風險";
        replyText =
            "可能原因：壓力過大或睡眠不足\n" +
            "建議：調整作息、減少螢幕時間";
    }

    else if (msg.includes("頭痛")) {
        level = "🟡 低中風險";
        replyText =
            "可能原因：壓力、睡眠不足或脫水\n" +
            "建議：補水與休息";
    }

    else if (msg.includes("肚子痛") || msg.includes("腹痛")) {
        level = "🟠 中風險";
        replyText =
            "可能原因：腸胃不適或飲食問題\n" +
            "建議：避免油膩食物、多休息\n" +
            "⚠ 若劇痛請就醫";
    }

    else if (msg.includes("拉肚子")) {
        level = "🟠 中風險";
        replyText =
            "可能是腸胃炎\n建議：補充水分與電解質";
    }

    else {
        level = "🟢 低風險";
        replyText =
            "我還在學習你的症狀 🤖\n" +
            "可以試著輸入：發燒、頭痛、肚子痛";
    }

    // -----------------------------
    // 📩 回覆 LINE
    // -----------------------------

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
                    text: `【健康評估】${level}\n\n${replyText}`
                }
            ]
        })
    });

    return res.status(200).end();
};
