import { useEffect, useRef, useState } from 'react';
import { TopBar, Toggle, Sheet, Icon } from '../components/ui.jsx';
import { CURRENCIES, getState, updateSettings, eraseEverything } from '../lib/storage.js';
import { exportBackup, exportSpreadsheet, restoreBackup } from '../lib/backup.js';
import { askForReminders, reminderPermission, syncReminders } from '../lib/reminders.js';
import { isNative, lockStatus, lockLabel, unlock, openAppSettings } from '../lib/native.js';
import { APP_NAME, APP_VERSION, PRIVACY_URL, SUPPORT_URL } from '../lib/config.js';

const LEAD_TIMES = [60, 30, 14, 7, 1];

function Row({ title, detail, children, onClick }) {
  const body = (
    <>
      <span className="row-text">
        <span className="row-title">{title}</span>
        {detail && <span className="row-detail">{detail}</span>}
      </span>
      {children}
    </>
  );
  return onClick ? (
    <button className="row row-button" onClick={onClick}>
      {body}
      <Icon name="chevron" size={18} />
    </button>
  ) : (
    <div className="row">{body}</div>
  );
}

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
    await updateSettings({ remindersOn: on });
    if (on && permission === 'prompt') await allow();
  };

  const toggleLead = (days) => {
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
    if (file) run(() => restoreBackup(file), (r) => (r.added + r.updated === 0 ? 'Everything in that backup is already here' : `Restored ${r.added + r.updated} item${r.added + r.updated === 1 ? '' : 's'}`));
  };

  return (
    <div className="screen settings">
      <TopBar title="Settings" onBack={onBack} />

      <h2 className="group-title">Reminders</h2>
      <div className="group">
        <Row title="Remind me before a warranty ends" detail="A notification at 9 in the morning.">
          <Toggle checked={settings.remindersOn} onChange={toggleReminders} label="Remind me before a warranty ends" />
        </Row>
        {settings.remindersOn && (
          <div className="row row-stack">
            <span className="row-title">How far ahead</span>
            <div className="chips chips-wrap">
              {LEAD_TIMES.map((d) => (
                <button key={d} className={`chip${settings.reminderDays.includes(d) ? ' is-on' : ''}`} aria-pressed={settings.reminderDays.includes(d)} onClick={() => toggleLead(d)}>
                  {d === 1 ? '1 day' : `${d} days`}
                </button>
              ))}
            </div>
          </div>
        )}
        {settings.remindersOn && permission === 'denied' && (
          <Row title="Notifications are off for this app" detail="Turn them on in iPhone Settings to get reminders." onClick={openAppSettings} />
        )}
        {settings.remindersOn && permission === 'prompt' && (
          <Row title="Allow notifications" detail="Needed so reminders can reach you." onClick={allow} />
        )}
        {!isNative && <p className="group-note">Reminders work in the iPhone app.</p>}
      </div>

      <h2 className="group-title">Privacy</h2>
      <div className="group">
        <Row
          title={lock.available ? `Lock with ${lockLabel(lock.kind)}` : 'Lock the app'}
          detail={lock.available ? 'Ask each time the app opens, and hide it in the app switcher.' : isNative ? 'Set a passcode on this iPhone to use the lock.' : 'Available in the iPhone app.'}
        >
          <Toggle checked={settings.appLock && lock.available} onChange={toggleLock} disabled={!lock.available} label="Lock the app" />
        </Row>
        <Row title="How your data is handled" detail="Stored on this phone only." onClick={() => setSheet('privacy')} />
      </div>

      <h2 className="group-title">Reading receipts</h2>
      <div className="group">
        <Row title="Currency">
          <select className="row-select" value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })} aria-label="Currency">
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Row>
        <Row title="Dates like 03/04" detail="How stores near you print dates.">
          <select className="row-select" value={settings.dateOrder} onChange={(e) => updateSettings({ dateOrder: e.target.value })} aria-label="Date order">
            <option value="MDY">Month first</option>
            <option value="DMY">Day first</option>
          </select>
        </Row>
      </div>

      <h2 className="group-title">Your data</h2>
      <div className="group">
        <Row title="Moving to a new phone" detail="How to bring your receipts with you." onClick={() => setSheet('move')} />
        <Row title="Back up everything" detail="One file with every item and photo. Keep it anywhere you like." onClick={() => run(exportBackup)} />
        <Row title="Restore from a backup" detail="Adds the items from a backup file." onClick={() => restoreInput.current?.click()} />
        <Row title="Export a spreadsheet" detail="A CSV list of your items, without photos." onClick={() => run(exportSpreadsheet)} />
        <Row title="Delete everything" detail={`${itemCount} item${itemCount === 1 ? '' : 's'} on this phone.`} onClick={() => setSheet('erase')} />
        <input ref={restoreInput} type="file" accept="application/json,.json" hidden onChange={onRestoreFile} />
      </div>

      <h2 className="group-title">About</h2>
      <div className="group">
        <a className="row row-button" href={SUPPORT_URL} target="_blank" rel="noopener noreferrer">
          <span className="row-text">
            <span className="row-title">Help and contact</span>
          </span>
          <Icon name="chevron" size={18} />
        </a>
        <a className="row row-button" href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
          <span className="row-text">
            <span className="row-title">Privacy policy</span>
          </span>
          <Icon name="chevron" size={18} />
        </a>
        <Row title="Version" detail={null}>
          <span className="row-value">{APP_VERSION}</span>
        </Row>
      </div>
      <p className="fineprint">
        Warranty lengths the app suggests are estimates. Your product’s own warranty terms are what count.
      </p>

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
        <Sheet title="Delete everything?" onClose={() => setSheet(null)}>
          <p className="sheet-text">Every item, receipt photo and reminder is removed from this phone. There is no copy anywhere else unless you made a backup.</p>
          <button
            className="btn btn-danger btn-wide"
            onClick={() => {
              setSheet(null);
              run(eraseEverything, 'Everything was deleted');
            }}
          >
            Delete everything
          </button>
          <button className="btn btn-quiet btn-wide" onClick={() => setSheet(null)}>
            Cancel
          </button>
        </Sheet>
      )}
    </div>
  );
}
