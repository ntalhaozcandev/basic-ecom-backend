# Project Structure
```
ecom-backend/
│── src/
│   ├── config/        # DB, environment setup
│   ├── routes/        # API endpoints
│   ├── controllers/   # Logic for each route
│   ├── models/        # Database schemas/entities
│   ├── middleware/    # Custom middleware (auth, logging, error handling)
│   ├── utils/         # Helper functions
│   └── app.js         # Express app setup
│
├── .env               # Environment variables (DB URL, API keys)
├── package.json
└── README.md
```
# TODO
- UI/UX for the app ✅
- Product Categories & Organization
    - Category system for products ✅
    - Missing product search and filtering capabilities ✅
    - Product sorting options (price, popularity, rating)
    - Pagination for product listings ✅
- Inventory Management
    - Bulk inventory updates
    - Product variants (size, color, etc.)
- Order Management
    - Order cancellation by users
    - Order refund functionality
    - Order tracking/status history
    - Missing delivery/shipping integration
    - Order search and filtering
- User Profile & Preferences
    - Missing user profile information (name, phone, address)
    - Saved addresses for shipping/billing
    - User preferences
    - Order history for users ✅
    - Wishlist functionality
- Payment Integration
    - Actual payment processing (Stripe, PayPal, etc.)
    - Missing payment verification
    - Payment history tracking
    - Refund processing
- Shopping Cart Enhancements
    - Cart doesn't get the current user's cart automatically (!)
    - Cart persistence for guest users
    - Cart total calculation in responses
    - Cart item validation against current product prices
- Admin Features
    - Admin-only routes protection ✅
    - Sales analytics/dashboard 
    - User management for admins ✅
    - Bulk product operations

### Other Todo
- Security & Authentication
    - Missing email verification
    - No password reset functionality
    - No refresh token mechanism
    - No rate limiting
    - No CORS configuration for production
- Email Notifications
    - No order confirmation emails
    - No shipping notifications
    - No account verification emails
- API Improvements
    - Missing input validation middleware
    - No API documentation (Swagger)
    - No error handling middleware
    - No logging system
    - Missing response standardization
