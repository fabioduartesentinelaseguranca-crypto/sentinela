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
import PsychologistLayout from '@/components/shared/PsychologistLayout';

// Pages
import Home from './pages/Home';
import CitizenDashboard from './pages/CitizenDashboard';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Ranking from './pages/Ranking';
import DisguisedMode from './pages/DisguisedMode';
import MessagingCenter from './pages/MessagingCenter';
import TrainingCenter from './pages/TrainingCenter';
import AgentProfile from './pages/AgentProfile';
import TeamAchievements from './pages/TeamAchievements';
import PsychologistDashboard from './pages/PsychologistDashboard';
import WantedBoard from './pages/WantedBoard';
import AccessDeniedPage from './pages/AccessDenied';
import RoleGuard from '@/components/shared/RoleGuard';
import UserManual from './pages/UserManual';
import NotificationPreferences from './pages/NotificationPreferences';

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
      <Route path="/403" element={<AccessDeniedPage />} />

      {/* Admin routes */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<RoleGuard allow={["admin"]}><AdminDashboard /></RoleGuard>} />
        <Route path="/wanted" element={<RoleGuard allow={["admin"]}><WantedBoard /></RoleGuard>} />
        <Route path="/notifications" element={<NotificationPreferences />} />
      </Route>

      {/* Psychologist routes */}
      <Route element={<PsychologistLayout />}>
        <Route path="/psych" element={<RoleGuard allow={["psychologist", "admin"]}><PsychologistDashboard /></RoleGuard>} />
      </Route>

      {/* Citizen routes — role: citizen */}
      <Route element={<CitizenLayout />}>
        <Route path="/citizen" element={<RoleGuard allow={["citizen"]}><CitizenDashboard /></RoleGuard>} />
        <Route path="/ranking" element={<RoleGuard allow={["citizen"]}><Ranking /></RoleGuard>} />
        <Route path="/notifications" element={<NotificationPreferences />} />
      </Route>

      {/* Agent routes — role: agent */}
      <Route element={<AgentLayout />}>
        <Route path="/agent" element={<RoleGuard allow={["agent"]}><AgentDashboard /></RoleGuard>} />
        <Route path="/messages" element={<RoleGuard allow={["agent"]}><MessagingCenter /></RoleGuard>} />
        <Route path="/training" element={<RoleGuard allow={["agent"]}><TrainingCenter /></RoleGuard>} />
        <Route path="/profile" element={<RoleGuard allow={["agent"]}><AgentProfile /></RoleGuard>} />
        <Route path="/achievements" element={<RoleGuard allow={["agent"]}><TeamAchievements /></RoleGuard>} />
        <Route path="/notifications" element={<NotificationPreferences />} />
      </Route>

      {/* Manual — accessible to all logged in users */}
      <Route path="/manual" element={<UserManual />} />

      {/* Disguised mode — no layout, no role restriction */}
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