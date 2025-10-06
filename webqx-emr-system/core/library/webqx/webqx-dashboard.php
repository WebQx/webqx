<?php
/**
 * WebQX EMR Dashboard Integration
 * Custom dashboard for serving underserved communities
 */

require_once 'webqx-header.php';

class WebQXDashboard {
    private $db;
    private $user_id;
    
    public function __construct($database_connection, $user_id = null) {
        $this->db = $database_connection;
        $this->user_id = $user_id;
    }
    
    public function renderDashboard() {
        ?>
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Dashboard - WebQX EMR</title>
            <?php injectWebQXStyles(); ?>
        </head>
        <body>
            <?php renderWebQXHeader('Dashboard'); ?>
            
            <!-- Legacy Dashboard Banner -->
            <div style="background: #ffe4b5; border: 2px solid #ffa500; padding: 1rem 1.5rem; margin: 1rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <strong style="color: #d97706; font-size: 1.1rem;">⚠️ Legacy Dashboard Notice</strong>
                <p style="margin: 0.5rem 0 0 0; color: #92400e;">
                    This dashboard is deprecated and does not display live data. 
                    Please use the <a href="/portal/" style="color: #0066cc; text-decoration: underline;">Production Portal</a> for real-time metrics and full functionality.
                </p>
            </div>
            
            <div class="container-fluid" style="padding: 2rem;">
                <h1 style="color: var(--webqx-dark); margin-bottom: 2rem;">
                    📊 Healthcare Dashboard
                </h1>
                
                <!-- Quick Stats -->
                <div class="webqx-quick-stats">
                    <div class="webqx-stat-card">
                        <h3><?php echo $this->getPatientCount(); ?></h3>
                        <p>Total Patients</p>
                    </div>
                    <div class="webqx-stat-card">
                        <h3><?php echo $this->getTodayAppointments(); ?></h3>
                        <p>Today's Appointments</p>
                    </div>
                    <div class="webqx-stat-card">
                        <h3><?php echo $this->getPendingTasks(); ?></h3>
                        <p>Pending Tasks</p>
                    </div>
                    <div class="webqx-stat-card">
                        <h3><?php echo $this->getActiveProviders(); ?></h3>
                        <p>Active Providers</p>
                    </div>
                </div>
                
                <!-- Quick Actions -->
                <div class="row" style="margin-top: 2rem;">
                    <div class="col-md-6">
                        <div class="webqx-dashboard-card">
                            <h4 style="color: var(--webqx-primary); margin-bottom: 1rem;">
                                🏥 Quick Actions
                            </h4>
                            <div class="d-grid gap-2">
                                <button class="btn btn-primary" onclick="newPatient()">
                                    👤 New Patient Registration
                                </button>
                                <button class="btn btn-primary" onclick="newAppointment()">
                                    📅 Schedule Appointment
                                </button>
                                <button class="btn btn-primary" onclick="patientSearch()">
                                    🔍 Patient Search
                                </button>
                                <button class="btn btn-primary" onclick="emergencyProtocol()">
                                    🚨 Emergency Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-md-6">
                        <div class="webqx-dashboard-card">
                            <h4 style="color: var(--webqx-primary); margin-bottom: 1rem;">
                                📋 Recent Activity
                            </h4>
                            <div id="recent-activity">
                                <?php $this->renderRecentActivity(); ?>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Community Health Metrics -->
                <div class="row" style="margin-top: 2rem;">
                    <div class="col-12">
                        <div class="webqx-dashboard-card">
                            <h4 style="color: var(--webqx-primary); margin-bottom: 1rem;">
                                🌍 Community Health Impact
                            </h4>
                            <div class="row">
                                <div class="col-md-3 text-center">
                                    <div class="webqx-stat-number"><?php echo $this->getUnderservedPatients(); ?></div>
                                    <div class="webqx-stat-label">Underserved Patients Helped</div>
                                </div>
                                <div class="col-md-3 text-center">
                                    <div class="webqx-stat-number"><?php echo $this->getFreeServicesProvided(); ?></div>
                                    <div class="webqx-stat-label">Free Services Provided</div>
                                </div>
                                <div class="col-md-3 text-center">
                                    <div class="webqx-stat-number"><?php echo $this->getMobileClinicVisits(); ?></div>
                                    <div class="webqx-stat-label">Mobile Clinic Visits</div>
                                </div>
                                <div class="col-md-3 text-center">
                                    <div class="webqx-stat-number"><?php echo $this->getTelemedicineConsults(); ?></div>
                                    <div class="webqx-stat-label">Telemedicine Consults</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <?php renderWebQXFooter(); ?>
            
            <script>
                // Dashboard functionality
                function newPatient() {
                    window.open('/interface/new/new.php', '_blank');
                }
                
                function newAppointment() {
                    window.open('/interface/main/calendar/add_edit_event.php', '_blank');
                }
                
                function patientSearch() {
                    window.open('/interface/main/finder/patient_select.php', '_blank');
                }
                
                function emergencyProtocol() {
                    alert('🚨 Emergency Protocol Activated\n\nCall 911 for immediate emergencies.\nFor urgent care, contact on-call provider.');
                }
                
                // Auto-refresh dashboard every 5 minutes
                setInterval(function() {
                    document.getElementById('recent-activity').innerHTML = '<div class="webqx-loading"></div> Refreshing...';
                    // Reload recent activity via AJAX
                    fetch('/webqx-emr-system/includes/ajax-recent-activity.php')
                        .then(response => response.text())
                        .then(data => {
                            document.getElementById('recent-activity').innerHTML = data;
                        });
                }, 300000);
            </script>
        </body>
        </html>
        <?php
    }
    
