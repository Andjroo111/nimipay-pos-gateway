<?php
/**
 * Plugin Name: Nimipay for WooCommerce
 * Plugin URI: https://nimipay.com/woocommerce
 * Description: Accept cryptocurrency payments in your WooCommerce store using Nimipay
 * Version: 1.0.0
 * Author: Nimipay
 * Author URI: https://nimipay.com
 * Text Domain: wc-nimipay
 * Domain Path: /languages
 * Requires at least: 5.0
 * Requires PHP: 7.2
 * WC requires at least: 4.0
 * WC tested up to: 7.0
 */

defined('ABSPATH') || exit;

// Make sure WooCommerce is active
if (!in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins')))) {
    return;
}

/**
 * Initialize the gateway.
 */
function wc_nimipay_init() {
    if (!class_exists('WC_Payment_Gateway')) {
        return;
    }

    require_once(plugin_dir_path(__FILE__) . 'class-wc-nimipay-gateway.php');
    
    // Register the gateway with WooCommerce
    function add_nimipay_gateway($methods) {
        $methods[] = 'WC_Nimipay_Gateway';
        return $methods;
    }
    add_filter('woocommerce_payment_gateways', 'add_nimipay_gateway');

    // Load plugin text domain
    load_plugin_textdomain('wc-nimipay', false, dirname(plugin_basename(__FILE__)) . '/languages/');
}
add_action('plugins_loaded', 'wc_nimipay_init', 11);

/**
 * Add plugin action links.
 */
function wc_nimipay_plugin_links($links) {
    $plugin_links = array(
        '<a href="' . admin_url('admin.php?page=wc-settings&tab=checkout&section=nimipay') . '">' . __('Settings', 'wc-nimipay') . '</a>',
        '<a href="https://docs.nimipay.com/woocommerce">' . __('Documentation', 'wc-nimipay') . '</a>'
    );
    return array_merge($plugin_links, $links);
}
add_filter('plugin_action_links_' . plugin_basename(__FILE__), 'wc_nimipay_plugin_links');

/**
 * Plugin activation hook.
 */
function wc_nimipay_activate() {
    if (!class_exists('WooCommerce')) {
        deactivate_plugins(plugin_basename(__FILE__));
        wp_die(__('Please install and activate WooCommerce before activating Nimipay for WooCommerce.', 'wc-nimipay'));
    }

    // Create required directories
    $upload_dir = wp_upload_dir();
    $nimipay_dir = $upload_dir['basedir'] . '/nimipay-logs';
    
    if (!file_exists($nimipay_dir)) {
        wp_mkdir_p($nimipay_dir);
    }

    // Add custom capabilities
    $role = get_role('administrator');
    if ($role) {
        $role->add_cap('manage_nimipay_settings');
    }
}
register_activation_hook(__FILE__, 'wc_nimipay_activate');

/**
 * Plugin deactivation hook.
 */
function wc_nimipay_deactivate() {
    // Clean up capabilities
    $role = get_role('administrator');
    if ($role) {
        $role->remove_cap('manage_nimipay_settings');
    }
}
register_deactivation_hook(__FILE__, 'wc_nimipay_deactivate');

/**
 * Add Nimipay scripts and styles.
 */
function wc_nimipay_enqueue_scripts() {
    if (is_checkout()) {
        wp_enqueue_style('nimipay-checkout', plugins_url('assets/css/nimipay.css', __FILE__));
        wp_enqueue_script('nimipay-checkout', plugins_url('assets/js/nimipay.js', __FILE__), array('jquery'), '1.0.0', true);
        
        wp_localize_script('nimipay-checkout', 'nimipayParams', array(
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('nimipay-nonce')
        ));
    }
}
add_action('wp_enqueue_scripts', 'wc_nimipay_enqueue_scripts');

/**
 * Initialize logging.
 */
function wc_nimipay_init_log() {
    if (!class_exists('WC_Logger')) {
        return;
    }
    
    if (!function_exists('wc_get_logger')) {
        return;
    }
    
    // Create a custom logger instance
    global $nimipay_log;
    $nimipay_log = wc_get_logger();
}
add_action('init', 'wc_nimipay_init_log');

/**
 * Log helper function.
 */
function wc_nimipay_log($message, $level = 'info') {
    global $nimipay_log;
    
    if (!isset($nimipay_log)) {
        return;
    }
    
    $context = array('source' => 'nimipay');
    
    switch ($level) {
        case 'error':
            $nimipay_log->error($message, $context);
            break;
        case 'warning':
            $nimipay_log->warning($message, $context);
            break;
        case 'info':
        default:
            $nimipay_log->info($message, $context);
            break;
    }
}
