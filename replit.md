# Restaurant Management System

A comprehensive restaurant management system built with React, TypeScript, and Express.js. This system provides restaurant owners with tools to manage their menu, tables, orders, and analytics.

## Features

### Core Features
1. **Menu Management**: Add, edit, and manage menu items with categories, prices, and availability
2. **Table Management**: Create and manage restaurant tables with QR code generation
3. **Order Management**: Real-time order processing and status tracking
4. **Analytics Dashboard**: Revenue tracking, order statistics, and performance insights
5. **User Authentication**: Secure login system for restaurant staff and administrators
6. **Real-time Updates**: WebSocket-based real-time order notifications

### Technical Features
- **Responsive Design**: Mobile-friendly interface that works on all devices
- **Real-time Communication**: WebSocket integration for instant updates
- **Database Integration**: PostgreSQL with Drizzle ORM
- **AI Integration**: Google Gemini API for business insights and analytics
- **QR Code Generation**: Automatic QR code creation for table-based ordering
- **Modern UI**: Clean, professional interface built with Tailwind CSS

## System Architecture

### Frontend (React + TypeScript)
- **React 18** with TypeScript for type safety
- **Tailwind CSS** for styling
- **React Query** for server state management
- **React Router** for navigation
- **WebSocket client** for real-time updates

### Backend (Express.js + TypeScript)
- **Express.js** server with TypeScript
- **PostgreSQL** database with Drizzle ORM
- **WebSocket server** for real-time communication
- **Session-based authentication**
- **RESTful API** design

### Database Schema
- **Restaurants**: Store restaurant information
- **Users**: Staff and admin accounts
- **Tables**: Restaurant table management
- **Menu Items**: Product catalog
- **Orders**: Order processing and tracking
- **Analytics**: Performance metrics and insights
- **Subscriptions**: Basic subscription management

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Environment variables for database connection and API keys

### Installation
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run database migrations: `npm run db:push`
5. Start development server: `npm run dev`

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session management
- `GEMINI_API_KEY`: Google Gemini API key (optional, for AI features)

## API Endpoints

### Authentication
- `POST /api/auth/login`: User login
- `POST /api/auth/logout`: User logout
- `GET /api/auth/session`: Get current session

### Restaurant Management
- `GET /api/restaurants`: List all restaurants (admin only)
- `POST /api/restaurants`: Create new restaurant (admin only)
- `GET /api/restaurants/:id`: Get restaurant details
- `PUT /api/restaurants/:id`: Update restaurant information

### Menu Management
- `GET /api/restaurants/:id/menu-items`: Get restaurant menu
- `POST /api/restaurants/:id/menu-items`: Add menu item
- `PUT /api/restaurants/:id/menu-items/:itemId`: Update menu item
- `DELETE /api/restaurants/:id/menu-items/:itemId`: Delete menu item

### Order Management
- `GET /api/restaurants/:id/orders`: Get all orders
- `GET /api/restaurants/:id/active-orders`: Get active orders
- `POST /api/restaurants/:id/orders`: Create new order
- `PUT /api/restaurants/:id/orders/:orderId`: Update order status

### Analytics
- `POST /api/restaurants/:id/analytics/revenue`: Get revenue data
- `POST /api/restaurants/:id/analytics/orders`: Get order statistics
- `GET /api/restaurants/:id/analytics/popular-items`: Get popular items
- `POST /api/restaurants/:id/analytics/ai-insights`: Get AI-powered insights

## User Roles and Permissions

### Platform Administrator
- Full system access
- Can create and manage restaurants
- View system-wide analytics
- Manage all user accounts

### Restaurant Owner/Manager
- Manage their restaurant's information
- Full access to menu, tables, and orders
- View restaurant analytics
- Manage staff accounts

### Restaurant Staff
- View and manage orders
- Update order status
- Basic menu item management
- Limited analytics access

## Real-time Features

The system uses WebSocket connections to provide real-time updates:
- **Order Notifications**: Instant alerts when new orders are placed
- **Status Updates**: Real-time order status changes
- **Kitchen Updates**: Live updates for kitchen staff

## Future Enhancements

- **Mobile App**: Native iOS and Android applications
- **Advanced Analytics**: More detailed business intelligence
- **Integration APIs**: Third-party delivery service integration
- **Multi-location Support**: Chain restaurant management
- **Advanced Reporting**: Custom report generation
- **Customer Loyalty**: Points and rewards system

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.