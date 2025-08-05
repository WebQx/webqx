/**
 * ChatEHR Physician Dashboard Component
 * Physician interface for managing consultation requests, appointments, and patient messaging
 * Includes real-time notifications and patient communication
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ChatEHRPhysicianDashboard = ({ physicianId, onError, onLoadingChange }) => {
    const [activeTab, setActiveTab] = useState('consultations');
    const [consultations, setConsultations] = useState([]);
    const [appointments, setAppointments] = useState([]);
    const [selectedConsultation, setSelectedConsultation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [filters, setFilters] = useState({
        status: 'all',
        specialty: 'all',
        urgency: 'all'
    });
    const messagesEndRef = useRef(null);
    const [pollingInterval, setPollingInterval] = useState(null);

    useEffect(() => {
        loadInitialData();
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };
    }, []);

    useEffect(() => {
        loadFilteredData();
    }, [filters, activeTab]);

    useEffect(() => {
        if (selectedConsultation) {
            loadMessages(selectedConsultation.id);
            // Start polling for new messages
            const interval = setInterval(() => {
                loadMessages(selectedConsultation.id, true);
            }, 3000);
            setPollingInterval(interval);
        } else {
            if (pollingInterval) {
                clearInterval(pollingInterval);
                setPollingInterval(null);
            }
        }
    }, [selectedConsultation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadInitialData = async () => {
        setLoading(true);
        if (onLoadingChange) onLoadingChange(true);

        try {
            await Promise.all([
                loadConsultations(),
                loadAppointments()
            ]);
        } catch (error) {
            console.error('Error loading initial data:', error);
            if (onError) onError(error);
        } finally {
            setLoading(false);
            if (onLoadingChange) onLoadingChange(false);
        }
    };

    const loadFilteredData = async () => {
        if (activeTab === 'consultations') {
            await loadConsultations();
        } else if (activeTab === 'appointments') {
            await loadAppointments();
        }
    };

    const loadConsultations = async () => {
        try {
            const params = {
                status: filters.status !== 'all' ? filters.status : undefined,
                specialty: filters.specialty !== 'all' ? filters.specialty : undefined,
                urgency: filters.urgency !== 'all' ? filters.urgency : undefined
            };

            const response = await axios.get('/api/chatehr/consultations', {
                params,
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.data.success) {
                setConsultations(response.data.data);
            }
        } catch (error) {
            console.error('Error loading consultations:', error);
            if (onError) onError(error);
        }
    };

    const loadAppointments = async () => {
        try {
            const response = await axios.get('/api/chatehr/appointments', {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.data.success) {
                setAppointments(response.data.data);
            }
        } catch (error) {
            console.error('Error loading appointments:', error);
            if (onError) onError(error);
        }
    };

    const loadMessages = async (consultationId, silent = false) => {
        if (!silent) setLoading(true);

        try {
            const response = await axios.get(`/api/chatehr/messages/${consultationId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.data.success) {
                setMessages(response.data.data);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            if (onError && !silent) onError(error);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const updateConsultationStatus = async (consultationId, status, notes = '') => {
        try {
            const response = await axios.put(`/api/chatehr/consultations/${consultationId}`, {
                status,
                physicianId: status === 'assigned' ? physicianId : undefined,
                notes
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.data.success) {
                // Reload consultations to reflect changes
                await loadConsultations();
                
                // Update selected consultation if it's the one being updated
                if (selectedConsultation?.id === consultationId) {
                    setSelectedConsultation(response.data.data);
                }
            }
        } catch (error) {
            console.error('Error updating consultation status:', error);
            if (onError) onError(error);
        }
    };

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedConsultation || sending) return;

        setSending(true);
        try {
            const response = await axios.post('/api/chatehr/messages', {
                toId: selectedConsultation.patientId,
                content: newMessage.trim(),
                consultationId: selectedConsultation.id,
                type: 'text'
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.data.success) {
                setNewMessage('');
                // Reload messages to show the new message
                loadMessages(selectedConsultation.id, true);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            if (onError) onError(error);
        } finally {
            setSending(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const formatDateTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleString();
    };

    const formatMessageTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return date.toLocaleDateString();
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            assigned: 'bg-blue-100 text-blue-800 border-blue-200',
            in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
            completed: 'bg-green-100 text-green-800 border-green-200',
            cancelled: 'bg-red-100 text-red-800 border-red-200'
        };
        return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
    };

    const getUrgencyColor = (urgency) => {
        const colors = {
            routine: 'text-green-600 bg-green-50',
            urgent: 'text-yellow-600 bg-yellow-50',
            emergency: 'text-red-600 bg-red-50'
        };
        return colors[urgency] || 'text-gray-600 bg-gray-50';
    };

    const getPendingConsultationsCount = () => {
        return consultations.filter(c => c.status === 'pending').length;
    };

    const getMyConsultationsCount = () => {
        return consultations.filter(c => c.physicianId === physicianId).length;
    };

    if (loading && consultations.length === 0 && appointments.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading dashboard...</span>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-gray-200 p-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-900">ChatEHR Physician Dashboard</h2>
                    <div className="flex space-x-4 text-sm">
                        <div className="flex items-center">
                            <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
                            <span>{getPendingConsultationsCount()} Pending Requests</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-3 h-3 bg-blue-400 rounded-full mr-2"></div>
                            <span>{getMyConsultationsCount()} My Consultations</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 mt-4">
                    <button
                        onClick={() => setActiveTab('consultations')}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${
                            activeTab === 'consultations'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        Consultation Requests
                    </button>
                    <button
                        onClick={() => setActiveTab('appointments')}
                        className={`px-4 py-2 rounded-md text-sm font-medium ${
                            activeTab === 'appointments'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        Appointments
                    </button>
                </div>
            </div>

            {/* Filters */}
            {activeTab === 'consultations' && (
                <div className="bg-white border-b border-gray-200 p-4">
                    <div className="flex space-x-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="assigned">Assigned</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Urgency</label>
                            <select
                                value={filters.urgency}
                                onChange={(e) => setFilters({ ...filters, urgency: e.target.value })}
                                className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                                <option value="all">All Urgencies</option>
                                <option value="routine">Routine</option>
                                <option value="urgent">Urgent</option>
                                <option value="emergency">Emergency</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 flex">
                {activeTab === 'consultations' && (
                    <>
                        {/* Consultations List */}
                        <div className="w-1/2 bg-white border-r border-gray-200 overflow-y-auto">
                            {consultations.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    No consultation requests found.
                                </div>
                            ) : (
                                consultations.map((consultation) => (
                                    <div
                                        key={consultation.id}
                                        onClick={() => setSelectedConsultation(consultation)}
                                        className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                                            selectedConsultation?.id === consultation.id ? 'bg-blue-50 border-blue-200' : ''
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-medium text-gray-900 capitalize">
                                                    {consultation.specialty.replace('_', ' ')}
                                                </span>
                                                <div className={`inline-block ml-2 px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(consultation.urgency)}`}>
                                                    {consultation.urgency.toUpperCase()}
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(consultation.status)}`}>
                                                {consultation.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                            {consultation.description}
                                        </p>
                                        <div className="flex justify-between items-center text-xs text-gray-500">
                                            <span>Patient ID: {consultation.patientId}</span>
                                            <span>{formatMessageTime(consultation.createdAt)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Consultation Details */}
                        <div className="w-1/2 bg-white flex flex-col">
                            {selectedConsultation ? (
                                <>
                                    {/* Consultation Header */}
                                    <div className="p-4 border-b border-gray-200">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900 capitalize">
                                                    {selectedConsultation.specialty.replace('_', ' ')} Consultation
                                                </h3>
                                                <p className="text-sm text-gray-600 mt-1">
                                                    Patient ID: {selectedConsultation.patientId}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Created: {formatDateTime(selectedConsultation.createdAt)}
                                                </p>
                                            </div>
                                            <div className="flex flex-col space-y-2">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedConsultation.status)}`}>
                                                    {selectedConsultation.status.replace('_', ' ')}
                                                </span>
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getUrgencyColor(selectedConsultation.urgency)}`}>
                                                    {selectedConsultation.urgency.toUpperCase()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mb-4">
                                            <h4 className="font-medium text-gray-900 mb-2">Description:</h4>
                                            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
                                                {selectedConsultation.description}
                                            </p>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex space-x-2">
                                            {selectedConsultation.status === 'pending' && (
                                                <button
                                                    onClick={() => updateConsultationStatus(selectedConsultation.id, 'assigned')}
                                                    className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-700"
                                                >
                                                    Accept Consultation
                                                </button>
                                            )}
                                            {selectedConsultation.status === 'assigned' && (
                                                <button
                                                    onClick={() => updateConsultationStatus(selectedConsultation.id, 'in_progress')}
                                                    className="bg-purple-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-purple-700"
                                                >
                                                    Start Consultation
                                                </button>
                                            )}
                                            {selectedConsultation.status === 'in_progress' && (
                                                <button
                                                    onClick={() => updateConsultationStatus(selectedConsultation.id, 'completed')}
                                                    className="bg-green-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-green-700"
                                                >
                                                    Complete Consultation
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Messages Section */}
                                    <div className="flex-1 flex flex-col">
                                        <div className="p-3 bg-gray-50 border-b border-gray-200">
                                            <h4 className="font-medium text-gray-900">Patient Communication</h4>
                                        </div>

                                        {/* Messages List */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                            {messages.length === 0 ? (
                                                <div className="text-center text-gray-500">
                                                    No messages yet. Start the conversation with your patient.
                                                </div>
                                            ) : (
                                                messages.map((message) => (
                                                    <div
                                                        key={message.id}
                                                        className={`flex ${message.fromId === physicianId ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div
                                                            className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                                                                message.fromId === physicianId
                                                                    ? 'bg-blue-600 text-white'
                                                                    : 'bg-gray-200 text-gray-900'
                                                            }`}
                                                        >
                                                            <p className="text-sm">{message.content}</p>
                                                            <p className={`text-xs mt-1 ${
                                                                message.fromId === physicianId ? 'text-blue-100' : 'text-gray-500'
                                                            }`}>
                                                                {formatMessageTime(message.timestamp)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Message Input */}
                                        {selectedConsultation.status !== 'completed' && selectedConsultation.status !== 'cancelled' && (
                                            <div className="p-3 border-t border-gray-200 bg-gray-50">
                                                <div className="flex space-x-2">
                                                    <input
                                                        type="text"
                                                        value={newMessage}
                                                        onChange={(e) => setNewMessage(e.target.value)}
                                                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                                        placeholder="Type your message to the patient..."
                                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        disabled={sending}
                                                    />
                                                    <button
                                                        onClick={sendMessage}
                                                        disabled={!newMessage.trim() || sending}
                                                        className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {sending ? 'Sending...' : 'Send'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-500">
                                    Select a consultation to view details and communicate with the patient
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'appointments' && (
                    <div className="flex-1 bg-white">
                        <div className="p-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Appointments</h3>
                            {appointments.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    No upcoming appointments scheduled.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {appointments.map((appointment) => (
                                        <div key={appointment.id} className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-medium text-gray-900">
                                                        {formatDateTime(appointment.dateTime)}
                                                    </h4>
                                                    <p className="text-sm text-gray-600 mt-1">
                                                        Patient ID: {appointment.patientId}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        Duration: {appointment.duration} minutes
                                                    </p>
                                                    {appointment.notes && (
                                                        <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded">
                                                            {appointment.notes}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.status)}`}>
                                                    {appointment.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatEHRPhysicianDashboard;