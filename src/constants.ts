import { Product } from './types';

export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "Hub@2026";

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'f-1',
    name: 'Infinity Cube V2',
    description: 'Precision 3D printed mechanical infinity cube with high-speed bearings.',
    price: 95.00,
    sizePrices: [
      { size: 'Pocket', price: 95.00 },
      { size: 'Standard', price: 120.00 },
      { size: 'Display', price: 180.00 }
    ],
    image: 'https://picsum.photos/seed/infinity/800/800',
    location: 'Sector-7 Hub',
    stock: 45,
    sizes: ['Pocket', 'Standard', 'Display']
  },
  {
    id: 'f-2',
    name: 'Hex-Spin Control',
    description: 'Bioluminescent 3D printed fidget spinner with an ergonomic hexagonal frame.',
    price: 70.00,
    sizePrices: [
      { size: 'Mini', price: 70.00 },
      { size: 'Regular', price: 90.00 }
    ],
    image: 'https://picsum.photos/seed/hex/800/800',
    location: 'North Dock 4',
    stock: 120,
    sizes: ['Mini', 'Regular']
  },
  {
    id: 'f-3',
    name: 'Pulse Clicker X1',
    description: 'Haptic trigger system with customizable spring tension and carbon fiber finish.',
    price: 120.00,
    image: 'https://picsum.photos/seed/clicker/800/800',
    location: 'Main Ledger',
    stock: 18
  },
  {
    id: 'f-4',
    name: 'Orbit Ring 3D',
    description: 'Dual-axis gyroscopic ring system printed in aerospace-grade titanium PLA.',
    price: 110.00,
    image: 'https://picsum.photos/seed/orbit/800/800',
    location: 'Sector-7 Hub',
    stock: 62
  }
];
