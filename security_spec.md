# Security Specification - FidgetHub

## 1. Data Invariants
- **Products**:
  - `name`: String, non-empty, max 100 chars.
  - `price`: Number, >= 0.
  - `stock`: Number, >= 0.
  - `image`: String, valid URL (starts with http).
- **Orders**:
  - `items`: At least one item.
  - `customerEmail`: Valid email format.
  - `status`: One of ['pending', 'processing', 'shipped', 'delivered'].
  - `total`: Number, >= 0.

## 2. The "Dirty Dozen" Payloads (Deny Test Cases)
1.  **Product Spoofing**: Attempt to create a product as an unauthenticated user.
2.  **Price Poisoning**: Attempt to set a product price to -100.
3.  **Title Bloating**: Attempt to update a product with a 1MB string in the name.
4.  **Order Hijacking**: Attempt to read the `orders` collection as a guest.
5.  **Status Manipulation**: Attempt to change an order status from `pending` to `delivered` as a non-admin.
6.  **Orphaned Order**: Attempt to create an order without any items.
7.  **Email Injection**: Create an order with an invalid email format.
8.  **Identity Theft**: Attempt to change the `ownerId` (if we used one) of a document.
9.  **System Field Write**: Attempt to manually set `createdAt` in an order to a past date (must use server time).
10. **ID Poisoning**: Attempt to create a document with a junk-character ID string (e.g. 1.5KB of data).
11. **Negative Stock**: Attempt to set product stock to -1.
12. **Admin Escalation**: Attempt to write to a hypothetical `admins` collection to make oneself an admin.

## 3. Test Runner Strategy
We will use a hardened ruleset with `isValidProduct()` and `isValidOrder()` helpers. All writes will be gated by these checks.
