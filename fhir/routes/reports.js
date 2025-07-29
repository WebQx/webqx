const express = require('express');
const { body, param, query, validationResult } = require('express-validator');

const router = express.Router();

/**
 * Error handler helper for FHIR-compliant responses
 */
const handleError = (res, error, statusCode = 500) => {
    console.error('FHIR Reports API Error:', error);
    
    const operationOutcome = {
        resourceType: 'OperationOutcome',
        issue: [{
            severity: 'error',
            code: 'processing',
            diagnostics: error.message || 'An error occurred'
        }]
    };
    
    res.status(statusCode).json(operationOutcome);
};

/**
 * Success response helper for FHIR
 */
const sendFHIRResponse = (res, data, statusCode = 200) => {
    res.status(statusCode)
       .set('Content-Type', 'application/fhir+json; charset=utf-8')
       .json(data);
};

/**
 * Sample medical reports with annotations for demonstration
 * In production, this would integrate with actual EHR systems
 */
const SAMPLE_REPORTS = [
    {
        id: 'report-001',
        resourceType: 'DiagnosticReport',
        status: 'final',
        category: [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                code: 'LAB',
                display: 'Laboratory'
            }]
        }],
        code: {
            coding: [{
                system: 'http://loinc.org',
                code: '33747-0',
                display: 'General chemistry panel'
            }]
        },
        subject: {
            reference: 'Patient/patient-123'
        },
        effectiveDateTime: '2024-01-15',
        issued: '2024-01-15T10:30:00Z',
        result: [
            {
                reference: 'Observation/glucose-001'
            },
            {
                reference: 'Observation/cholesterol-001'
            }
        ],
        presentedForm: [{
            contentType: 'text/html',
            data: Buffer.from(`
                <div class="medical-report">
                    <h2>General Chemistry Panel</h2>
                    <p>Patient: John Doe</p>
                    <p>Date: January 15, 2024</p>
                    
                    <h3>Results:</h3>
                    <ul>
                        <li><span class="medical-term" data-term="glucose">Glucose</span>: 95 mg/dL (Normal)</li>
                        <li><span class="medical-term" data-term="cholesterol">Total Cholesterol</span>: 180 mg/dL (Normal)</li>
                        <li><span class="medical-term" data-term="hdl">HDL Cholesterol</span>: 55 mg/dL (Normal)</li>
                        <li><span class="medical-term" data-term="ldl">LDL Cholesterol</span>: 110 mg/dL (Normal)</li>
                        <li><span class="medical-term" data-term="triglycerides">Triglycerides</span>: 140 mg/dL (Normal)</li>
                    </ul>
                    
                    <h3>Interpretation:</h3>
                    <p>All <span class="medical-term" data-term="lipid-panel">lipid panel</span> values are within normal ranges. 
                    Continue current lifestyle and follow up in 6 months for routine monitoring.</p>
                    
                    <h3>Recommendations:</h3>
                    <ul>
                        <li>Maintain healthy diet low in <span class="medical-term" data-term="saturated-fat">saturated fats</span></li>
                        <li>Continue regular exercise routine</li>
                        <li>Follow up with primary care provider in 6 months</li>
                    </ul>
                </div>
            `).toString('base64')
        }],
        annotations: [
            {
                termId: 'glucose',
                positions: [{ start: 156, end: 163 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'cholesterol',
                positions: [{ start: 200, end: 217 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'hdl',
                positions: [{ start: 245, end: 248 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'ldl',
                positions: [{ start: 285, end: 288 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'triglycerides',
                positions: [{ start: 325, end: 338 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'lipid-panel',
                positions: [{ start: 415, end: 426 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'saturated-fat',
                positions: [{ start: 615, end: 629 }],
                glossaryRef: 'medical-glossary'
            }
        ]
    },
    {
        id: 'report-002',
        resourceType: 'DiagnosticReport',
        status: 'final',
        category: [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                code: 'RAD',
                display: 'Radiology'
            }]
        }],
        code: {
            coding: [{
                system: 'http://loinc.org',
                code: '36643-5',
                display: 'Chest X-ray'
            }]
        },
        subject: {
            reference: 'Patient/patient-123'
        },
        effectiveDateTime: '2024-01-10',
        issued: '2024-01-10T14:15:00Z',
        presentedForm: [{
            contentType: 'text/html',
            data: Buffer.from(`
                <div class="medical-report">
                    <h2>Chest X-ray Report</h2>
                    <p>Patient: John Doe</p>
                    <p>Date: January 10, 2024</p>
                    
                    <h3>Clinical Indication:</h3>
                    <p>Cough and shortness of breath</p>
                    
                    <h3>Findings:</h3>
                    <p>The <span class="medical-term" data-term="lungs">lungs</span> are clear bilaterally without evidence of 
                    <span class="medical-term" data-term="consolidation">consolidation</span>, 
                    <span class="medical-term" data-term="pneumothorax">pneumothorax</span>, or 
                    <span class="medical-term" data-term="pleural-effusion">pleural effusion</span>. 
                    The <span class="medical-term" data-term="cardiac-silhouette">cardiac silhouette</span> is normal in size and configuration. 
                    No acute <span class="medical-term" data-term="osseous">osseous</span> abnormalities are identified.</p>
                    
                    <h3>Impression:</h3>
                    <p>Normal chest X-ray. No acute cardiopulmonary findings.</p>
                </div>
            `).toString('base64')
        }],
        annotations: [
            {
                termId: 'lungs',
                positions: [{ start: 125, end: 130 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'consolidation',
                positions: [{ start: 175, end: 188 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'pneumothorax',
                positions: [{ start: 205, end: 217 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'pleural-effusion',
                positions: [{ start: 235, end: 250 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'cardiac-silhouette',
                positions: [{ start: 275, end: 292 }],
                glossaryRef: 'medical-glossary'
            },
            {
                termId: 'osseous',
                positions: [{ start: 345, end: 352 }],
                glossaryRef: 'medical-glossary'
            }
        ]
    }
];

/**
 * GET /fhir/DiagnosticReport
 * Search for diagnostic reports with optional parameters
 */
router.get('/', [
    query('patient').optional().isString(),
    query('category').optional().isString(),
    query('code').optional().isString(),
    query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
    query('status').optional().isIn(['registered', 'partial', 'preliminary', 'final']),
    query('_offset').optional().isInt({ min: 0 }),
    query('_count').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
    try {
        // Validate query parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid query parameters'), 400);
        }

        const { patient, category, code, date, status, _offset = 0, _count = 20 } = req.query;

        // Filter reports based on query parameters
        let filteredReports = SAMPLE_REPORTS;

        if (patient) {
            filteredReports = filteredReports.filter(report => 
                report.subject.reference.includes(patient)
            );
        }

        if (category) {
            filteredReports = filteredReports.filter(report => 
                report.category[0].coding[0].code === category
            );
        }

        if (code) {
            filteredReports = filteredReports.filter(report => 
                report.code.coding[0].code === code
            );
        }

        if (date) {
            filteredReports = filteredReports.filter(report => 
                report.effectiveDateTime === date
            );
        }

        if (status) {
            filteredReports = filteredReports.filter(report => 
                report.status === status
            );
        }

        // Apply pagination
        const total = filteredReports.length;
        const paginatedReports = filteredReports.slice(_offset, _offset + _count);

        // Create FHIR Bundle response
        const bundle = {
            resourceType: 'Bundle',
            type: 'searchset',
            total: total,
            entry: paginatedReports.map(report => ({
                resource: report,
                fullUrl: `${req.protocol}://${req.get('host')}/fhir/DiagnosticReport/${report.id}`
            }))
        };

        // Log access for audit purposes
        console.log(`Report access: User ${req.user?.sub} searched reports with params:`, req.query);

        sendFHIRResponse(res, bundle);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /fhir/DiagnosticReport/:id
 * Get a specific diagnostic report by ID
 */
router.get('/:id', [
    param('id').isString().trim()
], async (req, res) => {
    try {
        // Validate parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid report ID'), 400);
        }

        const { id } = req.params;
        const report = SAMPLE_REPORTS.find(r => r.id === id);

        if (!report) {
            return handleError(res, new Error('Report not found'), 404);
        }

        // Check patient access authorization
        const patientId = req.user?.patient || req.query.patient;
        if (patientId && !report.subject.reference.includes(patientId)) {
            return handleError(res, new Error('Access denied'), 403);
        }

        // Log access for audit purposes
        console.log(`Report access: User ${req.user?.sub} accessed report ${id}`);

        sendFHIRResponse(res, report);
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * GET /fhir/DiagnosticReport/:id/annotations
 * Get annotations for a specific report
 */
router.get('/:id/annotations', [
    param('id').isString().trim()
], async (req, res) => {
    try {
        // Validate parameters
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return handleError(res, new Error('Invalid report ID'), 400);
        }

        const { id } = req.params;
        const report = SAMPLE_REPORTS.find(r => r.id === id);

        if (!report) {
            return handleError(res, new Error('Report not found'), 404);
        }

        // Check patient access authorization
        const patientId = req.user?.patient || req.query.patient;
        if (patientId && !report.subject.reference.includes(patientId)) {
            return handleError(res, new Error('Access denied'), 403);
        }

        const response = {
            reportId: id,
            annotations: report.annotations || [],
            lastUpdated: report.issued
        };

        // Log access for audit purposes
        console.log(`Annotations access: User ${req.user?.sub} accessed annotations for report ${id}`);

        res.json(response);
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;