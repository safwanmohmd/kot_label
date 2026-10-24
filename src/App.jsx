import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { ToastProvider } from './lib/useToast.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AdminUserManager from './pages/AdminUserManager.jsx';
import { APP_ROUTES } from './config/routes.js';

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppShell>
            <Routes>
              {/* Dynamically build all application routes from the config */}
              {APP_ROUTES.map(({ id, path, component: Component, inherits }) => (
                <Route
                  key={id}
                  path={path}
                  element={
                    <ProtectedRoute permissionKey={inherits || id}>
                      <Component />
                    </ProtectedRoute>
                  }
                />
              ))}

              {/* Dedicated Admin Page */}
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute>
                    <AdminUserManager />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </AppShell>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;