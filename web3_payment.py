# ============================================
# WEB3 PAYMENT SYSTEM - UPGRADED VERSION
# Professional USDT Payment Processing
# ============================================

from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from datetime import datetime, timedelta
import json
import hashlib
import secrets
import requests
from decimal import Decimal
from typing import Optional, Dict, Tuple

# Web3 Integration
try:
    from web3 import Web3
    from web3.middleware import geth_poa_middleware
    WEB3_AVAILABLE = True
except ImportError:
    WEB3_AVAILABLE = False
    print("⚠️ Web3.py not installed. Install with: pip install web3")

# Create blueprint
web3_bp = Blueprint('web3', __name__)

# ============================================
# CONFIGURATION
# ============================================

# Store transactions (use Redis/Database in production)
web3_transactions = {}
pending_payments = {}
usdt_rate_cache = {'rate': 25000, 'updated_at': None}

# USDT Rate Update Interval (60 seconds - tránh rate limit CoinGecko)
RATE_UPDATE_INTERVAL = 60

# Supported Networks - Updated with latest RPC endpoints
SUPPORTED_NETWORKS = {
    # Mainnet Networks
    1: {
        'name': 'Ethereum Mainnet',
        'symbol': 'ETH',
        'rpc': 'https://eth.llamarpc.com',
        'usdt_address': '0xdac17f958d2ee523a2206206994597c13d831ec7',
        'explorer': 'https://etherscan.io',
        'gas_price': 'high',
        'decimals': 6,
        'min_confirmations': 12,
        'is_testnet': False
    },
    56: {
        'name': 'BNB Smart Chain',
        'symbol': 'BNB',
        'rpc': 'https://bsc-dataseed1.binance.org',
        'usdt_address': '0x55d398326f99059fF775485246999027B3197955',
        'explorer': 'https://bscscan.com',
        'gas_price': 'medium',
        'decimals': 18,
        'min_confirmations': 15,
        'is_testnet': False
    },
    137: {
        'name': 'Polygon Mainnet',
        'symbol': 'MATIC',
        'rpc': 'https://polygon-rpc.com',
        'usdt_address': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        'explorer': 'https://polygonscan.com',
        'gas_price': 'low',
        'decimals': 6,
        'min_confirmations': 128,
        'is_testnet': False
    },
    42161: {
        'name': 'Arbitrum One',
        'symbol': 'ETH',
        'rpc': 'https://arb1.arbitrum.io/rpc',
        'usdt_address': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        'explorer': 'https://arbiscan.io',
        'gas_price': 'low',
        'decimals': 6,
        'min_confirmations': 10,
        'is_testnet': False
    },
    10: {
        'name': 'Optimism',
        'symbol': 'ETH',
        'rpc': 'https://mainnet.optimism.io',
        'usdt_address': '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
        'explorer': 'https://optimistic.etherscan.io',
        'gas_price': 'low',
        'decimals': 6,
        'min_confirmations': 10,
        'is_testnet': False
    },
    # Testnet Networks
    11155111: {
        'name': 'Sepolia Testnet',
        'symbol': 'ETH',
        'rpc': 'https://rpc.sepolia.org',
        'usdt_address': '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
        'explorer': 'https://sepolia.etherscan.io',
        'gas_price': 'low',
        'decimals': 6,
        'min_confirmations': 3,
        'is_testnet': True
    },
    97: {
        'name': 'BSC Testnet',
        'symbol': 'tBNB',
        'rpc': 'https://data-seed-prebsc-1-s1.binance.org:8545',
        'usdt_address': '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
        'explorer': 'https://testnet.bscscan.com',
        'gas_price': 'low',
        'decimals': 18,
        'min_confirmations': 3,
        'is_testnet': True
    },
    80001: {
        'name': 'Mumbai Testnet',
        'symbol': 'MATIC',
        'rpc': 'https://rpc-mumbai.maticvigil.com',
        'usdt_address': '0x3813e82e6f7098b9583FC0F33a962D02018B6803',
        'explorer': 'https://mumbai.polygonscan.com',
        'gas_price': 'low',
        'decimals': 6,
        'min_confirmations': 3,
        'is_testnet': True
    }
}

