export default function TermsPage() {
  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Terms of Service</h1>
      <p className="text-stone-500 text-sm mb-6">Last updated: {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

      <div className="flex flex-col gap-4 text-stone-700">
        <p>
          By using Palengke, you agree to these terms. If you don&apos;t agree, please don&apos;t
          use the app.
        </p>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">What Palengke is</h2>
          <p>
            Palengke is a platform that connects buyers and sellers in the same neighborhood. We
            do not own, inspect, or guarantee any item listed, and we are not a party to any deal
            made between users. Transactions, payment, and delivery are arranged directly between
            buyer and seller.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">Your account</h2>
          <p>
            You&apos;re responsible for the accuracy of your listings and messages, and for
            keeping your account secure. Don&apos;t impersonate someone else or share your
            password.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">Prohibited use</h2>
          <p>
            No scams, fraud, harassment, illegal items, or content that violates Philippine law.
            We may remove listings, suspend, or delete accounts that break these rules — see our
            Report a listing and Block user features.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">No warranty</h2>
          <p>
            Palengke is provided &quot;as is,&quot; without guarantees that it will always be
            available, error-free, or that any listing is accurate or safe. Use your judgment when
            meeting people and exchanging goods or money.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">Changes</h2>
          <p>
            We may update these terms as Palengke grows. Continuing to use the app after a change
            means you accept the update.
          </p>
        </div>

        <div>
          <h2 className="font-semibold text-stone-900 mb-1">Contact</h2>
          <p>
            Questions about these terms? Email{' '}
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
