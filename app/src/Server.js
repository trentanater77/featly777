'use strict';

/*
███████ ███████ ██████  ██    ██ ███████ ██████ 
██      ██      ██   ██ ██    ██ ██      ██   ██ 
███████ █████   ██████  ██    ██ █████   ██████  
     ██ ██      ██   ██  ██  ██  ██      ██   ██ 
███████ ███████ ██   ██   ████   ███████ ██   ██                                           

dependencies: {
    body-parser             : https://www.npmjs.com/package/body-parser
    compression             : https://www.npmjs.com/package/compression
    colors                  : https://www.npmjs.com/package/colors
    cors                    : https://www.npmjs.com/package/cors
    crypto-js               : https://www.npmjs.com/package/crypto-js
    express                 : https://www.npmjs.com/package/express
    httpolyglot             : https://www.npmjs.com/package/httpolyglot
    mediasoup               : https://www.npmjs.com/package/mediasoup
    mediasoup-client        : https://www.npmjs.com/package/mediasoup-client
    ngrok                   : https://www.npmjs.com/package/ngrok
    qs                      : https://www.npmjs.com/package/qs
    @sentry/node            : https://www.npmjs.com/package/@sentry/node
    @sentry/integrations    : https://www.npmjs.com/package/@sentry/integrations
    socket.io               : https://www.npmjs.com/package/socket.io
    swagger-ui-express      : https://www.npmjs.com/package/swagger-ui-express
    uuid                    : https://www.npmjs.com/package/uuid
    yamljs                  : https://www.npmjs.com/package/yamljs
}
*/

/**
 * FeatlyTalk SFU - Server component
 *
 * @link    GitHub: https://https://github.com/Featly-Inc/talk
 * @link    Official Live demo: https://featly.io
 * @license For open source use: AGPLv3
 * @license For commercial or closed source, contact us at cfo@featly.app or purchase directly via CodeCanyon
 * @license CodeCanyon:
 * @author  Featly Inc. - dmitry.lazarev@featly.app
 * @version 2.0.1
 *
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const https = require('httpolyglot');
const mediasoup = require('mediasoup');
const mediasoupClient = require('mediasoup-client');
const http = require('http');
const config = require('./config');
const path = require('path');
const ngrok = require('ngrok');
const fs = require('fs');
const Host = require('./Host');
const Room = require('./Room');
const Peer = require('./Peer');
const ServerApi = require('./ServerApi');
const Logger = require('./Logger');
const log = new Logger('Server');
const yamlJS = require('yamljs');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = yamlJS.load(path.join(__dirname + '/../api/swagger.yaml'));
const Sentry = require('@sentry/node');
const { CaptureConsole } = require('@sentry/integrations');
const { v4: uuidv4 } = require('uuid');

// Slack API
const CryptoJS = require('crypto-js');
const qS = require('qs');
const slackEnabled = config.slack.enabled;
const slackSigningSecret = config.slack.signingSecret;
const bodyParser = require('body-parser');

const app = express();




const options = {
    key: fs.readFileSync(config.sslKey, 'utf-8'),
    cert: fs.readFileSync(config.sslCrt, 'utf-8'),
};

const httpsServer = https.createServer(options, app);
const io = require('socket.io')(httpsServer, {
    maxHttpBufferSize: 1e7,
    transports: ['websocket'],
});
const host = config.listenIp; // config.listenIp

const hostCfg = {
    protected: config.hostProtected,
    username: config.hostUsername,
    password: config.hostPassword,
    authenticated: !config.hostProtected,
};

const apiBasePath = '/api/v1'; // api endpoint path
const api_docs = host + apiBasePath + '/docs'; // api docs

// Sentry monitoring
const sentryEnabled = config.sentry.enabled;
const sentryDSN = config.sentry.DSN;
const sentryTracesSampleRate = config.sentry.tracesSampleRate;
if (sentryEnabled) {
    Sentry.init({
        dsn: sentryDSN,
        integrations: [
            new CaptureConsole({
                // ['log', 'info', 'warn', 'error', 'debug', 'assert']
                levels: ['warn', 'error'],
            }),
        ],
        tracesSampleRate: sentryTracesSampleRate,
    });
    /*
    log.log('test-log');
    log.info('test-info');
    log.warn('test-warning');
    log.error('test-error');
    log.debug('test-debug');
    */
}

