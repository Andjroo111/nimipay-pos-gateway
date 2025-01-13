<?php
/**
 * Plugin Name: NimiPay Payment Gateway
 * Plugin URI: https://nimipay.com
 * Description: Multi-currency payment gateway supporting NIM, BTC, USDC, and UST
 * Version: 1.0.0
 * Author: NimiPay
 * Author URI: https://nimipay.com
 * Text Domain: nimipay-gateway
 * Domain Path: /languages
 * WC requires at least: 3.0.0
 * WC tested up to: 6.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

// Define plugin constants
define('NIMIPAY_VERSION', '1.0.0');
define('NIMIPAY_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('NIMIPAY_PLUGIN_URL', plugin_dir_url(__FILE__));

/**
 * Initialize the gateway
 */
function nimipay_init() {
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    }
    
    require_once NIMIPAY_PLUGIN_DIR . 'includes/class-nimipay-gateway.php';
    require_once NIMIPAY_PLUGIN_DIR . 'includes/class-nimipay-api.php';
}
add_action('plugins_loaded', 'nimipay_init');

/**
 * Add the gateway to WooCommerce
 */
function add_nimipay_gateway($methods) {
    $methods[] = 'WC_NimiPay_Gateway';
    return $methods;
}
add_filter('woocommerce_payment_gateways', 'add_nimipay_gateway');

/**
 * Add plugin settings link
 */
function nimipay_plugin_links($links) {
    $plugin_links = array(
        '<a href="' . admin_url('admin.php?page=wc-settings&tab=checkout&section=nimipay') . '">' . __('Settings', 'nimipay-gateway') . '</a>'
    );
    return array_merge($plugin_links, $links);
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'nimipay_plugin_links');

/**
 * Enqueue scripts and styles
 */
function nimipay_enqueue_scripts() {
    wp_enqueue_style('nimipay-styles', NIMIPAY_PLUGIN_URL . 'assets/css/nimipay.css', array(), NIMIPAY_VERSION);
    wp_enqueue_script('nimipay-scripts', NIMIPAY_PLUGIN_URL . 'assets/js/nimipay.js', array('jquery'), NIMIPAY_VERSION, true);
    
    wp_localize_script('nimipay-scripts', 'nimipayParams', array(
        'ajaxUrl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('nimipay-nonce')
    ));
}
add_action('wp_enqueue_scripts', 'nimipay_enqueue_scripts');

/**
 * Initialize gateway class
 */
class WC_NimiPay_Gateway extends WC_Payment_Gateway {
    public function __construct() {
        $this->id = 'nimipay';
        $this->icon = NIMIPAY_PLUGIN_URL . 'assets/images/icon.png';
        $this->has_fields = true;
        $this->method_title = __('NimiPay', 'nimipay-gateway');
        $this->method_description = __('Accept cryptocurrency payments with NimiPay', 'nimipay-gateway');
        
        // Load settings
        $this->init_form_fields();
        $this->init_settings();
        
        // Define properties
        $this->title = $this->get_option('title');
        $this->description = $this->get_option('description');
        $this->enabled = $this->get_option('enabled');
        $this->testmode = 'yes' === $this->get_option('testmode');
        $this->api_key = $this->testmode ? $this->get_option('test_api_key') : $this->get_option('api_key');
        
        // Actions
        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_api_nimipay', array($this, 'handle_webhook'));
    }
    
