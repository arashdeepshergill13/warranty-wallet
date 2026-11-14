import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Vault from './screens/Vault.jsx';
import ItemForm, { draftFromItem, draftFromScan, emptyDraft } from './screens/ItemForm.jsx';
import Detail from './screens/Detail.jsx';
import Settings from './screens/Settings.jsx';
import { Icon, Sheet, Group, Row } from './components/ui.jsx';
import { Layer } from './components/nav.jsx';
import { deleteItem, getState, load, readImage, saveItem, subscribe, updateSettings } from './lib/storage.js';
import { openAppSettings, recognizeText, scanDocument, scannerAvailable, setPrivacyScreen, unlock } from './lib/native.js';
import { askForReminders, onReminderTapped, reminderPermission, syncReminders } from './lib/reminders.js';
import { parseReceipt } from './lib/parser.js';
import { fileToJpeg, makeThumb } from './lib/images.js';
import { success, tap, warning } from './lib/haptics.js';
import { APP_NAME } from './lib/config.js';

const RELOCK_AFTER_MS = 30 * 1000;
const SLIDE_MS = 460;
const ROOT = { key: 0, name: 'vault', kind: 'root' };

function AppMark({ size = 76 }) {
  return (
    <span className="app-mark" style={{ width: size, height: size, borderRadius: size * 0.225 }} aria-hidden="true">
      <Icon name="shield" size={size * 0.58} weight={1.9} />
    </span>
  );
}

