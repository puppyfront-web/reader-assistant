const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'background/service-worker': './src/background/service-worker.ts',
    'content/content': ['./src/content/set-public-path.ts', './src/content/content.ts'],
    'popup/popup': './src/popup/popup.ts',
    'ui/panel-script': './src/ui/panel-script.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    publicPath: '',
    chunkFilename: '[name].js',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        { from: 'src/popup/popup.css', to: 'popup/popup.css' },
        { from: 'src/ui/panel.html', to: 'ui/panel.html' },
        { from: 'src/ui/panel.css', to: 'ui/panel.css' },
        { from: 'manifest.json', to: 'manifest.json' },
        { 
          from: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 
          to: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs' 
        },
      ],
    }),
  ],
  optimization: {
    splitChunks: false,
    runtimeChunk: false,
  },
  mode: 'production',
};

