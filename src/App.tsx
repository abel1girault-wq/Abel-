/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { AdminDashboard } from './components/AdminDashboard';
import { Cart } from './components/Cart';
import { MOCK_PRODUCTS } from './constants';
import { Product, CartItem } from './types';
import { motion } from 'motion/react';
import { Radar, ShoppingCart, Package, Shield } from 'lucide-react';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuth = localStorage.getItem('fidgethub_auth') === 'true';
  return isAuth ? <>{children}</> : <Navigate to="/" />;
};

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('fidgethub_products');
    if (stored) {
      setProducts(JSON.parse(stored));
    } else {
      setProducts(MOCK_PRODUCTS);
      localStorage.setItem('fidgethub_products', JSON.stringify(MOCK_PRODUCTS));
    }
  }, []);

  const addToCart = (product: Product) => {
    setCartItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const cartItemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Router>
      <div className="min-h-screen bg-tactical-bg selection:bg-tactical-accent selection:text-black">
        <Navbar cartCount={cartItemsCount} onOpenCart={() => setIsCartOpen(true)} />
        
        <Routes>
          <Route path="/" element={
            <main className="pt-14 pb-12 flex flex-col min-h-screen">
              {/* Hero Section - High Impact */}
              <section className="relative h-[80vh] flex items-center justify-center bg-white overflow-hidden shrink-0">
                <div className="absolute inset-0 pointer-events-none opacity-[0.4] bristol-grid" />
                <div className="relative z-10 px-6 max-w-7xl mx-auto text-center">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 mb-6 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">System Ready // Series 01 Launch</span>
                  </motion.div>
                  <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 uppercase leading-[0.9] mb-8">
                    Tactical <br />
                    <span className="text-indigo-600">Objects</span>
                  </h1>
                  <p className="text-lg text-slate-500 font-medium max-w-xl mx-auto leading-relaxed mb-10">
                    High-precision 3D printed mechanical interfaces. Designed for high-frequency interaction and sensory optimization.
                  </p>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button 
                      onClick={() => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })}
                      className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all"
                    >
                      View Collection
                    </button>
                    <button className="bg-white border border-slate-200 text-slate-800 px-8 py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all">
                      Specs & Data
                    </button>
                  </div>
                </div>
                
                {/* Visual Accent */}
                <div className="absolute bottom-10 left-10 flex flex-col gap-2 opacity-20 hidden lg:flex">
                  <div className="w-1 h-32 bg-slate-200" />
                  <span className="text-[10px] whitespace-nowrap rotate-90 origin-left mt-32 font-black text-slate-400 uppercase tracking-widest leading-none">Axis Control // 001</span>
                </div>
              </section>

              {/* Specs & Features - High Density Layout */}
              <section className="py-24 bg-slate-50 border-y border-slate-200 overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
                  <div className="space-y-4">
                    <div className="w-10 h-1 bg-indigo-600" />
                    <h3 className="text-xl font-black text-slate-800 uppercase italic">01. Precision</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">Microsm-accurate 3D printing ensures every gear and bearing assembly operates at maximum efficiency. Zero-tolerance fit for an elite feel.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="w-10 h-1 bg-slate-300" />
                    <h3 className="text-xl font-black text-slate-800 uppercase italic">02. Material</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">Reinforced industrial-grade filaments. Lightweight yet structurally superior composites resistant to impact and high-frequency wear.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="w-10 h-1 bg-slate-300" />
                    <h3 className="text-xl font-black text-slate-800 uppercase italic">03. Response</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">Engineered haptic feedback. Every rotation and click is tuned to provide a distinct, satisfying sensory anchor for your concentration.</p>
                  </div>
                </div>
              </section>

              {/* Main Collection Display */}
              <section id="collection" className="py-24 px-6 max-w-7xl mx-auto w-full">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                  <div>
                    <h2 className="text-3xl font-black tracking-tight text-slate-900 uppercase leading-none mb-3">
                      Current <span className="text-indigo-600">Manifest</span>
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      All units available for immediate departure. High availability in current sectors.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase text-slate-400">
                    <span className="flex items-center gap-2 underline underline-offset-4 decoration-indigo-600">All Items</span>
                    <span>/</span>
                    <span className="hover:text-indigo-600 cursor-pointer transition-colors">Limited Release</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {products.map(product => (
                    <ProductCard 
                      key={product.id} 
                      product={product} 
                      onAddToCart={addToCart} 
                    />
                  ))}
                </div>
              </section>

              {/* Information / About Section */}
              <section className="py-32 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[1px] bg-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.5)]" />
                <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                  <div>
                    <h2 className="text-4xl md:text-5xl font-black uppercase leading-[0.95] mb-8">
                      Built for <br />
                      <span className="text-indigo-500">Performance</span>
                    </h2>
                    <div className="space-y-6 text-slate-400 font-medium">
                      <p>FidgetHub isn't just a toy store. We are a sensory hardware lab focused on the intersection of mechanics and mindfulness.</p>
                      <p>Our goal is to replace mass-produced plastic with precision-engineered tools that you'll actually want on your desk for years to come.</p>
                    </div>
                    <div className="mt-10 flex items-center gap-8 text-xs font-black uppercase tracking-widest">
                      <div className="flex flex-col gap-1">
                        <span className="text-white">100% Custom</span>
                        <span className="text-indigo-500 text-[10px]">Hand Finished</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-white">Free Logistics</span>
                        <span className="text-indigo-500 text-[10px]">Global Nodes</span>
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="aspect-square bg-slate-800 rounded-3xl border border-slate-700 p-8 flex items-center justify-center relative overflow-hidden">
                       <div className="absolute inset-0 opacity-10 bristol-grid" />
                       <Radar className="w-32 h-32 text-indigo-500 animate-pulse" />
                    </div>
                    {/* Decorative bits */}
                    <div className="absolute -bottom-4 -right-4 w-32 h-32 border-b-2 border-r-2 border-indigo-500" />
                    <div className="absolute -top-4 -left-4 w-32 h-32 border-t-2 border-l-2 border-indigo-500" />
                  </div>
                </div>
              </section>

              {/* Website Footer */}
              <footer className="bg-white border-t border-slate-200 py-16 px-6 relative z-10">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-slate-800">
                  <div className="col-span-1 md:col-span-2">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold leading-none">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-lg font-bold tracking-tight uppercase">FidgetHub</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium max-w-sm leading-relaxed uppercase tracking-wider mb-8">
                      Propelling focus through mechanical evolution. Join the tactical fidget movement.
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer"><Radar className="w-3 h-3" /></div>
                      <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer"><ShoppingCart className="w-3 h-3" /></div>
                      <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer"><Package className="w-3 h-3" /></div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6">Directory</h4>
                    <ul className="text-xs font-bold uppercase space-y-3">
                      <li className="hover:text-indigo-600 cursor-pointer transition-colors">Catalog</li>
                      <li className="hover:text-indigo-600 cursor-pointer transition-colors">Production Process</li>
                      <li className="hover:text-indigo-600 cursor-pointer transition-colors">Bulk Supply</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-6">Support</h4>
                    <ul className="text-xs font-bold uppercase space-y-3">
                      <li className="hover:text-indigo-600 cursor-pointer transition-colors">Logistics Tracking</li>
                      <li className="hover:text-indigo-600 cursor-pointer transition-colors">Contact Support</li>
                      <li className="hover:text-indigo-600 cursor-pointer transition-colors">Terms of Use</li>
                    </ul>
                  </div>
                </div>

                <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">© 2024 FidgetHub Tactical. All rights reserved.</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Primary Server Active
                  </p>
                </div>
              </footer>
            </main>
          } />

          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboard onProductsChange={() => {
                const stored = localStorage.getItem('fidgethub_products');
                if (stored) setProducts(JSON.parse(stored));
              }} />
            </ProtectedRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        <Cart 
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          items={cartItems}
          onUpdateQuantity={updateCartQuantity}
          onRemove={removeFromCart}
          onClear={() => setCartItems([])}
        />

        {/* Status Bar - High Density Style */}
        <div className="fixed bottom-0 left-0 right-0 h-6 bg-white border-t border-slate-200 flex items-center px-6 justify-between text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 z-50">
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 bg-green-500 rounded-full" /> System Status: Optimal</span>
            <span className="flex items-center gap-1.5"><Radar className="w-3 h-3 text-indigo-500" /> DB Link: Encrypted</span>
          </div>
          <div className="flex items-center gap-4">
             <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
             <span className="bg-slate-50 px-2 rounded border border-slate-100">FHub v1.2.4</span>
          </div>
        </div>
      </div>
    </Router>
  );
}
