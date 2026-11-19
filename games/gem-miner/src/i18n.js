// English and Swedish texts (P-5, D31). Pure: no DOM. The language rules come from the kit (src/kit/lang.js): one
// current language for the whole game, set by main.js through src/kit/langdom.js (display only, never in the save).
// game.js, ui.js and main.js build their messages with t(key, vars). Names of gems, hatchets and rocks are looked up by
// id, so the economy and mining tables stay language-free.
import { createI18n } from './kit/lang.js';

export const STRINGS = {
  en: {
    // page
    canvas: 'Gem Miner game view',
    coinsTitle: 'Coins', hatchetTitle: 'Best hatchet', navTitle: 'Direction', backpack: 'Backpack',
    mapBtn: 'Minimap (M)', pauseBtn: 'Pause (P)', up: 'Up', left: 'Left', right: 'Right', down: 'Down',
    shopBtn: '🏪 Shop', language: 'Language',
    tagline: 'Dig for gems, sell them, buy better hatchets and find the <b>Diamond of Your Dreams</b>.',
    continue: 'Continue', continueInfo: 'Continue ({info})', newGame: 'New game',
    newGameArmed: 'New game: press again to replace your save',
    bestTimes: 'Best times', back: 'Back to games',
    shopTitle: '🏪 Shop', sellGems: 'Sell gems', hatchets: 'Hatchets', sellAll: 'Sell all', shopClose: 'Back to the mine',
    paused: '⏸ Paused', resume: 'Resume', minimap: 'Minimap', soundOn: 'Sound: on', soundOff: 'Sound: off',
    quit: 'Save and quit to title',
    mapTitle: '🗺 Minimap', mapCanvas: 'Explored map',
    mapLegend: '⬤ you · ■ town · ◆ dream diamond (once you hold the Gem hatchet)', close: 'Close',
    winTitle: '💎 You found it!', winText: 'The Diamond of Your Dreams is yours.', title: 'Title',
    // title screen
    timesTitle: 'Best times, {size} × {size} world',
    noTimes: 'No times yet. Find the Diamond of Your Dreams to set one.',
    controlsTouch: 'Touch: hold the D-pad (or stick) to walk and dig. Tap Shop when you are in town. 🗺 for the minimap.',
    controlsKeys: 'WASD / arrows: walk and dig · E / Enter: shop (in town) · M: minimap · P / Esc: pause',
    flags: 'Flags: {list}', flagSeed: 'seed {n}', flagWorld: 'world {n}', flagCamera: 'camera: centre', flagFog: 'fog off',
    flagWear: 'hatchets wear out', flagDebug: 'DEBUG (not saved to best times)',
    saveDiffers: 'Continue resumes your saved {size} × {size} world; the URL settings apply to New game.',
    badSave: 'That saved game could not be read, so it was discarded. Start a new game.',
    // shop
    shopCoins: '🪙 {n} coins', each: '{n} coins each', sell1: 'Sell 1', sell1Aria: 'Sell one {gem}',
    sellAllGem: 'All', sellAllGemAria: 'Sell all {gem}', emptyBackpack: 'Your backpack is empty. Dig for gems!',
    notForSale: 'Not for sale', sellAllValue: 'Sell all ({n} coins)',
    cuts: 'Cuts {rocks}', blocksLeft: ', {n} blocks left', alwaysYours: 'Always yours', ownedInUse: 'Owned, in use',
    owned: 'Owned', notNeededLong: 'Not needed: you have a better one', notNeeded: 'Not needed',
    needMore: 'need {n} more', buyAria: 'Buy {hatchet} for {n} coins',
    soldFor: 'Sold for {n} coins.', nothingToSell: 'Nothing to sell.', soldGems: 'Sold {count} gems for {n} coins.',
    backpackEmpty: 'Your backpack is empty.', bought: 'You bought the {hatchet}!',
    poor: 'Not enough coins: {n} more for the {hatchet}.', alreadyOwned: 'You already have it.',
    alreadyBetter: 'You already have a better hatchet.', cannotBuy: 'Cannot buy that.',
    // pause / win / HUD
    pauseStats: 'Time {time} · {blocks} blocks · {gems} gems found',
    statTime: 'play time', statGems: 'gems found', statCoins: 'coins earned', statBlocks: 'blocks mined',
    debugRun: 'Debug run: not saved to the best times.',
    newBest: 'New best time! You are #{rank} on the {size} × {size} list.',
    town: 'Town {arrow} {dist}', inTown: 'In town',
    atShopTouch: 'The shop: tap 🏪 Shop to trade', atShopKeys: 'The shop: press E to trade',
    // mining hints (game.js)
    spareHatchet: 'A spare {hatchet}: sold for {n} coins', foundHatchet: 'Found a {hatchet}!',
    chestCoins: 'Chest: {n} coins', chestGems: 'Chest: {n} {gem}', plusGem: '+1 {gem}', broke: 'Your {hatchet} broke!',
    bedrock: 'Solid bedrock: the edge of the world', crystalWall: 'The crystal wall needs a Gem hatchet',
    tooHard: 'Too hard for your {hatchet}',
  },
  sv: {
    canvas: 'Spelvy för Gem Miner',
    coinsTitle: 'Mynt', hatchetTitle: 'Bästa yxan', navTitle: 'Riktning', backpack: 'Ryggsäck',
    mapBtn: 'Minikarta (M)', pauseBtn: 'Paus (P)', up: 'Upp', left: 'Vänster', right: 'Höger', down: 'Ned',
    shopBtn: '🏪 Butik', language: 'Språk',
    tagline: 'Gräv efter ädelstenar, sälj dem, köp bättre yxor och hitta <b>Drömdiamanten</b>.',
    continue: 'Fortsätt', continueInfo: 'Fortsätt ({info})', newGame: 'Nytt spel',
    newGameArmed: 'Tryck igen: nytt spel ersätter det sparade',
    bestTimes: 'Bästa tider', back: 'Tillbaka till spelen',
    shopTitle: '🏪 Butik', sellGems: 'Sälj ädelstenar', hatchets: 'Yxor', sellAll: 'Sälj allt', shopClose: 'Tillbaka till gruvan',
    paused: '⏸ Pausat', resume: 'Fortsätt', minimap: 'Minikarta', soundOn: 'Ljud: på', soundOff: 'Ljud: av',
    quit: 'Spara och gå till startskärmen',
    mapTitle: '🗺 Minikarta', mapCanvas: 'Utforskad karta',
    mapLegend: '⬤ du · ■ stan · ◆ drömdiamanten (när du har ädelstensyxan)', close: 'Stäng',
    winTitle: '💎 Du hittade den!', winText: 'Drömdiamanten är din.', title: 'Startskärm',
    timesTitle: 'Bästa tider, värld {size} × {size}',
    noTimes: 'Inga tider än. Hitta Drömdiamanten för att sätta en.',
    controlsTouch: 'Pekskärm: håll in styrkorset (eller spaken) för att gå och gräva. Tryck på Butik när du är i stan. 🗺 för minikartan.',
    controlsKeys: 'WASD / pilar: gå och gräv · E / Enter: butik (i stan) · M: minikarta · P / Esc: paus',
    flags: 'Flaggor: {list}', flagSeed: 'frö {n}', flagWorld: 'värld {n}', flagCamera: 'kamera: centrerad', flagFog: 'ingen dimma',
    flagWear: 'yxor slits ut', flagDebug: 'FELSÖKNING (sparas inte bland bästa tider)',
    saveDiffers: 'Fortsätt återupptar din sparade värld på {size} × {size}; inställningarna i adressen gäller för Nytt spel.',
    badSave: 'Det sparade spelet gick inte att läsa och har tagits bort. Starta ett nytt spel.',
    shopCoins: '🪙 {n} mynt', each: '{n} mynt styck', sell1: 'Sälj 1', sell1Aria: 'Sälj en {gem}',
    sellAllGem: 'Alla', sellAllGemAria: 'Sälj alla {gem}', emptyBackpack: 'Ryggsäcken är tom. Gräv efter ädelstenar!',
    notForSale: 'Inte till salu', sellAllValue: 'Sälj allt ({n} mynt)',
    cuts: 'Hugger {rocks}', blocksLeft: ', {n} block kvar', alwaysYours: 'Alltid din', ownedInUse: 'Din, används',
    owned: 'Din', notNeededLong: 'Behövs inte: du har en bättre', notNeeded: 'Behövs inte',
    needMore: '{n} till behövs', buyAria: 'Köp {hatchet} för {n} mynt',
    soldFor: 'Sålde för {n} mynt.', nothingToSell: 'Inget att sälja.', soldGems: 'Sålde {count} ädelstenar för {n} mynt.',
    backpackEmpty: 'Ryggsäcken är tom.', bought: 'Du köpte en {hatchet}!',
    poor: 'Inte tillräckligt med mynt: {n} till för en {hatchet}.', alreadyOwned: 'Den har du redan.',
    alreadyBetter: 'Du har redan en bättre yxa.', cannotBuy: 'Det går inte att köpa.',
    pauseStats: 'Tid {time} · {blocks} block · {gems} ädelstenar hittade',
    statTime: 'speltid', statGems: 'ädelstenar hittade', statCoins: 'mynt intjänade', statBlocks: 'block utgrävda',
    debugRun: 'Felsökningsläge: sparas inte bland bästa tider.',
    newBest: 'Ny bästa tid! Du är nummer {rank} på listan för {size} × {size}.',
    town: 'Stan {arrow} {dist}', inTown: 'I stan',
    atShopTouch: 'Butiken: tryck på 🏪 Butik för att handla', atShopKeys: 'Butiken: tryck E för att handla',
    spareHatchet: 'En extra {hatchet}: såld för {n} mynt', foundHatchet: 'Hittade en {hatchet}!',
    chestCoins: 'Kista: {n} mynt', chestGems: 'Kista: {n} {gem}', plusGem: '+1 {gem}', broke: 'Din {hatchet} gick sönder!',
    bedrock: 'Fast berggrund: världens kant', crystalWall: 'Kristallväggen kräver en ädelstensyxa',
    tooHard: 'För hårt för din {hatchet}',
  },
};

