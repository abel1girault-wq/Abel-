import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, ShoppingCart, Menu, X, Terminal } from 'lucide-react';
import { ADMIN_PASSWORD } from '../constants';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  cartCount: number;
  onOpenCart: () => void;
}

export const Navbar = ({ cartCount, onOpenCart }: NavbarProps) => {
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem('fidgethub_auth', 'true');
      setShowAdminLogin(false);
      setPassword('');
      setError(false);
      navigate('/admin');
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200 h-14 flex items-center px-6 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold leading-none shadow-lg shadow-indigo-100">
          <Shield className="w-4 h-4" />
        </div>
        <Link to="/" className="text-lg font-bold tracking-tight text-slate-800">
          3D Fidget Control
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-3">
        {/* Admin Login Box Embedded Style */}
        <div className="hidden md:flex items-center gap-2 bg-slate-50 p-1 rounded-md border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 px-2 tracking-wider flex items-center gap-1">
            <Terminal className="w-3 h-3" /> Admin Portal
          </span>
          <button 
            onClick={() => setShowAdminLogin(!showAdminLogin)}
            className="bg-indigo-600 text-white px-3 py-1 text-xs font-semibold rounded hover:bg-indigo-700 transition-colors uppercase"
          >
            Access
          </button>
        </div>
        
        <button 
          onClick={onOpenCart}
          className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-indigo-600 outline-none"
        >
          <ShoppingCart className="w-5 h-5" />
          <AnimatePresence>
            {cartCount > 0 && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute top-1 right-1 w-4 h-4 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white"
              >
                {cartCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Admin Login Box - Modified to match High Density look */}
      <AnimatePresence>
        {showAdminLogin && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="absolute top-14 right-6 w-72 bg-white border border-slate-200 p-5 shadow-xl rounded-xl z-[100]"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Credential Entry
              </span>
              <button onClick={() => setShowAdminLogin(false)}>
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1.5 block">Access Key</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all ${error ? 'border-red-500 bg-red-50' : ''}`}
                  placeholder="Password..."
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-xs uppercase tracking-wider transition-all shadow-sm"
              >
                Establish Link
              </button>
              {error && (
                <p className="text-[10px] text-red-500 font-bold text-center uppercase tracking-tighter">Auth Failure: Invalid Key</p>
              )}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
