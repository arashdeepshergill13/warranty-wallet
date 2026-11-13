# Getting Slipkeep onto the App Store

Everything that can be prepared ahead of time is in this repository: the app, the icon, the screenshots, the privacy policy and the listing text. What is left are the steps Apple only lets the account owner do, on a Mac. Work through them in order. Budget an evening for steps 1 to 5, then Apple's review usually takes a day or two.

## Before you start

| You need | Notes |
| --- | --- |
| A Mac with Xcode 26 or later | Free from the Mac App Store. It is a large download; start it first. |
| Apple Developer Program membership | US$99 a year, at [developer.apple.com/programs](https://developer.apple.com/programs/). Enrol as an individual. Approval can take up to 48 hours. |
| Your iPhone and its cable | The scanner and Face ID only work on a real phone, not the simulator. |
| Node 22 or later | You already have it. Check with `node -v`. |

**About the name.** There are already two apps called "Warranty Wallet" on the App Store, and Apple does not allow duplicate names. This build is named **Slipkeep**. If you want something else, change it in three places: `src/lib/config.js`, `capacitor.config.json` (`appName`), and the two pages in `public/`. App Store Connect tells you straight away if a name is taken.

## 1. Build the iPhone project (10 minutes)

In Terminal:

```bash
cd ~/warranty-wallet/app
git fetch origin
git checkout ios-local-first
bash scripts/setup-ios.sh
```

The script installs packages, runs the tests, builds the app, creates the Xcode project, applies the icon, permission wording and privacy settings, then opens Xcode.

When it finishes, save the generated project so you never have to recreate it:

```bash
git add -A && git commit -m "Add iOS project" && git push
```

## 2. Set it up in Xcode (10 minutes)

1. In the left sidebar click the blue **App** icon at the top, then the **App** target, then the **Signing & Capabilities** tab.
2. Tick **Automatically manage signing** and pick your name under **Team**.
3. **Bundle Identifier** is `com.arashdeepshergill.slipkeep`. Keep it or change it now; it can never change after the first upload. If you change it, change `appId` in `capacitor.config.json` to match.
4. Click **+ Capability**, choose **Data Protection**. Leave it on "Complete Protection". This keeps the receipt files encrypted whenever the phone is locked.
5. Privacy manifest: if the setup script printed "One manual step", drag `ios/App/App/PrivacyInfo.xcprivacy` from Finder into the **App** folder in Xcode's sidebar and tick the **App** target in the dialog.
6. Plug in your iPhone, pick it in the device menu at the top, and press the Run button. The first time, the phone asks you to trust the developer in Settings > General > VPN & Device Management.

If Xcode shows a red build error, copy the message and send it to Claude. The Swift file in `plugins/wallet-native` was written against Apple's documented APIs but could not be compiled on the machine that wrote it, so this first build is its real test.

### Check these on your phone before going further

The interface and the receipt-reading logic are covered by automated tests. These parts depend on the phone itself and have not been run anywhere yet:

- [ ] Add a receipt > Scan a receipt opens the camera, finds the page edges, and lands on the review screen with details filled in.
- [ ] Add a receipt > Choose a photo works with a receipt photo from your library.
- [ ] Saving the first item offers reminders, and iOS shows its permission question.
- [ ] Settings > Lock with Face ID asks for Face ID, then asks again after the app has been closed for 30 seconds.
- [ ] With the lock on, the app's contents are hidden in the app switcher.
- [ ] Settings > Back up everything opens the share sheet with a file.
- [ ] Add an item whose warranty ends in two days. At 9 the next morning a reminder should arrive.
- [ ] Turn on Airplane Mode and use the app. Everything should still work.

Scan five or six different receipts. If one reads badly, send Claude the photo and it can tune the reader.

## 3. Publish the privacy and support pages (2 minutes)

Apple requires a public privacy policy link and a support link. Both pages are in this branch. Merging the pull request for `ios-local-first` into `main` makes Vercel publish them at:

- `https://warranty-wallet-five.vercel.app/privacy.html`
- `https://warranty-wallet-five.vercel.app/support.html`

Merging also replaces the old web app at that address with this version. Receipts saved in the old web app are in Supabase and will no longer be shown; open the old site and note anything you want to keep before you merge.

The support page points people to the repository's issue board. If you would rather give an email address, create one for the app and edit `public/support.html`.

## 4. Create the App Store listing (30 minutes)

At [appstoreconnect.apple.com](https://appstoreconnect.apple.com) choose **Apps > + > New App**.

| Field | Value |
| --- | --- |
| Platform | iOS |
| Name | Slipkeep |
| Primary language | English (Canada) or English (U.S.) |
| Bundle ID | the one from step 2 (it appears in the list after your first build in Xcode) |
| SKU | slipkeep-001 |

Then fill in the version page. Copy and paste from here.

**Subtitle** (30 characters max)

```
Receipts and warranty tracker
```

**Promotional text**

```
Scan a receipt once. Get a reminder before the warranty runs out. Everything stays on your iPhone.
```

**Description**

```
You bought it, it broke, and the receipt is gone. Slipkeep makes sure that doesn't cost you money again.

Scan a receipt when you buy something worth protecting. Slipkeep reads the store, date and price, keeps the photo, and reminds you before the warranty runs out, while you can still make a claim.

SCAN IN SECONDS
• Point the camera at a receipt. The page is found and straightened automatically.
• The store, purchase date, items and prices are read for you. Check them and save.
• Works with photos and screenshots you already have, or type the details in.

KNOW WHAT'S COVERED
• See everything you own that is still under warranty, with the time left on each.
• Items about to run out are highlighted at the top.
• Search by product or store.

GET REMINDED IN TIME
• Notifications 30 days, 7 days and 1 day before a warranty ends. Choose your own timing.

PROOF WHEN YOU NEED IT
• Share the receipt photo with the purchase date, price and serial number in one tap when you make a claim.

PRIVATE BY DESIGN
• No account. No sign-up. No cloud.
• Receipts are read on your iPhone and stored only on your iPhone.
• The app cannot connect to the internet. No ads, no analytics, no tracking.
• Optional Face ID lock.
• Included in your own iPhone backup. Export a full backup or a spreadsheet whenever you like.

A note on warranty lengths: when a receipt doesn't state the warranty period, Slipkeep suggests a typical length for that kind of product and marks it as an estimate. Check the box or manual and set the real length.
```

**Keywords** (99 of 100 characters)

```
warranty,receipt,scanner,tracker,reminder,expiry,guarantee,proof of purchase,appliance,vault,return
```

**Support URL**: `https://warranty-wallet-five.vercel.app/support.html`
**Marketing URL**: leave empty
**Privacy Policy URL** (under App Privacy): `https://warranty-wallet-five.vercel.app/privacy.html`
**Copyright**: `2026 Arashdeep Shergill`
**Category**: Primary Productivity, secondary Utilities
**Price**: Free

**Screenshots.** Under "iPhone 6.9-inch Display", upload the six images in `docs/app-store/screenshots/` in numbered order. They are the required 1320 × 2868 size. The app is iPhone-only, so no iPad screenshots are needed. They use made-up stores and products; once the app runs on your phone you can replace them with real captures if you prefer.

**App Privacy.** Click Get Started and answer **No, we do not collect data from this app**. The listing will show "Data Not Collected". This is accurate: the app has no network access at all.

**Age rating.** Answer None or No to every question. The result is 4+.

**Content rights.** The app does not contain third-party content.

**Export compliance.** Already declared in the project as using no non-exempt encryption, so you should not be asked.

**Digital Services Act (EU).** Apple asks whether you are a "trader". That is a legal status question about you, so read Apple's explanation and answer for your own situation. If you are unsure, you can leave the EU out of availability for now and add it later.

**App Review Information.** Sign-in required: No. Paste this into Notes:

```
Slipkeep is a receipt and warranty tracker that works entirely on the device.

• No account or login. Open the app and tap "Get started".
• To test: tap "Add a receipt", then "Scan a receipt" and photograph any receipt, or tap "Type it in" to add an item by hand.
• Text recognition uses Apple's Vision framework on the device. Receipt photos are never uploaded. The app makes no network requests and uses no third-party AI or analytics.
• Notifications are local notifications scheduled on the device, used only for warranty expiry reminders the user turns on.
• Face ID is used only for the optional app lock in Settings.
• Camera access is used only for scanning receipts with the system document scanner.
```

## 5. Upload and submit (20 minutes plus waiting)

1. In Xcode, set the device menu to **Any iOS Device (arm64)**.
2. Menu bar: **Product > Archive**. When it finishes the Organizer window opens.
3. **Distribute App > App Store Connect > Upload**. Accept the defaults.
4. After 10 to 30 minutes the build appears in App Store Connect under **TestFlight**. Install the TestFlight app on your phone and try the build once more.
5. On the version page, under **Build**, select the build. Click **Add for Review**, then **Submit**.

For each later update, raise `APP_VERSION` in `src/lib/config.js` and the version in Xcode's General tab, run `npm run ios`, then repeat this step.

## If Apple sends it back

| What they say | What to do |
| --- | --- |
| The name is already in use | Pick another name (see "About the name") and resubmit. |
| Guideline 4.2, minimum functionality | Reply that the app uses the system document scanner, on-device text recognition, local notifications and Face ID, and works fully offline. Attach a short screen recording of a scan. |
| Guideline 5.1.1, a permission description is unclear | The wording lives in `scripts/apply-ios-resources.mjs`. Edit it, run `npm run ios:setup`, upload again. |
| Missing privacy manifest reason (email titled ITMS-91053) | Step 2.5 was missed. Add the file to the App target and upload again. |
| Anything else | Paste the message to Claude. |

## After it is live: switch off the old backend

The first version of this app sent receipt photos to Google and Anthropic through a Supabase function. This version uses none of that, and the old pieces are still running and still open to the internet:

1. **Supabase.** Delete the `parse-receipt` function and the `receipts` storage bucket, or pause the whole project. That function was deployed without a login check, so anyone with its address can run up your Google and Anthropic bills, and the bucket is public.
2. **Anthropic console.** Delete every API key. At least two were pasted into a chat.
3. **Google Cloud.** Delete the Vision API key, and remove billing from the project if you no longer use it.

## What "secure" means here, plainly

- **No server, no accounts.** There is nothing online to break into and no password to steal.
- **No network access.** The built app carries a policy that makes the web view refuse every outgoing connection. A bug or a bad dependency cannot quietly send receipts anywhere.
- **Encrypted at rest.** iOS encrypts the app's files with the phone's passcode. With Data Protection set to Complete (step 2.4) they are unreadable while the phone is locked.
- **App lock.** Optional Face ID, Touch ID or passcode on opening, and the app switcher preview is blanked. This is a screen lock for someone holding your unlocked phone, not a second layer of encryption.
- **Little third-party code.** Scanning, text recognition and the lock use Apple's own frameworks through one small Swift file in this repository. The only other native code is Capacitor's official plugins for files, notifications and sharing.
- **Limits.** Backup files made with "Back up everything" are not encrypted; keep them somewhere private. Someone who knows your iPhone passcode can open the app. Receipt photos can show the last digits of a card number, which is why they never leave the phone.
