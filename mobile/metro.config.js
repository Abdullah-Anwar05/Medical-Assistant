const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @medipath/client-core is consumed as TypeScript source from outside this folder.
config.watchFolders = [path.resolve(__dirname, '../packages/client-core')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
