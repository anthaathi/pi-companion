import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildVncHtml } from './vnc-html';

interface VncViewerProps {
  serverUrl: string;
  accessToken: string;
  vncPort: number;
  vncPassword?: string | null;
}

export function VncViewer({ serverUrl, accessToken, vncPort, vncPassword }: VncViewerProps) {
  const html = useMemo(() => {
    const url = new URL(serverUrl);
    const wsScheme = url.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsScheme}://${url.host}/api/desktop/ws?access_token=${encodeURIComponent(accessToken)}`;
    return buildVncHtml(wsUrl, vncPassword);
  }, [serverUrl, accessToken, vncPort, vncPassword]);

  const key = `vnc_${vncPort}`;

  return (
    <WebView
      key={key}
      source={{ html, baseUrl: 'https://cdn.jsdelivr.net' }}
      style={styles.webview}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      startInLoadingState
      setSupportMultipleWindows={false}
      mixedContentMode="always"
    />
  );
}

const styles = StyleSheet.create({
  webview: {
    flex: 1,
    backgroundColor: '#111',
  },
});
