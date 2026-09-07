export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10 sm:px-12">
      <header className="border-b border-slate-200 pb-6">
        <span className="text-lg font-semibold tracking-tight">Property Tax Helper</span>
      </header>
      <section aria-labelledby="welcome" className="my-auto max-w-3xl py-24">
        <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-teal-800">
          Travis County, Texas
        </p>
        <h1 id="welcome" className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
          A clearer view of your property taxes.
        </h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
          We’re building a place for homeowners to explore property assessments
          and understand the public records behind them.
        </p>
        <p className="mt-9 inline-block rounded-full bg-teal-50 px-4 py-2 text-sm font-medium text-teal-900">
          Coming soon · Property search is not available yet
        </p>
      </section>
      <footer className="border-t border-slate-200 pt-6 text-sm leading-6 text-slate-500">
        An independent project. Not affiliated with the Travis Central Appraisal District.
      </footer>
    </main>
  );
}
