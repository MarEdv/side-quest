// Pure: no DOM. What "install as an app" can offer on this device (K-7, D-15). The part's browser module gathers the
// facts (user agent, display-mode media queries, the beforeinstallprompt event) and passes them in.

// What can be offered: 'native' (a stashed beforeinstallprompt event: Chrome / Edge / Samsung Internet on Android, desktop
// Chromium), 'ios-instructions' (iOS / iPadOS have no API: show Share > Add to Home Screen), or 'none'. Already running as
// an app, or known to be installed (the appinstalled event), is always 'none'.
export function installKind({ isStandalone = false, installed = false, hasDeferredPrompt = false, isIOS = false } = {}) {
  if (isStandalone || installed) return 'none';
  if (hasDeferredPrompt) return 'native';
  if (isIOS) return 'ios-instructions';
  return 'none';
}

// iPhone / iPod / iPad report themselves in the UA; iPadOS 13+ asks for the desktop site and says "Macintosh", so a Mac
// with touch points (a real Mac has none) is an iPad.
export function detectIOS({ userAgent = '', platform = '', maxTouchPoints = 0 } = {}) {
  if (/iPhone|iPad|iPod/.test(userAgent)) return true;
  return (platform === 'MacIntel' || /Macintosh/.test(userAgent)) && maxTouchPoints > 1;
}

// Already launched as an installed app? navigator.standalone is iOS only; display-mode is everyone else. A manifest may ask
// for fullscreen first (display_override), which is what Android uses, and a WebKit bug reports fullscreen where standalone
// was expected, so fullscreen counts too, but only on touch hardware: on a desktop it is also what F11 browser fullscreen
// reports, and installed desktop apps never get fullscreen (they fall back to standalone). An Android TWA has an
// android-app:// referrer.
export function detectStandalone({ navStandalone = false, standaloneMQ = false, fullscreenMQ = false, touchHardware = false, referrer = '' } = {}) {
  return !!(navStandalone || standaloneMQ || (fullscreenMQ && touchHardware) || String(referrer).startsWith('android-app://'));
}
