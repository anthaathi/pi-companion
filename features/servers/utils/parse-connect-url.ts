export interface ConnectParams {
  hostname: string;
  ips: string[];
  port: string;
  qrId: string;
}

export function parseConnectUrl(url: string): ConnectParams | null {
  try {
    // Handle pi://connect?... format
    const normalized = url.replace(/^pi:\/\//, 'https://pi.local/');
    const parsed = new URL(normalized);

    if (!parsed.pathname.endsWith('/connect')) return null;

    const hostname = parsed.searchParams.get('hostname') ?? '';
    const ipsRaw = parsed.searchParams.get('ips') ?? '';
    const port = parsed.searchParams.get('port') ?? '5454';
    const qrId = parsed.searchParams.get('qr_id') ?? '';

    const ips = ipsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    if (ips.length === 0 || !qrId) return null;

    return { hostname, ips, port, qrId };
  } catch {
    return null;
  }
}

export function buildServerAddress(ip: string, port: string): string {
  return `http://${ip}:${port}`;
}
