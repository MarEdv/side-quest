// English and Swedish (P-6, D-31, D-33). Pure: no DOM. The language rules come from the kit (src/kit/lang.js): one
// current language for the whole game (setLang), so pure modules can build player-facing text with t() without passing
// a language around; it starts as English, which is also what the Node tests see. main.js picks the language through
// src/kit/langdom.js (?lang= > saved > browser > English) and re-renders on a change.
//
// Two kinds of text:
//   t(key, vars)  UI strings, by key (STRINGS).
//   tx(english)   Text that lives in data tables (levels, quests, settings, end messages): the tables keep their English
//                 text and tx() looks up the Swedish one (TEXT_SV), so stored data and tests stay language-free.
import { createI18n } from './kit/lang.js';

export const STRINGS = {
  en: {
    language: 'Language',
    // main menu
    tagline: 'Finish the garden before sunset. Your wife has other plans.',
    levels: 'Levels', unlockedOf: '{n} of {total} unlocked', arcade: 'Arcade', settings: 'Settings', highScores: 'High scores',
    menuNote: 'Arcade uses your Settings. Levels use their own.',
    // high scores
    colRank: '#', colScore: 'Score', colResult: 'Result', colDate: 'Date', colMode: 'Mode', won: 'Won', lost: 'Lost',
    noArcade: 'No Arcade scores yet. Finish a day to get on the board.',
    colLevel: 'Level', colBest: 'Best', colWon: 'Won',
    clearWarn: 'Clear all saved scores AND level progress? Every level you unlocked locks again (only Level 1 stays open). This cannot be undone.',
    clearYes: 'Yes, clear scores and progress', cancel: 'Cancel', clearScores: 'Clear scores', back: 'Back', backToGames: 'Back to games',
    scoresBlocked: 'Storage is blocked here: scores last only until you close the page.',
    // pause and end
    levelLine: 'Level {n}: {name}', resume: 'Resume', quitToMenu: 'Quit to menu',
    nextLevel: 'Next level', retry: 'Retry', retryR: 'Retry (R)', menu: 'Menu', playAgain: 'Play again', playAgainR: 'Play again (R)',
    newHigh: 'New high score!', rankOnBoard: '#{rank} on your board', best: 'Best: {n}',
    newBest: 'New best!', levelBest: 'Level best: {n}', unlocked: '{name} unlocked!',
    debugNote: 'Debug run: not recorded',
    // levels
    notPlayed: 'Not played yet', winToUnlock: 'Win {name} to unlock it.', prevLevel: 'the previous level',
    lockedBadge: '\u{1F512} Locked', wonBadge: '✓ Won', wonPrefix: 'Won. ', levelOf: 'Level {n} of {total}',
    wonSuffix: '  ·  ✓ won', start: 'Start',
    questsAtATime: '{n} quests at a time', questAtATime: '1 quest at a time', dayLength: '{n} s day',
    // install
    installTitle: 'Install Garden Day', iosIntro: 'iPhone and iPad have no install button, but it takes three taps:',
    step1a: 'Tap the ', share: 'Share', step1b: ' button. Safari shows it in the toolbar; other browsers keep it in their menu or address bar.',
    step2a: 'Scroll the sheet and tap ', addHome: 'Add to Home Screen', step2b: '.',
    step3a: 'Tap ', add: 'Add', step3b: '. Garden Day now opens full-screen from your home screen and works offline.',
    installApp: 'Install app', installGroup: 'Install the app',
    invite: 'Add Garden Day to your home screen to play it like an app, even offline.',
    notNow: 'Not now', neverAsk: "Don't ask again",
    // settings screen
    dayInProgress: 'A day is in progress: changes start with the next day.',
    lockedNote: 'Set by link ({link}). Use "Clear link overrides" to change it.',
    savedNext: 'Saved. Applies from the next day.',
    resetConfirmLinks: 'Reset all saved settings to defaults? Settings set by the link stay until you clear the link.',
    resetConfirm: 'Reset all settings to defaults?',
    clearLinks: 'Clear link overrides', resetDefaults: 'Reset to defaults', yesReset: 'Yes, reset',
    settingsBlocked: 'Storage is blocked here: settings last only until you close the page.',
    inactiveHybrid: 'Hybrid mode always roams', inactiveVision: 'Only in vision mode',
    inactiveRange: 'Only in vision and hybrid mode', inactiveTouch: 'Only when touch controls are on',
    badSeed: 'Type "random" or a whole number.', badInt: 'Enter a whole number from {min} to {max}.',
    badNumber: 'Enter a number from {min} to {max}.', badValue: 'Not a valid value.',
    // canvas
    harmony: 'Harmony', chores: 'Chores {done}/{total}', carrying: 'Carrying: {title}', levelHud: 'L{n} · {name}',
    sideQuests: 'Side quests', fetch: 'fetch', deliver: 'deliver', deliverTo: 'Deliver: {label}',
    paused: 'PAUSED', tapResume: 'Tap to resume', keyResume: 'Press P or Esc to resume',
    dayComplete: 'DAY COMPLETE!', harmonyLost: 'HARMONY LOST', sunset: 'SUNSET',
    choresDone: 'Chores done', questsCompleted: 'Quests completed', questsFailed: 'Quests failed', questsAvoided: 'Quests avoided',
    score: 'Score',
    // controls hint, rotate chip, touch overlay
    hintKeys: 'WASD / arrows: move · hold Space or E: work / interact · P or Esc: pause · R: restart',
    hintJoystick: 'Left thumb: steer · hold WORK: work / interact · II: pause',
    hintTap: 'Tap / drag: walk · hold on a task: work · II: pause',
    rotate: 'Rotate your phone for a bigger view', dismiss: 'Dismiss', work: 'WORK', pause: 'Pause',
  },
  sv: {
    language: 'Språk',
    tagline: 'Gör klart trädgården före solnedgången. Din fru har andra planer.',
    levels: 'Banor', unlockedOf: '{n} av {total} upplåsta', arcade: 'Arkad', settings: 'Inställningar', highScores: 'Topplista',
    menuNote: 'Arkad använder dina inställningar. Banorna har egna.',
    colRank: '#', colScore: 'Poäng', colResult: 'Resultat', colDate: 'Datum', colMode: 'Läge', won: 'Vann', lost: 'Förlorade',
    noArcade: 'Inga arkadpoäng än. Spela klart en dag för att komma med på listan.',
    colLevel: 'Bana', colBest: 'Bästa', colWon: 'Vunnen',
    clearWarn: 'Rensa alla sparade poäng OCH banframsteg? Alla banor du har låst upp låses igen (bara bana 1 är öppen). Det går inte att ångra.',
    clearYes: 'Ja, rensa poäng och framsteg', cancel: 'Avbryt', clearScores: 'Rensa poäng', back: 'Tillbaka', backToGames: 'Tillbaka till spelen',
    scoresBlocked: 'Lagring är blockerad här: poängen finns bara kvar tills du stänger sidan.',
    levelLine: 'Bana {n}: {name}', resume: 'Fortsätt', quitToMenu: 'Avsluta till menyn',
    nextLevel: 'Nästa bana', retry: 'Försök igen', retryR: 'Försök igen (R)', menu: 'Meny', playAgain: 'Spela igen', playAgainR: 'Spela igen (R)',
    newHigh: 'Nytt rekord!', rankOnBoard: 'Plats {rank} på din lista', best: 'Bästa: {n}',
    newBest: 'Nytt personbästa!', levelBest: 'Banans bästa: {n}', unlocked: '{name} är upplåst!',
    debugNote: 'Felsökningsläge: sparas inte',
    notPlayed: 'Inte spelad än', winToUnlock: 'Vinn {name} för att låsa upp den.', prevLevel: 'föregående bana',
    lockedBadge: '\u{1F512} Låst', wonBadge: '✓ Vunnen', wonPrefix: 'Vunnen. ', levelOf: 'Bana {n} av {total}',
    wonSuffix: '  ·  ✓ vunnen', start: 'Starta',
    questsAtATime: '{n} uppdrag åt gången', questAtATime: '1 uppdrag åt gången', dayLength: '{n} s lång dag',
    installTitle: 'Installera Garden Day', iosIntro: 'iPhone och iPad har ingen installationsknapp, men det räcker med tre tryck:',
    step1a: 'Tryck på knappen ', share: 'Dela', step1b: '. Safari visar den i verktygsfältet; andra webbläsare har den i menyn eller adressfältet.',
    step2a: 'Scrolla i panelen och tryck på ', addHome: 'Lägg till på hemskärmen', step2b: '.',
    step3a: 'Tryck på ', add: 'Lägg till', step3b: '. Garden Day öppnas nu i helskärm från hemskärmen och fungerar offline.',
    installApp: 'Installera appen', installGroup: 'Installera appen',
    invite: 'Lägg Garden Day på hemskärmen och spela som en app, även offline.',
    notNow: 'Inte nu', neverAsk: 'Fråga inte igen',
    dayInProgress: 'En dag pågår: ändringarna gäller från nästa dag.',
    lockedNote: 'Satt av länken ({link}). Använd ”Rensa länkens inställningar” för att ändra den.',
    savedNext: 'Sparat. Gäller från nästa dag.',
    resetConfirmLinks: 'Återställ alla sparade inställningar? Inställningar från länken ligger kvar tills du rensar länken.',
    resetConfirm: 'Återställ alla inställningar?',
    clearLinks: 'Rensa länkens inställningar', resetDefaults: 'Återställ standard', yesReset: 'Ja, återställ',
    settingsBlocked: 'Lagring är blockerad här: inställningarna finns bara kvar tills du stänger sidan.',
    inactiveHybrid: 'Hybridläget går alltid runt', inactiveVision: 'Bara i synläget',
    inactiveRange: 'Bara i syn- och hybridläget', inactiveTouch: 'Bara när pekkontrollerna är på',
    badSeed: 'Skriv ”random” eller ett heltal.', badInt: 'Ange ett heltal från {min} till {max}.',
    badNumber: 'Ange ett tal från {min} till {max}.', badValue: 'Inte ett giltigt värde.',
    harmony: 'Harmoni', chores: 'Sysslor {done}/{total}', carrying: 'Bär: {title}', levelHud: 'B{n} · {name}',
    sideQuests: 'Sidouppdrag', fetch: 'hämta', deliver: 'lämna', deliverTo: 'Lämna: {label}',
    paused: 'PAUSAT', tapResume: 'Tryck för att fortsätta', keyResume: 'Tryck P eller Esc för att fortsätta',
    dayComplete: 'DAGEN ÄR KLAR!', harmonyLost: 'HARMONIN ÄR BORTA', sunset: 'SOLNEDGÅNG',
    choresDone: 'Klara sysslor', questsCompleted: 'Klarade uppdrag', questsFailed: 'Missade uppdrag', questsAvoided: 'Undvikna uppdrag',
    score: 'Poäng',
    hintKeys: 'WASD / pilar: gå · håll Space eller E: arbeta / interagera · P eller Esc: paus · R: börja om',
    hintJoystick: 'Vänster tumme: styr · håll JOBBA: arbeta / interagera · II: paus',
    hintTap: 'Tryck / dra: gå · håll på en syssla: arbeta · II: paus',
    rotate: 'Vrid telefonen för en större bild', dismiss: 'Stäng', work: 'JOBBA', pause: 'Paus',
  },
};

