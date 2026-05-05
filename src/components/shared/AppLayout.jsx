import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useAppRole } from "@/lib/useCurrentUser";
import Logo from "./Logo";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import MessagingBadge from "./MessagingBadge";

// Map role → their profile/home route
const ROLE_PROFILE_ROUTE = {
  agent: "/profile",
  admin: "/admin",
  psychologist: "/psych",
  citizen: "/citizen",
};

export default function AppLayout({ navItems = [], roleLabel }) {
  const { user } = useAuth();
  const role = useAppRole();
  const navigate = useNavigate();
  const profileRoute = ROLE_PROFILE_ROUTE[role] || "/citizen";

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo size="md" />
            {roleLabel && (
              <span className="hidden md:inline-flex text-[10px] font-medium uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 px-2.5 py-1 rounded-full">
                {roleLabel}
              </span>
            )}
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`
                }
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1">
          <MessagingBadge />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 flex items-center justify-center">
                  <UserIcon className="w-4 h-4" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{user?.full_name}</span>
                  <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {role === "agent" && (
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <UserIcon className="w-4 h-4 mr-2" /> Meu Perfil
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto scrollbar-thin">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground"
                }`
              }
            >
              {item.icon && <item.icon className="w-3.5 h-3.5" />}
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}