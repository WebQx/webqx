/**
 * FHIR R4 Resource Types and Models
 * 
 * Implementation of core FHIR R4 resources needed for appointment booking
 * and patient management. Follows HL7 FHIR R4 specification.
 * 
 * @author WebQX Health
 * @version 1.0.0
 * @specification HL7 FHIR R4 (4.0.1)
 */

// ============================================================================
// Base FHIR Types
// ============================================================================

/**
 * FHIR R4 Resource base interface
 */
export interface FHIRResource {
  /** Resource type identifier */
  resourceType: string;
  /** Logical id of this artifact */
  id?: string;
  /** Metadata about the resource */
  meta?: FHIRMeta;
  /** A set of rules under which this content was created */
  implicitRules?: string;
  /** Language of the resource content */
  language?: string;
}

/**
 * FHIR R4 Meta element
 */
export interface FHIRMeta {
  /** Version specific identifier */
  versionId?: string;
  /** When the resource version last changed */
  lastUpdated?: string;
  /** Profiles this resource claims to conform to */
  profile?: string[];
  /** Security Labels applied to this resource */
  security?: FHIRCoding[];
  /** Tags applied to this resource */
  tag?: FHIRCoding[];
}

/**
 * FHIR R4 Coding element
 */
export interface FHIRCoding {
  /** Identity of the terminology system */
  system?: string;
  /** Version of the system - if relevant */
  version?: string;
  /** Symbol in syntax defined by the system */
  code?: string;
  /** Representation defined by the system */
  display?: string;
  /** If this coding was chosen directly by the user */
  userSelected?: boolean;
}

/**
 * FHIR R4 CodeableConcept element
 */
export interface FHIRCodeableConcept {
  /** Code defined by a terminology system */
  coding?: FHIRCoding[];
  /** Plain text representation of the concept */
  text?: string;
}

/**
 * FHIR R4 Identifier element
 */
export interface FHIRIdentifier {
  /** The purpose of this identifier */
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  /** Description of identifier */
  type?: FHIRCodeableConcept;
  /** The namespace for the identifier value */
  system?: string;
  /** The value that is unique */
  value?: string;
  /** Time period when id is/was valid for use */
  period?: FHIRPeriod;
  /** Organization that issued id */
  assigner?: FHIRReference;
}

/**
 * FHIR R4 Period element
 */
export interface FHIRPeriod {
  /** Starting time with inclusive boundary */
  start?: string;
  /** End time with inclusive boundary, if not ongoing */
  end?: string;
}

/**
 * FHIR R4 Reference element
 */
export interface FHIRReference {
  /** Literal reference, Relative, internal or absolute URL */
  reference?: string;
  /** Type the reference refers to */
  type?: string;
  /** Logical reference, when literal reference is not known */
  identifier?: FHIRIdentifier;
  /** Text alternative for the resource */
  display?: string;
}

/**
 * FHIR R4 HumanName element
 */
export interface FHIRHumanName {
  /** Identifies the purpose for this name */
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  /** Text representation of the full name */
  text?: string;
  /** Family name (often called 'Surname') */
  family?: string;
  /** Given names (not always 'first'). Includes middle names */
  given?: string[];
  /** Parts that come before the name */
  prefix?: string[];
  /** Parts that come after the name */
  suffix?: string[];
  /** Time period when name was/is in use */
  period?: FHIRPeriod;
}

/**
 * FHIR R4 ContactPoint element
 */
export interface FHIRContactPoint {
  /** phone | fax | email | pager | url | sms | other */
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  /** The actual contact point details */
  value?: string;
  /** home | work | temp | old | mobile - purpose of this contact point */
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  /** Specify preferred order of use (1 = highest) */
  rank?: number;
  /** Time period when the contact point was/is in use */
  period?: FHIRPeriod;
}

/**
 * FHIR R4 Address element
 */
