const path = require('path');
const webpack = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  devtool: 'cheap-eval-source-map',
  entry: [
    'babel-polyfill',
    './src/index.js'
  ],
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'comment.js',
    publicPath: ''
  },

  plugins: [
    new webpack.optimize.UglifyJsPlugin(
      {
        minimize: true,
      }
    )
  ],
  
  resolve: {
    extensions: ['.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: ['babel-loader'],
        include: path.join(__dirname, 'src')
      },
      {
        test: /\.css$/,
        use: [
          { 
            loader: 'style-loader' 
          },
          {
            loader: 'css-loader'
          }
        ]
      }
    ]
  }
};
