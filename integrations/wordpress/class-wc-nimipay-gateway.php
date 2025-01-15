<?php
if (!defined('ABSPATH')) {
    exit; // Exit if accessed directly
}

/**
 * WooCommerce Nimipay Payment Gateway
 *
 * @class WC_Nimipay_Gateway
 * @extends WC_Payment_Gateway
 */
class WC_Nimipay_Gateway extends WC_Payment_Gateway {
    /**
     * Constructor for the gateway.
     */
    public function __construct() {
        $this->id                 = 'nimipay';
        $this->icon               = apply_filters('woocommerce_nimipay_icon', '');
        $this->has_fields         = true;
        $this->method_title       = __('Nimipay', 'wc-nimipay');
        $this->method_description = __('Accept cryptocurrency payments through Nimipay.', 'wc-nimipay');

        // Load the settings
        $this->init_form_fields();
        $this->init_settings();

        // Define user facing fields
        $this->title        = $this->get_option('title');
        $this->description  = $this->get_option('description');
        $this->enabled      = $this->get_option('enabled');
        $this->testmode     = 'yes' === $this->get_option('testmode');
        $this->api_key      = $this->testmode ? $this->get_option('test_api_key') : $this->get_option('api_key');

        // Actions
        add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
        add_action('woocommerce_api_wc_nimipay_gateway', array($this, 'handle_webhook'));
    }

    /**
     * Initialize Gateway Settings Form Fields
     */
    public function init_form_fields() {
        $this->form_fields = array(
            'enabled' => array(
                'title'   => __('Enable/Disable', 'wc-nimipay'),
                'type'    => 'checkbox',
                'label'   => __('Enable Nimipay Payment', 'wc-nimipay'),
                'default' => 'no'
            ),
            'title' => array(
                'title'       => __('Title', 'wc-nimipay'),
                'type'        => 'text',
                'description' => __('This controls the title which the user sees during checkout.', 'wc-nimipay'),
                'default'     => __('Cryptocurrency Payment (Nimipay)', 'wc-nimipay'),
                'desc_tip'    => true,
            ),
            'description' => array(
                'title'       => __('Description', 'wc-nimipay'),
                'type'        => 'textarea',
                'description' => __('Payment method description that the customer will see on your checkout.', 'wc-nimipay'),
                'default'     => __('Pay securely with cryptocurrency through Nimipay.', 'wc-nimipay'),
                'desc_tip'    => true,
            ),
            'testmode' => array(
                'title'       => __('Test mode', 'wc-nimipay'),
                'type'        => 'checkbox',
                'label'       => __('Enable Test Mode', 'wc-nimipay'),
                'default'     => 'yes',
                'description' => __('Place the payment gateway in test mode.', 'wc-nimipay'),
            ),
            'api_key' => array(
                'title'       => __('Live API Key', 'wc-nimipay'),
                'type'        => 'password',
                'description' => __('Enter your Nimipay Live API Key.', 'wc-nimipay'),
                'default'     => '',
                'desc_tip'    => true,
            ),
            'test_api_key' => array(
                'title'       => __('Test API Key', 'wc-nimipay'),
                'type'        => 'password',
                'description' => __('Enter your Nimipay Test API Key.', 'wc-nimipay'),
                'default'     => '',
                'desc_tip'    => true,
            ),
        );
    }

    /**
     * Process the payment
     */
    public function process_payment($order_id) {
        global $woocommerce;
        $order = wc_get_order($order_id);

        // Initialize Nimipay API
        require_once(dirname(__FILE__) . '/includes/class-nimipay-api.php');
        $api = new Nimipay_API($this->api_key, $this->testmode);

        try {
            $payment = $api->create_payment([
                'amount'      => $order->get_total(),
                'currency'    => get_woocommerce_currency(),
                'order_id'    => $order->get_id(),
                'return_url'  => $this->get_return_url($order),
                'cancel_url'  => $order->get_cancel_order_url(),
                'webhook_url' => WC()->api_request_url('WC_Nimipay_Gateway'),
            ]);

            // Store payment ID
            $order->update_meta_data('_nimipay_payment_id', $payment['id']);
            $order->save();

            // Return success and redirect to payment page
            return array(
                'result'   => 'success',
                'redirect' => $payment['payment_url'],
            );
        } catch (Exception $e) {
            wc_add_notice(__('Payment error:', 'wc-nimipay') . ' ' . $e->getMessage(), 'error');
            return;
        }
    }

    /**
     * Handle webhooks
     */
    public function handle_webhook() {
        $payload = file_get_contents('php://input');
        $data    = json_decode($payload, true);

        if (!$data) {
            status_header(400);
            exit('Invalid webhook payload');
        }

        require_once(dirname(__FILE__) . '/includes/class-nimipay-api.php');
        $api = new Nimipay_API($this->api_key, $this->testmode);

        try {
            if ($api->verify_webhook($payload, $_SERVER['HTTP_X_NIMIPAY_SIGNATURE'])) {
                $order = wc_get_order($data['order_id']);
                
                if (!$order) {
                    status_header(404);
                    exit('Order not found');
                }

                switch ($data['event']) {
                    case 'payment.success':
                        $order->payment_complete($data['payment_id']);
                        $order->add_order_note(__('Nimipay payment completed', 'wc-nimipay'));
                        break;
                    case 'payment.failed':
                        $order->update_status('failed', __('Nimipay payment failed', 'wc-nimipay'));
                        break;
                }

                status_header(200);
                exit('Webhook processed successfully');
            }
        } catch (Exception $e) {
            status_header(500);
            exit($e->getMessage());
        }
    }
}
