/**
 * NimiqNodeService provides a wrapper around the @nimiq/core browser node
 * functionality with additional error handling and state management.
 */
class NimiqNodeService {
    constructor() {
        this.consensus = null;
        this.blockchain = null;
        this.accounts = null;
        this.mempool = null;
        this.network = null;
        this.state = {
            initialized: false,
            syncing: false,
            height: 0,
            headHash: null,
            connected: false
        };
        this._initPromise = null;
    }

    /**
     * Initialize the Nimiq browser node
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise(async (resolve, reject) => {
            try {
                // Configure Nimiq
                Nimiq.GenesisConfig.main();

                // Initialize consensus
                this.consensus = await Nimiq.Consensus.light();
                
                // Store references
                this.blockchain = this.consensus.blockchain;
                this.accounts = this.blockchain.accounts;
                this.mempool = this.consensus.mempool;
                this.network = this.consensus.network;

                // Set up event listeners
                this._setupEventListeners();

                // Connect to network
                await this.network.connect();

                this.state.initialized = true;
                resolve();
            } catch (error) {
                console.error('Failed to initialize Nimiq node:', error);
                reject(error);
            }
        });

        return this._initPromise;
    }

    /**
     * Set up blockchain event listeners
     * @private
     */
    _setupEventListeners() {
        this.blockchain.on('head-changed', (head) => {
            this.state.height = this.blockchain.height;
            this.state.headHash = head.hash().toHex();
        });

        this.network.on('peers-changed', () => {
            this.state.connected = this.network.peerCount > 0;
        });

        this.consensus.on('established', () => {
            this.state.syncing = false;
        });

        this.consensus.on('lost', () => {
            this.state.syncing = true;
        });
    }

    /**
     * Get account balance
     * @param {string} address - Nimiq address
     * @returns {Promise<number>} Balance in NIM
     */
    async getBalance(address) {
        if (!this.state.initialized) {
            throw new Error('Nimiq node not initialized');
        }

        try {
            const nimiqAddress = Nimiq.Address.fromString(address);
            const account = await this.accounts.get(nimiqAddress);
            return Nimiq.Policy.satoshisToCoins(account.balance);
        } catch (error) {
            console.error('Failed to get balance:', error);
            throw error;
        }
    }

    /**
     * Verify transaction details
     * @param {string} txHash - Transaction hash
     * @returns {Promise<Object>} Transaction details
     */
    async verifyTransaction(txHash) {
        if (!this.state.initialized) {
            throw new Error('Nimiq node not initialized');
        }

        try {
            const tx = await this.blockchain.getTransaction(txHash);
            if (!tx) {
                throw new Error('Transaction not found');
            }

            return {
                confirmations: this.blockchain.height - tx.height + 1,
                sender: tx.sender.toUserFriendlyAddress(),
                recipient: tx.recipient.toUserFriendlyAddress(),
                value: Nimiq.Policy.satoshisToCoins(tx.value),
                fee: Nimiq.Policy.satoshisToCoins(tx.fee),
                timestamp: tx.timestamp
            };
        } catch (error) {
            console.error('Failed to verify transaction:', error);
            throw error;
        }
    }

    /**
     * Get current blockchain state
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Check if node is ready for operations
     * @returns {boolean}
     */
    isReady() {
        return this.state.initialized && !this.state.syncing && this.state.connected;
    }

    /**
     * Clean up resources
     * @returns {Promise<void>}
     */
    async disconnect() {
        if (this.network) {
            await this.network.disconnect();
        }
        this.state.connected = false;
        this.state.initialized = false;
    }
}

export default NimiqNodeService;
