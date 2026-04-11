export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-4">Protocol</h1>
      <p className="text-gray-400 mb-8">Your personal wellness protocol tracker.</p>
      
      <a
        href="/calculator"
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded"
      >
        Open Reconstitution Calculator
      </a>
    </main>
  )
}
