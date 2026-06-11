module.exports = async (req, res) => {
    console.log("🔥 HIT WEBHOOK");

    return res.status(200).json({
        ok: true
    });
};
