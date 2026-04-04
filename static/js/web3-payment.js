// ============================================
// WEB3 PAYMENT SYSTEM — DQD (Optimized)
// ============================================

const USDT_CONTRACTS = {
    1:        '0xdac17f958d2ee523a2206206994597c13d831ec7',
    56:       '0x55d398326f99059fF775485246999027B3197955',
    137:      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    42161:    '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    10:       '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    11155111: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    97:       '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    80001:    '0x3813e82e6f7098b9583FC0F33a962D02018B6803'
  };
  
  const NETWORKS = {
    1:        { name: 'Ethereum Mainnet',  symbol: 'ETH',  rpc: 'https://eth.llamarpc.com',                         explorer: 'https://etherscan.io',              icon: '⟠',  decimals: 6,  minConfirmations: 12, gasLevel: 'high',   isTestnet: false },
    56:       { name: 'BNB Smart Chain',   symbol: 'BNB',  rpc: 'https://bsc-dataseed1.binance.org',                explorer: 'https://bscscan.com',               icon: '🔶', decimals: 18, minConfirmations: 15, gasLevel: 'medium', isTestnet: false },
    137:      { name: 'Polygon',           symbol: 'MATIC',rpc: 'https://polygon-rpc.com',                          explorer: 'https://polygonscan.com',           icon: '🟣', decimals: 6,  minConfirmations: 128,gasLevel: 'low',    isTestnet: false },
    42161:    { name: 'Arbitrum One',      symbol: 'ETH',  rpc: 'https://arb1.arbitrum.io/rpc',                     explorer: 'https://arbiscan.io',               icon: '🔵', decimals: 6,  minConfirmations: 10, gasLevel: 'low',    isTestnet: false },
    10:       { name: 'Optimism',          symbol: 'ETH',  rpc: 'https://mainnet.optimism.io',                      explorer: 'https://optimistic.etherscan.io',   icon: '🔴', decimals: 6,  minConfirmations: 10, gasLevel: 'low',    isTestnet: false },
    11155111: { name: 'Sepolia Testnet',   symbol: 'ETH',  rpc: 'https://rpc.sepolia.org',                          explorer: 'https://sepolia.etherscan.io',      icon: '🧪', decimals: 6,  minConfirmations: 3,  gasLevel: 'low',    isTestnet: true  },
    97:       { name: 'BSC Testnet',       symbol: 'tBNB', rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',   explorer: 'https://testnet.bscscan.com',       icon: '🧪', decimals: 18, minConfirmations: 3,  gasLevel: 'low',    isTestnet: true  },
    80001:    { name: 'Mumbai Testnet',    symbol: 'MATIC',rpc: 'https://rpc-mumbai.maticvigil.com',                explorer: 'https://mumbai.polygonscan.com',    icon: '🧪', decimals: 6,  minConfirmations: 3,  gasLevel: 'low',    isTestnet: true  }
  };
  
  // FIX 1: ABI dùng stateMutability thay vì deprecated "constant: true"
  const USDT_ABI = [
    {
      inputs: [{ name: '_owner', type: 'address' }],
      name: 'balanceOf',
      outputs: [{ name: 'balance', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [
        { name: '_to',    type: 'address' },
        { name: '_value', type: 'uint256' }
      ],
      name: 'transfer',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      stateMutability: 'view',
      type: 'function'
    }
  ];
  
  // ============================================
  // MAIN CLASS
  // ============================================
  
  class Web3PaymentSystemPro {
    constructor(config = {}) {
      this.web3             = null;
      this.account          = null;
      this.chainId          = null;
      this.usdtContract     = null;
      this.walletType       = null;
      this.transactionMonitor = null;
  
      // FIX 2: config thay vì hardcode — bắt buộc truyền vào
      this.recipientAddress = config.recipientAddress || null;
      this.usdRate          = config.usdRate          || 25000; // VND per 1 USD
  
      // FIX 3: Lưu reference listeners để remove sau này
      this._listeners = {};
  
      if (!this.recipientAddress) {
        console.warn('⚠️  recipientAddress chưa được cấu hình!');
      }
    }
  
    // ============================================
    // INITIALIZATION
    // ============================================
  
    async init() {
      const providers = this.detectWalletProviders();
      if (providers.length === 0) {
        this.showWalletInstallPrompt();
        return false;
      }
      return true;
    }
  
    detectWalletProviders() {
      const providers = [];
      if (typeof window.ethereum === 'undefined') return providers;
      if (window.ethereum.isMetaMask)      providers.push('metamask');
      if (window.ethereum.isCoinbaseWallet) providers.push('coinbase');
      if (!window.ethereum.isMetaMask && !window.ethereum.isCoinbaseWallet) {
        providers.push('injected');
      }
      return providers;
    }
  
    // ============================================
    // WALLET CONNECTION
    // ============================================
  
    async connectWallet(preferredWallet = 'metamask') {
      try {
        if (typeof window.ethereum === 'undefined') {
          throw new Error('Không tìm thấy Web3 wallet. Vui lòng cài MetaMask.');
        }
  
        this.web3       = new Web3(window.ethereum);
        this.walletType = preferredWallet;
  
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        this.account    = accounts[0];
  
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' });
        this.chainId     = parseInt(chainIdHex, 16);
  
        await this.initUSDTContract();
  
        // FIX 3: Gỡ listeners cũ trước khi thêm mới (tránh duplicate)
        this._removeEventListeners();
        this._setupEventListeners();
  
        return {
          success:  true,
          account:  this.account,
          chainId:  this.chainId,
          network:  NETWORKS[this.chainId]?.name || 'Unknown Network',
          balance:  await this.getNativeBalance()
        };
  
      } catch (error) {
        let msg = error.message;
        if (error.code === 4001)   msg = 'Người dùng từ chối kết nối';
        if (error.code === -32002) msg = 'Yêu cầu kết nối đang chờ xử lý, kiểm tra ví của bạn';
        return { success: false, error: msg };
      }
    }
  
    async initUSDTContract() {
      const usdtAddress = USDT_CONTRACTS[this.chainId];
      if (!usdtAddress) throw new Error('USDT không hỗ trợ trên mạng này');
      this.usdtContract = new this.web3.eth.Contract(USDT_ABI, usdtAddress);
    }
  
    disconnect() {
      this._removeEventListeners();
      if (this.transactionMonitor) {
        clearInterval(this.transactionMonitor);
        this.transactionMonitor = null;
      }
      this.account      = null;
      this.chainId      = null;
      this.usdtContract = null;
      this.web3         = null;
    }
  
    // ============================================
    // BALANCE
    // ============================================
  
    async getNativeBalance() {
      try {
        const wei = await this.web3.eth.getBalance(this.account);
        return parseFloat(this.web3.utils.fromWei(wei, 'ether')).toFixed(4);
      } catch {
        return '0';
      }
    }
  
    async getUSDTBalance() {
      try {
        if (!this.usdtContract) await this.initUSDTContract();
        const balance  = await this.usdtContract.methods.balanceOf(this.account).call();
        const decimals = await this.usdtContract.methods.decimals().call();
  
        // FIX 4: Dùng BigInt tránh floating point với số lớn
        return Number(BigInt(balance) * 10000n / BigInt(10 ** Number(decimals))) / 10000;
      } catch {
        return 0;
      }
    }
  
    // ============================================
    // NETWORK
    // ============================================
  
    async switchNetwork(chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: this.web3.utils.toHex(chainId) }]
        });
        this.chainId = chainId;
        await this.initUSDTContract();
        return { success: true, network: NETWORKS[chainId] };
      } catch (error) {
        if (error.code === 4902) return this.addNetwork(chainId);
        return { success: false, error: error.message };
      }
    }
  
    async addNetwork(chainId) {
      const network = NETWORKS[chainId];
      if (!network) return { success: false, error: 'Mạng không được hỗ trợ' };
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId:           this.web3.utils.toHex(chainId),
            chainName:         network.name,
            nativeCurrency:    { name: network.symbol, symbol: network.symbol, decimals: 18 },
            rpcUrls:           [network.rpc],
            blockExplorerUrls: [network.explorer]
          }]
        });
        return { success: true, network };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  
    async getGasPrice() {
      try {
        const gasPrice = await this.web3.eth.getGasPrice();
        return {
          wei:           gasPrice,
          gwei:          parseFloat(this.web3.utils.fromWei(gasPrice, 'gwei')).toFixed(2),
          estimatedCost: await this.estimateTransactionCost()
        };
      } catch {
        return null;
      }
    }
  
    async estimateTransactionCost() {
      try {
        const gasPrice     = await this.web3.eth.getGasPrice();
        const estimatedGas = 65000n;
        const costWei      = BigInt(gasPrice) * estimatedGas;
        return {
          gas:     Number(estimatedGas),
          costEth: parseFloat(this.web3.utils.fromWei(costWei.toString(), 'ether')).toFixed(6)
        };
      } catch {
        return null;
      }
    }
  
    // ============================================
    // PAYMENT
    // ============================================
  
    // FIX 5: Dùng số nguyên (cơ số cent) để tránh float precision
    vndToUsdtWei(vndAmount, decimals) {
      // VND → USDT → wei, tất cả bằng integer math
      const usdtCents  = Math.round((vndAmount / this.usdRate) * 100); // 2 decimal places
      const multiplier = BigInt(10 ** Number(decimals));
      return (BigInt(usdtCents) * multiplier) / 100n;
    }
  
    vndToUsdt(vndAmount) {
      return (vndAmount / this.usdRate).toFixed(2);
    }
  
    async sendPayment(amountVND, orderId, callbacks = {}) {
      const { onStart, onApprove, onSubmit, onConfirm, onError } = callbacks;
  
      // FIX 6: Validate đầu vào
      if (!amountVND || amountVND <= 0)   throw new Error('Số tiền không hợp lệ');
      if (!orderId)                        throw new Error('Thiếu mã đơn hàng');
      if (!this.recipientAddress)          throw new Error('Địa chỉ nhận chưa được cấu hình');
      if (!this.isConnected())             throw new Error('Ví chưa kết nối');
  
      try {
        if (onStart) onStart();
  
        const decimals    = await this.usdtContract.methods.decimals().call();
        const amountWei   = this.vndToUsdtWei(amountVND, decimals);
        const usdtDisplay = this.vndToUsdt(amountVND);
  
        if (amountWei === 0n) throw new Error('Số tiền quá nhỏ');
  
        // Kiểm tra số dư USDT
        const usdtBal = await this.getUSDTBalance();
        if (usdtBal < parseFloat(usdtDisplay)) {
          throw new Error(`Số dư USDT không đủ. Cần: ${usdtDisplay} USDT, Có: ${usdtBal} USDT`);
        }
  
        // Kiểm tra gas
        const nativeBal = await this.getNativeBalance();
        if (parseFloat(nativeBal) < 0.001) {
          const sym = NETWORKS[this.chainId]?.symbol || 'native token';
          throw new Error(`Không đủ ${sym} để trả phí gas. Cần ít nhất 0.001 ${sym}`);
        }
  
        // Estimate gas
        let gasEstimate;
        try {
          const raw    = await this.usdtContract.methods
            .transfer(this.recipientAddress, amountWei.toString())
            .estimateGas({ from: this.account });
          gasEstimate = Math.floor(raw * 1.3);
        } catch {
          gasEstimate = 100000;
        }
  
        if (onApprove) onApprove();
  
        const tx = await this.usdtContract.methods
          .transfer(this.recipientAddress, amountWei.toString())
          .send({ from: this.account, gas: gasEstimate })
          .on('transactionHash', (hash) => { if (onSubmit)  onSubmit(hash); })
          .on('confirmation',    (num)  => { if (onConfirm) onConfirm(num); });
  
        const network = NETWORKS[this.chainId];
        return {
          success:     true,
          txHash:      tx.transactionHash,
          amount:      usdtDisplay,
          orderId,
          chainId:     this.chainId,
          network:     network.name,
          explorer:    `${network.explorer}/tx/${tx.transactionHash}`,
          blockNumber: tx.blockNumber
        };
  
      } catch (error) {
        if (onError) onError(error);
        let msg = error.message;
        if (msg.includes('insufficient funds'))    msg = 'Không đủ phí gas';
        if (error.code === 4001 || msg.includes('User denied')) msg = 'Giao dịch bị từ chối';
        if (msg.includes('execution reverted'))    msg = 'Giao dịch thất bại. Kiểm tra số dư và thử lại.';
        return { success: false, error: msg };
      }
    }
  
    // ============================================
    // TRANSACTION MONITOR
    // ============================================
  
    // FIX 7: Clear interval cũ trước khi tạo mới
    async monitorTransaction(txHash, callback, maxAttempts = 60) {
      if (this.transactionMonitor) {
        clearInterval(this.transactionMonitor);
        this.transactionMonitor = null;
      }
  
      let attempts = 0;
  
      const checkStatus = async () => {
        try {
          const receipt = await this.web3.eth.getTransactionReceipt(txHash);
  
          if (receipt) {
            const network       = NETWORKS[this.chainId];
            const currentBlock  = await this.web3.eth.getBlockNumber();
            const confirmations = currentBlock - receipt.blockNumber;
  
            callback({ status: 'confirmed', confirmations, required: network.minConfirmations, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed });
  
            if (confirmations >= network.minConfirmations) {
              clearInterval(this.transactionMonitor);
              this.transactionMonitor = null;
            }
          } else {
            callback({ status: 'pending', attempts });
          }
  
          attempts++;
          if (attempts >= maxAttempts) {
            clearInterval(this.transactionMonitor);
            this.transactionMonitor = null;
            callback({ status: 'timeout', message: 'Transaction monitoring timeout' });
          }
        } catch (err) {
          console.error('Monitor error:', err);
        }
      };
  
      await checkStatus();
      this.transactionMonitor = setInterval(checkStatus, 5000);
    }
  
    // ============================================
    // EVENT LISTENERS — FIX 3
    // ============================================
  
    _setupEventListeners() {
      if (!window.ethereum) return;
  
      this._listeners.accountsChanged = (accounts) => {
        if (accounts.length === 0) { this.account = null; this.onDisconnect(); }
        else { this.account = accounts[0]; this.onAccountChanged(this.account); }
      };
  
      // FIX 8: Không reload tự động — để app tự xử lý
      this._listeners.chainChanged = (chainIdHex) => {
        this.chainId = parseInt(chainIdHex, 16);
        this.initUSDTContract().catch(() => {});
        this.onChainChanged(this.chainId);
      };
  
      this._listeners.disconnect = () => {
        this.disconnect();
        this.onDisconnect();
      };
  
      window.ethereum.on('accountsChanged', this._listeners.accountsChanged);
      window.ethereum.on('chainChanged',    this._listeners.chainChanged);
      window.ethereum.on('disconnect',      this._listeners.disconnect);
    }
  
    _removeEventListeners() {
      if (!window.ethereum || !this._listeners) return;
      if (this._listeners.accountsChanged) window.ethereum.removeListener('accountsChanged', this._listeners.accountsChanged);
      if (this._listeners.chainChanged)    window.ethereum.removeListener('chainChanged',    this._listeners.chainChanged);
      if (this._listeners.disconnect)      window.ethereum.removeListener('disconnect',      this._listeners.disconnect);
      this._listeners = {};
    }
  
    // ============================================
    // HELPERS
    // ============================================
  
    formatAddress(address) {
      if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return '';
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }
  
    formatAmount(amount, decimals = 2) {
      return parseFloat(amount).toFixed(decimals);
    }
  
    formatCurrency(amount, currency = 'VND') {
      if (currency === 'VND') return `${Number(amount).toLocaleString('vi-VN')}₫`;
      return `${parseFloat(amount).toFixed(2)} ${currency}`;
    }
  
    showWalletInstallPrompt() {
      alert('Vui lòng cài đặt MetaMask hoặc ví Web3 khác.\nhttps://metamask.io/download/');
    }
  
    // ============================================
    // CALLBACKS (override khi dùng)
    // ============================================
  
    onAccountChanged(account) {}
    onChainChanged(chainId)   {}
    onDisconnect()            {}
  
    // ============================================
    // GETTERS
    // ============================================
  
    getNetworkInfo() {
      return {
        chainId:      this.chainId,
        network:      NETWORKS[this.chainId] || null,
        account:      this.account,
        usdtContract: USDT_CONTRACTS[this.chainId] || null,
        walletType:   this.walletType
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
    window.NETWORKS             = NETWORKS;
    window.USDT_CONTRACTS       = USDT_CONTRACTS;
  }
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Web3PaymentSystemPro, NETWORKS, USDT_CONTRACTS };
  }