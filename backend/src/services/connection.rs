use local_ip_address::list_afinet_netifas;
use qrcode::QrCode;
use qrcode::render::unicode;

pub struct ConnectionInfo {
    pub hostname: String,
    pub ips: Vec<String>,
    pub port: u16,
}

impl ConnectionInfo {
    pub fn gather(port: u16) -> Self {
        let hostname = hostname::get()
            .map(|h| h.to_string_lossy().to_string())
            .unwrap_or_else(|_| "unknown".to_string());

        let ips = list_afinet_netifas()
            .map(|ifaces| {
                ifaces
                    .into_iter()
                    .filter(|(name, ip)| {
                        !ip.is_loopback()
                            && !name.starts_with("docker")
                            && !name.starts_with("br-")
                            && !name.starts_with("veth")
                    })
                    .map(|(_, ip)| ip.to_string())
                    .collect()
            })
            .unwrap_or_default();

        Self { hostname, ips, port }
    }

    pub fn deep_link(&self, qr_id: &str, server_id: &str) -> String {
        let ips_joined = self.ips.join(",");
        format!(
            "pi://connect?hostname={}&ips={}&port={}&qr_id={}&server_id={}",
            self.hostname, ips_joined, self.port, qr_id, server_id
        )
    }

    pub fn print_qr(&self, qr_id: &str, server_id: &str) {
        let url = self.deep_link(qr_id, server_id);
        let code = match QrCode::new(&url) {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!("Failed to generate QR code: {e}");
                return;
            }
        };

        let qr_string = code
            .render::<unicode::Dense1x2>()
            .dark_color(unicode::Dense1x2::Light)
            .light_color(unicode::Dense1x2::Dark)
            .build();

        println!();
        println!("  Scan to connect:");
        println!();
        for line in qr_string.lines() {
            println!("  {line}");
        }
        println!();
        println!("  {url}");
        println!();
    }
}
