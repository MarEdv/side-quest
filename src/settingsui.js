// The Settings screen (browser only). Built once per visit from src/settings.js; edits save immediately, so Back / Esc
// just leave. Controls are updated in place (sync) so focus and scroll position survive every change.
import { SETTING_GROUPS, inactiveReason, overrideText, checkInput, numberSpec, enumValues } from './settings.js';

// ctx.settings: { state() -> {flags, locked}, pending() -> keys, set(key, value), reset(), clearLinks(), dayInProgress() }
export function registerSettings(api, ctx, btn) {
  const { h } = api;
  api.register('settings', {
    onEsc: (a) => { if (a.local.confirming) { a.local.setConfirm(false); return true; } return false; },
    build: (a) => {
      const S = ctx.settings;
      const rows = []; // { item, control, note, row }
      let id = 0;

      const makeControl = (item, cid) => {
        const k = item.key;
        if (item.kind === 'select') {
          const el = h('select', { id: cid, name: k, class: 'sctl' },
            enumValues(k).map((v) => h('option', { value: v }, item.options[v] || v)));
          el.addEventListener('change', () => { S.set(k, el.value); sync(); });
          return el;
        }
        if (item.kind === 'toggle') {
          const el = h('input', { id: cid, name: k, type: 'checkbox', class: 'stog' });
          el.addEventListener('change', () => { S.set(k, el.checked); sync(); });
          return el;
        }
        const spec = numberSpec(k);
        const el = item.kind === 'seed'
          ? h('input', { id: cid, name: k, type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'random', class: 'sctl' })
          : h('input', { id: cid, name: k, type: 'number', inputmode: spec.int ? 'numeric' : 'decimal', min: spec.min, max: spec.max, step: 'any', autocomplete: 'off', class: 'sctl' });
        el.addEventListener('input', () => {
          const text = item.kind === 'seed' && el.value.trim() === '' ? 'random' : el.value;
          const r = checkInput(k, text);
          const rec = rows.find((x) => x.item === item);
          rec.error = r.ok ? '' : r.error;
          el.setAttribute('aria-invalid', r.ok ? 'false' : 'true');
          if (r.ok) S.set(k, r.value);
          sync();
        });
        el.addEventListener('change', () => { // leaving the field: an unusable entry is replaced by the value in force
          const rec = rows.find((x) => x.item === item);
          if (rec.error) { rec.error = ''; el.removeAttribute('aria-invalid'); el.value = ''; sync(true); }
        });
        return el;
      };

      const groups = SETTING_GROUPS.map((g) => h('fieldset', { class: 'sgroup' },
        h('legend', {}, g.title),
        h('p', { class: 'small dim sgnote' }, g.id === 'gameplay' && S.dayInProgress() ? `${g.note} A day is in progress: changes start with the next day.` : g.note),
        g.items.map((item) => {
          const cid = `set-${item.key}`; id++;
          const control = makeControl(item, cid);
          const note = h('p', { class: 'snote', id: `${cid}-note`, 'aria-live': 'polite' });
          const help = h('p', { class: 'shelp', id: `${cid}-help` }, item.help);
          control.setAttribute('aria-describedby', `${cid}-help ${cid}-note`);
          const label = h('label', { for: cid }, item.label);
          const row = item.kind === 'toggle'
            ? h('div', { class: 'srow toggle' }, h('label', { class: 'tlabel', for: cid }, item.label, control), help, note)
            : h('div', { class: 'srow' }, label, control, help, note);
          rows.push({ item, control, note, row, error: '' });
          return row;
        })));

      function sync(force) {
        const { flags, locked } = S.state();
        const pending = new Set(S.pending());
        for (const rec of rows) {
          const { item, control, note } = rec, k = item.key;
          const isLocked = Object.prototype.hasOwnProperty.call(locked, k);
          const reason = inactiveReason(k, flags);
          control.disabled = isLocked || !!reason;
          if (item.kind === 'toggle') control.checked = !!flags[k];
          else if (force || document.activeElement !== control) {
            control.value = item.kind === 'seed' ? (flags[k] === 'random' ? '' : String(flags[k])) : String(flags[k]);
          }
          let text = '', cls = 'snote';
          if (rec.error) { text = rec.error; cls += ' bad'; }
          else if (isLocked) { text = `Set by link (${overrideText(k, locked[k])}). Use "Clear link overrides" to change it.`; cls += ' lock'; }
          else if (reason) text = `${reason}.`;
          else if (pending.has(k)) text = 'Saved. Applies from the next day.';
          note.textContent = text; note.className = cls;
          rec.row.classList.toggle('off', control.disabled);
        }
        clearBtn && (clearBtn.hidden = !Object.keys(locked).length);
        confirmText.textContent = Object.keys(locked).length
          ? 'Reset all saved settings to defaults? Settings set by the link stay until you clear the link.'
          : 'Reset all settings to defaults?';
      }

      const clearBtn = btn('Clear link overrides', () => S.clearLinks());
      const confirmText = h('p', { class: 'warn' });
      const resetBtn = btn('Reset to defaults', () => a.local.setConfirm(true));
      const yesBtn = btn('Yes, reset', () => { S.reset(); a.local.setConfirm(false); sync(true); });
      const noBtn = btn('Cancel', () => a.local.setConfirm(false), { primary: true });
      const backBtn = h('button', { type: 'button', class: 'btn primary', 'data-back': true, onclick: () => a.back() }, 'Back');
      const normalRow = h('div', { class: 'row' }, clearBtn, resetBtn, backBtn);
      const confirmRow = h('div', { class: 'sconfirm', hidden: true }, confirmText, h('div', { class: 'row' }, yesBtn, noBtn));
      a.local.setConfirm = (on) => {
        a.local.confirming = on;
        normalRow.hidden = on; confirmRow.hidden = !on;
        (on ? noBtn : resetBtn).focus({ preventScroll: true });
      };

      sync(true);
      return h('div', { class: 'menu settings' }, h('h2', {}, 'Settings'),
        h('div', { class: 'ui-scroll sscroll' }, groups),
        ctx.persistent() ? null : h('p', { class: 'small dim' }, 'Storage is blocked here: settings last only until you close the page.'),
        normalRow, confirmRow);
    },
  });
}
