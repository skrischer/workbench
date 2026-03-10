import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import RunsPage from './pages/RunsPage.js';
import RunDetailPage from './pages/RunDetailPage.js';
import { PlansPage } from './pages/PlansPage.js';
import { PlanDetailPage } from './pages/PlanDetailPage.js';
import { SessionsPage } from './pages/SessionsPage.js';

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
          <Link to="/sessions" className="text-blue-600 hover:text-blue-800 underline">
            View Sessions
          </Link>
        </nav>
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
        <Route path="/runs/:id" element={<RunDetailPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/plans/:id" element={<PlanDetailPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
