import { useEffect, useMemo, useState } from "react";
import { doc, collection, serverTimestamp, writeBatch } from "firebase/firestore";

import { calculateDerivedValuesFromProofGallons, calculateDerivedValuesFromWineGallons, calculateDerivedValuesFromWeight} from "../../utils/helpers";

export const AddEditProductionModal = ({ db, userId, appId, batch, type, fermentations, products, inventory, onClose, setErrorApp }) => {
  const isEdit = !!batch;
  const [formData, setFormData] = useState({});
  const [formError, setFormError] = useState('');
  
  // New state for flexible measurement inputs
  const [chargeInputMethod, setChargeInputMethod] = useState('weight');
  const [yieldInputMethod, setYieldInputMethod] = useState('weight');
  const [chargeInputValue, setChargeInputValue] = useState('');
  const [yieldInputValue, setYieldInputValue] = useState('');
  const [chargeCalculated, setChargeCalculated] = useState({ netWeightLbs: 0, wineGallons: 0, proofGallons: 0 });
  const [yieldCalculated, setYieldCalculated] = useState({ netWeightLbs: 0, wineGallons: 0, proofGallons: 0 });
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [selectedStorageTankId, setSelectedStorageTankId] = useState('');
  const [storageTankPullAmount, setStorageTankPullAmount] = useState('');
  const [storageTankPullMethod, setStorageTankPullMethod] = useState('weight');
  const [chargeTemperature, setChargeTemperature] = useState('68');
  const [yieldTemperature, setYieldTemperature] = useState('68');

  // Get empty containers for yield storage
  const emptyContainers = useMemo(() => {
      return inventory.filter(c => c.status === 'empty').map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          displayName: `${c.name} (${c.type.replace(/_/g, ' ')})`
      }));
  }, [inventory]);

  // Get filled containers that can be used as storage tanks
  const filledStorageTanks = useMemo(() => {
      return inventory.filter(c => c.status === 'filled' && c.type !== 'still').map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          displayName: `${c.name} (${c.type.replace(/_/g, ' ')}) - ${c.currentFill?.proofGallons?.toFixed(3)} PG`,
          currentFill: c.currentFill
      }));
  }, [inventory]);

  useEffect(() => {
      if (type === 'fermentation') {
          setFormData({
              name: batch?.name || '',
              startDate: batch?.startDate || new Date().toISOString().split('T')[0],
              startVolume: batch?.startVolume || '',
              og: batch?.og || '',
              fg: batch?.fg || '',
              ingredients: batch?.ingredients || '',
              notes: batch?.notes || ''
          });
      } else { // distillation
          setFormData({
              name: batch?.name || '',
              date: batch?.date || new Date().toISOString().split('T')[0],
              sourceBatchId: batch?.sourceBatchId || '',
              chargeProof: batch?.chargeProof || '',
              yieldProof: batch?.yieldProof || '',
              productType: batch?.productType || 'Low Wines',
              notes: batch?.notes || ''
          });
          
          // Set existing values if editing
          if (batch) {
              if (batch.chargeInputMethod) setChargeInputMethod(batch.chargeInputMethod);
              if (batch.yieldInputMethod) setYieldInputMethod(batch.yieldInputMethod);
              if (batch.chargeInputValue) setChargeInputValue(batch.chargeInputValue);
              if (batch.yieldInputValue) setYieldInputValue(batch.yieldInputValue);
              if (batch.selectedContainerId) setSelectedContainerId(batch.selectedContainerId);
              if (batch.selectedStorageTankId) setSelectedStorageTankId(batch.selectedStorageTankId);
              if (batch.storageTankPullAmount) setStorageTankPullAmount(batch.storageTankPullAmount);
              if (batch.storageTankPullMethod) setStorageTankPullMethod(batch.storageTankPullMethod);
          }
      }
  }, [batch, type]);

  // Calculate charge values based on input method
  useEffect(() => {
      const chargeProof = parseFloat(formData.chargeProof) || 0;
      const chargeValue = parseFloat(chargeInputValue) || 0;
      const temp = parseFloat(chargeTemperature) || 68;
      
      if (chargeValue > 0 && chargeProof > 0) {
          let calculated;
          if (chargeInputMethod === 'weight') {
              calculated = calculateDerivedValuesFromWeight(0, chargeValue, chargeProof, temp);
          } else if (chargeInputMethod === 'wineGallons') {
              calculated = calculateDerivedValuesFromWineGallons(chargeValue, chargeProof, 0, temp);
          } else { // proofGallons
              calculated = calculateDerivedValuesFromProofGallons(chargeValue, chargeProof, 0, temp);
          }
          setChargeCalculated(calculated);
      } else {
          setChargeCalculated({ netWeightLbs: 0, wineGallons: 0, proofGallons: 0 });
      }
  }, [chargeInputValue, chargeInputMethod, formData.chargeProof, chargeTemperature]);

  // Calculate storage tank pull amount
  useEffect(() => {
      if (selectedStorageTankId && storageTankPullAmount) {
          const selectedTank = filledStorageTanks.find(t => t.id === selectedStorageTankId);
                          if (selectedTank && selectedTank.currentFill) {
                  const pullAmount = parseFloat(storageTankPullAmount) || 0;
                  const tankProof = selectedTank.currentFill.proof || 0;
                  const temp = parseFloat(chargeTemperature) || 68;
                  
                  if (pullAmount > 0 && tankProof > 0) {
                  let calculated;
                  if (storageTankPullMethod === 'weight') {
                      calculated = calculateDerivedValuesFromWeight(0, pullAmount, tankProof);
                  } else if (storageTankPullMethod === 'wineGallons') {
                      calculated = calculateDerivedValuesFromWineGallons(pullAmount, tankProof, 0);
                  } else { // proofGallons
                      calculated = calculateDerivedValuesFromProofGallons(pullAmount, tankProof, 0);
                  }
                  
                  // Update charge calculations with the pulled amount
                  setChargeCalculated(calculated);
                  setFormData(prev => ({ ...prev, chargeProof: tankProof.toString() }));
              }
          }
      }
  }, [selectedStorageTankId, storageTankPullAmount, storageTankPullMethod, filledStorageTanks]);

  // Calculate yield values based on input method
  useEffect(() => {
      const yieldProof = parseFloat(formData.yieldProof) || 0;
      const yieldValue = parseFloat(yieldInputValue) || 0;
      const temp = parseFloat(yieldTemperature) || 68;
      
      if (yieldValue > 0 && yieldProof > 0) {
          let calculated;
          if (yieldInputMethod === 'weight') {
              calculated = calculateDerivedValuesFromWeight(0, yieldValue, yieldProof, temp);
          } else if (yieldInputMethod === 'wineGallons') {
              calculated = calculateDerivedValuesFromWineGallons(yieldValue, yieldProof, 0, temp);
          } else { // proofGallons
              calculated = calculateDerivedValuesFromProofGallons(yieldValue, yieldProof, 0, temp);
          }
          setYieldCalculated(calculated);
      } else {
          setYieldCalculated({ netWeightLbs: 0, wineGallons: 0, proofGallons: 0 });
      }
  }, [yieldInputValue, yieldInputMethod, formData.yieldProof, yieldTemperature]);

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
      e.preventDefault();
      setFormError('');
      
      // Validate container selection for distillation yield
      if (type === 'distillation' && !isEdit && (!selectedContainerId || selectedContainerId === '')) {
          setFormError('Please select a container to store the distillation yield.');
          return;
      }

      // Validate storage tank pull amount
      if (type === 'distillation' && formData.sourceBatchId === 'storage_tank' && selectedStorageTankId && storageTankPullAmount) {
          const sourceTank = inventory.find(c => c.id === selectedStorageTankId);
          if (sourceTank && sourceTank.status === 'filled' && sourceTank.currentFill) {
              const pullAmount = parseFloat(storageTankPullAmount) || 0;
              const tankProof = sourceTank.currentFill.proof || 0;
              
              if (pullAmount > 0 && tankProof > 0) {
                  let pullCalculated;
                  if (storageTankPullMethod === 'weight') {
                      pullCalculated = calculateDerivedValuesFromWeight(0, pullAmount, tankProof);
                  } else if (storageTankPullMethod === 'wineGallons') {
                      pullCalculated = calculateDerivedValuesFromWineGallons(pullAmount, tankProof, 0);
                  } else { // proofGallons
                      pullCalculated = calculateDerivedValuesFromProofGallons(pullAmount, tankProof, 0);
                  }

                  // Check if pull amount exceeds available amount
                  if (pullCalculated.proofGallons > sourceTank.currentFill.proofGallons + 0.001) {
                      setFormError(`Cannot pull ${pullCalculated.proofGallons.toFixed(3)} PG from tank that only has ${sourceTank.currentFill.proofGallons.toFixed(3)} PG.`);
                      return;
                  }
              }
          }
      }
      
      const dataToSave = { 
          ...formData, 
          batchType: type,
          // Add new fields for distillation
          ...(type === 'distillation' && {
              chargeInputMethod,
              chargeInputValue,
              yieldInputMethod,
              yieldInputValue,
              selectedContainerId,
              selectedStorageTankId,
              storageTankPullAmount,
              storageTankPullMethod,
              chargeTemperature,
              yieldTemperature,
              chargeCalculated,
              yieldCalculated
          })
      };
      
      try {
          const batchRef = writeBatch(db);
          const productionPath = `artifacts/${appId}/users/${userId}/productionBatches`;
          let docRef;

          if (isEdit) {
              docRef = doc(db, productionPath, batch.id);
              batchRef.update(docRef, dataToSave);
          } else {
              docRef = doc(collection(db, productionPath));
              batchRef.set(docRef, dataToSave);
          }
          
          // Handle distillation yield storage and logging
          if (type === 'distillation' && yieldCalculated.proofGallons > 0) {
              const pg = yieldCalculated.proofGallons;
              const logData = {
                  type: "DISTILLATION_FINISH",
                  batchId: docRef.id,
                  batchName: dataToSave.name,
                  productType: dataToSave.productType,
                  proof: parseFloat(dataToSave.yieldProof),
                  proofGallonsChange: pg,
                  notes: `Produced ${pg.toFixed(3)} PG of ${dataToSave.productType}.`
              };
              const logCollRef = collection(db, `artifacts/${appId}/users/${userId}/transactionLog`);
              batchRef.set(doc(logCollRef), {...logData, timestamp: serverTimestamp()});
              
              // Update selected container if not editing
              if (!isEdit && selectedContainerId) {
                  const selectedContainer = inventory.find(c => c.id === selectedContainerId);
                  if (selectedContainer && selectedContainer.status === 'empty') {
                      const containerRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, selectedContainerId);
                      const containerUpdate = {
                          status: 'filled',
                          currentFill: {
                              productType: dataToSave.productType,
                              fillDate: dataToSave.date,
                              proof: parseFloat(dataToSave.yieldProof),
                              netWeightLbs: yieldCalculated.netWeightLbs,
                              wineGallons: yieldCalculated.wineGallons,
                              proofGallons: yieldCalculated.proofGallons,
                              grossWeightLbs: yieldCalculated.grossWeightLbs,
                              spiritDensity: yieldCalculated.spiritDensity,
                              account: 'storage',
                              emptiedDate: null
                          }
                      };
                      batchRef.update(containerRef, containerUpdate);
                      
                      // Log container fill
                      const containerLogData = {
                          type: "CREATE_FILLED_CONTAINER",
                          containerId: selectedContainerId,
                          containerName: selectedContainer.name,
                          productType: dataToSave.productType,
                          proof: parseFloat(dataToSave.yieldProof),
                          netWeightLbsChange: yieldCalculated.netWeightLbs,
                          proofGallonsChange: yieldCalculated.proofGallons,
                          notes: `Filled with ${yieldCalculated.proofGallons.toFixed(3)} PG from distillation batch ${dataToSave.name}.`
                      };
                      batchRef.set(doc(logCollRef), {...containerLogData, timestamp: serverTimestamp()});
                  }
              }
          }

          // Handle storage tank pull for distillation charge
          if (type === 'distillation' && !isEdit && selectedStorageTankId && storageTankPullAmount) {
              const sourceTank = inventory.find(c => c.id === selectedStorageTankId);
              if (sourceTank && sourceTank.status === 'filled' && sourceTank.currentFill) {
                  const pullAmount = parseFloat(storageTankPullAmount) || 0;
                  const tankProof = sourceTank.currentFill.proof || 0;
                  const temp = parseFloat(chargeTemperature) || 68;
                  
                  if (pullAmount > 0 && tankProof > 0) {
                      let pullCalculated;
                      if (storageTankPullMethod === 'weight') {
                          pullCalculated = calculateDerivedValuesFromWeight(0, pullAmount, tankProof, temp);
                      } else if (storageTankPullMethod === 'wineGallons') {
                          pullCalculated = calculateDerivedValuesFromWineGallons(pullAmount, tankProof, 0, temp);
                      } else { // proofGallons
                          pullCalculated = calculateDerivedValuesFromProofGallons(pullAmount, tankProof, 0, temp);
                      }

                      // Calculate remaining amounts in source tank
                      const remainingNetWeight = Math.max(0, sourceTank.currentFill.netWeightLbs - pullCalculated.netWeightLbs);
                      const remainingWineGallons = Math.max(0, sourceTank.currentFill.wineGallons - pullCalculated.wineGallons);
                      const remainingProofGallons = Math.max(0, sourceTank.currentFill.proofGallons - pullCalculated.proofGallons);
                      const remainingGrossWeight = sourceTank.tareWeightLbs + remainingNetWeight;

                      // Update source tank
                      const sourceTankRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, selectedStorageTankId);
                      const sourceTankUpdate = {
                          currentFill: {
                              ...sourceTank.currentFill,
                              netWeightLbs: remainingNetWeight,
                              wineGallons: remainingWineGallons,
                              proofGallons: remainingProofGallons,
                              grossWeightLbs: remainingGrossWeight,
                              spiritDensity: pullCalculated.spiritDensity
                          },
                          status: remainingProofGallons > 0.001 ? 'filled' : 'empty'
                      };
                      batchRef.update(sourceTankRef, sourceTankUpdate);

                      // Log storage tank pull
                      const logCollRef = collection(db, `artifacts/${appId}/users/${userId}/transactionLog`);
                      const pullLogData = {
                          type: "TRANSFER_OUT",
                          containerId: selectedStorageTankId,
                          containerName: sourceTank.name,
                          productType: sourceTank.currentFill.productType,
                          proof: tankProof,
                          netWeightLbsChange: -pullCalculated.netWeightLbs,
                          proofGallonsChange: -pullCalculated.proofGallons,
                          notes: `Pulled ${pullCalculated.proofGallons.toFixed(3)} PG for distillation batch ${dataToSave.name}.`
                      };
                      batchRef.set(doc(logCollRef), {...pullLogData, timestamp: serverTimestamp()});
                  }
              }
          }

          await batchRef.commit();
          setErrorApp('');
          onClose();

      } catch (err) {
          console.error("Save production error:", err);
          setFormError("Save failed: " + err.message);
          setErrorApp("Save failed.");
      }
  };

  const title = `${isEdit ? 'Edit' : 'New'} ${type.charAt(0).toUpperCase() + type.slice(1)}`;

  return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl mb-6 text-blue-300">{title}</h2>
              {formError && <div className="bg-red-600 p-3 rounded mb-4 text-sm">{formError}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                  <input name="name" value={formData.name || ''} onChange={handleChange} placeholder="Batch Name/ID" required className="w-full bg-gray-700 p-2 rounded"/>
                  {type === 'fermentation' ? (
                      <>
                          <input name="startDate" type="date" value={formData.startDate || ''} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded"/>
                          <input name="startVolume" type="number" value={formData.startVolume || ''} onChange={handleChange} placeholder="Starting Volume (gal)" className="w-full bg-gray-700 p-2 rounded"/>
                          <div className="grid grid-cols-2 gap-4">
                              <input name="og" type="number" step="0.001" value={formData.og || ''} onChange={handleChange} placeholder="Original Gravity" className="w-full bg-gray-700 p-2 rounded"/>
                              <input name="fg" type="number" step="0.001" value={formData.fg || ''} onChange={handleChange} placeholder="Final Gravity" className="w-full bg-gray-700 p-2 rounded"/>
                          </div>
                          <textarea name="ingredients" value={formData.ingredients || ''} onChange={handleChange} placeholder="Ingredients..." rows="3" className="w-full bg-gray-700 p-2 rounded"/>
                      </>
                  ) : (
                      <>
                          <input name="date" type="date" value={formData.date || ''} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded"/>
                          <select name="sourceBatchId" value={formData.sourceBatchId || ''} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded">
                              <option value="">-- Select Source Fermentation --</option>
                              {fermentations.map(f => <option key={f.id} value={f.id}>{f.name} ({f.startDate})</option>)}
                              <option value="storage_tank">Use Storage Tank</option>
                          </select>
                          
                          {/* Storage Tank Selection */}
                          {formData.sourceBatchId === 'storage_tank' && (
                              <div className="border border-gray-600 rounded p-4 bg-gray-750">
                                  <h3 className="text-lg font-semibold text-blue-300 mb-3">Pull from Storage Tank</h3>
                                  <div className="grid grid-cols-2 gap-4 mb-3">
                                      <div>
                                          <label className="block text-sm font-medium text-gray-300 mb-1">Select Tank</label>
                                          <select 
                                              value={selectedStorageTankId} 
                                              onChange={(e) => setSelectedStorageTankId(e.target.value)}
                                              className="w-full bg-gray-700 p-2 rounded"
                                          >
                                              <option value="">-- Select Filled Container --</option>
                                              {filledStorageTanks.map(t => (
                                                  <option key={t.id} value={t.id}>{t.displayName}</option>
                                              ))}
                                          </select>
                                      </div>
                                      <div>
                                          <label className="block text-sm font-medium text-gray-300 mb-1">Pull Method</label>
                                          <select 
                                              value={storageTankPullMethod} 
                                              onChange={(e) => setStorageTankPullMethod(e.target.value)}
                                              className="w-full bg-gray-700 p-2 rounded"
                                          >
                                              <option value="weight">Weight (lbs)</option>
                                              <option value="wineGallons">Wine Gallons</option>
                                              <option value="proofGallons">Proof Gallons</option>
                                          </select>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <label className="block text-sm font-medium text-gray-300 mb-1">
                                              {storageTankPullMethod === 'weight' ? 'Weight (lbs)' : 
                                               storageTankPullMethod === 'wineGallons' ? 'Wine Gallons' : 'Proof Gallons'}
                                          </label>
                                          <input 
                                              type="number" 
                                              step="0.001"
                                              value={storageTankPullAmount} 
                                              onChange={(e) => setStorageTankPullAmount(e.target.value)} 
                                              placeholder={`Enter ${storageTankPullMethod === 'weight' ? 'weight' : 
                                                           storageTankPullMethod === 'wineGallons' ? 'wine gallons' : 'proof gallons'} to pull`}
                                              className="w-full bg-gray-700 p-2 rounded"
                                          />
                                      </div>
                                      <div className="flex flex-col justify-end">
                                          <div className="text-sm text-gray-400">
                                              <div>Net Weight: {chargeCalculated.netWeightLbs.toFixed(2)} lbs</div>
                                              <div>Wine Gallons: {chargeCalculated.wineGallons.toFixed(3)} gal</div>
                                              <div>Proof Gallons: {chargeCalculated.proofGallons.toFixed(3)} PG</div>
                                          </div>
                                      </div>
                                  </div>
                              </div>
                          )}
                          
                          {/* Distillation Charge Section */}
                          <div className="border border-gray-600 rounded p-4 bg-gray-750">
                              <h3 className="text-lg font-semibold text-blue-300 mb-3">Distillation Charge</h3>
                              <div className="grid grid-cols-3 gap-4 mb-3">
                                  <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">Input Method</label>
                                      <select 
                                          value={chargeInputMethod} 
                                          onChange={(e) => setChargeInputMethod(e.target.value)}
                                          className="w-full bg-gray-700 p-2 rounded"
                                      >
                                          <option value="weight">Weight (lbs)</option>
                                          <option value="wineGallons">Wine Gallons</option>
                                          <option value="proofGallons">Proof Gallons</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">Proof</label>
                                      <input 
                                          name="chargeProof" 
                                          type="number" 
                                          step="0.1" 
                                          value={formData.chargeProof || ''} 
                                          onChange={handleChange} 
                                          placeholder="Charge Proof" 
                                          className="w-full bg-gray-700 p-2 rounded"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">Temperature (°F)</label>
                                      <input 
                                          type="number" 
                                          step="1"
                                          value={chargeTemperature} 
                                          onChange={(e) => setChargeTemperature(e.target.value)} 
                                          placeholder="68" 
                                          className="w-full bg-gray-700 p-2 rounded"
                                      />
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 mb-3">
                                  <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">
                                          {chargeInputMethod === 'weight' ? 'Weight (lbs)' : 
                                           chargeInputMethod === 'wineGallons' ? 'Wine Gallons' : 'Proof Gallons'}
                                      </label>
                                      <input 
                                          type="number" 
                                          step="0.001"
                                          value={chargeInputValue} 
                                          onChange={(e) => setChargeInputValue(e.target.value)} 
                                          placeholder={`Enter ${chargeInputMethod === 'weight' ? 'weight' : 
                                                       chargeInputMethod === 'wineGallons' ? 'wine gallons' : 'proof gallons'}`}
                                          className="w-full bg-gray-700 p-2 rounded"
                                      />
                                  </div>
                                  <div className="flex flex-col justify-end">
                                      <div className="text-sm text-gray-400">
                                          <div>Net Weight: {chargeCalculated.netWeightLbs.toFixed(2)} lbs</div>
                                          <div>Wine Gallons: {chargeCalculated.wineGallons.toFixed(3)} gal</div>
                                          <div>Proof Gallons: {chargeCalculated.proofGallons.toFixed(3)} PG</div>
                                      </div>
                                  </div>
                              </div>
                          </div>

                          {/* Distillation Yield Section */}
                          <div className="border border-gray-600 rounded p-4 bg-gray-750">
                              <h3 className="text-lg font-semibold text-blue-300 mb-3">Distillation Yield</h3>
                              <div className="grid grid-cols-3 gap-4 mb-3">
                                  <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">Input Method</label>
                                      <select 
                                          value={yieldInputMethod} 
                                          onChange={(e) => setYieldInputMethod(e.target.value)}
                                          className="w-full bg-gray-700 p-2 rounded"
                                      >
                                          <option value="weight">Weight (lbs)</option>
                                          <option value="wineGallons">Wine Gallons</option>
                                          <option value="proofGallons">Proof Gallons</option>
                                      </select>
                                  </div>
                                  <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">Proof</label>
                                      <input 
                                          name="yieldProof" 
                                          type="number" 
                                          step="0.1" 
                                          value={formData.yieldProof || ''} 
                                          onChange={handleChange} 
                                          placeholder="Yield Proof" 
                                          className="w-full bg-gray-700 p-2 rounded"
                                      />
                                  </div>
                                  <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">Temperature (°F)</label>
                                      <input 
                                          type="number" 
                                          step="1"
                                          value={yieldTemperature} 
                                          onChange={(e) => setYieldTemperature(e.target.value)} 
                                          placeholder="68" 
                                          className="w-full bg-gray-700 p-2 rounded"
                                      />
                                  </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4 mb-3">
                                  <div>
                                      <label className="block text-sm font-medium text-gray-300 mb-1">
                                          {yieldInputMethod === 'weight' ? 'Weight (lbs)' : 
                                           yieldInputMethod === 'wineGallons' ? 'Wine Gallons' : 'Proof Gallons'}
                                      </label>
                                      <input 
                                          type="number" 
                                          step="0.001"
                                          value={yieldInputValue} 
                                          onChange={(e) => setYieldInputValue(e.target.value)} 
                                          placeholder={`Enter ${yieldInputMethod === 'weight' ? 'weight' : 
                                                       yieldInputMethod === 'wineGallons' ? 'wine gallons' : 'proof gallons'}`}
                                          className="w-full bg-gray-700 p-2 rounded"
                                      />
                                  </div>
                                  <div className="flex flex-col justify-end">
                                      <div className="text-sm text-gray-400">
                                          <div>Net Weight: {yieldCalculated.netWeightLbs.toFixed(2)} lbs</div>
                                          <div>Wine Gallons: {yieldCalculated.wineGallons.toFixed(3)} gal</div>
                                          <div>Proof Gallons: {yieldCalculated.proofGallons.toFixed(3)} PG</div>
                                      </div>
                                  </div>
                              </div>
                              
                              {/* Container Selection for Yield Storage */}
                              {!isEdit && (
                                  <div className="mt-4">
                                      <label className="block text-sm font-medium text-gray-300 mb-2">Store Yield In Container</label>
                                      <select 
                                          value={selectedContainerId} 
                                          onChange={(e) => setSelectedContainerId(e.target.value)}
                                          className="w-full bg-gray-700 p-2 rounded"
                                          required
                                      >
                                          <option value="">-- Select Empty Container --</option>
                                          {emptyContainers.map(c => (
                                              <option key={c.id} value={c.id}>{c.displayName}</option>
                                          ))}
                                      </select>
                                      {emptyContainers.length === 0 && (
                                          <p className="text-yellow-400 text-sm mt-1">No empty containers available. Please create an empty container first.</p>
                                      )}
                                  </div>
                              )}
                          </div>

                          <select name="productType" value={formData.productType || ''} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded">
                              {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                          </select>
                      </>
                  )}
                  <textarea name="notes" value={formData.notes || ''} onChange={handleChange} placeholder="Notes..." rows="2" className="w-full bg-gray-700 p-2 rounded"/>
                  <div className="flex justify-end space-x-3 pt-2">
                      <button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">Cancel</button>
                      <button type="submit" className="bg-blue-600 py-2 px-4 rounded">Save Batch</button>
                  </div>
              </form>
          </div>
      </div>
  );
};