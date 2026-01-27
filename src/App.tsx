function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <header className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Snorting Code
            </h1>
            <p className="text-xl text-gray-600">
              React + TypeScript + Tailwind CSS + CI/CD
            </p>
          </header>

          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              🚀 Project Setup Complete
            </h2>
            <p className="text-gray-600 mb-4">
              Your React project is ready with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600 mb-6">
              <li>⚛️ React 18 with TypeScript</li>
              <li>🎨 Tailwind CSS for styling</li>
              <li>⚡ Vite for fast development</li>
              <li>✅ Comprehensive CI/CD pipeline</li>
              <li>🧪 Jest + Testing Library</li>
              <li>🔍 ESLint + Prettier</li>
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                🛠️ Development
              </h3>
              <code className="block bg-gray-100 p-3 rounded text-sm mb-2">
                npm run dev
              </code>
              <p className="text-sm text-gray-600">
                Start the development server
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                🧪 Testing
              </h3>
              <code className="block bg-gray-100 p-3 rounded text-sm mb-2">
                npm test
              </code>
              <p className="text-sm text-gray-600">
                Run tests with coverage
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                🏗️ Build
              </h3>
              <code className="block bg-gray-100 p-3 rounded text-sm mb-2">
                npm run build
              </code>
              <p className="text-sm text-gray-600">
                Build for production
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-3">
                ✨ Code Quality
              </h3>
              <code className="block bg-gray-100 p-3 rounded text-sm mb-2">
                npm run lint
              </code>
              <p className="text-sm text-gray-600">
                Lint and format code
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
