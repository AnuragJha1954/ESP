import { Activity, Maximize2, Sliders, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bottom-nav">
      <button onClick={() => navigate('/dashboard')} className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
        <Sliders size={24} />
      </button>
      <button onClick={() => navigate('/trade')} className={`nav-item ${isActive('/trade') ? 'active' : ''}`}>
        <Activity size={24} />
      </button>
      <button onClick={() => navigate('/history')} className={`nav-item ${isActive('/history') ? 'active' : ''}`}>
        <Maximize2 size={24} />
      </button>
      <button onClick={() => navigate('/profile')} className={`nav-item ${isActive('/profile') ? 'active' : ''}`}>
        <User size={24} />
      </button>
    </nav>
  );
}
