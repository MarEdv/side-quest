// English and Swedish texts (F13, D19). Pure; no DOM access. main.js picks the language, render.js draws with it.
// Task and station names stay English in world.js (the game logic uses them as ids); NAMES translates them for display.

export const LANGS = ['en', 'sv'];
export const DEFAULT_LANG = 'en';

export const STRINGS = {
  en: {
    canvas: 'Poo Sandwich game',
    pause: 'Pause',
    tagline: 'Survive the office day, 09:00 to 17:00.',
    howtoTasks: '✅ Do your to-do list: stand at the station shown (☕ 🖨️ 📅 💻 🗄️ 🖥️) until the ring fills.',
    howtoBoss: '😠 The boss <b>winds up with a "!"</b> and throws poo sandwiches. Move out of the way!',
    pooRuleChoice: '💩 Dodged sandwiches stay on the floor for a few seconds. <b>Walk over one to take the challenge</b> for bonus points, or ignore it (a little stress). A direct hit gives you the task anyway.',
    pooRuleHit: '💩 If a sandwich <b>hits you</b>, you get an urgent poo task with a deadline. Solve it at its station before time runs out!',
    howtoStress: '😰 Keep <b>stress</b> below 100%. Missed deadlines hurt most.',
    controlsJoystick: 'Drag on the left half of the screen to steer (virtual joystick).',
    controlsTap: 'Tap or click where you want the worker to walk.',
    controlsAuto: 'Keyboard: WASD / arrows to move, P or Esc to pause. Mouse: click to walk. Touch: drag on the left half as a joystick.',
    start: 'Start work day',
    best: 'Best score: {n}',
    language: 'Language',
    paused: '⏸ Paused',
    pausedText: 'The boss is also on a break. Probably.',
    resume: 'Resume',
    quit: 'Quit to title',
    score: 'Score',
    again: 'Play again',
    menu: 'Title',
    wonTitle: '🎉 Survived the day!',
    lostTitle: '🔥 Burnout!',
    wonText: '17:00. You clocked out with {stress}% stress. Calm bonus: +{bonus}.',
    lostText: 'Stress hit 100%. HR sends you a mug that says "Resilience".',
    newBest: '🏆 New best score!',
    stats: 'Tasks {tasks} · Poo tasks solved {poo} · Hits {hits} · Dodged {dodged} · Missed deadlines {missed}',
    fxSolved: '+{n} Solved!',
    fxHit: 'SPLAT! 💩',
    fxDodged: 'Dodged!',
    fxExpired: 'Deadline missed!',
    fxOverload: 'Too many tasks!',
    fxPickup: 'Challenge accepted',
    fxIgnored: 'Ignored...',
    fxSpawn: 'New task!',
    meetingRoom: 'MEETING ROOM',
    execSuite: 'EXEC SUITE',
    you: 'YOU',
    boss: 'BOSS',
    stress: 'STRESS',
    todo: 'TO-DO',
    inboxZero: 'Inbox zero. Suspicious.',
  },
  sv: {
    canvas: 'Spelet Poo Sandwich',
    pause: 'Paus',
    tagline: 'Överlev kontorsdagen, 09:00 till 17:00.',
    howtoTasks: '✅ Beta av att göra-listan: stå vid stationen som visas (☕ 🖨️ 📅 💻 🗄️ 🖥️) tills ringen är full.',
    howtoBoss: '😠 Chefen <b>tar sats med ett ”!”</b> och kastar bajsmackor. Flytta på dig!',
    pooRuleChoice: '💩 Mackor du duckar för blir liggande på golvet några sekunder. <b>Gå över en för att anta utmaningen</b> och få bonuspoäng, eller strunta i den (lite stress). En fullträff ger dig uppdraget ändå.',
    pooRuleHit: '💩 Om en macka <b>träffar dig</b> får du ett brådskande bajsuppdrag med deadline. Lös det vid rätt station innan tiden tar slut!',
    howtoStress: '😰 Håll <b>stressen</b> under 100 %. Missade deadlines svider mest.',
    controlsJoystick: 'Dra på skärmens vänstra halva för att styra (virtuell joystick).',
    controlsTap: 'Tryck eller klicka där du vill att den anställda ska gå.',
    controlsAuto: 'Tangentbord: WASD / piltangenterna för att gå, P eller Esc för paus. Mus: klicka för att gå. Pekskärm: dra på vänstra halvan som en joystick.',
    start: 'Börja arbetsdagen',
    best: 'Bästa poäng: {n}',
    language: 'Språk',
    paused: '⏸ Pausat',
    pausedText: 'Chefen har också rast. Förmodligen.',
    resume: 'Fortsätt',
    quit: 'Till startskärmen',
    score: 'Poäng',
    again: 'Spela igen',
    menu: 'Startskärm',
    wonTitle: '🎉 Du överlevde dagen!',
    lostTitle: '🔥 Utbränd!',
    wonText: '17:00. Du stämplade ut med {stress} % stress. Lugnbonus: +{bonus}.',
    lostText: 'Stressen nådde 100 %. HR skickar en mugg med texten ”Resiliens”.',
    newBest: '🏆 Nytt rekord!',
    stats: 'Uppgifter {tasks} · Lösta bajsuppdrag {poo} · Träffar {hits} · Duckade {dodged} · Missade deadlines {missed}',
    fxSolved: '+{n} Löst!',
    fxHit: 'PLASK! 💩',
    fxDodged: 'Duckade!',
    fxExpired: 'Missad deadline!',
    fxOverload: 'För många uppgifter!',
    fxPickup: 'Utmaning antagen',
    fxIgnored: 'Struntade i den...',
    fxSpawn: 'Ny uppgift!',
    meetingRoom: 'MÖTESRUM',
    execSuite: 'LEDNINGEN',
    you: 'DU',
    boss: 'CHEF',
    stress: 'STRESS',
    todo: 'ATT GÖRA',
    inboxZero: 'Tom inkorg. Misstänkt.',
  },
};

