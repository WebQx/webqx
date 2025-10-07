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
            
            <!-- LEGACY DASHBOARD BANNER -->
            <div style="background: linear-gradient(135deg, #fbbf24, #f59e0b); padding: 1rem 2rem; border-bottom: 2px solid #d97706; margin: 0;">
                <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 1rem;">
                    <span style="font-size: 2rem;">⚠️</span>
                    <div>
                        <h3 style="margin: 0 0 0.25rem 0; color: #78350f; font-size: 1.1rem;">Legacy Dashboard (Static)</h3>
                        <p style="margin: 0; color: #92400e; font-size: 0.9rem;">
                            This is a legacy static dashboard. For live production data, please use the 
                            <a href="/portal" style="color: #78350f; font-weight: bold; text-decoration: underline;">Production Portal</a>
                            with real-time provider metrics.
                        </p>
                    </div>
                </div>
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
    
    private function getPatientCount() {
        // Mock data for now - replace with actual database queries
        return "1,247";
    }
    
    private function getTodayAppointments() {
        return "23";
    }
    
    private function getPendingTasks() {
        return "7";
    }
    
    private function getActiveProviders() {
        return "12";
    }
    
    private function getUnderservedPatients() {
        return "892";
    }
    
    private function getFreeServicesProvided() {
        return "2,341";
    }
    
    private function getMobileClinicVisits() {
        return "156";
    }
    
    private function getTelemedicineConsults() {
        return "89";
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