    /**
     * Get patient count
     * @deprecated This method returns hardcoded demo data. Use the Production Portal API instead.
     * @return string Patient count or 'N/A'
     */
    private function getPatientCount() {
        // Mock data for now - replace with actual database queries
        // Production Portal uses /api/dashboard/provider for live data
        return "N/A";
    }
    
    /**
     * Get today's appointments count
     * @deprecated This method returns hardcoded demo data. Use the Production Portal API instead.
     * @return string Appointments count or 'N/A'
     */
    private function getTodayAppointments() {
        // Production Portal uses /api/dashboard/provider for live data
        return "N/A";
    }
    
    /**
     * Get pending tasks count
     * @deprecated This method returns hardcoded demo data. Use the Production Portal API instead.
     * @return string Tasks count or 'N/A'
     */
    private function getPendingTasks() {
        // Production Portal uses /api/dashboard/provider for live data
        return "N/A";
    }
    
    /**
     * Get active providers count
     * @deprecated This method returns hardcoded demo data. Use the Production Portal API instead.
     * @return string Providers count or 'N/A'
     */
    private function getActiveProviders() {
        // Production Portal uses /api/dashboard/provider for live data
        return "N/A";
    }
    
    /**
     * @deprecated Legacy method - not connected to real data
     */
    private function getUnderservedPatients() {
        return "N/A";
    }
    
    /**
     * @deprecated Legacy method - not connected to real data
     */
    private function getFreeServicesProvided() {
        return "N/A";
    }
    
    /**
     * @deprecated Legacy method - not connected to real data
     */
    private function getMobileClinicVisits() {
        return "N/A";
    }
    
    /**
     * @deprecated Legacy method - not connected to real data
     */
    private function getTelemedicineConsults() {
        return "N/A";
    }
    
    private function renderRecentActivity() {
        ?>
        <div class="activity-item" style="padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
            <strong>Patient check-in:</strong> Maria Rodriguez - 2:30 PM
        </div>
        <div class="activity-item" style="padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
            <strong>Lab results:</strong> Blood work completed for John Smith
        </div>
        <div class="activity-item" style="padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
            <strong>Prescription:</strong> Medication refill approved for Sarah Johnson
        </div>
        <div class="activity-item" style="padding: 0.5rem 0; border-bottom: 1px solid #e5e7eb;">
            <strong>Telemedicine:</strong> Virtual consultation scheduled
        </div>
        <div class="activity-item" style="padding: 0.5rem 0;">
            <strong>Mobile clinic:</strong> Equipment check completed
        </div>
        <?php
    }
}

// If accessed directly, render the dashboard
if (basename($_SERVER['PHP_SELF']) == 'webqx-dashboard.php') {
    session_start();
    
    // Mock database connection for demo
    $db = null;
    $user_id = isset($_SESSION['authUserID']) ? $_SESSION['authUserID'] : null;
    
    $dashboard = new WebQXDashboard($db, $user_id);
    $dashboard->renderDashboard();
}
?>