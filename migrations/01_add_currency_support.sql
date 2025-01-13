-- Add currency support to nimipay_invoices
ALTER TABLE `nimipay_invoices`
ADD COLUMN `currency` varchar(10) COLLATE utf8_bin NOT NULL DEFAULT 'NIM' AFTER `value`,
ADD COLUMN `value_usd` decimal(20,8) NOT NULL AFTER `value`,
ADD COLUMN `exchange_rate` decimal(20,8) NOT NULL AFTER `currency`,
ADD COLUMN `exchange_timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER `exchange_rate`;

-- Update existing records to set USD value based on stored value (assuming stored values are in USD)
UPDATE `nimipay_invoices` 
SET `value_usd` = CAST(`value` AS DECIMAL(20,8)),
    `exchange_rate` = 1.0,
    `exchange_timestamp` = NOW();

-- Add indexes for performance
ALTER TABLE `nimipay_invoices`
ADD INDEX `idx_currency` (`currency`),
ADD INDEX `idx_status_currency` (`status`, `currency`);

-- Modify value column to handle different decimal places
ALTER TABLE `nimipay_invoices`
MODIFY COLUMN `value` decimal(30,8) NOT NULL;
