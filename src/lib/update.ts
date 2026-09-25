import Constants from 'expo-constants'

const RELEASE_API = 'https://api.github.com/repos/JaoDaJunq/JunqLife/releases/latest'

export type AppUpdate = {
  currentVersion: string
  latestVersion: string
  tagName: string
}

function normalize(version: string) {
  return version.trim().replace(/^v/i, '').split('-')[0]
}

function parts(version: string) {
  return normalize(version)
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0))
}

export function isVersionNewer(candidate: string, current: string) {
  const a = parts(candidate)
  const b = parts(current)
  const length = Math.max(a.length, b.length)

  for (let index = 0; index < length; index += 1) {
    const left = a[index] ?? 0
    const right = b[index] ?? 0
    if (left > right) return true
    if (left < right) return false
  }

  return false
}

export async function checkForAppUpdate(): Promise<AppUpdate | null> {
  const currentVersion = Constants.expoConfig?.version ?? '0.0.0'

  const response = await fetch(RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) return null

  const release = (await response.json()) as {
    tag_name?: string
    draft?: boolean
    prerelease?: boolean
  }

  if (!release.tag_name || release.draft || release.prerelease) return null

  const latestVersion = normalize(release.tag_name)
  if (!isVersionNewer(latestVersion, currentVersion)) return null

  return {
    currentVersion,
    latestVersion,
    tagName: release.tag_name,
  }
}
