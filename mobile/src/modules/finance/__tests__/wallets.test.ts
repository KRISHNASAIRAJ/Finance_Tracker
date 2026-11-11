/**
 * Wallets — the wallet slice of the finance store: seeding the standard
 * providers, updating balances and deleting rows.
 */
jest.mock('../../../services/syncQueue', () => ({
  enqueue: jest.fn(async () => {}),
  processSyncQueue: jest.fn(async () => {}),
  getQueueLength: jest.fn(() => 0),
}));

import { useFinanceStore, WALLET_PROVIDERS } from '../store';

const reset = () => useFinanceStore.setState({ wallets: [] });

describe('Finance store — wallets', () => {
  beforeEach(reset);

  it('seeds every standard provider once, with a zero balance', () => {
    useFinanceStore.getState().seedWallets('u1');
    const wallets = useFinanceStore.getState().wallets;
    expect(wallets).toHaveLength(WALLET_PROVIDERS.length);
    expect(wallets.map((w) => w.name)).toEqual(WALLET_PROVIDERS.map((p) => p.name));
    expect(wallets.every((w) => w.amount === 0)).toBe(true);

    // Seeding again must not duplicate rows
    useFinanceStore.getState().seedWallets('u1');
    expect(useFinanceStore.getState().wallets).toHaveLength(WALLET_PROVIDERS.length);
  });

  it('updates a wallet balance in paise', () => {
    useFinanceStore.getState().seedWallets('u1');
    const amazon = useFinanceStore.getState().wallets.find((w) => w.id === 'amazon_pay');
    expect(amazon).toBeDefined();

    useFinanceStore.getState().setWalletAmount('amazon_pay', 125000, 'u1');
    expect(useFinanceStore.getState().wallets.find((w) => w.id === 'amazon_pay')?.amount).toBe(125000);
  });

  it('never stores a negative or non-finite balance', () => {
    useFinanceStore.getState().seedWallets('u1');
    useFinanceStore.getState().setWalletAmount('paypal', -500, 'u1');
    expect(useFinanceStore.getState().wallets.find((w) => w.id === 'paypal')?.amount).toBe(0);

    useFinanceStore.getState().setWalletAmount('paypal', NaN, 'u1');
    expect(useFinanceStore.getState().wallets.find((w) => w.id === 'paypal')?.amount).toBe(0);
  });

  it('deletes a wallet row', () => {
    useFinanceStore.getState().seedWallets('u1');
    useFinanceStore.getState().deleteWallet('zepto', 'u1');
    expect(useFinanceStore.getState().wallets.find((w) => w.id === 'zepto')).toBeUndefined();
  });

  it('covers the wallets the user asked for', () => {
    const names = WALLET_PROVIDERS.map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['Amazon Pay', 'PayPal', 'PhonePe', 'Zepto', 'Blinkit', 'BigBasket'])
    );
  });
});
