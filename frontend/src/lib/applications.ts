export type FundingApplication = {
  id: string
  artist: string
  song: string
  amountUSDC: number // whole units
  royaltyPercent: number // 0-100
  demoLink: string
  tokenUri?: string
  createdAt: number
  proposed?: boolean
}

const KEY = 'tokentrax.apps.v1'

export function loadApplications(): FundingApplication[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FundingApplication[]) : []
  } catch {
    return []
  }
}

export function saveApplications(apps: FundingApplication[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(apps))
}

export function addApplication(app: Omit<FundingApplication, 'id' | 'createdAt' | 'proposed'>): FundingApplication {
  const apps = loadApplications()
  const full: FundingApplication = { id: crypto.randomUUID(), createdAt: Date.now(), proposed: false, ...app }
  apps.unshift(full)
  saveApplications(apps)
  return full
}

export function markProposed(id: string) {
  const apps = loadApplications()
  const idx = apps.findIndex(a => a.id === id)
  if (idx >= 0) {
    apps[idx].proposed = true
    saveApplications(apps)
  }
}
