import { useEffect, useRef, useState } from 'react';
import { Toggle, Sheet, Group, Row } from '../components/ui.jsx';
import { Screen, BackButton } from '../components/nav.jsx';
import { CURRENCIES, getState, updateSettings, eraseEverything } from '../lib/storage.js';
import { exportBackup, exportSpreadsheet, restoreBackup } from '../lib/backup.js';
import { askForReminders, reminderPermission, syncReminders } from '../lib/reminders.js';
import { isNative, lockStatus, lockLabel, unlock, openAppSettings } from '../lib/native.js';
import { select, warning } from '../lib/haptics.js';
import { APP_NAME, APP_VERSION, PRIVACY_URL, SUPPORT_URL } from '../lib/config.js';

const LEAD_TIMES = [60, 30, 14, 7, 1];

export function PrivacySummary() {
  return (
    <div className="prose">
      <p>
        <b>{APP_NAME} has no servers and no accounts.</b> Your receipts, photos and settings are stored only in the app’s private folder on this phone.
      </p>
      <ul>
        <li>Receipts are read by Apple’s text recognition, on this phone. Photos are never uploaded.</li>
        <li>The app cannot connect to the internet. It contains no analytics, ads or tracking.</li>
        <li>Reminders are scheduled by iOS on this phone.</li>
        <li>Your data is included in your own iPhone or iCloud backup, which Apple manages for you.</li>
        <li>Deleting an item, or deleting the app, removes the data for good.</li>
      </ul>
    </div>
  );
}

