const Appointment = require('../models/Appointment');

/**
 * FHIR Appointment Service
 * Handles CRUD operations for Appointment resources with real-time booking capabilities
 */
class AppointmentService {
    constructor() {
        // In-memory storage for this implementation
        // In production, this would be connected to a proper database with real-time capabilities
        this.appointments = new Map();
        this.availableSlots = new Map(); // For managing available time slots
        this.initializeTestAppointments();
        this.initializeAvailableSlots();
    }

    /**
     * Initialize with some test appointments for demonstration
     */
    initializeTestAppointments() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(14, 30, 0, 0);
        
        const testAppointments = [
            {
                id: 'appointment-001',
                status: 'booked',
                serviceType: [{
                    coding: [{
                        system: 'http://snomed.info/sct',
                        code: '11429006',
                        display: 'Consultation'
                    }],
                    text: 'General Consultation'
                }],
                specialty: [{
                    coding: [{
                        system: 'http://snomed.info/sct',
                        code: '394814009',
                        display: 'General practice'
                    }]
                }],
                appointmentType: {
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
                        code: 'ROUTINE',
                        display: 'Routine'
                    }]
                },
                description: 'Annual physical examination',
                start: tomorrow.toISOString(),
                end: new Date(tomorrow.getTime() + 30 * 60000).toISOString(), // 30 minutes
                minutesDuration: 30,
                participant: [
                    {
                        actor: {
                            reference: 'Patient/patient-001',
                            display: 'John Doe'
                        },
                        required: 'required',
                        status: 'accepted'
                    },
                    {
                        actor: {
                            reference: 'Practitioner/practitioner-001',
                            display: 'Dr. Sarah Johnson'
                        },
                        required: 'required',
                        status: 'accepted'
                    }
                ],
                priority: 5,
                comment: 'Please arrive 15 minutes early for check-in',
                patientInstruction: 'Bring your insurance card and list of current medications',
                created: new Date().toISOString()
            },
            {
                id: 'appointment-002',
                status: 'pending',
                serviceType: [{
                    coding: [{
                        system: 'http://snomed.info/sct',
                        code: '185349003',
                        display: 'Follow-up visit'
                    }],
                    text: 'Follow-up Consultation'
                }],
                specialty: [{
                    coding: [{
                        system: 'http://snomed.info/sct',
                        code: '394579002',
                        display: 'Cardiology'
                    }]
                }],
                description: 'Cardiology follow-up',
                start: nextWeek.toISOString(),
                end: new Date(nextWeek.getTime() + 45 * 60000).toISOString(), // 45 minutes
                minutesDuration: 45,
                participant: [
                    {
                        actor: {
                            reference: 'Patient/patient-002',
                            display: 'Jane Smith'
                        },
                        required: 'required',
                        status: 'needs-action'
                    },
                    {
                        actor: {
                            reference: 'Practitioner/practitioner-002',
                            display: 'Dr. Michael Chen'
                        },
                        required: 'required',
                        status: 'tentative'
                    }
                ],
                priority: 3,
                reasonCode: [{
                    coding: [{
                        system: 'http://snomed.info/sct',
                        code: '84114007',
                        display: 'Heart failure'
                    }]
                }],
                created: new Date().toISOString()
            }
        ];

        testAppointments.forEach(appointmentData => {
            const appointment = new Appointment(appointmentData);
            this.appointments.set(appointment.id, appointment);
        });
    }

    /**
     * Initialize available time slots for booking
     */
    initializeAvailableSlots() {
        const now = new Date();
        const slots = [];
        
        // Generate slots for next 14 days
        for (let i = 1; i <= 14; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() + i);
            
            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            
            // Generate morning slots (9 AM - 12 PM)
            for (let hour = 9; hour < 12; hour++) {
                for (let minute = 0; minute < 60; minute += 30) {
                    const slotStart = new Date(date);
                    slotStart.setHours(hour, minute, 0, 0);
                    
                    const slotEnd = new Date(slotStart);
                    slotEnd.setMinutes(slotEnd.getMinutes() + 30);
                    
                    slots.push({
                        id: `slot-${slotStart.getTime()}`,
                        start: slotStart.toISOString(),
                        end: slotEnd.toISOString(),
                        practitioner: 'Practitioner/practitioner-001',
                        available: true
                    });
                }
            }
            
            // Generate afternoon slots (2 PM - 5 PM)
            for (let hour = 14; hour < 17; hour++) {
                for (let minute = 0; minute < 60; minute += 30) {
                    const slotStart = new Date(date);
                    slotStart.setHours(hour, minute, 0, 0);
                    
                    const slotEnd = new Date(slotStart);
                    slotEnd.setMinutes(slotEnd.getMinutes() + 30);
                    
                    slots.push({
                        id: `slot-${slotStart.getTime()}`,
                        start: slotStart.toISOString(),
                        end: slotEnd.toISOString(),
                        practitioner: 'Practitioner/practitioner-002',
                        available: true
                    });
                }
            }
        }
        
        slots.forEach(slot => {
            this.availableSlots.set(slot.id, slot);
        });
    }

    /**
     * Create a new appointment
     * @param {Object} appointmentData - FHIR Appointment resource data
     * @returns {Promise<Appointment>} Created appointment
     */
    async create(appointmentData) {
        try {
            const appointment = new Appointment(appointmentData);
            const validation = appointment.validate();
            
            if (!validation.isValid) {
                throw new Error(`Appointment validation failed: ${validation.errors.join(', ')}`);
            }
            
            // Check for scheduling conflicts
            const conflict = this.checkForConflicts(appointment);
            if (conflict) {
                throw new Error(`Scheduling conflict detected: ${conflict}`);
            }
            
            // Mark slots as unavailable if appointment is booked
            if (appointment.status === 'booked') {
                this.markSlotsUnavailable(appointment.start, appointment.end);
            }
            
            this.appointments.set(appointment.id, appointment);
            return appointment;
        } catch (error) {
            throw new Error(`Failed to create appointment: ${error.message}`);
        }
    }

    /**
     * Read an appointment by ID
     * @param {string} id - Appointment ID
     * @returns {Promise<Appointment|null>} Appointment or null if not found
     */
    async read(id) {
        return this.appointments.get(id) || null;
    }

    /**
     * Update an existing appointment
     * @param {string} id - Appointment ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Appointment>} Updated appointment
     */
    async update(id, updateData) {
        try {
            const existingAppointment = this.appointments.get(id);
            if (!existingAppointment) {
                throw new Error('Appointment not found');
            }
            
            // Check for conflicts if time is being changed
            if (updateData.start || updateData.end) {
                const tempAppointment = new Appointment({ 
                    ...existingAppointment.toJSON(), 
                    ...updateData 
                });
                const conflict = this.checkForConflicts(tempAppointment, id);
                if (conflict) {
                    throw new Error(`Scheduling conflict detected: ${conflict}`);
                }
            }
            
            const updatedAppointment = existingAppointment.update(updateData);
            const validation = updatedAppointment.validate();
            
            if (!validation.isValid) {
                throw new Error(`Appointment validation failed: ${validation.errors.join(', ')}`);
            }
            
            this.appointments.set(id, updatedAppointment);
            return updatedAppointment;
        } catch (error) {
            throw new Error(`Failed to update appointment: ${error.message}`);
        }
    }

    /**
     * Delete an appointment
     * @param {string} id - Appointment ID
     * @returns {Promise<boolean>} True if deleted, false if not found
     */
    async delete(id) {
        const appointment = this.appointments.get(id);
        if (appointment) {
            // Free up slots if appointment was booked
            if (appointment.status === 'booked') {
                this.markSlotsAvailable(appointment.start, appointment.end);
            }
        }
        return this.appointments.delete(id);
    }

    /**
     * Search appointments with optional filters
     * @param {Object} params - Search parameters
     * @returns {Promise<Object>} Search results with pagination
     */
    async search(params = {}) {
        let results = Array.from(this.appointments.values());
        
        // Filter by patient
        if (params.patient) {
            results = results.filter(appointment => 
                appointment.participant.some(p => 
                    p.actor && p.actor.reference === `Patient/${params.patient}`
                )
            );
        }
        
        // Filter by practitioner
        if (params.practitioner) {
            results = results.filter(appointment => 
                appointment.participant.some(p => 
                    p.actor && p.actor.reference === `Practitioner/${params.practitioner}`
                )
            );
        }
        
        // Filter by status
        if (params.status) {
            results = results.filter(appointment => appointment.status === params.status);
        }
        
        // Filter by date range
        if (params.date) {
            const searchDate = new Date(params.date);
            results = results.filter(appointment => {
                if (!appointment.start) return false;
                const appointmentDate = new Date(appointment.start);
                return appointmentDate.toDateString() === searchDate.toDateString();
            });
        }
        
        // Filter by service type
        if (params['service-type']) {
            results = results.filter(appointment => 
                appointment.serviceType.some(st => 
                    st.text && st.text.toLowerCase().includes(params['service-type'].toLowerCase())
                )
            );
        }
        
        // Sort by start time
        results.sort((a, b) => {
            if (!a.start && !b.start) return 0;
            if (!a.start) return 1;
            if (!b.start) return -1;
            return new Date(a.start) - new Date(b.start);
        });
        
        // Pagination
        const offset = parseInt(params._offset) || 0;
        const count = parseInt(params._count) || 20;
        
        return {
            total: results.length,
            offset: offset,
            count: Math.min(count, results.length - offset),
            appointments: results.slice(offset, offset + count)
        };
    }

    /**
     * Get available slots for booking
     * @param {Object} params - Search parameters
     * @returns {Promise<Array>} Available slots
     */
    async getAvailableSlots(params = {}) {
        let slots = Array.from(this.availableSlots.values()).filter(slot => slot.available);
        
        // Filter by date range
        if (params.start) {
            const startDate = new Date(params.start);
            slots = slots.filter(slot => new Date(slot.start) >= startDate);
        }
        
        if (params.end) {
            const endDate = new Date(params.end);
            slots = slots.filter(slot => new Date(slot.end) <= endDate);
        }
        
        // Filter by practitioner
        if (params.practitioner) {
            slots = slots.filter(slot => slot.practitioner === `Practitioner/${params.practitioner}`);
        }
        
        // Only return future slots
        const now = new Date();
        slots = slots.filter(slot => new Date(slot.start) > now);
        
        // Sort by start time
        slots.sort((a, b) => new Date(a.start) - new Date(b.start));
        
        return slots.slice(0, 50); // Limit to 50 slots
    }

    /**
     * Book an appointment in real-time
     * @param {Object} bookingData - Booking request data
     * @returns {Promise<Appointment>} Booked appointment
     */
    async bookAppointment(bookingData) {
        const { patientId, practitionerId, slotId, serviceType, description, priority } = bookingData;
        
        // Check if slot is available
        const slot = this.availableSlots.get(slotId);
        if (!slot || !slot.available) {
            throw new Error('Selected time slot is no longer available');
        }
        
        // Create appointment
        const appointmentData = {
            status: 'booked',
            start: slot.start,
            end: slot.end,
            minutesDuration: 30,
            description: description || 'Appointment',
            priority: priority || 5,
            serviceType: serviceType ? [{ text: serviceType }] : [],
            participant: [
                {
                    actor: {
                        reference: `Patient/${patientId}`,
                        display: 'Patient'
                    },
                    required: 'required',
                    status: 'accepted'
                },
                {
                    actor: {
                        reference: `Practitioner/${practitionerId}`,
                        display: 'Healthcare Provider'
                    },
                    required: 'required',
                    status: 'accepted'
                }
            ]
        };
        
        const appointment = await this.create(appointmentData);
        
        // Mark slot as unavailable
        slot.available = false;
        
        return appointment;
    }

    /**
     * Cancel an appointment
     * @param {string} id - Appointment ID
     * @param {string} reason - Cancellation reason
     * @returns {Promise<Appointment>} Cancelled appointment
     */
    async cancelAppointment(id, reason = 'Patient cancelled') {
        const appointment = await this.read(id);
        if (!appointment) {
            throw new Error('Appointment not found');
        }
        
        // Update status to cancelled
        appointment.updateStatus('cancelled', reason);
        
        // Free up the time slot
        this.markSlotsAvailable(appointment.start, appointment.end);
        
        this.appointments.set(id, appointment);
        return appointment;
    }

    /**
     * Check for scheduling conflicts
     * @param {Appointment} appointment - Appointment to check
     * @param {string} excludeId - ID to exclude from conflict check
     * @returns {string|null} Conflict description or null
     */
    checkForConflicts(appointment, excludeId = null) {
        if (!appointment.start || !appointment.end) return null;
        
        const appointmentStart = new Date(appointment.start);
        const appointmentEnd = new Date(appointment.end);
        
        for (const [id, existingAppointment] of this.appointments) {
            if (id === excludeId) continue;
            if (existingAppointment.status === 'cancelled') continue;
            if (!existingAppointment.start || !existingAppointment.end) continue;
            
            const existingStart = new Date(existingAppointment.start);
            const existingEnd = new Date(existingAppointment.end);
            
            // Check for overlapping participants
            const hasCommonParticipant = appointment.participant.some(p1 =>
                existingAppointment.participant.some(p2 =>
                    p1.actor?.reference === p2.actor?.reference
                )
            );
            
            if (hasCommonParticipant) {
                // Check for time overlap
                if (appointmentStart < existingEnd && appointmentEnd > existingStart) {
                    return `Overlaps with existing appointment ${id}`;
                }
            }
        }
        
        return null;
    }

    /**
     * Mark time slots as unavailable
     * @param {string} start - Start time
     * @param {string} end - End time
     */
    markSlotsUnavailable(start, end) {
        const startTime = new Date(start);
        const endTime = new Date(end);
        
        for (const [id, slot] of this.availableSlots) {
            const slotStart = new Date(slot.start);
            const slotEnd = new Date(slot.end);
            
            // Mark slot as unavailable if it overlaps
            if (slotStart < endTime && slotEnd > startTime) {
                slot.available = false;
            }
        }
    }

    /**
     * Mark time slots as available
     * @param {string} start - Start time
     * @param {string} end - End time
     */
    markSlotsAvailable(start, end) {
        const startTime = new Date(start);
        const endTime = new Date(end);
        
        for (const [id, slot] of this.availableSlots) {
            const slotStart = new Date(slot.start);
            const slotEnd = new Date(slot.end);
            
            // Mark slot as available if it was in the time range
            if (slotStart >= startTime && slotEnd <= endTime) {
                slot.available = true;
            }
        }
    }

    /**
     * Get appointment count
     * @returns {number} Total number of appointments
     */
    getCount() {
        return this.appointments.size;
    }

    /**
     * Get today's appointments
     * @returns {Array<Appointment>} Today's appointments
     */
    getTodaysAppointments() {
        const today = new Date().toDateString();
        return Array.from(this.appointments.values()).filter(appointment => 
            appointment.start && new Date(appointment.start).toDateString() === today
        );
    }

    /**
     * Get upcoming appointments
     * @param {number} days - Number of days to look ahead
     * @returns {Array<Appointment>} Upcoming appointments
     */
    getUpcomingAppointments(days = 7) {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + days);
        
        return Array.from(this.appointments.values())
            .filter(appointment => {
                if (!appointment.start) return false;
                const appointmentDate = new Date(appointment.start);
                return appointmentDate >= now && appointmentDate <= futureDate;
            })
            .sort((a, b) => new Date(a.start) - new Date(b.start));
    }
}

module.exports = AppointmentService;