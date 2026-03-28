# ============================================
# NFT CERTIFICATE - Chứng nhận sở hữu nội thất
# ERC-721 trên BSC
# ============================================

import os
from typing import Optional, Tuple

try:
    from web3 import Web3
    from web3.middleware import geth_poa_middleware
    WEB3_AVAILABLE = True
except ImportError:
    WEB3_AVAILABLE = False

# BSC Mainnet & Testnet
BSC_RPC = "https://bsc-dataseed1.binance.org"
BSC_TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545"
BSC_EXPLORER = "https://bscscan.com"
BSC_TESTNET_EXPLORER = "https://testnet.bscscan.com"

# ERC-721 ABI (minimal - mint, ownerOf, Transfer event)
NFT_ABI = [
    {
        "inputs": [{"name": "to", "type": "address"}],
        "name": "mint",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"name": "tokenId", "type": "uint256"}],
        "name": "ownerOf",
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "from", "type": "address"},
            {"indexed": True, "name": "to", "type": "address"},
            {"indexed": True, "name": "tokenId", "type": "uint256"}
        ],
        "name": "Transfer",
        "type": "event"
    }
]


def get_nft_config(chain_id=56):
    """Lấy cấu hình NFT từ env hoặc settings. chain_id 97 = BSC Testnet"""
    from db_helper import get_setting
    
    is_testnet = (chain_id == 97)
    contract_address = os.environ.get('NFT_CONTRACT_ADDRESS') or get_setting('nft_contract_address', '')
    if is_testnet:
        contract_address = os.environ.get('NFT_TESTNET_CONTRACT_ADDRESS') or get_setting('nft_testnet_contract_address', '') or contract_address
    private_key = os.environ.get('NFT_MINTER_PRIVATE_KEY') or get_setting('nft_minter_private_key', '')
    base_url = os.environ.get('SITE_URL') or get_setting('site_url', 'http://localhost:5000')
    enabled = str(os.environ.get('NFT_ENABLED') or get_setting('nft_enabled', '0')).lower() in ('1', 'true', 'yes')
    
    return {
        'contract_address': contract_address,
        'private_key': private_key,
        'base_url': base_url.rstrip('/'),
        'enabled': enabled,
        'is_testnet': is_testnet,
        'rpc': BSC_TESTNET_RPC if is_testnet else BSC_RPC,
        'explorer': BSC_TESTNET_EXPLORER if is_testnet else BSC_EXPLORER
    }


def mint_certificate_nft(order_id: str, recipient_address: str, order_data: dict, chain_id: int = 56) -> Tuple[bool, Optional[int], Optional[str], str]:
    """
    Mint NFT chứng nhận sở hữu cho đơn hàng.
    chain_id 56 = BSC Mainnet, 97 = BSC Testnet
    
    Returns:
        (success, token_id, tx_hash, error_message)
    """
    if not WEB3_AVAILABLE:
        return False, None, None, "Web3 chưa được cài đặt (pip install web3)"
    
    config = get_nft_config(chain_id)
    if not config['enabled']:
        return False, None, None, "NFT chưa được bật"
    if not config['contract_address'] or not config['private_key']:
        return False, None, None, "Chưa cấu hình NFT (contract address, private key)"
    
    recipient_address = Web3.to_checksum_address(recipient_address)
    
    try:
        w3 = Web3(Web3.HTTPProvider(config['rpc']))
        w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        if not w3.is_connected():
            return False, None, None, f"Không kết nối được {'BSC Testnet' if config['is_testnet'] else 'BSC'}"
        
        contract = w3.eth.contract(
            address=Web3.to_checksum_address(config['contract_address']),
            abi=NFT_ABI
        )
        
        account = w3.eth.account.from_key(config['private_key'])
        
        tx = contract.functions.mint(recipient_address).build_transaction({
            'from': account.address,
            'gas': 200000,
            'gasPrice': w3.eth.gas_price
        })
        
        signed = w3.eth.account.sign_transaction(tx, config['private_key'])
        tx_hash = w3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        if receipt['status'] != 1:
            return False, None, None, "Giao dịch thất bại trên blockchain"
        
        # Lấy tokenId từ event Transfer
        logs = contract.events.Transfer().process_receipt(receipt)
        token_id = int(logs[0]['args']['tokenId']) if logs else 0
        
        return True, token_id, receipt['transactionHash'].hex(), ""
        
    except Exception as e:
        err_msg = str(e)
        try:
            print(f"❌ NFT mint error: {err_msg}")
        except Exception:
            pass
        return False, None, None, err_msg
