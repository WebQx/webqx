const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    'fhir/patients': './aws/handlers/fhir/patients.js',
    'fhir/observations': './aws/handlers/fhir/observations.js',
    'fhir/appointments': './aws/handlers/fhir/appointments.js',
    'telehealth/session': './aws/handlers/telehealth/session.js',
    'ai/whisper': './aws/handlers/ai/whisper.js',
    'audit/logger': './aws/handlers/audit/logger.js',
    'health/check': './aws/handlers/health/check.js'
  },
  target: 'node',
  externals: {
    'aws-sdk': 'aws-sdk',
    '@aws-sdk/client-dynamodb': '@aws-sdk/client-dynamodb',
    '@aws-sdk/lib-dynamodb': '@aws-sdk/lib-dynamodb',
    '@aws-sdk/client-s3': '@aws-sdk/client-s3',
    '@aws-sdk/client-kms': '@aws-sdk/client-kms',
    '@aws-sdk/client-ssm': '@aws-sdk/client-ssm',
    '@aws-sdk/client-cloudwatch': '@aws-sdk/client-cloudwatch'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  node: '18'
                }
              }]
            ]
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js', '.json']
  },
  output: {
    path: path.resolve(__dirname, '.webpack'),
    filename: '[name].js',
    libraryTarget: 'commonjs'
  },
  optimization: {
    minimize: true,
    splitChunks: false
  },
  stats: {
    warningsFilter: /^(?!CriticalDependenciesWarning$)/
  }
};