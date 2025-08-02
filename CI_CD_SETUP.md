# CI/CD Setup Guide

This repository now includes comprehensive CI/CD pipelines for Node.js, Python, and Ruby applications using GitHub Actions and Heroku deployment.

## Overview

The WebQx healthcare platform supports multiple runtime environments:

- **Node.js**: Main healthcare platform and API services
- **Python**: Flask-based healthcare data management API  
- **Ruby**: Sinatra-based patient management service

## GitHub Actions Workflows

### 1. Node.js CI/CD (`nodejs.yml`)

**Triggers:**
- Push to `main` or `develop` branches for JS/TS files
- Pull requests to `main` branch

**Pipeline Steps:**
- **Test Matrix**: Node.js versions 16.x, 18.x, 20.x
- Install dependencies: `npm ci`
- Type checking: `npm run type-check`
- Run tests: `npm test`
- Coverage reporting: `npm run test:coverage`
- Deploy to Heroku on `main` branch

### 2. Python CI/CD (`python.yml`)

**Triggers:**
- Push to `main` or `develop` branches for `python-app/` files
- Pull requests to `main` branch

**Pipeline Steps:**
- **Test Matrix**: Python versions 3.9, 3.10, 3.11
- Create virtual environment
- Install dependencies: `pip install -r requirements.txt`
- Syntax checking: `python -m py_compile`
- Run tests: `pytest test_app.py`
- Coverage reporting with pytest-cov
- Deploy to Heroku on `main` branch

### 3. Ruby CI/CD (`ruby.yml`)

**Triggers:**
- Push to `main` or `develop` branches for `ruby-app/` files
- Pull requests to `main` branch

**Pipeline Steps:**
- **Test Matrix**: Ruby versions 3.0, 3.1, 3.2
- Install dependencies: `bundle install`
- Syntax checking: `ruby -c`
- Run tests: `bundle exec rspec`
- Coverage reporting with SimpleCov
- Deploy to Heroku on `main` branch

## Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

### Heroku Deployment Secrets
```
HEROKU_API_KEY          # Your Heroku API key
HEROKU_EMAIL            # Your Heroku account email
HEROKU_APP_NAME_NODEJS  # Heroku app name for Node.js (e.g., webqx-nodejs)
HEROKU_APP_NAME_PYTHON  # Heroku app name for Python (e.g., webqx-python)
HEROKU_APP_NAME_RUBY    # Heroku app name for Ruby (e.g., webqx-ruby)
```

### Getting Heroku Secrets

1. **Heroku API Key:**
   ```bash
   heroku auth:token
   ```

2. **Create Heroku Apps:**
   ```bash
   heroku create webqx-nodejs --region us
   heroku create webqx-python --region us  
   heroku create webqx-ruby --region us
   ```

## Application Structure

```
webqx/
├── .github/workflows/
│   ├── nodejs.yml      # Node.js CI/CD pipeline
│   ├── python.yml      # Python CI/CD pipeline
│   └── ruby.yml        # Ruby CI/CD pipeline
├── python-app/
│   ├── app.py          # Flask application
│   ├── test_app.py     # Pytest tests
│   ├── requirements.txt
│   └── Procfile        # Heroku deployment config
├── ruby-app/
│   ├── app.rb          # Sinatra application
│   ├── spec/
│   │   └── app_spec.rb # RSpec tests
│   ├── Gemfile
│   ├── config.ru       # Rack configuration
│   └── Procfile        # Heroku deployment config
└── [Node.js files...]  # Existing Node.js application
```

## Local Development

### Node.js
```bash
npm install
npm test
npm start
```

### Python
```bash
cd python-app
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
pytest test_app.py
python app.py
```

### Ruby
```bash
cd ruby-app
bundle install
bundle exec rspec
bundle exec ruby app.rb
```

## Health Endpoints

Each application provides health check endpoints:

- **Node.js**: `GET /` or server-specific health endpoint
- **Python**: `GET /` - Returns JSON with service status
- **Ruby**: `GET /` - Returns JSON with service status

## Deployment Process

1. **Automated**: Push to `main` branch triggers deployment after successful tests
2. **Manual**: Use GitHub Actions "Re-run jobs" to manually trigger deployment
3. **Rollback**: Heroku automatically rolls back on failed health checks

## Monitoring

- Health checks run automatically during deployment
- Failed deployments trigger automatic rollback
- Coverage reports uploaded to Codecov
- Build artifacts stored for debugging

## Troubleshooting

### Common Issues

1. **Test Failures**: Check logs in GitHub Actions for detailed error messages
2. **Deployment Failures**: Verify Heroku secrets are correctly configured
3. **Health Check Failures**: Ensure applications start properly and expose correct endpoints

### Debug Commands

```bash
# Check Heroku logs
heroku logs --tail --app webqx-nodejs
heroku logs --tail --app webqx-python  
heroku logs --tail --app webqx-ruby

# Local health check testing
curl http://localhost:3000/        # Node.js
curl http://localhost:5000/        # Python
curl http://localhost:4567/        # Ruby
```

## Security Considerations

- All secrets stored securely in GitHub Secrets
- Dependencies automatically scanned by GitHub
- CodeQL security analysis runs weekly
- Production environment protection enabled
- Automatic rollback on deployment failures