import { useState} from "react";
import { doc, updateDoc } from "firebase/firestore";
import { logTransaction } from "../../utils/helpers";
import { TRANSACTION_TYPES } from "../../constants";

export const ChangeAccountModal = ({ db, userId, appId, container, onClose, setErrorApp }) => {
  const [newAccount, setNewAccount] = useState(container?.currentFill?.account || 'storage');
  const [formError, setFormError] = useState('');

  const handleSubmit = async (e) => {
      e.preventDefault();
      setFormError('');
      
      if (!newAccount.trim()) {
          setFormError("Please select an account.");
          return;
      }

      try {
          const containerRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, container.id);
          await updateDoc(containerRef, {
              "currentFill.account": newAccount
          });
          
          await logTransaction(db, userId, appId, {
              type: TRANSACTION_TYPES.CHANGE_ACCOUNT,
              containerId: container.id,
              containerName: container.name,
              notes: `Account changed to ${newAccount}.`
          });
          
          setErrorApp('');
          onClose();
      } catch (err) {
          console.error("Change account error:", err);
          setFormError("Failed to change account: " + err.message);
          setErrorApp("Failed to change account.");
      }
  };

  return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
              <h2 className="text-xl mb-4 text-blue-300">Change Account: {container?.name}</h2>
              {formError && <div className="bg-red-600 p-2 rounded mb-3 text-sm">{formError}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Account</label>
                      <select 
                          value={newAccount} 
                          onChange={(e) => setNewAccount(e.target.value)}
                          className="w-full bg-gray-700 p-2 rounded"
                      >
                          <option value="storage">Storage</option>
                          <option value="production">Production</option>
                          <option value="processing">Processing</option>
                      </select>
                  </div>
                  <div className="flex justify-end space-x-3">
                      <button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">
                          Cancel
                      </button>
                      <button type="submit" className="bg-blue-600 py-2 px-4 rounded">
                          Change Account
                      </button>
                  </div>
              </form>
          </div>
      </div>
  );
};