import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Header from './components/Header';
import ClasificacionPage from './pages/ClasificacionPage';
import EquiposPage from './pages/EquiposPage';
import PartidosPage from './pages/PartidosPage';
import InfoPage from './pages/InfoPage';
import './styles/global.css';

export default function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<ClasificacionPage />} />
        <Route path="/equipos" element={<EquiposPage />} />
        <Route path="/partidos" element={<PartidosPage />} />
        <Route path="/info" element={<InfoPage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
