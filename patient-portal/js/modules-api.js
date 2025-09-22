/**
 * WebQx Patient Portal - Module Cards API Integration
 */

class ModuleCardsAPI {
    constructor() {
        this.baseURL = 'https://webqx.github.io/webqx';
    }

    async openAppointments() {
    window.location.href = `${this.baseURL}/index.html#appt`;
    }

    async openMedicalRecords() {
    window.location.href = `${this.baseURL}/index.html#labs`;
    }

    async openPrescriptions() {
        // Route to patient portal prescriptions (production target TBD)
        window.location.href = `${this.baseURL}/patient-portal/`;
    }

    async openTelehealth() {
        window.location.href = `${this.baseURL}/telehealth/`;
    }

    async openMessages() {
        alert('Messages: 1 new message from Dr. Smith about lab results');
    }
}

window.moduleAPI = new ModuleCardsAPI();