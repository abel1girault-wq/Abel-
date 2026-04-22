import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Trash2, ShieldCheck, Search, Plus, X, MapPin } from 'lucide-react';
import { Order, Product } from '../types';

interface AdminDashboardProps {
  onProductsChange?: () => void;
}

export const AdminDashboard = ({ onProductsChange }: AdminDashboardProps) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    image: '',
    location: '',
    stock: ''
  });

  useEffect(() => {
    const storedOrders = localStorage.getItem('fidgethub_orders');
    if (storedOrders) setOrders(JSON.parse(storedOrders));

    const storedProducts = localStorage.getItem('fidgethub_products');
    if (storedProducts) setProducts(JSON.parse(storedProducts));
    
    setLoading(false);
  }, []);

  const updateStatus = (orderId: string, status: Order['status']) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, status } : o);
    setOrders(updated);
    localStorage.setItem('fidgethub_orders', JSON.stringify(updated));
  };

  const deleteOrder = (orderId: string) => {
    if (!window.confirm('Delete this record?')) return;
    const updated = orders.filter(o => o.id !== orderId);
    setOrders(updated);
    localStorage.setItem('fidgethub_orders', JSON.stringify(updated));
  };

  const deleteProduct = (productId: string) => {
    if (!window.confirm('Delete this product?')) return;
    const updated = products.filter(p => p.id !== productId);
    setProducts(updated);
    localStorage.setItem('fidgethub_products', JSON.stringify(updated));
    if (onProductsChange) onProductsChange();
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

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const product: Product = {
      id: Math.random().toString(36).substr(2, 9),
      name: newProduct.name,
      description: newProduct.description,
      price: parseFloat(newProduct.price),
      image: newProduct.image || 'https://picsum.photos/seed/new/800/800',
      location: newProduct.location,
      stock: parseInt(newProduct.stock) || 0
    };
    const updated = [product, ...products];
    setProducts(updated);
    localStorage.setItem('fidgethub_products', JSON.stringify(updated));
    setShowAddProduct(false);
    setNewProduct({ name: '', description: '', price: '', image: '', location: '', stock: '' });
    if (onProductsChange) onProductsChange();
  };

  const filteredOrders = orders.filter(o => 
    o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.id.includes(searchTerm)
  );

  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="pt-20 pb-20 px-6 max-w-7xl mx-auto flex flex-col h-screen overflow-hidden">
      {/* Header & Meta */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" /> Command Center
          </h1>
        </div>
        <button 
          onClick={() => setShowAddProduct(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
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
          <p className="text-2xl font-black text-emerald-600 leading-none mt-1">${totalRevenue.toFixed(0)}</p>
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
                <th className="px-6 py-3 text-right">Value</th>
                <th className="px-6 py-3 text-right">Stock</th>
                <th className="px-6 py-3 text-right">Control</th>
              </tr>
            </thead>
            <tbody className="text-[11px] text-slate-600 divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-3 font-bold text-slate-800">{product.name}</td>
                  <td className="px-6 py-3 text-slate-500 font-bold uppercase">{product.location}</td>
                  <td className="px-6 py-3 text-right font-black text-slate-800">${product.price.toFixed(2)}</td>
                  <td className="px-6 py-3 text-right font-black text-indigo-600">{product.stock} units</td>
                  <td className="px-6 py-3 text-right">
                    <button onClick={() => deleteProduct(product.id)} className="text-red-400 hover:text-red-600 p-1">
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
                <th className="px-6 py-3 text-right">Value</th>
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
                  <td className="px-6 py-3 text-right font-black text-slate-800">${order.total.toFixed(2)}</td>
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
                    <input required type="text" value={newProduct.location} onChange={e => setNewProduct({...newProduct, location: e.target.value})} className="hardware-input w-full" placeholder="Warehouse-A" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Brief Data (Description)</label>
                  <textarea required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="hardware-input w-full h-20 resize-none" placeholder="..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Value (USD)</label>
                    <input required type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="hardware-input w-full" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Initial Stock</label>
                    <input required type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} className="hardware-input w-full" placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Visual Link (IMG URL)</label>
                    <input type="text" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} className="hardware-input w-full" placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Or Upload Local Image</label>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hardware-input w-full text-[10px]" />
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
    </div>
  );
};
