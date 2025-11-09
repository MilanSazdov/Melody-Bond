"use client"

import type { Address } from 'viem'

/**
 * Format address for display
 */
export function shortAddress(addr?: string, lead = 6, tail = 4): string {
  if (!addr) return ''
  if (addr.length < lead + tail) return addr
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`
}

/**
 * Validate Ethereum address
 */
export function isValidAddress(addr: string): addr is Address {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

/**
 * Format balance for display (max 4 decimals)
 */
export function formatBalance(balance: string, decimals = 4): string {
  const num = parseFloat(balance)
  if (isNaN(num)) return '0'
  return num.toFixed(decimals)
}
