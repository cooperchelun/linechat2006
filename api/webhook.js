module.exports = async (req, res) => {
    if (req.method === "GET") {
        return res.status(200).json({
            message: "Line健指部 API 運作中"
        });
    }

    if (req.method === "POST") {
        const body = req.body;

        console.log("LINE 傳來的訊息：", body);

        return res.status(200).json({
            status: "received"
        });
    }
};
