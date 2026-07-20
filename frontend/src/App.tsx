import { Routes, Route, Navigate } from "react-router-dom";
import { TeamAuthProvider, useTeamAuth } from "./contexts/TeamAuthContext";
import { AdminAuthProvider, useAdminAuth } from "./contexts/AdminAuthContext";
import { ToastProvider } from "./contexts/ToastContext";

import JoinPage from "./pages/player/JoinPage";
import InstructionsPage from "./pages/player/InstructionsPage";
import DashboardPage from "./pages/player/DashboardPage";
import QuestionDetailPage from "./pages/player/QuestionDetailPage";
import LeaderboardPage from "./pages/player/LeaderboardPage";
import StoryPage from "./pages/player/StoryPage";

import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminLayout from "./pages/admin/AdminLayout";
import OverviewPage from "./pages/admin/OverviewPage";
import TeamsPage from "./pages/admin/TeamsPage";
import TeamDetailPage from "./pages/admin/TeamDetailPage";
import ProgressTablePage from "./pages/admin/ProgressTablePage";
import ReviewQueuePage from "./pages/admin/ReviewQueuePage";
import QuestionsConfigPage from "./pages/admin/QuestionsConfigPage";
import StoryManagementPage from "./pages/admin/StoryManagementPage";
import GameControlsPage from "./pages/admin/GameControlsPage";

function RequireTeam({ children }: { children: JSX.Element }) {
  const { team, loading } = useTeamAuth();
  if (loading) return <FullScreenLoading />;
  if (!team) return <Navigate to="/join" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { admin, loading } = useAdminAuth();
  if (loading) return <FullScreenLoading />;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}

function FullScreenLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="eyebrow">Đang tải...</p>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
    <TeamAuthProvider>
      <AdminAuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/join" replace />} />
          <Route path="/join" element={<JoinPage />} />
          <Route
            path="/instructions"
            element={
              <RequireTeam>
                <InstructionsPage />
              </RequireTeam>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireTeam>
                <DashboardPage />
              </RequireTeam>
            }
          />
          <Route
            path="/question/:questionId"
            element={
              <RequireTeam>
                <QuestionDetailPage />
              </RequireTeam>
            }
          />
          <Route
            path="/leaderboard"
            element={
              <RequireTeam>
                <LeaderboardPage />
              </RequireTeam>
            }
          />
          <Route
            path="/story"
            element={
              <RequireTeam>
                <StoryPage />
              </RequireTeam>
            }
          />

          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="teams/:teamId" element={<TeamDetailPage />} />
            <Route path="progress" element={<ProgressTablePage />} />
            <Route path="review" element={<ReviewQueuePage />} />
            <Route path="questions" element={<QuestionsConfigPage />} />
            <Route path="story" element={<StoryManagementPage />} />
            <Route path="controls" element={<GameControlsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/join" replace />} />
        </Routes>
      </AdminAuthProvider>
    </TeamAuthProvider>
    </ToastProvider>
  );
}
