-- Bảng NFT Chứng nhận sở hữu
CREATE TABLE IF NOT EXISTS nft_certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL,
    token_id INT NOT NULL,
    tx_hash VARCHAR(66) NULL,
    recipient_address VARCHAR(42) NOT NULL,
    chain_id INT DEFAULT 56 COMMENT '56=BSC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    UNIQUE KEY unique_order_nft (order_id),
    INDEX idx_order_id (order_id),
    INDEX idx_token_id (token_id),
    INDEX idx_recipient (recipient_address)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
