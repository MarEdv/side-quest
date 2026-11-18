// Pure rules for installing the launcher as an app (L-7, D-6). No DOM: src/launcher.js gathers the facts.
// The rules themselves live in the kit (kit/install.js, D-15), shared with Garden Day.
export { installKind, detectIOS, detectStandalone } from '../kit/install.js';
