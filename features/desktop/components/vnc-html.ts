export function buildVncHtml(wsUrl: string, vncPassword?: string | null): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; background: #111; }
  #screen { width: 100%; height: 100%; }
  #status {
    position: fixed; top: 0; left: 0; right: 0;
    padding: 6px 12px;
    font: 12px/1.4 system-ui, -apple-system, sans-serif;
    color: #aaa; background: rgba(0,0,0,0.7);
    z-index: 100; text-align: center;
    transition: opacity 0.3s;
  }
  #status.connected { opacity: 0; pointer-events: none; }
  #toolbar {
    position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%);
    display: flex; gap: 6px; z-index: 100;
    background: rgba(30,30,30,0.85); border-radius: 8px; padding: 4px 8px;
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    opacity: 0; transition: opacity 0.2s;
  }
  #toolbar:hover, #toolbar.visible { opacity: 1; }
  #toolbar button {
    background: transparent; border: 1px solid rgba(255,255,255,0.15);
    color: #ccc; padding: 4px 10px; border-radius: 5px;
    font: 11px/1.4 system-ui, sans-serif; cursor: pointer;
  }
  #toolbar button:hover { background: rgba(255,255,255,0.1); color: #fff; }
  #status button {
    background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
    color: #fff; padding: 4px 14px; border-radius: 5px; margin-left: 8px;
    font: 12px/1.4 system-ui, sans-serif; cursor: pointer;
  }
  #status button:hover { background: rgba(255,255,255,0.25); }
</style>
</head>
<body>
<div id="status">Connecting…</div>
<div id="screen"></div>
<div id="toolbar">
  <button id="btn-fs" title="Fullscreen">Fullscreen</button>
  <button id="btn-clip" title="Send clipboard">Paste</button>
  <button id="btn-keys" title="Send Ctrl+Alt+Del">Ctrl+Alt+Del</button>
</div>
<script type="module">
import RFB from "https://cdn.jsdelivr.net/gh/novnc/noVNC@v1.5.0/core/rfb.js";

const target = document.getElementById("screen");
const status = document.getElementById("status");
const toolbar = document.getElementById("toolbar");

const wsUrl = ${JSON.stringify(wsUrl)};
const vncPassword = ${JSON.stringify(vncPassword ?? '')};

let rfb;
let retries = 0;
const MAX_RETRIES = 3;

function connect() {
  status.textContent = "Connecting…";
  status.className = "";

  const opts = {};
  if (vncPassword) {
    opts.credentials = { password: vncPassword };
  }
  rfb = new RFB(target, wsUrl, opts);
  rfb.scaleViewport = true;
  rfb.resizeSession = false;
  rfb.clipViewport = true;

  rfb.addEventListener("connect", () => {
    retries = 0;
    status.textContent = "Connected";
    status.classList.add("connected");
    toolbar.classList.add("visible");
    setTimeout(() => toolbar.classList.remove("visible"), 2000);
  });

  rfb.addEventListener("disconnect", (e) => {
    status.classList.remove("connected");
    toolbar.classList.remove("visible");
    if (e.detail.clean) {
      status.innerHTML = 'Disconnected <button onclick="retries=0;connect()">Reconnect</button>';
    } else if (retries < MAX_RETRIES) {
      retries++;
      status.textContent = "Connection lost — retrying (" + retries + "/" + MAX_RETRIES + ")…";
      setTimeout(connect, 2000);
    } else {
      status.innerHTML = 'Connection lost <button onclick="retries=0;connect()">Reconnect</button>';
    }
  });

  rfb.addEventListener("credentialsrequired", () => {
    rfb.sendCredentials({ password: vncPassword });
  });
}

connect();

document.getElementById("btn-fs").addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

document.getElementById("btn-clip").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text && rfb) rfb.clipboardPasteFrom(text);
  } catch {}
});

document.getElementById("btn-keys").addEventListener("click", () => {
  if (rfb) rfb.sendCtrlAltDel();
});

document.body.addEventListener("mousemove", () => {
  toolbar.classList.add("visible");
  clearTimeout(window.__hideTimer);
  window.__hideTimer = setTimeout(() => toolbar.classList.remove("visible"), 3000);
});
</script>
</body>
</html>`;
}
