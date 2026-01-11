module.exports = function(api) {
  api.cache(true);
  
  const isWebpack = process.env.BABEL_ENV === 'webpack' || process.env.NODE_ENV === 'webpack';
  
  if (isWebpack) {
    return {
      presets: [
        ['@babel/preset-env', { targets: { browsers: ['last 2 versions'] } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
      plugins: [
        '@babel/plugin-transform-class-static-block',
        '@babel/plugin-transform-private-methods',
        '@babel/plugin-transform-private-property-in-object',
        ['module:react-native-dotenv', {
          moduleName: '@env',
          path: '.env',
          blacklist: null,
          whitelist: null,
          safe: false,
          allowUndefined: true
        }]
      ]
    };
  }
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module:react-native-dotenv', {
        moduleName: '@env',
        path: '.env',
        blacklist: null,
        whitelist: null,
        safe: false,
        allowUndefined: true
      }]
    ]
  };
}; 