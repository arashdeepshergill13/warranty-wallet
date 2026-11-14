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
const linked = fs.existsSync(project) && fs.readFileSync(project, 'utf8').includes('PrivacyInfo.xcprivacy');
console.log(
  linked
    ? '  Privacy manifest: in place'
    : '  Privacy manifest: copied to ios/App/App/PrivacyInfo.xcprivacy.\n    >>> One manual step: in Xcode, drag that file into the "App" folder in the left sidebar\n    >>> and tick the "App" target. See docs/APP_STORE_LAUNCH.md, step 2.'
);
