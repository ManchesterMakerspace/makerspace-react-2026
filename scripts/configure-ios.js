const fs = require('fs');
const path = require('path');
const xcode = require('xcode');
const plist = require('plist');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'ios/App/App');
const projectFile = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
if (!fs.existsSync(projectFile)) throw new Error('Run cap add ios on macOS first.');
const project = xcode.project(projectFile); project.parseSync();
const group = project.findPBXGroupKey({ name: 'App' }) || project.findPBXGroupKey({ path: 'App' });
if (!group) throw new Error('Could not locate the App source group.');
for (const name of ['MakerspaceNfcPlugin.swift', 'MakerspaceViewController.swift', 'App.entitlements']) {
  fs.copyFileSync(path.join(root, 'native/ios', name), path.join(app, name));
  if (name.endsWith('.swift') && !project.hasFile(name)) project.addSourceFile(name, { target: project.getFirstTarget().uuid }, group);
}
project.updateBuildProperty('CODE_SIGN_ENTITLEMENTS', 'App/App.entitlements');
for (const file of Object.values(project.pbxFileReferenceSection())) {
  if (file && typeof file === 'object' && file.explicitFileType === undefined) delete file.explicitFileType;
}
fs.writeFileSync(projectFile, project.writeSync());
const infoPath = path.join(app, 'Info.plist');
const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));
info.NFCReaderUsageDescription = 'Read Makerspace NFC tags and register access cards.';
fs.writeFileSync(infoPath, plist.build(info));
const storyboard = path.join(app, 'Base.lproj/Main.storyboard');
fs.writeFileSync(storyboard, fs.readFileSync(storyboard, 'utf8').replace('customClass="CAPBridgeViewController" customModule="Capacitor"', 'customClass="MakerspaceViewController" customModule="App" customModuleProvider="target"'));
console.log('NFC sources configured. Select your signing team and enable NFC Tag Reading in Xcode.');
