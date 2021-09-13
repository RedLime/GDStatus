import config from '../../config/config.json';
import request from 'request';
import fs from 'fs';
import express from 'express';
export const router = express.Router();
var connection;
export function setConnection(conn) {
    connection = conn;
}

//Start caching
const cachingServer = async () => {
    if (config.debug) return;

    const timeDate = Date.now();

    const form = {
        secret: 'Wmfd2893gb7',
        gameVersion: 21,
        binaryVersion: 35,
        gdw: 0
    };
    
    request({
        method: 'POST',
        uri: config.gd_server_url+"getGJLevels21.php",
        form: form,
        timeout: 60000,
    }, (error, response, body) => {
        if (error || !body || body == "-1") {
            connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (0, ${300}, 2, ${Date.now()})`)
        } else if (Date.now() - timeDate > 10000) {
            connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (0, ${Date.now() - timeDate}, 1, ${Date.now()})`)
        } else {
            connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (0, ${Date.now() - timeDate}, 0, ${Date.now()})`)
        }
    });
    
    form.levelID = config.gd_server_level_id;
    request({
        method: 'POST',
        uri: config.gd_server_url+"downloadGJLevel22.php",
        form: form,
        timeout: 60000,
    }, (error, response, body) => {
        if (error || !body || body == "-1") {
            connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (1, ${Date.now() - timeDate}, 2, ${Date.now()})`)
        } else if (Date.now() - timeDate > 10000) {
            connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (1, ${Date.now() - timeDate}, 1, ${Date.now()})`)
        } else {
            connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (1, ${Date.now() - timeDate}, 0, ${Date.now()})`)
        }
    });
};


setInterval(() => {
    const nowMinutes = Math.ceil(new Date().getTime() / (1000 * 60))
    if (nowMinutes % config.gd_server_cache_period == 1) {
        cachingServer();
    }
}, 1000 * 60);


router.get('/', async (req, res) => {
    const [search] = await connection.query(`SELECT res_time, res_result, res_timestamp FROM responses WHERE req_type = 0 ORDER BY res_timestamp DESC LIMIT 72`);
    const [download] = await connection.query(`SELECT res_time, res_result, res_timestamp FROM responses WHERE req_type = 1 ORDER BY res_timestamp DESC LIMIT 72`);
    const [incidents] = await connection.query(`SELECT message, update_time, type FROM incidents ORDER BY update_time DESC LIMIT 15`);

    let html = fs.readFileSync('./src/gdstatus/html/index.html', 'utf-8');

    let regex = new RegExp(`\\[\\[SEARCH\\]\\]`, "g");
    html = html.replace(regex, JSON.stringify(search));

    regex = new RegExp(`\\[\\[DOWNLOAD\\]\\]`, "g");
    html = html.replace(regex, JSON.stringify(download));

    regex = new RegExp(`\\[\\[INCIDENT\\]\\]`, "g");
    html = html.replace(regex, incidents.map(s => {
        return `<div class="incident"><div class="incident-date underline">${new Date(+s.update_time).toLocaleDateString()}</div>
        <div class="incident-type incident-type-${s.type}">${s.type}</div>
        <div class="incident-context">${s.message}</div></div>`;
    }).join(""));
    
    const firstStatus = download[0];
    const getStatus = () => {
        if (firstStatus.res_result == 2) {
            return `<div id='status' class='status-error'>Can't connect to server. Server may be under maintenance.</div>`;
        }
        if (firstStatus.res_time < 3000) {
            return `<div id='status' class='status-normal'>Server is OK. But Rub is sleeping.</div>`;
        }
        if (firstStatus.res_time <= 10000) {
            return `<div id='status' class='status-warn'>Server is noticeably slow.</div>`;
        }
        if (firstStatus.res_time > 10000) {
            return `<div id='status' class='status-timeout'>Server is too slow causing a timeout.</div>`;
        }
    }
    regex = new RegExp(`\\[\\[STATUS\\]\\]`, "g");
    html = html.replace(regex, getStatus());
    
    res.send(html);
});

router.get('/i/insert/:password', async (req, res, next) => {
    if (req.params.password != config.incident_password) {
        next();
        return;
    }
    
    let html = fs.readFileSync('./src/gdstatus/html/incident.html', 'utf-8');
    let regex = new RegExp(`\\[\\[PASSWORD\\]\\]`, "g");
    html = html.replace(regex, config.incident_password);
    res.send(html);
});

router.post('/i/update/:password', async (req, res, next) => {
    if (req.params.password != config.incident_password) {
        next();
        return;
    }

    await connection.query(`INSERT INTO incidents (message, type) VALUES (?, ?)`, [req.body.context, req.body.type]);
    
    res.send("ok");
});