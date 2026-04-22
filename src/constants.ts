import { Product } from './types';

export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'f-1',
    name: 'Infinity Cube V2',
    description: 'Precision 3D printed mechanical infinity cube with high-speed bearings.',
    price: 24.99,
    image: 'https://picsum.photos/seed/infinity/800/800',
    location: 'Sector-7 Hub',
    stock: 45
  },
  {
    id: 'f-2',
    name: 'Hex-Spin Control',
    description: 'Bioluminescent 3D printed fidget spinner with an ergonomic hexagonal frame.',
    price: 18.50,
    image: 'https://picsum.photos/seed/hex/800/800',
    location: 'North Dock 4',
    stock: 120
  },
  {
    id: 'f-3',
    name: 'Pulse Clicker X1',
    description: 'Haptic trigger system with customizable spring tension and carbon fiber finish.',
    price: 32.00,
    image: 'https://picsum.photos/seed/clicker/800/800',
    location: 'Main Ledger',
    stock: 18
  },
  {
    id: 'f-4',
    name: 'Orbit Ring 3D',
    description: 'Dual-axis gyroscopic ring system printed in aerospace-grade titanium PLA.',
    price: 29.99,
    image: 'https://picsum.photos/seed/orbit/800/800',
    location: 'Sector-7 Hub',
    stock: 62
  }
];
