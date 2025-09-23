/**
 * RabbitMQ Messaging Service for WebQx EMR Platform
 * 
 * Implements real-time messaging backbone as specified in ROADMAP.md
 * Handles clinical events, telehealth sessions, and cross-module communication
 */

const amqp = require('amqplib');
const { v4: uuidv4 } = require('uuid');

class RabbitMQService {
    constructor(options = {}) {
        this.connectionUrl = options.connectionUrl || process.env.RABBITMQ_URL || 'amqp://localhost:5672';
        this.connection = null;
        this.channel = null;
        this.exchanges = {
            clinical: 'clinical.events',
            telehealth: 'telehealth.sessions',
            audit: 'audit.logs',
            notifications: 'notifications.user'
        };
        this.queues = {
            encounters: 'encounters.processing',
            orders: 'orders.processing', 
            results: 'results.processing',
            telehealth: 'telehealth.events',
            deadLetter: 'dead.letter'
        };
        this.isConnected = false;
    }

    /**
     * Initialize RabbitMQ connection and setup exchanges/queues
     */
    async initialize() {
        try {
            console.log('🐰 Connecting to RabbitMQ:', this.connectionUrl);
            
            this.connection = await amqp.connect(this.connectionUrl);
            this.channel = await this.connection.createChannel();
            
            // Handle connection events
            this.connection.on('error', this.handleConnectionError.bind(this));
            this.connection.on('close', this.handleConnectionClose.bind(this));
            
            // Setup exchanges
            await this.setupExchanges();
            
            // Setup queues
            await this.setupQueues();
            
            this.isConnected = true;
            console.log('✅ RabbitMQ initialized successfully');
            
        } catch (error) {
            console.error('❌ RabbitMQ initialization failed:', error);
            throw error;
        }
    }

    /**
     * Setup exchanges for different event types
     */
    async setupExchanges() {
        for (const [name, exchange] of Object.entries(this.exchanges)) {
            await this.channel.assertExchange(exchange, 'topic', {
                durable: true,
                autoDelete: false
            });
            console.log(`📡 Exchange created: ${exchange}`);
        }
    }

    /**
     * Setup queues with dead letter configuration
     */
    async setupQueues() {
        // Setup dead letter queue first
        await this.channel.assertQueue(this.queues.deadLetter, {
            durable: true,
            exclusive: false,
            autoDelete: false
        });

        // Setup main queues with dead letter routing
        for (const [name, queue] of Object.entries(this.queues)) {
            if (name === 'deadLetter') continue;
            
            await this.channel.assertQueue(queue, {
                durable: true,
                exclusive: false,
                autoDelete: false,
                arguments: {
                    'x-dead-letter-exchange': '',
                    'x-dead-letter-routing-key': this.queues.deadLetter,
                    'x-message-ttl': 24 * 60 * 60 * 1000 // 24 hours
                }
            });
            console.log(`📥 Queue created: ${queue}`);
        }
    }

    /**
     * Publish clinical event (encounters, orders, results)
     */
    async publishClinicalEvent(eventType, data, options = {}) {
        const routingKey = `clinical.${eventType}`;
        const message = {
            id: uuidv4(),
            type: eventType,
            timestamp: new Date().toISOString(),
            data,
            source: 'webqx-emr',
            ...options.metadata
        };

        return this.publish(this.exchanges.clinical, routingKey, message, options);
    }

    /**
     * Publish telehealth session event
     */
    async publishTelehealthEvent(sessionId, eventType, data, options = {}) {
        const routingKey = `telehealth.${eventType}`;
        const message = {
            id: uuidv4(),
            sessionId,
            type: eventType,
            timestamp: new Date().toISOString(),
            data,
            source: 'webqx-telehealth',
            ...options.metadata
        };

        return this.publish(this.exchanges.telehealth, routingKey, message, options);
    }

    /**
     * Publish audit log event
     */
    async publishAuditEvent(eventType, userId, data, options = {}) {
        const routingKey = `audit.${eventType}`;
        const message = {
            id: uuidv4(),
            type: eventType,
            userId,
            timestamp: new Date().toISOString(),
            data,
            source: 'webqx-platform',
            ...options.metadata
        };

        return this.publish(this.exchanges.audit, routingKey, message, options);
    }

    /**
     * Generic publish method
     */
    async publish(exchange, routingKey, message, options = {}) {
        if (!this.isConnected) {
            throw new Error('RabbitMQ not connected');
        }

        try {
            const buffer = Buffer.from(JSON.stringify(message));
            const publishOptions = {
                persistent: true,
                contentType: 'application/json',
                timestamp: Date.now(),
                messageId: message.id,
                ...options.publishOptions
            };

            const result = this.channel.publish(exchange, routingKey, buffer, publishOptions);
            
            if (!result) {
                throw new Error('Failed to publish message - channel write buffer full');
            }

            console.log(`📤 Published message: ${exchange}/${routingKey}`);
            return message.id;
            
        } catch (error) {
            console.error('❌ Failed to publish message:', error);
            throw error;
        }
    }

    /**
     * Subscribe to queue with message handler
     */
    async subscribe(queueName, handler, options = {}) {
        if (!this.isConnected) {
            throw new Error('RabbitMQ not connected');
        }

        const consumerOptions = {
            noAck: false,
            ...options.consumerOptions
        };

        await this.channel.consume(queueName, async (msg) => {
            if (!msg) return;

            try {
                const content = JSON.parse(msg.content.toString());
                await handler(content, msg);
                this.channel.ack(msg);
                
            } catch (error) {
                console.error(`❌ Error processing message from ${queueName}:`, error);
                
                // Reject message and send to dead letter queue
                this.channel.nack(msg, false, false);
            }
        }, consumerOptions);

        console.log(`👂 Subscribed to queue: ${queueName}`);
    }

    /**
     * Bind queue to exchange with routing pattern
     */
    async bindQueue(queueName, exchangeName, routingPattern) {
        await this.channel.bindQueue(queueName, exchangeName, routingPattern);
        console.log(`🔗 Bound ${queueName} to ${exchangeName} with pattern: ${routingPattern}`);
    }

    /**
     * Health check method
     */
    async healthCheck() {
        try {
            if (!this.isConnected || !this.channel) {
                return {
                    status: 'unhealthy',
                    error: 'Not connected to RabbitMQ'
                };
            }

            // Test channel by checking queue
            await this.channel.checkQueue(this.queues.encounters);
            
            return {
                status: 'healthy',
                exchanges: Object.keys(this.exchanges).length,
                queues: Object.keys(this.queues).length,
                connected: this.isConnected
            };
            
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message
            };
        }
    }

    /**
     * Handle connection errors
     */
    handleConnectionError(error) {
        console.error('🚨 RabbitMQ connection error:', error);
        this.isConnected = false;
    }

    /**
     * Handle connection close
     */
    handleConnectionClose() {
        console.warn('⚠️ RabbitMQ connection closed');
        this.isConnected = false;
        
        // Attempt reconnection
        setTimeout(() => {
            console.log('🔄 Attempting to reconnect to RabbitMQ...');
            this.initialize().catch(console.error);
        }, 5000);
    }

    /**
     * Graceful shutdown
     */
    async close() {
        try {
            if (this.channel) {
                await this.channel.close();
            }
            if (this.connection) {
                await this.connection.close();
            }
            this.isConnected = false;
            console.log('👋 RabbitMQ connection closed');
            
        } catch (error) {
            console.error('❌ Error closing RabbitMQ connection:', error);
        }
    }
}

module.exports = RabbitMQService;