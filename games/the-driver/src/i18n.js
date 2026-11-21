// English and Swedish texts (V-4). Pure: no DOM. The language rules come from the kit (src/kit/lang.js): one current
// language for the whole game, set by main.js through src/kit/langdom.js. Speeds are shown in km/h (A-2).
// Keys by group: page and title, how to play, HUD, stage names and toasts, toasts for crashes and near misses, pause,
// end screen, flags line. The browser layer uses these keys as they are.
import { createI18n } from './kit/lang.js';

export const STRINGS = {
  en: {
    // page, title screen
    canvas: 'The Driver game view: the road seen from inside the car', language: 'Language',
    tagline: 'Three minutes behind the wheel. Weave through the evening traffic from afternoon to night without a scratch.',
    back: 'Back to games', start: 'Start driving', again: 'Drive again', title: 'Title',
    length_normal: 'Normal drive (3 min)', length_short: 'Short drive (1 min)',
    road_highway: 'Highway', road_country: 'Country road',
    diff_easy: 'Easy', diff_normal: 'Normal', diff_hard: 'Hard',
    bestScores: 'Best scores', scoresTitle: 'Best scores, {length}', noScores: 'No scores yet. Finish a drive to set one.',
    scoreRow: '{score} points · {stars} ★ · {difficulty}',
    controlsKeys: '←/→ or A/D: steer · ↑ / W: gas · ↓ / S / Space: brake · P / Esc: pause',
    controlsTouch: 'Touch: ◀ ▶ steer · GAS and BRAKE pedals bottom right · ⏸ pause',
    flags: 'Flags: {list}', flagSeed: 'seed {n}', flagRoad: 'country road', flagLanes: 'lane steering', flagManual: 'manual pedals',
    flagHard: 'hard crashes', flagHood: 'hood view', flagShort: 'short drive', flagDifficulty: '{difficulty} traffic',
    flagDebug: 'DEBUG (not saved to best scores)',
    // how to play
    howtoTitle: 'How to play',
    howto1: 'Steer with ← → (or the ◀ ▶ buttons). In curves the car is pushed outwards, so steer against it.',
    howto2: 'The car cruises at 110 km/h by itself. Hold the gas for more speed, use the brake when the road ahead is full.',
    howto1Lanes: 'Tap ← → (or the ◀ ▶ buttons) to move one lane over. The car follows the curves by itself.',
    howto2Manual: 'Hold the gas to speed up; let go and the car coasts. Use the brake when the road ahead is full.',
    howto3: 'Pass close to other cars at speed for near-miss bonuses. Every near miss in a row raises your multiplier.',
    howto4: 'Do not touch anyone. A crash costs points and most of your speed. Stay on the asphalt: the grass limits you to 60 km/h.',
    // HUD
    hudTime: 'Time', hudScore: 'Score', hudCrashes: 'Crashes', hudSpeed: 'km/h', hudStreak: 'x{n}', hudStage: 'Stage {n} of 3',
    hudCrashesOf: 'Crashes {n} of {max}', pauseBtn: 'Pause (P)', soundBtn: 'Sound',
    gas: 'Gas', brake: 'Brake', left: 'Left', right: 'Right', mirror: 'Rear-view mirror', speedometer: 'Speedometer',
    // stages and toasts
    stage_afternoon: 'Afternoon', stage_sunset: 'Sunset', stage_night: 'Night',
    toastStage_afternoon: 'Afternoon: open fields, light traffic',
    toastStage_sunset: 'Sunset: the forest road, more traffic',
    toastStage_night: 'Night: lights on, dense traffic',
    toastNearMiss: 'Near miss! +{points}', toastNearMissStreak: 'Near miss! +{points} (x{mult})',
    toastCrash: 'Crash! -{points}', toastWrecked: 'Wrecked!', toastOffroad: 'Off the road: 60 km/h',
    toastLastCrash: 'One more crash and the car is wrecked', toastFinish: 'You made it home!',
    // pause
    paused: '⏸ Paused', resume: 'Resume', soundOn: 'Sound: on', soundOff: 'Sound: off', quit: 'Quit to title',
    // end screen
    endDone: 'You made it home', endWrecked: 'Wrecked',
    endDoneText: 'The drive is over. Well driven!', endWreckedText: 'Three crashes were too many. The drive ends here.',
    endScore: 'Score', endStars: '{n} of 5 stars', endDistance: 'Distance', endDistanceValue: '{km} km',
    endTopSpeed: 'Top speed', endTopSpeedValue: '{n} km/h', endNearMisses: 'Near misses', endCrashes: 'Crashes',
    newBest: 'New best score! You are #{rank} on the {length} list.',
    notSaved: 'Not saved on this device (storage unavailable)',
    debugRun: 'Debug run: not saved to the best scores.',
  },
  sv: {
    canvas: 'Spelvy för The Driver: vägen sedd inifrån bilen', language: 'Språk',
    tagline: 'Tre minuter bakom ratten. Väj dig fram genom kvällstrafiken från eftermiddag till natt utan en skråma.',
    back: 'Tillbaka till spelen', start: 'Börja köra', again: 'Kör igen', title: 'Startskärm',
    length_normal: 'Vanlig tur (3 min)', length_short: 'Kort tur (1 min)',
    road_highway: 'Motorväg', road_country: 'Landsväg',
    diff_easy: 'Lätt', diff_normal: 'Normal', diff_hard: 'Svår',
    bestScores: 'Bästa resultat', scoresTitle: 'Bästa resultat, {length}', noScores: 'Inga resultat än. Kör klart en tur för att sätta ett.',
    scoreRow: '{score} poäng · {stars} ★ · {difficulty}',
    controlsKeys: '←/→ eller A/D: styr · ↑ / W: gas · ↓ / S / mellanslag: broms · P / Esc: paus',
    controlsTouch: 'Touch: ◀ ▶ styr · GAS och BROMS nere till höger · ⏸ paus',
    flags: 'Flaggor: {list}', flagSeed: 'seed {n}', flagRoad: 'landsväg', flagLanes: 'filstyrning', flagManual: 'manuella pedaler',
    flagHard: 'hårda krockar', flagHood: 'motorhuvsvy', flagShort: 'kort tur', flagDifficulty: 'trafik: {difficulty}',
    flagDebug: 'DEBUG (sparas inte bland bästa resultat)',
    howtoTitle: 'Så spelar du',
    howto1: 'Styr med ← → (eller knapparna ◀ ▶). I kurvorna trycks bilen utåt, så styr emot.',
    howto2: 'Bilen håller 110 km/h av sig själv. Håll gasen för mer fart och bromsa när vägen framför är full.',
    howto1Lanes: 'Tryck ← → (eller knapparna ◀ ▶) för att byta en fil. Bilen följer kurvorna av sig själv.',
    howto2Manual: 'Håll gasen för att öka farten; släpp den och bilen rullar ut. Bromsa när vägen framför är full.',
    howto3: 'Passera andra bilar tätt i hög fart för nära-på-bonus. Varje nära-på i rad höjer din multiplikator.',
    howto4: 'Rör ingen. En krock kostar poäng och det mesta av farten. Håll dig på asfalten: gräset begränsar dig till 60 km/h.',
    hudTime: 'Tid', hudScore: 'Poäng', hudCrashes: 'Krockar', hudSpeed: 'km/h', hudStreak: 'x{n}', hudStage: 'Etapp {n} av 3',
    hudCrashesOf: 'Krockar {n} av {max}', pauseBtn: 'Paus (P)', soundBtn: 'Ljud',
    gas: 'Gas', brake: 'Broms', left: 'Vänster', right: 'Höger', mirror: 'Backspegel', speedometer: 'Hastighetsmätare',
    stage_afternoon: 'Eftermiddag', stage_sunset: 'Solnedgång', stage_night: 'Natt',
    toastStage_afternoon: 'Eftermiddag: öppna fält, lite trafik',
    toastStage_sunset: 'Solnedgång: skogsvägen, mer trafik',
    toastStage_night: 'Natt: lyset på, tät trafik',
    toastNearMiss: 'Nära på! +{points}', toastNearMissStreak: 'Nära på! +{points} (x{mult})',
    toastCrash: 'Krock! -{points}', toastWrecked: 'Totalskadad!', toastOffroad: 'Utanför vägen: 60 km/h',
    toastLastCrash: 'En krock till och bilen är totalskadad', toastFinish: 'Du kom hem!',
    paused: '⏸ Paus', resume: 'Fortsätt', soundOn: 'Ljud: på', soundOff: 'Ljud: av', quit: 'Till startskärmen',
    endDone: 'Du kom hem', endWrecked: 'Totalskadad',
    endDoneText: 'Turen är slut. Bra körning!', endWreckedText: 'Tre krockar var för mycket. Turen slutar här.',
    endScore: 'Poäng', endStars: '{n} av 5 stjärnor', endDistance: 'Sträcka', endDistanceValue: '{km} km',
    endTopSpeed: 'Toppfart', endTopSpeedValue: '{n} km/h', endNearMisses: 'Nära på', endCrashes: 'Krockar',
    newBest: 'Nytt rekord! Du är nummer {rank} på listan för {length}.',
    notSaved: 'Sparas inte på den här enheten (lagring saknas)',
    debugRun: 'Debugkörning: sparas inte bland bästa resultat.',
  },
};

export const i18n = createI18n(STRINGS);
export const { LANGS, DEFAULT_LANG, normalizeLang, pickLang, getLang, setLang, t } = i18n;

// Where the start screen's "Back to games" link goes: the launcher, which reads ?lang= and remembers it.
export const backHref = (lang = getLang()) => `../../?lang=${normalizeLang(lang) || DEFAULT_LANG}`;

// 125 → '2:05' (a drive clock, m:ss).
export const clock = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
