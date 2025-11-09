export type RWAItem = {
  assetId: number
  title: string
  artist: string
  pricePerShareEth: number
  image?: string
}

// Manually curated demo list; assetId must match marketplace assets order
export const RWA_LIST: RWAItem[] = [
  { assetId: 0, title: 'Sunset Drive', artist: 'Nova Miles', pricePerShareEth: 0.002, image: '/album1.jpg' },
  { assetId: 1, title: 'Echoes of Blue', artist: 'Astra', pricePerShareEth: 0.003, image: '/album2.jpg' },
  { assetId: 2, title: 'Neon Skyline', artist: 'Citywave', pricePerShareEth: 0.0015, image: '/album3.jpg' },
]