<?php
/**
 * WebQX OpenEMR Integration Configuration
 * This file integrates WebQX branding and features into OpenEMR 7.0.3
 */

// Define WebQX constants
define('WEBQX_VERSION', '7.0.3');
define('WEBQX_BRAND_NAME', 'WebQX EMR');
define('WEBQX_BASE_URL', 'https://webqx.github.io/webqx/');
define('WEBQX_THEME_PATH', dirname(__FILE__) . '/../themes/');
define('WEBQX_INCLUDES_PATH', dirname(__FILE__) . '/');

// WebQX Global Configuration
$GLOBALS['webqx_config'] = array(
    'branding' => array(
        'enabled' => true,
        'name' => WEBQX_BRAND_NAME,
        'logo' => '🏥',
        'tagline' => 'Serving underserved communities with comprehensive healthcare solutions',
        'colors' => array(
            'primary' => '#0891b2',
            'secondary' => '#164e63',
            'accent' => '#00ffd5',
            'success' => '#10b981',
            'warning' => '#f59e0b',
            'danger' => '#ef4444'
        )
    ),
    'features' => array(
        'community_health_tracking' => true,
        'mobile_clinic_support' => true,
        'telemedicine_integration' => true,
        'multilingual_support' => true,
        'offline_capability' => true
    ),
    'github_integration' => array(
        'enabled' => true,
        'base_url' => WEBQX_BASE_URL,
        'api_endpoint' => 'http://localhost:8080/api/',
        'status_endpoint' => 'server-status'
    )
);

/**
 * Initialize WebQX integration with OpenEMR
 */
function initWebQXIntegration() {
    global $GLOBALS;
    
    // Override OpenEMR globals with WebQX settings
    $GLOBALS['openemr_name'] = WEBQX_BRAND_NAME;
    
    // Custom login page redirect
    if (strpos($_SERVER['REQUEST_URI'], '/interface/login/login.php') !== false) {
        webqx_redirect_login();
    }
    
    // Inject WebQX styles and scripts
    add_action('wp_head', 'webqx_inject_assets');
    
    // Custom dashboard override
    if (strpos($_SERVER['REQUEST_URI'], '/interface/main/main.php') !== false) {
        webqx_override_dashboard();
    }
}

/**
 * Redirect to WebQX custom login page
 */
function webqx_redirect_login() {
    $webqx_login = WEBQX_INCLUDES_PATH . '../templates/webqx-login.html';
    if (file_exists($webqx_login)) {
        include $webqx_login;
        exit;
    }
}

/**
 * Override default dashboard with WebQX dashboard
 */
function webqx_override_dashboard() {
    $webqx_dashboard = WEBQX_INCLUDES_PATH . 'webqx-dashboard.php';
    if (file_exists($webqx_dashboard)) {
        include $webqx_dashboard;
        exit;
    }
}

/**
 * Inject WebQX assets into HTML head
 */
