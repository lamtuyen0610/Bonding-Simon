import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Table2,
  ListChecks,
  HelpCircle,
  BookOpen,
  Sliders,
  LogOut,
} from "lucide-react";
import Logo from "../../components/Logo";
import { useAdminAuth } from "../../contexts/AdminAuthContext";

const NAV = [
  { to: "/admin", label: "Tổng quan", icon: LayoutDashboard, end: true },
  { to: "/admin/teams", label: "Đội chơi", icon: Users },
  { to: "/admin/progress", label: "Tiến độ trực tiếp", icon: Table2 },
  { to: "/admin/review", label: "Hàng đợi chấm", icon: ListChecks },
  { to: "/admin/questions", label: "Câu hỏi", icon: HelpCircle },
  { to: "/admin/story", label: "Diễn biến vụ án", icon: BookOpen },
  { to: "/admin/controls", label: "Điều khiển game", icon: Sliders },
];

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-panel/40">
        <div className="p-5">
          <Logo size="sm" />
        </div>
        <nav className="flex lg:flex-col gap-1 px-3 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition ${
                  isActive ? "bg-purple/20 text-purple-soft" : "text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden lg:block px-5 py-4 mt-4 border-t border-white/10">
          <p className="text-xs text-white/40 mb-2">Đăng nhập với {admin?.displayName}</p>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-white/50 hover:text-red-300 transition">
            <LogOut size={15} /> Đăng xuất
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 px-4 sm:px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
