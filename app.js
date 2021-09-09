/* eslint-disable no-unused-vars */
import config from './config/config.json';
import mysql from 'mysql2/promise';
import express from 'express';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';

import { stream } from './src/winston.js'
import * as gdstatus from './src/gdstatus/gdstatus.js'
import * as ownAPI from './src/api/api.js'


//Mysql
const connection = mysql.createPool({
    host: config.mysql_host,
    user: config.mysql_user,
    password: config.mysql_password,
    port: config.mysql_port,
    database: config.mysql_database,
    multipleStatements: true
});


const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});

const app = express();
morgan.token('ip-addr', function (req, res) { return req.headers['x-forwarded-for'] });
app.use(morgan('[:date[clf]] :ip-addr - :remote-user ":method :url HTTP/:http-version" :status ":user-agent" - :response-time ms', {stream}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(limiter);

gdstatus.setConnection(connection);
app.use('/gdstatus', gdstatus.router);

ownAPI.setConnection(connection);
app.use('/api', ownAPI.router);

app.use(function(req, res, next) {
    res.status(404);
    res.send("Not Found");
});

app.listen(config.web_port, () => {
    console.log(`running in ${config.web_port} port!`);
});