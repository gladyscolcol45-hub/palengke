export default function ListingCard({ listing }) {
  const photo = listing.photo_urls?.[0];

  return (
    <a
      href={`/listing/${listing.id}`}
      className="block rounded-lg border border-stone-200 bg-white overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-square bg-stone-100 flex items-center justify-center overflow-hidden">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-stone-400 text-sm">No photo</span>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold truncate">{listing.title}</p>
        <p className="text-orange-700 font-bold">
          ₱{Number(listing.price).toLocaleString()}
          <span className="text-stone-400 font-normal text-sm"> / {listing.unit}</span>
        </p>
        <p className="text-stone-500 text-xs mt-1">{listing.barangay}{listing.barangay && listing.city ? ', ' : ''}{listing.city}</p>
      </div>
    </a>
  );
}