// directory
const dir = {
    public: path.join(__dirname, '../../', 'public'),
};

// html views
const views = {
    about: path.join(__dirname, '../../', 'public/views/about.html'),
    landing: path.join(__dirname, '../../', 'public/views/landing.html'),
    login: path.join(__dirname, '../../', 'public/views/login.html'),
    newRoom: path.join(__dirname, '../../', 'public/views/newroom.html'),
    notFound: path.join(__dirname, '../../', 'public/views/404.html'),
    permission: path.join(__dirname, '../../', 'public/views/permission.html'),
    privacy: path.join(__dirname, '../../', 'public/views/privacy.html'),
    room: path.join(__dirname, '../../', 'public/views/Room.html'),
    terms: path.join(__dirname, '../../', 'public/views/terms.html'),
};

let announcedIP = config.mediasoup.webRtcTransport.listenIps[0].announcedIp; // AnnouncedIP (server public IPv4)

let authHost; // Authenticated IP by Login

let roomList = new Map();

// All mediasoup workers
let workers = [];
let nextMediasoupWorkerIdx = 0;

// Autodetect announcedIP (https://www.ipify.org)
if (!announcedIP) {
    http.get(
        {
            host: 'api.ipify.org',
            port: 80,
            path: '/',
        },
        (resp) => {
            resp.on('data', (ip) => {
                announcedIP = ip.toString();
                config.mediasoup.webRtcTransport.listenIps[0].announcedIp = announcedIP;
                startServer();
            });
        },
    );
} else {
    startServer();
}

