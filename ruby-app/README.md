# WebQx Ruby Healthcare API

A Sinatra-based patient management service providing RESTful endpoints for healthcare data operations.

## Features

- **Health Monitoring**: Service status and health check endpoints
- **Patient Management**: RESTful API for patient data access
- **JSON API**: Clean JSON responses for all endpoints
- **Testing**: Complete RSpec test suite
- **Production Ready**: Configured for Heroku deployment with Puma

## API Endpoints

### Health Check
- `GET /` - Service health status
- `GET /api/health` - Detailed API health information

### Patient Management
- `GET /api/patients` - Get all patients
- `GET /api/patients/{id}` - Get specific patient by ID

## Local Development

### Prerequisites
- Ruby 3.0+
- Bundler gem manager

### Setup
```bash
# Install bundler (if not already installed)
gem install bundler

# Install dependencies
bundle install
```

### Running the Application
```bash
# Development mode
bundle exec ruby app.rb

# Production mode with Puma
bundle exec puma

# With auto-reloading for development
bundle exec rerun ruby app.rb
```

The application will be available at `http://localhost:4567`

### Testing
```bash
# Run all tests
bundle exec rspec

# Run with detailed output
bundle exec rspec spec/ --format documentation

# Run with coverage
COVERAGE=true bundle exec rspec
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4567` |
| `RACK_ENV` | Rack environment | `production` |

## Deployment

### Heroku
The application is configured for Heroku deployment with:
- `Procfile` - Process configuration
- `.ruby-version` - Ruby version specification
- `Gemfile` - Dependencies
- `config.ru` - Rack configuration

### CI/CD
Automated deployment via GitHub Actions:
- Tests run on Ruby 3.0, 3.1, 3.2
- Deploys to Heroku on successful tests
- Health checks ensure deployment success

## Project Structure

```
ruby-app/
├── app.rb              # Main Sinatra application
├── config.ru           # Rack configuration
├── Gemfile             # Ruby dependencies
├── Procfile            # Heroku process configuration
├── .ruby-version       # Ruby version specification
└── spec/
    ├── spec_helper.rb  # RSpec configuration
    └── app_spec.rb     # Application tests
```

## API Response Examples

### Health Check
```json
{
  "status": "healthy",
  "service": "WebQx Ruby Healthcare API",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

### Patient List
```json
{
  "patients": [
    {
      "id": "patient-001",
      "name": "Alice Johnson",
      "age": 42,
      "status": "active",
      "last_visit": "2024-01-18"
    }
  ],
  "count": 1
}
```

## Dependencies

### Production
- **sinatra** - Web framework
- **puma** - Web server
- **json** - JSON handling
- **dotenv** - Environment variable management

### Development & Test
- **rspec** - Testing framework
- **rack-test** - HTTP testing helpers
- **rerun** - Auto-reloading for development

## Security

- JSON-only responses
- Environment-based configuration
- Production-ready web server (Puma)
- Comprehensive error handling