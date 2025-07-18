module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      '@babel/plugin-proposal-export-namespace-from',
      '@babel/plugin-transform-runtime',
      'react-native-reanimated/plugin', // MUST be last
    ],
  };
};