function startServer() {
    // Start the app
    app.use(cors());
    app.use(compression());
    app.use(express.json());
    app.use(express.static(dir.public));
    app.use(bodyParser.urlencoded({ extended: true }));
    //deleted app.use(bodyParser.json());
    
    app.use(apiBasePath + '/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument)); // api docs

    // all start from here
    app.get('*', function (next) {
        next();
    });

    // Remove trailing slashes in url handle bad requests
    app.use((err, req, res, next) => {
        if (err instanceof SyntaxError || err.status === 400 || 'body' in err) {
            log.error('Request Error', {
                header: req.headers,
                body: req.body,
                error: err.message,
            });
            return res.status(400).send({ status: 404, message: err.message }); // Bad request
        }
        if (req.path.substr(-1) === '/' && req.path.length > 1) {
            let query = req.url.slice(req.path.length);
            res.redirect(301, req.path.slice(0, -1) + query);
        } else {
            next();
        }
    }); //below is new code
// to add page to list rooms
// Serve HTML


app.get('/joinurspheres', (req, res) => {
  // Serve the HTML file (assuming it's saved in a public directory)
  res.sendFile(path.join(__dirname, '../../', 'public/views/joinurspheres.html'));
});
    
// Continue to create the room with roomLimit...


// Provide JSON data for rooms
// Provide JSON data for rooms
app.get('/api/rooms', (req, res) => {
  const rooms = [];
  roomList.forEach((room, id) => {
    rooms.push({
      id: id,
      description: room.getDescription(), // Missing comma here
      room_limit: room.getRoomLimit(),
        current_peers: room.getPeersCount(),// Include current number of peers
        tags:room.getTags() //added room tags here
      // other details
    });
  });
  console.log(rooms); // Log the rooms for debugging
  res.json({ rooms: rooms });
});

// ... rest of the code

app.post('/api/rooms', async (req, res) => {
  console.log("Request Body:", req.body); // log the entire request body
  const { description, room_limit } = req.body;
  console.log("Room limit:", room_limit);

  const id = uuidv4();

  // Assuming a function getMediasoupWorker is defined to return an available worker
  let worker = await getMediasoupWorker();

  // Create an instance of the Room class
  const room = new Room(id, worker, io, description, room_limit); // use room_limit here

  // Add the room to the roomList
  roomList.set(id, room);

  // Respond to client
  res.json({ success: true, room: { id: id, description: description, room_limit: room_limit } });
});





    
   //above is new code
    

    // main page
    app.get(['/'], (req, res) => {
        if (hostCfg.protected == true) {
            hostCfg.authenticated = false;
            res.sendFile(views.login);
        } else {
            res.sendFile(views.landing);
        }
    });

    // handle login on host protected
    app.get(['/login'], (req, res) => {
        if (hostCfg.protected == true) {
            let ip = getIP(req);
            log.debug(`Request login to host from: ${ip}`, req.query);
            const { username, password } = req.query;
            if (username == hostCfg.username && password == hostCfg.password) {
                hostCfg.authenticated = true;
                authHost = new Host(ip, true);
                log.debug('LOGIN OK', { ip: ip, authorized: authHost.isAuthorized(ip) });
                res.sendFile(views.landing);
            } else {
                log.debug('LOGIN KO', { ip: ip, authorized: false });
                hostCfg.authenticated = false;
                res.sendFile(views.login);
            }
        } else {
            res.redirect('/');
        }
    });

    // set new room name and join
    app.get(['/newroom'], (req, res) => {
        if (hostCfg.protected == true) {
            let ip = getIP(req);
            if (allowedIP(ip)) {
                res.sendFile(views.newRoom);
            } else {
                hostCfg.authenticated = false;
                res.sendFile(views.login);
            }
        } else {
            res.sendFile(views.newRoom);
        }
    });

    // no room name specified to join || direct join
    app.get('/join/', (req, res) => {
        if (hostCfg.authenticated && Object.keys(req.query).length > 0) {
            log.debug('Direct Join', req.query);
            // http://localhost:3010/join?room=test&password=0&name=featlytalksfu&audio=1&video=1&screen=1&notify=1
            const { room, password, name, audio, video, screen, notify } = req.query;
            if (room && password && name && audio && video && screen && notify) {
                return res.sendFile(views.room);
            }
        }
        res.redirect('/');
    });

    // join room
    app.get('/join/*', (req, res) => {
        if (hostCfg.authenticated) {
            res.sendFile(views.room);
        } else {
            res.redirect('/');
        }
    });

    // if not allow video/audio
    app.get(['/permission'], (req, res) => {
        res.sendFile(views.permission);
    });

    // privacy policy
    app.get(['/privacy'], (req, res) => {
        res.sendFile(views.privacy);
    });

    // featlytalk about
    app.get(['/about'], (req, res) => {
        res.sendFile(views.about);
    });

    // featlytalk about
    app.get(['/terms'], (req, res) => {
        res.sendFile(views.terms);
    });

    // ####################################################
    // API
    // ####################################################

    // request meeting room endpoint
    app.post(['/api/v1/meeting'], (req, res) => {
        // check if user was authorized for the api call
        let host = req.headers.host;
        let authorization = req.headers.authorization;
        let api = new ServerApi(host, authorization);
        if (!api.isAuthorized()) {
            log.debug('FeatlyTalk get meeting - Unauthorized', {
                header: req.headers,
                body: req.body,
            });
            return res.status(403).json({ error: 'Unauthorized!' });
        }
        // setup meeting URL
        let meetingURL = api.getMeetingURL();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ meeting: meetingURL }));
        // log.debug the output if all done
        log.debug('FeatlyTalk get meeting - Authorized', {
            header: req.headers,
            body: req.body,
            meeting: meetingURL,
        });
    });

    // request join room endpoint
    app.post(['/api/v1/join'], (req, res) => {
        // check if user was authorized for the api call
        let host = req.headers.host;
        let authorization = req.headers.authorization;
        let api = new ServerApi(host, authorization);
        if (!api.isAuthorized()) {
            log.debug('FeatlyTalk get join - Unauthorized', {
                header: req.headers,
                body: req.body,
            });
            return res.status(403).json({ error: 'Unauthorized!' });
        }
        // setup Join URL
        let joinURL = api.getJoinURL(req.body);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ join: joinURL }));
        // log.debug the output if all done
        log.debug('FeatlyTalk get join - Authorized', {
            header: req.headers,
            body: req.body,
            join: joinURL,
        });
    });

    // ####################################################
    // SLACK API
    // ####################################################

    app.post('/slack', (req, res) => {
        if (!slackEnabled) return res.end('`Under maintenance` - Please check back soon.');

        log.debug('Slack', req.headers);

        if (!slackSigningSecret) return res.end('`Slack Signing Secret is empty!`');

        let slackSignature = req.headers['x-slack-signature'];
        let requestBody = qS.stringify(req.body, { format: 'RFC1738' });
        let timeStamp = req.headers['x-slack-request-timestamp'];
        let time = Math.floor(new Date().getTime() / 1000);

        if (Math.abs(time - timeStamp) > 300) return res.end('`Wrong timestamp` - Ignore this request.');

        let sigBaseString = 'v0:' + timeStamp + ':' + requestBody;
        let mySignature = 'v0=' + CryptoJS.HmacSHA256(sigBaseString, slackSigningSecret);

        if (mySignature == slackSignature) {
            let host = req.headers.host;
            let api = new ServerApi(host);
            let meetingURL = api.getMeetingURL();
            log.debug('Slack', { meeting: meetingURL });
            return res.end(meetingURL);
        }
        return res.end('`Wrong signature` - Verification failed!');
    });

    // not match any of page before, so 404 not found
    app.get('*', function (req, res) {
        res.sendFile(views.notFound);
    });

    // ####################################################
    // NGROK
    // ####################################################

    async function ngrokStart() {
        try {
            await ngrok.authtoken(config.ngrokAuthToken);
            await ngrok.connect(config.listenPort);
            let api = ngrok.getApi();
            let data = await api.listTunnels();
            let pu0 = data.tunnels[0].public_url;
            let pu1 = data.tunnels[1].public_url;
            let tunnel = pu0.startsWith('https') ? pu0 : pu1;
            log.info('Listening on', {
                node_version: process.versions.node,
                hostConfig: hostCfg,
                announced_ip: announcedIP,
                server: host,
                server_tunnel: tunnel,
                api_docs: api_docs,
                mediasoup_server_version: mediasoup.version,
                mediasoup_client_version: mediasoupClient.version,
                sentry_enabled: sentryEnabled,
            });
        } catch (err) {
            log.error('Ngrok Start error: ', err.body);
            process.exit(1);
        }
    }

    // ####################################################
    // START SERVER
    // ####################################################

    httpsServer.listen(config.listenPort, () => {
        log.log(
            `%c
    
        ███████╗██╗ ██████╗ ███╗   ██╗      ███████╗███████╗██████╗ ██╗   ██╗███████╗██████╗ 
        ██╔════╝██║██╔════╝ ████╗  ██║      ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝██╔══██╗
        ███████╗██║██║  ███╗██╔██╗ ██║█████╗███████╗█████╗  ██████╔╝██║   ██║█████╗  ██████╔╝
        ╚════██║██║██║   ██║██║╚██╗██║╚════╝╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝  ██╔══██╗
        ███████║██║╚██████╔╝██║ ╚████║      ███████║███████╗██║  ██║ ╚████╔╝ ███████╗██║  ██║
        ╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝      ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝╚═╝  ╚═╝ started...
    
        `,
            'font-family:monospace',
        );

        if (config.ngrokAuthToken !== '') {
            return ngrokStart();
        }
        log.debug('Settings', {
            node_version: process.versions.node,
            hostConfig: hostCfg,
            announced_ip: announcedIP,
            server: host,
            api_docs: api_docs,
            mediasoup_server_version: mediasoup.version,
            mediasoup_client_version: mediasoupClient.version,
            sentry_enabled: sentryEnabled,
        });
    });

    // ####################################################
    // WORKERS
    // ####################################################

    (async () => {
        try {
            await createWorkers();
        } catch (err) {
            log.error('Create Worker ERR --->', err);
            process.exit(1);
        }
    })();

    async function createWorkers() {
        const { numWorkers } = config.mediasoup;

        const { logLevel, logTags, rtcMinPort, rtcMaxPort } = config.mediasoup.worker;

        log.debug('WORKERS:', numWorkers);

        for (let i = 0; i < numWorkers; i++) {
            let worker = await mediasoup.createWorker({
                logLevel: logLevel,
                logTags: logTags,
                rtcMinPort: rtcMinPort,
                rtcMaxPort: rtcMaxPort,
            });
            worker.on('died', () => {
                log.error('Mediasoup worker died, exiting in 2 seconds... [pid:%d]', worker.pid);
                setTimeout(() => process.exit(1), 2000);
            });
            workers.push(worker);
        }
    }

    async function getMediasoupWorker() {
        const worker = workers[nextMediasoupWorkerIdx];
        if (++nextMediasoupWorkerIdx === workers.length) nextMediasoupWorkerIdx = 0;
        return worker;
    }

    // ####################################################
    // TIMER
    // ####################################################

    let elapsedTime = 0;
    let startTime;
    let timerId;
    let isOverProceed = false;

    function formatTime(milliseconds, withoutHours) {
        const hours = Math.floor(milliseconds / 3600000);
        const minutes = Math.floor((milliseconds % 3600000) / 60000);
        const seconds = Math.floor((milliseconds % 60000) / 1000);

        if (withoutHours) {
            return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        }

        return (
            String(hours).padStart(2, '0') +
            ':' +
            String(minutes).padStart(2, '0') +
            ':' +
            String(seconds).padStart(2, '0')
        );
    }

    function updateTimer() {
        const currentTime = new Date().getTime();
        const deltaTime = currentTime - startTime;
        elapsedTime += deltaTime;

        const time = formatTime(elapsedTime, false);

        io.emit('timerUpdate', time);

        startTime = currentTime;

        if (time === '00:50:00' || time === '01:50:00' || time === '02:50:00' || time === '03:50:00') {
            isOverProceed = true;
        }

        if (isOverProceed) {
            countdown();
        }
    }

    let countdownMinutes = 9;
    let countdownSeconds = 59;

    function countdown() {
        var formattedMinutes = String(countdownMinutes).padStart(2, '0');
        var formattedSeconds = String(countdownSeconds).padStart(2, '0');
        const overTime = formattedMinutes + ':' + formattedSeconds;
        io.emit('overTimerUpdate', overTime);

        countdownSeconds--;

        if (countdownSeconds < 0) {
            countdownMinutes--;
            countdownSeconds = 59;
        }

        if (countdownMinutes === 0 && countdownSeconds === 0) {
            io.emit('exitRoomForTime');
            resetCountdown();
        }
    }

    function resetCountdown() {
        countdownMinutes = 9;
        countdownSeconds = 59;
        isOverProceed = false;
    }

    // ####################################################
    // SOCKET IO
    // ####################################################
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('createRoom', async ({ room_id, description, room_limit, tags }, callback) => {
        console.log('Room limit received in createRoom:', room_limit); // Log the room_limit
        socket.room_id = room_id;







        

        if (roomList.has(socket.room_id)) {
            callback({ error: 'already exists' });
        } else {
            log.debug('Created room', { room_id: socket.room_id, description: description, room_limit: room_limit, tags: tags });
            let worker = await getMediasoupWorker();
            roomList.set(socket.room_id, new Room(socket.room_id, worker, io, description, room_limit, tags));
            callback({ room_id: socket.room_id });
        }





        
    });





      

      


        socket.on('startRecordingMessage', (peer_id) => {
            if (!roomList.has(socket.room_id)) return;
            io.emit('showStartRecordingMessage', peer_id);
        });

