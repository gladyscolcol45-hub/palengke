export default function AboutPage() {
  return (
    <div className="max-w-lg mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">About Palengke</h1>
      <p className="text-stone-700 mb-4">
        Palengke is a neighborhood marketplace app for buying and selling with people near you —
        produce, home goods, and anything else your community wants to trade. The name comes from
        the Filipino word for a public market.
      </p>
      <p className="text-stone-700 mb-4">
        Palengke is an independent project, not affiliated with any government agency or existing
        market.
      </p>
      <p className="text-stone-700">
        Questions or feedback? Reach out at{' '}
        <a href="mailto:gladyscolcol45@gmail.com" className="text-green-700 underline">
          gladyscolcol45@gmail.com
        </a>
        .
      </p>
    </div>
  );
}