// Swedish for the English text in data tables: levels.js, quests.js, game.js (end messages, the wife's line), the
// settings.js screen layout and the settingsSummary() words stored with Arcade scores.
export const TEXT_SV = {
  // levels
  'Saturday Morning': 'Lördagsmorgon',
  'A quiet start: she only sees you from the patio, and one errand at a time.': 'En lugn start: hon ser dig bara från altanen, och ett ärende åt gången.',
  'Honey-Do List': 'Fixarlistan',
  'New: she calls errands out wherever you are, so there is nowhere to hide. Two at a time.': 'Nytt: hon ropar ut ärenden var du än är, så det finns ingenstans att gömma sig. Två åt gången.',
  'Eyes Everywhere': 'Ögon överallt',
  'New: she walks the garden and sees farther, and she comes out more often. Stay behind cover.': 'Nytt: hon går runt i trädgården och ser längre, och hon kommer ut oftare. Håll dig i skydd.',
  'The Inspection': 'Inspektionen',
  'New: if she misses you she may call an errand anyway. She comes out often, hard, three at a time, a shorter day.': 'Nytt: om hon inte ser dig kan hon ropa ut ett ärende ändå. Hon kommer ut ofta, svår nivå, tre åt gången och en kortare dag.',
  // quests
  Groceries: 'Matkassar', Glasses: 'Glasögon', Mail: 'Posten', Cat: 'Katten', 'Trash bins': 'Soptunnor',
  'Honey, can you grab the groceries from the car?': 'Älskling, kan du hämta matkassarna i bilen?',
  'I left my glasses on the garden bench!': 'Jag glömde glasögonen på trädgårdsbänken!',
  'Could you check the mailbox?': 'Kan du kolla brevlådan?',
  'The cat is stuck in the tree again...': 'Katten sitter fast i trädet igen...',
  'Bins go out to the curb today, dear.': 'Soptunnorna ska ut till trottoaren i dag, kära du.',
  Car: 'Bilen', Bench: 'Bänken', Mailbox: 'Brevlådan', Tree: 'Trädet', Bins: 'Tunnorna',
  'Wife at the door': 'Frun vid dörren', 'The curb': 'Trottoarkanten',
  // game
  'The garden is spotless. Dinner is served!': 'Trädgården är skinande fin. Middagen är serverad!',
  'Sleeping on the couch tonight.': 'Det blir soffan i natt.',
  'The sun set on a half-finished garden.': 'Solen gick ner över en halvfärdig trädgård.',
  'Oh, you look busy. Carry on!': 'Åh, du ser upptagen ut. Fortsätt du!',
  // settings screen
  Gameplay: 'Spel',
  'Applies from the next day. Levels use their own gameplay settings.': 'Gäller från nästa dag. Banorna har egna spelinställningar.',
  'Wife mode': 'Fruns läge',
  'Vision: quests only when she sees you (avoidable). Random: quests on a timer wherever you are. Hybrid: she roams and looks for you, and if she misses you she may call a quest anyway.': 'Syn: uppdrag bara när hon ser dig (går att undvika). Slump: uppdrag på tid var du än är. Hybrid: hon går runt och letar efter dig, och om hon inte ser dig kan hon ropa ut ett uppdrag ändå.',
  'Vision (avoidable)': 'Syn (går att undvika)', 'Random (on a timer)': 'Slump (på tid)', 'Hybrid (looks, then may call)': 'Hybrid (letar, ropar kanske)',
  'Wife roams the garden': 'Frun går runt i trädgården',
  'Vision mode: she walks into the garden and sweeps the cone before going home. Off: she stays on the patio.': 'Synläge: hon går ut i trädgården och sveper med blicken innan hon går in. Av: hon stannar på altanen.',
  Difficulty: 'Svårighetsgrad',
  'Easy: chores and quests take 0.75x as long, longer deadlines. Hard: 1.25x, shorter deadlines.': 'Lätt: sysslor och uppdrag tar 0,75 gånger så lång tid, längre tidsfrister. Svår: 1,25 gånger, kortare tidsfrister.',
  Easy: 'Lätt', Normal: 'Normal', Hard: 'Svår',
  'Day length (seconds)': 'Dagens längd (sekunder)', 'Real seconds from 09:00 to sunset at 18:00.': 'Verkliga sekunder från 09:00 till solnedgången kl. 18:00.',
  'Max side quests at once': 'Max antal sidouppdrag samtidigt', 'Cap on simultaneous side quests (0 = none).': 'Tak för samtidiga sidouppdrag (0 = inga).',
  'Quest interval (seconds)': 'Uppdragsintervall (sekunder)', 'Mean seconds she stays inside between appearances.': 'Genomsnittligt antal sekunder hon stannar inne mellan besöken.',
  'Vision range (px)': 'Synvidd (px)', 'How far she can see (cone length).': 'Hur långt hon ser (konens längd).',
  Controls: 'Kontroller', 'Applies immediately.': 'Gäller direkt.',
  'Touch controls': 'Pekkontroller', 'Auto: on touch devices and after the first touch. On: always. Off: never.': 'Auto: på pekskärmar och efter första tryckningen. På: alltid. Av: aldrig.',
  Auto: 'Auto', On: 'På', Off: 'Av',
  'Touch scheme': 'Pekstyrning',
  'Joystick: floating stick plus a WORK button. Tap: tap or drag to walk, hold on a task to work.': 'Joystick: flytande spak plus en JOBBA-knapp. Tryck: tryck eller dra för att gå, håll på en syssla för att arbeta.',
  Joystick: 'Joystick', 'Tap to walk': 'Tryck för att gå',
  'Display & sound': 'Visning och ljud',
  'Show her vision cone': 'Visa hennes synfält', "Draw the wife's vision cone.": 'Rita fruns synkon.',
  Sound: 'Ljud', 'WebAudio blips.': 'WebAudio-pip.',
  Advanced: 'Avancerat', 'Seed applies from the next day; debug immediately.': 'Fröet gäller från nästa dag, felsökning direkt.',
  'Random seed': 'Slumpfrö', 'Type "random", or a whole number to replay the same day.': 'Skriv ”random”, eller ett heltal för att spela samma dag igen.',
  'Debug overlay': 'Felsökningslager',
  'Show hitboxes, FPS and state. Days played in debug are not recorded as high scores.': 'Visa träffytor, FPS och tillstånd. Dagar som spelas i felsökningsläge kommer inte med på topplistan.',
  // settingsSummary() words (config.js), e.g. "vision·roam·normal"
  vision: 'syn', random: 'slump', hybrid: 'hybrid', roam: 'rör sig', patio: 'altan', easy: 'lätt', normal: 'normal', hard: 'svår',
};

// LANGS, normalizeLang, pickLang (?lang= > saved > browser > English), getLang / setLang and
// t('best', { n: 5 }) (missing keys fall back to English, then to the key) come from the kit.
export const i18n = createI18n(STRINGS);
export const { LANGS, DEFAULT_LANG, normalizeLang, pickLang, getLang, setLang, t } = i18n;

// Where the main menu's "Back to games" link goes: the launcher, which reads ?lang= and remembers it (S-12).
export const backHref = (lang = getLang()) => `../../?lang=${normalizeLang(lang) || DEFAULT_LANG}`;

// Data-table text in the current language (English text without a translation is shown as is).
export const tx = (english, lang = getLang()) => (lang === 'sv' && english != null && TEXT_SV[english]) || english;

// A stored settingsSummary() ("vision·roam·normal") with each word translated.
export const summaryText = (summary, lang = getLang()) => String(summary || '').split('·').map((w) => tx(w, lang)).join('·');

// Locale for dates in the score table: undefined = the browser's own.
export const dateLocale = (lang = getLang()) => (lang === 'sv' ? 'sv-SE' : undefined);