export interface FHIRAddress {
  /** home | work | temp | old | billing - purpose of this address */
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  /** postal | physical | both */
  type?: 'postal' | 'physical' | 'both';
  /** Text representation of the address */
  text?: string;
  /** Street name, number, direction & P.O. Box etc. */
  line?: string[];
  /** Name of city, town etc. */
  city?: string;
  /** District name (aka county) */
  district?: string;
  /** Sub-unit of country (abbreviations ok) */
  state?: string;
  /** Postal code for area */
  postalCode?: string;
  /** Country (e.g. can be ISO 3166 2 or 3 letter code) */
  country?: string;
  /** Time period when address was/is in use */
  period?: FHIRPeriod;
}

// ============================================================================
// FHIR R4 Patient Resource
// ============================================================================

/**
 * FHIR R4 Patient Resource
 */
export interface FHIRPatient extends FHIRResource {
  resourceType: 'Patient';
  /** An identifier for this patient */
  identifier?: FHIRIdentifier[];
  /** Whether this patient record is in active use */
  active?: boolean;
  /** A name associated with the patient */
  name?: FHIRHumanName[];
  /** A contact detail for the individual */
  telecom?: FHIRContactPoint[];
  /** male | female | other | unknown */
  gender?: 'male' | 'female' | 'other' | 'unknown';
  /** The date of birth for the individual */
  birthDate?: string;
  /** Indicates if the individual is deceased or not */
  deceasedBoolean?: boolean;
  /** Indicates when the individual died */
  deceasedDateTime?: string;
  /** An address for the individual */
  address?: FHIRAddress[];
  /** Marital (civil) status of a patient */
  maritalStatus?: FHIRCodeableConcept;
  /** Whether patient is part of a multiple birth */
  multipleBirthBoolean?: boolean;
  /** The birth order of the individual in a multiple birth */
  multipleBirthInteger?: number;
  /** Image of the patient */
  photo?: FHIRAttachment[];
  /** A contact party (e.g. guardian, partner, friend) for the patient */
  contact?: FHIRPatientContact[];
  /** A language which may be used to communicate with the patient about their health */
  communication?: FHIRPatientCommunication[];
  /** Patient's nominated primary care provider */
  generalPractitioner?: FHIRReference[];
  /** Organization that is the custodian of the patient record */
  managingOrganization?: FHIRReference;
  /** Link to another patient resource that concerns the same actual person */
  link?: FHIRPatientLink[];
}

/**
 * FHIR R4 Patient Contact element
 */
export interface FHIRPatientContact {
  /** The kind of relationship */
  relationship?: FHIRCodeableConcept[];
  /** A name associated with the contact person */
  name?: FHIRHumanName;
  /** A contact detail for the person */
  telecom?: FHIRContactPoint[];
  /** Address for the contact person */
  address?: FHIRAddress;
  /** male | female | other | unknown */
  gender?: 'male' | 'female' | 'other' | 'unknown';
  /** Organization that is associated with the contact */
  organization?: FHIRReference;
  /** The period during which this contact person or organization is valid to be contacted relating to this patient */
  period?: FHIRPeriod;
}

/**
 * FHIR R4 Patient Communication element
 */
export interface FHIRPatientCommunication {
  /** The language which can be used to communicate with the patient about their health */
  language: FHIRCodeableConcept;
  /** Language preference indicator */
  preferred?: boolean;
}

/**
 * FHIR R4 Patient Link element
 */
export interface FHIRPatientLink {
  /** The other patient resource that the link refers to */
  other: FHIRReference;
  /** replaced-by | replaces | refer | seealso */
  type: 'replaced-by' | 'replaces' | 'refer' | 'seealso';
}

/**
 * FHIR R4 Attachment element
 */
export interface FHIRAttachment {
  /** Mime type of the content, with charset etc. */
  contentType?: string;
  /** Human language of the content (BCP-47) */
  language?: string;
  /** Data inline, base64ed */
  data?: string;
  /** Uri where the data can be found */
  url?: string;
  /** Number of bytes of content (if url provided) */
  size?: number;
  /** Hash of the data (sha-1, base64ed) */
  hash?: string;
  /** Label to display in place of the data */
  title?: string;
  /** Date attachment was first created */
  creation?: string;
}

// ============================================================================
// FHIR R4 Practitioner Resource
// ============================================================================

