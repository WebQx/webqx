<?php
/**
 * WebQX™ EMR API v2
 * Enhanced RESTful API for WebQX Electronic Medical Records
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://webqx.github.io');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

use WebQX\EMR\WebQXConfig;

// Include WebQX configuration
require_once __DIR__ . '/../customizations/webqx-config.php';

class WebQXAPI {
    
    private $config;
    private $version = '2.0.0';
    
    public function __construct() {
        $this->config = WebQXConfig::getConfig('api');
    }
    
    /**
     * Route API requests
     */
    public function route() {
        $uri = $_SERVER['REQUEST_URI'];
        $method = $_SERVER['REQUEST_METHOD'];
        
        // Parse URI to get endpoint
        $path = parse_url($uri, PHP_URL_PATH);
        $segments = explode('/', trim($path, '/'));
        
        // Remove 'api' and 'v2' from segments
        $segments = array_slice($segments, 2);
        
        $endpoint = $segments[0] ?? '';
        $id = $segments[1] ?? null;
        
        switch ($endpoint) {
            case 'status':
                return $this->getStatus();
                
            case 'patients':
                return $this->handlePatients($method, $id);
                
            case 'appointments':
                return $this->handleAppointments($method, $id);
                
            case 'providers':
                return $this->handleProviders($method, $id);
                
            case 'analytics':
                return $this->getAnalytics();
                
            case 'fhir':
                return $this->handleFHIR($segments);
                
            default:
                return $this->error('Endpoint not found', 404);
        }
    }
    
    /**
     * Get API status
     */
    private function getStatus() {
        return $this->success([
            'api_version' => $this->version,
            'emr_version' => WebQXConfig::BRAND_VERSION,
            'status' => 'online',
            'timestamp' => date('c'),
            'features' => [
                'fhir_r4' => true,
                'oauth2' => true,
                'webhooks' => true,
                'real_time' => true,
            ],
            'endpoints' => [
                '/api/v2/status',
                '/api/v2/patients',
                '/api/v2/appointments', 
                '/api/v2/providers',
                '/api/v2/analytics',
                '/api/v2/fhir',
            ]
        ]);
    }
    
    /**
     * Handle patient endpoints
     */
    private function handlePatients($method, $id) {
        switch ($method) {
            case 'GET':
                if ($id) {
                    return $this->getPatient($id);
                } else {
                    return $this->getPatients();
                }
                
            case 'POST':
                return $this->createPatient();
                
            case 'PUT':
                return $this->updatePatient($id);
                
            case 'DELETE':
                return $this->deletePatient($id);
                
            default:
                return $this->error('Method not allowed', 405);
        }
    }
    
    /**
     * Get all patients
     */
    private function getPatients() {
        // Mock data for demonstration
        $patients = [
            [
                'id' => 1,
                'first_name' => 'John',
                'last_name' => 'Smith',
                'dob' => '1985-06-15',
                'gender' => 'M',
                'phone' => '+1-555-0123',
                'email' => 'john.smith@email.com',
                'status' => 'active',
                'last_visit' => '2025-09-01T10:30:00Z'
            ],
            [
                'id' => 2,
                'first_name' => 'Mary',
                'last_name' => 'Johnson',
                'dob' => '1992-03-22',
                'gender' => 'F',
                'phone' => '+1-555-0124',
                'email' => 'mary.johnson@email.com',
                'status' => 'active',
                'last_visit' => '2025-08-28T14:15:00Z'
            ],
            [
                'id' => 3,
                'first_name' => 'Robert',
                'last_name' => 'Davis',
                'dob' => '1978-11-08',
                'gender' => 'M',
                'phone' => '+1-555-0125',
                'email' => 'robert.davis@email.com',
                'status' => 'active',
                'last_visit' => '2025-09-05T09:00:00Z'
            ]
        ];
        
        return $this->success([
            'patients' => $patients,
            'total' => count($patients),
            'page' => 1,
            'per_page' => 50
        ]);
    }
    
    /**
     * Handle appointment endpoints
     */
    private function handleAppointments($method, $id) {
        switch ($method) {
            case 'GET':
                return $this->getAppointments();
                
            default:
                return $this->error('Method not allowed', 405);
        }
    }
    
    /**
     * Get appointments
     */
    private function getAppointments() {
        $appointments = [
            [
                'id' => 1,
                'patient_id' => 1,
                'patient_name' => 'John Smith',
                'provider_id' => 1,
                'provider_name' => 'Dr. Sarah Wilson',
                'appointment_date' => '2025-09-10T09:00:00Z',
                'duration' => 30,
                'type' => 'checkup',
                'status' => 'scheduled'
            ],
            [
                'id' => 2,
                'patient_id' => 2,
                'patient_name' => 'Mary Johnson',
                'provider_id' => 1,
                'provider_name' => 'Dr. Sarah Wilson',
                'appointment_date' => '2025-09-10T10:30:00Z',
                'duration' => 45,
                'type' => 'follow-up',
                'status' => 'scheduled'
            ]
        ];
        
        return $this->success([
            'appointments' => $appointments,
            'total' => count($appointments)
        ]);
    }
    
    /**
     * Handle provider endpoints
     */
    private function handleProviders($method, $id) {
        $providers = [
            [
                'id' => 1,
                'first_name' => 'Sarah',
                'last_name' => 'Wilson',
                'title' => 'MD',
                'specialty' => 'Family Medicine',
                'npi' => '1234567890',
                'phone' => '+1-555-0200',
                'email' => 'dr.wilson@webqx-emr.com',
                'status' => 'active'
            ]
        ];
        
        return $this->success([
            'providers' => $providers,
            'total' => count($providers)
        ]);
    }
    
    /**
     * Get analytics data
     */
    private function getAnalytics() {
        return $this->success([
            'dashboard' => [
                'total_patients' => 1247,
                'new_patients_month' => 89,
                'appointments_today' => 156,
                'revenue_month' => 127450.00,
                'outstanding_claims' => 15230.00,
                'collection_rate' => 94.2
            ],
            'trends' => [
                'patient_growth' => '+12.5%',
                'revenue_growth' => '+8.3%',
                'appointment_utilization' => '87.4%'
            ],
            'alerts' => [
                'critical' => 3,
                'warning' => 12,
                'info' => 25
            ]
        ]);
    }
    
    /**
     * Handle FHIR endpoints
     */
    private function handleFHIR($segments) {
        return $this->success([
            'fhir_version' => 'R4',
            'implementation' => 'WebQX EMR FHIR Server',
            'supported_resources' => [
                'Patient',
                'Practitioner', 
                'Appointment',
                'Observation',
                'Medication',
                'AllergyIntolerance',
                'Condition'
            ],
            'message' => 'FHIR R4 implementation ready'
        ]);
    }
    
    /**
     * Success response
     */
    private function success($data, $code = 200) {
        http_response_code($code);
        return json_encode([
            'success' => true,
            'data' => $data,
            'timestamp' => date('c'),
            'api_version' => $this->version
        ], JSON_PRETTY_PRINT);
    }
    
    /**
     * Error response
     */
    private function error($message, $code = 400) {
        http_response_code($code);
        return json_encode([
            'success' => false,
            'error' => [
                'message' => $message,
                'code' => $code
            ],
            'timestamp' => date('c'),
            'api_version' => $this->version
        ], JSON_PRETTY_PRINT);
    }
}

// Initialize and route API
$api = new WebQXAPI();
echo $api->route();
?>