// Names by id. Hatchets: `short` for the HUD chip, `full` inside sentences (Swedish compounds are lower case there).
export const NAMES = {
  en: {
    gems: { quartz: 'Quartz', amethyst: 'Amethyst', topaz: 'Topaz', emerald: 'Emerald', sapphire: 'Sapphire', ruby: 'Ruby', diamond: 'Diamond', dream: 'Diamond of Your Dreams' },
    short: { wood: 'Wood', stone: 'Stone', steel: 'Steel', gem: 'Gem' },
    full: { wood: 'Wood hatchet', stone: 'Stone hatchet', steel: 'Steel hatchet', gem: 'Gem hatchet' },
    rocks: ['dirt', 'stone', 'granite', 'obsidian', 'the crystal wall'],
  },
  sv: {
    gems: { quartz: 'Kvarts', amethyst: 'Ametist', topaz: 'Topas', emerald: 'Smaragd', sapphire: 'Safir', ruby: 'Rubin', diamond: 'Diamant', dream: 'Drömdiamanten' },
    short: { wood: 'Trä', stone: 'Sten', steel: 'Stål', gem: 'Ädelsten' },
    full: { wood: 'träyxa', stone: 'stenyxa', steel: 'stålyxa', gem: 'ädelstensyxa' },
    rocks: ['jord', 'sten', 'granit', 'obsidian', 'kristallväggen'],
  },
};

