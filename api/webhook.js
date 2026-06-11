module.exports = async (req, res) => {

    console.log("🔥 WEBHOOK HIT");

    console.log("METHOD:", req.method);

    console.log("BODY:", JSON.stringify(req.body));

    return res.status(200).json({
        ok: true
    });
};
