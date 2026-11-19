// Applies everything the generated Xcode project needs that Capacitor does not
// set by itself: permission wording, iPhone-only, portrait, the app icon, the
// launch image and Apple's privacy manifest. Safe to run repeatedly.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const app = path.join(root, 'ios/App/App');
const plist = path.join(app, 'Info.plist');
const project = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
const { appName } = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));

if (!fs.existsSync(plist)) {
  console.error('ios/App/App/Info.plist not found. Run "npx cap add ios" first.');
  process.exit(1);
}

const plutil = (...args) => execFileSync('/usr/bin/plutil', [...args, plist], { stdio: 'pipe' });

plutil('-replace', 'NSCameraUsageDescription', '-string', `${appName} uses the camera to scan your receipts. Scans are saved only on this iPhone.`);
plutil('-replace', 'NSFaceIDUsageDescription', '-string', `${appName} uses Face ID to lock the app so only you can open your receipts.`);
plutil('-replace', 'ITSAppUsesNonExemptEncryption', '-bool', 'NO');
plutil('-replace', 'UISupportedInterfaceOrientations', '-json', '["UIInterfaceOrientationPortrait"]');
try {
  plutil('-remove', 'UISupportedInterfaceOrientations~ipad');
} catch {
  // not present
}
console.log('  Info.plist: camera and Face ID wording, portrait only, encryption declaration');

if (fs.existsSync(project)) {
  const before = fs.readFileSync(project, 'utf8');
  const after = before.replace(/TARGETED_DEVICE_FAMILY = "1,2";/g, 'TARGETED_DEVICE_FAMILY = 1;');
  if (after !== before) fs.writeFileSync(project, after);
  console.log('  Project: iPhone only');
}

const replaceImages = (folder, source, label) => {
  const dir = path.join(app, 'Assets.xcassets', folder);
  if (!fs.existsSync(dir)) return console.log(`  ${label}: ${folder} not found, skipped`);
  const images = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.png'));
  for (const file of images) fs.copyFileSync(path.join(root, 'resources', source), path.join(dir, file));
  console.log(`  ${label}: replaced ${images.length} image${images.length === 1 ? '' : 's'}`);
};
replaceImages('AppIcon.appiconset', 'icon.png', 'App icon');
replaceImages('Splash.imageset', 'splash.png', 'Launch image');

const manifest = path.join(app, 'PrivacyInfo.xcprivacy');
if (!fs.existsSync(manifest)) fs.copyFileSync(path.join(root, 'resources/PrivacyInfo.xcprivacy'), manifest);

// Data Protection: receipt files stay encrypted whenever the phone is locked.
fs.writeFileSync(
  path.join(app, 'App.entitlements'),
  `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.default-data-protection</key>
	<string>NSFileProtectionComplete</string>
</dict>
</plist>
`
);

// Link the privacy manifest and entitlements into the App target, keep the app
// off Mac and Vision Pro, and match the version to src/lib/config.js.
if (fs.existsSync(project)) {
  let pbx = fs.readFileSync(project, 'utf8');
  const PRIV_REF = 'B4C7ED0A2F10000100000001';
  const PRIV_BUILD = 'B4C7ED0A2F10000100000002';
  const ENT_REF = 'B4C7ED0A2F10000100000003';
  const insertBefore = (marker, text) => {
    if (!pbx.includes(marker)) throw new Error(`project.pbxproj: "${marker}" not found`);
    pbx = pbx.replace(marker, text + marker);
  };
  if (!pbx.includes('PrivacyInfo.xcprivacy')) {
    insertBefore('/* End PBXBuildFile section */', `\t\t${PRIV_BUILD} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${PRIV_REF} /* PrivacyInfo.xcprivacy */; };\n`);
    insertBefore('/* End PBXFileReference section */', `\t\t${PRIV_REF} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };\n`);
    pbx = pbx.replace(/(\/\* public \*\/,\n)(\t+\);\n\t+path = App;)/, `$1\t\t\t\t${PRIV_REF} /* PrivacyInfo.xcprivacy */,\n$2`);
    pbx = pbx.replace(/(\/\* config\.xml in Resources \*\/,\n)(\t+\);)/, `$1\t\t\t\t${PRIV_BUILD} /* PrivacyInfo.xcprivacy in Resources */,\n$2`);
  }
  if (!pbx.includes('App.entitlements')) {
    insertBefore('/* End PBXFileReference section */', `\t\t${ENT_REF} /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; };\n`);
    pbx = pbx.replace(/(\/\* public \*\/,\n)(\t+(?:[A-F0-9]{24} \/\* PrivacyInfo\.xcprivacy \*\/,\n\t+)?\);\n\t+path = App;)/, `$1\t\t\t\t${ENT_REF} /* App.entitlements */,\n$2`);
  }
  const setting = (key, value) => {
    const line = new RegExp(`\\t+${key} = [^;]+;\\n`, 'g');
    pbx = pbx.replace(line, '');
    pbx = pbx.replace(/(\t+)CODE_SIGN_STYLE = Automatic;\n/g, `$1${key} = ${value};\n$1CODE_SIGN_STYLE = Automatic;\n`);
  };
  const { APP_VERSION } = await import(path.join(root, 'src/lib/config.js'));
  setting('CODE_SIGN_ENTITLEMENTS', 'App/App.entitlements');
  setting('SUPPORTS_MACCATALYST', 'NO');
  setting('SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD', 'NO');
  setting('SUPPORTS_XR_DESIGNED_FOR_IPHONE_IPAD', 'NO');
  pbx = pbx.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${APP_VERSION};`);
  fs.writeFileSync(project, pbx);
  const linked = pbx.includes('PrivacyInfo.xcprivacy in Resources') && pbx.includes('App/App.entitlements');
  console.log(linked ? '  Project: privacy manifest, Data Protection, iPhone only, version ' + APP_VERSION : '  Project: could not link the privacy manifest; add it in Xcode (docs/APP_STORE_LAUNCH.md, step 2)');
}
