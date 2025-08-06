# SPIRIT-CO-TRACKER

A comprehensive inventory and production tracking system for distilleries and spirit producers. Built with React, Vite, Firebase, and Tailwind CSS.

## 🥃 Features

### Inventory Management

- **Container Tracking**: Monitor spirits in various container types (barrels, drums, tanks, totes)
- **Real-time Updates**: Live inventory updates with Firebase integration
- **Transfer Operations**: Move spirits between containers with automatic volume calculations
- **Proof Adjustments**: Temperature-corrected proof measurements using TTB standards
- **Bottling Operations**: Track bottling processes with multiple bottle size options
- **Content Adjustments**: Modify container contents with detailed logging

### Production Tracking

- **Batch Management**: Track fermentation and distillation batches
- **Production Logging**: Comprehensive logging of all production activities
- **Batch History**: View and manage production batch history
- **Yield Calculations**: Automatic yield calculations for production batches

### Compliance & Reporting

- **TTB Reports**: Generate TTB-compliant reports for regulatory requirements
- **Transaction Logging**: Complete audit trail of all inventory movements
- **Export Capabilities**: CSV export for external reporting
- **Temperature Corrections**: Built-in TTB temperature correction factors

### User Management

- **Firebase Authentication**: Secure user login and registration
- **Multi-user Support**: Support for multiple user accounts
- **Account Management**: Change account settings and preferences

### Data Management

- **Product Catalog**: Manage custom product definitions
- **Import/Export**: Bulk import containers and export data
- **Backup & Restore**: Data backup and restoration capabilities

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase project setup

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd SPIRIT-CO-TRACKER
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure Firebase**

   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication and Firestore
   - Update `src/Firebase.js` with your Firebase configuration

4. **Start the development server**

   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

## 📦 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── modals/         # Modal components for various operations
│   ├── Dashboard.jsx   # Main dashboard component
│   ├── InventoryItem.jsx # Individual inventory item display
│   └── ProductionView.jsx # Production tracking view
├── constants/          # Application constants and configurations
├── utils/             # Utility functions and helpers
├── assets/            # Static assets
├── icons/             # Icon components
├── App.jsx            # Main application component
├── Firebase.js        # Firebase configuration
└── main.jsx          # Application entry point
```

## 🔧 Configuration

### Firebase Setup

1. Create a new Firebase project
2. Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Update the Firebase configuration in `src/Firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id",
};
```

### Environment Variables

Create a `.env` file in the root directory:

```
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
```

## 📊 Features in Detail

### Container Types

- **Wooden Barrels**: 53 gallons
- **Metal Drums**: 55 gallons
- **Square Tanks**: 275 gallons
- **Totes**: 250 gallons
- **5-Gallon Totes**: 5 gallons
- **Stills**: 100 gallons
- **Fermenters**: 500 gallons

### Product Management

The system includes predefined products like:

- Salted Caramel Whiskey
- Bonfire Cinnamon Whiskey
- Peach Whiskey
- Peanut Butter Whiskey
- Coffee Whiskey
- And many more...

### TTB Compliance

Built-in TTB temperature correction factors for accurate proof measurements at various temperatures (60°F to 80°F).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions, please contact the development team or create an issue in the repository.

---

**Built with ❤️ for the distillery industry**
