import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

import type { PreviewTarget } from "@/features/preview/store";

interface BrowserPreviewProps {
  serverUrl: string;
  accessToken?: string;
  sessionId: string;
  target: PreviewTarget;
}

/**
 * Native preview loads from server root with __pi_* query params (initial request).
 * The backend stores the config and proxies to the upstream dev server.
 *
 * For subsequent requests (JS, CSS, images, fetch/XHR calls), we inject JS
 * before content loads that patches fetch() and XMLHttpRequest to add
 * x-pi-preview-* headers. The backend's header-based proxy picks these up.
 *
 * This means the app sees location.pathname as "/" and all paths work.
 */
export function BrowserPreview({
  serverUrl,
  accessToken,
  sessionId,
  target,
}: BrowserPreviewProps) {
  const uri = useMemo(() => {
    const base = serverUrl.replace(/\/$/, "");
    const params = [
      `__pi_s=${encodeURIComponent(sessionId)}`,
      `__pi_h=${encodeURIComponent(target.hostname)}`,
      `__pi_p=${encodeURIComponent(String(target.port))}`,
    ];
    if (accessToken) {
      params.push(`__pi_t=${encodeURIComponent(accessToken)}`);
    }
    return `${base}/?${params.join("&")}`;
  }, [serverUrl, sessionId, target.hostname, target.port, accessToken]);

  // JS injected before any page content loads.
  // Patches fetch() and XMLHttpRequest so every request from the previewed
  // app carries the x-pi-preview-* headers for the backend's header-based proxy.
  const injectedJS = useMemo(() => {
    const sid = sessionId.replace(/'/g, "\\'");
    const host = target.hostname.replace(/'/g, "\\'");
    const port = String(target.port);
    const token = (accessToken ?? "").replace(/'/g, "\\'");

    return `(function(){
  var S='${sid}',H='${host}',P='${port}',T='${token}';

  // --- Patch fetch ---
  var _f=window.fetch;
  window.fetch=function(u,o){
    o=o||{};
    var h=o.headers;
    if(h instanceof Headers){
      if(!h.has('x-pi-preview-session')){
        h.set('x-pi-preview-session',S);
        h.set('x-pi-preview-hostname',H);
        h.set('x-pi-preview-port',P);
        if(T)h.set('x-proxy-authorization','Bearer '+T);
      }
    } else {
      var n=Object.assign({},h||{});
      if(!n['x-pi-preview-session']){
        n['x-pi-preview-session']=S;
        n['x-pi-preview-hostname']=H;
        n['x-pi-preview-port']=P;
        if(T)n['x-proxy-authorization']='Bearer '+T;
      }
      o.headers=n;
    }
    return _f.call(this,u,o);
  };

  // --- Patch XMLHttpRequest ---
  var _xo=XMLHttpRequest.prototype.open;
  var _xs=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(){
    this.__piPatched=true;
    return _xo.apply(this,arguments);
  };
  XMLHttpRequest.prototype.send=function(){
    if(this.__piPatched){
      try{this.setRequestHeader('x-pi-preview-session',S)}catch(e){}
      try{this.setRequestHeader('x-pi-preview-hostname',H)}catch(e){}
      try{this.setRequestHeader('x-pi-preview-port',P)}catch(e){}
      if(T)try{this.setRequestHeader('x-proxy-authorization','Bearer '+T)}catch(e){}
    }
    return _xs.apply(this,arguments);
  };
})();true;`;
  }, [sessionId, target.hostname, target.port, accessToken]);

  const key = `${sessionId}_${target.hostname}_${target.port}`;

  return (
    <WebView
      key={key}
      source={{ uri }}
      injectedJavaScriptBeforeContentLoaded={injectedJS}
      style={styles.webview}
      originWhitelist={["*"]}
      setSupportMultipleWindows={false}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      startInLoadingState
      allowsBackForwardNavigationGestures
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
