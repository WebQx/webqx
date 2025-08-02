"""
Tests for WebQx Python Healthcare API
"""

import pytest
import json
from app import app

@pytest.fixture
def client():
    """Create a test client"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def test_health_check(client):
    """Test the health check endpoint"""
    response = client.get('/')
    assert response.status_code == 200
    
    data = json.loads(response.data)
    assert data['status'] == 'healthy'
    assert 'WebQx Python Healthcare API' in data['service']
    assert 'timestamp' in data
    assert data['version'] == '1.0.0'

def test_get_patients(client):
    """Test getting all patients"""
    response = client.get('/api/patients')
    assert response.status_code == 200
    
    data = json.loads(response.data)
    assert 'patients' in data
    assert 'count' in data
    assert data['count'] == 2
    assert len(data['patients']) == 2

def test_get_patient_by_id(client):
    """Test getting a specific patient"""
    response = client.get('/api/patients/patient-001')
    assert response.status_code == 200
    
    data = json.loads(response.data)
    assert data['id'] == 'patient-001'
    assert data['name'] == 'John Doe'
    assert data['age'] == 35

def test_get_nonexistent_patient(client):
    """Test getting a patient that doesn't exist"""
    response = client.get('/api/patients/nonexistent')
    assert response.status_code == 404
    
    data = json.loads(response.data)
    assert 'error' in data
    assert data['error'] == 'Patient not found'

def test_api_health(client):
    """Test the API health endpoint"""
    response = client.get('/api/health')
    assert response.status_code == 200
    
    data = json.loads(response.data)
    assert data['api_status'] == 'operational'
    assert data['database_status'] == 'connected'
    assert 'last_check' in data