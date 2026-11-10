// Pure rules for installing the launcher as an app (L-7, D-6). No DOM: src/launcher.js gathers the facts.
// detectIOS / detectStandalone follow games/garden-day/src/installmodel.js (its D-26); copied, not imported, because the
// launcher never imports from a game.

// What the Install button can do: 'native' (a stashed beforeinstallprompt: Chromium browsers), 'ios-instructions'
// (iOS / iPadOS have no API: Share > Add to Home Screen) or 'none' (already an app, already installed, or unsupported).
export function installKind({ isStandalone = false, installed = false, hasDeferredPrompt = false, isIOS = false } = {}) {
  if (isStandalone || installed) return 'none';
  if (hasDeferredPrompt) return 'native';
  if (isIOS) return 'ios-instructions';
  return 'none';
}

// iPadOS 13+ reports "Macintosh"; a Mac with touch points is an iPad.
export function detectIOS({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return (platform === 'MacIntel' || /Macintosh/.test(userAgent)) && maxTouchPoints > 1;
}

// Running as an installed app? Fullscreen only counts on touch hardware (on a desktop it is also F11 browser fullscreen).
export function detectStandalone({ navStandalone = false, standaloneMQ = false, fullscreenMQ = false, touchHardware = false, referrer = '' } = {}) {
  return !!(navStandalone || standaloneMQ || (fullscreenMQ && touchHardware) || String(referrer).startsWith('android-app://'));
}
