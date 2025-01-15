<?php
/**
 * Class WC_Nimipay_Gateway_Test
 *
 * @package Nimipay/Tests
 */

class WC_Nimipay_Gateway_Test extends WP_UnitTestCase {
    private $gateway;

    public function setUp(): void {
        parent::setUp();
        
        // Load WC_Payment_Gateway if not loaded
        if (!class_exists('WC_Payment_Gateway')) {
            require_once WC_ABSPATH . 'includes/abstracts/abstract-wc-payment-gateway.php';
        }
        
        // Load our gateway class
        require_once dirname(dirname(dirname(__FILE__))) . '/class-wc-nimipay-gateway.php';
        
        $this->gateway = new WC_Nimipay_Gateway();
    }

    public function test_gateway_initialization() {
        $this->assertEquals('nimipay', $this->gateway->id);
        $this->assertTrue($this->gateway->has_fields);
        $this->assertEquals('Nimipay', $this->gateway->method_title);
        $this->assertNotEmpty($this->gateway->method_description);
    }

    public function test_default_settings() {
        $this->gateway->init_form_fields();
        $this->gateway->init_settings();

        $this->assertArrayHasKey('enabled', $this->gateway->settings);
        $this->assertArrayHasKey('title', $this->gateway->settings);
        $this->assertArrayHasKey('description', $this->gateway->settings);
        $this->assertArrayHasKey('testmode', $this->gateway->settings);
        $this->assertArrayHasKey('api_key', $this->gateway->settings);
        $this->assertArrayHasKey('test_api_key', $this->gateway->settings);
    }

    public function test_process_payment() {
        // Create a test order
        $order = wc_create_order();
        $order->set_total(100);
        $order->save();

        // Mock API response
        add_filter('pre_http_request', function($preempt, $args, $url) {
            return array(
                'response' => array('code' => 200),
                'body' => json_encode(array(
                    'id' => 'test_payment_123',
                    'payment_url' => 'https://test.nimipay.com/pay/test_payment_123'
                ))
            );
        }, 10, 3);

        // Process payment
        $result = $this->gateway->process_payment($order->get_id());

        // Verify response
        $this->assertIsArray($result);
        $this->assertEquals('success', $result['result']);
        $this->assertStringContainsString('test.nimipay.com/pay/test_payment_123', $result['redirect']);

        // Verify order meta
        $payment_id = $order->get_meta('_nimipay_payment_id');
        $this->assertEquals('test_payment_123', $payment_id);
    }

    public function test_webhook_handling() {
        // Create test order
        $order = wc_create_order();
        $order->save();

        // Mock webhook data
        $webhook_data = array(
            'event' => 'payment.success',
            'order_id' => $order->get_id(),
            'payment_id' => 'test_payment_123'
        );

        // Set up request
        $_SERVER['HTTP_X_NIMIPAY_SIGNATURE'] = hash_hmac(
            'sha256',
            json_encode($webhook_data),
            $this->gateway->get_option('test_api_key')
        );

        // Capture output
        ob_start();
        try {
            $_POST = $webhook_data;
            $this->gateway->handle_webhook();
        } catch (WC_API_Exception $e) {
            // Handle expected exceptions
        }
        $output = ob_get_clean();

        // Refresh order
        $order = wc_get_order($order->get_id());

        // Verify order status
        $this->assertEquals('completed', $order->get_status());
        $this->assertStringContainsString('Webhook processed', $output);
    }

    public function test_failed_payment_webhook() {
        // Create test order
        $order = wc_create_order();
        $order->save();

        // Mock webhook data
        $webhook_data = array(
            'event' => 'payment.failed',
            'order_id' => $order->get_id(),
            'payment_id' => 'test_payment_123'
        );

        // Set up request
        $_SERVER['HTTP_X_NIMIPAY_SIGNATURE'] = hash_hmac(
            'sha256',
            json_encode($webhook_data),
            $this->gateway->get_option('test_api_key')
        );

        // Capture output
        ob_start();
        try {
            $_POST = $webhook_data;
            $this->gateway->handle_webhook();
        } catch (WC_API_Exception $e) {
            // Handle expected exceptions
        }
        $output = ob_get_clean();

        // Refresh order
        $order = wc_get_order($order->get_id());

        // Verify order status
        $this->assertEquals('failed', $order->get_status());
        $this->assertStringContainsString('Webhook processed', $output);
    }

    public function test_invalid_webhook_signature() {
        // Create test order
        $order = wc_create_order();
        $order->save();

        // Mock webhook data with invalid signature
        $webhook_data = array(
            'event' => 'payment.success',
            'order_id' => $order->get_id(),
            'payment_id' => 'test_payment_123'
        );

        $_SERVER['HTTP_X_NIMIPAY_SIGNATURE'] = 'invalid_signature';

        // Capture output and errors
        ob_start();
        try {
            $_POST = $webhook_data;
            $this->gateway->handle_webhook();
        } catch (WC_API_Exception $e) {
            $this->assertEquals(401, $e->getCode());
        }
        ob_get_clean();

        // Verify order status hasn't changed
        $order = wc_get_order($order->get_id());
        $this->assertEquals('pending', $order->get_status());
    }

    public function test_api_error_handling() {
        // Create test order
        $order = wc_create_order();
        $order->set_total(100);
        $order->save();

        // Mock failed API response
        add_filter('pre_http_request', function($preempt, $args, $url) {
            return array(
                'response' => array('code' => 400),
                'body' => json_encode(array(
                    'message' => 'Invalid request'
                ))
            );
        }, 10, 3);

        // Process payment
        $result = $this->gateway->process_payment($order->get_id());

        // Verify error handling
        $this->assertNull($result);
        $this->assertNotEmpty(wc_get_notices('error'));
    }

    public function tearDown(): void {
        parent::tearDown();
        // Clean up any test orders
        $orders = wc_get_orders(array('status' => 'any'));
        foreach ($orders as $order) {
            $order->delete(true);
        }
    }
}
