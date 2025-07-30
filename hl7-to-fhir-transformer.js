/**
 * HL7 to FHIR Observation Transformer Script
 * 
 * This script transforms HL7 v2 ORU^R01 messages containing lab results
 * into FHIR R4 Observation resources.
 * 
 * Usage in Mirth Connect:
 * 1. Add this script to the Global Scripts section as "hl7ToFhirTransformer"
 * 2. Reference it in transformer steps as: Scripts.hl7ToFhirTransformer(msg)
 * 
 * @param {Object} msg - HL7 message object from Mirth Connect
 * @returns {String} - JSON string of FHIR Observation resource
 */
function hl7ToFhirTransformer(msg) {
    try {
        // Validate input message
        if (!msg || !msg.MSH) {
            throw new Error('Invalid HL7 message: Missing MSH segment');
        }
        
        // Validate message type
        var messageType = msg.MSH['MSH.9']['MSH.9.1'].toString();
        if (messageType !== 'ORU') {
            throw new Error('Unsupported message type: ' + messageType + '. Expected ORU.');
        }
        
        // Extract patient information from PID segment
        if (!msg.PID) {
            throw new Error('Missing required PID segment');
        }
        
        var patientId = msg.PID['PID.3']['PID.3.1'].toString();
        var patientName = {
            family: msg.PID['PID.5']['PID.5.1'].toString(),
            given: msg.PID['PID.5']['PID.5.2'].toString()
        };
        
        // Extract observation results from OBX segments
        if (!msg.OBX || (Array.isArray(msg.OBX) && msg.OBX.length === 0)) {
            throw new Error('Missing required OBX segment(s)');
        }
        
        // Handle single OBX or array of OBX segments
        var obxSegments = Array.isArray(msg.OBX) ? msg.OBX : [msg.OBX];
        var observations = [];
        
        for (var i = 0; i < obxSegments.length; i++) {
            var obx = obxSegments[i];
            
            // Extract observation details
            var observationId = obx['OBX.3']['OBX.3.1'].toString();
            var observationText = obx['OBX.3']['OBX.3.2'].toString();
            var codingSystem = obx['OBX.3']['OBX.3.3'].toString();
            var valueType = obx['OBX.2'].toString();
            var observationValue = obx['OBX.5'].toString();
            var units = obx['OBX.6'] ? obx['OBX.6'].toString() : '';
            var referenceRange = obx['OBX.7'] ? obx['OBX.7'].toString() : '';
            var abnormalFlags = obx['OBX.8'] ? obx['OBX.8'].toString() : '';
            var resultStatus = obx['OBX.11'] ? obx['OBX.11'].toString() : 'final';
            
            // Get observation date/time from OBR or use current time
            var effectiveDateTime = new Date().toISOString();
            if (msg.OBR && msg.OBR['OBR.7']) {
                var hl7DateTime = msg.OBR['OBR.7'].toString();
                effectiveDateTime = convertHL7DateTime(hl7DateTime);
            }
            
            // Create FHIR Observation resource
            var fhirObservation = {
                resourceType: 'Observation',
                id: generateObservationId(patientId, observationId, i),
                status: mapResultStatusToFHIR(resultStatus),
                category: [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                        code: 'laboratory',
                        display: 'Laboratory'
                    }]
                }],
                code: {
                    coding: [{
                        system: mapCodingSystemToFHIR(codingSystem),
                        code: observationId,
                        display: observationText
                    }]
                },
                subject: {
                    reference: 'Patient/' + patientId,
                    display: patientName.given + ' ' + patientName.family
                },
                effectiveDateTime: effectiveDateTime,
                issued: new Date().toISOString(),
                performer: [{
                    reference: 'Organization/lab-facility',
                    display: 'Laboratory Facility'
                }]
            };
            
            // Add value based on value type
            if (valueType === 'NM') {
                // Numeric value
                var numericValue = parseFloat(observationValue);
                if (!isNaN(numericValue)) {
                    fhirObservation.valueQuantity = {
                        value: numericValue,
                        unit: units,
                        system: 'http://unitsofmeasure.org',
                        code: units
                    };
                }
            } else if (valueType === 'ST' || valueType === 'TX') {
                // String/text value
                fhirObservation.valueString = observationValue;
            } else if (valueType === 'CE' || valueType === 'CWE') {
                // Coded value
                fhirObservation.valueCodeableConcept = {
                    coding: [{
                        system: mapCodingSystemToFHIR(codingSystem),
                        code: observationValue,
                        display: observationValue
                    }]
                };
            } else {
                // Default to string value
                fhirObservation.valueString = observationValue;
            }
            
            // Add reference range if present
            if (referenceRange) {
                fhirObservation.referenceRange = [{
                    text: referenceRange
                }];
                
                // Try to parse numeric range (e.g., "12.0-16.0")
                var rangeMatch = referenceRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
                if (rangeMatch && units) {
                    fhirObservation.referenceRange[0].low = {
                        value: parseFloat(rangeMatch[1]),
                        unit: units,
                        system: 'http://unitsofmeasure.org',
                        code: units
                    };
                    fhirObservation.referenceRange[0].high = {
                        value: parseFloat(rangeMatch[2]),
                        unit: units,
                        system: 'http://unitsofmeasure.org',
                        code: units
                    };
                }
            }
            
            // Add interpretation if abnormal flags are present
            if (abnormalFlags) {
                fhirObservation.interpretation = [{
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                        code: mapAbnormalFlagsToFHIR(abnormalFlags),
                        display: getInterpretationDisplay(abnormalFlags)
                    }]
                }];
            }
            
            // Add metadata
            fhirObservation.meta = {
                profile: ['http://hl7.org/fhir/StructureDefinition/Observation'],
                source: '#hl7-mirth-transformer',
                lastUpdated: new Date().toISOString()
            };
            
            observations.push(fhirObservation);
        }
        
        // Return single observation or bundle based on count
        if (observations.length === 1) {
            return JSON.stringify(observations[0], null, 2);
        } else {
            // Create a Bundle for multiple observations
            var bundle = {
                resourceType: 'Bundle',
                id: generateBundleId(patientId),
                type: 'collection',
                timestamp: new Date().toISOString(),
                total: observations.length,
                entry: observations.map(function(obs) {
                    return {
                        resource: obs,
                        fullUrl: 'urn:uuid:' + obs.id
                    };
                })
            };
            return JSON.stringify(bundle, null, 2);
        }
        
    } catch (error) {
        logger.error('HL7 to FHIR transformation error: ' + error.message);
        
        // Return error response in FHIR OperationOutcome format
        var operationOutcome = {
            resourceType: 'OperationOutcome',
            id: 'transformation-error',
            issue: [{
                severity: 'error',
                code: 'processing',
                details: {
                    text: 'HL7 to FHIR transformation failed: ' + error.message
                }
            }]
        };
        return JSON.stringify(operationOutcome, null, 2);
    }
}

