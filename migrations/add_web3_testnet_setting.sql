-- Thêm setting web3_testnet_mode nếu chưa có
INSERT INTO site_settings (setting_key, setting_value, setting_type, description, group_name)
VALUES ('web3_testnet_mode', '0', 'text', 'Chế độ Testnet cho thanh toán USDT (BSC Testnet)', 'payment') AS new_row
ON DUPLICATE KEY UPDATE description = new_row.description;