function webqx_inject_assets() {
    ?>
    <!-- WebQX EMR Branding -->
    <link rel="stylesheet" href="<?php echo WEBQX_THEME_PATH; ?>webqx-modern.css">
    <meta name="description" content="WebQX EMR - Serving underserved communities with comprehensive healthcare solutions">
    <meta name="keywords" content="WebQX, EMR, healthcare, underserved communities, telemedicine">
    
    <script>
        // WebQX Global JavaScript Configuration
        window.WebQX = {
            version: '<?php echo WEBQX_VERSION; ?>',
            brandName: '<?php echo WEBQX_BRAND_NAME; ?>',
            baseUrl: '<?php echo WEBQX_BASE_URL; ?>',
            apiEndpoint: '<?php echo $GLOBALS['webqx_config']['github_integration']['api_endpoint']; ?>',
            features: <?php echo json_encode($GLOBALS['webqx_config']['features']); ?>
        };
        
        // Initialize WebQX
        document.addEventListener('DOMContentLoaded', function() {
            webqxInit();
        });
        
        function webqxInit() {
            // Add WebQX branding to page
            webqxBrandPage();
            
            // Setup GitHub Pages integration
            webqxSetupGitHubIntegration();
            
            // Initialize community health features
            webqxInitCommunityFeatures();
        }
        
        function webqxBrandPage() {
            // Update page title
            if (document.title.indexOf('WebQX') === -1) {
                document.title = document.title.replace('OpenEMR', 'WebQX EMR');
            }
            
            // Add WebQX header if not present
            if (!document.querySelector('.webqx-header')) {
                webqxInjectHeader();
            }
        }
        
        function webqxInjectHeader() {
            const header = document.createElement('div');
            header.className = 'webqx-header';
            header.innerHTML = `
                <div class="container-fluid">
                    <div class="webqx-logo">
                        🏥 ${window.WebQX.brandName}
                    </div>
                    <div class="webqx-tagline">
                        Serving underserved communities with comprehensive healthcare solutions
                    </div>
                </div>
            `;
            
            document.body.insertBefore(header, document.body.firstChild);
        }
        
        function webqxSetupGitHubIntegration() {
            // Setup communication with GitHub Pages
            if (window.WebQX.features.github_integration) {
                setInterval(webqxSyncWithGitHub, 30000); // Sync every 30 seconds
            }
        }
        
        function webqxSyncWithGitHub() {
            fetch(window.WebQX.apiEndpoint + 'server-status')
                .then(response => response.json())
                .then(data => {
                    console.log('WebQX Status:', data);
                    // Update status indicators
                })
                .catch(error => {
                    console.log('GitHub Pages sync offline');
                });
        }
        
        function webqxInitCommunityFeatures() {
            // Initialize community health tracking
            if (window.WebQX.features.community_health_tracking) {
                console.log('Community health tracking enabled');
            }
            
            // Initialize mobile clinic support
            if (window.WebQX.features.mobile_clinic_support) {
                console.log('Mobile clinic support enabled');
            }
            
            // Initialize telemedicine
            if (window.WebQX.features.telemedicine_integration) {
                console.log('Telemedicine integration enabled');
            }
        }
    </script>
    
    <style>
        /* Ensure WebQX branding takes precedence */
        body {
            --webqx-primary: <?php echo $GLOBALS['webqx_config']['branding']['colors']['primary']; ?>;
            --webqx-secondary: <?php echo $GLOBALS['webqx_config']['branding']['colors']['secondary']; ?>;
            --webqx-accent: <?php echo $GLOBALS['webqx_config']['branding']['colors']['accent']; ?>;
        }
        
        /* Hide OpenEMR branding */
        .navbar-brand img,
        .navbar-brand span {
            display: none !important;
        }
        
        /* Override with WebQX branding */
        .navbar-brand::before {
            content: "🏥 WebQX EMR";
            color: white;
            font-weight: bold;
        }
    </style>
    <?php
}

/**
 * WebQX Authentication Integration
 */
function webqx_auth_integration() {
    // Custom authentication logic for WebQX
    if (isset($_POST['authUser']) && isset($_POST['clearPass'])) {
        // Process WebQX authentication
        $username = $_POST['authUser'];
        $password = $_POST['clearPass'];
        
        // Log authentication attempt
        error_log("WebQX Auth attempt for user: $username");
        
        // Continue with OpenEMR authentication
        return true;
    }
    
    return false;
}

/**
 * Create WebQX database tables if needed
 */
function webqx_create_tables() {
    global $sqlconf;
    
    $connection = mysqli_connect($sqlconf['host'], $sqlconf['login'], $sqlconf['pass'], $sqlconf['dbase']);
    
    if ($connection) {
        // Community health tracking table
        $sql = "CREATE TABLE IF NOT EXISTS webqx_community_health (
            id INT AUTO_INCREMENT PRIMARY KEY,
            patient_id INT,
            service_type VARCHAR(100),
            is_underserved BOOLEAN DEFAULT FALSE,
            is_free_service BOOLEAN DEFAULT FALSE,
            visit_date DATETIME,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )";
        mysqli_query($connection, $sql);
        
        // Mobile clinic tracking
        $sql = "CREATE TABLE IF NOT EXISTS webqx_mobile_clinic (
            id INT AUTO_INCREMENT PRIMARY KEY,
            location VARCHAR(255),
            visit_date DATE,
            patients_served INT DEFAULT 0,
            services_provided TEXT,
            equipment_status TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )";
        mysqli_query($connection, $sql);
        
        mysqli_close($connection);
    }
}

// Initialize WebQX when this file is included
if (!defined('WEBQX_INITIALIZED')) {
    define('WEBQX_INITIALIZED', true);
    
    // Initialize WebQX integration
    initWebQXIntegration();
    
    // Create custom tables
    webqx_create_tables();
    
    // Include WebQX header functions
    require_once WEBQX_INCLUDES_PATH . 'webqx-header.php';
}
?>