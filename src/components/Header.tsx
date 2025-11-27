import { Moon, Sun, LogOut, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

interface HeaderProps {
  user?: {
    username: string;
    role?: string;
  };
  onLogout?: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <div className="container flex h-16 md:h-20 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 md:gap-3">
          <img 
            src={logo} 
            alt="Fine Gas Limited" 
            className="h-10 w-10 md:h-14 md:w-14 object-contain"
          />
          <div className="flex flex-col">
            <h1 className="text-sm md:text-xl font-bold text-primary">Fine Gas Limited</h1>
            <span className="text-xs md:text-sm text-muted-foreground hidden sm:block">Quality Gas Supply</span>
          </div>
        </Link>

        <div className="flex items-center gap-1 md:gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 md:h-10 md:w-10"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 md:h-5 md:w-5" />
            ) : (
              <Moon className="h-4 w-4 md:h-5 md:w-5" />
            )}
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 md:gap-2 h-8 md:h-10 text-xs md:text-sm px-2 md:px-4">
                  <User className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline max-w-[100px] md:max-w-none truncate">{user.username}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card z-50">
                <DropdownMenuItem asChild>
                  <Link to="/settings" className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                {onLogout && (
                  <DropdownMenuItem onClick={onLogout} className="flex items-center gap-2 text-destructive">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
