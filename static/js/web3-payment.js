// ============================================
// WEB3 PAYMENT SYSTEM - UPGRADED VERSION
// Professional USDT Payment with Multi-Wallet Support
// ============================================

// USDT Contract Addresses (Updated)
const USDT_CONTRACTS = {
    // Mainnet
    1: '0xdac17f958d2ee523a2206206994597c13d831ec7',      // Ethereum
    56: '0x55d398326f99059fF775485246999027B3197955',     // BSC
    137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',    // Polygon
    42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',  // Arbitrum
    10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',     // Optimism
    // Testnet
    11155111: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06', // Sepolia
    97: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',     // BSC Testnet
    80001: '0x3813e82e6f7098b9583FC0F33a962D02018B6803'  // Mumbai
};

// Network Configuration (Comprehensive)
const NETWORKS = {
    1: {
        name: 'Ethereum Mainnet',
        symbol: 'ETH',
        rpc: 'https://eth.llamarpc.com',
        explorer: 'https://etherscan.io',
        icon: '⟠',
        decimals: 6,
        minConfirmations: 12,
        gasLevel: 'high',
        isTestnet: false
    },
    56: {
        name: 'BNB Smart Chain',
        symbol: 'BNB',
        rpc: 'https://bsc-dataseed1.binance.org',
        explorer: 'https://bscscan.com',
        icon: '🔶',
        decimals: 18,
        minConfirmations: 15,
        gasLevel: 'medium',
        isTestnet: false
    },
    137: {
        name: 'Polygon',
        symbol: 'MATIC',
        rpc: 'https://polygon-rpc.com',
        explorer: 'https://polygonscan.com',
        icon: '🟣',
        decimals: 6,
        minConfirmations: 128,
        gasLevel: 'low',
        isTestnet: false
    },
    42161: {
        name: 'Arbitrum One',
        symbol: 'ETH',
        rpc: 'https://arb1.arbitrum.io/rpc',
        explorer: 'https://arbiscan.io',
        icon: '🔵',
        decimals: 6,
        minConfirmations: 10,
        gasLevel: 'low',
        isTestnet: false
    },
    10: {
        name: 'Optimism',
        symbol: 'ETH',
        rpc: 'https://mainnet.optimism.io',
        explorer: 'https://optimistic.etherscan.io',
        icon: '🔴',
        decimals: 6,
        minConfirmations: 10,
        gasLevel: 'low',
        isTestnet: false
    },
    11155111: {
        name: 'Sepolia Testnet',
        symbol: 'ETH',
        rpc: 'https://rpc.sepolia.org',
        explorer: 'https://sepolia.etherscan.io',
        icon: '🧪',
        decimals: 6,
        minConfirmations: 3,
        gasLevel: 'low',
        isTestnet: true
    },
    97: {
        name: 'BSC Testnet',
        symbol: 'tBNB',
        rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
        explorer: 'https://testnet.bscscan.com',
        icon: '🧪',
        decimals: 18,
        minConfirmations: 3,
        gasLevel: 'low',
        isTestnet: true
    },
    80001: {
        name: 'Mumbai Testnet',
        symbol: 'MATIC',
        rpc: 'https://rpc-mumbai.maticvigil.com',
        explorer: 'https://mumbai.polygonscan.com',
        icon: '🧪',
        decimals: 6,
        minConfirmations: 3,
        gasLevel: 'low',
        isTestnet: true
    }
};