//added below




    socket.on('joinRoom', (roomId, callback) => {
        const room = roomList.get(roomId);
        if (!room) {
            callback({ error: 'Room not found.' });
            return;
        }
        if (room.isFull()) { // Make sure the isFull method is implemented in Room class
            callback({ error: 'Room is too full.' });
            return;
        }
    
 



    //added above


    

        socket.on('resetCountdownTimer', () => {
            if (!roomList.has(socket.room_id)) return;
            resetCountdown();
            io.emit('resetCountdownTimer');
        });

        socket.on('getPeerCounts', async ({}, callback) => {
            if (!roomList.has(socket.room_id)) return;

            let peerCounts = roomList.get(socket.room_id).getPeersCount();

            log.debug('Peer counts', { peerCounts: peerCounts });

            callback({ peerCounts: peerCounts });
        });

        socket.on('cmd', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Cmd', data);

            // cmd|foo|bar|....
            const words = data.split('|');
            let cmd = words[0];
            switch (cmd) {
                case 'privacy':
                    roomList
                        .get(socket.room_id)
                        .getPeers()
                        .get(socket.id)
                        .updatePeerInfo({ type: cmd, status: words[2] == 'true' });
                    break;
                //...
            }

            roomList.get(socket.room_id).broadCast(socket.id, 'cmd', data);
        });

        socket.on('roomAction', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Room action:', data);
            switch (data.action) {
                case 'lock':
                    if (!roomList.get(socket.room_id).isLocked()) {
                        roomList.get(socket.room_id).setLocked(true, data.password);
                        roomList.get(socket.room_id).broadCast(socket.id, 'roomAction', data.action);
                    }
                    break;
                case 'checkPassword':
                    let roomData = {
                        room: null,
                        password: 'KO',
                    };
                    if (data.password == roomList.get(socket.room_id).getPassword()) {
                        roomData.room = roomList.get(socket.room_id).toJson();
                        roomData.password = 'OK';
                    }
                    roomList.get(socket.room_id).sendTo(socket.id, 'roomPassword', roomData);
                    break;
                case 'unlock':
                    roomList.get(socket.room_id).setLocked(false);
                    roomList.get(socket.room_id).broadCast(socket.id, 'roomAction', data.action);
                    break;
                case 'lobbyOn':
                    roomList.get(socket.room_id).setLobbyEnabled(true);
                    roomList.get(socket.room_id).broadCast(socket.id, 'roomAction', data.action);
                    break;
                case 'lobbyOff':
                    roomList.get(socket.room_id).setLobbyEnabled(false);
                    roomList.get(socket.room_id).broadCast(socket.id, 'roomAction', data.action);
                    break;
            }
            log.debug('Room status', {
                locked: roomList.get(socket.room_id).isLocked(),
                lobby: roomList.get(socket.room_id).isLobbyEnabled(),
            });
        });

        socket.on('roomLobby', (data) => {
            if (!roomList.has(socket.room_id)) return;

            data.room = roomList.get(socket.room_id).toJson();

            log.debug('Room lobby', {
                peer_id: data.peer_id,
                peer_name: data.peer_name,
                peers_id: data.peers_id,
                lobby: data.lobby_status,
                broadcast: data.broadcast,
            });

            if (data.peers_id && data.broadcast) {
                for (let peer_id in data.peers_id) {
                    roomList.get(socket.room_id).sendTo(data.peers_id[peer_id], 'roomLobby', data);
                }
            } else {
                roomList.get(socket.room_id).sendTo(data.peer_id, 'roomLobby', data);
            }
        });

        socket.on('peerAction', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Peer action', data);

            if (data.broadcast) {
                roomList.get(socket.room_id).broadCast(data.peer_id, 'peerAction', data);
            } else {
                roomList.get(socket.room_id).sendTo(data.peer_id, 'peerAction', data);
            }
        });

        socket.on('updatePeerInfo', (data) => {
            if (!roomList.has(socket.room_id)) return;

            // update my peer_info status to all in the room
            roomList.get(socket.room_id).getPeers().get(socket.id).updatePeerInfo(data);
            roomList.get(socket.room_id).broadCast(socket.id, 'updatePeerInfo', data);
        });
}); // closes 'connection' //I TRENTON ADDED THIS BY CHAT GPT 
        socket.on('fileInfo', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Send File Info', data);
            if (data.broadcast) {
                roomList.get(socket.room_id).broadCast(socket.id, 'fileInfo', data);
            } else {
                roomList.get(socket.room_id).sendTo(data.peer_id, 'fileInfo', data);
            }
        });

        socket.on('file', (data) => {
            if (!roomList.has(socket.room_id)) return;

            if (data.broadcast) {
                roomList.get(socket.room_id).broadCast(socket.id, 'file', data);
            } else {
                roomList.get(socket.room_id).sendTo(data.peer_id, 'file', data);
            }
        });

        socket.on('fileAbort', (data) => {
            if (!roomList.has(socket.room_id)) return;

            roomList.get(socket.room_id).broadCast(socket.id, 'fileAbort', data);
        });

        socket.on('shareVideoAction', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Share video: ', data);
            if (data.peer_id == 'all') {
                roomList.get(socket.room_id).broadCast(socket.id, 'shareVideoAction', data);
            } else {
                roomList.get(socket.room_id).sendTo(data.peer_id, 'shareVideoAction', data);
            }
        });

        socket.on('wbCanvasToJson', (data) => {
            if (!roomList.has(socket.room_id)) return;

            // let objLength = bytesToSize(Object.keys(data).length);
            // log.debug('Send Whiteboard canvas JSON', { length: objLength });
            roomList.get(socket.room_id).broadCast(socket.id, 'wbCanvasToJson', data);
        });

        socket.on('whiteboardAction', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Whiteboard', data);
            roomList.get(socket.room_id).broadCast(socket.id, 'whiteboardAction', data);
        });

        socket.on('setVideoOff', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Video off', getPeerName());
            roomList.get(socket.room_id).broadCast(socket.id, 'setVideoOff', data);
        });

        socket.on('join', (data, cb) => {
            if (!roomList.has(socket.room_id)) {
                return cb({
                    error: 'Room does not exist',
                });
            }

            // Start the timer when a client connects
            if (!timerId) {
                startTime = new Date().getTime();
                timerId = setInterval(updateTimer, 1000);
            }

            log.debug('User joined', data);
            roomList.get(socket.room_id).addPeer(new Peer(socket.id, data));

            if (roomList.get(socket.room_id).isLocked()) {
                log.debug('User rejected because room is locked');
                return cb('isLocked');
            }

            if (roomList.get(socket.room_id).isLobbyEnabled()) {
                log.debug('User waiting to join room because lobby is enabled');
                roomList.get(socket.room_id).broadCast(socket.id, 'roomLobby', {
                    peer_id: data.peer_info.peer_id,
                    peer_name: data.peer_info.peer_name,
                    lobby_status: 'waiting',
                });
                return cb('isLobby');
            }

            cb(roomList.get(socket.room_id).toJson());
        });

        socket.on('getRouterRtpCapabilities', (_, callback) => {
            if (!roomList.has(socket.room_id)) {
                return callback({ error: 'Room not found' });
            }

            log.debug('Get RouterRtpCapabilities', getPeerName());
            try {
                callback(roomList.get(socket.room_id).getRtpCapabilities());
            } catch (err) {
                callback({
                    error: err.message,
                });
            }
        });

        socket.on('getProducers', () => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Get producers', getPeerName());

            // send all the current producer to newly joined member
            let producerList = roomList.get(socket.room_id).getProducerListForPeer();

            socket.emit('newProducers', producerList);
        });

        socket.on('createWebRtcTransport', async (_, callback) => {
            if (!roomList.has(socket.room_id)) {
                return callback({ error: 'Room not found' });
            }

            log.debug('Create webrtc transport', getPeerName());
            try {
                const { params } = await roomList.get(socket.room_id).createWebRtcTransport(socket.id);
                callback(params);
            } catch (err) {
                log.error('Create WebRtc Transport error: ', err.message);
                callback({
                    error: err.message,
                });
            }
        });

        socket.on('connectTransport', async ({ transport_id, dtlsParameters }, callback) => {
            if (!roomList.has(socket.room_id)) {
                return callback({ error: 'Room not found' });
            }

            log.debug('Connect transport', getPeerName());

            await roomList.get(socket.room_id).connectPeerTransport(socket.id, transport_id, dtlsParameters);

            callback('success');
        });

        socket.on('produce', async ({ producerTransportId, kind, appData, rtpParameters }, callback) => {
            if (!roomList.has(socket.room_id)) {
                return callback({ error: 'Room not found' });
            }

            let peer_name = getPeerName(false);

            // peer_info audio Or video ON
            let data = {
                peer_name: peer_name,
                peer_id: socket.id,
                kind: kind,
                type: appData.mediaType,
                status: true,
            };
            await roomList.get(socket.room_id).getPeers().get(socket.id).updatePeerInfo(data);

            let producer_id = await roomList
                .get(socket.room_id)
                .produce(socket.id, producerTransportId, rtpParameters, kind, appData.mediaType);

            log.debug('Produce', {
                kind: kind,
                type: appData.mediaType,
                peer_name: peer_name,
                peer_id: socket.id,
                producer_id: producer_id,
            });

            // add & monitor producer audio level
            if (kind === 'audio') {
                roomList.get(socket.room_id).addProducerToAudioLevelObserver({ producerId: producer_id });
            }

            callback({
                producer_id,
            });
        });

        socket.on('consume', async ({ consumerTransportId, producerId, rtpCapabilities }, callback) => {
            if (!roomList.has(socket.room_id)) {
                return callback({ error: 'Room not found' });
            }

            let params = await roomList
                .get(socket.room_id)
                .consume(socket.id, consumerTransportId, producerId, rtpCapabilities);

            log.debug('Consuming', {
                peer_name: getPeerName(false),
                producer_id: producerId,
                consumer_id: params ? params.id : undefined,
            });

            callback(params);
        });

        socket.on('producerClosed', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Producer close', data);

            // peer_info audio Or video OFF
            roomList.get(socket.room_id).getPeers().get(socket.id).updatePeerInfo(data);
            roomList.get(socket.room_id).closeProducer(socket.id, data.producer_id);
        });

        socket.on('pauseConsumer', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Producer paused', data);

            io.emit('pauseConsumer', data);
        });

        socket.on('resumeConsumer', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Producer resumed', data);

            io.emit('resumeConsumer', data);
        });

        socket.on('resume', async (_, callback) => {
            await consumer.resume();
            callback();
        });

        socket.on('getRoomInfo', (_, cb) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('Send Room Info to', getPeerName());
            cb(roomList.get(socket.room_id).toJson());
        });

        socket.on('refreshParticipantsCount', () => {
            if (!roomList.has(socket.room_id)) return;

            let data = {
                room_id: socket.room_id,
                peer_counts: roomList.get(socket.room_id).getPeers().size,
            };
            log.debug('Refresh Participants count', data);
            roomList.get(socket.room_id).broadCast(socket.id, 'refreshParticipantsCount', data);
        });

        socket.on('message', (data) => {
            if (!roomList.has(socket.room_id)) return;

            log.debug('message', data);
            if (data.to_peer_id == 'all') {
                roomList.get(socket.room_id).broadCast(socket.id, 'message', data);
            } else {
                roomList.get(socket.room_id).sendTo(data.to_peer_id, 'message', data);
            }
        });

        socket.on('disconnect', () => {
            console.log('A user disconnected');

            // Stop the timer when all clients disconnect
            if (io.engine.clientsCount === 0) {
                clearInterval(timerId);
                timerId = null;
                elapsedTime = 0;
            }

            //

            if (!roomList.has(socket.room_id)) return;

            log.debug('Disconnect', getPeerName());

            roomList.get(socket.room_id).removePeer(socket.id);

            if (roomList.get(socket.room_id).getPeers().size === 0) {
                if (roomList.get(socket.room_id).isLocked()) {
                    roomList.get(socket.room_id).setLocked(false);
                }
                if (roomList.get(socket.room_id).isLobbyEnabled()) {
                    roomList.get(socket.room_id).setLobbyEnabled(false);
                }
            }

            roomList.get(socket.room_id).broadCast(socket.id, 'removeMe', removeMeData());

            removeIP(socket);
        });

        socket.on('exitRoom', async (_, callback) => {
            if (!roomList.has(socket.room_id)) {
                return callback({
                    error: 'Not currently in a room',
                });
            }
            log.debug('Exit room', getPeerName());

            // close transports
            await roomList.get(socket.room_id).removePeer(socket.id);

            roomList.get(socket.room_id).broadCast(socket.id, 'removeMe', removeMeData());

            if (roomList.get(socket.room_id).getPeers().size === 0) {
                roomList.delete(socket.room_id);
            }

            socket.room_id = null;

            removeIP(socket);

            callback('Successfully exited room');
        });

        // common
        function getPeerName(json = true) {
            try {
                let peer_name =
                    roomList.get(socket.room_id) &&
                    roomList.get(socket.room_id).getPeers().get(socket.id).peer_info?.peer_name;
                if (json) {
                    return {
                        peer_name: peer_name,
                    };
                }
                return peer_name;
            } catch (err) {
                log.error('getPeerName', err);
                return json ? { peer_name: 'undefined' } : 'undefined';
            }
        }

        function removeMeData() {
            return {
                room_id: roomList.get(socket.room_id) && socket.room_id,
                peer_id: socket.id,
                peer_counts: roomList.get(socket.room_id) && roomList.get(socket.room_id).getPeers().size,
            };
        }

        function bytesToSize(bytes) {
            let sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            if (bytes == 0) return '0 Byte';
            let i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
            return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
        }
    });//add parenthis here when revert back to old code

    function getIP(req) {
        return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    }
    function allowedIP(ip) {
        return authHost != null && authHost.isAuthorized(ip);
    }
    function removeIP(socket) {
        if (hostCfg.protected == true) {
            let ip = socket.handshake.address;
            if (ip && allowedIP(ip)) {
                authHost.deleteIP(ip);
                hostCfg.authenticated = false;
                log.debug('Remove IP from auth', { ip: ip });
            }
        }
    }//added extra parenthisis and bracket on 1189 then removed only added when adding that bothersome roomlimit feature to allow users to get kicked out when too many users in one room
}  
