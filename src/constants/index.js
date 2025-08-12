// --- Constants ---
export const DENSITY_ETHANOL_LBS_PER_GALLON = 6.58; // Updated to correct value at 20°C
export const DENSITY_WATER_LBS_PER_GALLON = 8.328;
export const ML_PER_GALLON = 3785.41;
export const APP_NAME = "Foggy Mountain Spirit Inventory";
export const DEFAULT_PRODUCTS = [
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
export const CONTAINER_CAPACITIES_GALLONS = {
    wooden_barrel: 53,
    metal_drum: 55,
    square_tank: 275,
    tote: 250,
    five_gallon_tote: 5,
    still: 100,
    fermenter: 500, // Added for production tracking
};
export const BOTTLE_SIZES_ML = [
    { name: '750 mL (Standard)', value: 750 },
    { name: '375 mL (Half)', value: 375 },
    { name: '1.75 L (Handle)', value: 1750 },
    { name: '1.0 L (Liter)', value: 1000 },
    { name: '50 mL (Mini)', value: 50 },
];

// Transaction Types - Used throughout the application for consistency
export const TRANSACTION_TYPES = {
    // Container Operations
    CREATE_EMPTY_CONTAINER: "CREATE_EMPTY_CONTAINER",
    CREATE_FILLED_CONTAINER: "CREATE_FILLED_CONTAINER",
    DELETE_EMPTY_CONTAINER: "DELETE_EMPTY_CONTAINER",
    DELETE_FILLED_CONTAINER: "DELETE_FILLED_CONTAINER",
    EDIT_EMPTY_DATA_CORRECTION: "EDIT_EMPTY_DATA_CORRECTION",
    EDIT_FILL_DATA_CORRECTION: "EDIT_FILL_DATA_CORRECTION",
    EDIT_FILL_FROM_EMPTY: "EDIT_FILL_FROM_EMPTY",
    EDIT_EMPTY_FROM_FILLED: "EDIT_EMPTY_FROM_FILLED",
    REFILL_CONTAINER: "REFILL_CONTAINER",
    
    // Transfers
    TRANSFER_IN: "TRANSFER_IN",
    TRANSFER_OUT: "TRANSFER_OUT",
    
    // Production
    PRODUCTION: "PRODUCTION",
    DISTILLATION_FINISH: "DISTILLATION_FINISH",
    
    // Adjustments
    SAMPLE_ADJUST: "SAMPLE_ADJUST",
    PROOF_DOWN: "PROOF_DOWN",
    
    // Bottling
    BOTTLE_PARTIAL: "BOTTLE_PARTIAL",
    BOTTLE_EMPTY: "BOTTLE_EMPTY",
    BOTTLING_GAIN: "BOTTLING_GAIN",
    BOTTLING_LOSS: "BOTTLING_LOSS",
    
    // Management
    DELETE_PRODUCT: "DELETE_PRODUCT",
    DELETE_PRODUCTION_BATCH: "DELETE_PRODUCTION_BATCH",
    CHANGE_ACCOUNT: "CHANGE_ACCOUNT"
};

// Undoable transaction types - subset that can be reversed
export const UNDOABLE_TRANSACTION_TYPES = [
    TRANSACTION_TYPES.TRANSFER_IN,
    TRANSACTION_TYPES.TRANSFER_OUT,
    TRANSACTION_TYPES.SAMPLE_ADJUST,
    TRANSACTION_TYPES.BOTTLE_PARTIAL,
    TRANSACTION_TYPES.BOTTLE_EMPTY,
    TRANSACTION_TYPES.BOTTLING_GAIN,
    TRANSACTION_TYPES.BOTTLING_LOSS,
    TRANSACTION_TYPES.PROOF_DOWN
];

export const LIQUID_FILL_COLOR = "rgba(96, 165, 250, 0.8)";
export const COPPER_COLOR_LIGHT = "#DA8A67";
export const COPPER_COLOR_DARK = "#B87333";
export const STEEL_COLOR_LIGHT = "#D3D3D3";
export const STEEL_COLOR_DARK = "#A9A9A9";

// TTB Gauging Table 1 - Temperature Correction Factors
// This is a simplified version of the TTB Table 1 for temperature corrections
// For production use, you should implement the full TTB tables
export const TTB_TEMPERATURE_CORRECTIONS = {
    // Temperature (°F) -> { observed_proof -> correction_factor }
    60: { 80: 0.2, 85: 0.3, 90: 0.4, 95: 0.5, 100: 0.6, 105: 0.7, 110: 0.8, 115: 0.9, 120: 1.0, 125: 1.1, 130: 1.2, 135: 1.3, 140: 1.4, 145: 1.5, 150: 1.6, 155: 1.7, 160: 1.8, 165: 1.9, 170: 2.0 },
    62: { 80: 0.1, 85: 0.2, 90: 0.3, 95: 0.4, 100: 0.5, 105: 0.6, 110: 0.7, 115: 0.8, 120: 0.9, 125: 1.0, 130: 1.1, 135: 1.2, 140: 1.3, 145: 1.4, 150: 1.5, 155: 1.6, 160: 1.7, 165: 1.8, 170: 1.9 },
    64: { 80: 0.0, 85: 0.1, 90: 0.2, 95: 0.3, 100: 0.4, 105: 0.5, 110: 0.6, 115: 0.7, 120: 0.8, 125: 0.9, 130: 1.0, 135: 1.1, 140: 1.2, 145: 1.3, 150: 1.4, 155: 1.5, 160: 1.6, 165: 1.7, 170: 1.8 },
    66: { 80: -0.1, 85: 0.0, 90: 0.1, 95: 0.2, 100: 0.3, 105: 0.4, 110: 0.5, 115: 0.6, 120: 0.7, 125: 0.8, 130: 0.9, 135: 1.0, 140: 1.1, 145: 1.2, 150: 1.3, 155: 1.4, 160: 1.5, 165: 1.6, 170: 1.7 },
    68: { 80: -0.2, 85: -0.1, 90: 0.0, 95: 0.1, 100: 0.2, 105: 0.3, 110: 0.4, 115: 0.5, 120: 0.6, 125: 0.7, 130: 0.8, 135: 0.9, 140: 1.0, 145: 1.1, 150: 1.2, 155: 1.3, 160: 1.4, 165: 1.5, 170: 1.6 },
    70: { 80: -0.3, 85: -0.2, 90: -0.1, 95: 0.0, 100: 0.1, 105: 0.2, 110: 0.3, 115: 0.4, 120: 0.5, 125: 0.6, 130: 0.7, 135: 0.8, 140: 0.9, 145: 1.0, 150: 1.1, 155: 1.2, 160: 1.3, 165: 1.4, 170: 1.5 },
    72: { 80: -0.4, 85: -0.3, 90: -0.2, 95: -0.1, 100: 0.0, 105: 0.1, 110: 0.2, 115: 0.3, 120: 0.4, 125: 0.5, 130: 0.6, 135: 0.7, 140: 0.8, 145: 0.9, 150: 1.0, 155: 1.1, 160: 1.2, 165: 1.3, 170: 1.4 },
    74: { 80: -0.5, 85: -0.4, 90: -0.3, 95: -0.2, 100: -0.1, 105: 0.0, 110: 0.1, 115: 0.2, 120: 0.3, 125: 0.4, 130: 0.5, 135: 0.6, 140: 0.7, 145: 0.8, 150: 0.9, 155: 1.0, 160: 1.1, 165: 1.2, 170: 1.3 },
    76: { 80: -0.6, 85: -0.5, 90: -0.4, 95: -0.3, 100: -0.2, 105: -0.1, 110: 0.0, 115: 0.1, 120: 0.2, 125: 0.3, 130: 0.4, 135: 0.5, 140: 0.6, 145: 0.7, 150: 0.8, 155: 0.9, 160: 1.0, 165: 1.1, 170: 1.2 },
    78: { 80: -0.7, 85: -0.6, 90: -0.5, 95: -0.4, 100: -0.3, 105: -0.2, 110: -0.1, 115: 0.0, 120: 0.1, 125: 0.2, 130: 0.3, 135: 0.4, 140: 0.5, 145: 0.6, 150: 0.7, 155: 0.8, 160: 0.9, 165: 1.0, 170: 1.1 },
    80: { 80: -0.8, 85: -0.7, 90: -0.6, 95: -0.5, 100: -0.4, 105: -0.3, 110: -0.2, 115: -0.1, 120: 0.0, 125: 0.1, 130: 0.2, 135: 0.3, 140: 0.4, 145: 0.5, 150: 0.6, 155: 0.7, 160: 0.8, 165: 0.9, 170: 1.0 }
};