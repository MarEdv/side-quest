// English and Swedish texts (V-3). Pure: no DOM. The language rules come from the kit (src/kit/lang.js): one current
// language for the whole game, set by main.js through src/kit/langdom.js. Station names and passenger names are not
// translated (A-1). Quest texts are looked up with questKey(type, kind) in quests.js: q_<type>_<kind>.
import { createI18n } from './kit/lang.js';

export const STRINGS = {
  en: {
    // page, title screen
    canvas: 'Train Attendant game view', language: 'Language',
    tagline: 'Walk the aisle, check tickets, serve coffee and keep the passengers calm from the first station to the last.',
    back: 'Back to games', start: 'Start the trip', again: 'Another trip', title: 'Title',
    trip_short: 'Short trip', trip_normal: 'Normal trip', trip_long: 'Long trip',
    diff_easy: 'Easy', diff_normal: 'Normal', diff_hard: 'Hard',
    bestScores: 'Best scores', scoresTitle: 'Best scores, {trip}', noScores: 'No scores yet. Finish a trip to set one.',
    scoreRow: '{score} points · {stars} ★ · {difficulty}',
    controlsKeys: '←/→ or A/D: walk · Space / E: action (hold for tickets and questions) · 1 2 3: pick at the café (0: put back) · Y / N: accept / decline · P / Esc: pause',
    controlsTouch: 'Touch: ◀ ▶ walk · the big button is the action (hold it) · café buttons at the counter · Accept / Decline for offers.',
    flags: 'Flags: {list}', flagSeed: 'seed {n}', flagCars: '{n} cars', flagContagious: 'contagious stress', flagAssign: 'quests assigned',
    flagDebug: 'DEBUG (not saved to best scores)',
    // HUD
    hudScore: 'Score', hudNext: 'Next: {station}', hudEta: '{time}', hudDelay: 'Delay {n} s', hudOnTime: 'On time',
    hudComplaints: 'Complaints', hudQuests: 'Quests', hudEmpty: 'Hands free',
    hudFollowers: 'Leading {n}', hudStation: 'At {station}', hudStopped: 'Stopped on the line',
    hudDeadline: '{n} s left', hudStopsLeft: 'Before {station}', pauseBtn: 'Pause (P)', soundBtn: 'Sound',
    left: 'Left', right: 'Right', action: 'Action',
    // needs and items
    need_ticket: 'Ticket', need_coffee: 'Coffee', need_snack: 'Snack', need_question: 'Question', need_seat: 'A seat',
    item_coffee: 'Coffee', item_snack: 'Snack', item_water: 'Water', item_kit: 'First-aid kit', item_bag: 'Lost bag',
    // café picker
    pickerTitle: 'Café counter', pickCoffee: '☕ Coffee', pickSnack: '🥪 Snack', pickWater: '💧 Water', pickNone: 'Put back',
    // offers
    radioTitle: 'Radio: train manager', accept: 'Accept', decline: 'Decline',
    // toasts
    toastServed: '{name}: {need}', toastComplaint: '{name} filed a complaint', toastLostFare: '{name} left without a ticket check',
    toastStation: 'Arrived at {station}', toastDepart: 'Leaving {station}', toastBoard: '{n} passengers boarded',
    toastAlight: '{n} passengers got off', toastSlip: 'Signal fault: {n} s late', toastStop: 'Stopped beside the broken-down train',
    toastSeated: '{name} sat down', toastFollow: '{name} follows you', toastOffer: 'Radio call from the train manager',
    toastExpired: 'The offer expired', toastDeclined: 'Declined', toastCancelled: 'The quest is no longer possible',
    toastHandsFull: 'Hands full: put it back at the café first', toastPicked: 'Picked up: {item}', toastBagFound: 'Found the bag!', toastRadioed: 'Connection radioed',
    // quests: offer (radio text), goal (HUD line), done, failed
    q_rescue_title: 'Rescue', q_rescue_offer: 'A train has broken down ahead. Pick up its {n} passengers on the way to {station}?',
    q_rescue_goal: 'Seat all {n} rescued passengers before {station}',
    q_rescue_wait: 'Wait for the stop beside the broken-down train',
    q_rescue_done: 'All {n} rescued passengers are seated. Well done!', q_rescue_failed: 'Not everyone was seated in time.',
    q_connection_title: 'Connection', q_connection_offer: '{name} must catch a connection at {station}. Can you help?',
    q_connection_goal: 'Radio the connection from the cab (hold)', q_connection_goalTell: 'Tell {name} the platform: {platform}',
    q_connection_done: '{name} will catch the connection on platform {platform}!',
    q_connection_rebooked: 'The connection left. {name} was rebooked on the next train.',
    q_connection_failed: '{name} missed the connection at {station}.',
    q_nervous_title: 'Nervous passenger', q_nervous_offer: '{name} is panicking. Can you calm them down?',
    q_nervous_goal: 'Talk to {name} ({done}/{n}) or bring water', q_nervous_done: '{name} is calm again.',
    q_nervous_failed: '{name} could not be calmed down.',
    q_lost_title: 'Lost bag', q_lost_offer: '{name} lost a bag somewhere on the train. Find it?',
    q_lost_goal: 'Find {name}\'s bag in car {car}', q_lost_goalGive: 'Give the bag back to {name}',
    q_lost_done: '{name} has the bag back!', q_lost_failed: '{name} left without the bag.',
    q_sick_title: 'Sick passenger', q_sick_offer: '{name} feels sick. Fetch the first-aid kit from the cab?',
    q_sick_goal: 'Fetch the first-aid kit from the cab', q_sick_goalGive: 'Bring the kit to {name}',
    q_sick_done: '{name} feels much better.', q_sick_failed: 'The kit came too late for {name}.',
    // pause
    paused: '⏸ Paused', resume: 'Resume', soundOn: 'Sound: on', soundOff: 'Sound: off', quit: 'Quit to title',
    // end screen
    endTitle: 'End of the line', endScore: 'Score', endStars: '{n} of 5 stars', endCarried: 'Passengers carried',
    endCalm: 'Calm arrivals', endComplaints: 'Complaints', endQuestsDone: 'Quests done', endQuestsFailed: 'Quests failed',
    endQuestsDeclined: 'Quests declined', endTime: 'Trip time', newBest: 'New best score! You are #{rank} on the {trip} list.',
    notSaved: 'Not saved on this device (storage unavailable)',
    debugRun: 'Debug run: not saved to the best scores.',
    // title: how to play, toasts added by the browser layer
    howtoTitle: 'How to play',
    howto1: 'Walk the aisle to passengers with a bubble above them: 🎫 ticket, ❓ question, ☕ 🥪 drink or snack, 💺 seat.',
    howto2: 'Hold the action next to a passenger to check a ticket or answer a question.',
    howto3: 'Fetch coffee and snacks at the café counter in the middle car, then hand them over. Lead standing passengers to a free seat.',
    howto4: 'Accept the radio quests that suit you and keep an eye on the clock. The calmer the train, the more stars.',
    toastAccepted: 'Quest accepted: {quest}', toastFollowers: 'Leading {n}',
  },
  sv: {
    canvas: 'Spelvy för Tågvärd', language: 'Språk',
    tagline: 'Gå längs gången, kontrollera biljetter, servera kaffe och håll passagerarna lugna från första till sista stationen.',
    back: 'Tillbaka till spelen', start: 'Starta resan', again: 'En resa till', title: 'Startskärm',
    trip_short: 'Kort resa', trip_normal: 'Vanlig resa', trip_long: 'Lång resa',
    diff_easy: 'Lätt', diff_normal: 'Normal', diff_hard: 'Svår',
    bestScores: 'Bästa poäng', scoresTitle: 'Bästa poäng, {trip}', noScores: 'Inga poäng än. Slutför en resa för att sätta en.',
    scoreRow: '{score} poäng · {stars} ★ · {difficulty}',
    controlsKeys: '←/→ eller A/D: gå · Mellanslag / E: handling (håll in för biljetter och frågor) · 1 2 3: välj i caféet (0: lägg tillbaka) · Y / N: ta emot / avböj · P / Esc: paus',
    controlsTouch: 'Pekskärm: ◀ ▶ gå · den stora knappen är handlingen (håll in) · caféknappar vid disken · Ta emot / Avböj för uppdrag.',
    flags: 'Flaggor: {list}', flagSeed: 'frö {n}', flagCars: '{n} vagnar', flagContagious: 'smittsam stress', flagAssign: 'uppdrag tilldelas',
    flagDebug: 'FELSÖKNING (sparas inte bland bästa poäng)',
    hudScore: 'Poäng', hudNext: 'Nästa: {station}', hudEta: '{time}', hudDelay: 'Försenad {n} s', hudOnTime: 'I tid',
    hudComplaints: 'Klagomål', hudQuests: 'Uppdrag', hudEmpty: 'Tomma händer',
    hudFollowers: 'Leder {n}', hudStation: 'Vid {station}', hudStopped: 'Stopp på linjen',
    hudDeadline: '{n} s kvar', hudStopsLeft: 'Före {station}', pauseBtn: 'Paus (P)', soundBtn: 'Ljud',
    left: 'Vänster', right: 'Höger', action: 'Handling',
    need_ticket: 'Biljett', need_coffee: 'Kaffe', need_snack: 'Mellanmål', need_question: 'Fråga', need_seat: 'Sittplats',
    item_coffee: 'Kaffe', item_snack: 'Mellanmål', item_water: 'Vatten', item_kit: 'Förbandslåda', item_bag: 'Borttappad väska',
    pickerTitle: 'Cafédisken', pickCoffee: '☕ Kaffe', pickSnack: '🥪 Mellanmål', pickWater: '💧 Vatten', pickNone: 'Lägg tillbaka',
    radioTitle: 'Radio: tågchefen', accept: 'Ta emot', decline: 'Avböj',
    toastServed: '{name}: {need}', toastComplaint: '{name} lämnade ett klagomål', toastLostFare: '{name} gick av utan biljettkontroll',
    toastStation: 'Framme i {station}', toastDepart: 'Lämnar {station}', toastBoard: '{n} passagerare klev på',
    toastAlight: '{n} passagerare klev av', toastSlip: 'Signalfel: {n} s försening', toastStop: 'Stannade vid det havererade tåget',
    toastSeated: '{name} satte sig', toastFollow: '{name} följer dig', toastOffer: 'Radioanrop från tågchefen',
    toastExpired: 'Erbjudandet gick ut', toastDeclined: 'Avböjt', toastCancelled: 'Uppdraget går inte längre att göra',
    toastHandsFull: 'Händerna är fulla: lägg tillbaka det i caféet först', toastPicked: 'Plockade upp: {item}', toastBagFound: 'Hittade väskan!', toastRadioed: 'Anslutningen är kontaktad',
    q_rescue_title: 'Räddning', q_rescue_offer: 'Ett tåg har gått sönder längre fram. Hämta dess {n} passagerare på vägen till {station}?',
    q_rescue_goal: 'Ge alla {n} räddade passagerare en sittplats före {station}',
    q_rescue_wait: 'Vänta på stoppet vid det havererade tåget',
    q_rescue_done: 'Alla {n} räddade passagerare sitter. Bra jobbat!', q_rescue_failed: 'Alla hann inte få en plats.',
    q_connection_title: 'Anslutning', q_connection_offer: '{name} ska hinna med en anslutning i {station}. Kan du hjälpa till?',
    q_connection_goal: 'Kontakta anslutningen via radio från förarhytten (håll in)', q_connection_goalTell: 'Tala om för {name} vilket spår: {platform}',
    q_connection_done: '{name} hinner med anslutningen på spår {platform}!',
    q_connection_rebooked: 'Anslutningen hade gått. {name} fick en ombokning med nästa tåg.',
    q_connection_failed: '{name} missade anslutningen i {station}.',
    q_nervous_title: 'Nervös passagerare', q_nervous_offer: '{name} får panik. Kan du lugna ner hen?',
    q_nervous_goal: 'Prata med {name} ({done}/{n}) eller ge vatten', q_nervous_done: '{name} är lugn igen.',
    q_nervous_failed: '{name} gick inte att lugna.',
    q_lost_title: 'Borttappad väska', q_lost_offer: '{name} har tappat en väska någonstans på tåget. Hitta den?',
    q_lost_goal: 'Hitta {name}s väska i vagn {car}', q_lost_goalGive: 'Ge tillbaka väskan till {name}',
    q_lost_done: '{name} fick tillbaka väskan!', q_lost_failed: '{name} gick av utan väskan.',
    q_sick_title: 'Sjuk passagerare', q_sick_offer: '{name} mår illa. Hämta förbandslådan i förarhytten?',
    q_sick_goal: 'Hämta förbandslådan i förarhytten', q_sick_goalGive: 'Ge lådan till {name}',
    q_sick_done: '{name} mår mycket bättre.', q_sick_failed: 'Lådan kom för sent till {name}.',
    paused: '⏸ Pausat', resume: 'Fortsätt', soundOn: 'Ljud: på', soundOff: 'Ljud: av', quit: 'Till startskärmen',
    endTitle: 'Slutstation', endScore: 'Poäng', endStars: '{n} av 5 stjärnor', endCarried: 'Resenärer som åkt med',
    endCalm: 'Lugna ankomster', endComplaints: 'Klagomål', endQuestsDone: 'Uppdrag klarade', endQuestsFailed: 'Uppdrag misslyckade',
    endQuestsDeclined: 'Uppdrag avböjda', endTime: 'Restid', newBest: 'Nytt rekord! Du är nummer {rank} på listan för {trip}.',
    notSaved: 'Sparas inte på den här enheten (lagring ej tillgänglig)',
    debugRun: 'Felsökningsläge: sparas inte bland bästa poäng.',
    howtoTitle: 'Så spelar du',
    howto1: 'Gå längs gången till passagerare med en pratbubbla: 🎫 biljett, ❓ fråga, ☕ 🥪 dryck eller mellanmål, 💺 plats.',
    howto2: 'Håll in handlingen bredvid en passagerare för att kontrollera biljetten eller svara på en fråga.',
    howto3: 'Hämta kaffe och mellanmål vid cafédisken i mittenvagnen och lämna över dem. Led stående passagerare till en ledig plats.',
    howto4: 'Ta emot de radiouppdrag som passar dig och håll koll på klockan. Ju lugnare tåg, desto fler stjärnor.',
    toastAccepted: 'Uppdrag antaget: {quest}', toastFollowers: 'Leder {n}',
  },
};

export const i18n = createI18n(STRINGS);
export const { LANGS, DEFAULT_LANG, normalizeLang, pickLang, getLang, setLang, t } = i18n;

// Where the start screen's "Back to games" link goes: the launcher, which reads ?lang= and remembers it.
export const backHref = (lang = getLang()) => `../../?lang=${normalizeLang(lang) || DEFAULT_LANG}`;

// 125 → '2:05' (a trip clock, m:ss).
export const clock = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
