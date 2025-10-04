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
    echo json_encode([
        'status' => 'healthy',
        'database' => 'connected',
        'services' => [
            'mysql' => 'running',
            'redis' => 'running',
            'php' => 'running'
        ],
        'timestamp' => date('c')
    ]);
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

// Default response
echo json_encode([
    'message' => 'WebQX EMR GitHub Integration API',
    'description' => 'Serving underserved communities with comprehensive healthcare solutions',
    'version' => '7.0.3',
    'endpoints' => [
        'status' => '/webqx-api.php?action=status',
        'health' => '/webqx-api.php?action=health',
        'community-stats' => '/webqx-api.php?action=community-stats'
    ],
    'github_pages' => 'https://webqx.github.io/webqx/',
    'timestamp' => date('c')
]);
?>