export default function MemberDashboard() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold text-gray-900">Member Dashboard</h1>

        <p className="mt-2 text-gray-600">Welcome to your member dashboard!</p>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-gray-500">Total Loans</h2>
            <p className="mt-2 text-3xl font-bold">0</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-gray-500">Outstanding Balance</h2>
            <p className="mt-2 text-3xl font-bold">₱0.00</p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-gray-500">Payments Made</h2>
            <p className="mt-2 text-3xl font-bold">0</p>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold">Account Overview</h2>
          <p className="mt-3 text-gray-500">
            Your account information will appear here.
          </p>
        </div>
      </div>
    </main>
  );
}
