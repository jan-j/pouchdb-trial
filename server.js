const path = require('path');
const fse = require('fs-extra');
const DefaultPouchDB = require('pouchdb');
const os = require('os');
const express = require('express');
const hasha = require('hasha');
const argv = require('minimist')(process.argv.slice(2));

const port = argv.port || 3000;
const remoteUrls = Array.isArray(argv.remote)
    ? argv.remote
    : argv.remote
    ? [argv.remote]
    : [];
const hostname = os.hostname();
const uniqueId = hasha(`${Math.random()}-${hostname}`, { algorithm: 'md5' });
const localUrl = `http://localhost:${port}/db`;
const dataDir = path.join(__dirname, 'data', `${argv.node || 1}`);

fse.ensureDirSync(dataDir);

const app = express();
app.use(express.static(__dirname));
app.use(
    express.json({
        limit: '100mb',
    })
);

app.get('/status', (req, res) =>
    res.json({
        status: 'success',
        data: {
            osHostname: hostname,
            requestHostname: req.hostname,
            uniqueId,
            pouchDbUrl: `http://${req.hostname}:${port}/db`,
        },
    })
);

const PouchDB = DefaultPouchDB.defaults({
    prefix: `${dataDir}${path.sep}`,
});

app.use(
    '/db',
    require('express-pouchdb')(PouchDB, {
        configPath: path.join(dataDir, 'config.json'),
        logPath: path.join(dataDir, 'log.txt'),
    })
);

const db = new PouchDB('messages', {
    adapter: 'leveldb',
});

console.log(`Local url "${localUrl}/messages"`);

const remoteDbs = remoteUrls.map(remoteUrl => {
    console.log(`Connecting to remote db "${remoteUrl}"`);
    const remoteDb = new PouchDB(remoteUrl);

    db.sync(remoteDb, {
        live: true,
        retry: true,
    })
        .on('change', change => {
            console.log(`Remote DB ["${remoteUrl}"] change`, change);
        })
        .on('paused', info => {
            console.log(`Remote DB ["${remoteUrl}"] paused`, info);
        })
        .on('active', info => {
            console.log(`Remote DB ["${remoteUrl}"] active`, info);
        })
        .on('error', error => {
            console.log(`Remote DB ["${remoteUrl}"] error`, error);
        });
});

app.listen(port);
