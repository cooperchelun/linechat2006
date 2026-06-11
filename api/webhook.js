const dialogflow = require("@google-cloud/dialogflow");
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");

const projectId = "newagent-nuxi";

const sessionClient = new dialogflow.SessionsClient({
    credentials: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
});

module.exports = async (req, res) => {

    try {

        const event = req.body.events[0];
        const msg = event.message.text;
        const replyToken = event.replyToken;

        console.log("USER:", msg);

        // 👉 Dialogflow session
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

        const result =
            response.queryResult.fulfillmentText ||
            "我還在學習這個問題";

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
                        text: result
                    }
                ]
            })
        });

        return res.status(200).end();

    } catch (err) {
        console.log("ERROR:", err);

        return res.status(200).json({
            error: err.message
        });
    }
};