function Welcome({ onDone }) {
  const points = [
    ['scan', 'Scan a receipt', 'The store, date and price are read for you.'],
    ['bell', 'Get reminded in time', 'A nudge before each warranty runs out.'],
    ['lock', 'Private by design', 'Everything stays on this iPhone. No account.'],
  ];
  return (
    <div className="welcome">
      <div className="welcome-body">
        <AppMark />
        <h1>Everything you buy, backed.</h1>
        <ul className="welcome-points">
          {points.map(([icon, title, body]) => (
            <li key={title}>
              <span className="welcome-icon">
                <Icon name={icon} size={30} weight={1.7} />
              </span>
              <span>
                <b>{title}</b>
                {body}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <button className="btn btn-primary btn-wide" onClick={onDone}>
        Get started
      </button>
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
    <div className="lock">
      <AppMark />
      <h1>{APP_NAME} is locked</h1>
      <p>{failed ? 'That didn’t work. Try again.' : 'Unlock to see your receipts.'}</p>
      <button className="btn btn-primary" onClick={attempt}>
        <Icon name="faceid" size={20} weight={2} />
        Unlock
      </button>
    </div>
  );
}

export default function App() {
  const state = useSyncExternalStore(subscribe, getState);
  const { items, settings, ready } = state;
  const [stack, setStack] = useState([ROOT]);
  const [locked, setLocked] = useState(false);
  const [adding, setAdding] = useState(false);
  const [canScan, setCanScan] = useState(false);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prompt, setPrompt] = useState(null); // 'reminders' | 'camera'
  const photoInput = useRef(null);
  const hiddenAt = useRef(0);
  const nextKey = useRef(1);
  const toastTimer = useRef(0);

  const notify = useCallback((message, good = false) => {
    setToast({ message, good });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  // ---- the stack of screens ----
  const push = useCallback((entry) => {
    setStack((s) => [...s, { ...entry, key: nextKey.current++ }]);
  }, []);

  // Slide screens away, then take them out of the stack.
  const dismiss = useCallback((keys, patch) => {
    setStack((s) => s.map((e) => (keys.includes(e.key) ? { ...e, ...patch, leaving: true } : e)));
    window.setTimeout(() => setStack((s) => s.filter((e) => !keys.includes(e.key))), SLIDE_MS);
  }, []);

  const showItem = useCallback((id) => {
    setStack([ROOT, { key: nextKey.current++, name: 'detail', kind: 'push', id }]);
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
    onReminderTapped(showItem).then((off) => {
      stop = off;
    });
    return () => stop();
  }, [showItem, notify]);

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

  // ---- adding and editing ----
  const openDraft = useCallback(
    (draft) => {
      setPreview(draft.images?.length ? `data:image/jpeg;base64,${draft.images[0]}` : null);
      push({ name: 'form', kind: 'modal', draft });
    },
    [push]
  );

  const readPages = (pages) => {
    const lines = pages.flatMap((page, index) => (page.lines || []).map((l) => ({ ...l, y: (Number(l.y) || 0) + index })));
    const parsed = parseReceipt(lines, { order: settings.dateOrder });
    if (parsed.foundText) success();
    openDraft(draftFromScan(parsed, pages.map((p) => p.image)));
  };

  const startScan = async () => {
    setAdding(false);
    try {
      const result = await scanDocument();
      if (result.cancelled || !result.pages.length) return;
      setBusy('Reading receipt');
      readPages(result.pages);
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
    setBusy('Reading receipt');
    try {
      const image = await fileToJpeg(file);
      readPages([{ image, lines: await recognizeText(image) }]);
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

  const editItem = (item) => {
    setPreview(item.thumb || null);
    push({ name: 'form', kind: 'modal', draft: draftFromItem(item) });
    if (item.images[0]) readImage(item.images[0]).then(setPreview).catch(() => {});
  };

  const save = async (entry, fields) => {
    const { draft } = entry;
    try {
      const thumb = draft.images?.length ? await makeThumb(draft.images[0]).catch(() => '') : fields.thumb || '';
      const item = await saveItem({ ...fields, thumb }, draft.images);
      success();
      if (draft.isNew) {
        // Put the new item's page underneath, so it is there when the form slides away.
        setStack((s) => {
          const at = s.findIndex((e) => e.key === entry.key);
          const page = { key: nextKey.current++, name: 'detail', kind: 'push', id: item.id, immediate: true };
          return at === -1 ? [...s, page] : [...s.slice(0, at), page, ...s.slice(at)];
        });
      }
      dismiss([entry.key]);
      const offerReminders = draft.isNew && item.expiryDate && settings.remindersOn && (await reminderPermission()) === 'prompt';
      if (offerReminders) setPrompt('reminders');
      else notify(draft.isNew ? 'Saved' : 'Changes saved', true);
    } catch {
      notify('Could not save. Check that your phone has free space.');
    }
  };

  const remove = async (entry, item) => {
    warning();
    dismiss(
      stack.filter((e) => e.kind !== 'root').map((e) => e.key),
      { snapshot: item }
    );
    await deleteItem(item.id);
    notify('Deleted', true);
  };

  if (!ready) return <div className="boot" aria-busy="true" />;
  if (locked) return <LockScreen onUnlock={() => setLocked(false)} />;
  if (!settings.onboarded) return <Welcome onDone={() => updateSettings({ onboarded: true })} />;

  let topIndex = 0;
  stack.forEach((e, i) => {
    if (!e.leaving) topIndex = i;
  });

  const renderScreen = (entry) => {
    const back = () => dismiss([entry.key]);
    if (entry.name === 'vault') {
      return (
        <Vault
          items={items}
          settings={settings}
          onOpen={(id) => push({ name: 'detail', kind: 'push', id })}
          onAdd={() => {
            tap();
            setAdding(true);
          }}
          onSettings={() => push({ name: 'settings', kind: 'push' })}
        />
      );
    }
    if (entry.name === 'detail') {
      const item = items.find((i) => i.id === entry.id) || entry.snapshot;
      if (!item) return null;
      return <Detail item={item} settings={settings} onBack={back} onEdit={() => editItem(item)} onDelete={() => remove(entry, item)} onViewPhoto={setPhoto} notify={notify} />;
    }
    if (entry.name === 'form') {
      return <ItemForm draft={entry.draft} settings={settings} preview={preview} onViewPhoto={() => setPhoto(preview)} onSave={(fields) => save(entry, fields)} onCancel={back} />;
    }
    return <Settings settings={settings} itemCount={items.length} onBack={back} notify={notify} />;
  };

  return (
    <div className="app">
      {stack.map((entry, i) => (
        <Layer
          key={entry.key}
          kind={entry.kind}
          immediate={entry.immediate}
          position={entry.leaving ? 'leaving' : i === topIndex ? 'top' : i === topIndex - 1 ? 'under' : 'buried'}
          coveredBy={stack[topIndex].kind}
          onBack={entry.kind === 'push' ? () => dismiss([entry.key]) : undefined}
        >
          {renderScreen(entry)}
        </Layer>
      ))}

      {state.saveError && <div className="banner">Changes are not being saved. Free up some space on your phone, then reopen the app.</div>}

      <input ref={photoInput} type="file" accept="image/*" hidden onChange={startPhoto} />

      {adding && (
        <Sheet title="Add a receipt" onClose={() => setAdding(false)}>
          <Group>
            {canScan && <Row icon="scan" color="var(--accent-fill)" title="Scan a receipt" onClick={startScan} />}
            <Row icon="photo" color="#0a84ff" title="Choose a photo" onClick={() => photoInput.current?.click()} />
            <Row icon="pencil" color="#ff9500" title="Type it in" onClick={startManual} />
          </Group>
          <button className="btn btn-plain btn-wide" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </Sheet>
      )}

      {prompt === 'reminders' && (
        <Sheet title="Want a reminder before this runs out?" message="You’ll get a notification 30 days, 7 days and 1 day before a warranty ends. You can change this in Settings." onClose={() => setPrompt(null)}>
          <button
            className="btn btn-primary btn-wide"
            onClick={async () => {
              setPrompt(null);
              if ((await askForReminders()) === 'granted') {
                syncReminders(getState().items, getState().settings);
                notify('Reminders are on', true);
              }
            }}
          >
            Turn on reminders
          </button>
          <button
            className="btn btn-plain btn-wide"
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
        <Sheet title="The camera is switched off" message={`To scan receipts, allow camera access for ${APP_NAME} in iPhone Settings. You can also choose a photo instead.`} onClose={() => setPrompt(null)}>
          <button
            className="btn btn-primary btn-wide"
            onClick={() => {
              setPrompt(null);
              openAppSettings();
            }}
          >
            Open Settings
          </button>
          <button className="btn btn-plain btn-wide" onClick={() => setPrompt(null)}>
            Not now
          </button>
        </Sheet>
      )}

      {photo && (
        <div className="viewer" role="dialog" aria-modal="true" aria-label="Receipt photo">
          <button className="viewer-close" onClick={() => setPhoto(null)} aria-label="Close">
            <Icon name="close" size={18} weight={2.6} />
          </button>
          <div className="viewer-scroll">
            <img src={photo} alt="Receipt" />
          </div>
        </div>
      )}

      {busy && (
        <div className="hud" role="status">
          <span className="spinner" />
          {busy}
        </div>
      )}
      {toast && (
        <div className={`toast${toast.good ? ' is-good' : ''}`} role="status">
          {toast.good && <Icon name="check" size={16} weight={3} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
