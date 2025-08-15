/**
 * Token-Based Rate Control Demo
 * Demonstrates the usage of premium user token management
 */

const { TokenBasedRateControl, RateControlMiddleware } = require('./auth/rateControl');

/**
 * Demonstration function showing token-based rate control behavior
 */
function manageRateControl(userType) {
    console.log(`\n=== Token-Based Rate Control Demo for ${userType} ===\n`);

    const tokenRateControl = new TokenBasedRateControl();
    const userId = `demo-${userType}-user`;

    if (userType === 'premium' || userType === 'premiumPlus') {
        console.log('🔹 Premium user detected - Using token-based rate control');
        
        // Allocate tokens
        const allocation = tokenRateControl.allocateTokens(userId, userType);
        console.log('✅ Token allocation result:', {
            success: allocation.success,
            maxTokens: allocation.bucket?.maxTokens,
            tokensAvailable: allocation.bucket?.tokensAvailable
        });

        // Simulate service access with token consumption
        console.log('\n📊 Simulating service access:');
        
        // Multiple service calls
        const serviceCalls = [
            { endpoint: '/api/consultation', cost: 5 },
            { endpoint: '/api/messages', cost: 2 },
            { endpoint: '/api/data-export', cost: 10 },
            { endpoint: '/api/simple-query', cost: 1 }
        ];

        serviceCalls.forEach((call, index) => {
            const result = tokenRateControl.consumeTokensOnServiceAccess(
                userId, 
                userType, 
                call.cost,
                { path: call.endpoint, method: 'POST' }
            );

            console.log(`${index + 1}. ${call.endpoint}:`);
            if (result.success) {
                console.log(`   ✅ Success - Consumed ${result.tokensConsumed} tokens, ${result.tokensRemaining} remaining`);
            } else {
                console.log(`   ❌ ${result.error} (${result.errorCode})`);
                console.log(`   📈 Available: ${result.tokensAvailable}, Requested: ${result.tokensRequested}`);
            }
        });

        // Show usage statistics
        const stats = tokenRateControl.getTokenUsageStats(userId);
        console.log('\n📈 Token Usage Statistics:');
        console.log(`   Total Consumed: ${stats.totalConsumed}`);
        console.log(`   Tokens Available: ${stats.tokensAvailable}`);
        console.log(`   Utilization Rate: ${stats.utilizationRate.toFixed(2)}%`);
        console.log(`   Next Refill: ${new Date(stats.nextRefillTime).toLocaleString()}`);

    } else {
        console.log('🔹 Regular user detected - Using standard rate limits');
        console.log('✅ Standard rate limiting applied (IP-based)');
        console.log('📊 Limited to 100 requests per 15-minute window');
    }

    // Clean up
    tokenRateControl.stopTokenRefillProcess();
    console.log('\n✨ Demo completed successfully!\n');
}

// Run demos for different user types
console.log('🚀 WebQx Token-Based Rate Control Demonstration\n');

// Premium user demo
manageRateControl('premium');

// Premium Plus user demo  
manageRateControl('premiumPlus');

// Regular user demo
manageRateControl('regular');

console.log('🎯 Key Benefits:');
console.log('  ✓ Optimized resource allocation for premium users');
console.log('  ✓ Enhanced service provisioning based on user tier');
console.log('  ✓ Flexible token costs per service endpoint');
console.log('  ✓ Automatic token refill with configurable rates');
console.log('  ✓ Comprehensive usage tracking and statistics');
console.log('  ✓ Graceful fallback to standard rate limiting');
console.log('  ✓ Admin controls for token management');