import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ModulosProvider } from '@/lib/useModulos.jsx';
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
import CentralDespacho from './pages/CentralDespacho';
import RotasSeguras from './pages/RotasSeguras';
import CaminheComigo from './pages/CaminheComigo';
import CaminheComigoViewer from './pages/CaminheComigoViewer';
import MasterDashboard from './pages/MasterDashboard';
import CercaVirtualEscolar from './pages/CercaVirtualEscolar';
import CadastroBiometricoEscolar from './pages/CadastroBiometricoEscolar';
import ConviteCliente from './pages/ConviteCliente';

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

      {/* Citizen routes — role: citizen */}
      <Route element={<CitizenLayout />}>
        <Route path="/citizen" element={<RoleGuard allow={["citizen"]}><CitizenDashboard /></RoleGuard>} />
        <Route path="/ranking" element={<RoleGuard allow={["citizen"]}><Ranking /></RoleGuard>} />
        <Route path="/rotas-seguras" element={<RoleGuard allow={["citizen"]}><RotasSeguras /></RoleGuard>} />
        <Route path="/caminhe-comigo" element={<RoleGuard allow={["citizen"]}><CaminheComigo /></RoleGuard>} />
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

      {/* Psychologist routes */}
      <Route element={<PsychologistLayout />}>
        <Route path="/psych" element={<RoleGuard allow={["psychologist"]}><PsychologistDashboard /></RoleGuard>} />
      </Route>

      {/* Admin routes — last so they don't override role-specific routes */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<RoleGuard allow={["admin"]}><AdminDashboard /></RoleGuard>} />
        <Route path="/wanted" element={<RoleGuard allow={["admin"]}><WantedBoard /></RoleGuard>} />
        <Route path="/notifications" element={<NotificationPreferences />} />
      </Route>

      {/* Manual — accessible to all logged in users */}
      <Route path="/manual" element={<UserManual />} />

      {/* Disguised mode — no layout, no role restriction */}
      <Route path="/disguise" element={<DisguisedMode />} />

      {/* Central de Despacho — tela full-screen, acesso para agentes e admins */}
      <Route path="/central" element={<RoleGuard allow={["agent", "admin"]}><CentralDespacho /></RoleGuard>} />
      <Route path="/cercas-escolares" element={<RoleGuard allow={["agent", "admin"]}><CercaVirtualEscolar /></RoleGuard>} />
      <Route path="/biometria-escolar" element={<RoleGuard allow={["agent", "admin"]}><CadastroBiometricoEscolar /></RoleGuard>} />

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <ModulosProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <Routes>
              {/* Public routes — no auth required */}
              <Route path="/caminhe-comigo/:token" element={<CaminheComigoViewer />} />
              <Route path="/convite/:token" element={<ConviteCliente />} />
              {/* Master dashboard — completely isolated, no auth provider */}
              <Route path="/master" element={<MasterDashboard />} />
              {/* Authenticated routes */}
              <Route path="*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ModulosProvider>
    </AuthProvider>
  );
}

export default App;