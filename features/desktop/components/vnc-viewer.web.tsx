import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
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

  return (
    <View style={styles.container}>
      <iframe
        srcDoc={html}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        allow="clipboard-read; clipboard-write; fullscreen"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
