import { useState } from "react";
import { doc, collection, writeBatch } from "firebase/firestore";
import { calculateDerivedValuesFromWeight, calculateDerivedValuesFromWineGallons, calculateDerivedValuesFromProofGallons, logTransaction } from "../../utils/helpers";
import { CONTAINER_CAPACITIES_GALLONS } from "../../constants";

// --- ImportContainersModal (HEAVILY REVISED) ---
export const ImportContainersModal = ({ db, userId, appId, existingContainers, products, onClose, setErrorApp }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [error, setLocalError] = useState('');

  const handleFileChange = (e) => {
      const selectedFile = e.target.files[0];
      if (selectedFile && (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv'))) {
          setFile(selectedFile);
          setLocalError('');
          parseCSV(selectedFile);
      } else {
          setLocalError('Please select a valid .csv file.');
          setFile(null);
          setParsedData([]);
      }
  };
  
  const parseCSV = (csvFile) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          const text = e.target.result;
          const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim() !== '');
          if (lines.length < 2) { setLocalError('CSV must have a header and at least one data row.'); return; }
          const parseLine = (line) => { const regex = /(".*?"|[^",]+)(?=\s*,|\s*$)/g; const values = []; let match; while ((match = regex.exec(line)) !== null) { let value = match[1].trim(); if (value.startsWith('"') && value.endsWith('"')) { value = value.slice(1, -1).replace(/""/g, '"'); } values.push(value); } return values; };
          const headerLine = lines[0].toLowerCase();
          const headers = parseLine(headerLine);
          
          const requiredHeaders = ['container name', 'type', 'tare'];
          if (!requiredHeaders.every(h => headers.includes(h))) { setLocalError(`CSV header must contain: ${requiredHeaders.join(', ')}.`); return; }
          
          const data = lines.slice(1).map((line, index) => {
              if (line.trim() === '') return null;
              const values = parseLine(line);
              const rowData = {};
              headers.forEach((h, i) => { rowData[h.replace(/\s+/g, '_')] = values[i] || ''; });

              let errors = [];
              const name = rowData.container_name || '';
              const typeRaw = rowData.type?.trim().toLowerCase() || '';
              const type = typeRaw.replace(/\s+/g, '_');
              const tare = parseFloat(rowData.tare);
              const status = rowData.status?.toLowerCase() || 'empty';

              if (!name) errors.push('Name missing.');
              else if (existingContainers.some(c => c.name.toLowerCase() === name.toLowerCase())) errors.push('Name exists.');
              if (!type) errors.push('Type missing.');
              else if (!Object.keys(CONTAINER_CAPACITIES_GALLONS).includes(type)) errors.push(`Invalid type: "${typeRaw}".`);
              if (isNaN(tare) || tare <= 0) errors.push('Invalid tare.');
              
              let containerData = { name, type, tareWeightLbs: tare, status, errors, raw: rowData };

              if (status === 'filled') {
                  const productType = rowData.product_type || '';
                  const fillDate = rowData.fill_date || '';
                  const proof = parseFloat(rowData.proof);
                  const gross = parseFloat(rowData.gross);
                  const net = parseFloat(rowData.net);
                  const wg = parseFloat(rowData.wine_gallons);
                  const pg = parseFloat(rowData.proof_gallons);

                  if (!productType || !products.some(p => p.name === productType)) errors.push('Invalid Product Type.');
                  if (!fillDate || isNaN(new Date(fillDate))) errors.push('Invalid Fill Date.');
                  if (isNaN(proof) || proof < 0 || proof > 200) errors.push('Invalid Proof.');

                  let calcs;
                  if (!isNaN(gross) && gross > tare) calcs = calculateDerivedValuesFromWeight(tare, gross, proof);
                  else if (!isNaN(net) && net > 0) calcs = calculateDerivedValuesFromWeight(tare, tare + net, proof);
                  else if (!isNaN(wg) && wg > 0) calcs = calculateDerivedValuesFromWineGallons(wg, proof, tare);
                  else if (!isNaN(pg) && pg > 0) calcs = calculateDerivedValuesFromProofGallons(pg, proof, tare);
                  else { errors.push('No valid fill data (gross, net, wg, or pg).'); calcs = calculateDerivedValuesFromWeight(tare, tare, 0); }
                  
                  containerData.currentFill = { productType, fillDate, proof, ...calcs };
              } else {
                  containerData.currentFill = { ...calculateDerivedValuesFromWeight(tare, tare, 0), emptiedDate: rowData.empty_date || new Date().toISOString().split('T')[0] };
              }
              
              return containerData;
          }).filter(Boolean);
          setParsedData(data);
      };
      reader.readAsText(csvFile);
  };

  const handleImport = async () => {
      const validData = parsedData.filter(row => row.errors.length === 0);
      if (validData.length === 0) { setLocalError('No valid containers to import.'); return; }

      const batch = writeBatch(db);
      const inventoryPath = `artifacts/${appId}/users/${userId}/spiritInventory`;
      validData.forEach(item => {
          const docRef = doc(collection(db, inventoryPath));
          const { errors, raw, ...dataToSave } = item;
          batch.set(docRef, dataToSave);
      });
      
      logTransaction(db, userId, appId, { type: "CREATE_BULK_CONTAINERS", notes: `Imported ${validData.length} containers via CSV.` });

      try { await batch.commit(); setErrorApp(''); onClose(); }
      catch(err) { console.error("Import error:", err); setLocalError("Import failed: " + err.message); setErrorApp("Import failed."); }
  };

  const validRows = parsedData.filter(d => d.errors.length === 0).length;
  const invalidRows = parsedData.length - validRows;

  return(
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
               <h2 className="text-2xl mb-4 font-semibold text-blue-300">Import Containers from CSV</h2>
               {error && <div className="bg-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
               <div className="space-y-4">
                  <p className="text-sm text-gray-400">CSV must include headers: <strong>container name, type, tare</strong>. Optional headers for filled containers: <strong>status, product type, proof, fill date, gross, net, wine gallons, proof gallons, empty date</strong>.</p>
                  <input type="file" accept=".csv" onChange={handleFileChange} className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"/>
                  
                  {parsedData.length > 0 && (
                      <div className="border-t border-gray-700 pt-4">
                          <h3 className="text-lg font-semibold mb-2">{validRows} valid rows, {invalidRows} errors</h3>
                          <div className="max-h-64 overflow-y-auto bg-gray-900 p-2 rounded">
                              <table className="w-full text-xs text-left">
                                  <thead className="sticky top-0 bg-gray-900"><tr>{['Name', 'Status', 'Product', 'PG', 'Errors'].map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead>
                                  <tbody>
                                      {parsedData.map((row, i) => (
                                          <tr key={i} className={row.errors.length > 0 ? "bg-red-900/50" : "bg-gray-800"}>
                                              <td className="p-2">{row.name}</td>
                                              <td className="p-2">{row.status}</td>
                                              <td className="p-2">{row.currentFill?.productType || 'N/A'}</td>
                                              <td className="p-2">{row.currentFill?.proofGallons?.toFixed(2) || 'N/A'}</td>
                                              <td className="p-2 text-red-400" title={row.errors.join(', ')}>{row.errors.join(', ')}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  )}
               </div>
              <div className="flex justify-end space-x-3 pt-4 mt-auto">
                  <button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">Cancel</button>
                  <button onClick={handleImport} disabled={validRows === 0} className="bg-blue-600 py-2 px-4 rounded disabled:bg-gray-500 disabled:cursor-not-allowed">Import {validRows} Containers</button>
              </div>
          </div>
      </div>
  );
};