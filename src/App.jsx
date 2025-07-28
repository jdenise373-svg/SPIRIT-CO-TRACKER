import React, { useState, useEffect, useMemo } from 'react';
import { auth as firebaseAuth, db as firebaseDB } from './Firebase'; // adjust path if needed
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,signOut} from 'firebase/auth';
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  query, onSnapshot, writeBatch, getDocs, serverTimestamp
} from 'firebase/firestore';


// --- Constants ---
const DENSITY_ETHANOL_LBS_PER_GALLON = 6.61;
const DENSITY_WATER_LBS_PER_GALLON = 8.328;
const ML_PER_GALLON = 3785.41;
const APP_NAME = "Foggy Mountain Spirit Inventory";
const DEFAULT_PRODUCTS = [
    { name: "Salted Caramel Whiskey", description: "A delightful blend of sweet caramel and a hint of sea salt, perfectly balanced with smooth whiskey notes." },
    { name: "Bonfire Cinnamon Whiskey", description: "Ignite your senses with the warm, spicy kick of cinnamon in this bold and inviting whiskey." },
    { name: "Peach Whiskey", description: "Juicy, ripe peach flavors infused into classic whiskey for a refreshing and sweet experience." },
    { name: "Peanut Butter Whiskey", description: "A surprisingly delicious combination of creamy peanut butter and rich whiskey – a truly unique treat." },
    { name: "Coffee Whiskey", description: "The perfect pick-me-up, blending robust coffee aromas with the comforting warmth of whiskey." },
    { name: "Kettle Corn Whiskey", description: "Sweet, salty, and buttery notes reminiscent of your favorite fairground snack, in a spirited form." },
    { name: "Blackberry Whiskey", description: "Dark, luscious blackberry essence meets smooth whiskey for a sophisticated and fruity delight." },
    { name: "Latitude 45 Vodka", description: "Clean, crisp, and exceptionally smooth vodka, perfect for sipping chilled or as the base of your favorite cocktail." },
    { name: "Latitude 45 Rum", description: "A versatile rum with hints of tropical sweetness, ideal for classic rum cocktails or enjoying on its own." },
    { name: "Latitude 45 Gin", description: "Aromatic and botanical-rich gin, offering a complex yet refreshing profile for the discerning gin lover." },
    { name: "Northern Xposure", description: "An adventurous spirit that captures the essence of the north, with a bold and invigorating character." },
    { name: "Unspecified Spirit", description: "A spirit of undefined character, awaiting its unique identity." },
    { name: "Mash", description: "The foundational blend of grains and water, the starting point of our finest spirits." },
    { name: "Low Wines", description: "The initial product of distillation, a crucial intermediate step towards refined spirits." }
];
const CONTAINER_CAPACITIES_GALLONS = {
    wooden_barrel: 53,
    metal_drum: 55,
    square_tank: 275,
    tote: 250,
    five_gallon_tote: 5,
    still: 100,
    fermenter: 500, // Added for production tracking
};
const BOTTLE_SIZES_ML = [
    { name: '750 mL (Standard)', value: 750 },
    { name: '375 mL (Half)', value: 375 },
    { name: '1.75 L (Handle)', value: 1750 },
    { name: '1.0 L (Liter)', value: 1000 },
    { name: '50 mL (Mini)', value: 50 },
];
const LIQUID_FILL_COLOR = "rgba(96, 165, 250, 0.8)";
const COPPER_COLOR_LIGHT = "#DA8A67";
const COPPER_COLOR_DARK = "#B87333";
const STEEL_COLOR_LIGHT = "#D3D3D3";
const STEEL_COLOR_DARK = "#A9A9A9";





