const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const WEB_STUBS = {
  'react-native-pager-view': path.resolve(__dirname, 'web-stubs/react-native-pager-view.js'),
};

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, ...args) => {
  if (WEB_STUBS[moduleName] && context.platform !== 'ios' && context.platform !== 'android') {
    return { type: 'sourceFile', filePath: WEB_STUBS[moduleName] };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, ...args);
  }
  return context.resolveRequest(context, moduleName, ...args);
};

module.exports = config;