/**
 * FHIR R4 Practitioner Resource
 */
export interface FHIRPractitioner extends FHIRResource {
  resourceType: 'Practitioner';
  /** An identifier for the person as this agent */
  identifier?: FHIRIdentifier[];
  /** Whether this practitioner's record is in active use */
  active?: boolean;
  /** The name(s) associated with the practitioner */
  name?: FHIRHumanName[];
  /** A contact detail for the practitioner (that apply to all roles) */
  telecom?: FHIRContactPoint[];
  /** Address(es) of the practitioner that are not role specific (typically home address) */
  address?: FHIRAddress[];
  /** male | female | other | unknown */
  gender?: 'male' | 'female' | 'other' | 'unknown';
  /** The date on which the practitioner was born */
  birthDate?: string;
  /** Image of the person */
  photo?: FHIRAttachment[];
  /** Certification, licenses, or training pertaining to the provision of care */
  qualification?: FHIRPractitionerQualification[];
  /** A language the practitioner can use in patient communication */
  communication?: FHIRCodeableConcept[];
}

/**
 * FHIR R4 Practitioner Qualification element
 */
export interface FHIRPractitionerQualification {
  /** An identifier for this qualification for the practitioner */
  identifier?: FHIRIdentifier[];
  /** Coded representation of the qualification */
  code: FHIRCodeableConcept;
  /** Period during which the qualification is valid */
  period?: FHIRPeriod;
  /** Organization that regulates and issues the qualification */
  issuer?: FHIRReference;
}

// ============================================================================
// FHIR R4 Appointment Resource
// ============================================================================

/**
 * FHIR R4 Appointment Resource
 */
export interface FHIRAppointment extends FHIRResource {
  resourceType: 'Appointment';
  /** External Ids for this item */
  identifier?: FHIRIdentifier[];
  /** proposed | pending | booked | arrived | fulfilled | cancelled | noshow | entered-in-error | checked-in | waitlist */
  status: FHIRAppointmentStatus;
  /** The coded reason for the appointment being cancelled */
  cancelationReason?: FHIRCodeableConcept;
  /** A broad categorization of the service that is to be performed during this appointment */
  serviceCategory?: FHIRCodeableConcept[];
  /** The specific service that is to be performed during this appointment */
  serviceType?: FHIRCodeableConcept[];
  /** The specialty of a practitioner that would be required to perform the service requested in this appointment */
  specialty?: FHIRCodeableConcept[];
  /** The style of appointment or patient that has been booked in the slot */
  appointmentType?: FHIRCodeableConcept;
  /** Coded reason this appointment is scheduled */
  reasonCode?: FHIRCodeableConcept[];
  /** Reason the appointment is to take place (resource) */
  reasonReference?: FHIRReference[];
  /** Used to make informed decisions if needing to re-prioritize */
  priority?: number;
  /** Shown on a subject line in a meeting request, or appointment list */
  description?: string;
  /** Additional information to support the appointment */
  supportingInformation?: FHIRReference[];
  /** When appointment is to take place */
  start?: string;
  /** When appointment is to conclude */
  end?: string;
  /** Can be less than start/end (e.g. estimate) */
  minutesDuration?: number;
  /** The slots that this appointment is filling */
  slot?: FHIRReference[];
  /** The date that this appointment was initially created */
  created?: string;
  /** Additional comments */
  comment?: string;
  /** Detailed information and instructions for the patient */
  patientInstruction?: string;
  /** The service request this appointment is allocated to assess */
  basedOn?: FHIRReference[];
  /** Participants involved in appointment */
  participant: FHIRAppointmentParticipant[];
  /** Potential date/time interval(s) requested to allocate the appointment within */
  requestedPeriod?: FHIRPeriod[];
}

/**
 * FHIR R4 Appointment Status
 */
export type FHIRAppointmentStatus = 
  | 'proposed' 
  | 'pending' 
  | 'booked' 
  | 'arrived' 
  | 'fulfilled' 
  | 'cancelled' 
  | 'noshow' 
  | 'entered-in-error' 
  | 'checked-in' 
  | 'waitlist';

