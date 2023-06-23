'use strict';

const fetch = require('node-fetch');

const API_KEY = 'featlytalksfu_default_secret';
// const FEATLYTALK_URL = 'https://featly.io/api/v1/join';
const FEATLYTALK_URL = 'https://localhost:3010/api/v1/join';

function getResponse() {
    return fetch(FEATLYTALK_URL, {
        method: 'POST',
        headers: {
            authorization: API_KEY,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            room: 'test',
            password: false,
            name: 'featlytalksfu',
            audio: true,
            video: true,
            screen: true,
            notify: true,
        }),
    });
}

getResponse().then(async (res) => {
    console.log('Status code:', res.status);
    const data = await res.json();
    console.log('join:', data.join);
});
