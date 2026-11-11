/**
 * Offers store tests — CRUD + normalization + expiry helpers.
 * Sync queue and notification reminders are mocked so flows run offline.
 */
jest.mock('../../../services/notificationService', () => ({
  refreshOfferReminders: jest.fn(async () => {}),
  scheduleAllReminders: jest.fn(async () => {}),
}));
jest.mock('../../../services/syncQueue', () => ({
  enqueue: jest.fn(async () => {}),
  processSyncQueue: jest.fn(async () => {}),
  getQueueLength: jest.fn(() => 0),
}));

import { useOffersStore, isExpired, daysUntilExpiry, type Offer } from '../store';

const baseOffer: Omit<Offer, 'id'> = {
  title: 'Myntra 10% off',
  merchant: 'Myntra',
  category: 'Shopping',
  couponCode: 'TEN10',
  discountValue: '10%',
  minSpendPaise: 100000,
  expiresOn: '2026-12-31',
  notes: 'min order ₹1,000',
};

const reset = () => useOffersStore.setState({ offers: [] });

describe('Offers store', () => {
  beforeEach(reset);

  it('adds an offer and returns its id', () => {
    const { addOffer } = useOffersStore.getState();
    const id = addOffer(baseOffer, 'u1');

    const offers = useOffersStore.getState().offers;
    expect(offers).toHaveLength(1);
    expect(offers[0].id).toBe(id);
    expect(offers[0].title).toBe('Myntra 10% off');
    expect(offers[0].minSpendPaise).toBe(100000);
    expect(offers[0].expiresOn).toBe('2026-12-31');
  });

  it('normalizes missing optional fields on create', () => {
    const { addOffer } = useOffersStore.getState();
    addOffer({
      title: 'Bare coupon',
      merchant: '',
      category: '',
      couponCode: '',
      discountValue: '',
      minSpendPaise: undefined as unknown as null,
      expiresOn: '2026-11-20',
      notes: '',
    });

    const offer = useOffersStore.getState().offers[0];
    expect(offer.merchant).toBe('');
    expect(offer.category).toBe('');
    expect(offer.couponCode).toBe('');
    expect(offer.minSpendPaise).toBeNull();
  });

  it('merges partial updates via updateOffer', () => {
    const { addOffer, updateOffer } = useOffersStore.getState();
    const id = addOffer(baseOffer);
    updateOffer(id, { couponCode: 'NEWCODE', minSpendPaise: null });

    const offer = useOffersStore.getState().offers[0];
    expect(offer.couponCode).toBe('NEWCODE');
    expect(offer.minSpendPaise).toBeNull();
    expect(offer.title).toBe('Myntra 10% off');
  });

  it('ignores updates for unknown ids', () => {
    const { addOffer, updateOffer } = useOffersStore.getState();
    const id = addOffer(baseOffer);
    updateOffer('nope', { title: 'Ghost' });

    const offers = useOffersStore.getState().offers;
    expect(offers).toHaveLength(1);
    expect(offers[0].id).toBe(id);
    expect(offers[0].title).toBe('Myntra 10% off');
  });

  it('deletes an offer', () => {
    const { addOffer, deleteOffer } = useOffersStore.getState();
    const a = addOffer(baseOffer);
    addOffer({ ...baseOffer, title: 'Second' });
    deleteOffer(a);

    const offers = useOffersStore.getState().offers;
    expect(offers).toHaveLength(1);
    expect(offers[0].title).toBe('Second');
  });
});

describe('Offers expiry helpers', () => {
  it('isExpired uses the IST day comparison', () => {
    expect(isExpired({ expiresOn: '2026-11-10' }, '2026-11-11')).toBe(true);
    expect(isExpired({ expiresOn: '2026-11-11' }, '2026-11-11')).toBe(false);
    expect(isExpired({ expiresOn: '2026-12-01' }, '2026-11-11')).toBe(false);
  });

  it('daysUntilExpiry counts calendar days between IST days', () => {
    expect(daysUntilExpiry({ expiresOn: '2026-11-13' }, '2026-11-11')).toBe(2);
    expect(daysUntilExpiry({ expiresOn: '2026-11-11' }, '2026-11-11')).toBe(0);
    expect(daysUntilExpiry({ expiresOn: '2026-11-10' }, '2026-11-11')).toBe(-1);
  });
});