// --- SVG Icons ---
const WoodenBarrelIcon = ({ fillSvgHeight = 0 }) => (
    <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
        <defs>
            <radialGradient id="barrelBodyGradient" cx="50%" cy="50%" r="70%" fx="30%" fy="30%">
                <stop offset="0%" style={{stopColor: "#B8860B", stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: "#8B4513", stopOpacity: 1}} />
            </radialGradient>
            <linearGradient id="hoopGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: "#C0C0C0", stopOpacity: 1}} />
                <stop offset="50%" style={{stopColor: "#A9A9A9", stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: "#808080", stopOpacity: 1}} />
            </linearGradient>
            <clipPath id="barrelClip">
                <ellipse cx="50" cy="60" rx="45" ry="58"/>
            </clipPath>
        </defs>
        <ellipse cx="50" cy="60" rx="45" ry="58" fill="url(#barrelBodyGradient)"/>
        {fillSvgHeight > 0 && <rect x="5" y={118 - fillSvgHeight - (58 - (Math.sqrt(1-(0/45)**2))*58) } width="90" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#barrelClip)"/>}
        {[15, 25, 35, 45, 55, 65, 75, 85].map(xPos => (<path key={xPos} d={`M ${xPos} 15 Q ${xPos} 60 ${xPos} 105`} stroke="rgba(0,0,0,0.1)" strokeWidth="1" fill="none"/>))}
        <ellipse cx="50" cy="22" rx="42" ry="10" fill="url(#hoopGradient)" stroke="#543517" strokeWidth="1"/>
        <ellipse cx="50" cy="42" rx="45" ry="9" fill="url(#hoopGradient)" stroke="#543517" strokeWidth="1"/>
        <ellipse cx="50" cy="78" rx="45" ry="9" fill="url(#hoopGradient)" stroke="#543517" strokeWidth="1"/>
        <ellipse cx="50" cy="98" rx="42" ry="10" fill="url(#hoopGradient)" stroke="#543517" strokeWidth="1"/>
        <ellipse cx="50" cy="12" rx="40" ry="8" fill="#A0522D" stroke="#543517" strokeWidth="1.5"/>
        <ellipse cx="50" cy="108" rx="40" ry="8" fill="#8B4513" stroke="#543517" strokeWidth="1.5"/>
        <circle cx="50" cy="30" r="3" fill="#4A2E10"/>
    </svg>
);
const MetalDrumIcon = ({ fillSvgHeight = 0 }) => (
    <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
        <defs><linearGradient id="drumBodyGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style={{stopColor: STEEL_COLOR_LIGHT}} /><stop offset="20%" style={{stopColor: STEEL_COLOR_DARK}} /><stop offset="50%" style={{stopColor: STEEL_COLOR_LIGHT}} /><stop offset="80%" style={{stopColor: STEEL_COLOR_DARK}} /><stop offset="100%" style={{stopColor: STEEL_COLOR_LIGHT}} /></linearGradient><clipPath id="drumClip"><rect x="10" y="10" width="80" height="100" rx="8" ry="8"/></clipPath></defs>
        <rect x="10" y="10" width="80" height="100" rx="8" ry="8" fill="url(#drumBodyGradient)"/>
        {fillSvgHeight > 0 && <rect x="10" y={110 - fillSvgHeight} width="80" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#drumClip)" rx="8" ry="8"/>}
        <rect x="8" y="30" width="84" height="8" rx="4" fill={STEEL_COLOR_DARK} stroke="#707070" strokeWidth="0.5"/>
        <rect x="8" y="55" width="84" height="8" rx="4" fill={STEEL_COLOR_DARK} stroke="#707070" strokeWidth="0.5"/>
        <rect x="8" y="80" width="84" height="8" rx="4" fill={STEEL_COLOR_DARK} stroke="#707070" strokeWidth="0.5"/>
        <ellipse cx="50" cy="11" rx="42" ry="6" fill={STEEL_COLOR_LIGHT} stroke="#707070" strokeWidth="1"/>
        <ellipse cx="50" cy="109" rx="42" ry="6" fill={STEEL_COLOR_DARK} stroke="#707070" strokeWidth="1"/>
        <circle cx="35" cy="11" r="5" fill="#777777"/><circle cx="35" cy="10.5" r="4.5" fill="#888888"/>
        <circle cx="65" cy="11" r="5" fill="#777777"/><circle cx="65" cy="10.5" r="4.5" fill="#888888"/>
    </svg>
);
const SquareTankIcon = ({ fillSvgHeight = 0 }) => (
    <svg viewBox="0 0 120 120" className="w-20 h-20 inline-block">
        <defs><linearGradient id="cageGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={STEEL_COLOR_LIGHT} /><stop offset="100%" stopColor={STEEL_COLOR_DARK} /></linearGradient><clipPath id="tankClip"><rect x="15" y="15" width="90" height="90" rx="3"/></clipPath></defs>
        <rect x="5" y="5" width="110" height="110" fill="none" stroke="url(#cageGradient)" strokeWidth="5" rx="5"/>
        {[35, 65, 95].map(pos => <line key={`h-${pos}`} x1="5" y1={pos} x2="115" y2={pos} stroke="url(#cageGradient)" strokeWidth="4"/>)}
        {[35, 65, 95].map(pos => <line key={`v-${pos}`} x1={pos} y1="5" x2={pos} y2="115" stroke="url(#cageGradient)" strokeWidth="4"/>)}
        <rect x="15" y="15" width="90" height="90" fill="rgba(220, 230, 240, 0.85)" rx="3"/>
        {fillSvgHeight > 0 && <rect x="15" y={105 - fillSvgHeight} width="90" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#tankClip)" rx="3"/>}
        <circle cx="60" cy="20" r="12" fill="#606060"/><circle cx="60" cy="19.5" r="10" fill="#787878"/>
        <rect x="50" y="102" width="20" height="15" fill="#606060" rx="2"/><rect x="52" y="107" width="16" height="5" fill="#787878" rx="1"/>
    </svg>
);
const ToteIcon = ({ fillSvgHeight = 0 }) => (
    <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
         <defs><linearGradient id="toteCageGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor={STEEL_COLOR_LIGHT} /><stop offset="100%" stopColor={STEEL_COLOR_DARK} /></linearGradient><clipPath id="toteClip"><rect x="10" y="10" width="80" height="100" rx="3"/></clipPath></defs>
        <rect x="5" y="5" width="90" height="110" fill="none" stroke="url(#toteCageGradient)" strokeWidth="3.5" rx="5"/>
        <line x1="5" y1="30" x2="95" y2="30" stroke="url(#toteCageGradient)" strokeWidth="3"/><line x1="5" y1="60" x2="95" y2="60" stroke="url(#toteCageGradient)" strokeWidth="3"/><line x1="5" y1="90" x2="95" y2="90" stroke="url(#toteCageGradient)" strokeWidth="3"/>
        <line x1="30" y1="5" x2="30" y2="115" stroke="url(#toteCageGradient)" strokeWidth="3"/><line x1="70" y1="5" x2="70" y2="115" stroke="url(#toteCageGradient)" strokeWidth="3"/>
        <rect x="10" y="10" width="80" height="100" fill="rgba(230, 230, 250, 0.9)" rx="3"/>
        {fillSvgHeight > 0 && <rect x="10" y={110 - fillSvgHeight} width="80" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#toteClip)" rx="3"/>}
        <circle cx="50" cy="15" r="10" fill="#505050"/><circle cx="50" cy="14.5" r="8" fill="#686868"/>
        <rect x="42" y="108" width="16" height="10" fill="#505050" rx="1.5"/>
    </svg>
);
const FiveGallonToteIcon = ({ fillSvgHeight = 0 }) => (
    <svg viewBox="0 0 60 80" className="w-10 h-14 inline-block">
        <defs>
            <linearGradient id="smallToteBodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{stopColor: "rgba(200, 210, 220, 0.9)"}} />
                <stop offset="50%" style={{stopColor: "rgba(220, 230, 240, 0.9)"}} />
                <stop offset="100%" style={{stopColor: "rgba(200, 210, 220, 0.9)"}} />
            </linearGradient>
            <clipPath id="smallToteClipUnique">
                <rect x="5" y="10" width="50" height="65" rx="2"/>
            </clipPath>
        </defs>
        <rect x="5" y="10" width="50" height="65" rx="2" fill="url(#smallToteBodyGradient)" stroke="#777" strokeWidth="1.5"/>
        {fillSvgHeight > 0 && <rect x="5" y={75 - fillSvgHeight} width="50" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#smallToteClipUnique)" rx="2"/>}
        <rect x="22" y="3" width="16" height="7" rx="1" fill="#585858" />
        <path d="M 18 10 Q 30 5 42 10" stroke="#606060" strokeWidth="1.5" fill="none" />
    </svg>
);

const StillIcon = ({ fillSvgHeight = 0 }) => (
    <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
        <defs>
            <linearGradient id="copperPotGradientStill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style={{stopColor: COPPER_COLOR_LIGHT, stopOpacity:1}} />
                <stop offset="100%" style={{stopColor: COPPER_COLOR_DARK, stopOpacity:1}} />
            </linearGradient>
            <linearGradient id="copperPipeGradientStill" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style={{stopColor: COPPER_COLOR_DARK, stopOpacity:1}} />
                <stop offset="50%" style={{stopColor: COPPER_COLOR_LIGHT, stopOpacity:1}} />
                <stop offset="100%" style={{stopColor: COPPER_COLOR_DARK, stopOpacity:1}} />
            </linearGradient>
            <clipPath id="stillPotClip">
                <ellipse cx="50" cy="85" rx="40" ry="30"/>
            </clipPath>
        </defs>
        <ellipse cx="50" cy="85" rx="40" ry="30" fill="url(#copperPotGradientStill)" stroke={COPPER_COLOR_DARK} strokeWidth="1.5"/>
        {fillSvgHeight > 0 && <rect x="10" y={115 - fillSvgHeight} width="80" height={fillSvgHeight} fill={LIQUID_FILL_COLOR} clipPath="url(#stillPotClip)"/>}
        <path d="M50,55 C 30,55 20,40 20,25 C 20,10 35,0 50,0 C 65,0 80,10 80,25 C 80,40 70,55 50,55 Z" fill="url(#copperPotGradientStill)" stroke={COPPER_COLOR_DARK} strokeWidth="1.5"/>
        <path d="M80,25 C 90,25 95,35 95,45 L 95,65 C 95,75 90,80 80,80" stroke="url(#copperPipeGradientStill)" strokeWidth="8" fill="none" strokeLinecap="round"/>
        <path d="M95,65 Q 85,70 80,60" stroke="url(#copperPipeGradientStill)" strokeWidth="5" fill="none" strokeLinecap="round"/>
        <circle cx="45" cy="58" r="1.5" fill={COPPER_COLOR_DARK}/><circle cx="55" cy="58" r="1.5" fill={COPPER_COLOR_DARK}/>
        <circle cx="35" cy="70" r="1.5" fill={COPPER_COLOR_DARK}/><circle cx="65" cy="70" r="1.5" fill={COPPER_COLOR_DARK}/>
    </svg>
);

const FermenterIcon = ({ fillPercentage = 0 }) => {
    const fillHeight = 90 * (Math.min(100, Math.max(0, fillPercentage)) / 100);
    return (
    <svg viewBox="0 0 100 120" className="w-16 h-20 inline-block">
        <defs>
            <linearGradient id="fermenterBodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style={{stopColor: STEEL_COLOR_LIGHT}} /><stop offset="50%" style={{stopColor: STEEL_COLOR_DARK}} /><stop offset="100%" style={{stopColor: STEEL_COLOR_LIGHT}} />
            </linearGradient>
            <clipPath id="fermenterClip">
                <path d="M 10 10 H 90 V 100 L 50 115 L 10 100 V 10 Z" />
            </clipPath>
        </defs>
        <path d="M 10 10 H 90 V 100 L 50 115 L 10 100 V 10 Z" fill="url(#fermenterBodyGradient)" stroke={STEEL_COLOR_DARK} strokeWidth="2"/>
        {fillHeight > 0 && <rect x="10" y={100 - fillHeight} width="80" height={fillHeight + 15} fill="rgba(210, 180, 140, 0.8)" clipPath="url(#fermenterClip)"/>}
        <rect x="8" y="8" width="84" height="10" fill={STEEL_COLOR_DARK} rx="2" />
        <path d="M 20 115 V 120" stroke={STEEL_COLOR_DARK} strokeWidth="4" /><path d="M 80 115 V 120" stroke={STEEL_COLOR_DARK} strokeWidth="4" />
        <path d="M 50 115 V 120" stroke={STEEL_COLOR_DARK} strokeWidth="4" />
    </svg>
    );
};


const ContainerTypeIcon = ({ type, fillPercentage = 0 }) => {
    const getFillSvgHeight = (maxSvgFillHeightForIcon, percentage) => (maxSvgFillHeightForIcon * Math.min(100, Math.max(0, percentage))) / 100;
    let visualFillableHeight = 80;
    if (type === 'wooden_barrel') visualFillableHeight = 85;
    if (type === 'metal_drum') visualFillableHeight = 95;
    if (type === 'square_tank') visualFillableHeight = 90;
    if (type === 'tote') visualFillableHeight = 100;
    if (type === 'five_gallon_tote') visualFillableHeight = 65;
    if (type === 'still') visualFillableHeight = 50;
    if (type === 'fermenter') return <FermenterIcon fillPercentage={fillPercentage} />;

    const actualFillSvgHeight = getFillSvgHeight(visualFillableHeight, fillPercentage);

    if (type === 'wooden_barrel') return <WoodenBarrelIcon fillSvgHeight={actualFillSvgHeight} />;
    if (type === 'metal_drum') return <MetalDrumIcon fillSvgHeight={actualFillSvgHeight} />;
    if (type === 'square_tank') return <SquareTankIcon fillSvgHeight={actualFillSvgHeight} />;
    if (type === 'tote') return <ToteIcon fillSvgHeight={actualFillSvgHeight} />;
    if (type === 'five_gallon_tote') return <FiveGallonToteIcon fillSvgHeight={actualFillSvgHeight} />;
    if (type === 'still') return <StillIcon fillSvgHeight={actualFillSvgHeight} />;
    return <div className="w-16 h-20 bg-gray-300 rounded flex items-center justify-center text-xs text-gray-600">No Icon</div>;
};


// --- Helper Functions ---
const calculateSpiritDensity = (proof) => {
    if (isNaN(proof) || proof < 0) proof = 0;
    if (proof === 0) return DENSITY_WATER_LBS_PER_GALLON;
    const volEthanolFraction = proof / 200;
    const volWaterFraction = 1 - volEthanolFraction;
    return (volEthanolFraction * DENSITY_ETHANOL_LBS_PER_GALLON) + (volWaterFraction * DENSITY_WATER_LBS_PER_GALLON);
};
const calculateDerivedValuesFromWeight = (tareWeight, grossWeight, proof) => {
    const tare = parseFloat(tareWeight) || 0;
    const gross = parseFloat(grossWeight) || 0;
    const prf = parseFloat(proof) || 0;
    let netWeightLbs = 0;
    if (gross > tare) { netWeightLbs = gross - tare; } else { netWeightLbs = 0; }
    const spiritDensity = calculateSpiritDensity(prf);
    let wineGallons = 0;
    if (netWeightLbs > 0 && spiritDensity > 0) { wineGallons = netWeightLbs / spiritDensity; }
    const proofGallons = wineGallons * (prf / 100);
    return {
        netWeightLbs: parseFloat(netWeightLbs.toFixed(2)),
        wineGallons: parseFloat(wineGallons.toFixed(3)),
        proofGallons: parseFloat(proofGallons.toFixed(3)),
        spiritDensity: parseFloat(spiritDensity.toFixed(3)),
        grossWeightLbs: parseFloat(gross.toFixed(2))
    };
};
const calculateDerivedValuesFromWineGallons = (wineGallons, proof, tareWeight) => {
    const wg = parseFloat(wineGallons) || 0;
    const prf = parseFloat(proof) || 0;
    const tare = parseFloat(tareWeight) || 0;
    const spiritDensity = calculateSpiritDensity(prf);
    const netWeightLbs = wg * spiritDensity;
    const grossWeightLbs = netWeightLbs + tare;
    const proofGallons = wg * (prf / 100);
    return {
        netWeightLbs: parseFloat(netWeightLbs.toFixed(2)),
        wineGallons: parseFloat(wg.toFixed(3)),
        proofGallons: parseFloat(proofGallons.toFixed(3)),
        spiritDensity: parseFloat(spiritDensity.toFixed(3)),
        grossWeightLbs: parseFloat(grossWeightLbs.toFixed(2))
    };
};
const calculateDerivedValuesFromProofGallons = (proofGallons, proof, tareWeight) => {
    const pg = parseFloat(proofGallons) || 0;
    const prf = parseFloat(proof) || 0;
    const tare = parseFloat(tareWeight) || 0;
    let wineGallons = 0;
    if (prf > 0 && pg > 0) {
        wineGallons = pg / (prf / 100);
    } else if (pg === 0) {
        wineGallons = 0;
    } else {
        wineGallons = 0;
    }
    const spiritDensity = calculateSpiritDensity(prf);
    const netWeightLbs = wineGallons * spiritDensity;
    const grossWeightLbs = netWeightLbs + tare;
    return {
        netWeightLbs: parseFloat(netWeightLbs.toFixed(2)),
        wineGallons: parseFloat(wineGallons.toFixed(3)),
        proofGallons: parseFloat(pg.toFixed(3)),
        spiritDensity: parseFloat(spiritDensity.toFixed(3)),
        grossWeightLbs: parseFloat(grossWeightLbs.toFixed(2))
    };
};


const logTransaction = async (db, userId, appId, logData) => {
    if (!db || !userId || !appId) { console.error("DB, UserID, or AppID missing for logging."); return; }
    const logPath = `artifacts/${appId}/users/${userId}/transactionLog`;
    try { await addDoc(collection(db, logPath), { ...logData, timestamp: serverTimestamp() }); console.log("Transaction logged:", logData.type); }
    catch (error) { console.error("Error logging transaction:", error, logData); }
};
const convertToCSV = (dataArray, headers) => {
    const array = [headers, ...dataArray];
    return array.map(row => row.map(field => { const data = field === null || field === undefined ? '' : String(field); const result = data.replace(/"/g, '""'); if (result.search(/("|,|\n)/g) >= 0) return `"${result}"`; return result; }).join(',')).join('\n');
};
const downloadCSV = (csvString, filename) => {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute("href", url); link.setAttribute("download", filename); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); }
};

// --- Main App Component ---
function App() {
    // Existing state...
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    const [showAuthModal, setShowAuthModal] = useState(false);
    const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
    const [authEmail, setAuthEmail] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [authError, setAuthError] = useState('');

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
    const [error, setError] = useState('');
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingContainer, setEditingContainer] = useState(null);
    const [formModalMode, setFormModalMode] = useState('add');
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
    const [currentView, setCurrentView] = useState('inventory'); // 'inventory' or 'production'
    const [showProductionModal, setShowProductionModal] = useState(false);
    const [editingProductionBatch, setEditingProductionBatch] = useState(null);
    const [productionModalType, setProductionModalType] = useState('fermentation');
    const [sortCriteria, setSortCriteria] = useState('name_asc');
    const appId = '1:587421865283:web:b58af950daaa93ce450bf6';

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
  setAuthError(''); // Clear previous errors
  try {
    if (authMode === 'login') {
      await signInWithEmailAndPassword(auth, authEmail, authPassword);
       // On successful login, onAuthStateChanged will trigger and set userId,
       // which will cause the app to proceed and hide the modal.
       // Optionally, you can close the modal immediately here as well:
       // setShowAuthModal(false);
    } else if (authMode === 'signup') {
      await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      // On successful signup, onAuthStateChanged will trigger and set userId.
      // setShowAuthModal(false); // Optional immediate close
    }
    // Clear form on success
    setAuthEmail('');
    setAuthPassword('');
  } catch (error) {
    console.error("Authentication error:", error);
    let message = "Authentication failed.";
    if (error.code === 'auth/user-not-found') {
        message = "No user found with this email.";
    } else if (error.code === 'auth/wrong-password') {
        message = "Incorrect password.";
    } else if (error.code === 'auth/email-already-in-use') {
        message = "Email is already in use.";
    } else if (error.code === 'auth/invalid-email') {
         message = "Invalid email address.";
    } else if (error.code === 'auth/weak-password') {
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
    useEffect(() => { /* Fetch Inventory */
        if (!isAuthReady || !db || !userId) { if(isAuthReady && (!db || !userId)) setIsLoadingInventory(false); return; }
        setIsLoadingInventory(true); const inventoryPath = `artifacts/${appId}/users/${userId}/spiritInventory`; const qInv = query(collection(db, inventoryPath));
        const unsubInv = onSnapshot(qInv, (snap) => { const items = []; snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() })); setInventory(items); setIsLoadingInventory(false); setError(''); }, (err) => { console.error("Inv fetch error:", err); setError("Inv fetch failed."); setIsLoadingInventory(false); });
        return () => unsubInv();
    }, [isAuthReady, db, userId, appId]);

    useEffect(() => { /* Fetch Products */
        if (!isAuthReady || !db || !userId) { if (isAuthReady && (!db || !userId)) setIsLoadingProducts(false); return; }
        setIsLoadingProducts(true); const productsPath = `artifacts/${appId}/users/${userId}/spiritProducts`; const qProd = query(collection(db, productsPath));
        const unsubProd = onSnapshot(qProd, async (snapshot) => {
            let fetchedProds = []; snapshot.forEach((doc) => { fetchedProds.push({ id: doc.id, ...doc.data() }); });
            if (fetchedProds.length === 0 && snapshot.empty) {
                const productsCollectionRef = collection(db, productsPath); const currentDocs = await getDocs(productsCollectionRef);
                if (currentDocs.empty) {
                    console.log("No products found, attempting to seed default products..."); const batch = writeBatch(db);
                    DEFAULT_PRODUCTS.forEach(prodData => { const newProdRef = doc(collection(db, productsPath)); batch.set(newProdRef, { name: prodData.name, description: prodData.description || "" }); });
                    try { await batch.commit(); } catch (seedError) { console.error("Error seeding default products:", seedError); setError("Failed to seed initial products."); setIsLoadingProducts(false); }
                } else { fetchedProds = []; currentDocs.forEach(d => fetchedProds.push({ id: d.id, ...d.data() })); fetchedProds.sort((a, b) => (a.name || "").localeCompare(b.name || "")); setProducts(fetchedProds); setIsLoadingProducts(false); }
            } else { fetchedProds.sort((a, b) => (a.name || "").localeCompare(b.name || "")); setProducts(fetchedProds); setIsLoadingProducts(false); }
        }, (err) => { console.error("Product fetch error:", err); setError("Failed to fetch products."); setIsLoadingProducts(false); });
        return () => unsubProd();
    }, [isAuthReady, db, userId, appId]);

    useEffect(() => { /* Fetch Transaction Log */
        if (!isAuthReady || !db || !userId) { if(isAuthReady && (!db || !userId)) setIsLoadingLog(false); return; }
        setIsLoadingLog(true); const logPath = `artifacts/${appId}/users/${userId}/transactionLog`; const qLog = query(collection(db, logPath));
        const unsubLog = onSnapshot(qLog, (snap) => { const logs = []; snap.forEach((doc) => logs.push({ id: doc.id, ...doc.data() })); logs.sort((a,b)=>(b.timestamp?.toDate?.()||0)-(a.timestamp?.toDate?.()||0)); setTransactionLog(logs); setIsLoadingLog(false); }, (err) => { console.error("Log fetch err:", err); setError("Log fetch failed."); setIsLoadingLog(false);});
        return () => unsubLog();
    }, [isAuthReady, db, userId, appId]);

    useEffect(() => { /* Fetch Production Batches */
        if (!isAuthReady || !db || !userId) { if(isAuthReady && (!db || !userId)) setIsLoadingProduction(false); return; }
        setIsLoadingProduction(true); const productionPath = `artifacts/${appId}/users/${userId}/productionBatches`; const qProd = query(collection(db, productionPath));
        const unsubProd = onSnapshot(qProd, (snap) => { const items = []; snap.forEach((doc) => items.push({ id: doc.id, ...doc.data() })); setProductionBatches(items); setIsLoadingProduction(false); }, (err) => { console.error("Production fetch error:", err); setError("Production fetch failed."); setIsLoadingProduction(false); });
        return () => unsubProd();
    }, [isAuthReady, db, userId, appId]);

    const sortedInventory = useMemo(() => {
        let sorted = [...inventory];
        switch (sortCriteria) {
            case 'name_asc': sorted.sort((a, b) => (a.name || "").localeCompare(b.name || "")); break;
            case 'name_desc': sorted.sort((a, b) => (b.name || "").localeCompare(a.name || "")); break;
            case 'product_asc': sorted.sort((a, b) => { const productA = a.status === 'filled' ? (a.currentFill?.productType || "zzzz_empty_product") : "zzzz_empty_container"; const productB = b.status === 'filled' ? (b.currentFill?.productType || "zzzz_empty_product") : "zzzz_empty_container"; return productA.localeCompare(productB); }); break;
            case 'product_desc': sorted.sort((a, b) => { const productA = a.status === 'filled' ? (a.currentFill?.productType || "!!!!_empty_product") : "!!!!_empty_container"; const productB = b.status === 'filled' ? (b.currentFill?.productType || "!!!!_empty_product") : "!!!!_empty_container"; return productB.localeCompare(productA); }); break;
            default: break;
        }
        return sorted;
    }, [inventory, sortCriteria]);

    // Modal Openers & Deletion logic
    const handleAddNewContainer = () => { setEditingContainer(null); setFormModalMode('add'); setShowFormModal(true); };
    const handleEditContainerInfo = (c) => { setEditingContainer(c); setFormModalMode('edit'); setShowFormModal(true); };
    const handleRefillContainer = (c) => { setEditingContainer({ ...c, currentFill: { ...(c.currentFill || {}), productType: c.currentFill?.productType || (products.length > 0 ? products[0].name : ''), grossWeightLbs: '', proof: '', wineGallonsInput: '', proofGallonsInput: '', fillDate: new Date().toISOString().split('T')[0] }}); setFormModalMode('refill'); setShowFormModal(true); };
    const handleOpenTransferModal = (c) => { setTransferSourceContainer(c); setShowTransferModal(true); };
    const handleOpenSampleModal = (c) => { setAdjustingContainer(c); setShowAdjustContentsModal(true); };
    const handleOpenProofDownModal = (c) => { setProofingContainer(c); setShowProofDownModal(true); };
    const handleOpenBottlingModal = (c) => { setBottlingContainer(c); setShowBottlingModal(true); };
    const handleDeletePrompt = (item, type) => { setItemToDelete({ item, type }); setShowConfirmModal(true); };
    const handleOpenManageProductsModal = () => setShowManageProductsModal(true);
    const handleOpenViewLogModal = () => setShowViewLogModal(true);
    const handleOpenImportModal = () => setShowImportModal(true);
    const handleOpenTtbReportModal = () => setShowTtbReportModal(true);
    const handleAddProductionBatch = (type) => { setEditingProductionBatch(null); setProductionModalType(type); setShowProductionModal(true); };
    const handleEditProductionBatch = (batch) => { setEditingProductionBatch(batch); setProductionModalType(batch.batchType); setShowProductionModal(true); };

    const confirmDeletion = async () => {
        if (!db || !userId || !itemToDelete) return;
        const { item, type } = itemToDelete;
        let docRef, logData;
        try {
            if (type === 'container') {
                docRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, item.id);
                logData = { type: item.status === 'filled' ? "DELETE_FILLED_CONTAINER" : "DELETE_EMPTY_CONTAINER", containerId: item.id, containerName: item.name, productType: item.currentFill?.productType || null, proof: item.currentFill?.proof || 0, netWeightLbsChange: -(item.currentFill?.netWeightLbs || 0), proofGallonsChange: -(item.currentFill?.proofGallons || 0), notes: "Container deleted."};
            } else if (type === 'product') {
                const productInUse = inventory.some(invItem => invItem.currentFill?.productType === item.name);
                if (productInUse) { setError(`"${item.name}" is in use by a container and cannot be deleted.`); setShowConfirmModal(false); setItemToDelete(null); return; }
                docRef = doc(db, `artifacts/${appId}/users/${userId}/spiritProducts`, item.id);
                logData = {type: "DELETE_PRODUCT", productName: item.name, notes: "Product definition deleted."};
            } else if (type === 'productionBatch') {
                docRef = doc(db, `artifacts/${appId}/users/${userId}/productionBatches`, item.id);
                logData = {type: "DELETE_PRODUCTION_BATCH", batchId: item.id, batchName: item.name, batchType: item.batchType, notes: "Production batch deleted."};
            }
            if (docRef) await deleteDoc(docRef);
            if (logData) await logTransaction(db, userId, appId, logData);
            setError('');
        } catch (e) { console.error("Deletion error:", e); setError("Deletion failed."); }
        setShowConfirmModal(false);
        setItemToDelete(null);
    };
    
    const isLoading = isLoadingInventory || isLoadingProducts || isLoadingLog || isLoadingProduction;

    return ( /* Main App JSX */
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4 font-sans">
           <header className="mb-6 text-center">
  <h1 className="text-4xl font-bold text-blue-400">{APP_NAME}</h1>
  {/* Replace the hardcoded "Jeff" with the user's email */}
  {userEmail && <p className="text-sm text-gray-400">Welcome, {userEmail}!</p>}
  {/* Keep the existing userId display */}
  {userId && <p className="text-xs text-gray-500 mt-1">UID: {userId} (App: {appId})</p>}
</header>

            <div className="mb-6 p-4 bg-gray-800 rounded-lg shadow-lg">
                <div className="flex flex-wrap gap-4 justify-center">
                     <button onClick={() => setShowDashboard(!showDashboard)} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center justify-between">
                        <span>Distillery Dashboard</span>
                        <svg className={`w-5 h-5 ml-2 transition-transform duration-300 ${showDashboard ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <button onClick={() => setCurrentView(currentView === 'inventory' ? 'production' : 'inventory')} className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md">
                        {currentView === 'inventory' ? 'Show Production Tracking' : 'Show Spirit Inventory'}
                    </button>
                </div>
                {showDashboard && <Dashboard inventory={inventory} />}
            </div>

            {error && <div className="bg-red-700 p-3 rounded mb-4 text-center">{error}</div>}
            
            {/* View-specific controls and content */}
            {currentView === 'inventory' ? (
                <>
                    <div className="mb-6 flex flex-wrap justify-center items-center gap-4">
                        <button onClick={handleAddNewContainer} className="bg-blue-600 hover:bg-blue-700 py-2 px-4 rounded-lg shadow-md">Add Container</button>
                        <button onClick={handleOpenManageProductsModal} className="bg-teal-600 hover:bg-teal-700 py-2 px-4 rounded-lg shadow-md">Manage Products</button>
                        <button onClick={handleOpenViewLogModal} className="bg-indigo-600 hover:bg-indigo-700 py-2 px-4 rounded-lg shadow-md">View Log</button>
                        <div className="relative inline-block text-left">
                            <DropdownButton label="Import/Export/Reports">
                                <DropdownItem onClick={handleOpenImportModal}>Import Containers CSV</DropdownItem>
                                <DropdownItem onClick={() => downloadCSV(convertToCSV(sortedInventory.map(c => [ c.name, c.type, c.status, c.currentFill?.productType || 'N/A', c.tareWeightLbs || 0, c.currentFill?.grossWeightLbs || 0, c.currentFill?.netWeightLbs || 0, c.currentFill?.proof || 0, c.currentFill?.wineGallons || 0, c.currentFill?.proofGallons || 0, c.currentFill?.fillDate || 'N/A', c.currentFill?.emptiedDate || 'N/A' ]), ["Container Name", "Type", "Status", "Product Type", "Tare (lbs)", "Gross (lbs)", "Net (lbs)", "Proof", "Wine Gal", "Proof Gal", "Fill Date", "Emptied Date"]), `inventory_${new Date().toISOString().split('T')[0]}.csv`)}>Export Inventory CSV</DropdownItem>
                                <DropdownItem onClick={handleOpenTtbReportModal}>TTB Report Summarizer</DropdownItem>
                            </DropdownButton>
                        </div>
                         <div className="flex items-center space-x-2">
                            <label htmlFor="sortCriteria" className="text-sm text-gray-300">Sort by:</label>
                            <select id="sortCriteria" value={sortCriteria} onChange={(e) => setSortCriteria(e.target.value)} className="bg-gray-700 text-gray-200 p-2 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500">
                                <option value="name_asc">Name (A-Z)</option><option value="name_desc">Name (Z-A)</option><option value="product_asc">Product (A-Z)</option><option value="product_desc">Product (Z-A)</option>
                            </select>
                        </div>
                    </div>
                    {isLoading && isAuthReady && userId && <div className="text-xl p-8 text-center">Loading data...</div>}
                    {!isLoading && sortedInventory.length === 0 && isAuthReady && userId && <div className="text-gray-400 text-lg p-8 text-center">No containers. Add one!</div>}
                    {!isLoading && sortedInventory.length > 0 && (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">{sortedInventory.map(c => <InventoryItem key={c.id} container={c} onEditInfo={handleEditContainerInfo} onRefill={handleRefillContainer} onTransfer={handleOpenTransferModal} onSample={handleOpenSampleModal} onProofDown={handleOpenProofDownModal} onBottle={handleOpenBottlingModal} onDelete={(id) => handleDeletePrompt(inventory.find(c => c.id === id), 'container')} />)}</div>)}
                </>
            ) : (
                <ProductionView 
                    batches={productionBatches} 
                    isLoading={isLoadingProduction}
                    onAddBatch={handleAddProductionBatch}
                    onEditBatch={handleEditProductionBatch}
                    onDeleteBatch={(batch) => handleDeletePrompt(batch, 'productionBatch')}
                />
            )}
             {isAuthReady && !userId && showAuthModal && (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4 text-center">
            {authMode === 'login' ? 'Login' : 'Sign Up'}
          </h2>
          {authError && <div className="bg-red-700 p-2 rounded mb-4 text-center">{authError}</div>}
          <form onSubmit={handleAuth}>
            <div className="mb-4">
              <label htmlFor="authEmail" className="block text-sm font-medium mb-1">Email</label>
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
              <label htmlFor="authPassword" className="block text-sm font-medium mb-1">Password</label>
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
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
              <button
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                {authMode === 'login'
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
    {isAuthReady && userId && ( // Add userId check here
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
            {error && <div className="bg-red-700 p-3 rounded mb-4 text-center">{error}</div>}
            {/* ... (Dashboard, currentView logic, buttons, lists, modals) ... */}
          </>
        )}
      </>
    )}
    
            
            {/* Modals */}
            {showFormModal && db && userId && <AddEditContainerModal db={db} userId={userId} appId={appId} container={editingContainer} mode={formModalMode} products={products} inventory={inventory} onClose={() => {setShowFormModal(false); setEditingContainer(null);}} setErrorApp={setError} />}
            {showProductionModal && db && userId && <AddEditProductionModal db={db} userId={userId} appId={appId} batch={editingProductionBatch} type={productionModalType} fermentations={productionBatches.filter(b => b.batchType === 'fermentation')} products={products} onClose={() => {setShowProductionModal(false); setEditingProductionBatch(null);}} setErrorApp={setError} />}
            {showTransferModal && db && userId && transferSourceContainer && <TransferModal db={db} userId={userId} appId={appId} sourceContainer={transferSourceContainer} allContainers={inventory} products={products} onClose={() => {setShowTransferModal(false); setTransferSourceContainer(null);}} setErrorApp={setError} />}
            {showAdjustContentsModal && db && userId && adjustingContainer && <AdjustContentsModal db={db} userId={userId} appId={appId} container={adjustingContainer} onClose={() => {setShowAdjustContentsModal(false); setAdjustingContainer(null);}} setErrorApp={setError} />}
            {showProofDownModal && db && userId && proofingContainer && <ProofDownModal db={db} userId={userId} appId={appId} container={proofingContainer} onClose={() => {setShowProofDownModal(false); setProofingContainer(null);}} setErrorApp={setError} />}
            {showBottlingModal && db && userId && bottlingContainer && <BottlingModal db={db} userId={userId} appId={appId} container={bottlingContainer} onClose={() => {setShowBottlingModal(false); setBottlingContainer(null);}} setErrorApp={setError} />}
            {showManageProductsModal && db && userId && <ManageProductsModal db={db} userId={userId} appId={appId} currentProducts={products} inventory={inventory} onDeletePrompt={(prod) => handleDeletePrompt(prod, 'product')} onClose={() => setShowManageProductsModal(false)} setErrorApp={setError} />}
            {showViewLogModal && <ViewLogModal transactionLog={transactionLog} isLoadingLog={isLoadingLog} onClose={() => setShowViewLogModal(false)} />}
            {showImportModal && db && userId && <ImportContainersModal db={db} userId={userId} appId={appId} existingContainers={inventory} products={products} onClose={() => setShowImportModal(false)} setErrorApp={setError} />}
            {showTtbReportModal && <TtbReportModal transactionLog={transactionLog} onClose={() => setShowTtbReportModal(false)} />}
            {showConfirmModal && <ConfirmationModal message={
                itemToDelete.type === 'product' ? `Delete product "${itemToDelete.item.name}"? This cannot be undone.` :
                itemToDelete.type === 'container' ? `Delete container "${itemToDelete.item.name}"? This will also delete its contents from inventory and cannot be undone.` :
                itemToDelete.type === 'productionBatch' ? `Delete batch "${itemToDelete.item.name}"? This cannot be undone.` :
                'Are you sure you want to delete this item?'
            } onConfirm={confirmDeletion} onCancel={() => {setShowConfirmModal(false); setItemToDelete(null);}} />}
        </div>
    );
}

// --- Dashboard Component ---
const Dashboard = ({ inventory }) => {
    const stats = useMemo(() => {
        let totalProofGallons = 0;
        let totalWineGallons = 0;
        let filledCount = 0;
        const productTotals = {};

        inventory.forEach(c => {
            if (c.status === 'filled' && c.currentFill) {
                filledCount++;
                const pg = c.currentFill.proofGallons || 0;
                const wg = c.currentFill.wineGallons || 0;
                const product = c.currentFill.productType || 'Unspecified';

                totalProofGallons += pg;
                totalWineGallons += wg;

                if (!productTotals[product]) {
                    productTotals[product] = 0;
                }
                productTotals[product] += pg;
            }
        });

        const sortedProducts = Object.entries(productTotals).sort(([, a], [, b]) => b - a);

        return {
            totalProofGallons,
            totalWineGallons,
            filledCount,
            emptyCount: inventory.length - filledCount,
            sortedProducts
        };
    }, [inventory]);

    return (
        <div className="bg-gray-800 p-4 rounded-lg mt-4 border border-blue-500/30">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-sm text-blue-300">Total Proof Gallons</p>
                    <p className="text-3xl font-bold">{stats.totalProofGallons.toFixed(3)}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-sm text-blue-300">Total Wine Gallons</p>
                    <p className="text-3xl font-bold">{stats.totalWineGallons.toFixed(3)}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-sm text-blue-300">Filled Containers</p>
                    <p className="text-3xl font-bold">{stats.filledCount}</p>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg text-center">
                    <p className="text-sm text-blue-300">Empty Containers</p>
                    <p className="text-3xl font-bold">{stats.emptyCount}</p>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-700">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Inventory by Product (PG)</h3>
                <div className="bg-gray-700 p-4 rounded-lg">
                    {stats.sortedProducts.length > 0 ? (
                        <ul className="space-y-2">
                            {stats.sortedProducts.map(([product, totalPg]) => (
                                <li key={product} className="flex justify-between items-center text-sm">
                                    <span className="text-gray-300">{product}</span>
                                    <span className="font-mono text-blue-300">{totalPg.toFixed(3)} PG</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-gray-500">No filled containers to summarize.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Dropdown Components ---
const DropdownButton = ({ label, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [ref]);

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md flex items-center"
            >
                {label}
                <svg className={`w-4 h-4 ml-2 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

const DropdownItem = ({ children, onClick }) => (
    <a href="#" onClick={(e) => { e.preventDefault(); onClick(); }} className="block px-4 py-2 text-sm text-gray-200 hover:bg-gray-600" role="menuitem">
        {children}
    </a>
);


// --- InventoryItem ---
const InventoryItem = ({ container, onEditInfo, onRefill, onTransfer, onSample, onProofDown, onBottle, onDelete }) => {
    const { name, type, status, currentFill, tareWeightLbs } = container;
    const { fillDate = 'N/A', grossWeightLbs = 0, proof = 0, netWeightLbs = 0, wineGallons = 0, proofGallons = 0, emptiedDate = null, productType = "Unspecified" } = currentFill || {};
    const capacity = CONTAINER_CAPACITIES_GALLONS[type] || 0;

    let percentageFull = 0;
    if (type === 'still') {
        percentageFull = (status === 'filled' && netWeightLbs > 0) ? 100 : 0;
    } else {
        percentageFull = capacity > 0 && status === 'filled' && wineGallons > 0 ? (wineGallons / capacity) * 100 : 0;
    }
    const displayPercentage = Math.min(100, Math.max(0, percentageFull)).toFixed(0);

    return (
        <div className="bg-gray-800 shadow-xl rounded-lg p-6 flex flex-col justify-between border-2 border-gray-700 hover:border-blue-500">
            <div className="flex flex-col items-center">
                <div className="mb-4">
                    <ContainerTypeIcon type={type} fillPercentage={percentageFull} />
                </div>
                <div className="text-center mb-3 w-full">
                    <h3 className="text-2xl font-semibold text-blue-300 truncate" title={name}>{name}</h3>
                    <p className={`text-sm font-semibold mt-1 px-2 py-0.5 rounded-full inline-block ${status === 'filled' ? 'bg-green-700 text-green-100' : 'bg-yellow-700 text-yellow-100'}`}>
                        {status === 'filled' ? (type === 'still' ? 'In Use' : 'Filled') : 'Empty'}
                    </p>
                    {status === 'filled' && type !== 'still' && ( <span className="ml-2 text-sm text-blue-300 font-semibold">{displayPercentage}% Full</span>)}
                    {status === 'filled' && productType !== "Unspecified Spirit" && productType && <p className="text-xs text-gray-400 mt-1">({productType})</p>}
                </div>
            </div>

            <div className="space-y-1 text-sm text-gray-300 mt-auto">
                <p><strong>Type:</strong> <span className="capitalize">{type?.replace(/_/g, ' ')}</span> {type !== 'still' ? `(Approx. ${capacity} gal)`: ''}</p>
                <p><strong>Tare Wt:</strong> {tareWeightLbs || 0} lbs</p>
                {status === 'filled' && (<>
                    <p><strong>{type === 'still' ? 'Batch Date' : 'Fill Date'}:</strong> {fillDate}</p>
                    <p><strong>Gross Wt:</strong> {grossWeightLbs} lbs</p>
                    <p><strong>Proof:</strong> {proof}</p>
                    <hr className="my-1 border-gray-700"/>
                    <p><strong>Net Product:</strong> {netWeightLbs} lbs</p>
                    <p><strong>Wine Gallons:</strong> {wineGallons.toFixed(3)} gal</p>
                    <p className="text-lg font-bold text-blue-400"><strong>Proof Gallons:</strong> {proofGallons.toFixed(3)} PG</p>
                </>)}
                {status === 'empty' && emptiedDate && <p><strong>Last Emptied:</strong> {emptiedDate}</p>}
                {status === 'empty' && !emptiedDate && <p>This container is currently empty.</p> }
            </div>
            <div className="mt-4 flex flex-wrap gap-2 justify-end pt-3 border-t border-gray-700">
                <button onClick={() => onEditInfo(container)} className="bg-gray-600 hover:bg-gray-500 text-xs py-2 px-3 rounded-md">Edit Info</button>
                {status === 'filled' ? (<>
                    <button onClick={() => onBottle(container)} className="bg-sky-600 hover:bg-sky-500 text-xs py-2 px-3 rounded-md">Bottle</button>
                    <button onClick={() => onTransfer(container)} className="bg-purple-600 hover:bg-purple-500 text-xs py-2 px-3 rounded-md">Transfer</button>
                    <button onClick={() => onProofDown(container)} className="bg-cyan-600 hover:bg-cyan-500 text-xs py-2 px-3 rounded-md">Proof Down</button>
                    <button onClick={() => onSample(container)} className="bg-yellow-600 hover:bg-yellow-500 text-xs py-2 px-3 rounded-md">Sample/Adjust</button>
                </>) : (<button onClick={() => onRefill(container)} className="bg-green-600 hover:bg-green-500 text-xs py-2 px-3 rounded-md">{type === 'still' ? 'New Batch' : 'Refill'}</button>)}
                <button onClick={() => onDelete(container.id)} className="bg-red-700 hover:bg-red-600 text-xs py-2 px-3 rounded-md">Delete</button>
            </div>
        </div>
    );
};

// --- AddEditContainerModal ---
const AddEditContainerModal = ({ db, userId, appId, container, mode, products, inventory, onClose, setErrorApp }) => {
    const isEditMode = mode === 'edit'; const isRefillMode = mode === 'refill'; const getDefaultProductType = () => products.length > 0 ? products[0].name : "Unspecified Spirit";
    const initialFormData = { name: '', type: 'wooden_barrel', tareWeightLbs: '', productType: getDefaultProductType(), fillDate: new Date().toISOString().split('T')[0], grossWeightLbs: '', proof: '' };
    const [formData, setFormData] = useState(initialFormData);
    const [calculated, setCalculated] = useState({ netWeightLbs: 0, wineGallons: 0, proofGallons: 0, spiritDensity: 0, grossWeightLbs: 0 });
    const [formError, setFormError] = useState('');
    const [isAddingEmpty, setIsAddingEmpty] = useState(mode === 'add' && !container);
    const [fillInputMethod, setFillInputMethod] = useState('weight');
    const [wineGallonsInput, setWineGallonsInput] = useState('');
    const [proofGallonsInput, setProofGallonsInput] = useState('');


    useEffect(() => {
        let productT = getDefaultProductType();
        if (container) {
            productT = container.currentFill?.productType || getDefaultProductType();
            let grossW = container.currentFill?.grossWeightLbs?.toString() || '';
            let prf = container.currentFill?.proof?.toString() || '';
            let fDate = container.currentFill?.fillDate || new Date().toISOString().split('T')[0];
            let wgInput = container.currentFill?.wineGallons?.toFixed(3) || '';
            let pgInput = container.currentFill?.proofGallons?.toFixed(3) || '';

            if (isRefillMode) { grossW = ''; prf = ''; wgInput = ''; pgInput = ''; fDate = new Date().toISOString().split('T')[0]; }

            setIsAddingEmpty(false);
            setFormData({ name: container.name || '', type: container.type || 'wooden_barrel', tareWeightLbs: container.tareWeightLbs?.toString() || '', productType: productT, fillDate: fDate, grossWeightLbs: grossW, proof: prf });
            setWineGallonsInput(wgInput);
            setProofGallonsInput(pgInput);
            setFillInputMethod('weight');
        } else {
            setIsAddingEmpty(true);
            setFormData({...initialFormData, productType: productT});
            setWineGallonsInput('');
            setProofGallonsInput('');
        }
    }, [container, mode, isRefillMode, products]);

    useEffect(() => {
        const tare = parseFloat(formData.tareWeightLbs) || 0;
        const proofVal = parseFloat(formData.proof) || 0;
        let newCalculated = { netWeightLbs: 0, wineGallons: 0, proofGallons: 0, spiritDensity: calculateSpiritDensity(proofVal), grossWeightLbs: tare };

        if (isAddingEmpty || (mode === 'edit' && container?.status === 'empty' && !formData.grossWeightLbs && !wineGallonsInput && !proofGallonsInput && !formData.proof)) {
            setCalculated(newCalculated);
            if (fillInputMethod === 'weight') setFormData(f => ({...f, grossWeightLbs: tare.toString()}));
            else if (fillInputMethod === 'wineGallons') setWineGallonsInput('0.000');
            else if (fillInputMethod === 'proofGallons') setProofGallonsInput('0.000');
            return;
        }

        if (fillInputMethod === 'weight') {
            const gross = parseFloat(formData.grossWeightLbs) || tare;
            newCalculated = calculateDerivedValuesFromWeight(tare, gross, proofVal);
            setWineGallonsInput(newCalculated.wineGallons.toFixed(3));
            setProofGallonsInput(newCalculated.proofGallons.toFixed(3));
        } else if (fillInputMethod === 'wineGallons') {
            const wg = parseFloat(wineGallonsInput) || 0;
            newCalculated = calculateDerivedValuesFromWineGallons(wg, proofVal, tare);
            setFormData(f => ({ ...f, grossWeightLbs: newCalculated.grossWeightLbs.toFixed(2) }));
            setProofGallonsInput(newCalculated.proofGallons.toFixed(3));
        } else if (fillInputMethod === 'proofGallons') {
            const pg = parseFloat(proofGallonsInput) || 0;
            if (proofVal === 0 && pg > 0) { /* Error caught by validateForm */ }
            newCalculated = calculateDerivedValuesFromProofGallons(pg, proofVal, tare);
            setFormData(f => ({ ...f, grossWeightLbs: newCalculated.grossWeightLbs.toFixed(2) }));
            setWineGallonsInput(newCalculated.wineGallons.toFixed(3));
        }
        setCalculated(newCalculated);

    }, [formData.tareWeightLbs, formData.grossWeightLbs, formData.proof, wineGallonsInput, proofGallonsInput, fillInputMethod, isAddingEmpty, mode, container?.status]);


    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === "wineGallonsInput") setWineGallonsInput(value);
        else if (name === "proofGallonsInput") setProofGallonsInput(value);
        else setFormData(prev => ({ ...prev, [name]: value }));
        setFormError('');
    };

    const handleFillMethodChange = (method) => {
        setFillInputMethod(method);
    };

    const validateForm = () => {
        if (!formData.name.trim()) return "Name is required.";
        const tare = parseFloat(formData.tareWeightLbs);
        if (isNaN(tare) || tare <= 0) return "Valid tare weight (>0) is required.";
        const isAttemptingToFill = !isAddingEmpty || isRefillMode ||
                                  (isEditMode && (
                                     formData.grossWeightLbs || wineGallonsInput || proofGallonsInput || formData.proof ||
                                     (container?.status === 'empty' && (formData.productType && formData.productType !== (products.length > 0 ? products[0].name : "Unspecified Spirit")))
                                  ));


        if (isAttemptingToFill) {
            if (!formData.productType) return "Product type required to fill.";
            if (!formData.fillDate) return "Fill date required to fill.";

            const proofVal = parseFloat(formData.proof);
            if (isNaN(proofVal) || proofVal < 0 || proofVal > 200) return "Proof (0-200) required to fill.";

            if (fillInputMethod === 'weight') {
                const gross = parseFloat(formData.grossWeightLbs);
                if (isNaN(gross) || gross <= 0) return "Gross weight (>0) required when filling by weight.";
                if (gross < tare) return "Gross weight must be >= tare weight.";
                if (gross > tare && proofVal === 0) return "Proof must be > 0 if net product weight is positive (using weight method).";
            } else if (fillInputMethod === 'wineGallons') {
                const wg = parseFloat(wineGallonsInput);
                if (isNaN(wg) || wg < 0) return "Valid Wine Gallons (>=0) required.";
                if (wg > 0 && proofVal === 0) return "Proof must be > 0 if Wine Gallons > 0.";
            } else if (fillInputMethod === 'proofGallons') {
                const pg = parseFloat(proofGallonsInput);
                if (isNaN(pg) || pg < 0) return "Valid Proof Gallons (>=0) required.";
                if (pg > 0 && proofVal === 0) return "Proof must be > 0 if Proof Gallons > 0.";
            }
        }
        return "";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationError = validateForm();
        if (validationError) { setFormError(validationError); return; }
        setFormError('');
        const batch = writeBatch(db);

        const finalTare = parseFloat(formData.tareWeightLbs);
        let finalProductType = formData.productType;
        let finalFillDate = formData.fillDate;
        let finalProof = parseFloat(formData.proof) || 0;
        let finalCalcs;
        let newStatus;
        let logEntryType = "";
        let logNetChange = 0, logPgChange = 0;
        const oldFillData = container?.currentFill || {};

        const isEffectivelyEmptyInput = !formData.grossWeightLbs && !wineGallonsInput && !proofGallonsInput && !formData.proof;

        if (isAddingEmpty || (mode === 'edit' && container?.status === 'empty' && isEffectivelyEmptyInput) ) {
             newStatus = 'empty';
             finalCalcs = calculateDerivedValuesFromWeight(finalTare, finalTare, 0);
             finalProductType = null;
             finalFillDate = null;
             finalProof = 0;
             logEntryType = (mode === 'add') ? "CREATE_EMPTY_CONTAINER" : "EDIT_EMPTY_DATA_CORRECTION";
        } else {
            if (fillInputMethod === 'weight') {
                finalCalcs = calculateDerivedValuesFromWeight(finalTare, parseFloat(formData.grossWeightLbs) || finalTare, finalProof);
            } else if (fillInputMethod === 'wineGallons') {
                finalCalcs = calculateDerivedValuesFromWineGallons(parseFloat(wineGallonsInput) || 0, finalProof, finalTare);
            } else { // proofGallons
                finalCalcs = calculateDerivedValuesFromProofGallons(parseFloat(proofGallonsInput) || 0, finalProof, finalTare);
            }

            if (finalCalcs.netWeightLbs > 0.001) {
                newStatus = 'filled';
                 if (!finalProductType) finalProductType = getDefaultProductType();
                 if (!finalFillDate) finalFillDate = new Date().toISOString().split('T')[0];
            } else {
                newStatus = 'empty';
                finalCalcs = calculateDerivedValuesFromWeight(finalTare, finalTare, 0);
                finalProductType = oldFillData.productType || null;
                finalFillDate = null;
                finalProof = 0;
            }

            if (mode === 'add') {
                if (formData.type === 'still' && newStatus === 'filled') {
                    logEntryType = "PRODUCTION";
                } else {
                    logEntryType = newStatus === 'filled' ? "CREATE_FILLED_CONTAINER" : "CREATE_EMPTY_CONTAINER";
                }
                logNetChange = finalCalcs.netWeightLbs; 
                logPgChange = finalCalcs.proofGallons;
            }
            else if (mode === 'refill') { 
                if (formData.type === 'still' && newStatus === 'filled') {
                    logEntryType = "PRODUCTION";
                } else {
                    logEntryType = "REFILL_CONTAINER";
                }
                logNetChange = finalCalcs.netWeightLbs; 
                logPgChange = finalCalcs.proofGallons;
            }
            else { // edit mode
                logNetChange = finalCalcs.netWeightLbs - (oldFillData.netWeightLbs || 0);
                logPgChange = finalCalcs.proofGallons - (oldFillData.proofGallons || 0);
                if (container.status === 'empty' && newStatus === 'filled') {
                     if (formData.type === 'still') {
                        logEntryType = "PRODUCTION";
                    } else {
                        logEntryType = "EDIT_FILL_FROM_EMPTY";
                    }
                }
                else if (container.status === 'filled' && newStatus === 'empty') logEntryType = "EDIT_EMPTY_FROM_FILLED";
                else if (newStatus === 'filled') logEntryType = "EDIT_FILL_DATA_CORRECTION";
                else logEntryType = "EDIT_EMPTY_DATA_CORRECTION";
            }
        }

        const dataToSave = {
            name: formData.name.trim(), type: formData.type, tareWeightLbs: finalTare, status: newStatus,
            currentFill: {
                productType: newStatus === 'filled' ? finalProductType : (oldFillData.productType && newStatus === 'empty' ? oldFillData.productType : null),
                fillDate: newStatus === 'filled' ? finalFillDate : null,
                grossWeightLbs: finalCalcs.grossWeightLbs,
                proof: finalProof,
                netWeightLbs: finalCalcs.netWeightLbs,
                wineGallons: finalCalcs.wineGallons,
                proofGallons: finalCalcs.proofGallons,
                spiritDensity: finalCalcs.spiritDensity,
                emptiedDate: newStatus === 'empty' ? (container?.status === 'filled' ? new Date().toISOString().split('T')[0] : (oldFillData.emptiedDate || new Date().toISOString().split('T')[0])) : null
            }
        };
         if (newStatus === 'filled') dataToSave.currentFill.emptiedDate = null;

        try {
            const inventoryPath = `artifacts/${appId}/users/${userId}/spiritInventory`;
            let docRef;
            if (isEditMode || isRefillMode) {
                docRef = doc(db, inventoryPath, container.id);
                batch.update(docRef, dataToSave);
            } else {
                docRef = doc(collection(db, inventoryPath));
                batch.set(docRef, dataToSave);
            }
            const logData = { type: logEntryType, containerId: docRef.id, containerName: dataToSave.name, productType: dataToSave.currentFill.productType, proof: dataToSave.currentFill.proof, netWeightLbsChange: logNetChange, proofGallonsChange: logPgChange, notes: `${mode} via ${fillInputMethod} method. ${isAddingEmpty ? "New empty." : (newStatus === 'empty' && logEntryType !== "CREATE_EMPTY_CONTAINER" ? "Container emptied." : "")}`};
            const logCollRef = collection(db, `artifacts/${appId}/users/${userId}/transactionLog`);
            batch.set(doc(logCollRef), {...logData, timestamp: serverTimestamp()});
            await batch.commit();
            setErrorApp('');
            onClose();
        } catch (err) {
            console.error("Save error:", err);
            setFormError("Save failed: " + err.message);
            setErrorApp("Save failed.");
        }
    };
    const title = mode === 'add' ? "Add Container" : (mode === 'refill' ? `Refill: ${container?.name}` : `Edit: ${container?.name}`);
    const showFillInputs = !isAddingEmpty || mode === 'refill' || (isEditMode && (container?.status === 'filled' || formData.grossWeightLbs || wineGallonsInput || proofGallonsInput || formData.proof));


    return ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"><h2 className="text-2xl mb-6 text-blue-300">{title}</h2>{formError && <div className="bg-red-600 p-3 rounded mb-4 text-sm">{formError}</div>}<form onSubmit={handleSubmit} className="space-y-4"><div><label htmlFor="name" className="block text-sm font-medium text-gray-300">Container Name/ID</label><input id="name" type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 w-full bg-gray-700 p-2 rounded"/><label htmlFor="type" className="block text-sm font-medium text-gray-300 mt-2">Container Type</label><select id="type" name="type" value={formData.type} onChange={handleChange} className="mt-1 w-full bg-gray-700 p-2 rounded"><option value="wooden_barrel">Wooden Barrel</option><option value="metal_drum">Metal Drum</option><option value="square_tank">Square Tank (IBC)</option><option value="tote">Tote (250gal)</option><option value="five_gallon_tote">5 Gallon Tote</option><option value="still">Still</option></select><label htmlFor="tareWeightLbs" className="block text-sm font-medium text-gray-300 mt-2">Tare Weight (lbs)</label><input id="tareWeightLbs" type="number" name="tareWeightLbs" value={formData.tareWeightLbs} onChange={handleChange} required step="0.01" min="0.1" readOnly={isRefillMode || (isEditMode && container?.status === 'filled')} className="mt-1 w-full bg-gray-700 p-2 rounded read-only:bg-gray-600"/>{(isRefillMode || (isEditMode && container?.status === 'filled')) && <p className="text-xs text-gray-500">Tare locked for filled/refill.</p>}</div>{mode === 'add' && <div className="flex items-center mt-3"><input type="checkbox" id="addAsEmpty" checked={isAddingEmpty} onChange={(e) => setIsAddingEmpty(e.target.checked)} className="h-4 w-4 text-blue-600 border-gray-500 rounded focus:ring-blue-500" /><label htmlFor="addAsEmpty" className="ml-2 block text-sm text-gray-300">Add as new empty container</label></div>}

        {(showFillInputs) && <><hr className="my-3 border-gray-700"/><p className="text-lg text-blue-400">Fill Details:</p>
        <div className="my-2"><label className="block text-sm font-medium text-gray-300 mb-1">Fill Input Method:</label><div className="flex space-x-4">
            {['weight', 'wineGallons', 'proofGallons'].map(method => (
                <label key={method} className="flex items-center space-x-1 text-sm text-gray-200">
                    <input type="radio" name="fillInputMethod" value={method} checked={fillInputMethod === method} onChange={() => handleFillMethodChange(method)} className="form-radio h-4 w-4 text-blue-500"/>
                    <span>{method === 'weight' ? 'Weight' : (method === 'wineGallons' ? 'Wine Gal' : 'Proof Gal')}</span>
                </label>))}
        </div></div>
        <label htmlFor="productType" className="block text-sm font-medium text-gray-300">Product Type</label><select id="productType" name="productType" value={formData.productType} onChange={handleChange} className="mt-1 w-full bg-gray-700 p-2 rounded" required={!isAddingEmpty || mode === 'refill'}><option value="">-- Select Product --</option>{products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select>
        <label htmlFor="fillDate" className="block text-sm font-medium text-gray-300 mt-2">Date of Fill</label><input id="fillDate" type="date" name="fillDate" value={formData.fillDate} onChange={handleChange} className="mt-1 w-full bg-gray-700 p-2 rounded"/>
        <label htmlFor="proof" className="block text-sm font-medium text-gray-300 mt-2">Proof (0-200)</label><input id="proof" type="number" name="proof" value={formData.proof} onChange={handleChange} step="0.1" min="0" max="200" className="mt-1 w-full bg-gray-700 p-2 rounded"/>

        {fillInputMethod === 'weight' && <div><label htmlFor="grossWeightLbs" className="block text-sm font-medium text-gray-300 mt-2">Gross Weight (lbs)</label><input id="grossWeightLbs" type="number" name="grossWeightLbs" value={formData.grossWeightLbs} onChange={handleChange} step="0.01" min="0" className="mt-1 w-full bg-gray-700 p-2 rounded"/></div>}
        {fillInputMethod === 'wineGallons' && <div><label htmlFor="wineGallonsInput" className="block text-sm font-medium text-gray-300 mt-2">Wine Gallons</label><input id="wineGallonsInput" type="number" name="wineGallonsInput" value={wineGallonsInput} onChange={handleChange} step="0.001" min="0" className="mt-1 w-full bg-gray-700 p-2 rounded"/></div>}
        {fillInputMethod === 'proofGallons' && <div><label htmlFor="proofGallonsInput" className="block text-sm font-medium text-gray-300 mt-2">Proof Gallons</label><input id="proofGallonsInput" type="number" name="proofGallonsInput" value={proofGallonsInput} onChange={handleChange} step="0.001" min="0" className="mt-1 w-full bg-gray-700 p-2 rounded"/></div>}
        </>}

        <div className="bg-gray-750 p-3 rounded mt-1 border border-gray-600"><h4 className="text-md font-semibold mb-1">Calculated:</h4>
            {!isAddingEmpty && (!isAddingEmpty || mode === 'refill' || (isEditMode && container?.status === 'filled')) && <>
                <p className="text-sm">Gross Wt: {calculated.grossWeightLbs.toFixed(2)} lbs</p>
                <p className="text-sm">Net Wt: {calculated.netWeightLbs.toFixed(2)} lbs</p>
                <p className="text-sm">Density: ~{calculated.spiritDensity?.toFixed(3)} lbs/gal</p>
                <p className="text-sm">Wine Gal: {calculated.wineGallons.toFixed(3)} gal</p>
                <p className="text-md font-bold">Proof Gal: {calculated.proofGallons.toFixed(3)} PG</p>
            </>}
             {isAddingEmpty && <p className="text-sm">Container will be added empty.</p>}
        </div>
        <div className="flex justify-end space-x-3 pt-2"><button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">Cancel</button><button type="submit" className="bg-blue-600 py-2 px-4 rounded">{mode === 'add' ? 'Add' : 'Save'}</button></div></form></div></div>);
};

// --- TransferModal ---
const TransferModal = ({ db, userId, appId, sourceContainer, allContainers, onClose, setErrorApp }) => {
    const [destinationId, setDestinationId] = useState(''); const [transferWeightNet, setTransferWeightNet] = useState(false); const [transferAll, setTransferAll] = useState(false); const [formError, setFormError] = useState('');
    const availableDestinations = allContainers.filter(c => c.id !== sourceContainer.id && c.status === 'empty');
    const sourceMaxNet = sourceContainer.currentFill?.netWeightLbs || 0; const sourceProof = sourceContainer.currentFill?.proof || 0; const sourceProductType = sourceContainer.currentFill?.productType || "Unspecified Spirit";
    useEffect(() => { if (transferAll) setTransferWeightNet(sourceMaxNet.toString()); }, [transferAll, sourceMaxNet]);
    const handleTransfer = async () => { setFormError(''); const netToTransfer = parseFloat(transferWeightNet); if (!destinationId) { setFormError("Select destination."); return; } if (isNaN(netToTransfer) || netToTransfer <= 0) { setFormError("Valid transfer weight required."); return; } if (netToTransfer > sourceMaxNet + 0.001) { setFormError(`Cannot transfer > ${sourceMaxNet.toFixed(2)} lbs.`); return; } const destContainerData = allContainers.find(c => c.id === destinationId); if (!destContainerData || destContainerData.status !== 'empty') { setFormError("Invalid destination."); return; }
        try { const batch = writeBatch(db); const sourceRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, sourceContainer.id); const destRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, destinationId);
            const sourceSpiritDensity = calculateSpiritDensity(sourceProof);
            const wgTransferred = sourceSpiritDensity > 0 ? netToTransfer / sourceSpiritDensity : 0;
            const pgTransferred = wgTransferred * (sourceProof / 100);

            const newSrcGrossNum = (parseFloat(sourceContainer.currentFill.grossWeightLbs) || parseFloat(sourceContainer.tareWeightLbs) || 0) - netToTransfer;
            const srcCalcs = calculateDerivedValuesFromWeight(parseFloat(sourceContainer.tareWeightLbs) || 0, newSrcGrossNum, sourceProof);
            let srcStatus = 'filled', srcEmptiedDate = null, finalSrcProof = sourceProof;
            if (srcCalcs.netWeightLbs <= 0.001) { srcStatus = 'empty'; srcEmptiedDate = new Date().toISOString().split('T')[0]; finalSrcProof = 0; Object.assign(srcCalcs, calculateDerivedValuesFromWeight(parseFloat(sourceContainer.tareWeightLbs) || 0, parseFloat(sourceContainer.tareWeightLbs) || 0, 0));}

            batch.update(sourceRef, { status: srcStatus, "currentFill.grossWeightLbs": srcCalcs.grossWeightLbs, "currentFill.proof": finalSrcProof, "currentFill.netWeightLbs": srcCalcs.netWeightLbs, "currentFill.wineGallons": srcCalcs.wineGallons, "currentFill.proofGallons": srcCalcs.proofGallons, "currentFill.emptiedDate": srcEmptiedDate, "currentFill.spiritDensity": srcCalcs.spiritDensity });
            logTransaction(db, userId, appId, {type: "TRANSFER_OUT", containerId: sourceContainer.id, containerName: sourceContainer.name, productType: sourceProductType, proof: sourceProof, netWeightLbsChange: -netToTransfer, proofGallonsChange: -pgTransferred, destinationContainerId: destinationId, destinationContainerName: destContainerData.name, notes: `To ${destContainerData.name}` });

            const newDestGrossNum = (parseFloat(destContainerData.tareWeightLbs) || 0) + netToTransfer;
            const destCalcs = calculateDerivedValuesFromWeight(parseFloat(destContainerData.tareWeightLbs) || 0, newDestGrossNum, sourceProof);
            batch.update(destRef, { status: 'filled', "currentFill.productType": sourceProductType, "currentFill.fillDate": new Date().toISOString().split('T')[0], "currentFill.grossWeightLbs": destCalcs.grossWeightLbs, "currentFill.proof": sourceProof, "currentFill.netWeightLbs": destCalcs.netWeightLbs, "currentFill.wineGallons": destCalcs.wineGallons, "currentFill.proofGallons": destCalcs.proofGallons, "currentFill.spiritDensity": destCalcs.spiritDensity, "currentFill.emptiedDate": null });
            logTransaction(db, userId, appId, {type: "TRANSFER_IN", containerId: destinationId, containerName: destContainerData.name, productType: sourceProductType, proof: sourceProof, netWeightLbsChange: netToTransfer, proofGallonsChange: pgTransferred, sourceContainerId: sourceContainer.id, sourceContainerName: sourceContainer.name, notes: `From ${sourceContainer.name}` });

            await batch.commit(); setErrorApp(''); onClose();
        } catch (err) { console.error("Transfer error: ", err); setFormError("Transfer failed: " + err.message); setErrorApp("Transfer failed."); }};
    return ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md"><h2 className="text-xl font-semibold mb-4 text-blue-300">Transfer From: {sourceContainer.name}</h2><p className="text-sm text-gray-400 mb-1">({sourceProductType}) Available: {sourceMaxNet.toFixed(2)} lbs at {sourceProof} proof.</p>{formError && <div className="bg-red-600 p-2 rounded mb-3 text-sm">{formError}</div>}<div className="space-y-4"><select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="w-full bg-gray-700 p-2 rounded mt-1"><option value="">-- Select Empty Destination --</option>{availableDestinations.map(c => <option key={c.id} value={c.id}>{c.name} (Tare: {c.tareWeightLbs} lbs)</option>)}</select><input type="number" value={transferWeightNet} onChange={(e) => {setTransferWeightNet(e.target.value); if(transferAll) setTransferAll(false);}} disabled={transferAll} step="0.01" min="0.01" placeholder="Net Lbs to Transfer" className="w-full bg-gray-700 p-2 rounded mt-1 disabled:bg-gray-600"/><div className="flex items-center"><input type="checkbox" id="transferAll" checked={transferAll} onChange={(e) => setTransferAll(e.target.checked)} className="mr-2 h-4 w-4 text-blue-500 border-gray-600 rounded focus:ring-blue-500"/><label htmlFor="transferAll" className="text-sm text-gray-300">Transfer All</label></div><div className="flex justify-end space-x-3 pt-3"><button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">Cancel</button><button onClick={handleTransfer} className="bg-purple-600 py-2 px-4 rounded">Confirm Transfer</button></div></div></div></div>);
};