export default function Settings({ settings, itemCount, onBack, notify }) {
  const [permission, setPermission] = useState('unavailable');
  const [lock, setLock] = useState({ available: false, kind: 'none' });
  const [sheet, setSheet] = useState(null);
  const [busy, setBusy] = useState(false);
  const restoreInput = useRef(null);

  useEffect(() => {
    reminderPermission().then(setPermission);
    lockStatus().then(setLock);
  }, []);

  // iOS shows its permission question only once, so ask at a moment the
  // person has just said they want reminders. Then queue them straight away.
  const allow = async () => {
    const result = await askForReminders();
    setPermission(result);
    if (result === 'granted') syncReminders(getState().items, getState().settings);
  };

  const toggleReminders = async (on) => {
    select();
    await updateSettings({ remindersOn: on });
    if (on && permission === 'prompt') await allow();
  };

  const toggleLead = (days) => {
    select();
    const has = settings.reminderDays.includes(days);
    const next = has ? settings.reminderDays.filter((d) => d !== days) : [...settings.reminderDays, days];
    if (next.length) updateSettings({ reminderDays: next });
  };

  const toggleLock = async (on) => {
    // Prove it is the owner before turning the lock on or off.
    if (await unlock(on ? `Turn on the ${APP_NAME} lock` : `Turn off the ${APP_NAME} lock`)) await updateSettings({ appLock: on });
  };

  const run = async (work, done) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await work();
      if (done) notify(typeof done === 'function' ? done(result) : done);
    } catch (err) {
      notify(err?.message || 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const onRestoreFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) run(() => restoreBackup(file), (r) => (r.added + r.updated === 0 ? 'Already up to date' : `Restored ${r.added + r.updated} item${r.added + r.updated === 1 ? '' : 's'}`));
  };

  const reminderFooter = !isNative
    ? 'Reminders work in the iPhone app.'
    : !settings.remindersOn
      ? 'Turn on to get a notification before each warranty ends.'
      : permission === 'denied'
        ? 'Notifications are switched off for this app in iPhone Settings.'
        : 'Notifications arrive at 9 in the morning.';

  return (
    <Screen title="Settings" largeTitle className="settings" left={<BackButton onClick={onBack} label={APP_NAME} />}>
      <Group header="Reminders" footer={reminderFooter}>
        <Row icon="bell" color="#ff3b30" title="Warranty reminders">
          <Toggle checked={settings.remindersOn} onChange={toggleReminders} label="Remind me before a warranty ends" />
        </Row>
        {settings.remindersOn && (
          <div className="row pills-row">
            <span className="row-title">How far ahead</span>
            <div className="pills">
              {LEAD_TIMES.map((d) => (
                <button key={d} className={`pill${settings.reminderDays.includes(d) ? ' is-on' : ''}`} aria-pressed={settings.reminderDays.includes(d)} onClick={() => toggleLead(d)}>
                  {d === 1 ? '1 day' : `${d} days`}
                </button>
              ))}
            </div>
          </div>
        )}
        {settings.remindersOn && permission === 'prompt' && <Row title="Allow notifications" onClick={allow} />}
        {settings.remindersOn && permission === 'denied' && <Row title="Open iPhone Settings" onClick={openAppSettings} />}
      </Group>

      <Group
        header="Privacy"
        footer={lock.available ? 'Asks each time you open the app, and hides it in the app switcher.' : isNative ? 'Set a passcode on this iPhone to use the lock.' : 'The lock is available in the iPhone app.'}
      >
        <Row icon="faceid" color="#34c759" title={lock.available ? `Lock with ${lockLabel(lock.kind)}` : 'Lock the app'}>
          <Toggle checked={settings.appLock && lock.available} onChange={toggleLock} disabled={!lock.available} label="Lock the app" />
        </Row>
        <Row icon="shield" color="#0a84ff" title="How your data is handled" onClick={() => setSheet('privacy')} />
      </Group>

      <Group header="Reading receipts" footer="Date order is how stores near you print dates like 03/04.">
        <Row icon="globe" color="#5e5ce6" title="Currency">
          <select className="row-select" value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })} aria-label="Currency">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Row>
        <Row icon="calendar" color="#ff9500" title="Date order">
          <select className="row-select" value={settings.dateOrder} onChange={(e) => updateSettings({ dateOrder: e.target.value })} aria-label="Date order">
            <option value="MDY">Month first</option>
            <option value="DMY">Day first</option>
          </select>
        </Row>
      </Group>

      <Group header="Your data" footer="A backup is one file with every item and photo. Keep it anywhere you like.">
        <Row icon="phone" color="#30b0c7" title="Moving to a new phone" onClick={() => setSheet('move')} />
        <Row icon="arrowUp" color="#34c759" title="Back up everything" onClick={() => run(exportBackup)} />
        <Row icon="arrowDown" color="#0a84ff" title="Restore from a backup" onClick={() => restoreInput.current?.click()} />
        <Row icon="table" color="#8e8e93" title="Export a spreadsheet" onClick={() => run(exportSpreadsheet)} />
        <input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={onRestoreFile} />
      </Group>

      <Group>
        <Row icon="help" color="#8e8e93" title="Help and contact" href={SUPPORT_URL} />
        <Row icon="hand" color="#8e8e93" title="Privacy policy" href={PRIVACY_URL} />
        <Row icon="box" color="#8e8e93" title="Version" value={APP_VERSION} />
      </Group>

      <Group footer={`${itemCount} item${itemCount === 1 ? '' : 's'} on this phone. Warranty lengths the app suggests are estimates; your product’s own warranty terms are what count.`}>
        <Row title="Delete everything" danger onClick={() => setSheet('erase')} />
      </Group>

      {sheet === 'privacy' && (
        <Sheet title="Your data stays on this phone" onClose={() => setSheet(null)}>
          <PrivacySummary />
          <button className="btn btn-primary btn-wide" onClick={() => setSheet(null)}>
            Done
          </button>
        </Sheet>
      )}
      {sheet === 'move' && (
        <Sheet title="Moving to a new phone" onClose={() => setSheet(null)}>
          <div className="prose">
            <p>
              <b>Usually there is nothing to do.</b> When you set up a new iPhone from your iCloud or computer backup, your receipts come across with everything else.
            </p>
            <p>
              <b>To move them yourself:</b>
            </p>
            <ul>
              <li>On this phone, tap Back up everything and save the file to Files or iCloud Drive, or AirDrop it.</li>
              <li>On the new phone, install {APP_NAME}, open Settings and tap Restore from a backup.</li>
            </ul>
          </div>
          <button className="btn btn-primary btn-wide" onClick={() => setSheet(null)}>
            Done
          </button>
        </Sheet>
      )}
      {sheet === 'erase' && (
        <Sheet title="Delete everything?" message="Every item, receipt photo and reminder is removed from this phone. There is no copy anywhere else unless you made a backup." onClose={() => setSheet(null)}>
          <button
            className="btn btn-danger btn-wide"
            onClick={() => {
              setSheet(null);
              warning();
              run(eraseEverything, 'Everything deleted');
            }}
          >
            Delete everything
          </button>
          <button className="btn btn-plain btn-wide" onClick={() => setSheet(null)}>
            Cancel
          </button>
        </Sheet>
      )}
    </Screen>
  );
}