/**
 * FHIR R4 Appointment Participant element
 */
export interface FHIRAppointmentParticipant {
  /** Role of participant in the appointment */
  type?: FHIRCodeableConcept[];
  /** Person, Location/HealthcareService or Device */
  actor?: FHIRReference;
  /** required | optional | information-only */
  required?: 'required' | 'optional' | 'information-only';
  /** accepted | declined | tentative | needs-action */
  status: 'accepted' | 'declined' | 'tentative' | 'needs-action';
  /** Participation period of the actor */
  period?: FHIRPeriod;
}

// ============================================================================
// FHIR R4 Schedule Resource
// ============================================================================

/**
 * FHIR R4 Schedule Resource
 */
export interface FHIRSchedule extends FHIRResource {
  resourceType: 'Schedule';
  /** External Ids for this item */
  identifier?: FHIRIdentifier[];
  /** Whether this schedule record is in active use */
  active?: boolean;
  /** High-level category */
  serviceCategory?: FHIRCodeableConcept[];
  /** Specific service */
  serviceType?: FHIRCodeableConcept[];
  /** Type of specialty needed */
  specialty?: FHIRCodeableConcept[];
  /** Resource(s) that availability information is being provided for */
  actor: FHIRReference[];
  /** Period of time covered by schedule */
  planningHorizon?: FHIRPeriod;
  /** Comments on availability */
  comment?: string;
}

// ============================================================================
// FHIR R4 Slot Resource
// ============================================================================

/**
 * FHIR R4 Slot Resource
 */
export interface FHIRSlot extends FHIRResource {
  resourceType: 'Slot';
  /** External Ids for this item */
  identifier?: FHIRIdentifier[];
  /** A broad categorization of the service that is to be performed during this appointment */
  serviceCategory?: FHIRCodeableConcept[];
  /** The type of appointments that can be booked into this slot */
  serviceType?: FHIRCodeableConcept[];
  /** The specialty of a practitioner that would be required to perform the service requested in this appointment */
  specialty?: FHIRCodeableConcept[];
  /** The style of appointment or patient that may be booked in the slot */
  appointmentType?: FHIRCodeableConcept;
  /** The schedule resource that this slot defines an interval of status information */
  schedule: FHIRReference;
  /** free | busy | busy-unavailable | busy-tentative | entered-in-error */
  status: 'free' | 'busy' | 'busy-unavailable' | 'busy-tentative' | 'entered-in-error';
  /** Date/Time that the slot is to begin */
  start: string;
  /** Date/Time that the slot is to conclude */
  end: string;
  /** This slot has already been overbooked, appointments are unlikely to be accepted for this time */
  overbooked?: boolean;
  /** Comments on the slot to describe any extended information */
  comment?: string;
}

// ============================================================================
// FHIR R4 Organization Resource
// ============================================================================

/**
 * FHIR R4 Organization Resource
 */
export interface FHIROrganization extends FHIRResource {
  resourceType: 'Organization';
  /** Identifies this organization across multiple systems */
  identifier?: FHIRIdentifier[];
  /** Whether the organization's record is still in active use */
  active?: boolean;
  /** Kind of organization */
  type?: FHIRCodeableConcept[];
  /** Name used for the organization */
  name?: string;
  /** A list of alternate names that the organization is known as, or was known as in the past */
  alias?: string[];
  /** A contact detail for the organization */
  telecom?: FHIRContactPoint[];
  /** An address for the organization */
  address?: FHIRAddress[];
  /** The organization of which this organization forms a part */
  partOf?: FHIRReference;
  /** Contact for the organization for a certain purpose */
  contact?: FHIROrganizationContact[];
  /** Technical endpoints providing access to services operated for the organization */
  endpoint?: FHIRReference[];
}

/**
 * FHIR R4 Organization Contact element
 */
export interface FHIROrganizationContact {
  /** The type of contact */
  purpose?: FHIRCodeableConcept;
  /** A name associated with the contact */
  name?: FHIRHumanName;
  /** Contact details (telephone, email, etc.)  for a contact */
  telecom?: FHIRContactPoint[];
  /** Visiting or postal addresses for the contact */
  address?: FHIRAddress;
}

