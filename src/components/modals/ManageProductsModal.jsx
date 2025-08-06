import { useState } from "react";
import { doc, collection, updateDoc, addDoc } from "firebase/firestore";
import { logTransaction } from "../../utils/helpers";
// --- ManageProductsModal ---
export const ManageProductsModal = ({ db, userId, appId, currentProducts, inventory, onDeletePrompt, onClose, setErrorApp }) => {
  const [newProductName, setNewProductName] = useState('');
  const [newProductDescription, setNewProductDescription] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [formError, setFormError] = useState('');
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  const handleEditProduct = (product) => {
      setEditingProduct(product);
      setNewProductName(product.name);
      setNewProductDescription(product.description || '');
  };

  const handleCancelEdit = () => {
      setEditingProduct(null);
      setNewProductName('');
      setNewProductDescription('');
      setFormError('');
  };

  const handleGenerateDescription = async () => {
      if (!newProductName.trim()) {
          setFormError("Please enter a product name first to generate a description.");
          return;
      }
      setFormError('');
      setIsGeneratingDesc(true);
      try {
          const prompt = `Generate a captivating and concise (1-2 sentences) marketable product description for a spirit named "${newProductName.trim()}". Focus on its unique appeal and potential tasting experience. Examples: "A delightful blend of sweet caramel and a hint of sea salt, perfectly balanced with smooth whiskey notes." or "Clean, crisp, and exceptionally smooth vodka, perfect for sipping chilled or as the base of your favorite cocktail."`;
          let chatHistory = [];
          chatHistory.push({ role: "user", parts: [{ text: prompt }] });
          const payload = { contents: chatHistory };
          const apiKey = "";
          const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

          const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });

          if (!response.ok) {
              const errorData = await response.json();
              console.error("Gemini API Error:", errorData);
              throw new Error(`API request failed with status ${response.status}: ${errorData?.error?.message || response.statusText}`);
          }

          const result = await response.json();

          if (result.candidates && result.candidates.length > 0 &&
              result.candidates[0].content && result.candidates[0].content.parts &&
              result.candidates[0].content.parts.length > 0) {
              const generatedText = result.candidates[0].content.parts[0].text;
              setNewProductDescription(generatedText.trim());
          } else {
              console.error("Unexpected Gemini API response structure:", result);
              throw new Error("Failed to parse description from API response.");
          }
      } catch (err) {
          console.error("Error generating description:", err);
          setFormError("Failed to generate description: " + err.message + ". Ensure API key is correctly configured if testing locally.");
      } finally {
          setIsGeneratingDesc(false);
      }
  };


  const handleSaveProduct = async () => {
      if (!newProductName.trim()) { setFormError("Product name cannot be empty."); return; }

      const productsPath = `artifacts/${appId}/users/${userId}/spiritProducts`;

      if (!editingProduct && currentProducts.some(p => p.name.toLowerCase() === newProductName.trim().toLowerCase())) {
           setFormError(`Product "${newProductName.trim()}" already exists.`); return;
      }
       if (editingProduct && editingProduct.name.toLowerCase() !== newProductName.trim().toLowerCase() && currentProducts.some(p => p.name.toLowerCase() === newProductName.trim().toLowerCase())) {
          setFormError(`Another product with the name "${newProductName.trim()}" already exists.`); return;
      }

      setFormError('');
      const productData = {
          name: newProductName.trim(),
          description: newProductDescription.trim()
      };

      try {
          if (editingProduct) {
              const productRef = doc(db, productsPath, editingProduct.id);
              await updateDoc(productRef, productData);
               logTransaction(db,userId,appId, {type: "UPDATE_PRODUCT", productId: editingProduct.id, productName: productData.name, notes: "Product details updated."});
          } else {
              await addDoc(collection(db, productsPath), productData);
              logTransaction(db,userId,appId, {type: "ADD_PRODUCT", productName: productData.name, notes: "New product added."});
          }
          handleCancelEdit();
          setErrorApp('');
      } catch (err) {
          console.error("Save product error:", err);
          setFormError("Failed to save product.");
          setErrorApp("Failed to save product.");
      }
  };

  return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
              <h2 className="text-2xl font-semibold mb-6 text-blue-300">{editingProduct ? "Edit Product" : "Manage Spirit Products"}</h2>
              {formError && <div className="bg-red-600 text-white p-3 rounded mb-4 text-sm">{formError}</div>}

              <div className="space-y-4 mb-6">
                  <div>
                      <label htmlFor="newProductName" className="block text-sm font-medium text-gray-300">Product Name</label>
                      <input type="text" id="newProductName" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="Enter Product Name" className="mt-1 w-full bg-gray-700 border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"/>
                  </div>
                  <div>
                      <label htmlFor="newProductDescription" className="block text-sm font-medium text-gray-300">Description</label>
                      <textarea id="newProductDescription" value={newProductDescription} onChange={(e) => setNewProductDescription(e.target.value)} placeholder="Enter or generate product description" rows="3" className="mt-1 w-full bg-gray-700 border-gray-600 text-gray-200 rounded-md p-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
                      <button type="button" onClick={handleGenerateDescription} disabled={isGeneratingDesc || !newProductName.trim()} className="mt-2 text-sm bg-purple-600 hover:bg-purple-700 text-white font-semibold py-1 px-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                          {isGeneratingDesc ? "Generating..." : "✨ Generate Description"}
                      </button>
                  </div>
                  <div className="flex justify-end space-x-2">
                      {editingProduct && <button type="button" onClick={handleCancelEdit} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md">Cancel Edit</button>}
                      <button onClick={handleSaveProduct} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md">{editingProduct ? "Save Changes" : "Add Product"}</button>
                  </div>
              </div>

              <hr className="my-4 border-gray-700"/>

              <div className="flex-grow overflow-y-auto pr-2">
                  <h3 className="text-lg font-medium text-gray-300 mb-2">Existing Products:</h3>
                  {currentProducts.length === 0 && <p className="text-gray-500">No products defined yet.</p>}
                  <ul className="space-y-3">
                       {currentProducts.map(product => (
                          <li key={product.id} className="flex items-start justify-between gap-4 bg-gray-700 p-3 rounded-md">
                              <div className="flex-1">
                                  <p className="text-gray-100 font-semibold">{product.name}</p>
                                  <p className="text-xs text-gray-400 mt-1">{product.description || "No description."}</p>
                              </div>
                              <div className="flex-shrink-0 flex flex-col gap-2 items-end">
                                  <button onClick={() => handleEditProduct(product)} className="text-blue-400 hover:text-blue-300 text-xs font-semibold uppercase">Edit</button>
                                  <button onClick={() => onDeletePrompt(product)} className="text-red-500 hover:text-red-400 text-xs font-semibold uppercase">Delete</button>
                              </div>
                          </li>
                      ))}
                  </ul>
              </div>
              <div className="mt-6 flex justify-end">
                  <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md">Close</button>
              </div>
          </div>
      </div>
  );
};