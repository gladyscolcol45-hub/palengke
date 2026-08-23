export default function PrivacyPage() {
  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-stone-500 text-sm mb-6">Last updated: {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="flex flex-col gap-4 text-stone-700">
        <div>
          <h2 className="font-semibold text-stone-900 mb-1">What we collect</h2>
          <p>
            Your username, full name, phone number, barangay/city, profile photo, listings,
            messages, and reviews you post. We also store technical account info like your
            username and encrypted password, handled by our database provider, Supabase.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">How we use it</h2>
          <p>
            To show your listings and profile to other users, connect buyers and sellers through
            chat, show your general location (barangay/city) so nearby listings are easy to find,
            and to keep the marketplace safe (reports, blocks, reviews).
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">Who can see it</h2>
          <p>
            Your name, photo, listings, and reviews are visible to other Palengke users. Your
            phone number is only visible to you unless you choose to share it in a chat. We don&apos;t
            sell your data to third parties.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">Your control over your data</h2>
          <p>
            You can update your profile info anytime in Settings. You can also permanently delete
            your account and all associated data — see the Delete account section in Settings.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">Contact</h2>
          <p>
            Questions about your data? Email{' '}
            <a href="mailto:palengke.app23@gmail.com" className="text-green-700 underline">
              palengke.app23@gmail.com
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
