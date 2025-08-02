"""
WebQx Python Healthcare API
A simple Flask application for healthcare data management
"""

from flask import Flask, jsonify, request
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Sample healthcare data
patients = [
    {
        "id": "patient-001",
        "name": "John Doe",
        "age": 35,
        "status": "active",
        "last_visit": "2024-01-15"
    },
    {
        "id": "patient-002", 
        "name": "Jane Smith",
        "age": 28,
        "status": "active",
        "last_visit": "2024-01-20"
    }
]

@app.route('/')
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "WebQx Python Healthcare API",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    })

@app.route('/api/patients', methods=['GET'])
def get_patients():
    """Get all patients"""
    return jsonify({
        "patients": patients,
        "count": len(patients)
    })

@app.route('/api/patients/<patient_id>', methods=['GET'])
def get_patient(patient_id):
    """Get a specific patient by ID"""
    patient = next((p for p in patients if p["id"] == patient_id), None)
    if patient:
        return jsonify(patient)
    return jsonify({"error": "Patient not found"}), 404

@app.route('/api/health', methods=['GET'])
def api_health():
    """API health endpoint for monitoring"""
    return jsonify({
        "api_status": "operational",
        "database_status": "connected",
        "last_check": datetime.now().isoformat()
    })

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)