import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { User, LogOut, UserCircle, LogIn } from "lucide-react";

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    setIsOpen(false);
  };

  const handleNavigation = (path) => {
    navigate(path);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* User Avatar Button */}
      <button
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg cursor-pointer text-lg transition-transform hover:scale-105 overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--coral), var(--coral-deep))" }}
        title={
          isAuthenticated ? user?.displayName || user?.username : "Account"
        }
        onClick={() => setIsOpen(!isOpen)}
      >
        {isAuthenticated ? (
          user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <User size={16} className="text-white" />
          )
        ) : (
          "?"
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-12 right-0 paper-card sketch-panel border-2 border-[color:color-mix(in_srgb,var(--ink)_8%,transparent)] py-2 min-w-[200px] overflow-hidden">
          {isAuthenticated ? (
            <>
              {/* User Info */}
              <div className="px-4 py-2.5 flex items-center gap-3 border-b border-[color:color-mix(in_srgb,var(--ink)_10%,transparent)] mb-2">
                <div className="w-8 h-8 bg-[color:var(--coral)] rounded-full flex items-center justify-center overflow-hidden">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={16} className="text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-[color:var(--ink)] truncate">
                    {user.displayName || user.username}
                  </div>
                  <div className="text-[10px] text-[color:var(--ink-soft)] truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              {/* Profile (only show for non-guest users) */}
              {!user.isGuest && (
                <>
                  <button
                    onClick={() => handleNavigation("/profile")}
                    className="w-full px-4 py-2.5 text-left hover:bg-[color:color-mix(in_srgb,var(--coral)_10%,transparent)] flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] group-hover:bg-[color:color-mix(in_srgb,var(--coral)_18%,transparent)]">
                      <UserCircle
                        size={16}
                        strokeWidth={2.5}
                        className="text-[color:var(--ink-soft)] group-hover:text-[color:var(--coral-deep)]"
                      />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-[color:var(--ink)]">
                        Profile
                      </div>
                      <div className="text-[10px] text-[color:var(--ink-soft)]">
                        Edit name & password
                      </div>
                    </div>
                  </button>

                  <div className="h-px bg-[color:color-mix(in_srgb,var(--ink)_10%,transparent)] my-2" />
                </>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left hover:bg-[color:color-mix(in_srgb,#c0392b_9%,transparent)] flex items-center gap-3 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] group-hover:bg-[color:color-mix(in_srgb,#c0392b_16%,transparent)]">
                  <LogOut
                    size={16}
                    strokeWidth={2.5}
                    className="text-[color:var(--ink-soft)] group-hover:text-[#c0392b]"
                  />
                </div>
                <div>
                  <div className="font-bold text-sm text-[color:var(--ink)]">
                    Logout
                  </div>
                  <div className="text-[10px] text-[color:var(--ink-soft)]">Sign out</div>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* Login */}
              <button
                onClick={() => handleNavigation("/login")}
                className="w-full px-4 py-2.5 text-left hover:bg-[color:color-mix(in_srgb,var(--coral)_10%,transparent)] flex items-center gap-3 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-[color:color-mix(in_srgb,var(--ink)_7%,transparent)] group-hover:bg-[color:color-mix(in_srgb,var(--coral)_18%,transparent)]">
                  <LogIn
                    size={16}
                    strokeWidth={2.5}
                    className="text-[color:var(--ink-soft)] group-hover:text-[color:var(--coral-deep)]"
                  />
                </div>
                <div>
                  <div className="font-bold text-sm text-[color:var(--ink)]">
                    Login / Register
                  </div>
                  <div className="text-[10px] text-[color:var(--ink-soft)]">
                    Sign in to your account
                  </div>
                </div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
