'use strict';

const os = require('os');
const ifaces = os.networkInterfaces();

const getLocalIp = () => {
    let localIp = '62.171.169.98';
    Object.keys(ifaces).forEach((ifname) => {
        for (const iface of ifaces[ifname]) {
            // Ignore IPv6 and 127.0.0.1
            if (iface.family !== 'IPv4' || iface.internal !== false) {
                continue;
            }
            // Set the local ip to the first IPv4 address found and exit the loop
            localIp = iface.address;
            return;
        }
    });
    return localIp;
};

// https://api.ipify.org

module.exports = {
    /*
        Host Protection (default False)
        In order to protect your host set
        hostProtected to true and set your own Username and Password
    */
    hostProtected: false,
    hostUsername: 'username',
    hostPassword: 'password',
    // app listen on
    listenIp: '62.171.169.98',
    listenPort: process.env.PORT || 443,
    // ssl/README.md
    sslCrt: '../ssl/cert.pem',
    sslKey: '../ssl/privkey.pem',
    /*
    Ngrok
        1. Goto https://ngrok.com
        2. Get started for free
        3. Copy YourNgrokAuthToken: https://dashboard.ngrok.com/get-started/your-authtoken
    */
    ngrokAuthToken: '',
    apiKeySecret: 'featlytalksfu_default_secret',
    sentry: {
        /*
        Sentry
            1. Goto https://sentry.io/
            2. Create account
            3. On dashboard goto Settings/Projects/YourProjectName/Client Keys (DSN)
        */
        enabled: true,
        DSN: 'https://df07a245641c44768646ebc0b37a26f3@o4504628323680256.ingest.sentry.io/4504628365033472',
        tracesSampleRate: 1.0,
    },
    slack: {
        /*
            1. Goto https://api.slack.com/apps/
            2. Create your app
            3. On Settings - Basic Information - App Credentials, chose your Signing Secret
            4. Create a Slash Commands and put as Request URL: https://your.domain.name/slack
        */
        enabled: false,
        signingSecret: '',
    },
    mediasoup: {
        // Worker settings
        numWorkers: Object.keys(os.cpus()).length,
        worker: {
            rtcMinPort: 40000,
            rtcMaxPort: 40100,
            logLevel: 'error',
            logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
        },
        // Router settings
        router: {
            mediaCodecs: [
                {
                    kind: 'audio',
                    mimeType: 'audio/opus',
                    clockRate: 48000,
                    channels: 2,
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP8',
                    clockRate: 90000,
                    parameters: {
                        'x-google-start-bitrate': 1000,
                    },
                },
                {
                    kind: 'video',
                    mimeType: 'video/VP9',
                    clockRate: 90000,
                    parameters: {
                        'profile-id': 2,
                        'x-google-start-bitrate': 1000,
                    },
                },
                {
                    kind: 'video',
                    mimeType: 'video/h264',
                    clockRate: 90000,
                    parameters: {
                        'packetization-mode': 1,
                        'profile-level-id': '4d0032',
                        'level-asymmetry-allowed': 1,
                        'x-google-start-bitrate': 1000,
                    },
                },
                {
                    kind: 'video',
                    mimeType: 'video/h264',
                    clockRate: 90000,
                    parameters: {
                        'packetization-mode': 1,
                        'profile-level-id': '42e01f',
                        'level-asymmetry-allowed': 1,
                        'x-google-start-bitrate': 1000,
                    },
                },
            ],
        },
        // WebRtcTransport settings
        webRtcTransport: {
            listenIps: [
                {
                    ip: '62.171.169.98',
                    announcedIp: '62.171.169.98', // replace by public static IP address https://api.ipify.org or put '' and will be auto-detected on server start
                },
            ],
            initialAvailableOutgoingBitrate: 1000000,
            minimumAvailableOutgoingBitrate: 600000,
            maxSctpMessageSize: 262144,
            maxIncomingBitrate: 1500000,
        },
    },
};
