import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const publicRoots = ['app', 'src', 'assets', 'app.json', 'eas.json']
const forbiddenInClient = [
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /SUPABASE_SECRET_KEYS/i,
  /EXPO_ACCESS_TOKEN/i,
  /BEGIN (?:RSA|OPENSSH|EC|PRIVATE) KEY/i,
]

function filesAt(relativePath) {
  const absolute = path.join(root, relativePath)
  if (!fs.existsSync(absolute)) return []
  if (fs.statSync(absolute).isFile()) return [absolute]
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolute, entry.name)
    if (entry.isDirectory()) return filesAt(path.relative(root, child))
    return [child]
  })
}

const violations = []
for (const file of publicRoots.flatMap(filesAt)) {
  const content = fs.readFileSync(file, 'utf8')
  for (const pattern of forbiddenInClient) {
    if (pattern.test(content)) violations.push(`${path.relative(root, file)} matches ${pattern}`)
  }
}

const functionSource = fs.readFileSync(path.join(root, 'supabase/functions/place-event-push/index.ts'), 'utf8')
for (const required of [
  "payload.type !== 'INSERT'",
  "payload.table !== 'place_events'",
  "from('place_events')",
  "from('place_push_deliveries')",
  "from('push_tokens')",
  "https://exp.host/--/api/v2/push/send",
]) {
  if (!functionSource.includes(required)) violations.push(`place-event-push missing contract: ${required}`)
}
if (!functionSource.includes('x-junqlife-webhook-secret')) violations.push('place-event-push missing private webhook authentication')

if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}

console.log('Security static checks passed.')