# IMPORTANT: Change this to your wallet address
RECIPIENT_WALLET = '0x3fd86c3728b38cb6b09fa7d4914888dcfef1518c'


def get_web3_testnet_mode():
    """Lấy chế độ testnet từ settings"""
    try:
        from db_helper import get_setting
        return str(get_setting('web3_testnet_mode', '0')).lower() in ('1', 'true', 'yes')
    except Exception:
        return False


def get_recipient_wallet():
    """Lấy địa chỉ ví nhận - dùng RECIPIENT_WALLET (cùng địa chỉ hoạt động trên mainnet và testnet)"""
    return RECIPIENT_WALLET

# Payment Settings
PAYMENT_TIMEOUT = 15 * 60  # 15 minutes
MAX_TRANSACTION_AGE = 24 * 60 * 60  # 24 hours
CONFIRMATION_CHECK_INTERVAL = 30  # seconds

# ============================================
# MAIN ROUTES
# ============================================

@web3_bp.route('/usdt-payment')
def usdt_payment_page():
    """
    Render USDT payment page
    URL: /usdt-payment?order_id=XXX&amount=YYY
    Hoặc: /usdt-payment?temp_id=XXX&amount=YYY (nếu chưa có order)
    """
    # Ưu tiên lấy order_id từ URL hoặc session
    order_id = request.args.get('order_id', session.get('pending_order_id', ''))
    temp_id = request.args.get('temp_id', '')
    total_amount = request.args.get('amount', session.get('cart_total', 0))
    name = request.args.get('name', '')
    email = request.args.get('email', '')
    phone = request.args.get('phone', '')
    
    # Nếu có order_id, lấy từ database
    if order_id:
        try:
            from db_helper import get_order_by_id
            order = get_order_by_id(order_id)
            if order:
                total_amount = float(order['total'])
                name = order['customer_name']
                email = order.get('email', '')
                phone = order.get('phone', '')
                print(f"📦 Using order from DB: {order_id}, Total: {total_amount:,.0f}₫")
            else:
                print(f"⚠️ Order {order_id} not found in database")
                # Nếu không tìm thấy order, dùng temp_id nếu có
                if not temp_id:
                    return redirect('/checkout')
        except Exception as e:
            print(f"❌ Error getting order: {e}")
            if not temp_id:
                return redirect('/checkout')
    
    # Nếu không có order_id, chấp nhận temp_id (cho trường hợp chưa tạo order)
    if not order_id and temp_id:
        order_id = temp_id
        try:
            total_amount = float(total_amount)
        except (ValueError, TypeError):
            total_amount = 0
        
        if total_amount <= 0:
            return redirect('/checkout')
    
    # Nếu không có cả order_id và temp_id, redirect về checkout
    if not order_id:
        return redirect('/checkout')
    
    try:
        total_amount = float(total_amount)
    except (ValueError, TypeError):
        total_amount = 0
    
    if total_amount <= 0:
        return redirect(url_for('checkout'))
    
    # Update USDT rate
    update_usdt_rate()
    
    # Calculate USDT amount
    usdt_rate = usdt_rate_cache['rate']
    usdt_amount = round(total_amount / usdt_rate, 2)
    
    # Create payment session
    payment_id = create_payment_session(order_id, total_amount, usdt_amount)
    
    # Get payment session info
    payment = pending_payments.get(payment_id, {})
    payment_created_at = payment.get('created_at', '')
    payment_expires_at = payment.get('expires_at', '')
    
    testnet_mode = get_web3_testnet_mode()
    recipient = get_recipient_wallet()
    # Khi testnet: chỉ hiển thị BSC Testnet (97)
    networks = {97: SUPPORTED_NETWORKS[97]} if testnet_mode else SUPPORTED_NETWORKS
    
    return render_template('customer/usdt-payment.html',
                         order_id=order_id,
                         temp_id=temp_id if temp_id else order_id,
                         amount=total_amount,
                         usdt_amount=usdt_amount,
                         usdt_rate=usdt_rate,
                         payment_id=payment_id,
                         payment_created_at=payment_created_at,
                         payment_expires_at=payment_expires_at,
                         recipient_wallet=recipient,
                         recipient_address=recipient,
                         networks=networks,
                         testnet_mode=testnet_mode,
                         default_chain_id=97 if testnet_mode else 56,
                         name=name,
                         email=email,
                         phone=phone)


