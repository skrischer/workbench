import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Workbench Dashboard</h1>
        <p className="text-lg text-gray-600">AI Dev OS — Monitor runs, plans, and agents</p>
        
        <nav className="mt-8 space-x-4">
          <Link to="/runs" className="text-blue-600 hover:text-blue-800 underline">
            View Runs
          </Link>
          <Link to="/plans" className="text-blue-600 hover:text-blue-800 underline">
            View Plans
          </Link>
        </nav>
      </div>
    </div>
  );
}

function RunsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Runs</h1>
        <p className="text-gray-600">Agent execution history will appear here.</p>
        
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:text-blue-800 underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}

function PlansPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Plans</h1>
        <p className="text-gray-600">Task plans and steps will appear here.</p>
        
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:text-blue-800 underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/runs" element={<RunsPage />} />
        <Route path="/plans" element={<PlansPage />} />
      </Routes>
    </BrowserRouter>
  );
}
