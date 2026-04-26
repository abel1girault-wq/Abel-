import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Trash2, ShieldCheck, Search, Plus, X, MapPin, LogOut, Minus, Radar } from 'lucide-react';
import { Order, Product } from '../types';
import { ADMIN_PASSWORD } from '../constants';
import { db, auth, googleProvider, handleFirestoreError } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, addDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';

export const AdminDashboard = () => {
  const [orders, setOrders] = useState<Order[]>([]);
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
        if (locs.length === 0) {
          // Initial seed if empty
          const defaultLocs = ['Sector-7 Hub', 'North Dock 4', 'Main Ledger'];
          defaultLocs.forEach(async (name) => {
            try {
              await addDoc(collection(db, 'locations'), { name });
            } catch (e) {
              // Ignore seed fail if not admin
            }
          });
          setLocations(defaultLocs);
        } else {
          setLocations(locs);
        }
        setLoading(false);
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

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    // Use master key from constants or hardcoded fallback
    if (password === ADMIN_PASSWORD) {
      setIsAuthorized(true);
      sessionStorage.setItem('fidgethub_admin_session', 'authorized');
      setAuthError(null);
    } else {
      setAuthError('Invalid Master Key. Access Denied.');
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

  const updateStatus = async (orderId: string, status: Order['status']) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      handleFirestoreError(error, 'update', `orders/${orderId}`);
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
      await updateDoc(doc(db, 'products', productId), { stock: Math.max(0, newStock) });
    } catch (error) {
      handleFirestoreError(error, 'update', `products/${productId}`);
    }
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

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id.includes(searchTerm)
  );

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
    <div className="pt-20 pb-20 px-6 max-w-7xl mx-auto flex flex-col h-screen overflow-hidden relative">
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
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-2">Protocol Gate</h2>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-tight mb-8">
                {authError || "Secure terminal access requires master protocol key."}
              </p>
              
              <form onSubmit={handleAdminAuth} className="space-y-4">
                <div className="relative group">
                  <input 
                    type="password" 
                    value={password}
                    autoFocus
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ENTER PROTOCOL KEY"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-4 text-center font-black tracking-[0.5em] text-slate-800 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all transition-duration-300"
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" /> Command Center
          </h1>
          {authError && (
            <div className="mt-2 text-[10px] font-bold text-amber-600 uppercase flex items-center gap-2 animate-pulse">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> {authError}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAuthorized && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-black uppercase text-emerald-600">Secure Protocol Active</span>
            </div>
          )}
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

      {/* Metrics Bar */}
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

      {/* Product Management Section */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col mb-4 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h2 className="font-bold text-slate-700">Inventory Ledger</h2>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
            {products.length} Active Items
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 border-b border-slate-200">
                <th className="px-6 py-3">Object Name</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3 text-right">Value (SAR)</th>
                <th className="px-6 py-3 text-right">Stock</th>
                <th className="px-6 py-3 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="text-[11px] text-slate-600 divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-bold text-slate-800">{product.name}</td>
                  <td className="px-6 py-3 text-slate-500 font-bold uppercase">{product.location}</td>
                  <td className="px-6 py-3 text-right font-black text-slate-800">{product.price.toFixed(2)} SAR</td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => handleUpdateStock(product.id, product.stock - 1)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className={`font-black w-12 text-center ${product.stock <= 5 ? 'text-red-500' : 'text-indigo-600'}`}>
                        {product.stock}
                      </span>
                      <button 
                        onClick={() => handleUpdateStock(product.id, product.stock + 1)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => deleteProduct(product.id)} className="text-red-300 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Ledger Container */}
      <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col mb-4 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
          <h2 className="font-bold text-slate-700">Global Ledger</h2>
          <div className="flex items-center gap-2 w-full md:w-auto">
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
                      onChange={(e) => updateStatus(order.id, e.target.value as Order['status'])}
                      className="px-2 py-1 rounded bg-slate-100 text-[9px] font-black uppercase border-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="pending">PENDING</option>
                      <option value="shipped">SHIPPED</option>
                      <option value="delivered">DELIVERED</option>
                    </select>
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => deleteOrder(order.id)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProduct && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddProduct(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 m-auto w-full max-w-lg h-fit bg-white rounded-2xl shadow-2xl z-[110] border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-600" /> New Inventory Object
                </h3>
                <button onClick={() => setShowAddProduct(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              <form onSubmit={handleAddProduct} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Object Designation</label>
                    <input required type="text" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="hardware-input w-full" placeholder="Fidget Model-X" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Base Location</label>
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
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Available Colours (Comma separated)</label>
                    <input type="text" value={newProduct.colors} onChange={e => setNewProduct({...newProduct, colors: e.target.value})} className="hardware-input w-full" placeholder="Black, White, Chrome" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Available Sizes (Comma separated)</label>
                    <input type="text" value={newProduct.sizes} onChange={e => setNewProduct({...newProduct, sizes: e.target.value})} className="hardware-input w-full" placeholder="Small, Medium, Large" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Brief Data (Description)</label>
                  <textarea required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="hardware-input w-full h-20 resize-none" placeholder="..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Base Value (SAR)</label>
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
                  Register Object
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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
