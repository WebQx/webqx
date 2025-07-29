<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LaravelSetupTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test that Laravel application is properly configured.
     */
    public function test_laravel_application_is_configured(): void
    {
        // Test that the application loads successfully
        $this->assertTrue(true); // Basic assertion

        // Test that config values are properly set
        $this->assertEquals('WebQx-Laravel-API', config('app.name'));
        $this->assertEquals('local', config('app.env'));
        $this->assertTrue(config('app.debug'));
        $this->assertEquals('http://localhost:8000', config('app.url'));
    }

    /**
     * Test that database connection works.
     */
    public function test_database_connection_works(): void
    {
        // Test that we can connect to the database
        $this->assertDatabaseCount('users', 0);
        
        // Test that we can create a user
        \App\Models\User::factory()->create([
            'email' => 'test@webqx.health'
        ]);
        
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseHas('users', [
            'email' => 'test@webqx.health'
        ]);
    }

    /**
     * Test that artisan commands work.
     */
    public function test_artisan_commands_work(): void
    {
        // Test that artisan commands can be executed
        $this->artisan('about')
            ->assertExitCode(0);
            
        $this->artisan('route:list')
            ->assertExitCode(0);
    }

    /**
     * Test the welcome route.
     */
    public function test_welcome_route_loads(): void
    {
        $response = $this->get('/');
        
        $response->assertStatus(200);
        $response->assertSee('Laravel');
    }
}