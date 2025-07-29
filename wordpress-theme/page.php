<?php
/**
 * The template for displaying all pages
 *
 * @package WebQX_Healthcare_Platform
 * @since 1.0.0
 */

get_header(); ?>

<div class="container">
    <main id="main" class="site-main">

        <?php
        while (have_posts()) :
            the_post();
            ?>

            <article id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
                <header class="entry-header">
                    <?php the_title('<h1 class="entry-title">', '</h1>'); ?>
                    
                    <?php if (has_post_thumbnail()) : ?>
                        <div class="entry-featured-image">
                            <?php the_post_thumbnail('large'); ?>
                        </div>
                    <?php endif; ?>
                </header><!-- .entry-header -->

                <div class="entry-content">
                    <?php
                    the_content();

                    wp_link_pages(array(
                        'before' => '<div class="page-links">' . __('Pages:', 'webqx'),
                        'after'  => '</div>',
                    ));
                    ?>
                    
                    <?php
                    // Add WebQX-specific content based on page slug
                    $page_slug = get_post_field('post_name', get_post());
                    
                    switch ($page_slug) {
                        case 'patient-portal':
                            webqx_display_patient_portal_content();
                            break;
                        case 'provider-panel':
                            webqx_display_provider_panel_content();
                            break;
                        case 'specialties':
                            webqx_display_specialties_overview();
                            break;
                        case 'fhir-integration':
                            webqx_display_fhir_info();
                            break;
                    }
                    ?>
                </div><!-- .entry-content -->

                <?php if (get_edit_post_link()) : ?>
                    <footer class="entry-footer">
                        <?php
                        edit_post_link(
                            sprintf(
                                wp_kses(
                                    __('Edit <span class="screen-reader-text">%s</span>', 'webqx'),
                                    array(
                                        'span' => array(
                                            'class' => array(),
                                        ),
                                    )
                                ),
                                get_the_title()
                            ),
                            '<span class="edit-link">',
                            '</span>'
                        );
                        ?>
                    </footer><!-- .entry-footer -->
                <?php endif; ?>
            </article><!-- #post-<?php the_ID(); ?> -->

            <?php
            // If comments are open or we have at least one comment, load up the comment template.
            if (comments_open() || get_comments_number()) :
                comments_template();
            endif;

        endwhile; // End of the loop.
        ?>

    </main><!-- #main -->
</div><!-- .container -->

<?php
get_sidebar();
get_footer();

/**
 * Display patient portal specific content
 */
function webqx_display_patient_portal_content() {
    ?>
    <div class="webqx-patient-portal-features">
        <h2><?php _e('Patient Portal Features', 'webqx'); ?></h2>
        
        <div class="features-grid">
            <div class="feature-card">
                <h3><?php _e('Appointments & Scheduling', 'webqx'); ?></h3>
                <p><?php _e('Schedule, view, and manage your medical appointments with healthcare providers.', 'webqx'); ?></p>
                <?php echo do_shortcode('[webqx_appointment_booking]'); ?>
            </div>
            
            <div class="feature-card">
                <h3><?php _e('Medical Records', 'webqx'); ?></h3>
                <p><?php _e('Access your complete medical history, test results, and treatment plans.', 'webqx'); ?></p>
                <?php echo do_shortcode('[webqx_medical_records]'); ?>
            </div>
            
            <div class="feature-card">
                <h3><?php _e('Secure Messaging', 'webqx'); ?></h3>
                <p><?php _e('Communicate securely with your healthcare team and get answers to your questions.', 'webqx'); ?></p>
                <?php echo do_shortcode('[webqx_secure_messaging]'); ?>
            </div>
            
            <div class="feature-card">
                <h3><?php _e('Prescription Management', 'webqx'); ?></h3>
                <p><?php _e('View current prescriptions, request refills, and find nearby pharmacies.', 'webqx'); ?></p>
                <?php echo do_shortcode('[webqx_prescriptions]'); ?>
            </div>
        </div>
    </div>
    <?php
}

/**
 * Display provider panel specific content
 */
