<?php
/**
 * WebQX EMR Header Component
 * Custom branding and navigation for OpenEMR
 */

// WebQX Configuration
$webqx_config = array(
    'brand_name' => 'WebQX EMR',
    'tagline' => 'Serving underserved communities with comprehensive healthcare solutions',
    'version' => '7.0.3',
    'support_url' => 'https://webqx.github.io/EMR/',
    'colors' => array(
        'primary' => '#0891b2',
        'secondary' => '#164e63',
        'accent' => '#00ffd5'
    )
);

function renderWebQXHeader($page_title = 'WebQX EMR') {
    global $webqx_config;
    ?>
    <div class="webqx-header">
        <div class="container-fluid">
            <div class="row align-items-center">
                <div class="col-md-6">
                    <div class="webqx-logo">
                        🏥 <?php echo $webqx_config['brand_name']; ?>
                    </div>
                    <div class="webqx-tagline">
                        <?php echo $webqx_config['tagline']; ?>
                    </div>
                </div>
                <div class="col-md-6 text-end">
                    <div class="webqx-user-info">
                        <?php if (isset($_SESSION['authUser'])): ?>
                            <span class="user-welcome">
                                Welcome, <strong><?php echo htmlspecialchars($_SESSION['authUser']); ?></strong>
                            </span>
                            <div class="user-actions">
                                <a href="#" class="webqx-nav-link" onclick="openProfile()">Profile</a>
                                <a href="#" class="webqx-nav-link" onclick="openSettings()">Settings</a>
                                <a href="<?php echo $GLOBALS['webroot']; ?>/interface/logout.php" class="webqx-nav-link">Logout</a>
                            </div>
                        <?php endif; ?>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <style>
        .webqx-user-info {
            color: white;
            font-size: 0.9rem;
        }
        
        .user-welcome {
            display: block;
            margin-bottom: 0.25rem;
        }
        
        .user-actions {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
        }
        
        .webqx-nav-link {
            color: rgba(255, 255, 255, 0.9);
            text-decoration: none;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            transition: all 0.2s ease;
        }
        
        .webqx-nav-link:hover {
            background: rgba(255, 255, 255, 0.1);
            color: white;
            text-decoration: none;
        }
        
        @media (max-width: 768px) {
            .user-actions {
                flex-direction: column;
                gap: 0.5rem;
            }
        }
    </style>
    
    <script>
        function openProfile() {
            // Open user profile management
            window.open('<?php echo $GLOBALS['webroot']; ?>/interface/usergroup/usergroup_admin.php', '_blank');
        }
        
        function openSettings() {
            // Open system settings
            window.open('<?php echo $GLOBALS['webroot']; ?>/interface/super/edit_globals.php', '_blank');
        }
        
        // Add WebQX branding to page title
        document.title = '<?php echo $page_title; ?> - WebQX EMR';
    </script>
    <?php
}

function renderWebQXFooter() {
    global $webqx_config;
    ?>
    <div class="webqx-footer">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-6">
                    <p>&copy; <?php echo date('Y'); ?> WebQX EMR. Powered by OpenEMR <?php echo $webqx_config['version']; ?></p>
                </div>
                <div class="col-md-6 text-end">
                    <p>
                        <a href="<?php echo $webqx_config['support_url']; ?>" target="_blank" style="color: #00ffd5;">
                            Support & Documentation
                        </a>
                    </p>
                </div>
            </div>
        </div>
    </div>
    <?php
}

function injectWebQXStyles() {
    ?>
    <link rel="stylesheet" href="<?php echo $GLOBALS['webroot']; ?>/../themes/webqx-modern.css">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        /* Ensure WebQX styles take precedence */
        body {
            background: var(--webqx-light) !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        }
        
        /* Hide default OpenEMR header if exists */
        .navbar-header .navbar-brand {
            display: none !important;
        }
        
        /* WebQX Dashboard Enhancements */
        .webqx-quick-stats {
            display: flex;
            gap: 1rem;
            margin: 2rem 0;
            flex-wrap: wrap;
        }
        
        .webqx-stat-card {
            flex: 1;
            min-width: 200px;
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            border-left: 4px solid var(--webqx-primary);
        }
        
        .webqx-stat-card h3 {
            margin: 0;
            font-size: 2rem;
            color: var(--webqx-primary);
            font-weight: bold;
        }
        
        .webqx-stat-card p {
            margin: 0.5rem 0 0 0;
            color: var(--webqx-dark);
            font-size: 0.9rem;
        }
    </style>
    <?php
}

// Auto-inject WebQX branding into OpenEMR pages
function initWebQXBranding() {
    // Add to HTML head
    add_action('html_head', 'injectWebQXStyles');
    
    // Replace default navigation
    if (function_exists('add_filter')) {
        add_filter('navbar_brand', function() {
            return 'WebQX EMR';
        });
    }
}

// Initialize WebQX branding
if (!defined('WEBQX_INIT')) {
    define('WEBQX_INIT', true);
    initWebQXBranding();
}
?>