@web3_bp.route('/payment-success')
def payment_success():
    """Payment success page"""
    order_id = request.args.get('order_id')
    tx_hash = request.args.get('tx_hash')
    
    return render_template('customer/payment-success.html',
                         order_id=order_id,
                         tx_hash=tx_hash)


# ============================================
# API ENDPOINTS
# ============================================

@web3_bp.route('/api/web3/payment-info', methods=['GET'])
def get_payment_info():
    """
    Get payment information for order
    
    GET /api/web3/payment-info?order_id=XXX
    """
    order_id = request.args.get('order_id')
    
    if not order_id:
        return jsonify({'success': False, 'error': 'Order ID required'}), 400
    
    # Get order total
    total_amount = int(request.args.get('amount', 0))
    
    # Update USDT rate
    update_usdt_rate()
    
    # Calculate USDT amount
    usdt_rate = usdt_rate_cache['rate']
    usdt_amount = round(total_amount / usdt_rate, 2)
    
    # Create or get existing payment session
    payment_id = create_payment_session(order_id, total_amount, usdt_amount)
    payment = pending_payments.get(payment_id, {})
    
    return jsonify({
        'success': True,
        'order_id': order_id,
        'amount_vnd': total_amount,
        'amount_usdt': str(usdt_amount),
        'usdt_rate': usdt_rate,
        'recipient_wallet': RECIPIENT_WALLET,
        'supported_networks': format_networks_for_api(),
        'payment_id': payment_id,
        'expires_at': payment.get('expires_at', ''),
        'timeout_seconds': PAYMENT_TIMEOUT,
        'rate_updated_at': usdt_rate_cache.get('updated_at')
    })