// USDT ABI (ERC20 Standard - Minimal)
const USDT_ABI = [
    {
        "constant": true,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": false,
        "inputs": [
            {"name": "_to", "type": "address"},
            {"name": "_value", "type": "uint256"}
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
];

// ============================================
// MAIN CLASS
// ============================================

class Web3PaymentSystemPro {
    constructor() {
        this.web3 = null;
        this.account = null;
        this.chainId = null;
        this.usdtContract = null;
        this.recipientAddress = '0x3fd86c3728b38cb6b09fa7d4914888dcfef1518c'; // CHANGE THIS!
        this.usdRate = 25000;
        this.walletType = null; // 'metamask', 'walletconnect', 'coinbase'
        this.provider = null;
        this.transactionMonitor = null;
    }

    // ============================================
    // INITIALIZATION
    // ============================================

    async init() {
        console.log('🚀 Initializing Web3 Payment System Pro...');
        
        // Check for wallet providers
        const providers = this.detectWalletProviders();
        
        if (providers.length === 0) {
            console.error('❌ No Web3 wallet detected');
            this.showWalletInstallPrompt();
            return false;
        }
        
        console.log('✅ Detected wallets:', providers);
        return true;
    }

    detectWalletProviders() {
        const providers = [];
        
        if (typeof window.ethereum !== 'undefined') {
            if (window.ethereum.isMetaMask) {
                providers.push('metamask');
            }
            if (window.ethereum.isCoinbaseWallet) {
                providers.push('coinbase');
            }
            if (!window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet) {
                providers.push('injected');
            }
        }
        
        return providers;
    }

    // ============================================
    // WALLET CONNECTION
    // ============================================

    async connectWallet(preferredWallet = 'metamask') {
        try {
            console.log(`🔌 Connecting to ${preferredWallet}...`);
            
            if (typeof window.ethereum === 'undefined') {
                throw new Error('No Web3 wallet detected. Please install MetaMask or another Web3 wallet.');
            }

            // Initialize Web3
            this.web3 = new Web3(window.ethereum);
            this.walletType = preferredWallet;

            // Request account access
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });
            
            this.account = accounts[0];
            
            // Get chain ID
            const chainIdHex = await window.ethereum.request({ 
                method: 'eth_chainId' 
            });
            this.chainId = parseInt(chainIdHex, 16);

            console.log('✅ Wallet connected!');
            console.log('   Address:', this.account);
            console.log('   Chain ID:', this.chainId);
            console.log('   Network:', NETWORKS[this.chainId]?.name || 'Unknown');

            // Initialize USDT contract
            await this.initUSDTContract();

            // Setup event listeners
            this.setupEventListeners();

            return {
                success: true,
                account: this.account,
                chainId: this.chainId,
                network: NETWORKS[this.chainId]?.name || 'Unknown Network',
                balance: await this.getNativeBalance()
            };

        } catch (error) {
            console.error('❌ Wallet connection failed:', error);
            
            let errorMessage = error.message;
            if (error.code === 4001) {
                errorMessage = 'Connection rejected by user';
            } else if (error.code === -32002) {
                errorMessage = 'Connection request already pending. Please check your wallet.';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    async initUSDTContract() {
        const usdtAddress = USDT_CONTRACTS[this.chainId];
        
        if (!usdtAddress) {
            throw new Error('USDT not supported on this network');
        }

        this.usdtContract = new this.web3.eth.Contract(USDT_ABI, usdtAddress);
        console.log('✅ USDT Contract initialized:', usdtAddress);
    }

    disconnect() {
        this.account = null;
        this.chainId = null;
        this.usdtContract = null;
        this.web3 = null;
        
        // Clear any monitoring
        if (this.transactionMonitor) {
            clearInterval(this.transactionMonitor);
            this.transactionMonitor = null;
        }
        
        console.log('🔌 Wallet disconnected');
    }

    // ============================================
    // BALANCE OPERATIONS
    // ============================================

    async getNativeBalance() {
        try {
            const balanceWei = await this.web3.eth.getBalance(this.account);
            const balanceEth = this.web3.utils.fromWei(balanceWei, 'ether');
            return parseFloat(balanceEth).toFixed(4);
        } catch (error) {
            console.error('❌ Failed to get native balance:', error);
            return '0';
        }
    }

    async getUSDTBalance() {
        try {
            if (!this.usdtContract) {
                await this.initUSDTContract();
            }
            
            const balance = await this.usdtContract.methods.balanceOf(this.account).call();
            const decimals = await this.usdtContract.methods.decimals().call();
            const formattedBalance = balance / Math.pow(10, decimals);
            
            console.log('💰 USDT Balance:', formattedBalance);
            return formattedBalance;
        } catch (error) {
            console.error('❌ Failed to get USDT balance:', error);
            return 0;
        }
    }

    // ============================================
    // NETWORK OPERATIONS
    // ============================================

    async switchNetwork(chainId) {
        try {
            console.log(`🔄 Switching to chain ${chainId}...`);
            
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: this.web3.utils.toHex(chainId) }]
            });
            
            this.chainId = chainId;
            await this.initUSDTContract();
            
            console.log('✅ Network switched to:', NETWORKS[chainId].name);
            return { success: true, network: NETWORKS[chainId] };
            
        } catch (error) {
            console.error('❌ Failed to switch network:', error);
            
            // If network not added, try to add it
            if (error.code === 4902) {
                return await this.addNetwork(chainId);
            }
            
            return { success: false, error: error.message };
        }
    }

    async addNetwork(chainId) {
        const network = NETWORKS[chainId];
        
        if (!network) {
            return { success: false, error: 'Network not supported' };
        }
        
        try {
            console.log(`➕ Adding network: ${network.name}...`);
            
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                    chainId: this.web3.utils.toHex(chainId),
                    chainName: network.name,
                    nativeCurrency: {
                        name: network.symbol,
                        symbol: network.symbol,
                        decimals: 18
                    },
                    rpcUrls: [network.rpc],
                    blockExplorerUrls: [network.explorer]
                }]
            });
            
            console.log('✅ Network added:', network.name);
            return { success: true, network: network };
            
        } catch (error) {
            console.error('❌ Failed to add network:', error);
            return { success: false, error: error.message };
        }
    }

    async getGasPrice() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            const gasPriceGwei = this.web3.utils.fromWei(gasPrice, 'gwei');
            return {
                wei: gasPrice,
                gwei: parseFloat(gasPriceGwei).toFixed(2),
                estimatedCost: await this.estimateTransactionCost()
            };
        } catch (error) {
            console.error('❌ Failed to get gas price:', error);
            return null;
        }
    }

    async estimateTransactionCost() {
        try {
            const gasPrice = await this.web3.eth.getGasPrice();
            const estimatedGas = 65000; // Typical USDT transfer
            const costWei = BigInt(gasPrice) * BigInt(estimatedGas);
            const costEth = this.web3.utils.fromWei(costWei.toString(), 'ether');
            
            return {
                gas: estimatedGas,
                costEth: parseFloat(costEth).toFixed(6),
                costUsd: null // Calculate if needed
            };
        } catch (error) {
            console.error('❌ Failed to estimate transaction cost:', error);
            return null;
        }
    }

    // ============================================
    // PAYMENT OPERATIONS
    // ============================================

    vndToUsdt(vndAmount) {
        return (vndAmount / this.usdRate).toFixed(2);
    }

    async sendPayment(amountVND, orderId, callbacks = {}) {
        const {
            onStart,
            onApprove,
            onSubmit,
            onConfirm,
            onError
        } = callbacks;

        try {
            console.log('💸 Initiating payment...');
            if (onStart) onStart();

            // Convert VND to USDT
            const usdtAmount = this.vndToUsdt(amountVND);
            const decimals = await this.usdtContract.methods.decimals().call();
            const amountInWei = this.web3.utils.toBN(
                Math.floor(parseFloat(usdtAmount) * Math.pow(10, decimals))
            );

            console.log('💸 Payment Details:', {
                vnd: amountVND,
                usdt: usdtAmount,
                orderId: orderId,
                decimals: decimals,
                amountInWei: amountInWei.toString()
            });

            // Check balance
            const balance = await this.getUSDTBalance();
            if (balance < parseFloat(usdtAmount)) {
                throw new Error(
                    `Insufficient USDT balance. Required: ${usdtAmount} USDT, Available: ${balance} USDT`
                );
            }

            // Check native balance for gas
            const nativeBalance = await this.getNativeBalance();
            if (parseFloat(nativeBalance) < 0.001) {
                const network = NETWORKS[this.chainId];
                throw new Error(
                    `Insufficient ${network.symbol} for gas fees. Please add at least 0.001 ${network.symbol}`
                );
            }

            // Estimate gas
            let gasEstimate;
            try {
                gasEstimate = await this.usdtContract.methods
                    .transfer(this.recipientAddress, amountInWei.toString())
                    .estimateGas({ from: this.account });
                
                gasEstimate = Math.floor(gasEstimate * 1.3); // Add 30% buffer
                console.log('⛽ Gas estimate:', gasEstimate);
            } catch (error) {
                console.warn('⚠️ Gas estimation failed:', error.message);
                gasEstimate = 100000; // Fallback
            }

            if (onApprove) onApprove();

            // Send transaction
            console.log('📤 Sending transaction...');
            const tx = await this.usdtContract.methods
                .transfer(this.recipientAddress, amountInWei.toString())
                .send({
                    from: this.account,
                    gas: gasEstimate
                })
                .on('transactionHash', (hash) => {
                    console.log('📝 Transaction hash:', hash);
                    if (onSubmit) onSubmit(hash);
                })
                .on('confirmation', (confirmationNumber) => {
                    console.log('✅ Confirmation:', confirmationNumber);
                    if (onConfirm) onConfirm(confirmationNumber);
                });

            console.log('✅ Payment successful!');
            console.log('   TX Hash:', tx.transactionHash);

            const network = NETWORKS[this.chainId];
            return {
                success: true,
                txHash: tx.transactionHash,
                amount: usdtAmount,
                orderId: orderId,
                chainId: this.chainId,
                network: network.name,
                explorer: `${network.explorer}/tx/${tx.transactionHash}`,
                blockNumber: tx.blockNumber
            };

        } catch (error) {
            console.error('❌ Payment failed:', error);
            
            if (onError) onError(error);
            
            // Parse error message
            let errorMessage = error.message;
            if (error.message.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for gas fee';
            } else if (error.message.includes('User denied') || error.code === 4001) {
                errorMessage = 'Transaction rejected by user';
            } else if (error.message.includes('execution reverted')) {
                errorMessage = 'Transaction failed. Please check your balance and try again.';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    // ============================================
    // TRANSACTION MONITORING
    // ============================================

    async monitorTransaction(txHash, callback, maxAttempts = 60) {
        let attempts = 0;
        
        const checkStatus = async () => {
            try {
                const receipt = await this.web3.eth.getTransactionReceipt(txHash);
                
                if (receipt) {
                    const network = NETWORKS[this.chainId];
                    const currentBlock = await this.web3.eth.getBlockNumber();
                    const confirmations = currentBlock - receipt.blockNumber;
                    
                    callback({
                        status: 'confirmed',
                        confirmations: confirmations,
                        required: network.minConfirmations,
                        blockNumber: receipt.blockNumber,
                        gasUsed: receipt.gasUsed
                    });
                    
                    if (confirmations >= network.minConfirmations) {
                        clearInterval(this.transactionMonitor);
                        this.transactionMonitor = null;
                    }
                } else {
                    callback({
                        status: 'pending',
                        attempts: attempts
                    });
                }
                
                attempts++;
                if (attempts >= maxAttempts) {
                    clearInterval(this.transactionMonitor);
                    this.transactionMonitor = null;
                    callback({
                        status: 'timeout',
                        message: 'Transaction monitoring timeout'
                    });
                }
            } catch (error) {
                console.error('❌ Error monitoring transaction:', error);
            }
        };
        
        // Check immediately
        await checkStatus();
        
        // Then check every 5 seconds
        this.transactionMonitor = setInterval(checkStatus, 5000);
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================

    setupEventListeners() {
        if (!window.ethereum) return;

        // Account changed
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                console.log('🔌 Wallet disconnected');
                this.account = null;
                this.onDisconnect();
            } else {
                this.account = accounts[0];
                console.log('🔄 Account changed:', this.account);
                this.onAccountChanged(this.account);
            }
        });

        // Chain changed
        window.ethereum.on('chainChanged', (chainIdHex) => {
            this.chainId = parseInt(chainIdHex, 16);
            console.log('🔄 Chain changed:', this.chainId);
            this.onChainChanged(this.chainId);
            // Reload to reinitialize
            setTimeout(() => window.location.reload(), 100);
        });

        // Disconnect
        window.ethereum.on('disconnect', () => {
            console.log('🔌 Provider disconnected');
            this.disconnect();
            this.onDisconnect();
        });
    }

    // ============================================
    // UI HELPERS
    // ============================================

    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    formatAmount(amount, decimals = 2) {
        return parseFloat(amount).toFixed(decimals);
    }

    formatCurrency(amount, currency = 'VND') {
        if (currency === 'VND') {
            return `${amount.toLocaleString('vi-VN')}₫`;
        }
        return `${amount.toFixed(2)} ${currency}`;
    }

    showWalletInstallPrompt() {
        const message = `
            🦊 Web3 Wallet Required
            
            Please install one of the following wallets:
            • MetaMask (Recommended)
            • Coinbase Wallet
            • Trust Wallet
            
            Visit: https://metamask.io/download/
        `;
        
        alert(message);
    }

    // ============================================
    // CALLBACKS (Override these)
    // ============================================

    onAccountChanged(account) {
        console.log('Account changed:', account);
    }

    onChainChanged(chainId) {
        console.log('Chain changed:', chainId);
    }

    onDisconnect() {
        console.log('Disconnected');
    }

    // ============================================
    // GETTERS
    // ============================================

    getNetworkInfo() {
        return {
            chainId: this.chainId,
            network: NETWORKS[this.chainId] || null,
            account: this.account,
            usdtContract: USDT_CONTRACTS[this.chainId] || null,
            walletType: this.walletType
        };
    }

    isConnected() {
        return this.account !== null && this.web3 !== null;
    }

    getCurrentNetwork() {
        return NETWORKS[this.chainId] || null;
    }
}

// ============================================
// EXPORT
// ============================================

if (typeof window !== 'undefined') {
    window.Web3PaymentSystemPro = Web3PaymentSystemPro;
    window.NETWORKS = NETWORKS;
    window.USDT_CONTRACTS = USDT_CONTRACTS;
    console.log('✅ Web3 Payment System Pro loaded successfully');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        Web3PaymentSystemPro, 
        NETWORKS, 
        USDT_CONTRACTS 
    };
}