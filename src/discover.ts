/**
 * Auto-discover public IP address when PUBLIC_ADDR is not set.
 * Tries AWS EC2 metadata first (fast, no external dependency),
 * then falls back to public IP discovery services.
 */

const EC2_METADATA_URL = "http://169.254.169.254/latest/meta-data/public-ipv4"
const EC2_TOKEN_URL = "http://169.254.169.254/latest/api/token"
const FALLBACK_URLS = [
  "https://checkip.amazonaws.com",
  "https://api.ipify.org",
]

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 2000): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      ...opts,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!resp.ok) return null
    const text = (await resp.text()).trim()
    return text || null
  } catch {
    return null
  }
}

async function tryEC2Metadata(): Promise<string | null> {
  const token = await fetchWithTimeout(EC2_TOKEN_URL, {
    method: "PUT",
    headers: { "X-aws-ec2-metadata-token-ttl-seconds": "30" },
  }, 1000)

  const headers: Record<string, string> = {}
  if (token) headers["X-aws-ec2-metadata-token"] = token

  return fetchWithTimeout(EC2_METADATA_URL, { headers }, 1000)
}

export async function discoverPublicAddr(): Promise<string | null> {
  const ec2Ip = await tryEC2Metadata()
  if (ec2Ip) {
    console.log(`[office] Auto-discovered public IP from EC2 metadata: ${ec2Ip}`)
    return ec2Ip
  }

  for (const url of FALLBACK_URLS) {
    const ip = await fetchWithTimeout(url)
    if (ip) {
      console.log(`[office] Auto-discovered public IP from ${new URL(url).hostname}: ${ip}`)
      return ip
    }
  }

  console.warn("[office] Could not auto-discover public IP — world will register without endpoints")
  return null
}