// --- AdjustContentsModal ---
const AdjustContentsModal = ({ db, userId, appId, container, onClose, setErrorApp }) => {
    const [removalValue, setRemovalValue] = useState('');
    const [removalInputMethod, setRemovalInputMethod] = useState('weight');
    const [formError, setFormError] = useState('');

    const { currentFill = {} } = container;
    const { netWeightLbs = 0, proof = 0, wineGallons = 0, proofGallons = 0, productType = 'N/A' } = currentFill;
    const currentSpiritDensity = currentFill.spiritDensity || calculateSpiritDensity(proof);

    const handleAdjust = async () => {
        setFormError('');
        let netLbsToRemove = 0;
        const val = parseFloat(removalValue);

        if (isNaN(val) || val <= 0) { setFormError("Valid removal amount (>0) required."); return; }

        if (removalInputMethod === 'weight') {
            netLbsToRemove = val;
        } else if (removalInputMethod === 'wineGallons') {
            if (currentSpiritDensity === 0 && val > 0) { setFormError("Cannot calculate weight from WG: spirit density is zero."); return;}
            netLbsToRemove = val * currentSpiritDensity;
        } else if (removalInputMethod === 'proofGallons') {
            if (proof === 0 && val > 0) { setFormError("Cannot remove by PG if proof is 0."); return; }
            if (currentSpiritDensity === 0 && val > 0) { setFormError("Cannot calculate weight from PG: spirit density is zero."); return;}
            const wgToRemove = proof > 0 ? val / (proof / 100) : 0;
            netLbsToRemove = wgToRemove * currentSpiritDensity;
        }

        if (netLbsToRemove > netWeightLbs + 0.001) {
             setFormError(`Cannot remove > ${netWeightLbs.toFixed(2)} lbs (or its volumetric equivalent).`);
             return;
        }

        const batch = writeBatch(db);
        const containerRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, container.id);
        const newGrossNum = (currentFill.grossWeightLbs || container.tareWeightLbs || 0) - netLbsToRemove;
        const finalCalcs = calculateDerivedValuesFromWeight(container.tareWeightLbs || 0, newGrossNum, proof);
        
        const wineGallonsRemoved = currentSpiritDensity > 0 ? netLbsToRemove / currentSpiritDensity : 0;
        const proofGallonsRemoved = wineGallonsRemoved * (proof / 100);

        batch.update(containerRef, {
            "currentFill.grossWeightLbs": finalCalcs.grossWeightLbs,
            "currentFill.netWeightLbs": finalCalcs.netWeightLbs,
            "currentFill.wineGallons": finalCalcs.wineGallons,
            "currentFill.proofGallons": finalCalcs.proofGallons,
        });

        const logData = { type: "SAMPLE_ADJUST", containerId: container.id, containerName: container.name, productType: productType, proof: proof, netWeightLbsChange: -netLbsToRemove, proofGallonsChange: -proofGallonsRemoved, notes: `Sample or tax adjustment via ${removalInputMethod}.`};
        const logCollRef = collection(db, `artifacts/${appId}/users/${userId}/transactionLog`);
        batch.set(doc(logCollRef), {...logData, timestamp: serverTimestamp()});
        
        try { await batch.commit(); setErrorApp(''); onClose(); } catch (err) { console.error("Adjust error:", err); setFormError("Adjust failed: " + err.message); setErrorApp("Adjust failed.");}};

    return ( <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md"><h2 className="text-xl mb-4 text-yellow-300">Sample/Adjust: {container.name}</h2><p className="text-sm text-gray-400 mb-1">({productType}) Available: {netWeightLbs.toFixed(2)} lbs / {wineGallons.toFixed(3)} WG</p>{formError && <div className="bg-red-600 p-2 rounded mb-3 text-sm">{formError}</div>}
    <div className="space-y-3">
        <div><label className="block text-sm font-medium text-gray-300 mb-1">Removal Method:</label><div className="flex space-x-3">
            {['weight', 'wineGallons', 'proofGallons'].map(method => (
                <label key={method} className="flex items-center space-x-1 text-sm text-gray-200">
                    <input type="radio" name="removalInputMethod" value={method} checked={removalInputMethod === method} onChange={() => setRemovalInputMethod(method)} className="form-radio h-4 w-4 text-yellow-500 border-gray-600 focus:ring-yellow-500"/>
                    <span>{method === 'weight' ? 'Weight (lbs)' : (method === 'wineGallons' ? 'Wine Gal' : 'Proof Gal')}</span>
                </label>))}
        </div></div>
        <input type="number" value={removalValue} onChange={(e) => setRemovalValue(e.target.value)} step="0.001" min="0" placeholder={`Amount to remove`} className="w-full bg-gray-700 p-2 rounded mt-1"/>
        <div className="flex justify-end space-x-3 pt-3"><button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">Cancel</button><button onClick={handleAdjust} className="bg-yellow-600 py-2 px-4 rounded">Confirm Removal</button></div>
    </div></div></div>);
};


