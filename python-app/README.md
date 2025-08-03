# WebQx Python Healthcare API

A Flask-based healthcare data management API that provides RESTful endpoints for patient information management.

## Features

- **Health Check**: Service status and monitoring endpoint
- **Patient Management**: CRUD operations for patient data
- **JSON API**: RESTful endpoints with JSON responses
- **Testing**: Comprehensive test suite with pytest
- **Production Ready**: Configured for Heroku deployment

## API Endpoints

### Health Check
- `GET /` - Service health status
- `GET /api/health` - Detailed API health information

### Patient Management
- `GET /api/patients` - Get all patients
- `GET /api/patients/{id}` - Get specific patient by ID

## Local Development

### Prerequisites
- Python 3.9+
- pip (Python package manager)

### Setup
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Running the Application
```bash
# Development mode
python app.py

# Production mode with Gunicorn
gunicorn app:app
```

The application will be available at `http://localhost:5000`

### Testing
```bash
# Run all tests
pytest test_app.py

# Run with verbose output
pytest test_app.py -v

# Run with coverage
pip install pytest-cov
pytest test_app.py --cov=app
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `FLASK_ENV` | Flask environment | `production` |

## Deployment

### Heroku
The application is configured for Heroku deployment with:
- `Procfile` - Process configuration
- `runtime.txt` - Python version specification
- `requirements.txt` - Dependencies

### CI/CD
Automated deployment via GitHub Actions:
- Tests run on Python 3.9, 3.10, 3.11
- Deploys to Heroku on successful tests
- Health checks ensure deployment success

## API Response Examples

### Health Check
```json
{
  "status": "healthy",
  "service": "WebQx Python Healthcare API",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Patient List
```json
{
  "patients": [
    {
      "id": "patient-001",
      "name": "John Doe",
      "age": 35,
      "status": "active",
      "last_visit": "2024-01-15"
    }
  ],
  "count": 1
}
```

## Security

- Input validation on all endpoints
- JSON-only responses
- Environment-based configuration
- Production-ready WSGI server (Gunicorn)