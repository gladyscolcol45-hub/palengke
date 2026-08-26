// Shared list of manual payment options shown across every "pay then submit
// proof" flow in the app (Verified Seller, boosted listings, booking
// commission). Adding a new option here (e.g. another e-wallet) makes it
// available everywhere at once.
export const PAYMENT_METHODS = [
  {
    value: 'gcash',
    label: 'GCash',
    lines: ['GCash: GL***S C.', '0963 307 7826'],
    qrImage: '/gcash-qr.png',
  },
  {
    value: 'gotyme',
    label: 'GoTyme Bank',
    lines: ['GoTyme Bank: GLADYS COLCOL', 'Account number: 0182 9410 9998'],
    qrImage: '/gotyme-qr.png',
  },
];

export function getPaymentMethod(value) {
  return PAYMENT_METHODS.find((m) => m.value === value) || PAYMENT_METHODS[0];
}