// --- ProofDownModal ---
const ProofDownModal = ({ db, userId, appId, container, onClose, setErrorApp }) => {
    const [targetProof, setTargetProof] = useState('');
    const [formError, setFormError] = useState('');

    const { currentFill = {}, tareWeightLbs = 0 } = container;
    const { proof: initialProof = 0, proofGallons: initialProofGallons = 0, wineGallons: initialWineGallons = 0, productType = 'N/A' } = currentFill;

    const calculations = useMemo(() => {
        const newProof = parseFloat(targetProof);
        if (isNaN(newProof) || newProof <= 0 || newProof >= initialProof) {
            return { waterToAddGallons: 0, waterToAddLbs: 0, finalWineGallons: initialWineGallons, finalGrossWeight: 0, finalSpiritDensity: 0, isValid: false };
        }

        const finalWineGallons = initialProofGallons / (newProof / 100);
        const waterToAddGallons = finalWineGallons - initialWineGallons;
        const waterToAddLbs = waterToAddGallons * DENSITY_WATER_LBS_PER_GALLON;
        const finalNetWeight = (currentFill.netWeightLbs || 0) + waterToAddLbs;
        const finalGrossWeight = (tareWeightLbs || 0) + finalNetWeight;
        const finalSpiritDensity = calculateSpiritDensity(newProof);

        return { waterToAddGallons, waterToAddLbs, finalWineGallons, finalGrossWeight, finalSpiritDensity, isValid: true };
    }, [targetProof, initialProof, initialProofGallons, initialWineGallons, currentFill.netWeightLbs, tareWeightLbs]);

    const handleProofDown = async () => {
        setFormError('');
        const newProof = parseFloat(targetProof);

        if (!calculations.isValid) {
            setFormError(`Invalid target proof. Must be > 0 and less than the current proof of ${initialProof}.`);
            return;
        }
        const capacity = CONTAINER_CAPACITIES_GALLONS[container.type] || 0;
        if (capacity > 0 && calculations.finalWineGallons > capacity) {
            setFormError(`Resulting volume (${calculations.finalWineGallons.toFixed(2)} gal) exceeds container capacity (${capacity} gal).`);
            return;
        }

        const batch = writeBatch(db);
        const containerRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, container.id);
        const updatedData = {
            "currentFill.proof": newProof,
            "currentFill.wineGallons": calculations.finalWineGallons,
            "currentFill.grossWeightLbs": calculations.finalGrossWeight,
            "currentFill.netWeightLbs": (currentFill.netWeightLbs || 0) + calculations.waterToAddLbs,
            "currentFill.spiritDensity": calculations.finalSpiritDensity,
        };
        batch.update(containerRef, updatedData);

        const logData = {
            type: "PROOF_DOWN",
            containerId: container.id,
            containerName: container.name,
            productType: productType,
            proof: newProof,
            netWeightLbsChange: calculations.waterToAddLbs,
            proofGallonsChange: 0,
            notes: `Proofed down from ${initialProof} to ${newProof}. Added ${calculations.waterToAddGallons.toFixed(3)} gal of water.`
        };
        const logCollRef = collection(db, `artifacts/${appId}/users/${userId}/transactionLog`);
        batch.set(doc(logCollRef), { ...logData, timestamp: serverTimestamp() });

        try {
            await batch.commit();
            setErrorApp('');
            onClose();
        } catch (err) {
            console.error("Proof down error:", err);
            setFormError("Failed to save changes: " + err.message);
            setErrorApp("Proof down failed.");
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-xl mb-4 font-semibold text-cyan-300">Proof Down: {container.name}</h2>
                {formError && <div className="bg-red-600 p-2 rounded mb-3 text-sm">{formError}</div>}
                <div className="space-y-4">
                    <div className="text-sm text-gray-400">
                        <p><strong>Product:</strong> {productType}</p>
                        <p><strong>Current State:</strong> {initialWineGallons.toFixed(3)} WG @ {initialProof} Proof ({initialProofGallons.toFixed(3)} PG)</p>
                    </div>
                    <div>
                        <label htmlFor="targetProof" className="block text-sm font-medium text-gray-300">New Target Proof</label>
                        <input
                            type="number"
                            id="targetProof"
                            value={targetProof}
                            onChange={(e) => setTargetProof(e.target.value)}
                            placeholder={`Enter proof < ${initialProof}`}
                            className="w-full bg-gray-700 p-2 rounded mt-1"
                            step="0.1" min="0" max={initialProof > 0 ? initialProof - 0.1 : 0}
                        />
                    </div>
                    {calculations.isValid && (
                        <div className="bg-gray-700 p-3 rounded border border-gray-600 text-sm">
                            <h4 className="font-semibold text-gray-300 mb-2">Resulting Change:</h4>
                            <p><strong>Add Water:</strong> <span className="text-cyan-300">{calculations.waterToAddGallons.toFixed(3)} gal</span> ({calculations.waterToAddLbs.toFixed(2)} lbs)</p>
                            <hr className="my-2 border-gray-600" />
                            <p><strong>Final WG:</strong> {calculations.finalWineGallons.toFixed(3)} gal</p>
                            <p><strong>Final Gross Wt:</strong> {calculations.finalGrossWeight.toFixed(2)} lbs</p>
                            <p className="font-bold"><strong>Final Proof Gallons:</strong> {initialProofGallons.toFixed(3)} PG (Unchanged)</p>
                        </div>
                    )}
                    <div className="flex justify-end space-x-3 pt-3">
                        <button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">Cancel</button>
                        <button onClick={handleProofDown} disabled={!calculations.isValid} className="bg-cyan-600 py-2 px-4 rounded disabled:bg-cyan-800 disabled:cursor-not-allowed">Confirm Proof Down</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- BottlingModal ---
const BottlingModal = ({ db, userId, appId, container, onClose, setErrorApp }) => {
    const [numBottles, setNumBottles] = useState('');
    const [bottleSizeMl, setBottleSizeMl] = useState(BOTTLE_SIZES_ML[0].value);
    const [formError, setFormError] = useState('');
    const [remainderAction, setRemainderAction] = useState('keep');
    const [adjustmentAmount, setAdjustmentAmount] = useState('');
    const [adjustmentType, setAdjustmentType] = useState('loss');


    const { currentFill = {}, tareWeightLbs = 0 } = container;
    const { proof = 0, wineGallons: initialWineGallons = 0, proofGallons: initialProofGallons = 0, netWeightLbs: initialNetWeightLbs = 0, spiritDensity = 0, productType = 'N/A' } = currentFill;
    
    const bottlingCalcs = useMemo(() => {
        const bottles = parseInt(numBottles, 10);
        const size = parseInt(bottleSizeMl, 10);

        if (isNaN(bottles) || isNaN(size) || bottles < 0 || size <= 0) {
            return { wgBottled: 0, pgBottled: 0, lbsBottled: 0, finalWg: initialWineGallons, isGain: false, isValid: false };
        }
        
        const wgBottled = (bottles * size) / ML_PER_GALLON;
        const pgBottled = wgBottled * (proof / 100);
        const lbsBottled = wgBottled * spiritDensity;
        const isGain = wgBottled > initialWineGallons + 0.001;
        const finalWg = initialWineGallons - wgBottled;

        return { wgBottled, pgBottled, lbsBottled, finalWg, isGain, isValid: bottles > 0 };
    }, [numBottles, bottleSizeMl, initialWineGallons, proof, spiritDensity]);

    const manualAdjustmentCalcs = useMemo(() => {
        const wg = parseFloat(adjustmentAmount);
        if (isNaN(wg) || wg <= 0) {
            return { pg: 0 };
        }
        const pg = wg * (proof / 100);
        return { pg };
    }, [adjustmentAmount, proof]);

    useEffect(() => {
        if(bottlingCalcs.isGain) {
            setRemainderAction('gain');
        } else {
            if(remainderAction === 'gain') {
                setRemainderAction('keep');
            }
        }
    }, [bottlingCalcs.isGain, remainderAction]);

    const handleBottle = async () => {
        setFormError('');
        if (!bottlingCalcs.isValid) {
             setFormError("Please enter a valid number of bottles.");
             return;
        }

        const batch = writeBatch(db);
        const containerRef = doc(db, `artifacts/${appId}/users/${userId}/spiritInventory`, container.id);
        const logCollRef = collection(db, `artifacts/${appId}/users/${userId}/transactionLog`);
        
        if (bottlingCalcs.isGain) {
            const emptyLog = {
                type: "BOTTLE_EMPTY", containerId: container.id, containerName: container.name, productType, proof,
                netWeightLbsChange: -initialNetWeightLbs,
                proofGallonsChange: -initialProofGallons,
                notes: `Bottled ${numBottles} x ${bottleSizeMl}mL. Container emptied with gain.`
            };
            batch.set(doc(logCollRef), {...emptyLog, timestamp: serverTimestamp()});

            const wgGain = -bottlingCalcs.finalWg;
            const pgGain = wgGain * (proof / 100);
            const lbsGain = wgGain * spiritDensity;

            const gainLog = {
                type: "BOTTLING_GAIN", containerId: container.id, containerName: container.name, productType, proof,
                netWeightLbsChange: lbsGain,
                proofGallonsChange: pgGain,
                notes: `Gain of ${wgGain.toFixed(3)} WG recorded during bottling.`
            };
            batch.set(doc(logCollRef), {...gainLog, timestamp: serverTimestamp()});

            const emptyFill = calculateDerivedValuesFromWeight(tareWeightLbs, tareWeightLbs, 0);
            const finalUpdate = {
                status: 'empty',
                currentFill: { ...currentFill, ...emptyFill, fillDate: null, proof: 0, productType: productType, emptiedDate: new Date().toISOString().split('T')[0] }
            };
            batch.update(containerRef, finalUpdate);

        } else {
            const bottlingLog = {
                type: "BOTTLE_PARTIAL", containerId: container.id, containerName: container.name, productType, proof,
                netWeightLbsChange: -bottlingCalcs.lbsBottled,
                proofGallonsChange: -bottlingCalcs.pgBottled,
                notes: `Bottled ${numBottles} x ${bottleSizeMl}mL units.`
            };
            batch.set(doc(logCollRef), {...bottlingLog, timestamp: serverTimestamp()});
            
            if (remainderAction === 'keep') {
                const newGross = (currentFill.grossWeightLbs || tareWeightLbs) - bottlingCalcs.lbsBottled;
                const finalCalcs = calculateDerivedValuesFromWeight(tareWeightLbs, newGross, proof);
                batch.update(containerRef, { "currentFill": {...currentFill, ...finalCalcs} });
            } else {
                if (remainderAction === 'loss') {
                    const lossLog = {
                        type: "BOTTLING_LOSS", containerId: container.id, containerName: container.name, productType, proof,
                        netWeightLbsChange: - (initialNetWeightLbs - bottlingCalcs.lbsBottled),
                        proofGallonsChange: - (initialProofGallons - bottlingCalcs.pgBottled),
                        notes: `Remainder of ${bottlingCalcs.finalWg.toFixed(3)} WG written off as loss.`
                    };
                    batch.set(doc(logCollRef), {...lossLog, timestamp: serverTimestamp()});
                } else if (remainderAction === 'adjust') {
                    const adjAmt = parseFloat(adjustmentAmount);
                    if(isNaN(adjAmt) || adjAmt < 0) {
                        setFormError("Please enter a valid, positive number for the adjustment.");
                        return;
                    }
                    const adjSign = adjustmentType === 'loss' ? -1 : 1;
                    const adjWg = adjAmt * adjSign;
                    const adjPg = adjWg * (proof / 100);
                    const adjLbs = adjWg * spiritDensity;

                    const adjLog = {
                        type: adjustmentType === 'loss' ? "BOTTLING_LOSS" : "BOTTLING_GAIN", containerId: container.id, containerName: container.name, productType, proof,
                        netWeightLbsChange: adjLbs,
                        proofGallonsChange: adjPg,
                        notes: `Manual bottling ${adjustmentType}: ${adjAmt.toFixed(3)} WG.`
                    };
                     batch.set(doc(logCollRef), {...adjLog, timestamp: serverTimestamp()});
                }

                const emptyFill = calculateDerivedValuesFromWeight(tareWeightLbs, tareWeightLbs, 0);
                const finalUpdate = {
                    status: 'empty',
                    currentFill: { ...currentFill, ...emptyFill, fillDate: null, proof: 0, productType: productType, emptiedDate: new Date().toISOString().split('T')[0] }
                };
                 batch.update(containerRef, finalUpdate);
            }
        }

        try { await batch.commit(); setErrorApp(''); onClose(); }
        catch(err) { console.error("Bottling error:", err); setFormError("Failed to save changes: " + err.message); setErrorApp("Bottling failed."); }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl mb-4 font-semibold text-sky-300">Bottle From: {container.name}</h2>
                {formError && <div className="bg-red-600 p-3 rounded mb-4 text-sm">{formError}</div>}
                <div className="space-y-4">
                    <p className="text-sm text-gray-400"><strong>Available:</strong> {initialWineGallons.toFixed(3)} WG @ {proof} Proof</p>
                    <div className="grid grid-cols-2 gap-4 p-4 border border-gray-700 rounded-lg">
                        <div>
                            <label htmlFor="bottleSize" className="block text-sm font-medium text-gray-300">Bottle Size</label>
                            <select id="bottleSize" value={bottleSizeMl} onChange={(e) => setBottleSizeMl(e.target.value)} className="w-full bg-gray-700 p-2 rounded mt-1">
                                {BOTTLE_SIZES_ML.map(size => <option key={size.value} value={size.value}>{size.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="numBottles" className="block text-sm font-medium text-gray-300">Number of Bottles</label>
                            <input type="number" id="numBottles" value={numBottles} onChange={(e) => setNumBottles(e.target.value)} placeholder="e.g., 120" className="w-full bg-gray-700 p-2 rounded mt-1" step="1" min="0"/>
                        </div>
                    </div>

                    {bottlingCalcs.isValid && (
                        <div className="bg-gray-700 p-3 rounded text-sm">
                            <p><strong>Bottled Volume:</strong> {bottlingCalcs.wgBottled.toFixed(3)} WG / {bottlingCalcs.pgBottled.toFixed(3)} PG</p>
                            {bottlingCalcs.isGain ? (
                                 <p className="font-semibold text-green-400">Calculated Gain: {(-bottlingCalcs.finalWg).toFixed(3)} WG / {(-bottlingCalcs.finalWg * (proof/100)).toFixed(3)} PG</p>
                            ) : (
                                 <p><strong>Expected Remainder:</strong> <span className="font-semibold text-sky-300">{bottlingCalcs.finalWg.toFixed(3)} WG / {(bottlingCalcs.finalWg * (proof/100)).toFixed(3)} PG</span></p>
                            )}
                        </div>
                    )}
                    
                    <div className="p-4 border border-gray-700 rounded-lg">
                        <h4 className="text-md font-semibold text-gray-300 mb-2">Finalize Container</h4>
                        {bottlingCalcs.isGain ? (
                             <p className="text-sm text-green-400 bg-green-900/50 p-2 rounded">Container will be emptied and a gain of {(-bottlingCalcs.finalWg).toFixed(3)} WG will be recorded.</p>
                        ) : (
                            <div className="space-y-2">
                                <label className="flex items-center space-x-2"><input type="radio" name="remainderAction" value="keep" checked={remainderAction === 'keep'} onChange={(e) => setRemainderAction(e.target.value)} className="form-radio text-sky-500" /><span>Keep remainder in container</span></label>
                                <label className="flex items-center space-x-2"><input type="radio" name="remainderAction" value="loss" checked={remainderAction === 'loss'} onChange={(e) => setRemainderAction(e.target.value)} className="form-radio text-sky-500" /><span>Empty and record remainder as loss</span></label>
                                <label className="flex items-center space-x-2"><input type="radio" name="remainderAction" value="adjust" checked={remainderAction === 'adjust'} onChange={(e) => setRemainderAction(e.target.value)} className="form-radio text-sky-500" /><span>Empty and manually record Loss/Gain</span></label>
                            </div>
                        )}

                        {remainderAction === 'adjust' && !bottlingCalcs.isGain && (
                            <div className="mt-3 pt-3 border-t border-gray-600 grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="adjustmentType" className="block text-xs font-medium text-gray-400">Adjustment Type</label>
                                    <select id="adjustmentType" value={adjustmentType} onChange={e => setAdjustmentType(e.target.value)} className="w-full bg-gray-600 p-2 rounded mt-1 text-sm">
                                        <option value="loss">Bottling Loss</option>
                                        <option value="gain">Bottling Gain</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="adjustmentAmount" className="block text-xs font-medium text-gray-400">Amount (Wine Gallons)</label>
                                    <div className="flex items-center space-x-2">
                                        <input type="number" id="adjustmentAmount" value={adjustmentAmount} onChange={e => setAdjustmentAmount(e.target.value)} className="w-full bg-gray-600 p-2 rounded mt-1 text-sm" step="0.001" min="0" />
                                        <span className="text-xs text-gray-400 whitespace-nowrap">({manualAdjustmentCalcs.pg.toFixed(3)} PG)</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-3">
                        <button type="button" onClick={onClose} className="bg-gray-600 py-2 px-4 rounded">Cancel</button>
                        <button onClick={handleBottle} disabled={!bottlingCalcs.isValid} className="bg-sky-600 py-2 px-4 rounded disabled:bg-sky-800 disabled:cursor-not-allowed">Confirm Bottling</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- ManageProductsModal ---
const ManageProductsModal = ({ db, userId, appId, currentProducts, inventory, onDeletePrompt, onClose, setErrorApp }) => {
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

// --- ViewLogModal ---
const ViewLogModal = ({ transactionLog, isLoadingLog, onClose }) => {
    const handleExportLog = () => { const headers = ["Timestamp", "Type", "Container Name", "Container ID", "Product Type", "Proof", "Net Wt Change (lbs)", "PG Change", "Source Container", "Dest. Container", "Notes"]; const data = transactionLog.map(log => [ log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'N/A', log.type||'N/A', log.containerName||'N/A', log.containerId||'N/A', log.productType||'N/A', log.proof||0, log.netWeightLbsChange?.toFixed(2)||0, log.proofGallonsChange?.toFixed(3)||0, log.sourceContainerName||(log.type==='TRANSFER_IN'?log.sourceContainerId:'N/A'), log.destinationContainerName||(log.type==='TRANSFER_OUT'?log.destinationContainerId:'N/A'), log.notes||'' ]); const csvString = convertToCSV(data, headers); downloadCSV(csvString, `transaction_log_${new Date().toISOString().split('T')[0]}.csv`); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-semibold text-blue-300">Transaction Log</h2>
                    <button onClick={handleExportLog} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md shadow-md text-sm">Export Log CSV</button>
                </div>
                {isLoadingLog && <p className="text-center text-gray-400">Loading log...</p>}
                {!isLoadingLog && transactionLog.length === 0 && <p className="text-center text-gray-400">No transactions recorded yet.</p>}
                {!isLoadingLog && transactionLog.length > 0 && (
                    <div className="overflow-x-auto flex-grow rounded-md border border-gray-700">
                        <table className="min-w-full divide-y divide-gray-700 text-sm">
                            <thead className="bg-gray-750 sticky top-0 z-10">
                                <tr>
                                    {["Date", "Type", "Container", "Product", "Proof", "Net Wt Δ", "PG Δ", "Notes/Xfer"].map(header => (
                                        <th key={header} className="px-4 py-2 text-left font-medium text-gray-300 tracking-wider whitespace-nowrap bg-gray-750">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-gray-800 divide-y divide-gray-700">
                                {transactionLog.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-700">
                                        <td className="px-4 py-2 whitespace-nowrap text-gray-400">{log.timestamp?.toDate?log.timestamp.toDate().toLocaleString():'N/A'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-gray-300">{log.type||'N/A'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-gray-300" title={log.containerId}>{log.containerName||'N/A'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-gray-300">{log.productType||'N/A'}</td>
                                        <td className="px-4 py-2 whitespace-nowrap text-gray-300">{log.proof||0}</td>
                                        <td className={`px-4 py-2 whitespace-nowrap ${log.netWeightLbsChange > 0 ? 'text-green-400' : (log.netWeightLbsChange < 0 ? 'text-red-400' : 'text-gray-300')}`}>{log.netWeightLbsChange?.toFixed(2) || 0}</td>
                                        <td className={`px-4 py-2 whitespace-nowrap ${log.proofGallonsChange > 0 ? 'text-green-400' : (log.proofGallonsChange < 0 ? 'text-red-400' : 'text-gray-300')}`}>{log.proofGallonsChange?.toFixed(3) || 0}</td>
                                        <td className="px-4 py-2 text-gray-400 text-xs max-w-xs truncate" title={ (log.type === "TRANSFER_OUT" && `To: ${log.destinationContainerName || log.destinationContainerId}`) || (log.type === "TRANSFER_IN" && `From: ${log.sourceContainerName || log.sourceContainerId}`) || (log.notes || '')}>
                                            {log.type === "TRANSFER_OUT" && `To: ${log.destinationContainerName || log.destinationContainerId}`}
                                            {log.type === "TRANSFER_IN" && `From: ${log.sourceContainerName || log.sourceContainerId}`}
                                            {log.notes && <span> {log.notes}</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="mt-6 flex justify-end">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md">Close</button>
                </div>
            </div>
        </div>
    );
};

// --- ConfirmationModal ---
const ConfirmationModal = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"><div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md"><h3 className="text-lg font-semibold text-yellow-300 mb-4">Confirm Action</h3><p className="text-gray-300 mb-6">{message}</p><div className="flex justify-end space-x-3"><button type="button" onClick={onCancel} className="bg-gray-600 py-2 px-4 rounded">Cancel</button><button type="button" onClick={onConfirm} className="bg-red-600 py-2 px-4 rounded">Confirm</button></div></div></div>
);

// --- ImportContainersModal (HEAVILY REVISED) ---
const ImportContainersModal = ({ db, userId, appId, existingContainers, products, onClose, setErrorApp }) => {
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

// --- TtbReportModal (ENHANCED) ---
const TtbReportModal = ({ transactionLog, onClose }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [report, setReport] = useState(null);

    const generateReport = () => {
        if (!startDate || !endDate) { setReport(null); return; }
        const start = new Date(startDate); const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        const filteredLogs = transactionLog.filter(log => { const logDate = log.timestamp?.toDate(); return logDate && logDate >= start && logDate <= end; });

        const summary = {
            production: { spiritsProduced: 0 },
            processing: { transferredFromStorage: 0, bottlingDump: 0, bottlingGain: 0, bottlingLoss: 0, operationalLoss: 0, transferredToStorage: 0 },
            storage: { transferredIn: 0, transferredOut: 0, storageLosses: 0 }
        };

        filteredLogs.forEach(log => {
            const pg = log.proofGallonsChange || 0;
            switch(log.type) {
                case 'PRODUCTION': case 'DISTILLATION_FINISH': summary.production.spiritsProduced += pg; break;
                case 'TRANSFER_OUT': summary.processing.transferredToStorage += Math.abs(pg); summary.storage.transferredOut += Math.abs(pg); break;
                case 'TRANSFER_IN': summary.processing.transferredFromStorage += pg; summary.storage.transferredIn += pg; break;
                case 'BOTTLE_PARTIAL': case 'BOTTLE_EMPTY': summary.processing.bottlingDump += Math.abs(pg); break;
                case 'BOTTLING_GAIN': summary.processing.bottlingGain += pg; break;
                case 'BOTTLING_LOSS': summary.processing.bottlingLoss += Math.abs(pg); break;
                case 'SAMPLE_ADJUST': summary.processing.operationalLoss += Math.abs(pg); summary.storage.storageLosses += Math.abs(pg); break;
                default: break;
            }
        });
        setReport(summary);
    };
    
    const handleExport = () => {
        if(!report) return;
        const headers = ["TTB Form", "Part", "Line", "Description", "Proof Gallons (PG)"];
        const data = [
            ["Production Report (TTB F 5110.40)", "Part I", "2", "Spirits produced by distillation", report.production.spiritsProduced.toFixed(3)],
            ["Processing Report (TTB F 5110.28)", "Part I", "3", "Spirits received from storage", report.processing.transferredFromStorage.toFixed(3)],
            ["Processing Report (TTB F 5110.28)", "Part II", "20", "Spirits dumped for bottling", report.processing.bottlingDump.toFixed(3)],
            ["Processing Report (TTB F 5110.28)", "Part II", "26", "Bottling gains", report.processing.bottlingGain.toFixed(3)],
            ["Processing Report (TTB F 5110.28)", "Part II", "27", "Bottling losses", report.processing.bottlingLoss.toFixed(3)],
            ["Processing Report (TTB F 5110.28)", "Part II", "28", "Losses from dumping, mingling, etc.", report.processing.operationalLoss.toFixed(3)],
            ["Storage Report (TTB F 5110.11)", "Part I", "2", "Spirits transferred in", report.storage.transferredIn.toFixed(3)],
            ["Storage Report (TTB F 5110.11)", "Part II", "17", "Spirits transferred out", report.storage.transferredOut.toFixed(3)],
            ["Storage Report (TTB F 5110.11)", "Part II", "18", "Losses (e.g., from samples, aging)", report.storage.storageLosses.toFixed(3)],
        ];
        const csvString = convertToCSV(data, headers);
        downloadCSV(csvString, `ttb_correlated_summary_${startDate}_to_${endDate}.csv`);
    };
    
    const ReportSection = ({ title, children }) => ( <div className="bg-gray-800 p-4 rounded-lg border border-gray-700"><h3 className="text-xl font-semibold text-blue-300 mb-3">{title}</h3><div className="space-y-2">{children}</div></div> );
    const ReportRow = ({ form, part, line, description, value }) => ( <div className="grid grid-cols-12 gap-2 items-center text-sm hover:bg-gray-700/50 p-1 rounded"><div className="col-span-7 text-gray-300">{description}</div><div className="col-span-3 text-gray-400 text-xs text-right" title={`${form} - Part ${part}, Line ${line}`}>{form}, L {line}</div><div className="col-span-2 text-right font-mono text-blue-300">{value.toFixed(3)}</div></div> );

    return(
         <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-850 p-6 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                <h2 className="text-2xl mb-4 font-semibold text-blue-300">TTB Monthly Report Correlator</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
                    <div><label htmlFor="startDate" className="block text-sm font-medium text-gray-300">Start Date</label><input type="date" id="startDate" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full bg-gray-700 p-2 rounded"/></div>
                    <div><label htmlFor="endDate" className="block text-sm font-medium text-gray-300">End Date</label><input type="date" id="endDate" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full bg-gray-700 p-2 rounded"/></div>
                    <button onClick={generateReport} disabled={!startDate || !endDate} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md h-10 disabled:bg-gray-500 disabled:cursor-not-allowed">Generate Report</button>
                </div>
                <div className="flex-grow overflow-y-auto space-y-4 pr-2">
                    {!report ? ( <div className="text-center text-gray-500 pt-10">Please select a date range to generate the report.</div> ) : (
                        <>
                            <ReportSection title="Production Operations (TTB F 5110.40)"><ReportRow form="F5110.40" part="I" line="2" description="Spirits produced by distillation" value={report.production.spiritsProduced} /></ReportSection>
                            <ReportSection title="Processing Operations (TTB F 5110.28)">
                                 <ReportRow form="F5110.28" part="I" line="3" description="Spirits received from storage" value={report.processing.transferredFromStorage} />
                                 <hr className="border-gray-600 my-2" />
                                 <ReportRow form="F5110.28" part="II" line="20" description="Spirits dumped for bottling" value={report.processing.bottlingDump} />
                                 <ReportRow form="F5110.28" part="II" line="26" description="Bottling gains" value={report.processing.bottlingGain} />
                                 <ReportRow form="F5110.28" part="II" line="27" description="Bottling losses" value={report.processing.bottlingLoss} />
                                 <ReportRow form="F5110.28" part="II" line="28" description="Operational losses (samples, etc.)" value={report.processing.operationalLoss} />
                            </ReportSection>
                            <ReportSection title="Storage Operations (TTB F 5110.11)">
                                 <ReportRow form="F5110.11" part="I" line="2" description="Spirits transferred in" value={report.storage.transferredIn} />
                                 <hr className="border-gray-600 my-2" />
                                 <ReportRow form="F5110.11" part="II" line="17" description="Spirits transferred out (to Processing)" value={report.storage.transferredOut} />
                                 <ReportRow form="F5110.11" part="II" line="18" description="Storage losses (aging, samples)" value={report.storage.storageLosses} />
                            </ReportSection>
                        </>
                    )}
                </div>
                <div className="flex justify-between items-center pt-4 mt-auto border-t border-gray-700">
                    <button type="button" onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md">Close</button>
                    {report && <button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-md text-sm">Export Correlated CSV</button>}
                </div>
            </div>
        </div>
    );
};

// --- NEW Production Components ---
const ProductionView = ({ batches, isLoading, onAddBatch, onEditBatch, onDeleteBatch }) => {
    const fermentations = useMemo(() => batches.filter(b => b.batchType === 'fermentation').sort((a,b) => new Date(b.startDate) - new Date(a.startDate)), [batches]);
    const distillations = useMemo(() => batches.filter(b => b.batchType === 'distillation').sort((a,b) => new Date(b.date) - new Date(a.date)), [batches]);

    return (
        <div className="space-y-8">
            <div className="flex justify-center gap-4 mb-6">
                <button onClick={() => onAddBatch('fermentation')} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md">New Fermentation</button>
                <button onClick={() => onAddBatch('distillation')} className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md">New Distillation</button>
            </div>

            {isLoading && <div className="text-center p-8">Loading Production Batches...</div>}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ProductionList title="Fermentations" batches={fermentations} onEdit={onEditBatch} onDelete={onDeleteBatch} />
                <ProductionList title="Distillations" batches={distillations} onEdit={onEditBatch} onDelete={onDeleteBatch} />
            </div>
        </div>
    );
};

const ProductionList = ({ title, batches, onEdit, onDelete }) => (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
        <h2 className="text-2xl font-bold text-blue-300 mb-4">{title}</h2>
        {batches.length === 0 ? <p className="text-gray-500">No {title.toLowerCase()} recorded.</p> : (
            <div className="space-y-4">
                {batches.map(batch => (
                    <div key={batch.id} className="bg-gray-750 p-4 rounded-lg border border-gray-600">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-lg text-gray-200">{batch.name}</h3>
                                <p className="text-sm text-gray-400">{batch.batchType === 'fermentation' ? `Started: ${batch.startDate}` : `Date: ${batch.date}`}</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => onEdit(batch)} className="text-xs text-blue-400 hover:underline">EDIT</button>
                                <button onClick={() => onDelete(batch)} className="text-xs text-red-500 hover:underline">DELETE</button>
                            </div>
                        </div>
                        <div className="text-sm mt-3 space-y-1 text-gray-300">
                            {batch.batchType === 'fermentation' ? (
                                <>
                                    <p><strong>Volume:</strong> {batch.startVolume} gal</p>
                                    <p><strong>Gravity:</strong> {batch.og} OG → {batch.fg} FG</p>
                                </>
                            ) : (
                                <>
                                    <p><strong>Source:</strong> {batch.sourceBatchName || 'N/A'}</p>
                                    <p><strong>Output:</strong> {batch.volumeOut} gal @ {batch.proofOut} proof ({batch.proofGallonsOut?.toFixed(3)} PG)</p>
                                    <p><strong>Product:</strong> {batch.productType}</p>
                                </>
                            )}
                            {batch.notes && <p className="text-xs text-gray-400 pt-1 border-t border-gray-700 mt-2"><em>Notes: {batch.notes}</em></p>}
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const AddEditProductionModal = ({ db, userId, appId, batch, type, fermentations, products, onClose, setErrorApp }) => {
    const isEdit = !!batch;
    const [formData, setFormData] = useState({});
    const [formError, setFormError] = useState('');

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
                volumeIn: batch?.volumeIn || '',
                volumeOut: batch?.volumeOut || '',
                proofOut: batch?.proofOut || '',
                productType: batch?.productType || 'Low Wines',
                notes: batch?.notes || ''
            });
        }
    }, [batch, type]);

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        const dataToSave = { ...formData, batchType: type };
        
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
            
            // Log transaction for distillation finish
            if (type === 'distillation' && dataToSave.volumeOut > 0 && dataToSave.proofOut > 0) {
                const pg = (parseFloat(dataToSave.volumeOut) * (parseFloat(dataToSave.proofOut) / 100));
                const logData = {
                    type: "DISTILLATION_FINISH",
                    batchId: docRef.id,
                    batchName: dataToSave.name,
                    productType: dataToSave.productType,
                    proof: parseFloat(dataToSave.proofOut),
                    proofGallonsChange: pg,
                    notes: `Produced ${pg.toFixed(3)} PG of ${dataToSave.productType}.`
                };
                const logCollRef = collection(db, `artifacts/${appId}/users/${userId}/transactionLog`);
                batchRef.set(doc(logCollRef), {...logData, timestamp: serverTimestamp()});
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
                            </select>
                            <div className="grid grid-cols-2 gap-4">
                                <input name="volumeIn" type="number" value={formData.volumeIn || ''} onChange={handleChange} placeholder="Volume In (gal)" className="w-full bg-gray-700 p-2 rounded"/>
                                <input name="volumeOut" type="number" value={formData.volumeOut || ''} onChange={handleChange} placeholder="Volume Out (gal)" className="w-full bg-gray-700 p-2 rounded"/>
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <input name="proofOut" type="number" step="0.1" value={formData.proofOut || ''} onChange={handleChange} placeholder="Output Proof" className="w-full bg-gray-700 p-2 rounded"/>
                                <select name="productType" value={formData.productType || ''} onChange={handleChange} className="w-full bg-gray-700 p-2 rounded">
                                     {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                                </select>
                            </div>
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

export default App;
