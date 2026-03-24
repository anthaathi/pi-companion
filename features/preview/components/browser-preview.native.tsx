import { useCallback, useMemo, useRef } from "react";
import { StyleSheet } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";

import type { PreviewTarget } from "@/features/preview/store";

interface BrowserPreviewProps {
  serverUrl: string;
  accessToken?: string;
  sessionId: string;
  target: PreviewTarget;
}

/**
 * Native preview uses the backend's header-based proxy mode.
 * Instead of loading from the deep `/api/agent/sessions/.../preview/...` path
 * (which breaks apps expecting to run at `/`), we load from the server root
 * and inject `x-pi-preview-*` headers so the backend routes to the right
 * upstream. This keeps `location.pathname` as `/` and all absolute paths work.
 */
export function BrowserPreview({
  serverUrl,
  accessToken,
  sessionId,
  target,
}: BrowserPreviewProps) {
  const webViewRef = useRef<WebView>(null);

  // Headers that tell the backend which preview target to proxy to
  const previewHeaders = useMemo(
    () => ({
      "x-pi-preview-session": sessionId,
      "x-pi-preview-hostname": target.hostname,
      "x-pi-preview-port": String(target.port),
      ...(accessToken
        ? { "x-proxy-authorization": `Bearer ${accessToken}` }
        : {}),
    }),
    [sessionId, target.hostname, target.port, accessToken],
  );

  // Initial URL: server root with query params for the first request
  // (the fallback handler in web.rs picks these up and stores as active preview)
  const initialUri = useMemo(() => {
    const url = new URL(serverUrl);
    url.searchParams.set("__pi_s", sessionId);
    url.searchParams.set("__pi_h", target.hostname);
    url.searchParams.set("__pi_p", String(target.port));
    if (accessToken) {
      url.searchParams.set("__pi_t", accessToken);
    }
    return url.toString();
  }, [serverUrl, sessionId, target.hostname, target.port, accessToken]);

  const key = `${sessionId}_${target.hostname}_${target.port}`;

  // Intercept navigations to inject preview headers
  const onShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation) => {
      // Allow the initial load (it has __pi_s query params)
      if (request.url.includes("__pi_s=")) return true;

      // For same-origin navigations, reload with headers
      try {
        const reqUrl = new URL(request.url);
        const baseUrl = new URL(serverUrl);
        if (reqUrl.origin === baseUrl.origin) {
          // Cancel this navigation and re-do it with headers
          webViewRef.current?.injectJavaScript(`
            (function() {
              fetch('${request.url}', {
                headers: ${JSON.stringify(previewHeaders)},
                redirect: 'follow',
              }).then(function(r) { return r.text(); })
                .then(function(html) {
                  document.open();
                  document.write(html);
                  document.close();
                  history.replaceState(null, '', '${reqUrl.pathname}${reqUrl.search}');
                });
            })();
            true;
          `);
          return false;
        }
      } catch {
        // URL parse error — allow navigation
      }
      return true;
    },
    [serverUrl, previewHeaders],
  );

  // JS to inject that patches fetch/XHR to add preview headers on every request
  const injectedJS = useMemo(() => {
    const headers = JSON.stringify(previewHeaders);
    return `
(function() {
  var _headers = ${headers};

  // Patch fetch
  var _fetch = window.fetch;
  window.fetch = function(input, init) {
    init = init || {};
    var h = new Headers(init.headers || {});
    for (var k in _headers) {
      if (!h.has(k)) h.set(k, _headers[k]);
    }
    init.headers = h;
    return _fetch.call(this, input, init);
  };

  // Patch XMLHttpRequest
  var _open = XMLHttpRequest.prototype.open;
  var _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function() {
    this._piArgs = arguments;
    return _open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function() {
    for (var k in _headers) {
      try { this.setRequestHeader(k, _headers[k]); } catch(e) {}
    }
    return _send.apply(this, arguments);
  };
})();
true;
`;
  }, [previewHeaders]);

  return (
    <WebView
      key={key}
      ref={webViewRef}
      source={{
        uri: initialUri,
        headers: previewHeaders,
      }}
      injectedJavaScriptBeforeContentLoaded={injectedJS}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      style={styles.webview}
      originWhitelist={["*"]}
      setSupportMultipleWindows={false}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