function webqx_display_provider_panel_content() {
    ?>
    <div class="webqx-provider-panel-features">
        <h2><?php _e('Provider Panel Features', 'webqx'); ?></h2>
        
        <div class="features-grid">
            <div class="feature-card">
                <h3><?php _e('EHR Integration', 'webqx'); ?></h3>
                <p><?php _e('Seamless integration with popular EHR systems including OpenEMR, OpenMRS, and more.', 'webqx'); ?></p>
                <?php echo do_shortcode('[webqx_ehr_dashboard]'); ?>
            </div>
            
            <div class="feature-card">
                <h3><?php _e('Clinical Decision Support', 'webqx'); ?></h3>
                <p><?php _e('AI-powered clinical alerts and decision support tools to enhance patient care.', 'webqx'); ?></p>
                <?php echo do_shortcode('[webqx_clinical_alerts]'); ?>
            </div>
            
            <div class="feature-card">
                <h3><?php _e('Voice Transcription', 'webqx'); ?></h3>
                <p><?php _e('Advanced voice-to-text transcription for clinical documentation and notes.', 'webqx'); ?></p>
                <?php echo do_shortcode('[webqx_voice_transcription]'); ?>
            </div>
            
            <div class="feature-card">
                <h3><?php _e('PACS Integration', 'webqx'); ?></h3>
                <p><?php _e('Integrated medical imaging with PACS systems for radiology and diagnostic imaging.', 'webqx'); ?></p>
                <?php echo do_shortcode('[webqx_pacs_viewer]'); ?>
            </div>
        </div>
    </div>
    <?php
}

/**
 * Display specialties overview
 */
function webqx_display_specialties_overview() {
    ?>
    <div class="webqx-specialties-overview">
        <h2><?php _e('Supported Medical Specialties', 'webqx'); ?></h2>
        <p><?php _e('WebQX supports comprehensive workflows across multiple medical specialties, each with tailored features and compliance requirements.', 'webqx'); ?></p>
        
        <?php webqx_display_specialty_cards(); ?>
        
        <div class="specialty-features">
            <h3><?php _e('Specialty-Specific Features', 'webqx'); ?></h3>
            <ul>
                <li><?php _e('Specialty-aware clinical documentation templates', 'webqx'); ?></li>
                <li><?php _e('Customized workflow automation for each specialty', 'webqx'); ?></li>
                <li><?php _e('Specialty-specific compliance and reporting tools', 'webqx'); ?></li>
                <li><?php _e('Integrated specialty-focused decision support', 'webqx'); ?></li>
                <li><?php _e('Multilingual support for global healthcare delivery', 'webqx'); ?></li>
            </ul>
        </div>
    </div>
    <?php
}

/**
 * Display FHIR integration information
 */
function webqx_display_fhir_info() {
    ?>
    <div class="webqx-fhir-integration">
        <h2><?php _e('FHIR R4 Integration', 'webqx'); ?></h2>
        
        <div class="fhir-status">
            <h3><?php _e('Current FHIR Status', 'webqx'); ?></h3>
            <div class="status-indicators">
                <div class="status-item">
                    <span class="status-label"><?php _e('FHIR R4 Compliance:', 'webqx'); ?></span>
                    <span class="status-value status-active"><?php _e('Active', 'webqx'); ?></span>
                </div>
                <div class="status-item">
                    <span class="status-label"><?php _e('HL7 Integration:', 'webqx'); ?></span>
                    <span class="status-value status-active"><?php _e('Enabled', 'webqx'); ?></span>
                </div>
                <div class="status-item">
                    <span class="status-label"><?php _e('API Endpoint:', 'webqx'); ?></span>
                    <span class="status-value"><?php echo esc_html(get_webqx_api_base_url() . '/fhir'); ?></span>
                </div>
            </div>
        </div>
        
        <div class="fhir-resources">
            <h3><?php _e('Supported FHIR Resources', 'webqx'); ?></h3>
            <div class="resources-grid">
                <div class="resource-item">Patient</div>
                <div class="resource-item">Observation</div>
                <div class="resource-item">Appointment</div>
                <div class="resource-item">Practitioner</div>
                <div class="resource-item">Organization</div>
                <div class="resource-item">Medication</div>
                <div class="resource-item">DiagnosticReport</div>
                <div class="resource-item">ImagingStudy</div>
            </div>
        </div>
        
        <?php echo do_shortcode('[webqx_fhir_tester]'); ?>
    </div>
    <?php
}
?>