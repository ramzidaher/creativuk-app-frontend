# API Endpoint Summary - Calculator Flow

## Overview

This document summarizes which API endpoints are called at each step of the calculator flow.

---

## Flow Summary

### Step 1: Template Selection
- **Screen:** `TemplateSelectionScreen.tsx` (Off-Peak) or `FluxTemplateSelectionScreen.tsx` (Flux)
- **Action:** User selects template and clicks "Continue"
- **API Call:** `POST /calculator-progress/save`
- **Purpose:** Save template selection to JSON
- **Status:** ✅ No COM call - JSON only

---

### Step 2: Customer Details
- **Screen:** `CustomerDetailsScreen.tsx`
- **Action:** User enters customer details and clicks "Confirm"
- **API Call:** `POST /calculator-progress/save`
- **Purpose:** Save customer details to JSON
- **Status:** ✅ No COM call - JSON only

---

### Step 3: Radio Button Selection
- **Screen:** `CalculatorScreen.tsx` (Off-Peak) or `EPVSRadioButtonScreen.tsx` (Flux)
- **Action:** User selects radio buttons and clicks "Apply Selections"
- **API Call:** `POST /calculator-progress/save`
- **Purpose:** Save radio button selections to JSON
- **Status:** ✅ No COM call - JSON only

---

### Step 4: Dynamic Inputs
- **Screen:** `DynamicInputsScreen.tsx` (Off-Peak) or `EPVSDynamicInputsScreen.tsx` (Flux)
- **Action:** User fills dynamic inputs and clicks "Save & Calculate"
- **API Call:** `POST /calculator-progress/save`
- **Purpose:** Save dynamic inputs to JSON
- **Status:** ✅ No COM call - JSON only

---

### Step 5: Solar Arrays (Flux only)
- **Screen:** `SolarArraysInputsScreen.tsx`
- **Action:** User fills array details and clicks "Save"
- **API Call:** `POST /calculator-progress/save`
- **Purpose:** Save arrays data to JSON
- **Status:** ✅ No COM call - JSON only

---

### Step 6: Pricing
- **Screen:** `PricingScreen.tsx`
- **Action:** User selects pricing options and clicks **"Save & Submit"**
- **API Calls:** 
  1. `POST /calculator-progress/save` - Save pricing data to JSON
  2. `POST /calculator-progress/submit` ⚠️ **THIS IS THE SUBMIT ENDPOINT**
- **Purpose:** 
  1. Save pricing data to JSON
  2. Trigger single COM operation to create Excel file with all calculator data
- **Status:** ✅ Calls submit endpoint - triggers COM operations
- **Note:** The "Save & Submit" button now both saves to JSON AND submits to Excel, creating the final Excel file.

---

### Step 7: Payment (ALTERNATIVE SUBMISSION POINT)
- **Screen:** `PaymentScreen.tsx`
- **Action:** User clicks **"Mark Payment Complete & Continue"**
- **API Call:** `POST /calculator-progress/submit` ⚠️ **ALTERNATIVE SUBMIT ENDPOINT CALL**
- **Purpose:** 
  1. Retrieves all saved JSON progress data
  2. Fetches Flux rates from Octopus API (for Flux/EPVS)
  3. Performs **single COM operation** to create Excel file with all data
- **Status:** ✅ **Calls submit endpoint - triggers COM operations**
- **Note:** Submit can also happen from PricingScreen (step 6). PaymentScreen is an alternative entry point for submit if user navigates directly to it.

---

## Submit Endpoint Details

### Endpoint
```
POST /calculator-progress/submit
```

### Request Body
```json
{
  "userId": "66cda752-feda-4d37-a291-67aaab9e92f1",
  "opportunityId": "ZXVh7ONnuHGMpIHnpKZM",
  "calculatorType": "flux" // or "off-peak" or "epvs"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Calculator submitted successfully",
  "filePath": "C:\\Users\\Creativuk\\creativ-solar-app\\apps\\backend\\src\\excel-file-calculator\\epvs-opportunities\\ZXVh7ONnuHGMpIHnpKZM.xlsm"
}
```

### Response (Error)
```json
{
  "success": false,
  "message": "Error message here",
  "error": "Detailed error message"
}
```

### What the Submit Endpoint Does

1. **Retrieves saved JSON progress data** from database
2. **Fetches Flux rates** from Octopus API (for Flux/EPVS calculators)
3. **Transforms and combines all data:**
   - Customer details
   - Radio button selections
   - Dynamic inputs
   - Arrays data (if applicable)
   - Pricing data
   - Flux rates (if applicable)
4. **Performs single COM operation** that:
   - Creates Excel file from template
   - Adds customer details
   - Selects radio buttons
   - Saves all dynamic inputs
   - Saves arrays (with VBA triggering)
   - Saves pricing data
   - Saves Flux rates (if applicable)
5. **Returns file path** of created Excel file

### Backend Routing

The `/calculator-progress/submit` endpoint automatically routes to the correct automation service based on `calculatorType`:

- **`calculatorType: 'off-peak'`** → Routes to `ExcelAutomationService.performCompleteCalculation()`
- **`calculatorType: 'flux' | 'epvs'`** → Routes to `EPVSAutomationService.performCompleteCalculation()`

---

## Code References

### PaymentScreen Implementation
```typescript
// Location: src/screens/PaymentScreen.tsx
// Function: handlePaymentCompleted()

const submitResult = await CalculatorProgressService.submitCalculator(
  opportunityId,
  effectiveCalculatorType
);
```

### CalculatorProgressService Implementation
```typescript
// Location: src/services/CalculatorProgressService.ts
// Function: submitCalculator()

async submitCalculator(
  opportunityId: string,
  calculatorType: 'off-peak' | 'flux' | 'epvs'
): Promise<{ success: boolean; message: string; filePath?: string }> {
  const response = await api.post('/calculator-progress/submit', {
    userId,
    opportunityId,
    calculatorType: normalizedCalculatorType,
  });
  // ... handle response
}
```

---

## Important Notes

1. **Only PaymentScreen calls the submit endpoint** - All other screens only save to JSON
2. **Submit endpoint triggers COM operations** - This is the only step that interacts with Excel via COM
3. **All previous steps save to JSON only** - No COM calls until final submit
4. **Calculator type is determined** - PaymentScreen determines calculator type from route params or saved progress
5. **Single COM operation** - All Excel updates happen in one batch operation during submit

---

## Verification

To verify the submit endpoint is being called:

1. Open browser DevTools Console
2. Navigate to PaymentScreen
3. Click "Mark Payment Complete & Continue"
4. Look for these log messages:
   - `🔄 Submitting calculator to Excel (single COM call):`
   - `📤 Calling submit endpoint: POST /calculator-progress/submit`
   - `📥 Submit endpoint response received:`
   - `✅ Calculator submitted successfully to Excel:`

If these logs appear, the submit endpoint is being called correctly.

