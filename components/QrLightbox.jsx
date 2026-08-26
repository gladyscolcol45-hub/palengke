'use client';

// Full-screen viewer for a tapped QR code image, with an X button (and a
// tap-outside / Escape) to close it. Shared by every "pay then submit proof"
// screen (Settings, boost payments, booking commission) so the enlarge
// behavior looks and works the same everywhere.
export default function QrLightbox({ src, alt, onClose }) {
  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white text-stone-800 text-2xl leading-none flex items-center justify-center shadow-lg"
      >
        &times;
      </button>
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full object-contain rounded-lg bg-white"
      />
    </div>
  );
}
