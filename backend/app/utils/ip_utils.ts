export function isInternalIP(ip: string): boolean {
  if (!ip) return false
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true

  // Private IPv4 ranges
  // 10.0.0.0 - 10.255.255.255
  if (ip.startsWith('10.')) return true

  // 172.16.0.0 - 172.31.255.255
  if (ip.startsWith('172.')) {
    const parts = ip.split('.')
    if (parts.length > 1) {
      const second = Number.parseInt(parts[1], 10)
      if (second >= 16 && second <= 31) return true
    }
  }

  // 192.168.0.0 - 192.168.255.255
  if (ip.startsWith('192.168.')) return true

  // IPv6 Unique Local Addresses (fc00::/7)
  if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true

  // IPv6 Link-Local Addresses (fe80::/10)
  if (ip.toLowerCase().startsWith('fe80:')) return true

  return false
}
