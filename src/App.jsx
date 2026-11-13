import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Vault from './screens/Vault.jsx';
import ItemForm, { draftFromItem, draftFromScan, emptyDraft } from './screens/ItemForm.jsx';
import Detail from './screens/Detail.jsx';
import Settings from './screens/Settings.jsx';
import { Icon, Sheet } from './components/ui.jsx';
import { deleteItem, getState, load, readImage, saveItem, subscribe, updateSettings } from './lib/storage.js';
import { isNative, openAppSettings, recognizeText, scanDocument, scannerAvailable, setPrivacyScreen, unlock } from './lib/native.js';
import { askForReminders, onReminderTapped, reminderPermission, syncReminders } from './lib/reminders.js';
import { parseReceipt } from './lib/parser.js';
import { fileToJpeg, makeThumb } from './lib/images.js';
import { APP_NAME } from './lib/config.js';

const RELOCK_AFTER_MS = 30 * 1000;

function Welcome({ onDone }) {
  const points = [
    ['scan', 'Scan a receipt', 'The app reads the store, date and price for you.'],
    ['bell', 'Get reminded in time', 'A nudge before each warranty runs out, while you can still claim.'],
    ['phone', 'It all stays on your phone', 'No account, no cloud. The app can’t connect to the internet.'],
  ];
  return (
    <div className="screen welcome">
      <div className="welcome-body">
        <span className="brand brand-big">{APP_NAME}</span>
        <h1>Never lose a warranty claim to a lost receipt.</h1>
        <ul className="welcome-points">
          {points.map(([icon, title, body]) => (
            <li key={title}>
              <span className="welcome-icon">
                <Icon name={icon} size={24} />
              </span>
              <span>
                <b>{title}</b>
                {body}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="dock dock-static">
        <button className="btn btn-primary btn-wide" onClick={onDone}>
          Get started
        </button>
      </div>
    </div>
  );
}

function LockScreen({ onUnlock }) {
  const [failed, setFailed] = useState(false);
  const attempt = useCallback(async () => {
    setFailed(false);
    if (await unlock(`Unlock ${APP_NAME}`)) onUnlock();
    else setFailed(true);
  }, [onUnlock]);
  useEffect(() => {
    attempt();
  }, [attempt]);
  return (
    <div className="screen lock">
      <span className="lock-icon">
        <Icon name="lock" size={34} />
      </span>
      <h1>{APP_NAME} is locked</h1>
      {failed && <p>That didn’t work. Try again.</p>}
      <button className="btn btn-primary" onClick={attempt}>
        Unlock
      </button>
    </div>
  );
}

export default function App() {
  const state = useSyncExternalStore(subscribe, getState);
  const { items, settings, ready } = state;
  const [route, setRoute] = useState({ name: 'vault' });
  const [locked, setLocked] = useState(false);
  const [adding, setAdding] = useState(false);
  const [canScan, setCanScan] = useState(false);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prompt, setPrompt] = useState(null); // 'reminders' | 'camera'
  const photoInput = useRef(null);
  const hiddenAt = useRef(0);

  const notify = useCallback((message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 2600);
  }, []);

  const go = useCallback((next) => {
    setRoute(next);
    window.scrollTo(0, 0);
  }, []);

  // Start up: read the vault, lock if asked to, find out what the phone can do.
  useEffect(() => {
    load()
      .then((s) => {
        if (s.settings.appLock) setLocked(true);
      })
      .catch(() => notify('Could not open your saved items.'));
    scannerAvailable().then(setCanScan);
    let stop = () => {};
    onReminderTapped((id) => go({ name: 'detail', id })).then((off) => {
      stop = off;
    });
    return () => stop();
  }, [go, notify]);

  // Lock again after the app has been in the background for a while.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt.current = Date.now();
      } else if (getState().settings.appLock && hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) {
        setLocked(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (ready) setPrivacyScreen(settings.appLock);
  }, [ready, settings.appLock]);

  useEffect(() => {
    if (ready) syncReminders(items, settings);
  }, [ready, items, settings]);

  const openDraft = useCallback(
    async (draft) => {
      setPreview(draft.images?.length ? `data:image/jpeg;base64,${draft.images[0]}` : null);
      go({ name: 'form', draft });
    },
    [go]
  );

  const readPages = async (pages) => {
    const lines = pages.flatMap((page, index) => (page.lines || []).map((l) => ({ ...l, y: (Number(l.y) || 0) + index })));
    const parsed = parseReceipt(lines, { order: settings.dateOrder });
    await openDraft(draftFromScan(parsed, pages.map((p) => p.image)));
  };

  const startScan = async () => {
    setAdding(false);
    try {
      const result = await scanDocument();
      if (result.cancelled || !result.pages.length) return;
      setBusy('Reading your receipt');
      await readPages(result.pages);
    } catch (err) {
      if (err?.code === 'CAMERA_DENIED') setPrompt('camera');
      else notify('The scan did not finish. Try again.');
    } finally {
      setBusy('');
    }
  };

  const startPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setAdding(false);
    if (!file) return;
    setBusy('Reading your receipt');
    try {
      const image = await fileToJpeg(file);
      await readPages([{ image, lines: await recognizeText(image) }]);
    } catch (err) {
      notify(err?.message || 'That photo could not be opened.');
    } finally {
      setBusy('');
    }
  };

  const startManual = () => {
    setAdding(false);
    openDraft(emptyDraft());
  };

  const editItem = async (item) => {
    setPreview(item.thumb || null);
    go({ name: 'form', draft: draftFromItem(item) });
    if (item.images[0]) readImage(item.images[0]).then(setPreview).catch(() => {});
  };

  const save = async (fields) => {
    const draft = route.draft;
    try {
      const thumb = draft.images?.length ? await makeThumb(draft.images[0]).catch(() => '') : fields.thumb || '';
      const item = await saveItem({ ...fields, thumb }, draft.images);
      go({ name: 'detail', id: item.id });
      const offerReminders = draft.isNew && item.expiryDate && settings.remindersOn && (await reminderPermission()) === 'prompt';
      if (offerReminders) setPrompt('reminders');
      else notify(draft.isNew ? 'Saved' : 'Changes saved');
    } catch {
      notify('Could not save. Check that your phone has free space.');
    }
  };

  const remove = async (id) => {
    await deleteItem(id);
    go({ name: 'vault' });
    notify('Deleted');
  };

  if (!ready) return <div className="screen boot" aria-busy="true" />;
  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;
  if (!settings.onboarded) return <Welcome onDone={() => updateSettings({ onboarded: true })} />;

  const current = route.name === 'detail' ? items.find((i) => i.id === route.id) : null;

  return (
    <>
      {state.saveError && <div className="banner">Changes are not being saved. Free up some space on your phone, then reopen the app.</div>}

      {route.name === 'vault' || (route.name === 'detail' && !current) ? (
        <Vault items={items} settings={settings} onOpen={(id) => go({ name: 'detail', id })} onAdd={() => setAdding(true)} onSettings={() => go({ name: 'settings' })} />
      ) : route.name === 'detail' ? (
        <Detail
          key={current.id}
          item={current}
          settings={settings}
          onBack={() => go({ name: 'vault' })}
          onEdit={() => editItem(current)}
          onDelete={() => remove(current.id)}
          onViewPhoto={setPhoto}
          notify={notify}
        />
      ) : route.name === 'form' ? (
        <ItemForm
          draft={route.draft}
          settings={settings}
          preview={preview}
          onViewPhoto={() => setPhoto(preview)}
          onSave={save}
          onCancel={() => go(route.draft.fields.id ? { name: 'detail', id: route.draft.fields.id } : { name: 'vault' })}
        />
      ) : (
        <Settings settings={settings} itemCount={items.length} onBack={() => go({ name: 'vault' })} notify={notify} />
      )}

      <input ref={photoInput} type="file" accept="image/*" hidden onChange={startPhoto} />

      {adding && (
        <Sheet title="Add a receipt" onClose={() => setAdding(false)}>
          <div className="options">
            {canScan && (
              <button className="option" onClick={startScan}>
                <span className="option-icon">
                  <Icon name="scan" size={24} />
                </span>
                <span>
                  <b>Scan a receipt</b>
                  Point the camera at it. The page is found and straightened for you.
                </span>
              </button>
            )}
            <button className="option" onClick={() => photoInput.current?.click()}>
              <span className="option-icon">
                <Icon name="photo" size={24} />
              </span>
              <span>
                <b>Choose a photo</b>
                {isNative ? 'Use a photo or screenshot you already have.' : 'Attach a photo of the receipt.'}
              </span>
            </button>
            <button className="option" onClick={startManual}>
              <span className="option-icon">
                <Icon name="pencil" size={24} />
              </span>
              <span>
                <b>Type it in</b>
                No receipt to hand? Add the details yourself.
              </span>
            </button>
          </div>
        </Sheet>
      )}

      {prompt === 'reminders' && (
        <Sheet title="Want a reminder before this runs out?" onClose={() => setPrompt(null)}>
          <p className="sheet-text">You’ll get a notification 30 days, 7 days and 1 day before a warranty ends. You can change this in Settings.</p>
          <button
            className="btn btn-primary btn-wide"
            onClick={async () => {
              setPrompt(null);
              if ((await askForReminders()) === 'granted') {
                syncReminders(getState().items, getState().settings);
                notify('Reminders are on');
              }
            }}
          >
            Turn on reminders
          </button>
          <button
            className="btn btn-quiet btn-wide"
            onClick={() => {
              setPrompt(null);
              updateSettings({ remindersOn: false });
            }}
          >
            Not now
          </button>
        </Sheet>
      )}

      {prompt === 'camera' && (
        <Sheet title="The camera is switched off" onClose={() => setPrompt(null)}>
          <p className="sheet-text">To scan receipts, allow camera access for {APP_NAME} in iPhone Settings. You can also choose a photo instead.</p>
          <button
            className="btn btn-primary btn-wide"
            onClick={() => {
              setPrompt(null);
              openAppSettings();
            }}
          >
            Open Settings
          </button>
          <button className="btn btn-quiet btn-wide" onClick={() => setPrompt(null)}>
            Not now
          </button>
        </Sheet>
      )}

      {photo && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="Receipt photo">
          <button className="iconbtn viewer-close" onClick={() => setPhoto(null)} aria-label="Close">
            <Icon name="close" />
          </button>
          <div className="viewer-scroll">
            <img src={photo} alt="Receipt" />
          </div>
        </div>
      )}

      {busy && (
        <div className="busy" role="status">
          <span className="spinner" />
          {busy}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );
}
