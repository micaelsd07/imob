import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './lib/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PropertyEditor from './pages/PropertyEditor';
import PublicTour from './pages/PublicTour';
import Guide from './pages/Guide';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/painel" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/painel/guia" element={<RequireAuth><Guide /></RequireAuth>} />
          <Route path="/painel/imoveis/:id" element={<RequireAuth><PropertyEditor /></RequireAuth>} />
          <Route path="/tour/:slug" element={<PublicTour />} />
          <Route path="*" element={<Navigate to="/painel" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
