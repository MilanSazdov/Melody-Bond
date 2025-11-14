export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-300">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-gray-400">Loading governance data...</p>
        </div>
      </div>
    </div>
  )
}
