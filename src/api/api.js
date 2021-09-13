import express from 'express';
export const router = express.Router();
var connection;
export function setConnection(conn) {
    connection = conn;
}


router.get('/responses/search/:type', async (req, res) => {
    const type = +req.params.type || 5;
    if (type > 60*24*7 || type < 5) {
        res.sendStatus(400).json({error: "not allowed range"});
        return;
    }
    const [responses] = await connection.query(`SELECT MAX(res_time) as res_time, MAX(res_result) as res_result, res_timestamp FROM responses 
        WHERE req_type = 0 GROUP BY res_timestamp DIV ? ORDER BY res_timestamp DESC LIMIT 72`, [Math.ceil(type*60000)]);
    res.json(responses);
});

router.get('/responses/download/:type', async (req, res) => {
    const type = +req.params.type || 5;
    if (type > 60*24*7 || type < 5) {
        res.sendStatus(400).json({error: "not allowed range"});
        return;
    }
    const [responses] = await connection.query(`SELECT MAX(res_time) as res_time, MAX(res_result) as res_result, res_timestamp FROM responses 
        WHERE req_type = 1 GROUP BY res_timestamp DIV ? ORDER BY res_timestamp DESC LIMIT 72`, [Math.ceil(type*60000)]);
    res.json(responses);
});