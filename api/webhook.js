const dialogflow = require("@google-cloud/dialogflow");
const fetch = require("node-fetch");
const { v4: uuidv4 } = require("uuid");

const projectId = "newagent-nuxi";

const sessionClient = new dialogflow.SessionsClient({
    credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
});

module.exports = async (req, res) => {

    const event = req.body.events?.[0];
    const msg = event.message.text;
    const replyToken = event.replyToken;

    const sessionId = uuidv4();
    const sessionPath = sessionClient.projectAgentSessionPath(
        projectId,
        sessionId
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

    const replyText =
        response.queryResult.fulfillmentText ||
        "我還在學習你的症狀";

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
