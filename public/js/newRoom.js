'use strict';

let adjectives = [
    'theGreat',
    'fancy',
    'large',
    'coolest',
    'awesome',
    'monster',
    'shiny',
    'goodold',
    'rocking',
    'nice',
    'sick',
    'cool',
    'hot',
    'cold',
    'warm',
    'hungry',
    'slow',
    'fast',
    'red',
    'white',
    'black',
    'blue',
    'green',
    'basic',
    'strong',
    'cute',
    'poor',
    'nice',
    'huge',
    'rare',
    'lucky',
    'weak',
    'tall',
    'short',
    'tiny',
    'great',
    'long',
    'single',
    'rich',
    'young',
    'dirty',
    'fresh',
    'brown',
    'dark',
    'crazy',
    'sad',
    'loud',
    'brave',
    'calm',
    'silly',
    'smart',
];

let nouns = [
    'Bowie',
    'PinkFloyd',
    'LedZeppelin',
    'Beatles',
    'Nirvana',
    'Cohen',
    'Presley',
    'DireStraits',
    'DeepPurple',
    'Santana',
    'Brel',
    'Gainsbourg',
    'Bowie',
    'DVL',
    'WhiteStripes',
    'RollingStones',
    'RoxyMusic',
    'KingCrimson',
    'ZZTop',
    'Ramones',
    'Journey',
    'MotleyCrue',
    'PearlJam',
    'Marillion',
    'CreedenceClearwaterRevival',
    'Doors',
    'LynyrdSkynyrd',
    'Slade',
    'Springsteen',
    'Tool',
    'JudasPriest',
    'Genesis',
    'Muse',
    'Motorhead',
    'FooFighters',
    'U2',
    'BonJovi',
    'ThinLizzy',
    'Dylan',
    'Hendrix',
    'Eagles',
    'Aerosmith',
    'Kiss',
    'VanHalen',
    'DefLeppard',
    'TheWho',
    'GunsNRoses',
    'IronMaiden',
    'Metallica',
    'BlackSabbath',
    'Rush',
    'Queen',
    'Ramones',
    
];

function getRandomNumber(length) {
    let result = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

let adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
let noun = nouns[Math.floor(Math.random() * nouns.length)];
let num = getRandomNumber(5);
noun = noun.charAt(0).toUpperCase() + noun.substring(1);
adjective = adjective.charAt(0).toUpperCase() + adjective.substring(1);
document.getElementById('roomName').value = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// ####################################################
// TYPING EFFECT
// ####################################################

let i = 0;
let txt = num + adjective + noun;
let speed = 100;

function typeWriter() {
    if (i < txt.length) {
        document.getElementById('roomName').value += txt.charAt(i);
        i++;
        setTimeout(typeWriter, speed);
    }
}

typeWriter();
