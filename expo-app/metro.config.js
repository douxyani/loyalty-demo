const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = {
  ...config,
  resolver: {
    ...config.resolver,
    sourceExts: ['js', 'jsx', 'json', 'ts', 'tsx', 'cjs'],
    assetExts: ['ttf', 'png', 'jpg']
  }
};