    /**
     * Initialize gateway settings form fields
     */
    public function init_form_fields() {
        $this->form_fields = array(
            'enabled' => array(
                'title' => __('Enable/Disable', 'nimipay-gateway'),
                'type' => 'checkbox',
                'label' => __('Enable NimiPay', 'nimipay-gateway'),
                'default' => 'no'
            ),
            'title' => array(
                'title' => __('Title', 'nimipay-gateway'),
                'type' => 'text',
                'description' => __('Payment method title that the customer will see.', 'nimipay-gateway'),
                'default' => __('Cryptocurrency', 'nimipay-gateway'),
                'desc_tip' => true
            ),
            'description' => array(
                'title' => __('Description', 'nimipay-gateway'),
                'type' => 'textarea',
                'description' => __('Payment method description that the customer will see.', 'nimipay-gateway'),
                'default' => __('Pay with cryptocurrency (BTC, USDC, UST)', 'nimipay-gateway'),
                'desc_tip' => true
            ),
            'testmode' => array(
                'title' => __('Test Mode', 'nimipay-gateway'),
                'type' => 'checkbox',
                'label' => __('Enable Test Mode', 'nimipay-gateway'),
                'default' => 'yes',
                'description' => __('Place the payment gateway in test mode.', 'nimipay-gateway')
            ),
            'api_key' => array(
                'title' => __('Live API Key', 'nimipay-gateway'),
                'type' => 'password',
                'description' => __('Your NimiPay API key for live transactions.', 'nimipay-gateway'),
                'default' => '',
                'desc_tip' => true
            ),
            'test_api_key' => array(
                'title' => __('Test API Key', 'nimipay-gateway'),
                'type' => 'password',
                'description' => __('Your NimiPay API key for test transactions.', 'nimipay-gateway'),
                'default' => '',
                'desc_tip' => true
            ),
            'supported_currencies' => array(
                'title' => __('Supported Currencies', 'nimipay-gateway'),
                'type' => 'multiselect',
                'description' => __('Select which cryptocurrencies to accept.', 'nimipay-gateway'),
                'default' => array('BTC', 'USDC', 'UST'),
                'options' => array(
                    'BTC' => __('Bitcoin (BTC)', 'nimipay-gateway'),
                    'USDC' => __('USD Coin (USDC)', 'nimipay-gateway'),
                    'UST' => __('Terra USD (UST)', 'nimipay-gateway')
                )
            )
        );
    }
    
    /**
     * Process payment
     */
    public function process_payment($order_id) {
        global $woocommerce;
        $order = wc_get_order($order_id);
        
        try {
            // Initialize API
            $api = new NimiPay_API($this->api_key, $this->testmode);
            
            // Create payment
            $payment = $api->create_payment(array(
                'amount' => $order->get_total(),
                'currency' => $order->get_currency(),
                'order_id' => $order->get_id(),
                'callback_url' => $this->get_callback_url($order),
                'success_url' => $this->get_return_url($order),
                'cancel_url' => $order->get_cancel_order_url()
            ));
            
            // Save payment ID
            $order->update_meta_data('_nimipay_payment_id', $payment['id']);
            $order->save();
            
            // Return success and redirect
            return array(
                'result' => 'success',
                'redirect' => $payment['payment_url']
            );
            
        } catch (Exception $e) {
            wc_add_notice(__('Payment error:', 'nimipay-gateway') . ' ' . $e->getMessage(), 'error');
            return array('result' => 'fail');
        }
    }
    
    /**
     * Handle webhook
     */
    public function handle_webhook() {
        $payload = file_get_contents('php://input');
        $data = json_decode($payload, true);
        
        if (!$data) {
            status_header(400);
            exit('Invalid payload');
        }
        
        try {
            // Verify signature
            $signature = $_SERVER['HTTP_X_NIMIPAY_SIGNATURE'] ?? '';
            if (!$this->verify_signature($payload, $signature)) {
                throw new Exception('Invalid signature');
            }
            
            // Get order
            $order = wc_get_order($data['order_id']);
            if (!$order) {
                throw new Exception('Order not found');
            }
            
            // Update order status
            switch ($data['status']) {
                case 'completed':
                    $order->payment_complete($data['transaction_id']);
                    break;
                    
                case 'failed':
                    $order->update_status('failed', __('Payment failed', 'nimipay-gateway'));
                    break;
                    
                case 'pending':
                    $order->update_status('on-hold', __('Awaiting payment confirmation', 'nimipay-gateway'));
                    break;
            }
            
            status_header(200);
            exit('Webhook processed');
            
        } catch (Exception $e) {
            status_header(400);
            exit($e->getMessage());
        }
    }
    
    /**
     * Verify webhook signature
     */
    private function verify_signature($payload, $signature) {
        return hash_hmac('sha256', $payload, $this->api_key) === $signature;
    }
    
    /**
     * Get callback URL
     */
    private function get_callback_url($order) {
        return add_query_arg(array(
            'wc-api' => 'nimipay',
            'order_id' => $order->get_id()
        ), home_url('/'));
    }
}
