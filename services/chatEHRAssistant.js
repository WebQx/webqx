/**
 * ChatEHR Conversational Assistant
 * Lightweight intent router that answers natural language questions
 * by querying OpenEMR via FHIR R4 endpoints exposed at /fhir
 *
 * This does NOT call any external LLM by default. It uses simple
 * pattern matching and deterministic logic to keep PHI local.
 * You can optionally plug in an LLM by providing an adapter.
 */

const axios = require('axios');

class ChatEHRAssistant {
  constructor(opts = {}) {
    this.fhirBase = opts.fhirBase || process.env.FHIR_BASE_URL || 'http://localhost:3000/fhir';
    this.timeout = opts.timeout || 15000;
    this.http = axios.create({ baseURL: this.fhirBase, timeout: this.timeout, headers: { Accept: 'application/fhir+json' } });
    this.llm = opts.llm || null; // optional function: async (prompt, context) => string
  }

  // Entry point: interpret question and route to skill
  async ask({ userId, role = 'patient', question, context = {} }) {
    const q = (question || '').trim();
    if (!q) return this._ok('Please enter a question about your medical records.');

    // Quick intents
    if (/medication|prescription|rx/i.test(q)) return this.listMedications(userId, role);
    if (/allerg(y|ies)|allergic/i.test(q)) return this.listAllergies(userId, role);
    if (/(lab|test).*result/i.test(q)) return this.latestLabResults(userId, role);
    if (/appointment|schedule|upcoming/i.test(q)) return this.upcomingAppointments(userId, role);
    if (/immunization|vaccine/i.test(q)) return this.immunizations(userId, role);

    // Fallback to brief record summary
    if (/summary|overview|record/i.test(q)) return this.recordSummary(userId, role);

    // Optional LLM fallback if provided
    if (this.llm) {
      const rec = await this._gatherQuickContext(userId, role);
      const answer = await this.llm(q, rec);
      return this._ok(answer, { provenance: 'llm', context: rec });
    }

    // Default help
    return this._ok(
      'I can help with: medications, allergies, lab results, immunizations, and upcoming appointments. Try: "Show my latest lab results".'
    );
  }

  // Skills (FHIR R4 minimal queries)
  async listMedications(userId, role) {
    // MedicationStatement or MedicationRequest depending on deployment
    const url = '/MedicationRequest';
    const params = role === 'patient' ? { patient: userId, _count: 20, _sort: '-authoredon' } : { subject: userId, _count: 20 };
    const data = await this._fhirGet(url, params);
    const items = (data.entry || []).map(e => e.resource).map(r => ({
      name: r.medicationCodeableConcept?.text || r.medicationReference?.display || 'Medication',
      status: r.status,
      authoredOn: r.authoredOn
    }));
    if (items.length === 0) return this._ok('No medications found.');
    const lines = items.slice(0, 5).map(m => `• ${m.name} (${m.status || 'unknown'})`);
    return this._ok(`Here are your recent medications:\n${lines.join('\n')}`, { count: items.length, sample: items.slice(0, 5) });
  }

  async listAllergies(userId, role) {
    const url = '/AllergyIntolerance';
    const params = role === 'patient' ? { patient: userId, _count: 20 } : { patient: userId, _count: 20 };
    const data = await this._fhirGet(url, params);
    const items = (data.entry || []).map(e => e.resource).map(r => ({
      substance: r.code?.text || r.code?.coding?.[0]?.display || 'Unknown',
      criticality: r.criticality || 'unknown',
      clinicalStatus: r.clinicalStatus?.coding?.[0]?.code || 'unknown'
    }));
    if (items.length === 0) return this._ok('No allergies are recorded.');
    const lines = items.slice(0, 5).map(a => `• ${a.substance} (${a.clinicalStatus})`);
    return this._ok(`Allergy list:\n${lines.join('\n')}`, { count: items.length, sample: items.slice(0, 5) });
  }

  async latestLabResults(userId, role) {
    const url = '/Observation';
    const params = { patient: userId, category: 'laboratory', _sort: '-date', _count: 10 };
    const data = await this._fhirGet(url, params);
    const obs = (data.entry || []).map(e => e.resource);
    if (obs.length === 0) return this._ok('No recent lab results found.');
    const lines = obs.slice(0, 5).map(o => {
      const code = o.code?.text || o.code?.coding?.[0]?.display || 'Lab test';
      const val = o.valueQuantity ? `${o.valueQuantity.value} ${o.valueQuantity.unit || ''}`.trim() : (o.valueString || '');
      const when = o.effectiveDateTime || o.issued || o.meta?.lastUpdated || '';
      return `• ${code}${val ? ': ' + val : ''} ${when ? '(' + when.substring(0, 10) + ')' : ''}`;
    });
    return this._ok(`Latest lab results:\n${lines.join('\n')}`, { count: obs.length, sample: obs.slice(0, 5) });
  }

  async upcomingAppointments(userId, role) {
    const url = '/Appointment';
    const now = new Date().toISOString();
    const params = role === 'patient'
      ? { patient: userId, date: `ge${now}`, _sort: 'date', _count: 10 }
      : { actor: userId, date: `ge${now}`, _sort: 'date', _count: 10 };
    const data = await this._fhirGet(url, params);
    const appts = (data.entry || []).map(e => e.resource);
    if (appts.length === 0) return this._ok('No upcoming appointments found.');
    const lines = appts.slice(0, 5).map(a => `• ${a.start?.substring(0,16) || a.created?.substring(0,10)} — ${a.description || a.serviceType?.[0]?.text || 'Appointment'}`);
    return this._ok(`Your upcoming appointments:\n${lines.join('\n')}`, { count: appts.length, sample: appts.slice(0,5) });
  }

  async immunizations(userId, role) {
    const url = '/Immunization';
    const params = role === 'patient' ? { patient: userId, _count: 20 } : { patient: userId, _count: 20 };
    const data = await this._fhirGet(url, params);
    const items = (data.entry || []).map(e => e.resource).map(r => ({
      vaccine: r.vaccineCode?.text || r.vaccineCode?.coding?.[0]?.display || 'Vaccine',
      date: r.occurrenceDateTime || r.recorded,
      status: r.status
    }));
    if (items.length === 0) return this._ok('No immunizations are recorded.');
    const lines = items.slice(0, 5).map(v => `• ${v.vaccine} (${v.date?.substring(0,10) || ''})`);
    return this._ok(`Immunization history:\n${lines.join('\n')}`, { count: items.length, sample: items.slice(0,5) });
  }

  async recordSummary(userId, role) {
    const [allergies, meds, appts] = await Promise.all([
      this.listAllergies(userId, role),
      this.listMedications(userId, role),
      this.upcomingAppointments(userId, role)
    ]);
    const lines = [allergies.answer, meds.answer, appts.answer].map(s => s.split('\n')[0]);
    return this._ok(`Summary:\n- ${lines.join('\n- ')}`, { sections: { allergies, meds, appts } });
  }

  // Helpers
  async _fhirGet(path, params) {
    const resp = await this.http.get(path, { params });
    return resp.data || {};
  }

  async _gatherQuickContext(userId, role) {
    const [allergies, meds] = await Promise.all([
      this._fhirGet('/AllergyIntolerance', { patient: userId, _count: 10 }),
      this._fhirGet('/MedicationRequest', { patient: userId, _count: 10, _sort: '-authoredon' })
    ]);
    return { userId, role, allergies: allergies.entry || [], medications: meds.entry || [] };
  }

  _ok(answer, meta = {}) { return { success: true, answer, meta, timestamp: new Date().toISOString() }; }
}

module.exports = ChatEHRAssistant;
