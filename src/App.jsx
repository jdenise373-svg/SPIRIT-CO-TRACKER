import React, { useState, useEffect, useMemo } from "react";
import { auth as firebaseAuth, db as firebaseDB } from "./Firebase"; // adjust path if needed
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  deleteDoc,
  query,
  onSnapshot,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { Dashboard } from "./components/Dashboard";
import { InventoryItem } from "./components/InventoryItem";
import { ProductionView } from "./components/ProductionView";
import { DropdownButton, DropdownItem } from "./components/DropdownButton";
import { APP_NAME, DEFAULT_PRODUCTS } from "./constants";

import { 
  AddEditContainerModal,
  AddEditProductionModal,
  TransferModal,
  AdjustContentsModal,
  ProofDownModal,
  BottlingModal,
  ManageProductsModal,
  ViewLogModal,
  ImportContainersModal,
  TtbReportModal,
  ConfirmationModal,
  ChangeAccountModal
} from "./components/modals";

import { convertToCSV, downloadCSV, logTransaction } from "./utils/helpers";

// --- Main App Component ---
function App() {
  // Existing state...
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [userEmail, setUserEmail] = useState(null); // Add this line
  // ... other state variables
  const [inventory, setInventory] = useState([]);
  const [products, setProducts] = useState([]);
  const [transactionLog, setTransactionLog] = useState([]);
  const [productionBatches, setProductionBatches] = useState([]); // New state for production
  const [isLoadingInventory, setIsLoadingInventory] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingLog, setIsLoadingLog] = useState(true);
  const [isLoadingProduction, setIsLoadingProduction] = useState(true); // New loading state
  const [error, setError] = useState("");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingContainer, setEditingContainer] = useState(null);
  const [formModalMode, setFormModalMode] = useState("add");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null); // Generic deletion state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSourceContainer, setTransferSourceContainer] = useState(null);
  const [showAdjustContentsModal, setShowAdjustContentsModal] = useState(false);
  const [adjustingContainer, setAdjustingContainer] = useState(null);
  const [showManageProductsModal, setShowManageProductsModal] = useState(false);
  const [showViewLogModal, setShowViewLogModal] = useState(false);
  const [showProofDownModal, setShowProofDownModal] = useState(false);
  const [proofingContainer, setProofingContainer] = useState(null);
  const [showBottlingModal, setShowBottlingModal] = useState(false);
  const [bottlingContainer, setBottlingContainer] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTtbReportModal, setShowTtbReportModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(true);
  const [currentView, setCurrentView] = useState("inventory"); // 'inventory' or 'production'
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [editingProductionBatch, setEditingProductionBatch] = useState(null);
  const [productionModalType, setProductionModalType] =
    useState("fermentation");
  const [showChangeAccountModal, setShowChangeAccountModal] = useState(false);
  const [sortCriteria, setSortCriteria] = useState("name_asc");
  const appId = "1:587421865283:web:b58af950daaa93ce450bf6";

  useEffect(() => {
    setDb(firebaseDB);
    setAuth(firebaseAuth);

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (user) {
        console.log("User is signed in:", user.uid);
        setUserId(user.uid);
        setUserEmail(user.email);
      } else {
        console.log("No user is signed in.");
        setUserId(null);
        setUserEmail(null);
        // Trigger showing the auth modal if not logged in
        setShowAuthModal(true);
      }
      setIsAuthReady(true); // Auth state is determined (either user or null)
    });

    return () => unsubscribe();
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError(""); // Clear previous errors
    try {
      if (authMode === "login") {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        // On successful login, onAuthStateChanged will trigger and set userId,
        // which will cause the app to proceed and hide the modal.
        // Optionally, you can close the modal immediately here as well:
        // setShowAuthModal(false);
      } else if (authMode === "signup") {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        // On successful signup, onAuthStateChanged will trigger and set userId.
        // setShowAuthModal(false); // Optional immediate close
      }
      // Clear form on success
      setAuthEmail("");
      setAuthPassword("");
    } catch (error) {
      console.error("Authentication error:", error);
      let message = "Authentication failed.";
      if (error.code === "auth/user-not-found") {
        message = "No user found with this email.";
      } else if (error.code === "auth/wrong-password") {
        message = "Incorrect password.";
      } else if (error.code === "auth/email-already-in-use") {
        message = "Email is already in use.";
      } else if (error.code === "auth/invalid-email") {
        message = "Invalid email address.";
      } else if (error.code === "auth/weak-password") {
        message = "Password is too weak.";
      }
      // Add more specific error handling as needed
      setAuthError(message);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged will trigger, setting userId to null and showing the modal again
      // Resetting local state might be redundant but can be good for immediate UI feedback
      setUserId(null);
      setShowAuthModal(true);
    } catch (error) {
      console.error("Logout error:", error);
      setError("Logout failed.");
    }
  };
  // Data Fetching Hooks
  useEffect(() => {
    /* Fetch Inventory */
    if (!isAuthReady || !db || !userId) {
      if (isAuthReady && (!db || !userId)) setIsLoadingInventory(false);
      return;
    }
    setIsLoadingInventory(true);
    const inventoryPath = `artifacts/${appId}/users/${userId}/spiritInventory`;
    const qInv = query(collection(db, inventoryPath));
    const unsubInv = onSnapshot(
      qInv,
      (snap) => {
        const items = [];
        snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
        setInventory(items);
        setIsLoadingInventory(false);
        setError("");
      },
      (err) => {
        console.error("Inv fetch error:", err);
        setError("Inv fetch failed.");
        setIsLoadingInventory(false);
      }
    );
    return () => unsubInv();
  }, [isAuthReady, db, userId, appId]);

  useEffect(() => {
    /* Fetch Products */
    if (!isAuthReady || !db || !userId) {
      if (isAuthReady && (!db || !userId)) setIsLoadingProducts(false);
      return;
    }
    setIsLoadingProducts(true);
    const productsPath = `artifacts/${appId}/users/${userId}/spiritProducts`;
    const qProd = query(collection(db, productsPath));
    const unsubProd = onSnapshot(
      qProd,
      async (snapshot) => {
        let fetchedProds = [];
        snapshot.forEach((doc) => {
          fetchedProds.push({ id: doc.id, ...doc.data() });
        });
        if (fetchedProds.length === 0 && snapshot.empty) {
          const productsCollectionRef = collection(db, productsPath);
          const currentDocs = await getDocs(productsCollectionRef);
          if (currentDocs.empty) {
            console.log(
              "No products found, attempting to seed default products..."
            );
            const batch = writeBatch(db);
            DEFAULT_PRODUCTS.forEach((prodData) => {
              const newProdRef = doc(collection(db, productsPath));
              batch.set(newProdRef, {
                name: prodData.name,
                description: prodData.description || "",
              });
            });
            try {
              await batch.commit();
            } catch (seedError) {
              console.error("Error seeding default products:", seedError);
              setError("Failed to seed initial products.");
              setIsLoadingProducts(false);
            }
          } else {
            fetchedProds = [];
            currentDocs.forEach((d) =>
              fetchedProds.push({ id: d.id, ...d.data() })
            );
            fetchedProds.sort((a, b) =>
              (a.name || "").localeCompare(b.name || "")
            );
            setProducts(fetchedProds);
            setIsLoadingProducts(false);
          }
        } else {
          fetchedProds.sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
          );
          setProducts(fetchedProds);
          setIsLoadingProducts(false);
        }
      },
      (err) => {
        console.error("Product fetch error:", err);
        setError("Failed to fetch products.");
        setIsLoadingProducts(false);
      }
    );
    return () => unsubProd();
  }, [isAuthReady, db, userId, appId]);

  useEffect(() => {
    /* Fetch Transaction Log */
    if (!isAuthReady || !db || !userId) {
      if (isAuthReady && (!db || !userId)) setIsLoadingLog(false);
      return;
    }
    setIsLoadingLog(true);
    const logPath = `artifacts/${appId}/users/${userId}/transactionLog`;
    const qLog = query(collection(db, logPath));
    const unsubLog = onSnapshot(
      qLog,
      (snap) => {
        const logs = [];
        snap.forEach((doc) => logs.push({ id: doc.id, ...doc.data() }));
        logs.sort(
          (a, b) =>
            (b.timestamp?.toDate?.() || 0) - (a.timestamp?.toDate?.() || 0)
        );
        setTransactionLog(logs);
        setIsLoadingLog(false);
      },
      (err) => {
        console.error("Log fetch err:", err);
        setError("Log fetch failed.");
        setIsLoadingLog(false);
      }
    );
    return () => unsubLog();
  }, [isAuthReady, db, userId, appId]);

  useEffect(() => {
    /* Fetch Production Batches */
    if (!isAuthReady || !db || !userId) {
      if (isAuthReady && (!db || !userId)) setIsLoadingProduction(false);
      return;
    }
    setIsLoadingProduction(true);
    const productionPath = `artifacts/${appId}/users/${userId}/productionBatches`;
    const qProd = query(collection(db, productionPath));
    const unsubProd = onSnapshot(
      qProd,
      (snap) => {
        const items = [];
        snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() }));
        setProductionBatches(items);
        setIsLoadingProduction(false);
      },
      (err) => {
        console.error("Production fetch error:", err);
        setError("Production fetch failed.");
        setIsLoadingProduction(false);
      }
    );
    return () => unsubProd();
  }, [isAuthReady, db, userId, appId]);

  const sortedInventory = useMemo(() => {
    let sorted = [...inventory];
    switch (sortCriteria) {
      case "name_asc":
        sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        break;
      case "name_desc":
        sorted.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
        break;
      case "product_asc":
        sorted.sort((a, b) => {
          const productA =
            a.status === "filled"
              ? a.currentFill?.productType || "zzzz_empty_product"
              : "zzzz_empty_container";
          const productB =
            b.status === "filled"
              ? b.currentFill?.productType || "zzzz_empty_product"
              : "zzzz_empty_container";
          return productA.localeCompare(productB);
        });
        break;
      case "product_desc":
        sorted.sort((a, b) => {
          const productA =
            a.status === "filled"
              ? a.currentFill?.productType || "!!!!_empty_product"
              : "!!!!_empty_container";
          const productB =
            b.status === "filled"
              ? b.currentFill?.productType || "!!!!_empty_product"
              : "!!!!_empty_container";
          return productB.localeCompare(productA);
        });
        break;
      default:
        break;
    }
    return sorted;
  }, [inventory, sortCriteria]);

  // Modal Openers & Deletion logic
  const handleAddNewContainer = () => {
    setEditingContainer(null);
    setFormModalMode("add");
    setShowFormModal(true);
  };
  const handleEditContainerInfo = (c) => {
    setEditingContainer(c);
    setFormModalMode("edit");
    setShowFormModal(true);
  };
  const handleRefillContainer = (c) => {
    setEditingContainer({
      ...c,
      currentFill: {
        ...(c.currentFill || {}),
        productType:
          c.currentFill?.productType ||
          (products.length > 0 ? products[0].name : ""),
        grossWeightLbs: "",
        proof: "",
        wineGallonsInput: "",
        proofGallonsInput: "",
        fillDate: new Date().toISOString().split("T")[0],
      },
    });
    setFormModalMode("refill");
    setShowFormModal(true);
  };
  const handleOpenTransferModal = (c) => {
    setTransferSourceContainer(c);
    setShowTransferModal(true);
  };
  const handleOpenSampleModal = (c) => {
    setAdjustingContainer(c);
    setShowAdjustContentsModal(true);
  };
  const handleOpenProofDownModal = (c) => {
    setProofingContainer(c);
    setShowProofDownModal(true);
  };
  const handleOpenBottlingModal = (c) => {
    setBottlingContainer(c);
    setShowBottlingModal(true);
  };
  const handleDeletePrompt = (item, type) => {
    setItemToDelete({ item, type });
    setShowConfirmModal(true);
  };
  const handleOpenManageProductsModal = () => setShowManageProductsModal(true);
  const handleOpenViewLogModal = () => setShowViewLogModal(true);
  const handleOpenImportModal = () => setShowImportModal(true);
  const handleOpenTtbReportModal = () => setShowTtbReportModal(true);
  const handleAddProductionBatch = (type) => {
    setEditingProductionBatch(null);
    setProductionModalType(type);
    setShowProductionModal(true);
  };
  const handleEditProductionBatch = (batch) => {
    setEditingProductionBatch(batch);
    setProductionModalType(batch.batchType);
    setShowProductionModal(true);
  };
  const handleOpenChangeAccountModal = (container) => {
    setEditingContainer(container);
    setShowChangeAccountModal(true);
  };

  const confirmDeletion = async () => {
    if (!db || !userId || !itemToDelete) return;
    const { item, type } = itemToDelete;
    let docRef, logData;
    try {
      if (type === "container") {
        docRef = doc(
          db,
          `artifacts/${appId}/users/${userId}/spiritInventory`,
          item.id
        );
        logData = {
          type:
            item.status === "filled"
              ? "DELETE_FILLED_CONTAINER"
              : "DELETE_EMPTY_CONTAINER",
          containerId: item.id,
          containerName: item.name,
          productType: item.currentFill?.productType || null,
          proof: item.currentFill?.proof || 0,
          netWeightLbsChange: -(item.currentFill?.netWeightLbs || 0),
          proofGallonsChange: -(item.currentFill?.proofGallons || 0),
          notes: "Container deleted.",
        };
      } else if (type === "product") {
        const productInUse = inventory.some(
          (invItem) => invItem.currentFill?.productType === item.name
        );
        if (productInUse) {
          setError(
            `"${item.name}" is in use by a container and cannot be deleted.`
          );
          setShowConfirmModal(false);
          setItemToDelete(null);
          return;
        }
        docRef = doc(
          db,
          `artifacts/${appId}/users/${userId}/spiritProducts`,
          item.id
        );
        logData = {
          type: "DELETE_PRODUCT",
          productName: item.name,
          notes: "Product definition deleted.",
        };
      } else if (type === "productionBatch") {
        docRef = doc(
          db,
          `artifacts/${appId}/users/${userId}/productionBatches`,
          item.id
        );
        logData = {
          type: "DELETE_PRODUCTION_BATCH",
          batchId: item.id,
          batchName: item.name,
          batchType: item.batchType,
          notes: "Production batch deleted.",
        };
      }
      if (docRef) await deleteDoc(docRef);
      if (logData) await logTransaction(db, userId, appId, logData);
      setError("");
    } catch (e) {
      console.error("Deletion error:", e);
      setError("Deletion failed.");
    }
    setShowConfirmModal(false);
    setItemToDelete(null);
  };

  const isLoading =
    isLoadingInventory ||
    isLoadingProducts ||
    isLoadingLog ||
    isLoadingProduction;

  return (
    /* Main App JSX */
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-sans">
      <header className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-blue-400">{APP_NAME}</h1>
        {/* Replace the hardcoded "Jeff" with the user's email */}
        {userEmail && (
          <p className="text-sm text-gray-400">Welcome, {userEmail}!</p>
        )}
        {/* Keep the existing userId display */}
        {userId && (
          <p className="text-xs text-gray-500 mt-1">
            UID: {userId} (App: {appId})
          </p>
        )}
      </header>

      <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => setShowDashboard(!showDashboard)}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center justify-between"
          >
            <span>Distillery Dashboard</span>
            <svg
              className={`w-5 h-5 ml-2 transition-transform duration-300 ${
                showDashboard ? "transform rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </button>
          <button
            onClick={() =>
              setCurrentView(
                currentView === "inventory" ? "production" : "inventory"
              )
            }
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md"
          >
            {currentView === "inventory"
              ? "Show Production Tracking"
              : "Show Spirit Inventory"}
          </button>
        </div>
        {showDashboard && <Dashboard inventory={inventory} />}
      </div>

      {error && (
        <div className="bg-red-700 p-3 rounded mb-4 text-center">{error}</div>
      )}

      {/* View-specific controls and content */}
      {currentView === "inventory" ? (
        <>
          <div className="mb-6 flex flex-wrap justify-center items-center gap-4">
            <button
              onClick={handleAddNewContainer}
              className="bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-lg shadow-md"
            >
              Add Container
            </button>
            <button
              onClick={handleOpenManageProductsModal}
              className="bg-teal-600 hover:bg-teal-700 py-2 px-4 rounded-lg shadow-md"
            >
              Manage Products
            </button>
            <button
              onClick={handleOpenViewLogModal}
              className="bg-indigo-600 hover:bg-indigo-700 py-2 px-4 rounded-lg shadow-md"
            >
              View Log
            </button>
            <div className="relative inline-block text-left">
              <DropdownButton label="Import/Export/Reports">
                <DropdownItem onClick={handleOpenImportModal}>
                  Import Containers CSV
                </DropdownItem>
                <DropdownItem
                  onClick={() =>
                    downloadCSV(
                      convertToCSV(
                        sortedInventory.map((c) => [
                          c.name,
                          c.type,
                          c.status,
                          c.currentFill?.productType || "N/A",
                          c.tareWeightLbs || 0,
                          c.currentFill?.grossWeightLbs || 0,
                          c.currentFill?.netWeightLbs || 0,
                          c.currentFill?.proof || 0,
                          c.currentFill?.wineGallons || 0,
                          c.currentFill?.proofGallons || 0,
                          c.currentFill?.fillDate || "N/A",
                          c.currentFill?.emptiedDate || "N/A",
                        ]),
                        [
                          "Container Name",
                          "Type",
                          "Status",
                          "Product Type",
                          "Tare (lbs)",
                          "Gross (lbs)",
                          "Net (lbs)",
                          "Proof",
                          "Wine Gal",
                          "Proof Gal",
                          "Fill Date",
                          "Emptied Date",
                        ]
                      ),
                      `inventory_${new Date().toISOString().split("T")[0]}.csv`
                    )
                  }
                >
                  Export Inventory CSV
                </DropdownItem>
                <DropdownItem onClick={handleOpenTtbReportModal}>
                  TTB Report Summarizer
                </DropdownItem>
              </DropdownButton>
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="sortCriteria" className="text-sm text-gray-300">
                Sort by:
              </label>
              <select
                id="sortCriteria"
                value={sortCriteria}
                onChange={(e) => setSortCriteria(e.target.value)}
                className="bg-gray-700 text-gray-200 p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="product_asc">Product (A-Z)</option>
                <option value="product_desc">Product (Z-A)</option>
              </select>
            </div>
          </div>
          {isLoading && isAuthReady && userId && (
            <div className="text-xl p-8 text-center">Loading data...</div>
          )}
          {!isLoading &&
            sortedInventory.length === 0 &&
            isAuthReady &&
            userId && (
              <div className="text-gray-400 text-lg p-8 text-center">
                No containers. Add one!
              </div>
            )}
          {!isLoading && sortedInventory.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
              {sortedInventory.map((c) => (
                <InventoryItem
                  key={c.id}
                  container={c}
                  onEditInfo={handleEditContainerInfo}
                  onRefill={handleRefillContainer}
                  onTransfer={handleOpenTransferModal}
                  onSample={handleOpenSampleModal}
                  onProofDown={handleOpenProofDownModal}
                  onBottle={handleOpenBottlingModal}
                  onDelete={(id) =>
                    handleDeletePrompt(
                      inventory.find((c) => c.id === id),
                      "container"
                    )
                  }
                  onChangeAccount={handleOpenChangeAccountModal}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <ProductionView
          batches={productionBatches}
          isLoading={isLoadingProduction}
          onAddBatch={handleAddProductionBatch}
          onEditBatch={handleEditProductionBatch}
          onDeleteBatch={(batch) =>
            handleDeletePrompt(batch, "productionBatch")
          }
        />
      )}
      {isAuthReady && !userId && showAuthModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-center">
              {authMode === "login" ? "Login" : "Sign Up"}
            </h2>
            {authError && (
              <div className="bg-red-700 p-2 rounded mb-4 text-center">
                {authError}
              </div>
            )}
            <form onSubmit={handleAuth}>
              <div className="mb-4">
                <label
                  htmlFor="authEmail"
                  className="block text-sm font-medium mb-1"
                >
                  Email
                </label>
                <input
                  type="email"
                  id="authEmail"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  className="w-full bg-gray-700 p-2 rounded"
                  placeholder="your@email.com"
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="authPassword"
                  className="block text-sm font-medium mb-1"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="authPassword"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  className="w-full bg-gray-700 p-2 rounded"
                  placeholder="Password"
                />
              </div>
              <div className="flex flex-col space-y-3">
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-lg shadow-md"
                >
                  {authMode === "login" ? "Login" : "Sign Up"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAuthMode(authMode === "login" ? "signup" : "login")
                  }
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {authMode === "login"
                    ? "Don't have an account? Sign Up"
                    : "Already have an account? Login"}
                </button>
                {/* Optional: Add a cancel/close button for the modal if needed, though typically login is required */}
                {/* <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="bg-gray-600 hover:bg-gray-700 py-2 px-4 rounded-lg"
              >
                Cancel
              </button> */}
              </div>
            </form>
          </div>
        </div>
      )}
      {isAuthReady &&
        userId && ( // Add userId check here
          <>
            {/* Logout Button - Add this somewhere appropriate in your header/navigation */}
            <div className="flex justify-end mb-4">
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 py-1 px-3 rounded text-sm"
              >
                Logout
              </button>
            </div>

            {/* Existing App Content */}
            {isLoading && (
              <div className="flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}

            {!isLoading && (
              <>
                {/* ... rest of your existing main app JSX ... */}
                {/* This includes Dashboard, View Switching, Inventory/Production Lists, Modals, etc. */}
                {/* Make sure all modals and components that need userId/db are rendered inside this block */}
                {/* Example placeholder for existing content structure: */}
                {error && (
                  <div className="bg-red-700 p-3 rounded mb-4 text-center">
                    {error}
                  </div>
                )}
                {/* ... (Dashboard, currentView logic, buttons, lists, modals) ... */}
              </>
            )}
          </>
        )}

      {/* Modals */}
      {showFormModal && db && userId && (
        <AddEditContainerModal
          db={db}
          userId={userId}
          appId={appId}
          container={editingContainer}
          mode={formModalMode}
          products={products}
          inventory={inventory}
          onClose={() => {
            setShowFormModal(false);
            setEditingContainer(null);
          }}
          setErrorApp={setError}
        />
      )}
      {showProductionModal && db && userId && (
        <AddEditProductionModal
          db={db}
          userId={userId}
          appId={appId}
          batch={editingProductionBatch}
          type={productionModalType}
          fermentations={productionBatches.filter(
            (b) => b.batchType === "fermentation"
          )}
          products={products}
          inventory={inventory}
          onClose={() => {
            setShowProductionModal(false);
            setEditingProductionBatch(null);
          }}
          setErrorApp={setError}
        />
      )}
      {showTransferModal && db && userId && transferSourceContainer && (
        <TransferModal
          db={db}
          userId={userId}
          appId={appId}
          sourceContainer={transferSourceContainer}
          allContainers={inventory}
          products={products}
          onClose={() => {
            setShowTransferModal(false);
            setTransferSourceContainer(null);
          }}
          setErrorApp={setError}
        />
      )}
      {showAdjustContentsModal && db && userId && adjustingContainer && (
        <AdjustContentsModal
          db={db}
          userId={userId}
          appId={appId}
          container={adjustingContainer}
          onClose={() => {
            setShowAdjustContentsModal(false);
            setAdjustingContainer(null);
          }}
          setErrorApp={setError}
        />
      )}
      {showProofDownModal && db && userId && proofingContainer && (
        <ProofDownModal
          db={db}
          userId={userId}
          appId={appId}
          container={proofingContainer}
          onClose={() => {
            setShowProofDownModal(false);
            setProofingContainer(null);
          }}
          setErrorApp={setError}
        />
      )}
      {showBottlingModal && db && userId && bottlingContainer && (
        <BottlingModal
          db={db}
          userId={userId}
          appId={appId}
          container={bottlingContainer}
          onClose={() => {
            setShowBottlingModal(false);
            setBottlingContainer(null);
          }}
          setErrorApp={setError}
        />
      )}
      {showManageProductsModal && db && userId && (
        <ManageProductsModal
          db={db}
          userId={userId}
          appId={appId}
          currentProducts={products}
          inventory={inventory}
          onDeletePrompt={(prod) => handleDeletePrompt(prod, "product")}
          onClose={() => setShowManageProductsModal(false)}
          setErrorApp={setError}
        />
      )}
      {showViewLogModal && (
        <ViewLogModal
          transactionLog={transactionLog}
          isLoadingLog={isLoadingLog}
          onClose={() => setShowViewLogModal(false)}
        />
      )}
      {showImportModal && db && userId && (
        <ImportContainersModal
          db={db}
          userId={userId}
          appId={appId}
          existingContainers={inventory}
          products={products}
          onClose={() => setShowImportModal(false)}
          setErrorApp={setError}
        />
      )}
      {showTtbReportModal && (
        <TtbReportModal
          transactionLog={transactionLog}
          onClose={() => setShowTtbReportModal(false)}
        />
      )}
      {showConfirmModal && (
        <ConfirmationModal
          message={
            itemToDelete.type === "product"
              ? `Delete product "${itemToDelete.item.name}"? This cannot be undone.`
              : itemToDelete.type === "container"
              ? `Delete container "${itemToDelete.item.name}"? This will also delete its contents from inventory and cannot be undone.`
              : itemToDelete.type === "productionBatch"
              ? `Delete batch "${itemToDelete.item.name}"? This cannot be undone.`
              : "Are you sure you want to delete this item?"
          }
          onConfirm={confirmDeletion}
          onCancel={() => {
            setShowConfirmModal(false);
            setItemToDelete(null);
          }}
        />
      )}
      {showChangeAccountModal && db && userId && editingContainer && (
        <ChangeAccountModal
          db={db}
          userId={userId}
          appId={appId}
          container={editingContainer}
          onClose={() => {
            setShowChangeAccountModal(false);
            setEditingContainer(null);
          }}
          setErrorApp={setError}
        />
      )}
    </div>
  );
}

export default App;
