import { client } from './generated/client.gen';

let activeToken: string | null = null;

client.interceptors.request.use((request) => {
  if (activeToken) {
    request.headers.set('Authorization', `Bearer ${activeToken}`);
  }
  return request;
});

export function setActiveToken(token: string | null) {
  activeToken = token;
}

export function getActiveToken() {
  return activeToken;
}

export function setBaseUrl(baseUrl: string) {
  client.setConfig({ baseUrl });
}