// Station labels and task labels from world.js, by their English text.
export const NAMES = {
  sv: {
    'Your desk': 'Ditt skrivbord',
    Coffee: 'Kaffe',
    Printer: 'Skrivare',
    'Meeting room': 'Mötesrum',
    Filing: 'Arkiv',
    'IT closet': 'IT-skrubben',
    'Get coffee': 'Hämta kaffe',
    'Fetch printouts': 'Hämta utskrifter',
    "Attend 'quick sync'": 'Gå på ”snabb avstämning”',
    'File expense report': 'Lämna in reseräkningen',
    'Find the 2014 contract': 'Hitta avtalet från 2014',
    'Reboot the server (again)': 'Starta om servern (igen)',
    'Reply-all to apologise': 'Svara alla och be om ursäkt',
    'Steal a biscuit': 'Sno en kaka',
    'Redo the slide deck by EOD': 'Gör om presentationen till ikväll',
    'Explain the budget to Finance': 'Förklara budgeten för ekonomi',
    "Fix the CEO's printer": 'Laga vd:ns skrivare',
    "Restore the intern's files": 'Återställ praktikantens filer',
    'Audit ten years of invoices': 'Granska tio års fakturor',
    'Rewrite the TPS report': 'Skriv om TPS-rapporten',
  },
};

// 'sv-SE' → 'sv'; unsupported or empty → null.
export function normalizeLang(code) {
  const base = String(code || '').trim().toLowerCase().split(/[-_]/)[0];
  return LANGS.includes(base) ? base : null;
}

// ?lang= (the launcher passes it) wins, then the saved choice, then the browser's languages, then English.
export function pickLang({ query = null, saved = null, browser = [] } = {}) {
  for (const c of [query, saved, ...browser]) {
    const lang = normalizeLang(c);
    if (lang) return lang;
  }
  return DEFAULT_LANG;
}

// t('sv', 'best', { n: 5 }) → 'Bästa poäng: 5'. Missing keys fall back to English, then to the key.
export function t(lang, key, vars) {
  const s = STRINGS[lang]?.[key] ?? STRINGS[DEFAULT_LANG][key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

export const name = (lang, english) => NAMES[lang]?.[english] ?? english;
