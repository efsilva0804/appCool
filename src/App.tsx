import React from 'react';
import { BrowserRouter, Routes, Route, Link, Outlet, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './context/AuthContext';
import { loginWithGoogle, logout } from './firebase';
import { LayoutDashboard, CalendarPlus, LogOut, LogIn, RefreshCw } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AdminPanel from './pages/AdminPanel';
import Reserve from './pages/Reserve';
import Home from './pages/Home';

function Navbar() {
  const { profile, isDemo, logoutDemo } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const handleLogoutClick = () => {
    if (isDemo) {
      logoutDemo();
    } else {
      logout();
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between h-16">
        <div className="flex">
          <div className="flex-shrink-0 flex items-center">
            <span className="font-bold text-xl text-emerald-700">Agenda Terapêutica</span>
            {isDemo && (
              <span className="ml-2 bg-amber-150 text-amber-800 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-amber-300">
                Modo Demo
              </span>
            )}
          </div>
          {profile && (
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {isAdmin ? (
                <>
                  <Link to="/admin" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-emerald-500 text-sm font-medium text-gray-500 hover:text-gray-900">
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Painel Admin
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/dashboard" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-emerald-500 text-sm font-medium text-gray-500 hover:text-gray-900">
                    <LayoutDashboard className="w-4 h-4 mr-2" /> Meu Dashboard
                  </Link>
                  <Link to="/reserve" className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent hover:border-emerald-500 text-sm font-medium text-gray-500 hover:text-gray-900">
                    <CalendarPlus className="w-4 h-4 mr-2" /> Nova Reserva
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center">
          {profile ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 font-medium">{profile.nome}</span>
              {!isAdmin && <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-medium">{profile.saldo_horas}h</span>}
              <button onClick={handleLogoutClick} className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button onClick={loginWithGoogle} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700">
              <LogIn className="w-4 h-4 mr-2" /> Entrar
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode; allowedRole?: 'admin' | 'professional' }) {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
        <span>Carregando...</span>
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && profile.role !== allowedRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRole="professional"><Dashboard /></ProtectedRoute>} />
            <Route path="/reserve" element={<ProtectedRoute allowedRole="professional"><Reserve /></ProtectedRoute>} />
            <Route path="/admin/*" element={<ProtectedRoute allowedRole="admin"><AdminPanel /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
