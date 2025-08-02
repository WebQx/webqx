# WebQx Ruby Healthcare API
# A simple Sinatra application for healthcare data management

require 'sinatra'
require 'json'
require 'time'
require 'dotenv/load'

# Sample healthcare data
PATIENTS = [
  {
    id: 'patient-001',
    name: 'Alice Johnson',
    age: 42,
    status: 'active',
    last_visit: '2024-01-18'
  },
  {
    id: 'patient-002',
    name: 'Bob Wilson',
    age: 38,
    status: 'active',
    last_visit: '2024-01-22'
  }
].freeze

# Health check endpoint
get '/' do
  content_type :json
  {
    status: 'healthy',
    service: 'WebQx Ruby Healthcare API',
    timestamp: Time.now.iso8601,
    version: '1.0.0'
  }.to_json
end

# Get all patients
get '/api/patients' do
  content_type :json
  {
    patients: PATIENTS,
    count: PATIENTS.length
  }.to_json
end

# Get a specific patient by ID
get '/api/patients/:id' do
  content_type :json
  patient_id = params[:id]
  patient = PATIENTS.find { |p| p[:id] == patient_id }
  
  if patient
    patient.to_json
  else
    status 404
    { error: 'Patient not found' }.to_json
  end
end

# API health endpoint for monitoring
get '/api/health' do
  content_type :json
  {
    api_status: 'operational',
    database_status: 'connected',
    last_check: Time.now.iso8601
  }.to_json
end

# Set port for Heroku
set :port, ENV['PORT'] || 4567
set :bind, '0.0.0.0'