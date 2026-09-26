import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const failures = []

const app = JSON.parse(read('app.json')).expo
if (!/^0\.1\.(?:1[7-9]|[2-9]\d)$/.test(app.version)) {
  failures.push(`app.json must be on the stabilization line, got ${app.version}`)
}
if (app.android.versionCode < 18) failures.push('Android versionCode must advance for the stabilization build')

const update = read('src/lib/update.ts')
for (const contract of ['AbortController', '8000', 'release.draft', 'release.prerelease']) {
  if (!update.includes(contract)) failures.push(`update checker missing ${contract}`)
}

const notifications = read('src/lib/notifications.ts')
for (const contract of ['getExpoPushTokenAsync', 'registerPushToken', 'token.data']) {
  if (!notifications.includes(contract)) failures.push(`notification registration missing ${contract}`)
}

const tracker = read('src/lib/tracking.native.ts')
for (const contract of ['distanceMeters: 40', 'intervalSeconds: 60', 'buffer: true', 'heartbeatIntervalSeconds: 300']) {
  if (!tracker.includes(contract)) failures.push(`tracking contract missing ${contract}`)
}

const workflow = read('.github/workflows/android-apk.yml')
for (const contract of ['assembleRelease', 'upload-artifact@v4', 'gh release']) {
  if (!workflow.includes(contract)) failures.push(`Android release workflow missing ${contract}`)
}

const iosWorkflow = read('.github/workflows/ios-build.yml')
for (const contract of ['expo/expo-github-action@v8', 'secrets.EXPO_TOKEN', 'eas build --platform ios', '--profile production']) {
  if (!iosWorkflow.includes(contract)) failures.push(`iOS workflow missing ${contract}`)
}

const eas = JSON.parse(read('eas.json'))
if (eas.build?.production?.autoIncrement !== true) failures.push('EAS production profile must auto-increment build numbers')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('Release contracts passed.')
