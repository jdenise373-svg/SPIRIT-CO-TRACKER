import { useState, useEffect, useRef } from "react";
import { writeBatch, doc, collection, serverTimestamp, deleteDoc } from "firebase/firestore";
import { convertToCSV, downloadCSV } from "../../utils/helpers";
import { TRANSACTION_TYPES, UNDOABLE_TRANSACTION_TYPES } from "../../constants";

// --- ViewLogModal ---
export const ViewLogModal = ({ 
  transactionLog, 
  isLoadingLog, 
  onClose, 
  db, 
  userId, 
  appId, 
  inventory,
  setErrorApp,
  onLogUpdated 
}) => {
  const [isUndoing, setIsUndoing] = useState(false);
  const [undoingTransactionId, setUndoingTransactionId] = useState(null);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [transactionToUndo, setTransactionToUndo] = useState(null);
  const [undoSuccess, setUndoSuccess] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [transactionToRemove, setTransactionToRemove] = useState(null);
  const [removeSuccess, setRemoveSuccess] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close menu when clicking outside the table or on other elements
      if (!event.target.closest('.transaction-table')) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleExportLog = () => {
    const headers = [
      "Timestamp",
      "Type",
      "Container Name",
      "Container ID",
      "Product Type",
      "Proof",
      "Net Wt Change (lbs)",
      "PG Change",
      "Source Container",
      "Dest. Container",
      "Notes",
    ];
    const data = transactionLog.map((log) => [
      log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : "N/A",
      log.type || "N/A",
      log.containerName || "N/A",
      log.containerId || "N/A",
      log.productType || "N/A",
      log.proof || 0,
      log.netWeightLbsChange?.toFixed(2) || 0,
      log.proofGallonsChange?.toFixed(3) || 0,
      log.sourceContainerName ||
        (log.type === "TRANSFER_IN" ? log.sourceContainerId : "N/A"),
      log.destinationContainerName ||
        (log.type === "TRANSFER_OUT" ? log.destinationContainerId : "N/A"),
      log.notes || "",
    ]);
    const csvString = convertToCSV(data, headers);
    downloadCSV(
      csvString,
      `transaction_log_${new Date().toISOString().split("T")[0]}.csv`
    );
  };

  const canUndoTransaction = (transaction) => {
    // Check if transaction type is undoable
    if (!UNDOABLE_TRANSACTION_TYPES.includes(transaction.type)) {
      return false;
    }
    
    // Check if transaction has required data for undo
    if (!transaction.containerId || !transaction.containerName) {
      return false;
    }
    
    // Check if container still exists in inventory
    const container = inventory.find(c => c.id === transaction.containerId);
    if (!container) {
      return false;
    }
    
    // Check if transaction is not too old (optional - you can adjust this)
    if (transaction.timestamp?.toDate) {
      const transactionDate = transaction.timestamp.toDate();
      const daysSinceTransaction = (new Date() - transactionDate) / (1000 * 60 * 60 * 24);
      if (daysSinceTransaction > 30) { // 30 days limit
        return false;
      }
    }
    
    return true;
  };

  const getUndoDescription = (transaction) => {
    switch (transaction.type) {
      case TRANSACTION_TYPES.TRANSFER_IN:
        return `Reverse transfer of ${Math.abs(transaction.proofGallonsChange || 0).toFixed(3)} PG from ${transaction.sourceContainerName || transaction.sourceContainerId}`;
      case TRANSACTION_TYPES.TRANSFER_OUT:
        return `Reverse transfer of ${Math.abs(transaction.proofGallonsChange || 0).toFixed(3)} PG to ${transaction.destinationContainerName || transaction.destinationContainerId}`;
      case TRANSACTION_TYPES.SAMPLE_ADJUST:
        return `Reverse sample/adjustment of ${Math.abs(transaction.proofGallonsChange || 0).toFixed(3)} PG`;
      case TRANSACTION_TYPES.BOTTLE_PARTIAL:
      case TRANSACTION_TYPES.BOTTLE_EMPTY:
        return `Reverse bottling of ${Math.abs(transaction.proofGallonsChange || 0).toFixed(3)} PG`;
      case TRANSACTION_TYPES.BOTTLING_GAIN:
        return `Reverse bottling gain of ${transaction.proofGallonsChange?.toFixed(3) || 0} PG`;
      case TRANSACTION_TYPES.BOTTLING_LOSS:
        return `Reverse bottling loss of ${Math.abs(transaction.proofGallonsChange || 0).toFixed(3)} PG`;
      case TRANSACTION_TYPES.PROOF_DOWN:
        return `Reverse proof down adjustment of ${Math.abs(transaction.proofGallonsChange || 0).toFixed(3)} PG`;
      default:
        return "Reverse transaction";
    }
  };

  const getUndoReason = (transaction) => {
    if (!transaction.containerId || !transaction.containerName) {
      return "Missing container information";
    }
    
    const container = inventory.find(c => c.id === transaction.containerId);
    if (!container) {
      return "Container no longer exists";
    }
    
    if (transaction.timestamp?.toDate) {
      const transactionDate = transaction.timestamp.toDate();
      const daysSinceTransaction = (new Date() - transactionDate) / (1000 * 60 * 60 * 24);
      if (daysSinceTransaction > 30) {
        return "Transaction is older than 30 days";
      }
    }
    
    return "Transaction type cannot be undone";
  };

  const handleUndoTransaction = async (transaction) => {
    if (!db || !userId || !appId) {
      setErrorApp("Database connection required for undo operation.");
      return;
    }

    setIsUndoing(true);
    setUndoingTransactionId(transaction.id);

    try {
      const batch = writeBatch(db);
      
      switch (transaction.type) {
        case TRANSACTION_TYPES.TRANSFER_IN:
          await undoTransferIn(batch, transaction);
          break;
        case TRANSACTION_TYPES.TRANSFER_OUT:
          await undoTransferOut(batch, transaction);
          break;
        case TRANSACTION_TYPES.SAMPLE_ADJUST:
          await undoSampleAdjust(batch, transaction);
          break;
        case TRANSACTION_TYPES.BOTTLE_PARTIAL:
        case TRANSACTION_TYPES.BOTTLE_EMPTY:
          await undoBottling(batch, transaction);
          break;
        case TRANSACTION_TYPES.BOTTLING_GAIN:
          await undoBottlingGain(batch, transaction);
          break;
        case TRANSACTION_TYPES.BOTTLING_LOSS:
          await undoBottlingLoss(batch, transaction);
          break;
        case TRANSACTION_TYPES.PROOF_DOWN:
          await undoProofDown(batch, transaction);
          break;
        default:
          throw new Error(`Cannot undo transaction type: ${transaction.type}`);
      }

      // Delete the original transaction log entry
      const originalLogRef = doc(db, `artifacts/${appId}/users/${userId}/transactionLog`, transaction.id);
      batch.delete(originalLogRef);

      await batch.commit();
      setErrorApp("");
      setUndoSuccess(true);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setUndoSuccess(false), 3000);
      
      // Notify parent component to refresh the transaction log
      if (onLogUpdated) {
        onLogUpdated();
      }
      
    } catch (err) {
      console.error("Undo error:", err);
      setErrorApp(`Undo failed: ${err.message}`);
    } finally {
      setIsUndoing(false);
      setUndoingTransactionId(null);
    }
  };

  const handleRemoveLog = async (transaction) => {
    if (!db || !userId || !appId) {
      setErrorApp("Database connection required for remove operation.");
      return;
    }

    if (!transaction.id) {
      setErrorApp("Cannot remove log entry: missing transaction ID");
      return;
    }

    try {
      // Simply delete the log entry without affecting container state
      const logRef = doc(db, `artifacts/${appId}/users/${userId}/transactionLog`, transaction.id);
      await deleteDoc(logRef);
      
      setErrorApp("");
      setRemoveSuccess(true);
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setRemoveSuccess(false), 3000);
      
      // Notify parent component to refresh the transaction log
      if (onLogUpdated) {
        onLogUpdated();
      }
      
    } catch (err) {
      console.error("Remove log error:", err);
      console.error("Transaction details:", transaction);
      setErrorApp(`Remove failed: ${err.message}`);
    }
  };

  const undoTransferIn = async (batch, transaction) => {
    // Find the container that received the transfer
    const container = inventory.find(c => c.id === transaction.containerId);
    if (!container) throw new Error("Container not found");

    // Calculate new values after reversing the transfer
    const currentNetWeight = container.currentFill?.netWeightLbs || 0;
    const currentWineGallons = container.currentFill?.wineGallons || 0;
    const currentProofGallons = container.currentFill?.proofGallons || 0;
    
    const transferNetWeight = Math.abs(transaction.netWeightLbsChange || 0);
    const transferProofGallons = Math.abs(transaction.proofGallonsChange || 0);
    
    const newNetWeight = currentNetWeight - transferNetWeight;
    const newProofGallons = currentProofGallons - transferProofGallons;
    
    // If this would empty the container, set it to empty
    if (newNetWeight <= 0.001) {
      batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
        status: "empty",
        "currentFill.grossWeightLbs": container.tareWeightLbs || 0,
        "currentFill.netWeightLbs": 0,
        "currentFill.wineGallons": 0,
        "currentFill.proofGallons": 0,
        "currentFill.proof": 0,
        "currentFill.emptiedDate": new Date().toISOString().split("T")[0],
        "currentFill.spiritDensity": 0
      });
    } else {
      // Recalculate wine gallons based on new net weight
      const spiritDensity = container.currentFill?.spiritDensity || 0;
      const newWineGallons = spiritDensity > 0 ? newNetWeight / spiritDensity : 0;
      
      batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
        "currentFill.netWeightLbs": newNetWeight,
        "currentFill.wineGallons": newWineGallons,
        "currentFill.proofGallons": newProofGallons,
        "currentFill.grossWeightLbs": (container.tareWeightLbs || 0) + newNetWeight
      });
    }
  };

  const undoTransferOut = async (batch, transaction) => {
    // Find the container that sent the transfer
    const container = inventory.find(c => c.id === transaction.containerId);
    if (!container) throw new Error("Container not found");

    // Calculate new values after reversing the transfer
    const currentNetWeight = container.currentFill?.netWeightLbs || 0;
    const currentWineGallons = container.currentFill?.wineGallons || 0;
    const currentProofGallons = container.currentFill?.proofGallons || 0;
    
    const transferNetWeight = Math.abs(transaction.netWeightLbsChange || 0);
    const transferProofGallons = Math.abs(transaction.proofGallonsChange || 0);
    
    const newNetWeight = currentNetWeight + transferNetWeight;
    const newProofGallons = currentProofGallons + transferProofGallons;
    
    // If container was empty, it becomes filled
    if (container.status === "empty") {
      batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
        status: "filled",
        "currentFill.fillDate": new Date().toISOString().split("T")[0],
        "currentFill.emptiedDate": null
      });
    }
    
    // Recalculate wine gallons based on new net weight
    const spiritDensity = container.currentFill?.spiritDensity || 0;
    const newWineGallons = spiritDensity > 0 ? newNetWeight / spiritDensity : 0;
    
    batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
      "currentFill.netWeightLbs": newNetWeight,
      "currentFill.wineGallons": newWineGallons,
      "currentFill.proofGallons": newProofGallons,
      "currentFill.grossWeightLbs": (container.tareWeightLbs || 0) + newNetWeight
    });
  };

  const undoSampleAdjust = async (batch, transaction) => {
    // Reverse sample adjustment by adding back the removed amount
    const container = inventory.find(c => c.id === transaction.containerId);
    if (!container) throw new Error("Container not found");

    const currentNetWeight = container.currentFill?.netWeightLbs || 0;
    const currentWineGallons = container.currentFill?.wineGallons || 0;
    const currentProofGallons = container.currentFill?.proofGallons || 0;
    
    const adjustNetWeight = Math.abs(transaction.netWeightLbsChange || 0);
    const adjustProofGallons = Math.abs(transaction.proofGallonsChange || 0);
    
    const newNetWeight = currentNetWeight + adjustNetWeight;
    const newProofGallons = currentProofGallons + adjustProofGallons;
    
    // Recalculate wine gallons based on new net weight
    const spiritDensity = container.currentFill?.spiritDensity || 0;
    const newWineGallons = spiritDensity > 0 ? newNetWeight / spiritDensity : 0;
    
    batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
      "currentFill.netWeightLbs": newNetWeight,
      "currentFill.wineGallons": newWineGallons,
      "currentFill.proofGallons": newProofGallons,
      "currentFill.grossWeightLbs": (container.tareWeightLbs || 0) + newNetWeight
    });
  };

  const undoBottling = async (batch, transaction) => {
    // Reverse bottling by adding back the bottled amount
    const container = inventory.find(c => c.id === transaction.containerId);
    if (!container) throw new Error("Container not found");

    const currentNetWeight = container.currentFill?.netWeightLbs || 0;
    const currentWineGallons = container.currentFill?.wineGallons || 0;
    const currentProofGallons = container.currentFill?.proofGallons || 0;
    
    const bottledNetWeight = Math.abs(transaction.netWeightLbsChange || 0);
    const bottledProofGallons = Math.abs(transaction.proofGallonsChange || 0);
    
    const newNetWeight = currentNetWeight + bottledNetWeight;
    const newProofGallons = currentProofGallons + bottledProofGallons;
    
    // Recalculate wine gallons based on new net weight
    const spiritDensity = container.currentFill?.spiritDensity || 0;
    const newWineGallons = spiritDensity > 0 ? newNetWeight / spiritDensity : 0;
    
    batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
      "currentFill.netWeightLbs": newNetWeight,
      "currentFill.wineGallons": newWineGallons,
      "currentFill.proofGallons": newProofGallons,
      "currentFill.grossWeightLbs": (container.tareWeightLbs || 0) + newNetWeight
    });
  };

  const undoBottlingGain = async (batch, transaction) => {
    // Reverse bottling gain by removing the gained amount
    const container = inventory.find(c => c.id === transaction.containerId);
    if (!container) throw new Error("Container not found");

    const currentNetWeight = container.currentFill?.netWeightLbs || 0;
    const currentWineGallons = container.currentFill?.wineGallons || 0;
    const currentProofGallons = container.currentFill?.proofGallons || 0;
    
    const gainedNetWeight = transaction.netWeightLbsChange || 0;
    const gainedProofGallons = transaction.proofGallonsChange || 0;
    
    const newNetWeight = currentNetWeight - gainedNetWeight;
    const newProofGallons = currentProofGallons - gainedProofGallons;
    
    // If this would empty the container, set it to empty
    if (newNetWeight <= 0.001) {
      batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
        status: "empty",
        "currentFill.grossWeightLbs": container.tareWeightLbs || 0,
        "currentFill.netWeightLbs": 0,
        "currentFill.wineGallons": 0,
        "currentFill.proofGallons": 0,
        "currentFill.proof": 0,
        "currentFill.emptiedDate": new Date().toISOString().split("T")[0],
        "currentFill.spiritDensity": 0
      });
    } else {
      // Recalculate wine gallons based on new net weight
      const spiritDensity = container.currentFill?.spiritDensity || 0;
      const newWineGallons = spiritDensity > 0 ? newNetWeight / spiritDensity : 0;
      
      batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
        "currentFill.netWeightLbs": newNetWeight,
        "currentFill.wineGallons": newWineGallons,
        "currentFill.proofGallons": newProofGallons,
        "currentFill.grossWeightLbs": (container.tareWeightLbs || 0) + newNetWeight
      });
    }
  };

  const undoBottlingLoss = async (batch, transaction) => {
    // Reverse bottling loss by adding back the lost amount
    const container = inventory.find(c => c.id === transaction.containerId);
    if (!container) throw new Error("Container not found");

    const currentNetWeight = container.currentFill?.netWeightLbs || 0;
    const currentWineGallons = container.currentFill?.wineGallons || 0;
    const currentProofGallons = container.currentFill?.proofGallons || 0;
    
    const lostNetWeight = Math.abs(transaction.netWeightLbsChange || 0);
    const lostProofGallons = Math.abs(transaction.proofGallonsChange || 0);
    
    const newNetWeight = currentNetWeight + lostNetWeight;
    const newProofGallons = currentProofGallons + lostProofGallons;
    
    // Recalculate wine gallons based on new net weight
    const spiritDensity = container.currentFill?.spiritDensity || 0;
    const newWineGallons = spiritDensity > 0 ? newNetWeight / spiritDensity : 0;
    
    batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
      "currentFill.netWeightLbs": newNetWeight,
      "currentFill.wineGallons": newWineGallons,
      "currentFill.proofGallons": newProofGallons,
      "currentFill.grossWeightLbs": (container.tareWeightLbs || 0) + newNetWeight
    });
  };

  const undoProofDown = async (batch, transaction) => {
    // Reverse proof down by restoring the original proof and recalculating
    const container = inventory.find(c => c.id === transaction.containerId);
    if (!container) throw new Error("Container not found");

    // This is complex and would need the original proof value
    // For now, we'll just reverse the weight/proof gallon changes
    const currentNetWeight = container.currentFill?.netWeightLbs || 0;
    const currentWineGallons = container.currentFill?.wineGallons || 0;
    const currentProofGallons = container.currentFill?.proofGallons || 0;
    
    const adjustNetWeight = Math.abs(transaction.netWeightLbsChange || 0);
    const adjustProofGallons = Math.abs(transaction.proofGallonsChange || 0);
    
    const newNetWeight = currentNetWeight + adjustNetWeight;
    const newProofGallons = currentProofGallons + adjustProofGallons;
    
    // Recalculate wine gallons based on new net weight
    const spiritDensity = container.currentFill?.spiritDensity || 0;
    const newWineGallons = spiritDensity > 0 ? newNetWeight / spiritDensity : 0;
    
    batch.update(doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, transaction.containerId), {
      "currentFill.netWeightLbs": newNetWeight,
      "currentFill.wineGallons": newWineGallons,
      "currentFill.proofGallons": newProofGallons,
      "currentFill.grossWeightLbs": (container.tareWeightLbs || 0) + newNetWeight
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
      <div className="bg-gray-800 w-full h-full flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-gray-700">
          <h2 className="text-3xl font-semibold text-blue-300">
            Transaction Log
          </h2>
          <button
            onClick={handleExportLog}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-md shadow-md text-base"
          >
            Export Log CSV
          </button>
        </div>
        
        {/* Undo Information */}
        <div className="mx-6 mt-4 p-4 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg">
          <p className="text-sm text-blue-200">
            <strong>💡 Undo Feature:</strong> Transactions with red "Undo" buttons can be reversed. 
            This includes transfers ({TRANSACTION_TYPES.TRANSFER_IN}, {TRANSACTION_TYPES.TRANSFER_OUT}), 
            samples ({TRANSACTION_TYPES.SAMPLE_ADJUST}), bottling operations ({TRANSACTION_TYPES.BOTTLE_PARTIAL}, {TRANSACTION_TYPES.BOTTLE_EMPTY}, {TRANSACTION_TYPES.BOTTLING_GAIN}, {TRANSACTION_TYPES.BOTTLING_LOSS}), 
            and proof adjustments ({TRANSACTION_TYPES.PROOF_DOWN}). 
            Undoing will restore the container to its previous state and completely remove the original transaction from the log.
          </p>
        </div>
        {isLoadingLog && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xl text-gray-400">Loading log...</p>
          </div>
        )}
        {undoSuccess && (
          <div className="mx-6 mt-4 p-4 bg-green-900 bg-opacity-30 border border-green-700 rounded-lg">
            <p className="text-sm text-green-200">
              ✅ Transaction successfully undone and removed from log!
            </p>
          </div>
        )}
        {removeSuccess && (
          <div className="mx-6 mt-4 p-4 bg-blue-900 bg-opacity-30 border border-blue-700 rounded-lg">
            <p className="text-sm text-blue-200">
              ✅ Log entry successfully removed!
            </p>
          </div>
        )}
        {!isLoadingLog && transactionLog.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xl text-gray-400">
              No transactions recorded yet.
            </p>
          </div>
        )}
        {!isLoadingLog && transactionLog.length > 0 && (
          <div className="flex-1 mx-6 mb-6 overflow-hidden">
            <div className="h-full overflow-x-auto overflow-y-auto rounded-md border border-gray-700 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
              <table className="min-w-full divide-y divide-gray-700 text-sm transaction-table">
              <thead className="bg-gray-750 sticky top-0 z-10">
                <tr>
                  {[
                    "Date",
                    "Type",
                    "Container",
                    "Product",
                    "Proof",
                    "Net Wt Δ",
                    "PG Δ",
                    "Notes/Xfer",
                    "Actions"
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-6 py-4 text-left font-semibold text-gray-200 tracking-wider whitespace-nowrap bg-gray-750 text-base"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {transactionLog.map((log) => (
                  <tr 
                    key={log.id} 
                    className="hover:bg-gray-700"
                    onClick={() => {
                      // Close any open menu when clicking on table rows
                      if (openMenuId && openMenuId !== log.id) {
                        setOpenMenuId(null);
                      }
                    }}
                  >
                    <td className="px-6 py-3 whitespace-nowrap text-gray-400">
                      {log.timestamp?.toDate
                        ? log.timestamp.toDate().toLocaleString()
                        : "N/A"}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-gray-300">
                      {log.type || "N/A"}
                    </td>
                    <td
                      className="px-6 py-3 whitespace-nowrap text-gray-300"
                      title={log.containerId}
                    >
                      {log.containerName || "N/A"}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-gray-300">
                      {log.productType || "N/A"}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-gray-300">
                      {log.proof || 0}
                    </td>
                    <td
                      className={`px-6 py-3 whitespace-nowrap ${
                        log.netWeightLbsChange > 0
                          ? "text-green-400"
                          : log.netWeightLbsChange < 0
                          ? "text-red-400"
                          : "text-gray-300"
                      }`}
                    >
                      {log.netWeightLbsChange?.toFixed(2) || 0}
                    </td>
                    <td
                      className={`px-6 py-3 whitespace-nowrap ${
                        log.proofGallonsChange > 0
                          ? "text-green-400"
                          : log.proofGallonsChange < 0
                          ? "text-red-400"
                          : "text-gray-300"
                      }`}
                    >
                      {log.proofGallonsChange?.toFixed(3) || 0}
                    </td>
                    <td
                      className="px-6 py-3 text-gray-400 text-sm max-w-xs truncate"
                      title={
                        (log.type === TRANSACTION_TYPES.TRANSFER_OUT &&
                          `To: ${
                            log.destinationContainerName ||
                            log.destinationContainerId
                          }`) ||
                        (log.type === TRANSACTION_TYPES.TRANSFER_IN &&
                          `From: ${
                            log.sourceContainerName || log.sourceContainerId
                          }`) ||
                        log.notes ||
                        ""
                      }
                    >
                      {log.type === TRANSACTION_TYPES.TRANSFER_OUT &&
                        `To: ${
                          log.destinationContainerName ||
                          log.destinationContainerId
                        }`}
                      {log.type === TRANSACTION_TYPES.TRANSFER_IN &&
                        `From: ${
                          log.sourceContainerName || log.sourceContainerId
                        }`}
                      {log.notes && <span> {log.notes}</span>}
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      <div className="relative" ref={menuRef}>
                        <button
                          onClick={() => {
                            // Toggle menu for this specific row
                            setOpenMenuId(openMenuId === log.id ? null : log.id);
                          }}
                          className="px-3 py-2 text-xs rounded font-medium bg-gray-600 hover:bg-gray-700 text-white flex items-center space-x-1"
                          title="Actions menu"
                        >
                          <span>Actions</span>
                          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {/* Dropdown Menu */}
                        {openMenuId === log.id && (
                          <div className="absolute right-0 mt-1 w-48 bg-gray-700 rounded-md shadow-lg z-20 border border-gray-600">
                            <div className="py-1">
                              {canUndoTransaction(log) ? (
                                <button
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setTransactionToUndo(log);
                                    setShowUndoConfirm(true);
                                  }}
                                  disabled={isUndoing}
                                  className={`w-full text-left px-4 py-2 text-sm ${
                                    isUndoing && undoingTransactionId === log.id
                                      ? "text-gray-400 cursor-not-allowed"
                                      : "text-red-300 hover:bg-gray-600"
                                  }`}
                                  title={getUndoDescription(log)}
                                >
                                  {isUndoing && undoingTransactionId === log.id ? "⏳ Undoing..." : "↩️ Undo"}
                                </button>
                              ) : (
                                <div className="px-4 py-2 text-sm text-gray-500 cursor-help" title={getUndoReason(log)}>
                                  ⚠️ Cannot Undo
                                </div>
                              )}
                              
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  console.log("Remove button clicked for log:", log);
                                  setTransactionToRemove(log);
                                  setShowRemoveConfirm(true);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-orange-300 hover:bg-gray-600"
                                title="Remove this log entry (no container state changes)"
                              >
                                🗑️ Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
        <div className="p-6 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-md text-base"
          >
            Close
          </button>
        </div>
      </div>

      {/* Undo Confirmation Modal */}
      {showUndoConfirm && transactionToUndo && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-8 z-60">
          <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4 text-red-400">
              Confirm Undo Transaction
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">
                <strong>Type:</strong> {transactionToUndo.type}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <strong>Container:</strong> {transactionToUndo.containerName}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <strong>Action:</strong> {getUndoDescription(transactionToUndo)}
              </p>
              <p className="text-sm text-gray-400 mt-3">
                This will reverse the transaction, update the container's current state, 
                and completely remove the original transaction from the log. This action cannot be undone.
              </p>
              <p className="text-xs text-blue-300 mt-2">
                <strong>💡 Tip:</strong> Use "Undo" when you want to reverse the actual transaction effects. 
                Use "Remove" when you just want to delete the log entry without affecting containers. Both options are available in the Actions dropdown menu.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowUndoConfirm(false);
                  setTransactionToUndo(null);
                }}
                className="bg-gray-600 py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowUndoConfirm(false);
                  handleUndoTransaction(transactionToUndo);
                  setTransactionToUndo(null);
                }}
                className="bg-red-600 py-2 px-4 rounded"
              >
                Confirm Undo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && transactionToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-8 z-60">
          <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4 text-orange-400">
              Confirm Remove Log Entry
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">
                <strong>Type:</strong> {transactionToRemove.type}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <strong>Container:</strong> {transactionToRemove.containerName}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <strong>Date:</strong> {transactionToRemove.timestamp?.toDate ? transactionToRemove.timestamp.toDate().toLocaleString() : "N/A"}
              </p>
              <p className="text-sm text-orange-300 mt-3">
                <strong>⚠️ Warning:</strong> This will permanently delete this log entry without affecting any container states. 
                This is useful for cleaning up duplicate entries or correcting data entry errors.
              </p>
              <p className="text-sm text-gray-400 mt-2">
                This action cannot be undone and will leave no audit trail of the removal.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRemoveConfirm(false);
                  setTransactionToRemove(null);
                }}
                className="bg-gray-600 py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  console.log("Confirming remove for transaction:", transactionToRemove);
                  setShowRemoveConfirm(false);
                  handleRemoveLog(transactionToRemove);
                  setTransactionToRemove(null);
                }}
                className="bg-orange-600 py-2 px-4 rounded"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
