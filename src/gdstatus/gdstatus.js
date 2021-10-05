import config from '../../config/config.json';
import request from 'request';
import fs from 'fs';
import express from 'express';
import mysql from 'mysql2/promise';

export const router = express.Router();
var connection;
export function setConnection(conn) {
    connection = conn;
}

//Utils
var serverIssues = 0, errorTrigger = 0;
var updatedIssue = false;
async function createIncident(message, type, isAuto) {
    const [[lastIncident]] = await connection.query(`SELECT type, incident_group FROM incidents ORDER BY incident_group DESC LIMIT 1`);
    
    let group = +lastIncident.incident_group;
    if (lastIncident.type == 'solved' || lastIncident.type == 'announcement') {
        group++;
    }
    
    await connection.query(`INSERT INTO incidents (message, type, is_automatic, incident_group) VALUES (
        ${mysql.escape(message)}, ${mysql.escape(type)}, ${isAuto ? 1 : 0}, ${group}
    )`);
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
        timeout: config.timeout,
    }, (error, response, body) => {
        if (error || !body || body == "-1") {
            if (error && error.code == 'ETIMEDOUT') {
                connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (0, ${Date.now() - timeDate}, 1, ${Date.now()})`);
            } else {
                connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (0, ${Date.now() - timeDate}, 2, ${Date.now()})`);
            }
        } else {
            connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (0, ${Date.now() - timeDate}, 0, ${Date.now()})`);
        }
    });
    
    form.levelID = config.gd_server_level_id;
    request({
        method: 'POST',
        uri: config.gd_server_url+"downloadGJLevel22.php",
        form: form,
        timeout: config.timeout,
    }, (error, response, body) => {
        if (error || !body || body == "-1") {
            errorTrigger++;
            if (error && error.code == 'ETIMEDOUT') {
                connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (1, ${Date.now() - timeDate}, 1, ${Date.now()})`);
                if (serverIssues == 0 && errorTrigger == 3) {
                    createIncident('The server has timed out. It will be update when the server is back.', 'issue', true);
                    serverIssues = 6;
                }
            } else {
                connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (1, ${Date.now() - timeDate}, 2, ${Date.now()})`);
                if (serverIssues == 0 && errorTrigger == 3) {
                    createIncident('The server is not working now. It will be update when the server is back.', 'issue', true);
                    serverIssues = 6;
                }
            }
        } else {
            connection.query(`INSERT INTO responses (req_type, res_time, res_result, res_timestamp) VALUES (1, ${Date.now() - timeDate}, 0, ${Date.now()})`);
            if (serverIssues != 0) {
                serverIssues--;
                if (serverIssues == 0) {
                    if (!updatedIssue) {
                        createIncident('Now server is back. It maybe an temporary issue.', 'solved', true);
                    }
                    updatedIssue = false;
                }
            }
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
    const [incidents] = await connection.query(`SELECT incident_group,
        GROUP_CONCAT(message ORDER BY update_time DESC SEPARATOR "||") as message,
        GROUP_CONCAT(update_time ORDER BY update_time DESC SEPARATOR "||") as update_time,
        GROUP_CONCAT(type ORDER BY update_time DESC SEPARATOR "||") as type,
        GROUP_CONCAT(is_automatic ORDER BY update_time DESC SEPARATOR "||") as is_automatic
        FROM incidents GROUP BY incident_group ORDER BY incident_group DESC LIMIT 10`);

    let html = fs.readFileSync('./src/gdstatus/html/index.html', 'utf-8');

    let regex = new RegExp(`\\[\\[SEARCH\\]\\]`, "g");
    html = html.replace(regex, JSON.stringify(search));

    regex = new RegExp(`\\[\\[DOWNLOAD\\]\\]`, "g");
    html = html.replace(regex, JSON.stringify(download));

    regex = new RegExp(`\\[\\[INCIDENT\\]\\]`, "g");
    html = html.replace(regex, incidents.map(s => {
        let context = `<div class="incident"><div class="incident-number underline">Incident #${s.incident_group}</div>`;

        for (let index = 0; index < s.is_automatic.split('||').length; index++) {
            const type = s.type.split('||')[index];
            const message = s.message.split('||')[index];
            const update_time = s.update_time.split('||')[index];
            const is_automatic = s.is_automatic.split('||')[index];
            context += `<div class="incident-type incident-type-${type}">${type}<span class="incident-date">| ${new Date(update_time).toUTCString()}</span></div>
            <div class="incident-context">${message}</div>`;
            if (+is_automatic) context += `<small>[It was automatically generated incident]</small>`
            context += `<br>`;
        }
        context += `</div>`;

        return context;
    }).join(""));
    
    const firstStatus = download[0];
    const getStatus = () => {
        if (firstStatus.res_result == 2) {
            return `<div id='status' class='status-error'>Can't connect to server. Server may be under maintenance.</div>`;
        }
        if (firstStatus.res_result == 1) {
            return `<div id='status' class='status-timeout'>Server is too slow causing a timeout.</div>`;
        }
        if (firstStatus.res_time > 3000) {
            return `<div id='status' class='status-warn'>Server is noticeably slow.</div>`;
        }
        return `<div id='status' class='status-normal'>Server is OK. But Rub is sleeping.</div>`;
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

    await createIncident(req.body.context, req.body.type, false);
    updatedIssue = true;

    res.send("ok");
});