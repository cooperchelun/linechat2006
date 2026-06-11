module.exports = async (req, res) => {

    console.log("🔥 WEBHOOK HIT");
    console.log("BODY:", JSON.stringify(req.body));

    return res.status(200).send("OK");
};
