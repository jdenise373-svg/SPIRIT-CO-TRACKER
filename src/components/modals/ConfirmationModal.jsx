// --- ConfirmationModal ---
export const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md"><h3 className="text-lg font-semibold text-yellow-300 mb-4">Confirm Action</h3><p className="text-gray-300 mb-6">{message}</p><div className="flex justify-end space-x-3"><button type="button" onClick={onCancel} className="bg-gray-600 py-2 px-4 rounded">Cancel</button><button type="button" onClick={onConfirm} className="bg-red-600 py-2 px-4 rounded">Confirm</button></div></div></div>
);
