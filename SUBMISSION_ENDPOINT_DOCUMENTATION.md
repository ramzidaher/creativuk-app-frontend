# Calculator Submission Endpoint Documentation

## Frontend Implementation

### Endpoint Usage

**Service:** `CalculatorProgressService.submitCalculator()`

**Location:** `src/services/CalculatorProgressService.ts`

**Method Signature:**
```typescript
async submitCalculator(
  opportunityId: string,
  calculatorType: 'off-peak' | 'flux' | 'epvs'
): Promise<{ success: boolean; message: string; filePath?: string }>
```

### Request Details

**Endpoint:** `POST /calculator-progress/submit`

**Request Body:**
```typescript
{
  userId: string;           // Retrieved automatically from auth
  opportunityId: string;    // Passed as parameter
  calculatorType: string;  // 'off-peak' | 'flux' (epvs normalized to flux)
}
```

**Example Request:**
```json
{
  "userId": "66cda752-feda-4d37-a291-67aaab9e92f1",
  "opportunityId": "ZXVh7ONnuHGMpIHnpKZM",
  "calculatorType": "flux"
}
```

### Response Handling

**Success Response (Backend):**
```json
{
  "success": true,
  "message": "Calculator submitted successfully",
  "filePath": "C:\\Users\\Creativuk\\creativ-solar-app\\apps\\backend\\src\\excel-file-calculator\\epvs-opportunities\\ZXVh7ONnuHGMpIHnpKZM.xlsm"
}
```

**Success Response (Frontend receives):**
```typescript
{
  success: true,
  message: "Calculator submitted successfully",
  filePath: "C:\\Users\\Creativuk\\..."
}
```

**Error Response (Backend):**
```json
{
  "success": false,
  "message": "Error message here",
  "error": "Error details"
}
```

**Error Response (Frontend receives):**
```typescript
{
  success: false,
  message: "Error message here" // Uses message or error field
}
```

### Usage in PaymentScreen

**Location:** `src/screens/PaymentScreen.tsx`

**Code:**
```typescript
// Submit calculator to Excel (triggers single COM call with all saved JSON data)
const submitResult = await CalculatorProgressService.submitCalculator(
  opportunityId,
  effectiveCalculatorType
);

if (!submitResult.success) {
  Alert.alert('⚠️ Submission Failed', submitResult.message);
  return;
}

// Success - file path available in submitResult.filePath
console.log('✅ Calculator submitted successfully:', submitResult.filePath);
```

### Backend Routing

The backend automatically routes based on `calculatorType`:

- **`calculatorType: 'off-peak'`** → Routes to `ExcelAutomationService.performCompleteCalculation()`
- **`calculatorType: 'flux' | 'epvs'`** → Routes to `EPVSAutomationService.performCompleteCalculation()`

### What the Backend Does

1. **Retrieves saved JSON progress data** from database
2. **Fetches Flux rates** from Octopus API (for Flux/EPVS calculators)
3. **Transforms and combines all data:**
   - Customer details
   - Radio button selections
   - Dynamic inputs
   - Arrays data
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

### Error Handling

The frontend handles errors at multiple levels:

1. **API call errors** (network, authentication, etc.)
2. **Backend response errors** (`success: false`)
3. **Navigation errors** (if navigation fails after submission)

All errors are logged and displayed to the user via Alert dialogs.

### Implementation Status

✅ **Frontend is fully implemented and matches backend expectations:**

- ✅ Correct endpoint: `/calculator-progress/submit`
- ✅ Correct request body: `userId`, `opportunityId`, `calculatorType`
- ✅ Correct response handling: Checks `success`, extracts `message` and `filePath`
- ✅ Error handling: Handles both API errors and backend errors
- ✅ Type normalization: `epvs` normalized to `flux` before sending
- ✅ Logging: Comprehensive logging for debugging
- ✅ User feedback: Alert dialogs for success/error states

The frontend is ready to work with the backend submission endpoint.

