<?php

require_once 'meekrodb.2.3.class.php';
require_once 'nimipay_auth.php';
require_once __DIR__ . '/vendor/autoload.php';

use Nimipay\Services\PaymentProcessor;
use Nimipay\Services\PriceService;

$paymentProcessor = new PaymentProcessor();
$priceService = new PriceService();

// get vars from the frontend calls
$action = $_GET['action'];
$data = $_GET['data'];

// Handle price requests
if ($action == "getPrice") {
    $currency = $_GET['currency'];
    try {
        $price = $priceService->getCurrentPrice($currency);
        echo json_encode(['status' => 'success', 'rate' => $price['rate']]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
    }
    exit();
}

// when user logs into a wallet
if ($action == "sendUserAddress") {
    $data = json_decode($data, true);
    $address = $data["address"];
    $label = $data["label"];
    $date = date("Y-m-d H:i:s");

    $row = DB::queryFirstRow("SELECT * FROM nimipay_users WHERE address=%s LIMIT 1", $address);

    // if user doesn't exist
    if (!$row) {
        // create new user
        DB::insert('nimipay_users', array(
            'address' => $address,
            'label' => $label,
            'login_first' => $date,
            'login_last' => $date
        ));

        // create new invoice, write to db
        $id_invoice = uniqid();
        DB::insert('nimipay_invoices', array(
            'id_invoice' => $id_invoice,
            'type' => 'demo_invoice',
            'value_usd' => '0.01',
            'currency' => 'NIM',
            'value' => '0.01',
            'exchange_rate' => '1.0',
            'address' => $address
        ));

        $invoice = array(
            'id_invoice' => $id_invoice,
            'type' => 'demo_invoice',
            'value_usd' => '0.01',
            'currency' => 'NIM',
            'value' => '0.01',
            'address' => $address,
            'status' => ''
        );
        
        echo (json_encode([$invoice, 'initial']));
        exit();
    }
    // if user exists
    else {
        // update user metadata
        DB::update('nimipay_users', array(
            'label' => $label,
            'login_last' => $date
        ), "address=%s", $address);

        // get user invoices
        $invoices = DB::query("SELECT * FROM nimipay_invoices WHERE address=%s", $address);

        // get user items
        $items = [];
        foreach ($invoices as $invoice) {
            if ($invoice['status'] == "confirmed") {
                $item = DB::queryFirstRow("SELECT * FROM nimipay_items WHERE id_invoice=%s LIMIT 1", $invoice['id_invoice']);
                $items[] = $item;
            }
        }
        
        echo(json_encode([ $invoices, $items ]));
        exit();
    }
}

// when user adds a new item
if ($action == "npAddItem") {
    $data = json_decode($data, true);
    $address = $data["address"];
    $currency = $data["currency"] ?? 'NIM';

    try {
        // Get current price for the selected currency
        $price = $priceService->getCurrentPrice($currency);
        
        // Create new invoice
        $id_invoice = uniqid();
        DB::insert('nimipay_invoices', array(
            'id_invoice' => $id_invoice,
            'type' => 'fortune_cookie',
            'value_usd' => '0.01',
            'currency' => $currency,
            'value' => $priceService->convertAmount(0.01, $currency, true),
            'exchange_rate' => $price['rate'],
            'exchange_timestamp' => date('Y-m-d H:i:s', $price['timestamp']),
            'address' => $address
        ));

        echo $id_invoice;
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
    exit();
}

// when user pings the backend that the tx was sent
if ($action == 'sendTxHash') {
    $data = json_decode($data, true);

    $address = $data["address"];
    $id_invoice = $data["invoice"];
    $tx = $data["tx"];
    $currency = $data["currency"] ?? 'NIM';

    // update invoice db status
    DB::update('nimipay_invoices', array(
        'tx' => $tx,
        'currency' => $currency,
        'status' => 'pending'
    ), "id_invoice=%s", $id_invoice);

    echo('Invoice status updated');
    exit();
}

// when user pings the backend that the tx was confirmed
if ($action == 'validateTx') {
    $data = json_decode($data, true);

    $id_invoice = $data["id_invoice"];
    $tx = $data["tx"];
    $currency = $data["currency"] ?? 'NIM';

    try {
        // Get invoice details
        $invoice = DB::queryFirstRow("SELECT * FROM nimipay_invoices WHERE id_invoice=%s", $id_invoice);
        if (!$invoice) {
            throw new Exception("Invoice not found");
        }

        // Validate transaction
        $result = $paymentProcessor->validateTransaction(
            $currency,
            $tx,
            $invoice['address'],
            floatval($invoice['value'])
        );

        if ($result['status'] === 'pending') {
            echo "pending";
            exit();
        }

        if ($result['status'] === 'confirmed') {
            // Update invoice status
            DB::update('nimipay_invoices', array(
                'tx' => $tx,
                'status' => 'confirmed'
            ), "id_invoice=%s", $id_invoice);

            // Create item based on invoice type
            if ($invoice['type'] == 'demo_invoice') {
                $item = "Demo invoice. When paid, it created this demo item.";
                DB::insert('nimipay_items', array(
                    'id_invoice' => $id_invoice,
                    'type' => 'demo_invoice',
                    'content' => $item,
                ));
            }
            else if ($invoice['type'] == 'fortune_cookie') {
                $nimiqookie = makeCookie();
                DB::insert('nimipay_items', array(
                    'id_invoice' => $id_invoice,
                    'type' => 'fortune_cookie',
                    'content' => $nimiqookie,
                ));
            }

            // Get updated user data
            $invoices = DB::query("SELECT * FROM nimipay_invoices WHERE address=%s", $invoice['address']);
            $items = [];
            foreach ($invoices as $inv) {
                if ($inv['status'] == "confirmed") {
                    $item = DB::queryFirstRow("SELECT * FROM nimipay_items WHERE id_invoice=%s LIMIT 1", $inv['id_invoice']);
                    $items[] = $item;
                }
            }
            
            echo(json_encode([ $invoices, $items ]));
            exit();
        }
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
        exit();
    }
}

function makeCookie() {
    // define cookie messages
    $nimiqookies = array(
        "When in anger, sign the alphabet.",
        "The fortune you seek is in another cookie.",
        "About time I got out of that cookie.",
        "If a turtle doesn't have a shell, is it naked or homeless?",
        "If we are all worms, try to be a glow worm.",
        "Ignore the next cookie.",
        "The early bird gets the worm, but the second mouse gets the cheese.",
        "Help! I'm being held a prisoner in a Chinese bakery!",
        "A friend asks only for your time not your money.",
        "If you refuse to accept anything but the best, you very often get it.",
        "Your high-minded principles spell success.",
        "Hard work pays off in the future, laziness pays off now.",
        "People are naturally attracted to you.",
        "A chance meeting opens new doors to success and friendship.",
        "You learn from your mistakes... You will learn a lot today.",
        "Your shoes will make you happy today.",
        "The man or woman you desire feels the same about you.",
        "A dream you have will come true.",
        "Never give up. You're not a failure if you don't give up.",
        "You will become great if you believe in yourself.",
        "There is no greater pleasure than seeing your loved ones prosper.",
        "You will marry your lover.",
        "A very attractive person has a message for you.",
        "You already know the answer to the questions lingering inside your head.",
        "It is now, and in this world, that we must live.",
        "You can make your own happiness.",
        "The greatest risk is not taking one.",
        "Adversity is the parent of virtue.",
        "Serious trouble will bypass you.",
        "Now is the time to try something new.",
        "Wealth awaits you very soon.",
        "If you feel you are right, stand firmly by your convictions.",
        "If winter comes, can spring be far behind?",
        "Keep your eye out for someone special.",
        "You are very talented in many ways.",
        "A stranger, is a friend you have not spoken to yet.",
        "A new voyage will fill your life with untold memories.",
        "You will travel to many exotic places in your lifetime."
    );

    return $nimiqookies[array_rand($nimiqookies)];
}
