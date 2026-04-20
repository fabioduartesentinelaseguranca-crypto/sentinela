import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Layouts
import CitizenLayout from '@/components/shared/CitizenLayout';
import AgentLayout from '@/components/shared/AgentLayout';
import AdminLayout from '@/components/shared/AdminLayout';

// Pages
import Home from './pages/Home';
import CitizenDashboard from './pages/CitizenDashboard';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Ranking from './pages/Ranking';
import DisguisedMode from './pages/DisguisedMode';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />

      {/* Citizen routes */}
      <Route element={<CitizenLayout />}>
        <Route path="/citizen" element={<CitizenDashboard />} />
        <Route path="/ranking" element={<Ranking />} />
      </Route>

      {/* Agent routes */}
      <Route element={<AgentLayout />}>
        <Route path="/agent" element={<AgentDashboard />} />
      </Route>

      {/* Admin routes */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>

      {/* Disguised mode — no layout */}
      <Route path="/disguise" element={<DisguisedMode />} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;