@web3_bp.route('/api/web3/submit-payment', methods=['POST'])
def submit_payment():
    """
    Submit Web3 payment transaction
    
    POST /api/web3/submit-payment
    Body: {
        "order_id": "ORD123",
        "tx_hash": "0x...",
        "chain_id": 56,
        "from_address": "0x...",
        "amount_usdt": "600.00",
        "demo": false  # true = test luồng không cần USDT (chỉ khi testnet mode)
    }
    """
    try:
        data = request.json
        
        # Validate required fields
        required_fields = ['order_id', 'tx_hash', 'chain_id', 'from_address', 'amount_usdt']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        order_id = data['order_id']
        tx_hash = data['tx_hash'].lower()
        chain_id = int(data['chain_id'])
        from_address = data['from_address'].lower()
        amount_usdt = data['amount_usdt']
        is_demo = data.get('demo', False)
        
        # Validate chain ID
        if chain_id not in SUPPORTED_NETWORKS:
            return jsonify({
                'success': False,
                'error': f'Unsupported network: {chain_id}'
            }), 400
        
        # Demo mode: chỉ cho phép khi testnet (chain 97)
        if is_demo and chain_id != 97:
            return jsonify({
                'success': False,
                'error': 'Demo mode chỉ dùng với BSC Testnet (chain 97)'
            }), 400
        
        # Validate transaction hash format (demo cho phép 0xdemo...)
        if not tx_hash.startswith('0x'):
            return jsonify({
                'success': False,
                'error': 'Invalid transaction hash format'
            }), 400
        if not is_demo and len(tx_hash) != 66:
            return jsonify({
                'success': False,
                'error': 'Invalid transaction hash format'
            }), 400
        
        # Check if transaction already exists
        if tx_hash in web3_transactions and not is_demo:
            return jsonify({
                'success': False,
                'error': 'Transaction already submitted'
            }), 400
        
        # Create transaction record
        network = SUPPORTED_NETWORKS[chain_id]
        transaction = {
            'order_id': order_id,
            'tx_hash': tx_hash,
            'chain_id': chain_id,
            'network_name': network['name'],
            'from_address': from_address,
            'to_address': RECIPIENT_WALLET.lower(),
            'amount_usdt': amount_usdt,
            'timestamp': datetime.now().isoformat(),
            'status': 'confirmed' if is_demo else 'pending',
            'confirmed': is_demo,
            'confirmations': 15 if is_demo else 0,
            'verified_on_chain': is_demo,
        }
        
        # Store transaction
        web3_transactions[tx_hash] = transaction
        
        # Get order to calculate amount in VND and create payment transaction
        transaction_id = None
        try:
            from db_helper import get_order_by_id, create_payment_transaction, update_order_status, update_payment_transaction_status, create_nft_certificate, get_nft_certificate_by_order
            order = get_order_by_id(order_id)
            
            if order:
                # Create payment transaction in database
                transaction_id = f"USDT_{tx_hash[:16]}"
                payment_transaction_data = {
                    'transaction_id': transaction_id,
                    'order_id': order_id,
                    'payment_method': 'usdt',
                    'amount': float(order['total']),
                    'currency': 'VND',
                    'status': 'completed' if is_demo else 'pending',
                    'transaction_hash': tx_hash,
                    'payment_gateway_response': json.dumps({
                        'chain_id': chain_id,
                        'network_name': network['name'],
                        'from_address': from_address,
                        'to_address': RECIPIENT_WALLET,
                        'amount_usdt': amount_usdt,
                        'explorer_url': f"{network['explorer']}/tx/{tx_hash}" if not is_demo else None,
                        'demo': is_demo
                    })
                }
                create_payment_transaction(payment_transaction_data)
                
                if is_demo:
                    update_payment_transaction_status(transaction_id, 'completed', datetime.now())
                    update_order_status(order_id, 'confirmed', 'paid')
                    # Tạo demo NFT (token_id=0, tx_hash có prefix 0xdemo)
                    existing = get_nft_certificate_by_order(order_id)
                    if not existing:
                        create_nft_certificate(order_id, 0, tx_hash, from_address, chain_id)
        except Exception as e:
            print(f"⚠️ Error creating payment transaction: {e}")
        
        # Demo: skip blockchain verification
        if is_demo:
            return jsonify({
                'success': True,
                'message': 'Demo payment completed successfully',
                'transaction': transaction,
                'explorer_url': None
            })
        
        # Start verification in background (in production, use Celery/RQ)
        if WEB3_AVAILABLE:
            try:
                verified, confirmations = verify_transaction_on_chain(tx_hash, chain_id)
                transaction['verified_on_chain'] = verified
                transaction['confirmations'] = confirmations
                if confirmations >= network['min_confirmations']:
                    transaction['status'] = 'confirmed'
                    transaction['confirmed'] = True
                    
                    # Update payment transaction status
                    if transaction_id:
                        try:
                            from db_helper import update_payment_transaction_status, update_order_status, create_nft_certificate, get_nft_certificate_by_order, get_order_by_id
                            update_payment_transaction_status(transaction_id, 'completed', datetime.now())
                            update_order_status(order_id, 'confirmed', 'paid')
                            
                            # Mint NFT chứng nhận (BSC mainnet 56 hoặc testnet 97)
                            if chain_id in (56, 97):
                                order_for_nft = get_order_by_id(order_id)
                                existing = get_nft_certificate_by_order(order_id)
                                if not existing and order_for_nft:
                                    try:
                                        from nft_certificate import mint_certificate_nft
                                        success, token_id, nft_tx_hash, err = mint_certificate_nft(
                                            order_id, from_address, order_for_nft, chain_id=chain_id
                                        )
                                        if success and token_id:
                                            create_nft_certificate(
                                                order_id, token_id,
                                                nft_tx_hash or tx_hash,
                                                from_address, chain_id
                                            )
                                    except Exception as nft_err:
                                        print(f"⚠️ NFT mint skipped: {nft_err}")
                        except Exception as e:
                            print(f"⚠️ Error updating payment status: {e}")
            except Exception as e:
                print(f"⚠️ Background verification failed: {e}")
        
        return jsonify({
            'success': True,
            'message': 'Payment submitted successfully',
            'transaction': transaction,
            'explorer_url': f"{network['explorer']}/tx/{tx_hash}"
        })
        
    except Exception as e:
        print(f"❌ Error submitting payment: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@web3_bp.route('/api/web3/verify-payment', methods=['POST'])
def verify_payment():
    """
    Verify transaction on blockchain
    
    POST /api/web3/verify-payment
    Body: {
        "tx_hash": "0x...",
        "chain_id": 56
    }
    """
    try:
        data = request.json
        tx_hash = data.get('tx_hash', '').lower()
        chain_id = int(data.get('chain_id', 0))
        
        if not tx_hash or chain_id not in SUPPORTED_NETWORKS:
            return jsonify({
                'success': False,
                'error': 'Invalid parameters'
            }), 400
        
        # Verify on blockchain
        if WEB3_AVAILABLE:
            verified, confirmations, details = verify_transaction_on_chain_detailed(tx_hash, chain_id)
            
            # Update transaction if exists
            if tx_hash in web3_transactions:
                transaction = web3_transactions[tx_hash]
                transaction['verified_on_chain'] = verified
                transaction['confirmations'] = confirmations
                
                network = SUPPORTED_NETWORKS[chain_id]
                if confirmations >= network['min_confirmations']:
                    transaction['status'] = 'confirmed'
                    transaction['confirmed'] = True
            
            return jsonify({
                'success': True,
                'verified': verified,
                'confirmations': confirmations,
                'details': details,
                'message': 'Transaction verified successfully' if verified else 'Transaction not found or invalid'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Web3 verification not available'
            }), 503
            
    except Exception as e:
        print(f"❌ Error verifying payment: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@web3_bp.route('/api/web3/check-status/<tx_hash>')
def check_payment_status(tx_hash):
    """
    Check payment status by transaction hash
    
    GET /api/web3/check-status/0x...
    """
    tx_hash = tx_hash.lower()
    transaction = web3_transactions.get(tx_hash)
    
    if not transaction:
        return jsonify({
            'success': False,
            'error': 'Transaction not found'
        }), 404
    
    # Try to update confirmations if Web3 is available
    if WEB3_AVAILABLE and not transaction.get('confirmed'):
        try:
            verified, confirmations, _ = verify_transaction_on_chain_detailed(
                tx_hash, 
                transaction['chain_id']
            )
            transaction['verified_on_chain'] = verified
            transaction['confirmations'] = confirmations
            
            network = SUPPORTED_NETWORKS[transaction['chain_id']]
            if confirmations >= network['min_confirmations']:
                transaction['status'] = 'confirmed'
                transaction['confirmed'] = True
        except:
            pass
    
    return jsonify({
        'success': True,
        'status': transaction['status'],
        'confirmed': transaction['confirmed'],
        'confirmations': transaction.get('confirmations', 0),
        'transaction': transaction
    })


@web3_bp.route('/api/web3/usdt-rate')
def get_usdt_rate():
    """
    Get current USDT/VND exchange rate
    
    GET /api/web3/usdt-rate?force=true (force update)
    """
    force = request.args.get('force', 'false').lower() == 'true'
    
    if force:
        update_usdt_rate()
    else:
        update_usdt_rate()
    
    return jsonify({
        'success': True,
        'rate': usdt_rate_cache['rate'],
        'currency': 'VND',
        'updated_at': usdt_rate_cache.get('updated_at'),
        'source': 'coingecko'
    })


@web3_bp.route('/api/web3/network-info/<int:chain_id>')
def get_network_info(chain_id):
    """
    Get detailed network information
    
    GET /api/web3/network-info/56
    """
    network = SUPPORTED_NETWORKS.get(chain_id)
    
    if not network:
        return jsonify({
            'success': False,
            'error': 'Network not supported'
        }), 404
    
    # Get gas price estimate if Web3 is available
    gas_info = None
    if WEB3_AVAILABLE:
        try:
            gas_info = get_network_gas_info(chain_id)
        except:
            pass
    
    return jsonify({
        'success': True,
        'chain_id': chain_id,
        'network': network,
        'gas_info': gas_info
    })


@web3_bp.route('/api/web3/payment-timer/<payment_id>')
def get_payment_timer(payment_id):
    """
    Get remaining time for payment session
    
    GET /api/web3/payment-timer/pay_xxx
    """
    payment = pending_payments.get(payment_id)
    
    if not payment:
        return jsonify({
            'success': False,
            'error': 'Payment session not found'
        }), 404
    
    expires_at = datetime.fromisoformat(payment['expires_at'])
    now = datetime.now()
    remaining_seconds = max(0, int((expires_at - now).total_seconds()))
    
    return jsonify({
        'success': True,
        'payment_id': payment_id,
        'remaining_seconds': remaining_seconds,
        'expires_at': payment['expires_at'],
        'server_time': now.isoformat(),
        'timeout_seconds': PAYMENT_TIMEOUT
    })


# ============================================
# HELPER FUNCTIONS
# ============================================

def create_payment_session(order_id: str, amount_vnd: int, amount_usdt: float) -> str:
    """Create a payment session with timeout"""
    payment_id = f"pay_{secrets.token_urlsafe(16)}"
    
    expires_at = datetime.now() + timedelta(seconds=PAYMENT_TIMEOUT)
    
    payment = {
        'payment_id': payment_id,
        'order_id': order_id,
        'amount_vnd': amount_vnd,
        'amount_usdt': amount_usdt,
        'created_at': datetime.now().isoformat(),
        'expires_at': expires_at.isoformat(),
        'status': 'pending'
    }
    
    pending_payments[payment_id] = payment
    
    return payment_id


def update_usdt_rate(force=False):
    """Update USDT/VND rate from CoinGecko API with smart caching"""
    global usdt_rate_cache
    
    # Always allow updates if cache is empty or very old (> 1 hour)
    cache_age = 0
    if usdt_rate_cache.get('updated_at'):
        last_update = datetime.fromisoformat(usdt_rate_cache['updated_at'])
        cache_age = (datetime.now() - last_update).total_seconds()
    
    # Check if rate needs update (only skip if cache is fresh and not forced)
    if not force and cache_age < RATE_UPDATE_INTERVAL and cache_age > 0:
        return
    
    try:
        response = requests.get(
            'https://api.coingecko.com/api/v3/simple/price',
            params={
                'ids': 'tether',
                'vs_currencies': 'vnd'
            },
            timeout=3
        )
        
        if response.status_code == 200:
            data = response.json()
            new_rate = int(data['tether']['vnd'])
            
            old_rate = usdt_rate_cache.get('rate', new_rate)
            
            usdt_rate_cache = {
                'rate': new_rate,
                'updated_at': datetime.now().isoformat()
            }
            
            if old_rate != new_rate:
                print(f"✅ USDT rate updated: 1 USDT = {new_rate:,} VND (was {old_rate:,})")
        elif response.status_code == 429:
            print(f"⚠️ Rate limit exceeded, using cached rate")
        else:
            print(f"⚠️ Failed to fetch USDT rate: {response.status_code}")
    except requests.exceptions.Timeout:
        print(f"⚠️ Request timeout, using cached rate")
    except Exception as e:
        print(f"⚠️ Error updating USDT rate: {e}")


def verify_transaction_on_chain(tx_hash: str, chain_id: int) -> Tuple[bool, int]:
    """
    Verify transaction on blockchain using Web3
    
    Returns: (verified: bool, confirmations: int)
    """
    if not WEB3_AVAILABLE:
        return False, 0
    
    try:
        network = SUPPORTED_NETWORKS.get(chain_id)
        if not network:
            return False, 0
        
        # Connect to blockchain
        w3 = Web3(Web3.HTTPProvider(network['rpc']))
        
        # Add PoA middleware for BSC and Polygon
        if chain_id in [56, 97, 137, 80001]:
            w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        if not w3.is_connected():
            print(f"❌ Failed to connect to {network['name']}")
            return False, 0
        
        # Get transaction receipt
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        
        if not receipt:
            return False, 0
        
        # Check if transaction was successful
        if receipt['status'] != 1:
            print(f"❌ Transaction failed on chain")
            return False, 0
        
        # Get transaction details
        tx = w3.eth.get_transaction(tx_hash)
        
        # Verify recipient address (for direct transfers)
        # Note: For USDT transfers, we need to check the logs
        # This is a simplified check
        
        # Calculate confirmations
        current_block = w3.eth.block_number
        tx_block = receipt['blockNumber']
        confirmations = current_block - tx_block
        
        print(f"✅ Transaction verified on {network['name']}")
        print(f"   Confirmations: {confirmations}")
        
        return True, confirmations
        
    except Exception as e:
        print(f"❌ Error verifying transaction: {e}")
        return False, 0


def verify_transaction_on_chain_detailed(tx_hash: str, chain_id: int) -> Tuple[bool, int, Dict]:
    """
    Detailed transaction verification
    
    Returns: (verified: bool, confirmations: int, details: dict)
    """
    if not WEB3_AVAILABLE:
        return False, 0, {}
    
    try:
        network = SUPPORTED_NETWORKS.get(chain_id)
        if not network:
            return False, 0, {}
        
        w3 = Web3(Web3.HTTPProvider(network['rpc']))
        
        if chain_id in [56, 97, 137, 80001]:
            w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        if not w3.is_connected():
            return False, 0, {'error': 'Connection failed'}
        
        receipt = w3.eth.get_transaction_receipt(tx_hash)
        
        if not receipt:
            return False, 0, {'error': 'Transaction not found'}
        
        tx = w3.eth.get_transaction(tx_hash)
        
        current_block = w3.eth.block_number
        tx_block = receipt['blockNumber']
        confirmations = current_block - tx_block
        
        details = {
            'block_number': tx_block,
            'current_block': current_block,
            'confirmations': confirmations,
            'status': receipt['status'],
            'from': tx['from'],
            'to': tx['to'],
            'gas_used': receipt['gasUsed'],
            'effective_gas_price': receipt.get('effectiveGasPrice', 0),
            'timestamp': w3.eth.get_block(tx_block)['timestamp']
        }
        
        verified = receipt['status'] == 1
        
        return verified, confirmations, details
        
    except Exception as e:
        return False, 0, {'error': str(e)}


def get_network_gas_info(chain_id: int) -> Optional[Dict]:
    """Get current gas price information for network"""
    if not WEB3_AVAILABLE:
        return None
    
    try:
        network = SUPPORTED_NETWORKS.get(chain_id)
        if not network:
            return None
        
        w3 = Web3(Web3.HTTPProvider(network['rpc']))
        
        if chain_id in [56, 97, 137, 80001]:
            w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        
        if not w3.is_connected():
            return None
        
        gas_price = w3.eth.gas_price
        gas_price_gwei = w3.from_wei(gas_price, 'gwei')
        
        # Estimate transaction cost
        estimated_gas = 65000  # Typical USDT transfer
        estimated_cost_wei = gas_price * estimated_gas
        estimated_cost_eth = w3.from_wei(estimated_cost_wei, 'ether')
        
        return {
            'gas_price_wei': gas_price,
            'gas_price_gwei': float(gas_price_gwei),
            'estimated_gas': estimated_gas,
            'estimated_cost': float(estimated_cost_eth),
            'network_symbol': network['symbol']
        }
        
    except Exception as e:
        print(f"⚠️ Error getting gas info: {e}")
        return None


def format_networks_for_api() -> Dict:
    """Format networks for API response"""
    return {
        str(k): {
            'name': v['name'],
            'symbol': v['symbol'],
            'explorer': v['explorer'],
            'is_testnet': v['is_testnet'],
            'decimals': v['decimals']
        }
        for k, v in SUPPORTED_NETWORKS.items()
    }


def format_currency(amount: int) -> str:
    """Format VND currency"""
    return f"{amount:,.0f}₫".replace(',', '.')


# ============================================
# CLEANUP TASKS
# ============================================

def cleanup_expired_payments():
    """Clean up expired payment sessions (run periodically)"""
    now = datetime.now()
    expired = []
    
    for payment_id, payment in pending_payments.items():
        expires_at = datetime.fromisoformat(payment['expires_at'])
        if now > expires_at:
            expired.append(payment_id)
    
    for payment_id in expired:
        del pending_payments[payment_id]
    
    if expired:
        print(f"🧹 Cleaned up {len(expired)} expired payments")


def cleanup_old_transactions():
    """Clean up old transactions (run periodically)"""
    now = datetime.now()
    old = []
    
    for tx_hash, tx in web3_transactions.items():
        tx_time = datetime.fromisoformat(tx['timestamp'])
        age = (now - tx_time).total_seconds()
        
        if age > MAX_TRANSACTION_AGE and tx.get('confirmed'):
            old.append(tx_hash)
    
    for tx_hash in old:
        del web3_transactions[tx_hash]
    
    if old:
        print(f"🧹 Cleaned up {len(old)} old transactions")


# ============================================
# INITIALIZATION
# ============================================

def init_web3_payment(app):
    """Initialize Web3 payment system"""
    app.register_blueprint(web3_bp)
    
    # Add Jinja2 filters
    app.jinja_env.filters['format_currency'] = format_currency
    
    # Update USDT rate on startup
    update_usdt_rate()
    
    print("=" * 60)
    print("💰 Web3 Payment System - UPGRADED VERSION")
    print("=" * 60)
    print(f"Web3.py Available: {'✅ Yes' if WEB3_AVAILABLE else '❌ No'}")
    print(f"Recipient Wallet: {RECIPIENT_WALLET}")
    print(f"USDT Rate: 1 USDT = {usdt_rate_cache['rate']:,} VND")
    print(f"Supported Networks: {len(SUPPORTED_NETWORKS)}")
    print("\nMainnet Networks:")
    for chain_id, network in SUPPORTED_NETWORKS.items():
        if not network['is_testnet']:
            print(f"  • {network['name']} (Chain ID: {chain_id}) - {network['symbol']}")
    print("\nTestnet Networks:")
    for chain_id, network in SUPPORTED_NETWORKS.items():
        if network['is_testnet']:
            print(f"  • {network['name']} (Chain ID: {chain_id}) - {network['symbol']}")
    print(f"\nPayment Timeout: {PAYMENT_TIMEOUT // 60} minutes")
    print(f"Auto Rate Update: Every {RATE_UPDATE_INTERVAL} second(s)")
    print("=" * 60)


if __name__ == '__main__':
    print("Web3 Payment Backend Module - Upgraded Version")
    print("\nInstallation:")
    print("  pip install web3 requests")
    print("\nUsage:")
    print("  from web3_payment_upgraded import init_web3_payment")
    print("  init_web3_payment(app)")