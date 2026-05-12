import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Trash2, ShieldCheck, Search, Plus, X, MapPin, LogOut, Minus, Radar, FileSpreadsheet } from 'lucide-react';
import { Order, Product } from '../types';
import { ADMIN_PASSWORD } from '../constants';
import { db, auth, googleProvider, handleFirestoreError } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, addDoc, setDoc, getDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';

export const AdminDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [showCompleted, setShowCompleted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [newLocation, setNewLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'stock' | 'config'>('orders');
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(() => {
    return localStorage.getItem('fidgethub_auto_sync') === 'true';
  });
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    sizePrices: '',
    image: '',
    location: '',
    stock: '',
    colors: '',
    sizes: ''
  });

  useEffect(() => {
    // Local session check
    const session = sessionStorage.getItem('fidgethub_admin_session');
    if (session === 'authorized') {
      setIsAuthorized(true);
    }
    setIsInitializing(false);

    // Real-time products sync
    const unsubscribeProds = onSnapshot(query(collection(db, 'products')), {
      next: (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
        setAuthError(null);
      },
      error: (error) => {
        // We handle permission denials gracefully by showing the gate
        console.error("Products sync error:", error);
      }
    });

    // Real-time orders sync - removing server-side orderBy to ensure all docs show up even if createdAt is null
    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), {
      next: (snapshot) => {
        const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown as Order[];
        // Sort client-side
        const sorted = allOrders.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setOrders(sorted);
        setAuthError(null);
      },
      error: (error) => {
        console.error("Orders sync error:", error);
      }
    });

    // Real-time locations sync from Firestore
    const unsubscribeLocs = onSnapshot(collection(db, 'locations'), {
      next: (snapshot) => {
        const locs = snapshot.docs.map(doc => doc.data().name) as string[];
        setLocations(locs);
        setLoading(false);

        // Seed initial locations if empty on first run
        const hasSeededLocs = localStorage.getItem('fidgethub_initial_loc_applied');
        if (locs.length === 0 && !snapshot.metadata.fromCache && !hasSeededLocs) {
          const defaultLocs = ['Sector-7 Hub', 'North Dock 4', 'Main Ledger'];
          defaultLocs.forEach(async (name) => {
            await addDoc(collection(db, 'locations'), { name });
          });
          localStorage.setItem('fidgethub_initial_loc_applied', 'true');
        }
      },
      error: (error) => {
        console.error("Locations sync error:", error);
      }
    });

    return () => {
      unsubscribeProds();
      unsubscribeOrders();
      unsubscribeLocs();
    };
  }, []);

  // Auto-sync effect
  useEffect(() => {
    if (autoSync && orders.length > 0 && !isSyncing) {
      const timer = setTimeout(() => {
        handleSyncToSheets(true);
      }, 3000); // 3s debounce
      return () => clearTimeout(timer);
    }
  }, [orders, autoSync]);

  const handleRestoreDefaults = async () => {
    if (!window.confirm('Restore default factory inventory and locations? This will add initial data to the system.')) return;
    setLoading(true);
    try {
      // Seed Locations
      const defaultLocs = ['Sector-7 Hub', 'North Dock 4', 'Main Ledger'];
      for (const name of defaultLocs) {
        if (!locations.includes(name)) {
          await addDoc(collection(db, 'locations'), { name });
        }
      }

      // Seed Products from MOCK_PRODUCTS if they don't exist by name
      const { MOCK_PRODUCTS } = await import('../constants');
      for (const p of MOCK_PRODUCTS) {
        const exists = products.some(item => item.name === p.name);
        if (!exists) {
          const { id, ...rest } = p;
          await addDoc(collection(db, 'products'), rest);
        }
      }
      alert('System defaults restored successfully.');
    } catch (error) {
      console.error("Restore error:", error);
      alert('Factory restore intervention failed.');
    } finally {
      setLoading(false);
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAIImage = async () => {
    if (!newProduct.name || !newProduct.description) {
      alert('Please provide a name and description first for the AI to generate a matching image.');
      return;
    }
    setIsGenerating(true);
    try {
      // We'll use a placeholder logic or a call to gemini here if we had a direct tool for client-side generation
      // For now, let's use a themed picsum seed based on the name
      const seed = encodeURIComponent(newProduct.name.toLowerCase().replace(/\s+/g, '-'));
      const imageUrl = `https://picsum.photos/seed/${seed}/800/800`;
      setNewProduct(prev => ({ ...prev, image: imageUrl }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Use master key from constants or hardcoded fallback
    if (password.trim() === ADMIN_PASSWORD) {
      setIsAuthorized(true);
      sessionStorage.setItem('fidgethub_admin_session', 'authorized');
      setAuthError(null);
    } else {
      setAuthError('Invalid Admin Password. Access Denied.');
      setPassword('');
    }
  };

  const addLocation = async () => {
    if (!newLocation.trim()) return;
    try {
      await addDoc(collection(db, 'locations'), { name: newLocation.trim() });
      setNewLocation('');
    } catch (error) {
      handleFirestoreError(error, 'create', 'locations');
    }
  };

  const removeLocation = async (locName: string) => {
    try {
      const q = query(collection(db, 'locations'));
      const snapshot = await getDocs(q);
      const docToDelete = snapshot.docs.find(d => d.data().name === locName);
      if (docToDelete) {
        await deleteDoc(doc(db, 'locations', docToDelete.id));
      }
    } catch (error) {
      handleFirestoreError(error, 'delete', 'locations');
    }
  };

  const updateStatus = async (order: Order, status: Order['status']) => {
    try {
      const orderId = order.id;
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      handleFirestoreError(error, 'update', `orders/${order.id}`);
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (error) {
      handleFirestoreError(error, 'delete', `orders/${orderId}`);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
    } catch (error) {
      handleFirestoreError(error, 'delete', `products/${productId}`);
    }
  };

  const handleUpdateStock = async (productId: string, newStock: number) => {
    try {
      const finalStock = Math.max(0, newStock);
      await updateDoc(doc(db, 'products', productId), { stock: finalStock });
    } catch (error) {
      handleFirestoreError(error, 'update', `products/${productId}`);
    }
  };

  const handleSyncToSheets = async (silent = false) => {
    if (orders.length === 0) {
      if (!silent) alert("No data available to sync.");
      return;
    }
    
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders })
      });
      
      const result = await response.json();
      if (response.ok) {
        setLastSynced(new Date().toLocaleTimeString());
        if (!silent) alert(result.message);
      } else {
        if (!silent) alert("Sync Error: " + (result.error || "Unknown server error"));
      }
    } catch (error) {
      console.error("Sync error:", error);
      if (!silent) alert("Failed to connect to the sync terminal. Verify server is running.");
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleAutoSync = () => {
    const newValue = !autoSync;
    setAutoSync(newValue);
    localStorage.setItem('fidgethub_auto_sync', newValue.toString());
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct({ ...newProduct, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Parse size prices
    const sizePrices = newProduct.sizePrices ? newProduct.sizePrices.split(',').map(pair => {
      const parts = pair.split(':');
      if (parts.length === 2) {
        return { size: parts[0].trim(), price: parseFloat(parts[1].trim()) };
      }
      return null;
    }).filter((sp): sp is { size: string, price: number } => sp !== null && !isNaN(sp.price)) : [];

    const productData = {
      name: newProduct.name,
      description: newProduct.description,
      price: parseFloat(newProduct.price),
      sizePrices,
      image: newProduct.image || 'https://picsum.photos/seed/new/800/800',
      location: newProduct.location || locations[0],
      stock: parseInt(newProduct.stock) || 0,
      colors: newProduct.colors ? newProduct.colors.split(',').map(c => c.trim()) : [],
      sizes: newProduct.sizes ? newProduct.sizes.split(',').map(s => s.trim()) : []
    };

    try {
      await addDoc(collection(db, 'products'), productData);
      setShowAddProduct(false);
      setNewProduct({ name: '', description: '', price: '', sizePrices: '', image: '', location: '', stock: '', colors: '', sizes: '' });
    } catch (error) {
      handleFirestoreError(error, 'create', 'products');
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || o.id.includes(searchTerm);
    if (showCompleted) return matchesSearch && o.status === 'completed';
    return matchesSearch && o.status !== 'completed';
  });

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  const handleLogout = () => {
    sessionStorage.removeItem('fidgethub_admin_session');
    setIsAuthorized(false);
    window.location.href = '/';
  };

  if (isInitializing) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Radar className="w-12 h-12 text-indigo-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-20 pb-20 px-6 max-w-7xl mx-auto flex flex-col min-h-screen relative overflow-y-auto">
      <AnimatePresence>
        {!isAuthorized && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-white/80 backdrop-blur-md flex items-center justify-center p-6"
          >
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 text-center">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-100">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Admin Login</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight mb-8">
                {authError || "Secure terminal access requires admin password."}
              </p>
              
              <form onSubmit={handleAdminAuth} className="space-y-4">
                <div className="relative group">
                  <input 
                    type="password" 
                    value={password}
                    autoFocus
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ENTER PASSWORD"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 text-center font-black tracking-[0.2em] text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all transition-duration-300"
                  />
                  {authError && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-[10px] text-red-500 font-black uppercase tracking-widest"
                    >
                      Access Denied
                    </motion.div>
                  )}
                </div>
                
                <button 
                  type="submit"
                  className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase tracking-[0.2em] text-[10px] shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.01] active:scale-95 transition-all"
                >
                  Authorize Access
                </button>
                <button 
                  type="button"
                  onClick={() => window.location.href = '/'}
                  className="w-full text-slate-400 font-black py-4 uppercase tracking-[0.2em] text-[10px] hover:text-slate-600 transition-all border-t border-slate-50 mt-4"
                >
                  Return to Surface
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Meta */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" /> Admin Dashboard
          </h1>
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200 mt-2">
            {[
              { id: 'orders', label: 'Orders', icon: Package },
              { id: 'stock', label: 'Stock', icon: Package },
              { id: 'config', label: 'Settings', icon: MapPin }
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAuthorized && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase text-emerald-600">Secure Session Active</span>
            </div>
          )}
          <button 
            onClick={() => handleSyncToSheets()}
            disabled={isSyncing}
            className={`bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <FileSpreadsheet className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} /> {isSyncing ? 'Syncing...' : 'Sync Sheets'}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-slate-50 transition-all"
          >
            Settings
          </button>
          <button 
            onClick={() => setShowAddProduct(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" /> Add Product
          </button>
          <button 
            onClick={handleLogout}
            className="bg-slate-800 text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all"
          >
            <LogOut className="w-4 h-4" /> Log Out
          </button>
        </div>
      </div>

      {/* Metric Visuals (Conditional) */}
      {activeTab !== 'config' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 shrink-0">
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Total Orders</p>
            <p className="text-2xl font-black text-indigo-600 leading-none mt-1">{orders.length}</p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Pending Orders</p>
            <p className="text-2xl font-black text-amber-500 leading-none mt-1">{pendingOrders}</p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Inventory Count</p>
            <p className="text-2xl font-black text-slate-800 leading-none mt-1">{products.length}</p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-wider">Total Revenue</p>
            <p className="text-2xl font-black text-emerald-600 leading-none mt-1">{totalRevenue.toFixed(0)} SAR</p>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'stock' && (
          <motion.div 
            key="stock"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col gap-6"
          >
            {/* Stock Specific View */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden min-h-[500px]">
              <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50/50">
                <div>
                  <h2 className="font-black text-slate-800 uppercase tracking-tight text-lg">Inventory Stock</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Real-time stock monitoring</p>
                </div>
                <div className="flex gap-2">
                  <div className="px-3 py-1.5 bg-amber-50 border border-amber-100 rounded-lg flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-[9px] font-black uppercase text-amber-600">Low Stock Threshold: 10 units</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 p-6 gap-4">
                  {products.map((product) => {
                    const isLow = product.stock <= 10 && product.stock > 0;
                    const isOut = product.stock === 0;

                    return (
                      <div 
                        key={product.id}
                        className={`p-4 rounded-2xl border transition-all flex flex-col gap-4 ${
                          isOut ? 'bg-rose-50/30 border-rose-100' : 
                          isLow ? 'bg-amber-50/30 border-amber-100' : 
                          'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex gap-4">
                          <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden border border-slate-200">
                            <img src={product.image} className="w-full h-full object-cover" alt="" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-slate-800 leading-tight">{product.name}</h3>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider mt-1">{product.location}</p>
                            <div className="mt-2 flex gap-1">
                              {isOut ? (
                                <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[8px] font-black uppercase rounded">Out of Stock</span>
                              ) : isLow ? (
                                <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase rounded">Low Reserve</span>
                              ) : (
                                <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black uppercase rounded">Optimal</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <span className="text-[9px] font-black uppercase text-slate-500">Current Unit Count</span>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => handleUpdateStock(product.id, product.stock - 1)}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-rose-500 transition-colors shadow-sm"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className={`w-12 text-center text-xl font-black ${
                              isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-800'
                            }`}>
                              {product.stock}
                            </span>
                            <button 
                              onClick={() => handleUpdateStock(product.id, product.stock + 1)}
                              className="w-8 h-8 flex items-center justify-center bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-auto">
                          <button 
                            onClick={() => handleUpdateStock(product.id, product.stock + 50)}
                            className="py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50 transition-all"
                          >
                            Add Batch (+50)
                          </button>
                          <button 
                            onClick={() => handleUpdateStock(product.id, 100)}
                            className="py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-[9px] font-black uppercase text-indigo-600 hover:bg-indigo-100 transition-all"
                          >
                            Refill to 100
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div 
            key="orders"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 flex flex-col gap-6"
          >
            {/* Existing Order Ledger Container */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col mb-4 overflow-hidden min-h-[400px] shrink-0">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1">
            <h2 className="font-bold text-slate-700">Orders</h2>
            <div className="flex bg-slate-100 p-1 rounded-lg w-fit border border-slate-200">
              <button 
                onClick={() => setShowCompleted(false)}
                className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all ${!showCompleted ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Active
              </button>
              <button 
                onClick={() => setShowCompleted(true)}
                className={`px-3 py-1 text-[9px] font-black uppercase rounded-md transition-all ${showCompleted ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Completed
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-200">
                <th className="px-6 py-3">Record ID</th>
                <th className="px-6 py-3">Customer Info</th>
                <th className="px-6 py-3">Logistics (Items)</th>
                <th className="px-6 py-3">Shipment Point</th>
                <th className="px-6 py-3 text-right">Value (SAR)</th>
                <th className="px-6 py-3 text-center">Protocol</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[11px] text-slate-600 divide-y divide-slate-100">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-mono font-bold text-indigo-600">#{order.id.slice(0, 8)}</td>
                  <td className="px-6 py-3">
                    <div className="font-bold text-slate-800">{order.customerName}</div>
                    <div className="text-[9px] text-slate-400 font-mono mt-0.5">{order.customerEmail}</div>
                    <div className="text-[9px] text-slate-400 font-mono">{order.customerPhone}</div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 border-l-2 border-indigo-100 pl-2">
                          <div className="w-8 h-8 rounded bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-700">{item.quantity}x</span>
                              <span className="font-bold text-slate-600 truncate max-w-[120px]">{item.name}</span>
                            </div>
                            {(item.selectedColor || item.selectedSize) && (
                              <div className="flex gap-2 text-[8px] font-black uppercase text-indigo-400">
                                {item.selectedColor && <span>CLR: {item.selectedColor}</span>}
                                {item.selectedSize && <span>SZ: {item.selectedSize}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1 text-slate-500 font-bold uppercase">
                      <MapPin className="w-3 h-3 text-indigo-400" /> {order.location}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right font-black text-slate-800">{order.total.toFixed(2)} SAR</td>
                  <td className="px-6 py-3 text-center">
                    <select 
                      value={order.status}
                      onChange={(e) => updateStatus(order, e.target.value as Order['status'])}
                      className="px-2 py-1 rounded bg-slate-100 text-[9px] font-black uppercase border-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="pending">PENDING</option>
                      <option value="shipped">SHIPPED</option>
                      <option value="delivered">DELIVERED</option>
                      <option value="completed">COMPLETED</option>
                    </select>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {order.status !== 'completed' && (
                        <button 
                          onClick={() => updateStatus(order, 'completed')}
                          className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-[8px] font-black uppercase hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100"
                        >
                          Complete item
                        </button>
                      )}
                      <button onClick={() => deleteOrder(order.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )}

        {activeTab === 'config' && (
          <motion.div 
            key="config"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col gap-6"
          >
            {/* Product & Location Config Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden h-[600px]">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h2 className="font-bold text-slate-700 uppercase text-[10px] tracking-widest">Product List</h2>
                  <button onClick={() => setShowAddProduct(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all">
                    <Plus className="w-3 h-3" /> New Product
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm">
                      <tr className="bg-slate-100 text-[9px] uppercase font-black text-slate-500 border-b border-slate-200">
                        <th className="px-6 py-3">Product Name</th>
                        <th className="px-6 py-3">Location</th>
                        <th className="px-6 py-3 text-right">Price</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] text-slate-600 divide-y divide-slate-100">
                      {products.map((product) => (
                        <tr key={product.id} className="hover:bg-slate-50/30">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-slate-100 shrink-0 border border-slate-100 overflow-hidden">
                                <img src={product.image} alt="" className="w-full h-full object-cover" />
                              </div>
                              <span className="font-bold text-slate-800">{product.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3">
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-500 font-bold uppercase text-[9px]">{product.location}</span>
                          </td>
                          <td className="px-6 py-3 text-right font-black text-slate-800">{product.price.toFixed(2)} SAR</td>
                          <td className="px-6 py-3 text-right">
                            <button onClick={() => deleteProduct(product.id)} className="text-rose-300 hover:text-rose-600 p-1 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col p-6 overflow-hidden">
                <h3 className="font-black text-slate-800 uppercase tracking-tight mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-600" /> Locations
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="NEW LOCATION NAME" 
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-black focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button onClick={addLocation} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-auto pr-2">
                    {locations.map(loc => (
                      <div key={loc} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all group">
                        <span className="text-[10px] font-black text-slate-700 uppercase">{loc}</span>
                        <button onClick={() => removeLocation(loc)} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={handleRestoreDefaults}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    <Radar className="w-4 h-4" /> Reset to Defaults
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProduct && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddProduct(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 m-auto w-full max-w-lg h-fit bg-white rounded-2xl shadow-2xl z-[110] border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-600" /> New Product
                </h3>
                <button onClick={() => setShowAddProduct(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddProduct} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Product Image</label>
                    <div className="flex gap-4 items-start">
                      <div className="w-24 h-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {newProduct.image ? (
                          <img src={newProduct.image} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex gap-2">
                          <label className="flex-1 cursor-pointer bg-white border border-slate-200 px-3 py-2 rounded-lg text-[10px] font-black uppercase text-slate-600 hover:bg-slate-50 text-center transition-all">
                            Upload Photo
                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                          </label>
                        </div>
                        <input 
                          type="text" 
                          value={newProduct.image} 
                          onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                          className="hardware-input w-full" 
                          placeholder="Or paste Image URL..." 
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Product Name</label>
                    <input required type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="hardware-input w-full" placeholder="Fidget Model-X" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Location</label>
                    <select 
                      required 
                      value={newProduct.location} 
                      onChange={e => setNewProduct({...newProduct, location: e.target.value})} 
                      className="hardware-input w-full"
                    >
                      <option value="">Select Location</option>
                      {locations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Available Colors (Comma separated)</label>
                    <input type="text" value={newProduct.colors} onChange={e => setNewProduct({...newProduct, colors: e.target.value})} className="hardware-input w-full" placeholder="Black, White, Chrome" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Available Sizes (Comma separated)</label>
                    <input type="text" value={newProduct.sizes} onChange={e => setNewProduct({...newProduct, sizes: e.target.value})} className="hardware-input w-full" placeholder="Small, Medium, Large" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Description</label>
                  <textarea required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="hardware-input w-full h-20 resize-none" placeholder="..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Price (SAR)</label>
                    <input required type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="hardware-input w-full" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Size Specific Prices (Size:Price, ...)</label>
                    <input type="text" value={newProduct.sizePrices} onChange={e => setNewProduct({...newProduct, sizePrices: e.target.value})} className="hardware-input w-full" placeholder="Small:100, Large:200" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Initial Stock</label>
                    <input required type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} className="hardware-input w-full" placeholder="0" />
                  </div>
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase tracking-widest text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all">
                  Add Product
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Global Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSettings(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 m-auto w-full max-w-lg h-fit bg-white rounded-2xl shadow-2xl z-[110] border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                   Global Settings
                </h3>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-3 block">Manage Possible Locations</label>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      value={newLocation} 
                      onChange={e => setNewLocation(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addLocation()}
                      className="hardware-input flex-1" 
                      placeholder="e.g. London-Base" 
                    />
                    <button 
                      onClick={addLocation}
                      className="bg-slate-800 text-white px-4 rounded-lg text-[10px] font-black uppercase"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {locations.map(loc => (
                      <div key={loc} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">{loc}</span>
                        <button onClick={() => removeLocation(loc)} className="text-red-400 hover:text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-3 block">Integrations</label>
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col gap-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-emerald-100 p-2 rounded-lg">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] font-black uppercase text-emerald-800 tracking-tight block mb-1">Google Sheets Integration</span>
                        <p className="text-[9px] text-emerald-600 font-medium leading-relaxed italic">
                          Automatic background synchronization export to your spreadsheet.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
                      <div>
                        <span className="text-[9px] font-black uppercase text-emerald-700 block">Auto-Sync Protocol</span>
                        {lastSynced && (
                          <span className="text-[8px] text-emerald-500 font-mono">Last synced: {lastSynced}</span>
                        )}
                      </div>
                      <button 
                        onClick={toggleAutoSync}
                        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${autoSync ? 'bg-emerald-600' : 'bg-slate-300'}`}
                      >
                        <motion.div 
                          animate={{ x: autoSync ? 24 : 4 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100">
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-3 block">System Maintenance</label>
                  <button 
                    onClick={handleRestoreDefaults}
                    className="w-full py-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-black uppercase text-indigo-600 hover:bg-white hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                  >
                    <Radar className="w-4 h-4" /> Restore Factory Defaults
                  </button>
                  <p className="mt-2 text-[9px] text-slate-400 font-medium italic">
                    Note: This will reload missing default products and locations without duplicates.
                  </p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
