import NimiqNodeService from '../NimiqNodeService';

// Mock Nimiq global object
global.Nimiq = {
    GenesisConfig: {
        main: jest.fn()
    },
    Consensus: {
        light: jest.fn().mockResolvedValue({
            blockchain: {
                height: 100,
                accounts: {
                    get: jest.fn()
                },
                getTransaction: jest.fn(),
                on: jest.fn()
            },
            mempool: {},
            network: {
                connect: jest.fn().mockResolvedValue(),
                disconnect: jest.fn().mockResolvedValue(),
                on: jest.fn(),
                peerCount: 1
            },
            on: jest.fn()
        })
    },
    Address: {
        fromString: jest.fn().mockReturnValue({})
    },
    Policy: {
        satoshisToCoins: jest.fn(satoshis => satoshis / 1e5)
    }
};

describe('NimiqNodeService', () => {
    let nimiqNode;

    beforeEach(() => {
        nimiqNode = new NimiqNodeService();
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await nimiqNode.initialize();
            
            expect(Nimiq.GenesisConfig.main).toHaveBeenCalled();
            expect(Nimiq.Consensus.light).toHaveBeenCalled();
            expect(nimiqNode.state.initialized).toBe(true);
        });

        it('should handle initialization errors', async () => {
            Nimiq.Consensus.light.mockRejectedValueOnce(new Error('Network error'));
            
            await expect(nimiqNode.initialize()).rejects.toThrow('Network error');
            expect(nimiqNode.state.initialized).toBe(false);
        });

        it('should reuse existing initialization', async () => {
            await nimiqNode.initialize();
            await nimiqNode.initialize();
            
            expect(Nimiq.Consensus.light).toHaveBeenCalledTimes(1);
        });
    });

    describe('balance checking', () => {
        beforeEach(async () => {
            await nimiqNode.initialize();
        });

        it('should get account balance', async () => {
            const mockBalance = 1000000; // 10 NIM in satoshis
            nimiqNode.accounts.get.mockResolvedValueOnce({ balance: mockBalance });

            const balance = await nimiqNode.getBalance('NQ07 0000 0000 0000 0000 0000 0000 0000');
            
            expect(balance).toBe(10); // 10 NIM
            expect(Nimiq.Address.fromString).toHaveBeenCalled();
        });

        it('should handle invalid addresses', async () => {
            Nimiq.Address.fromString.mockImplementationOnce(() => {
                throw new Error('Invalid address');
            });

            await expect(
                nimiqNode.getBalance('invalid-address')
            ).rejects.toThrow('Invalid address');
        });
    });

    describe('transaction verification', () => {
        const mockTx = {
            sender: { toUserFriendlyAddress: () => 'sender-address' },
            recipient: { toUserFriendlyAddress: () => 'recipient-address' },
            value: 1000000, // 10 NIM in satoshis
            fee: 10000,     // 0.1 NIM in satoshis
            height: 95,     // 5 confirmations (current height 100)
            timestamp: 1234567890
        };

        beforeEach(async () => {
            await nimiqNode.initialize();
            nimiqNode.blockchain.getTransaction.mockResolvedValueOnce(mockTx);
        });

        it('should verify transaction details', async () => {
            const txDetails = await nimiqNode.verifyTransaction('mock-tx-hash');
            
            expect(txDetails).toEqual({
                confirmations: 6,
                sender: 'sender-address',
                recipient: 'recipient-address',
                value: 10,
                fee: 0.1,
                timestamp: 1234567890
            });
        });

        it('should handle missing transactions', async () => {
            nimiqNode.blockchain.getTransaction.mockResolvedValueOnce(null);

            await expect(
                nimiqNode.verifyTransaction('non-existent-hash')
            ).rejects.toThrow('Transaction not found');
        });
    });

    describe('state management', () => {
        beforeEach(async () => {
            await nimiqNode.initialize();
        });

        it('should track blockchain state', () => {
            const state = nimiqNode.getState();
            
            expect(state).toEqual({
                initialized: true,
                syncing: false,
                height: 0,
                headHash: null,
                connected: false
            });
        });

        it('should check if node is ready', () => {
            nimiqNode.state.syncing = false;
            nimiqNode.state.connected = true;
            
            expect(nimiqNode.isReady()).toBe(true);
        });

        it('should handle disconnection', async () => {
            await nimiqNode.disconnect();
            
            expect(nimiqNode.state.connected).toBe(false);
            expect(nimiqNode.state.initialized).toBe(false);
            expect(nimiqNode.network.disconnect).toHaveBeenCalled();
        });
    });
});
