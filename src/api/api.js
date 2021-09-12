import express from 'express';
export const router = express.Router();
var connection;
export function setConnection(conn) {
    connection = conn;
}


router.get('/responses/search/:type', async (req, res) => {
    const type = +req.params.type || 1000*60*5;
    if (type > 1000*60*60*24*30 || type < 1000) {
        res.json({error: "not allowed range"});
        return;
    }
    const [responses] = await connection.query(`SELECT MAX(res_time) as res_time, res_result, res_timestamp FROM responses WHERE req_type = 0 GROUP BY res_timestamp DIV ? ORDER BY res_timestamp DESC LIMIT 36`, [Math.ceil(type)]);
    res.json(responses);
});

router.get('/responses/download/:type', async (req, res) => {
    const type = +req.params.type || 1000*60*5;
    if (type > 1000*60*60*24*30 || type < 1000) {
        res.json({error: "not allowed range"});
        return;
    }
    const [responses] = await connection.query(`SELECT MAX(res_time) as res_time, res_result, res_timestamp FROM responses WHERE req_type = 1 GROUP BY res_timestamp DIV ? ORDER BY res_timestamp DESC LIMIT 36`, [Math.ceil(type)]);
    res.json(responses);
});