export const i18n = createI18n(STRINGS);
export const { LANGS, DEFAULT_LANG, normalizeLang, pickLang, getLang, setLang, t } = i18n;

// Lookups use the current language unless one is passed.
const names = (lang) => NAMES[lang] || NAMES[DEFAULT_LANG];
export const gemName = (id, lang = getLang()) => names(lang).gems[id] ?? NAMES.en.gems[id] ?? id;
export const hatchetShort = (id, lang = getLang()) => names(lang).short[id] ?? id;
export const hatchetName = (id, lang = getLang()) => names(lang).full[id] ?? id;
// Capitalised, for the start of a shop row.
export const hatchetTitle = (id, lang = getLang()) => { const n = hatchetName(id, lang); return n.charAt(0).toUpperCase() + n.slice(1); };
export const rockNames = (power, lang = getLang()) => names(lang).rocks.slice(0, power).join(', ');

// 12345 → '12,345' (en) / '12 345' (sv).
export const num = (n, lang = getLang()) => Number(n).toLocaleString(lang === 'sv' ? 'sv-SE' : 'en');

// Where the start screen's "Back to games" link goes: the launcher, which reads ?lang= and remembers it (S-12).
export const backHref = (lang = getLang()) => `../../?lang=${normalizeLang(lang) || DEFAULT_LANG}`;
