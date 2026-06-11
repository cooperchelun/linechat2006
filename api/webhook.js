const dialogflow = require("@google-cloud/dialogflow");
const fetch = require("node-fetch");

const projectId = "你的PROJECT_ID";

const sessionClient = new dialogflow.SessionsClient({
    credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
});

module.exports = async (req, res) => {

    if (req.method !== "POST") return res.status(200).end();

    const event = req.body.events[0];
    const msg = event.message.text;
    const replyToken = event.replyToken;

    // 👉 Dialogflow session
    const sessionPath = sessionClient.projectAgentSessionPath(
        projectId,
        "123456"
    );

    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: msg,
                languageCode: "zh-TW"
            }
        }
    };

    const [response] = await sessionClient.detectIntent(request);

    const result = response.queryResult.fulfillmentText;

    // 👉 回 LINE
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
                    text: result || "我還在學習中"
                }
            ]
        })
    });

    return res.status(200).end();
};