/**
 * Helper function to convert HL7 date/time format to ISO 8601
 */
function convertHL7DateTime(hl7DateTime) {
    if (!hl7DateTime || hl7DateTime.length < 8) {
        return new Date().toISOString();
    }
    
    // HL7 format: YYYYMMDDHHMMSS
    var year = hl7DateTime.substring(0, 4);
    var month = hl7DateTime.substring(4, 6);
    var day = hl7DateTime.substring(6, 8);
    var hour = hl7DateTime.length >= 10 ? hl7DateTime.substring(8, 10) : '00';
    var minute = hl7DateTime.length >= 12 ? hl7DateTime.substring(10, 12) : '00';
    var second = hl7DateTime.length >= 14 ? hl7DateTime.substring(12, 14) : '00';
    
    // Create ISO 8601 format
    var isoDateTime = year + '-' + month + '-' + day + 'T' + hour + ':' + minute + ':' + second + '.000Z';
    
    // Validate the date
    var date = new Date(isoDateTime);
    return isNaN(date.getTime()) ? new Date().toISOString() : isoDateTime;
}

/**
 * Helper function to map HL7 coding systems to FHIR URIs
 */
function mapCodingSystemToFHIR(codingSystem) {
    var mappings = {
        'LN': 'http://loinc.org',
        'LOINC': 'http://loinc.org',
        'SNM': 'http://snomed.info/sct',
        'SNOMED': 'http://snomed.info/sct',
        'CPT': 'http://www.ama-assn.org/go/cpt',
        'ICD10': 'http://hl7.org/fhir/sid/icd-10',
        'ICD9': 'http://hl7.org/fhir/sid/icd-9-cm',
        'L': 'http://loinc.org'  // Default for lab codes
    };
    
    return mappings[codingSystem] || 'http://terminology.hl7.org/CodeSystem/v2-0396';
}

/**
 * Helper function to map HL7 result status to FHIR observation status
 */
function mapResultStatusToFHIR(resultStatus) {
    var mappings = {
        'F': 'final',
        'P': 'preliminary',
        'C': 'corrected',
        'X': 'cancelled',
        'I': 'registered',
        'R': 'registered',
        'S': 'preliminary'
    };
    
    return mappings[resultStatus] || 'final';
}

/**
 * Helper function to map HL7 abnormal flags to FHIR interpretation codes
 */
function mapAbnormalFlagsToFHIR(abnormalFlags) {
    var mappings = {
        'H': 'H',      // High
        'L': 'L',      // Low
        'HH': 'HH',    // Critical high
        'LL': 'LL',    // Critical low
        'N': 'N',      // Normal
        'A': 'A',      // Abnormal
        '>': 'H',      // Above high normal
        '<': 'L'       // Below low normal
    };
    
    return mappings[abnormalFlags] || 'N';
}

/**
 * Helper function to get interpretation display text
 */
function getInterpretationDisplay(abnormalFlags) {
    var displays = {
        'H': 'High',
        'L': 'Low',
        'HH': 'Critical high',
        'LL': 'Critical low',
        'N': 'Normal',
        'A': 'Abnormal',
        '>': 'High',
        '<': 'Low'
    };
    
    return displays[abnormalFlags] || 'Normal';
}

/**
 * Helper function to generate unique observation ID
 */
function generateObservationId(patientId, observationCode, index) {
    var timestamp = new Date().getTime();
    return 'obs-' + patientId + '-' + observationCode + '-' + index + '-' + timestamp;
}

/**
 * Helper function to generate unique bundle ID
 */
function generateBundleId(patientId) {
    var timestamp = new Date().getTime();
    return 'bundle-lab-results-' + patientId + '-' + timestamp;
}

// Export the main transformer function for use in Mirth Connect
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        hl7ToFhirTransformer: hl7ToFhirTransformer,
        convertHL7DateTime: convertHL7DateTime,
        mapCodingSystemToFHIR: mapCodingSystemToFHIR,
        mapResultStatusToFHIR: mapResultStatusToFHIR,
        mapAbnormalFlagsToFHIR: mapAbnormalFlagsToFHIR
    };
}