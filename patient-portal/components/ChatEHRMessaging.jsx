/**
 * ChatEHR Messaging Component for Patient Portal
 * Secure messaging interface for patients to communicate with physicians via ChatEHR
 * Includes consultation requests and real-time messaging
 */

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const ChatEHRMessaging = ({ patientId, onError, onLoadingChange }) => {
    const [consultations, setConsultations] = useState([]);
    const [selectedConsultation, setSelectedConsultation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [specialties, setSpecialties] = useState([]);
    const [showNewConsultation, setShowNewConsultation] = useState(false);
    const [newConsultationForm, setNewConsultationForm] = useState({
        specialty: '',
        urgency: 'routine',
        description: ''
    });
    const messagesEndRef = useRef(null);

    // Polling interval for real-time messages
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
        if (selectedConsultation) {
            loadMessages(selectedConsultation.id);
            // Start polling for new messages
            const interval = setInterval(() => {
                loadMessages(selectedConsultation.id, true);
            }, 5000);
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
            // Load consultations and specialties in parallel
            const [consultationsRes, specialtiesRes] = await Promise.all([
                axios.get('/api/chatehr/consultations', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                }),
                axios.get('/api/chatehr/specialties', {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                })
            ]);

            if (consultationsRes.data.success) {
                setConsultations(consultationsRes.data.data);
            }

            if (specialtiesRes.data.success) {
                setSpecialties(specialtiesRes.data.data);
            }
        } catch (error) {
            console.error('Error loading initial data:', error);
            if (onError) onError(error);
        } finally {
            setLoading(false);
            if (onLoadingChange) onLoadingChange(false);
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

    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedConsultation || sending) return;

        setSending(true);
        try {
            const response = await axios.post('/api/chatehr/messages', {
                toId: selectedConsultation.physicianId,
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

    const createConsultation = async () => {
        if (!newConsultationForm.specialty || !newConsultationForm.description.trim()) {
            alert('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/api/chatehr/consultations', {
                patientId,
                specialty: newConsultationForm.specialty,
                urgency: newConsultationForm.urgency,
                description: newConsultationForm.description.trim()
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.data.success) {
                setShowNewConsultation(false);
                setNewConsultationForm({ specialty: '', urgency: 'routine', description: '' });
                // Reload consultations
                loadInitialData();
            }
        } catch (error) {
            console.error('Error creating consultation:', error);
            if (onError) onError(error);
        } finally {
            setLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const formatMessageTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: 'bg-yellow-100 text-yellow-800',
            assigned: 'bg-blue-100 text-blue-800',
            in_progress: 'bg-purple-100 text-purple-800',
            completed: 'bg-green-100 text-green-800',
            cancelled: 'bg-red-100 text-red-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    const getUrgencyColor = (urgency) => {
        const colors = {
            routine: 'text-green-600',
            urgent: 'text-yellow-600',
            emergency: 'text-red-600'
        };
        return colors[urgency] || 'text-gray-600';
    };

    if (loading && consultations.length === 0) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading consultations...</span>
            </div>
        );
    }

    return (
        <div className="h-full flex bg-white">
            {/* Consultations List */}
            <div className="w-1/3 border-r border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Consultations</h3>
                        <button
                            onClick={() => setShowNewConsultation(true)}
                            className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            New Request
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {consultations.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                            No consultations yet.
                            <br />
                            <button
                                onClick={() => setShowNewConsultation(true)}
                                className="mt-2 text-blue-600 hover:text-blue-800 underline"
                            >
                                Create your first consultation request
                            </button>
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
                                    <span className="font-medium text-gray-900 capitalize">
                                        {consultation.specialty.replace('_', ' ')}
                                    </span>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(consultation.status)}`}>
                                        {consultation.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                                    {consultation.description}
                                </p>
                                <div className="flex justify-between items-center text-xs text-gray-500">
                                    <span className={`font-medium ${getUrgencyColor(consultation.urgency)}`}>
                                        {consultation.urgency}
                                    </span>
                                    <span>{formatMessageTime(consultation.createdAt)}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <div className="w-2/3 flex flex-col">
                {selectedConsultation ? (
                    <>
                        {/* Messages Header */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h4 className="font-semibold text-gray-900 capitalize">
                                {selectedConsultation.specialty.replace('_', ' ')} Consultation
                            </h4>
                            <p className="text-sm text-gray-600 mt-1">{selectedConsultation.description}</p>
                            <div className="flex items-center mt-2 text-xs text-gray-500">
                                <span className={`font-medium ${getUrgencyColor(selectedConsultation.urgency)}`}>
                                    {selectedConsultation.urgency.toUpperCase()}
                                </span>
                                <span className="ml-4">
                                    Status: <span className="font-medium">{selectedConsultation.status.replace('_', ' ')}</span>
                                </span>
                                {selectedConsultation.physicianId && (
                                    <span className="ml-4">
                                        Physician: <span className="font-medium">Dr. {selectedConsultation.physicianId}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.length === 0 ? (
                                <div className="text-center text-gray-500 mt-8">
                                    No messages yet. Start the conversation by sending a message below.
                                </div>
                            ) : (
                                messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`flex ${message.fromId === patientId ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                                message.fromId === patientId
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-200 text-gray-900'
                                            }`}
                                        >
                                            <p className="text-sm">{message.content}</p>
                                            <p className={`text-xs mt-1 ${
                                                message.fromId === patientId ? 'text-blue-100' : 'text-gray-500'
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
                        <div className="p-4 border-t border-gray-200">
                            {selectedConsultation.status === 'completed' || selectedConsultation.status === 'cancelled' ? (
                                <div className="text-center text-gray-500 py-4">
                                    This consultation has been {selectedConsultation.status}. Messaging is no longer available.
                                </div>
                            ) : selectedConsultation.status === 'pending' && !selectedConsultation.physicianId ? (
                                <div className="text-center text-gray-500 py-4">
                                    Your consultation request is pending physician assignment. You'll be able to message once a physician is assigned.
                                </div>
                            ) : (
                                <div className="flex space-x-3">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                                        placeholder="Type your message..."
                                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        disabled={sending}
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={!newMessage.trim() || sending}
                                        className="bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {sending ? 'Sending...' : 'Send'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500">
                        Select a consultation to view messages
                    </div>
                )}
            </div>

            {/* New Consultation Modal */}
            {showNewConsultation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">New Consultation Request</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Medical Specialty *
                                </label>
                                <select
                                    value={newConsultationForm.specialty}
                                    onChange={(e) => setNewConsultationForm({ ...newConsultationForm, specialty: e.target.value })}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select a specialty</option>
                                    {specialties.map((specialty) => (
                                        <option key={specialty.code} value={specialty.code}>
                                            {specialty.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Urgency Level
                                </label>
                                <select
                                    value={newConsultationForm.urgency}
                                    onChange={(e) => setNewConsultationForm({ ...newConsultationForm, urgency: e.target.value })}
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="routine">Routine</option>
                                    <option value="urgent">Urgent</option>
                                    <option value="emergency">Emergency</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description *
                                </label>
                                <textarea
                                    value={newConsultationForm.description}
                                    onChange={(e) => setNewConsultationForm({ ...newConsultationForm, description: e.target.value })}
                                    rows={4}
                                    placeholder="Please describe your symptoms or concerns..."
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex space-x-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowNewConsultation(false);
                                    setNewConsultationForm({ specialty: '', urgency: 'routine', description: '' });
                                }}
                                className="flex-1 bg-gray-200 text-gray-900 px-4 py-2 rounded-md font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createConsultation}
                                disabled={loading}
                                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Creating...' : 'Create Request'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatEHRMessaging;