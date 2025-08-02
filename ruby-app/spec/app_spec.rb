require 'spec_helper'
require_relative '../app'

RSpec.describe 'WebQx Ruby Healthcare API' do
  include Rack::Test::Methods

  def app
    Sinatra::Application
  end

  describe 'GET /' do
    it 'returns health check information' do
      get '/'
      
      expect(last_response).to be_ok
      
      data = JSON.parse(last_response.body)
      expect(data['status']).to eq('healthy')
      expect(data['service']).to include('WebQx Ruby Healthcare API')
      expect(data).to have_key('timestamp')
      expect(data['version']).to eq('1.0.0')
    end
  end

  describe 'GET /api/patients' do
    it 'returns all patients' do
      get '/api/patients'
      
      expect(last_response).to be_ok
      
      data = JSON.parse(last_response.body)
      expect(data).to have_key('patients')
      expect(data).to have_key('count')
      expect(data['count']).to eq(2)
      expect(data['patients'].length).to eq(2)
    end
  end

  describe 'GET /api/patients/:id' do
    it 'returns a specific patient' do
      get '/api/patients/patient-001'
      
      expect(last_response).to be_ok
      
      data = JSON.parse(last_response.body)
      expect(data['id']).to eq('patient-001')
      expect(data['name']).to eq('Alice Johnson')
      expect(data['age']).to eq(42)
    end

    it 'returns 404 for nonexistent patient' do
      get '/api/patients/nonexistent'
      
      expect(last_response.status).to eq(404)
      
      data = JSON.parse(last_response.body)
      expect(data).to have_key('error')
      expect(data['error']).to eq('Patient not found')
    end
  end

  describe 'GET /api/health' do
    it 'returns API health status' do
      get '/api/health'
      
      expect(last_response).to be_ok
      
      data = JSON.parse(last_response.body)
      expect(data['api_status']).to eq('operational')
      expect(data['database_status']).to eq('connected')
      expect(data).to have_key('last_check')
    end
  end
end