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
        style={{ background: "linear-gradient(135deg, #f08080, #f4978e)" }}
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
        <div className="absolute top-12 right-0 bg-white sketch-panel border-2 border-black/5 py-2 min-w-[200px] overflow-hidden shadow-lg">
          {isAuthenticated ? (
            <>
              {/* User Info */}
              <div className="px-4 py-2.5 flex items-center gap-3 border-b border-gray-200 mb-2">
                <div className="w-8 h-8 bg-[#f08080] rounded-full flex items-center justify-center overflow-hidden">
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
                  <div className="font-semibold text-sm text-gray-800 truncate">
                    {user.displayName || user.username}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {user.email}
                  </div>
                </div>
              </div>

              {/* Profile (only show for non-guest users) */}
              {!user.isGuest && (
                <>
                  <button
                    onClick={() => handleNavigation("/profile")}
                    className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center gap-3 transition-colors group"
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                      <UserCircle
                        size={16}
                        strokeWidth={2.5}
                        className="text-gray-500 group-hover:text-indigo-600"
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-gray-800">
                        Profile
                      </div>
                      <div className="text-[10px] text-gray-500">
                        Edit name & password
                      </div>
                    </div>
                  </button>

                  <div className="h-px bg-gray-200 my-2" />
                </>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2.5 text-left hover:bg-red-50 flex items-center gap-3 transition-colors group"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-red-100 transition-colors">
                  <LogOut
                    size={16}
                    strokeWidth={2.5}
                    className="text-gray-500 group-hover:text-red-600"
                  />
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-800">
                    Logout
                  </div>
                  <div className="text-[10px] text-gray-500">Sign out</div>
                </div>
              </button>
            </>
          ) : (
            <>
              {/* Login */}
              <button
                onClick={() => handleNavigation("/login")}
                className="w-full px-4 py-2.5 text-left hover:bg-indigo-50 flex items-center gap-3 transition-colors group"
              >
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <LogIn
                    size={16}
                    strokeWidth={2.5}
                    className="text-gray-500 group-hover:text-indigo-600"
                  />
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-800">
                    Login / Register
                  </div>
                  <div className="text-[10px] text-gray-500">
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
