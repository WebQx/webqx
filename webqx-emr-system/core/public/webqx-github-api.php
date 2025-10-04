<?php
/**
 * WebQX GitHub Pages Integration Endpoint
 * Handles communication between OpenEMR and GitHub Pages
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://webqx.github.io');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Simple status endpoint
if (isset($_GET['action']) && $_GET['action'] === 'status') {
    echo json_encode([
        'status' => 'online',
        'service' => 'WebQX EMR',
        'version' => '7.0.3',
        'timestamp' => date('c'),
        'uptime' => shell_exec('uptime -p') ?: 'unknown',
        'memory_usage' => memory_get_usage(true),
        'features' => [
            'community_health_tracking' => true,
            'mobile_clinic_support' => true,
            'telemedicine_integration' => true,
            'github_integration' => true
        ]
    ]);
    exit;
}

// Health check endpoint
if (isset($_GET['action']) && $_GET['action'] === 'health') {
    $health_status = [
        'status' => 'healthy',
        'database' => 'unknown',
        'services' => [
            'mysql' => 'unknown',
            'redis' => 'unknown',
            'php' => 'running'
        ],
        'timestamp' => date('c')
    ];
    
    // Check database connectivity
    try {
        $db_host = 'localhost';
        $db_port = 3306;
        $db_name = 'webqx_emr';
        $db_user = 'webqx_user';
        $db_pass = 'webqx_pass_2024!';
        
        $pdo = new PDO("mysql:host=$db_host;port=$db_port;dbname=$db_name", $db_user, $db_pass);
        $health_status['database'] = 'connected';
        $health_status['services']['mysql'] = 'running';
    } catch (PDOException $e) {
        $health_status['database'] = 'error';
        $health_status['services']['mysql'] = 'error';
    }
    
    echo json_encode($health_status);
    exit;
}

// Community stats endpoint
if (isset($_GET['action']) && $_GET['action'] === 'community-stats') {
    echo json_encode([
        'underserved_patients' => 892,
        'free_services_provided' => 2341,
        'mobile_clinic_visits' => 156,
        'telemedicine_consults' => 89,
        'last_updated' => date('c')
    ]);
    exit;
}

// GitHub Pages sync endpoint
if (isset($_GET['action']) && $_GET['action'] === 'sync') {
    echo json_encode([
        'message' => 'Sync request received',
        'github_pages_url' => 'https://webqx.github.io/webqx/',
        'local_emr_url' => 'http://localhost:8085',
        'api_endpoints' => [
            'status' => '/public/webqx-github-api.php?action=status',
            'health' => '/public/webqx-github-api.php?action=health',
            'community-stats' => '/public/webqx-github-api.php?action=community-stats'
        ],
        'timestamp' => date('c')
    ]);
    exit;
}

// Default response
echo json_encode([
    'message' => 'WebQX EMR GitHub Integration API',
    'description' => 'Serving underserved communities with comprehensive healthcare solutions',
    'version' => '7.0.3',
    'endpoints' => [
        'status' => '/public/webqx-github-api.php?action=status',
        'health' => '/public/webqx-github-api.php?action=health',
        'community-stats' => '/public/webqx-github-api.php?action=community-stats',
        'sync' => '/public/webqx-github-api.php?action=sync'
    ],
    'github_pages' => 'https://webqx.github.io/webqx/',
    'timestamp' => date('c')
]);
?>