// ============================================================================
// FHIR R4 Bundle Resource
// ============================================================================

/**
 * FHIR R4 Bundle Resource
 */
export interface FHIRBundle extends FHIRResource {
  resourceType: 'Bundle';
  /** Persistent identifier for the bundle */
  identifier?: FHIRIdentifier;
  /** document | message | transaction | transaction-response | batch | batch-response | history | searchset | collection */
  type: FHIRBundleType;
  /** When the bundle was assembled */
  timestamp?: string;
  /** If search, the total number of matches */
  total?: number;
  /** Links related to this Bundle */
  link?: FHIRBundleLink[];
  /** Entry in the bundle - will have a resource or information */
  entry?: FHIRBundleEntry[];
  /** Digital Signature */
  signature?: FHIRSignature;
}

/**
 * FHIR R4 Bundle Type
 */
export type FHIRBundleType = 
  | 'document' 
  | 'message' 
  | 'transaction' 
  | 'transaction-response' 
  | 'batch' 
  | 'batch-response' 
  | 'history' 
  | 'searchset' 
  | 'collection';

/**
 * FHIR R4 Bundle Link element
 */
export interface FHIRBundleLink {
  /** See http://www.iana.org/assignments/link-relations/link-relations.xhtml#link-relations-1 */
  relation: string;
  /** Reference details for the link */
  url: string;
}

/**
 * FHIR R4 Bundle Entry element
 */
export interface FHIRBundleEntry {
  /** Links related to this entry */
  link?: FHIRBundleLink[];
  /** URI for resource (Absolute URL) */
  fullUrl?: string;
  /** A resource in the bundle */
  resource?: FHIRResource;
  /** Search related information */
  search?: FHIRBundleEntrySearch;
  /** Additional execution information (transaction/batch/history) */
  request?: FHIRBundleEntryRequest;
  /** Results of execution (transaction/batch/history) */
  response?: FHIRBundleEntryResponse;
}

/**
 * FHIR R4 Bundle Entry Search element
 */
export interface FHIRBundleEntrySearch {
  /** match | include | outcome - why this is in the result set */
  mode?: 'match' | 'include' | 'outcome';
  /** Search ranking (between 0 and 1) */
  score?: number;
}

/**
 * FHIR R4 Bundle Entry Request element
 */
export interface FHIRBundleEntryRequest {
  /** GET | HEAD | POST | PUT | DELETE | PATCH */
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** URL for HTTP equivalent of this entry */
  url: string;
  /** For managing cache currency */
  ifNoneMatch?: string;
  /** For managing cache currency */
  ifModifiedSince?: string;
  /** For managing update contention */
  ifMatch?: string;
  /** For conditional creates */
  ifNoneExist?: string;
}

/**
 * FHIR R4 Bundle Entry Response element
 */
export interface FHIRBundleEntryResponse {
  /** Status response code (text optional) */
  status: string;
  /** The location (if the operation returns a location) */
  location?: string;
  /** The Etag for the resource (if relevant) */
  etag?: string;
  /** Server's date time modified */
  lastModified?: string;
  /** OperationOutcome with hints and warnings (for batch/transaction) */
  outcome?: FHIRResource;
}

/**
 * FHIR R4 Signature element
 */
export interface FHIRSignature {
  /** Indication of the reason the entity signed the object(s) */
  type: FHIRCoding[];
  /** When the signature was created */
  when: string;
  /** Who signed */
  who: FHIRReference;
  /** The party represented */
  onBehalfOf?: FHIRReference;
  /** The technical format of the signed resources */
  targetFormat?: string;
  /** The technical format of the signature */
  sigFormat?: string;
  /** The actual signature content (XML DigSig. JWS, picture, etc.) */
  data?: string;
}

// ============================================================================
// FHIR R4 OperationOutcome Resource
// ============================================================================

/**
 * FHIR R4 OperationOutcome Resource
 */
export interface FHIROperationOutcome extends FHIRResource {
  resourceType: 'OperationOutcome';
  /** A single issue associated with the action */
  issue: FHIROperationOutcomeIssue[];
}

/**
 * FHIR R4 OperationOutcome Issue element
 */
export interface FHIROperationOutcomeIssue {
  /** fatal | error | warning | information */
  severity: 'fatal' | 'error' | 'warning' | 'information';
  /** Error or warning code */
  code: string;
  /** Additional details about the error */
  details?: FHIRCodeableConcept;
  /** Additional diagnostic information about the issue */
  diagnostics?: string;
  /** Deprecated: Path of element(s) related to issue */
  location?: string[];
  /** FHIRPath of element(s) related to issue */
  expression?: string[];
}

// ============================================================================
// Helper Types and Utilities
// ============================================================================

/**
 * FHIR R4 Search Parameters for Appointments
 */
export interface FHIRAppointmentSearchParams {
  /** Search by appointment identifier */
  identifier?: string;
  /** Search by appointment status */
  status?: FHIRAppointmentStatus | FHIRAppointmentStatus[];
  /** Search by appointment date range */
  date?: string;
  /** Search by patient reference */
  patient?: string;
  /** Search by practitioner reference */
  practitioner?: string;
  /** Search by location reference */
  location?: string;
  /** Search by service type */
  'service-type'?: string;
  /** Search by specialty */
  specialty?: string;
  /** Number of results to return */
  _count?: number;
  /** Starting point for results */
  _offset?: number;
  /** Sort order */
  _sort?: string;
}

/**
 * FHIR R4 Search Parameters for Slots
 */
export interface FHIRSlotSearchParams {
  /** Search by slot identifier */
  identifier?: string;
  /** Search by slot status */
  status?: string;
  /** Search by start date/time */
  start?: string;
  /** Search by schedule reference */
  schedule?: string;
  /** Search by service type */
  'service-type'?: string;
  /** Search by specialty */
  specialty?: string;
  /** Number of results to return */
  _count?: number;
  /** Starting point for results */
  _offset?: number;
}

/**
 * FHIR R4 Create Appointment Request
 */
export interface FHIRCreateAppointmentRequest {
  /** The appointment resource to create */
  appointment: Omit<FHIRAppointment, 'id' | 'meta'>;
  /** Optional conditional create parameters */
  ifNoneExist?: string;
}

/**
 * FHIR R4 Update Appointment Request
 */
export interface FHIRUpdateAppointmentRequest {
  /** The appointment ID to update */
  id: string;
  /** The updated appointment resource */
  appointment: FHIRAppointment;
  /** Optional version for optimistic locking */
  ifMatch?: string;
}

/**
 * FHIR R4 API Response wrapper
 */
export interface FHIRApiResponse<T = FHIRResource> {
  /** Success status */
  success: boolean;
  /** Response data */
  data?: T;
  /** Operation outcome with any issues */
  outcome?: FHIROperationOutcome;
  /** HTTP status code */
  statusCode?: number;
  /** Response headers */
  headers?: Record<string, string>;
  /** Raw response body for debugging */
  rawResponse?: string;
}

/**
 * FHIR R4 Batch/Transaction Request
 */
export interface FHIRBatchRequest {
  /** The bundle containing the batch/transaction entries */
  bundle: FHIRBundle;
  /** Whether to use transaction semantics */
  useTransaction?: boolean;
}

export default {
  // Resource interfaces
  FHIRResource,
  FHIRPatient,
  FHIRPractitioner,
  FHIRAppointment,
  FHIRSchedule,
  FHIRSlot,
  FHIROrganization,
  FHIRBundle,
  FHIROperationOutcome,
  
  // Element interfaces
  FHIRMeta,
  FHIRCoding,
  FHIRCodeableConcept,
  FHIRIdentifier,
  FHIRPeriod,
  FHIRReference,
  FHIRHumanName,
  FHIRContactPoint,
  FHIRAddress,
  FHIRAttachment,
  
  // Search and request interfaces
  FHIRAppointmentSearchParams,
  FHIRSlotSearchParams,
  FHIRCreateAppointmentRequest,
  FHIRUpdateAppointmentRequest,
  FHIRBatchRequest,
  FHIRApiResponse
};