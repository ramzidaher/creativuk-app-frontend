import { ApiResponse, OpportunitiesResponse } from '../types';
import { cache, CACHE_KEYS } from './cache';
import { API_BASE_URL } from './env';

console.log('Using API_BASE_URL:', API_BASE_URL);

// Helper function to construct proper URLs without double slashes
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${cleanEndpoint}`;
};

// Event system for token expiration
const tokenExpirationEvents = {
  listeners: [] as Array<() => void>,
  addListener: (callback: () => void) => {
    tokenExpirationEvents.listeners.push(callback);
  },
  removeListener: (callback: () => void) => {
    const index = tokenExpirationEvents.listeners.indexOf(callback);
    if (index > -1) {
      tokenExpirationEvents.listeners.splice(index, 1);
    }
  },
  trigger: () => {
    console.log('Token expired, triggering logout for all listeners');
    tokenExpirationEvents.listeners.forEach(callback => callback());
  }
};

export { tokenExpirationEvents };

// Import AsyncStorage for mobile compatibility
    import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage interface to handle both sync and async storage
interface StorageInterface {
  setItem(key: string, value: string): void | Promise<void>;
  getItem(key: string): string | null | Promise<string | null>;
  removeItem(key: string): void | Promise<void>;
}

// Use AsyncStorage for mobile and localStorage for web
export const getStorage = (): StorageInterface | null => {
  console.log('Storage: Determining storage type...');
  console.log('Storage: Window available:', typeof window !== 'undefined');
  console.log('Storage: Document available:', typeof document !== 'undefined');
  console.log('Storage: React Native environment:', typeof global !== 'undefined' && !!(global as any).__fbBatchedBridge);
  
  // Check if we're in React Native environment
  const isReactNative = typeof global !== 'undefined' && (global as any).__fbBatchedBridge;
  
  if (isReactNative) {
    console.log('Storage: Using AsyncStorage for React Native');
    return AsyncStorage;
  }
  
  // Check if we're in web environment
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    console.log('Storage: Using localStorage for web');
    return window.localStorage;
  }
  
  console.log('Storage: No storage available');
  return null;
};

// Auth API functions
export const authApi = {
  async login(username: string, password: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(buildApiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Login failed: ${errorText}`);
      }

      const data = await response.json();
      
      console.log('Auth: Login successful, storing tokens...');
      console.log('Auth: Access token length:', data.accessToken ? data.accessToken.length : 0);
      
      // Store tokens
      const storage = getStorage();
      console.log('Auth: Storage type:', typeof storage);
      console.log('Auth: Storage available:', !!storage);
      if (storage) {
        await storage.setItem('accessToken', data.accessToken);
        await storage.setItem('refreshToken', data.refreshToken);
        await storage.setItem('user', JSON.stringify(data.user));
        console.log('Auth: Tokens stored successfully');
      } else {
        console.log('Auth: No storage available');
      }

      return { data, success: true };
    } catch (error) {
      console.error('Auth API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async register(userData: {
    username: string;
    email: string;
    password: string;
    name: string;
    role: 'ADMIN' | 'SURVEYOR';
  }): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(buildApiUrl('/auth/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Registration failed: ${errorText}`);
      }

      const data = await response.json();
      
      // Store tokens
      const storage = getStorage();
      console.log('Auth: Register storage available:', !!storage);
      if (storage) {
        await storage.setItem('accessToken', data.accessToken);
        await storage.setItem('refreshToken', data.refreshToken);
        await storage.setItem('user', JSON.stringify(data.user));
        console.log('Auth: Register tokens stored successfully');
      } else {
        console.log('Auth: Register - No storage available');
      }

      return { data, success: true };
    } catch (error) {
      console.error('Auth API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getProfile(): Promise<ApiResponse<any>> {
    return api.get<any>('/auth/profile');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<any>> {
    return api.put<any>('/auth/change-password', { currentPassword, newPassword });
  },

  async resetPassword(email: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(buildApiUrl('/auth/reset-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Password reset failed: ${errorText}`);
      }

      const data = await response.json();
      return { data, success: true };
    } catch (error) {
      console.error('Auth API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async resetPasswordConfirm(token: string, newPassword: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(buildApiUrl('/auth/reset-password/confirm'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Password reset confirmation failed: ${errorText}`);
      }

      const data = await response.json();
      return { data, success: true };
    } catch (error) {
      console.error('Auth API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async logout(): Promise<void> {
    const storage = getStorage();
    console.log('Auth: Logout storage available:', !!storage);
    if (storage) {
      await storage.removeItem('accessToken');
      await storage.removeItem('refreshToken');
      await storage.removeItem('user');
      console.log('Auth: Logout - tokens removed');
    } else {
      console.log('Auth: Logout - No storage available');
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const storage = getStorage();
    console.log('Auth: Checking authentication, storage type:', typeof storage);
    console.log('Auth: Storage available:', !!storage);
    if (!storage) {
      console.log('Auth: No storage available');
      return false;
    }
    const token = await storage.getItem('accessToken');
    console.log('Auth: Token found:', !!token);
    return !!token;
  },

  async getUser(): Promise<any> {
    const storage = getStorage();
    console.log('Auth: Getting user, storage available:', !!storage);
    if (!storage) return null;
    const userStr = await storage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  async getAccessToken(): Promise<string | null> {
    const storage = getStorage();
    console.log('Auth: Getting access token, storage available:', !!storage);
    if (!storage) return null;
    return await storage.getItem('accessToken');
  },
};

// Health check function
export const healthCheck = async (): Promise<boolean> => {
  try {
    const response = await fetch(buildApiUrl('/health'), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
};

export const api = {
  async get<T>(endpoint: string, retries: number = 3): Promise<ApiResponse<T>> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const storage = getStorage();
        console.log('API: Storage type:', typeof storage);
        console.log('API: Storage available:', !!storage);
        const token = storage ? await storage.getItem('accessToken') : null;
        
        console.log(`API: Making GET request to ${endpoint} (attempt ${attempt}/${retries})`);
        console.log(`API: Token available: ${token ? 'yes' : 'no'}`);
        console.log(`API: Token value: ${token ? token.substring(0, 20) + '...' : 'null'}`);
        
        // Require authentication for all API calls
        if (!token) {
          console.log('API: No token found, throwing authentication error');
          throw new Error('Authentication required');
        }

        const url = buildApiUrl(endpoint);
        console.log(`API: Full URL: ${url}`);

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 60000); // 60 second timeout
        });

        const fetchPromise = fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            'Authorization': `Bearer ${token}`,
          },
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]) as Response;

        console.log(`API: Response status: ${response.status}`);
        console.log(`API: Response ok: ${response.ok}`);

        if (response.status === 401) {
          console.log('API: 401 Unauthorized, clearing token and triggering logout');
          // Token is invalid, clear it and trigger logout
          if (storage) {
            await storage.removeItem('accessToken');
            await storage.removeItem('refreshToken');
            await storage.removeItem('user');
          }
          // Trigger logout event for all listeners
          tokenExpirationEvents.trigger();
          throw new Error('Authentication failed - token expired');
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.log(`API: HTTP error ${response.status}: ${errorText}`);
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        // Read body as text first to handle empty or non-JSON responses (e.g. 200 with no body)
        const text = await response.text();
        let data: T;
        if (!text || text.trim() === '') {
          data = null as T;
        } else {
          try {
            data = JSON.parse(text) as T;
          } catch {
            data = null as T;
          }
        }
        console.log(`API: Success response data:`, data);
        return { data, success: true };
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const isCorsError = errorMessage.includes('CORS') || 
                          errorMessage.includes('Failed to fetch') ||
                          errorMessage.includes('ERR_FAILED') ||
                          errorMessage.includes('NetworkError') ||
                          (error instanceof TypeError && errorMessage.includes('fetch'));
        
        if (isCorsError) {
          console.error(`API CORS/Network Error (attempt ${attempt}/${retries}):`, errorMessage);
          const currentUrl = buildApiUrl('').replace(/\/$/, '');
          const corsResponse: ApiResponse<T> = {
            error:
              `Cannot reach the backend at ${currentUrl}. ` +
              'Restart Expo after changing API URL, or run in the browser console: ' +
              'localStorage.removeItem("creativ_solar_api_url"); location.reload()',
            success: false,
          };
          (corsResponse as any).isCorsError = true;
          return corsResponse;
        }
        
        console.error(`API Error (attempt ${attempt}/${retries}):`, error);
        
        // If this is the last attempt, return the error
        if (attempt === retries) {
          return { 
            error: error instanceof Error ? error.message : 'Unknown error', 
            success: false 
          };
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`API: Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return { error: 'Max retries exceeded', success: false };
  },

  async post<T>(endpoint: string, body: any, retries: number = 3): Promise<ApiResponse<T>> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const storage = getStorage();
        console.log('API: Storage available for POST:', !!storage);
        const token = storage ? await storage.getItem('accessToken') : null;
        
        console.log(`API: Making POST request to ${endpoint} (attempt ${attempt}/${retries})`);
        
        // Require authentication for all API calls
        if (!token) {
          throw new Error('Authentication required');
        }

        // Check if body is FormData
        const isFormData = body instanceof FormData;
        console.log(`API: Body type: ${isFormData ? 'FormData' : typeof body}`);
        console.log(`API: Body is FormData: ${isFormData}`);
        
        const headers: Record<string, string> = {
          'ngrok-skip-browser-warning': 'true',
          'Authorization': `Bearer ${token}`,
        };
        
        // Only set Content-Type for non-FormData requests
        if (!isFormData) {
          headers['Content-Type'] = 'application/json';
        }
        
        console.log(`API: Request headers:`, headers);
        
        // Log the body for debugging (especially for PDF generation)
        if (endpoint.includes('generate-pdf')) {
          console.log(`API: Request body for ${endpoint}:`, body);
          console.log(`API: Request body stringified:`, isFormData ? '[FormData]' : JSON.stringify(body));
        }
        
        const response = await fetch(buildApiUrl(endpoint), {
          method: 'POST',
          headers,
          body: isFormData ? body : JSON.stringify(body),
        });

        if (response.status === 401) {
          // Token is invalid, clear it and trigger logout
          if (storage) {
            await storage.removeItem('accessToken');
            await storage.removeItem('refreshToken');
            await storage.removeItem('user');
          }
          tokenExpirationEvents.trigger();
          throw new Error('Authentication failed - token expired');
        }

        if (!response.ok) {
          // Check if response is JSON or HTML
          const contentType = response.headers.get('content-type');
          const errorText = await response.text();
          
          if (contentType && contentType.includes('application/json')) {
            try {
              const errorData = JSON.parse(errorText);
              throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            } catch (parseError) {
              throw new Error(`HTTP error! status: ${response.status}, message: ${errorText.substring(0, 200)}`);
            }
          } else {
            // Response is HTML (error page), extract useful info
            const isHtml = errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html');
            throw new Error(
              isHtml
                ? `Server error (${response.status}): The server returned an error page. Please check if the endpoint exists and the backend is running.`
                : `HTTP error! status: ${response.status}, message: ${errorText.substring(0, 200)}`
            );
          }
        }

        // Check content type before parsing JSON - read text first to check for HTML
        const responseContentType = response.headers.get('content-type');
        const textResponse = await response.text();
        
        // Check if response is HTML even if content-type header says otherwise
        const isHtml = textResponse.trim().startsWith('<!DOCTYPE') || textResponse.trim().startsWith('<html');
        
        if (isHtml || !responseContentType || !responseContentType.includes('application/json')) {
          throw new Error(
            isHtml
              ? `Server error: The server returned an HTML error page instead of JSON. Please check if the endpoint exists and the backend is running. Response preview: ${textResponse.substring(0, 200)}`
              : `Expected JSON response but got ${responseContentType || 'unknown'}. Response preview: ${textResponse.substring(0, 200)}`
          );
        }

        // Parse JSON response from text
        let data;
        try {
          data = JSON.parse(textResponse);
        } catch (parseError) {
          throw new Error(`Failed to parse JSON response. Response preview: ${textResponse.substring(0, 200)}`);
        }
        
        console.log(`API: POST response data:`, data);
        return { data, success: true };
      } catch (error) {
        console.error(`API Error (attempt ${attempt}/${retries}):`, error);
        
        // If this is the last attempt, return the error
        if (attempt === retries) {
          return { 
            error: error instanceof Error ? error.message : 'Unknown error', 
            success: false 
          };
        }
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`API: Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return { error: 'Max retries exceeded', success: false };
  },

  async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    try {
      const storage = getStorage();
      console.log('API: Storage available for PUT:', !!storage);
      const token = storage ? await storage.getItem('accessToken') : null;
      
      // Require authentication for all API calls
      if (!token) {
        throw new Error('Authentication required');
      }

      const url = buildApiUrl(endpoint);
      console.log(`API: Full URL: ${url}`);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (response.status === 401) {
        // Token is invalid, clear it and trigger logout
        if (storage) {
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          await storage.removeItem('user');
        }
        tokenExpirationEvents.trigger();
        throw new Error('Authentication failed - token expired');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Read body as text first to handle empty or non-JSON responses (e.g. 204 or 200 with no body)
      const text = await response.text();
      let data: T;
      if (!text || text.trim() === '') {
        data = null as T;
      } else {
        try {
          data = JSON.parse(text) as T;
        } catch {
          data = null as T;
        }
      }
      return { data, success: true };
    } catch (error) {
      console.error('API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const storage = getStorage();
      console.log('API: Storage available for DELETE:', !!storage);
      const token = storage ? await storage.getItem('accessToken') : null;
      
      // Require authentication for all API calls
      if (!token) {
        throw new Error('Authentication required');
      }

      const url = buildApiUrl(endpoint);
      console.log(`API: Full URL: ${url}`);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        // Token is invalid, clear it and trigger logout
        if (storage) {
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          await storage.removeItem('user');
        }
        tokenExpirationEvents.trigger();
        throw new Error('Authentication failed - token expired');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return { data, success: true };
    } catch (error) {
      console.error('API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },
};

/** DTO for POST /opportunities/manual (admin only) */
export interface CreateManualOpportunityDto {
  name: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  assignedUserId: string;
  /** ISO 8601 date/time (e.g. scheduled survey/visit). Optional; omit or null if not set. */
  scheduledAt?: string | null;
}

/** Response shape from POST /opportunities/manual */
export interface ManualOpportunityResponse {
  id: string;
  ghlOpportunityId: string;
  name: string;
  userId: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  source: 'MANUAL';
  scheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const opportunitiesApi = {
  async getAiVsManual(): Promise<ApiResponse<OpportunitiesResponse>> {
    // Force refresh for now to get the latest opportunities data
    console.log('API: Force refreshing opportunities data...');
    cache.remove(CACHE_KEYS.OPPORTUNITIES);
    
    const response = await api.get<OpportunitiesResponse>('/opportunities/ai-vs-manual');
    
    if (response.success && response.data) {
      // Cache the successful response for 1 minute (reduced for testing)
      cache.set(CACHE_KEYS.OPPORTUNITIES, response.data, 1 * 60 * 1000);
      console.log('API: Cached fresh opportunities data');
    }
    
    return response;
  },
  
  async getSimpleOpportunities(): Promise<ApiResponse<OpportunitiesResponse>> {
    console.log('API: Force refreshing simple opportunities...');
    cache.remove(CACHE_KEYS.OPPORTUNITIES);
    const response = await api.get<OpportunitiesResponse>('/opportunities/simple/list');
    if (response.success && response.data) {
      cache.set(CACHE_KEYS.OPPORTUNITIES, response.data);
    }
    return response;
  },

  async getOpportunitiesWithAppointments(): Promise<ApiResponse<OpportunitiesResponse>> {
    console.log('API: Fetching opportunities with appointments...');
    cache.remove(CACHE_KEYS.OPPORTUNITIES);
    const response = await api.get<OpportunitiesResponse>('/opportunities/with-appointments');
    if (response.success && response.data) {
      cache.set(CACHE_KEYS.OPPORTUNITIES, response.data);
    }
    return response;
  },

  async getOpportunitiesWithAppointmentsOptimized(): Promise<ApiResponse<OpportunitiesResponse>> {
    console.log('API: Fetching opportunities with appointments (optimized)...');
    cache.remove(CACHE_KEYS.OPPORTUNITIES);
    const response = await api.get<OpportunitiesResponse>('/opportunities/with-appointments-optimized');
    if (response.success && response.data) {
      cache.set(CACHE_KEYS.OPPORTUNITIES, response.data);
    }
    return response;
  },

  async getOpportunitiesWithAppointmentsHybrid(): Promise<ApiResponse<OpportunitiesResponse>> {
    console.log('API: Fetching opportunities with appointments (hybrid - fast dashboard + appointments)...');
    cache.remove(CACHE_KEYS.OPPORTUNITIES);
    const response = await api.get<OpportunitiesResponse>('/opportunities/with-appointments-hybrid');
    if (response.success && response.data) {
      cache.set(CACHE_KEYS.OPPORTUNITIES, response.data);
    }
    return response;
  },

  async getOpportunitiesWithAppointmentsUnified(): Promise<ApiResponse<OpportunitiesResponse>> {
    console.log('API: Fetching opportunities with appointments (unified - tag-based)...');
    cache.remove(CACHE_KEYS.OPPORTUNITIES);
    const response = await api.get<OpportunitiesResponse>('/opportunities/with-appointments-unified');
    if (response.success && response.data) {
      cache.set(CACHE_KEYS.OPPORTUNITIES, response.data);
    }
    return response;
  },

  async testAllOpportunities(): Promise<ApiResponse<any>> {
    console.log('API: Fetching test opportunities data...');
    const response = await api.get<any>('/opportunities/test-all-opportunities');
    return response;
  },

  async getContactAppointments(contactId: string): Promise<ApiResponse<any>> {
    console.log('API: Fetching contact appointments...');
    const response = await api.get<any>(`/opportunities/contact-appointments/${contactId}`);
    return response;
  },

  async testAppointmentAnalysis(): Promise<ApiResponse<any>> {
    console.log('API: Testing appointment analysis...');
    const response = await api.get<any>('/opportunities/test-appointment-analysis');
    return response;
  },

  async getDashboardData(): Promise<ApiResponse<any>> {
    // Dashboard no longer needs AI vs Manual data
    // Return empty response to avoid unnecessary API calls
    console.log('API: Dashboard data call - returning empty response (AI/Manual calls removed)');
    
    return {
      data: undefined,
      error: undefined,
      success: true
    };
  },
  
  async getAllOpportunities(): Promise<ApiResponse<any>> {
    return api.get<any>('/opportunities/all');
  },

  async debugAllWonOpportunities(): Promise<ApiResponse<any>> {
    console.log('API: Debug - fetching all won opportunities...');
    const response = await api.get<any>('/opportunities/debug-all-won');
    return response;
  },

    async getOpportunitiesWithWon(): Promise<ApiResponse<any>> {
      console.log('API: Fetching opportunities with won status...');
      const response = await api.get<any>('/opportunities/opportunities-with-won');
      return response;
    },

    async debugAllUserOpportunities(): Promise<ApiResponse<any>> {
      console.log('API: Debug - fetching all user opportunities...');
      const response = await api.get<any>('/opportunities/debug-all-user-opportunities');
      return response;
    },

  async healthCheck(): Promise<ApiResponse<any>> {
    return api.get<any>('/health');
  },

  async getVisitType(opportunityId: string): Promise<
    ApiResponse<{ visitType: 'home-visit' | 'remote' | null; source: 'manual' | 'tag' | 'stage' | null }>
  > {
    return api.get(`/opportunities/${opportunityId}/visit-type`);
  },

  async setVisitType(
    opportunityId: string,
    visitType: 'home-visit' | 'remote',
  ): Promise<ApiResponse<{ visitType: 'home-visit' | 'remote'; source: 'manual' }>> {
    return api.put(`/opportunities/${opportunityId}/visit-type`, { visitType });
  },

  async getSalesPerformanceStats(month?: string, year?: string): Promise<ApiResponse<any>> {
    console.log('API: Fetching sales performance stats...');
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    
    const queryString = params.toString();
    const url = `/opportunities/sales-performance${queryString ? `?${queryString}` : ''}`;
    
    const response = await api.get<any>(url);
    return response;
  },

  // Pipeline API methods
  async getPipelines(): Promise<ApiResponse<any>> {
    console.log('API: Fetching pipelines...');
    const response = await api.get<any>('/opportunities/pipelines');
    return response;
  },

  async getOpportunitiesByPipeline(pipelineId: string): Promise<ApiResponse<any>> {
    console.log('API: Fetching opportunities by pipeline:', pipelineId);
    const response = await api.get<any>(`/opportunities/pipelines/${pipelineId}/opportunities`);
    return response;
  },

  async getOpportunitiesByStageProgression(stageName: string): Promise<ApiResponse<any>> {
    console.log('API: Fetching opportunities by stage progression:', stageName);
    const response = await api.get<any>(`/opportunities/stage-progression/${encodeURIComponent(stageName)}`);
    return response;
  },

  async getOpportunitiesByStageProgressionUnfiltered(stageName: string): Promise<ApiResponse<any>> {
    console.log('API: Fetching unfiltered opportunities by stage progression:', stageName);
    const response = await api.get<any>(`/opportunities/stage-progression/${encodeURIComponent(stageName)}/unfiltered`);
    return response;
  },

  /**
   * Update opportunity status (won, lost, abandoned, open).
   * Backend: PUT /opportunities/:id/status
   */
  async updateStatus(
    opportunityId: string,
    status: 'open' | 'won' | 'lost' | 'abandoned',
    stageId?: string
  ): Promise<ApiResponse<any>> {
    return api.put(`/opportunities/${opportunityId}/status`, { status, ...(stageId ? { stageId } : {}) });
  },

  /**
   * List manual opportunities only (authenticated).
   * Surveyors: only where they are assigned; Admins: all.
   * Backend: GET /opportunities/manual
   */
  async getManualOpportunities(): Promise<ApiResponse<{ opportunities: any[]; total: number }>> {
    return api.get<{ opportunities: any[]; total: number }>('/opportunities/manual');
  },

  /**
   * Create a manual opportunity (admin only).
   * Backend: POST /opportunities/manual
   */
  async createManualOpportunity(dto: CreateManualOpportunityDto): Promise<ApiResponse<ManualOpportunityResponse>> {
    // Backend field naming has varied over time; send address in common aliases.
    const payload: any = { ...dto };
    if (dto.customerAddress && !payload.address) payload.address = dto.customerAddress;
    if (dto.customerAddress && !payload.contactAddress) payload.contactAddress = dto.customerAddress;
    if (dto.customerEmail !== undefined && dto.customerEmail !== null) {
      payload.contactEmail = dto.customerEmail;
      payload.email = dto.customerEmail;
    }
    if (dto.assignedUserId && !payload.userId) payload.userId = dto.assignedUserId;
    if (dto.assignedUserId && !payload.ownerId) payload.ownerId = dto.assignedUserId;
    return api.post<ManualOpportunityResponse>('/opportunities/manual', payload);
  },

  /**
   * Update a manual opportunity (admin only).
   * Backend: PUT /opportunities/manual/:id
   */
  async updateManualOpportunity(
    opportunityId: string,
    dto: CreateManualOpportunityDto
  ): Promise<ApiResponse<ManualOpportunityResponse>> {
    // Backend field naming has varied over time; send address in common aliases.
    const payload: any = { ...dto };
    if (dto.customerAddress && !payload.address) payload.address = dto.customerAddress;
    if (dto.customerAddress && !payload.contactAddress) payload.contactAddress = dto.customerAddress;
    if (dto.customerEmail !== undefined && dto.customerEmail !== null) {
      payload.contactEmail = dto.customerEmail;
      payload.email = dto.customerEmail;
    }
    if (dto.assignedUserId && !payload.userId) payload.userId = dto.assignedUserId;
    if (dto.assignedUserId && !payload.ownerId) payload.ownerId = dto.assignedUserId;
    try {
      return await api.put<ManualOpportunityResponse>(`/opportunities/manual/${opportunityId}`, payload);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('404') || msg.includes('Not Found')) {
        return api.put<ManualOpportunityResponse>(`/opportunities/${opportunityId}`, payload);
      }
      throw e;
    }
  },

  /**
   * Delete a manual opportunity (admin only).
   * Backend: DELETE /opportunities/manual/:id
   */
  async deleteManualOpportunity(opportunityId: string): Promise<ApiResponse<void>> {
    return api.delete<void>(`/opportunities/manual/${opportunityId}`);
  },

  // Clear cache methods
  clearCache(): void {
    cache.remove(CACHE_KEYS.OPPORTUNITIES);
    cache.remove(CACHE_KEYS.OPPORTUNITIES_SIMPLE);
    console.log('API: Cleared opportunities cache');
  },

  refreshCache(): void {
    this.clearCache();
    console.log('API: Cache refreshed, next request will fetch fresh data');
  },
};

// New workflow API functions
export const workflowApi = {
  async getWorkflowSteps(): Promise<ApiResponse<any>> {
    return api.get<any>('/opportunity-workflow/steps');
  },

  async startOpportunity(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.post<any>('/opportunity-workflow/start', { ghlOpportunityId });
  },

  async getOpportunityProgress(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.get<any>(`/opportunity-workflow/progress/${ghlOpportunityId}`);
  },

  async getUserOpportunities(): Promise<ApiResponse<any>> {
    return api.get<any>('/opportunity-workflow/my-opportunities');
  },

  async getUserWorkflows(): Promise<ApiResponse<any>> {
    return api.get<any>('/opportunity-workflow/user/progress');
  },

  async getOpportunitySheets(opportunityId: string): Promise<ApiResponse<any>> {
    return api.post<any>('/opportunity-workflow/get-opportunity-sheets', { opportunityId });
  },

  async updateStep(ghlOpportunityId: string, stepNumber: number, status: string, data?: any): Promise<ApiResponse<any>> {
    return api.put<any>(`/opportunity-workflow/progress/${ghlOpportunityId}/step`, {
      stepNumber,
      status,
      data
    });
  },

  async completeStep(ghlOpportunityId: string, stepNumber: number, data?: any): Promise<ApiResponse<any>> {
    return api.post<any>(`/opportunity-workflow/progress/${ghlOpportunityId}/complete-step`, {
      stepNumber,
      data
    });
  },

  async completeStepByType(ghlOpportunityId: string, stepType: string, data?: any): Promise<ApiResponse<any>> {
    return api.post<any>(
      `/opportunity-workflow/progress/${ghlOpportunityId}/complete-step`,
      { stepType, data },
      1,
    );
  },

  async finalizeAppointmentOutcome(
    ghlOpportunityId: string,
    outcome: 'won' | 'lost',
    data?: Record<string, unknown>,
  ): Promise<ApiResponse<any>> {
    return api.post<any>(
      `/opportunity-workflow/progress/${ghlOpportunityId}/outcome`,
      { outcome, organizedAt: new Date().toISOString(), ...(data || {}) },
      1,
    );
  },

  async syncDisclaimerCompletion(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.post<any>(
      `/opportunity-workflow/progress/${ghlOpportunityId}/sync-disclaimer`,
      {},
    );
  },

  async pauseOpportunity(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.put<any>(`/opportunity-workflow/progress/${ghlOpportunityId}/pause`, {});
  },

  async resumeOpportunity(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.put<any>(`/opportunity-workflow/progress/${ghlOpportunityId}/resume`, {});
  },

  async resetWorkflow(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.put<any>(`/opportunity-workflow/progress/${ghlOpportunityId}/reset`, {});
  },

  async clearAllWorkflows(): Promise<ApiResponse<any>> {
    return api.delete<any>('/opportunity-workflow/clear-all');
  },
};

// Survey API functions
export const surveyApi = {
  async createSurvey(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.post<any>(`/surveys/${ghlOpportunityId}`, {});
  },

  async getSurvey(ghlOpportunityId: string, options?: { skipCache?: boolean }): Promise<ApiResponse<any>> {
    const endpoint = options?.skipCache
      ? `/surveys/${ghlOpportunityId}?_t=${Date.now()}`
      : `/surveys/${ghlOpportunityId}`;
    return api.get<any>(endpoint);
  },

  async getUserSurveys(): Promise<ApiResponse<any>> {
    return api.get<any>('/surveys/user/all');
  },

  async updateSurvey(ghlOpportunityId: string, updateData: any): Promise<ApiResponse<any>> {
    return api.put<any>(`/surveys/${ghlOpportunityId}`, updateData);
  },

  async saveSurveyPage(ghlOpportunityId: string, pageData: any, images?: any): Promise<ApiResponse<any>> {
    const payload = {
      pageData,
      images: images || {}
    };
    return api.put<any>(`/surveys/${ghlOpportunityId}/save-page`, payload);
  },

  async uploadImagesAndGetUrls(ghlOpportunityId: string, fieldName: string, images: any[]): Promise<ApiResponse<{ urls: string[] }>> {
    console.log('🌐 [API] uploadImagesAndGetUrls called with:', {
      ghlOpportunityId,
      fieldName,
      imagesCount: images.length,
      imagesDetails: images.map((img, index) => ({
        index,
        name: img.name,
        mimeType: img.mimeType,
        size: img.size,
        hasBase64: !!img.base64,
        hasBase64Data: !!img.base64Data,
        base64Length: img.base64?.length || img.base64Data?.length || 0
      }))
    });

    const normalizeBase64Data = (img: { base64?: string; base64Data?: string }) => {
      const raw = img.base64Data || img.base64 || '';
      if (!raw) return '';
      return raw.includes(',') ? raw.split(',')[1] : raw;
    };

    const payload = {
      fieldName,
      images: images.map(img => ({
        name: img.name || `image_${Date.now()}.jpg`,
        mimeType: img.mimeType || 'image/jpeg',
        base64Data: normalizeBase64Data(img),
        size: img.size || 0
      }))
    };

    console.log('🌐 [API] Payload prepared:', {
      fieldName: payload.fieldName,
      imagesCount: payload.images.length,
      payloadImagesDetails: payload.images.map((img, index) => ({
        index,
        name: img.name,
        mimeType: img.mimeType,
        size: img.size,
        hasBase64Data: !!img.base64Data,
        base64Length: img.base64Data?.length || 0
      }))
    });

    console.log('🌐 [API] Making POST request to:', `/surveys/${ghlOpportunityId}/upload-images`);
    
    try {
      const response = await api.post<{ urls: string[] }>(`/surveys/${ghlOpportunityId}/upload-images`, payload);
      console.log('🌐 [API] Raw response received:', response);
      console.log('🌐 [API] Response type:', typeof response);
      console.log('🌐 [API] Response keys:', Object.keys(response || {}));
      console.log('🌐 [API] Response success:', response?.success);
      console.log('🌐 [API] Response data:', response?.data);
      console.log('🌐 [API] Response error:', response?.error);
      return response;
    } catch (error: any) {
      console.error('🌐 [API] Error in uploadImagesAndGetUrls:', error);
      console.error('🌐 [API] Error details:', {
        message: error?.message,
        status: error?.status,
        response: error?.response
      });
      throw error;
    }
  },

  async submitSurvey(ghlOpportunityId: string, surveyData?: any, uploadedFiles?: any): Promise<ApiResponse<any>> {
    // For React Native, we'll send images as base64 data in the JSON payload
    // instead of using FormData which doesn't work properly with React Native
    
    const payload = {
      surveyData: surveyData || {},
      images: {} as any
    };
    
    // Process uploaded files and convert to base64
    if (uploadedFiles && Object.keys(uploadedFiles).length > 0) {
      console.log('🔧 Processing uploaded files for base64 conversion...');
      
      for (const fieldName of Object.keys(uploadedFiles)) {
        const files = uploadedFiles[fieldName];
        if (files && files.length > 0) {
          payload.images[fieldName] = [];
          
          for (let index = 0; index < files.length; index++) {
            const file = files[index];
            console.log(`🔧 Processing file ${fieldName}-${index}:`, {
              uri: file.uri,
              name: file.name,
              mimeType: file.mimeType,
              hasBase64: !!file.base64
            });
            
            // If the file already has base64 data, use it
            if (file.base64) {
              payload.images[fieldName].push({
                name: file.name || `image_${Date.now()}_${index}.jpg`,
                mimeType: file.mimeType || 'image/jpeg',
                base64Data: file.base64,
                size: file.size || 0
              });
            } else {
              // If no base64 data, we need to read the file
              // For now, we'll skip files without base64 data
              console.warn(`⚠️ File ${fieldName}-${index} has no base64 data, skipping`);
            }
          }
        }
      }
    }
    
    console.log('🔧 Final payload structure:', {
      hasSurveyData: !!payload.surveyData,
      imageFields: Object.keys(payload.images),
      totalImages: Object.values(payload.images).reduce((total: number, files: any) => total + (Array.isArray(files) ? files.length : 0), 0)
    });
    
    // Send as JSON instead of FormData
    return api.post<any>(`/surveys/${ghlOpportunityId}/submit`, payload);
  },

  async uploadFilesToCloudinary(ghlOpportunityId: string, uploadedFiles: any): Promise<ApiResponse<{ [key: string]: string[] }>> {
    return api.post<{ [key: string]: string[] }>(`/surveys/${ghlOpportunityId}/upload-files`, {
      uploadedFiles
    });
  },

  async approveSurvey(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.post<any>(`/surveys/${ghlOpportunityId}/approve`, {});
  },

  async rejectSurvey(ghlOpportunityId: string, rejectionReason: string): Promise<ApiResponse<any>> {
    return api.post<any>(`/surveys/${ghlOpportunityId}/reject`, { rejectionReason });
  },

  async deleteSurvey(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.delete<any>(`/surveys/${ghlOpportunityId}`);
  },

  async resetSurvey(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    return api.post<any>(`/surveys/${ghlOpportunityId}/reset`, {});
  },

  async sendSurveyEmail(ghlOpportunityId: string, recipientEmail: string): Promise<ApiResponse<any>> {
    return api.post<any>(`/surveys/${ghlOpportunityId}/send-email`, { recipientEmail });
  },

  async getSurveyImages(
    ghlOpportunityId: string,
    options?: { skipCache?: boolean },
  ): Promise<ApiResponse<any[]>> {
    const cacheSuffix = options?.skipCache ? `?_t=${Date.now()}` : '';
    return api.get<any[]>(`/surveys/${ghlOpportunityId}/images${cacheSuffix}`);
  },

  async getSurveyImagesByField(
    ghlOpportunityId: string,
    fieldName: string,
    options?: { skipCache?: boolean },
  ): Promise<ApiResponse<any[]>> {
    const cacheSuffix = options?.skipCache ? `?_t=${Date.now()}` : '';
    return api.get<any[]>(
      `/surveys/${ghlOpportunityId}/images/${encodeURIComponent(fieldName)}${cacheSuffix}`,
    );
  },

  async createCustomerUploadLink(
    ghlOpportunityId: string,
    options?: { customerLabel?: string; allowedFields?: string[]; ttlDays?: number },
  ): Promise<
    ApiResponse<{
      token: string;
      url: string;
      password: string;
      expiresAt: string;
      allowedFields: string[];
    }>
  > {
    return api.post(`/surveys/${ghlOpportunityId}/customer-upload-link`, options ?? {});
  },

  async listCustomerUploadLinks(ghlOpportunityId: string): Promise<ApiResponse<any[]>> {
    return api.get<any[]>(`/surveys/${ghlOpportunityId}/customer-upload-links`);
  },
};

/** Public customer photo upload (no login — password on link). */
export const surveyCustomerUploadApi = {
  async getLinkMeta(token: string): Promise<
    ApiResponse<{
      requiresPassword: boolean;
      customerLabel?: string | null;
      expiresAt: string;
    }>
  > {
    const response = await fetch(buildApiUrl(`/survey-customer-upload/${encodeURIComponent(token)}`), {
      headers: { 'ngrok-skip-browser-warning': 'true' },
    });
    return response.json();
  },

  async verify(
    token: string,
    password: string,
  ): Promise<
    ApiResponse<{
      customerLabel?: string | null;
      expiresAt: string;
      fields: Array<{
        field: string;
        page: number;
        label: string;
        hint: string;
        minRequired: number;
        uploadedCount: number;
        uploadedImages: Array<{ url: string; name: string }>;
      }>;
    }>
  > {
    const response = await fetch(
      buildApiUrl(`/survey-customer-upload/${encodeURIComponent(token)}/verify`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ password }),
      },
    );
    return response.json();
  },

  async upload(
    token: string,
    password: string,
    fieldName: string,
    images: Array<{ name: string; mimeType: string; size: number; base64Data: string }>,
  ): Promise<ApiResponse<{ urls: string[] }>> {
    const response = await fetch(
      buildApiUrl(`/survey-customer-upload/${encodeURIComponent(token)}/upload`),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ password, fieldName, images }),
      },
    );
    return response.json();
  },
};

// Auto-save API functions
export const autoSaveApi = {
  async autoSaveField(data: { opportunityId: string; fieldName?: string; fieldValue?: any; pageName?: string; pageData?: any; skipLastPageUpdate?: boolean }): Promise<ApiResponse<any>> {
    return api.post<any>('/auto-save/field', data);
  },

  async autoSaveImage(data: { opportunityId: string; fieldName: string; base64Data: string; fileName: string; mimeType: string; fileSize: number }): Promise<ApiResponse<any>> {
    return api.post<any>('/auto-save/image', data);
  },

  async getAutoSaveData(opportunityId: string, pageName?: string): Promise<ApiResponse<any>> {
    const url = pageName ? `/auto-save/${opportunityId}?pageName=${encodeURIComponent(pageName)}` : `/auto-save/${opportunityId}`;
    return api.get<any>(url);
  },

  async clearAutoSaveData(opportunityId: string): Promise<ApiResponse<any>> {
    return api.delete<any>(`/auto-save/${opportunityId}`);
  },

  async transferToSurvey(opportunityId: string): Promise<ApiResponse<any>> {
    return api.post<any>(`/auto-save/${opportunityId}/transfer-to-survey`, {});
  },
}; 

// Calculator API functions
export const calculatorApi = {
  async calculate(opportunityId: string, inputs: any): Promise<ApiResponse<any>> {
    return api.post<any>(`/calculator/calculate/${opportunityId}`, inputs);
  },

  async getDropdownOptions(fieldName: string): Promise<ApiResponse<string[]>> {
    return api.get<string[]>(`/calculator/dropdown/${fieldName}`);
  },

  async getDropdowns(sheet: string, cellsCsv: string): Promise<ApiResponse<Record<string, string[]>>> {
    return api.get<Record<string, string[]>>(`/calculator/dropdowns?sheet=${encodeURIComponent(sheet)}&cells=${encodeURIComponent(cellsCsv)}`);
  },

  async getDependentDropdowns(sheet: string, pairsCsv: string): Promise<ApiResponse<any>> {
    return api.get<any>(`/calculator/dependent-dropdowns?sheet=${encodeURIComponent(sheet)}&pairs=${encodeURIComponent(pairsCsv)}`);
  },

  async getResults(opportunityId: string): Promise<ApiResponse<any>> {
    return api.get<any>(`/calculator/results/${opportunityId}`);
  },

  async exportPdf(xlsmPath: string): Promise<ApiResponse<{ pdfPath: string }>> {
    return api.post<{ pdfPath: string }>(`/calculator/export-pdf`, { xlsmPath });
  },

  getUserProgressData: async (userId: string, timeRange: string = '30d'): Promise<ApiResponse<any>> => {
    try {
      console.log(`📈 Fetching progress data for user: ${userId}, timeRange: ${timeRange}...`);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      let url = buildApiUrl(`/user/analytics/progress?userId=${encodeURIComponent(userId)}&timeRange=${encodeURIComponent(timeRange)}`);
      console.log('📈 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📈 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('📈 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📈 User progress data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('📈 Error fetching user progress data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};

// Helper function to get access token
const getAccessToken = async (): Promise<string | null> => {
  const storage = getStorage();
  if (storage) {
    return await storage.getItem('accessToken');
  }
  return null;
};

// Presentation API functions
export const presentationApi = {
  async generatePresentation(data: {
    opportunityId: string;
    calculatorType?: 'flux' | 'off-peak' | 'epvs';
    customerName?: string;
    date?: string;
    postcode?: string;
    solarData?: any;
  }): Promise<ApiResponse<any>> {
    try {
      console.log('🎯 Presentation API: Starting generatePresentation...');
      console.log('🎯 Presentation API: Data:', data);
      
      const storage = getStorage();
      console.log('🎯 Presentation API: Storage available:', !!storage);
      
      const token = storage ? await storage.getItem('accessToken') : null;
      console.log('🎯 Presentation API: Token available:', token ? 'yes' : 'no');
      console.log('🎯 Presentation API: Token value:', token ? token.substring(0, 20) + '...' : 'null');
      
      // Require authentication
      if (!token) {
        console.log('🎯 Presentation API: No token found, throwing authentication error');
        throw new Error('Authentication required');
      }

      const url = buildApiUrl('/presentation/generate');
      console.log('🎯 Presentation API: Full URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(data),
      });

      console.log('🎯 Presentation API: Response status:', response.status);
      console.log('🎯 Presentation API: Response ok:', response.ok);

      if (response.status === 401) {
        // Token is invalid, clear it and trigger logout
        console.log('🎯 Presentation API: 401 error, clearing tokens');
        if (storage) {
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          await storage.removeItem('user');
        }
        tokenExpirationEvents.trigger();
        throw new Error('Authentication failed - token expired');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🎯 Presentation API: Error response:', errorText);
        throw new Error(`Presentation generation failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('🎯 Presentation API: Success response:', result);
      return { data: result.data, success: true };
    } catch (error) {
      console.error('🎯 Presentation API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getAvailableSheets(opportunityId: string): Promise<ApiResponse<any>> {
    try {
      console.log('🎯 Presentation API: Starting getAvailableSheets...');
      console.log('🎯 Presentation API: OpportunityId:', opportunityId);
      
      const storage = getStorage();
      console.log('🎯 Presentation API: Storage available:', !!storage);
      
      const token = storage ? await storage.getItem('accessToken') : null;
      console.log('🎯 Presentation API: Token available:', token ? 'yes' : 'no');
      
      // Require authentication
      if (!token) {
        console.log('🎯 Presentation API: No token found, throwing authentication error');
        throw new Error('Authentication required');
      }

      const url = buildApiUrl('/opportunity-workflow/get-opportunity-sheets');
      console.log('🎯 Presentation API: Full URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ opportunityId }),
      });

      console.log('🎯 Presentation API: Response status:', response.status);
      console.log('🎯 Presentation API: Response ok:', response.ok);

      if (response.status === 401) {
        // Token is invalid, clear it and trigger logout
        console.log('🎯 Presentation API: 401 error, clearing tokens');
        if (storage) {
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          await storage.removeItem('user');
        }
        tokenExpirationEvents.trigger();
        throw new Error('Authentication failed - token expired');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🎯 Presentation API: Error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('🎯 Presentation API: Success response:', result);
      return result;

    } catch (error) {
      console.log('🎯 Presentation API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        data: null
      };
    }
  },

  async generateVideoPresentation(data: {
    opportunityId: string;
    calculatorType?: 'flux' | 'off-peak' | 'epvs' | 'v44';
    fileName?: string;
    customerName?: string;
    date?: string;
    postcode?: string;
    solarData?: any;
    extractedVariables?: Record<string, any>;
  }): Promise<ApiResponse<any>> {
    try {
      console.log('🎯 Video Presentation API: Starting generateVideoPresentation...');
      console.log('🎯 Video Presentation API: Data:', data);
      
      const storage = getStorage();
      console.log('🎯 Video Presentation API: Storage available:', !!storage);
      
      const token = storage ? await storage.getItem('accessToken') : null;
      console.log('🎯 Video Presentation API: Token available:', token ? 'yes' : 'no');
      
      // Require authentication
      if (!token) {
        console.log('🎯 Video Presentation API: No token found, throwing authentication error');
        throw new Error('Authentication required');
      }

      const url = buildApiUrl('/presentation/generate-video');
      console.log('🎯 Video Presentation API: Full URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(data),
      });

      console.log('🎯 Video Presentation API: Response status:', response.status);
      console.log('🎯 Video Presentation API: Response ok:', response.ok);

      if (response.status === 401) {
        // Token is invalid, clear it and trigger logout
        console.log('🎯 Video Presentation API: 401 error, clearing tokens');
        if (storage) {
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          await storage.removeItem('user');
        }
        tokenExpirationEvents.trigger();
        throw new Error('Authentication failed - token expired');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🎯 Video Presentation API: Error response:', errorText);
        throw new Error(`Video presentation generation failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('🎯 Video Presentation API: Success response:', result);
      
      // Handle new image format: { images: string[], publicUrls: string[] }
      // Also support old format for backward compatibility: { videoPath, publicUrl, filename }
      let responseData = result.data;
      
      if (result.data) {
        // New format: images array
        if (result.data.images && result.data.publicUrls) {
          console.log('🎯 Video Presentation API: Detected new image format');
          responseData = {
            images: result.data.images,
            publicUrls: result.data.publicUrls,
            // Keep any other properties for backward compatibility
            ...result.data
          };
        }
        // Old format: single video (for backward compatibility)
        else if (result.data.publicUrl || result.data.videoPath) {
          console.log('🎯 Video Presentation API: Detected old video format (backward compatibility)');
          // Convert old format to new format for consistency
          responseData = {
            images: result.data.filename ? [result.data.filename] : [],
            publicUrls: result.data.publicUrl ? [result.data.publicUrl] : [],
            // Keep old properties for backward compatibility
            videoPath: result.data.videoPath,
            publicUrl: result.data.publicUrl,
            filename: result.data.filename
          };
        }
      }
      
      return { data: responseData, success: result.success };
    } catch (error) {
      console.error('🎯 Video Presentation API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async extractDataFromSheet(opportunityId: string, fileName: string): Promise<ApiResponse<any>> {
    try {
      console.log('🎯 Presentation API: Starting extractDataFromSheet...');
      console.log('🎯 Presentation API: OpportunityId:', opportunityId, 'FileName:', fileName);
      
      const storage = getStorage();
      const token = storage ? await storage.getItem('accessToken') : null;
      
      // Require authentication
      if (!token) {
        throw new Error('Authentication required');
      }

      // First get available sheets to determine calculator type
      const sheetsResponse = await this.getAvailableSheets(opportunityId);
      if (!sheetsResponse.success || !sheetsResponse.data) {
        throw new Error('Failed to get available sheets');
      }

      const sheets = Array.isArray(sheetsResponse.data) ? sheetsResponse.data : sheetsResponse.data.sheets || [];
      const selectedSheet = sheets.find((s: any) => s.fileName === fileName);
      
      if (!selectedSheet) {
        throw new Error('Sheet not found');
      }

      const calculatorType = selectedSheet.calculatorType || 'v44';
      
      // Use extractVariables with the calculator type
      return await this.extractVariables(opportunityId, calculatorType, fileName);
    } catch (error) {
      console.error('🎯 Extract Data From Sheet API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async extractVariables(opportunityId: string, calculatorType: 'flux' | 'off-peak' | 'epvs' | 'v44', fileName?: string): Promise<ApiResponse<any>> {
    try {
      console.log('🎯 Presentation API: Starting extractVariables...');
      console.log('🎯 Presentation API: OpportunityId:', opportunityId, 'CalculatorType:', calculatorType, 'FileName:', fileName);
      
      const storage = getStorage();
      const token = storage ? await storage.getItem('accessToken') : null;
      
      // Require authentication
      if (!token) {
        throw new Error('Authentication required');
      }

      let url = buildApiUrl(`/presentation/variables/${opportunityId}?calculatorType=${calculatorType}`);
      if (fileName) {
        url += `&fileName=${encodeURIComponent(fileName)}`;
      }
      console.log('🎯 Presentation API: Variables URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('🎯 Presentation API: Variables response status:', response.status);

      if (response.status === 401) {
        // Token is invalid, clear it and trigger logout
        if (storage) {
          await storage.removeItem('accessToken');
          await storage.removeItem('refreshToken');
          await storage.removeItem('user');
        }
        tokenExpirationEvents.trigger();
        throw new Error('Authentication failed - token expired');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🎯 Presentation API: Variables error response:', errorText);
        throw new Error(`Failed to extract variables: ${errorText}`);
      }

      const result = await response.json();
      console.log('🎯 Presentation API: Variables success response:', result);
      return { data: result.data, success: true };
    } catch (error) {
      console.error('🎯 Presentation Variables API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getPresentationVariables(opportunityId: string): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl(`/presentation/variables/${opportunityId}`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get variables: ${errorText}`);
      }

      const result = await response.json();
      return { data: result.data, success: true };
    } catch (error) {
      console.error('Presentation Variables API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getHometreeQuoteData(
    opportunityId: string,
    calculatorType?: 'flux' | 'off-peak' | 'epvs' | 'v44',
    fileName?: string,
  ): Promise<ApiResponse<any>> {
    try {
      const storage = getStorage();
      const token = storage ? await storage.getItem('accessToken') : null;
      if (!token) {
        throw new Error('Authentication required');
      }

      const params = new URLSearchParams();
      if (calculatorType) {
        params.set('calculatorType', calculatorType);
      }
      if (fileName) {
        params.set('fileName', fileName);
      }
      const query = params.toString();
      const url = buildApiUrl(
        `/presentation/hometree-data/${opportunityId}${query ? `?${query}` : ''}`,
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load Hometree data: ${errorText}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to load Hometree data');
      }

      return { data: result.data, success: true };
    } catch (error) {
      console.error('Hometree data API error:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  },

  async downloadPresentation(filename: string): Promise<string> {
    return buildApiUrl(`/presentation/download/${filename}`);
  }
};

// System Settings API
export const systemSettingsApi = {
  async getAllSettings(): Promise<ApiResponse<any[]>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl('/system-settings'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get system settings: ${errorText}`);
      }

      const result = await response.json();
      return { data: result.data, success: result.success };
    } catch (error) {
      console.error('System Settings API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getPublicSettings(): Promise<ApiResponse<any[]>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl('/system-settings/public'), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get public settings: ${errorText}`);
      }

      const result = await response.json();
      return { data: result.data, success: result.success };
    } catch (error) {
      console.error('Public Settings API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getSettingValue(key: string): Promise<ApiResponse<string | null>> {
    try {
      console.log('🔧 API: Getting setting value for key:', key);
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl(`/system-settings/value/${key}`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('🔧 API: Get setting value response status:', response.status, response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔧 API: Get setting value failed with error:', errorText);
        throw new Error(`Failed to get setting value: ${errorText}`);
      }

      const result = await response.json();
      console.log('🔧 API: Get setting value result:', result);
      return { data: result.data, success: result.success };
    } catch (error) {
      console.error('🔧 API: Setting Value API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async updateSetting(key: string, value: string): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl(`/system-settings/${key}`), {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ value }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update setting: ${errorText}`);
      }

      const result = await response.json();
      return { data: result.data, success: result.success };
    } catch (error) {
      console.error('Update Setting API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async upsertSetting(key: string, value: string, description?: string, category?: string, isPublic?: boolean): Promise<ApiResponse<any>> {
    try {
      console.log('🔧 API: Upserting setting:', { key, value, description, category, isPublic });
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl('/system-settings/upsert'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ 
          key, 
          value, 
          description, 
          category, 
          isPublic 
        }),
      });

      console.log('🔧 API: Upsert response status:', response.status, response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔧 API: Upsert failed with error:', errorText);
        throw new Error(`Failed to upsert setting: ${errorText}`);
      }

      const result = await response.json();
      console.log('🔧 API: Upsert result:', result);
      return { data: result.data, success: result.success };
    } catch (error) {
      console.error('🔧 API: Upsert Setting API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  }
};

// Opportunity Outcomes API
export const opportunityOutcomesApi = {
  async recordOutcome(data: any): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl('/opportunity-outcomes'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to record outcome: ${errorText}`);
      }

      const result = await response.json();
      return { data: result, success: true };
    } catch (error) {
      console.error('Record Outcome API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  /**
   * Admin-only: Toggle cancelled status for an opportunity.
   * Endpoint: PUT /opportunity-outcomes/admin/toggle-cancelled/:opportunityId
   */
  async toggleCancelledAdmin(opportunityId: string): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(
        buildApiUrl(`/opportunity-outcomes/admin/toggle-cancelled/${opportunityId}`),
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to toggle cancelled status: ${errorText}`);
      }

      const result = await response.json();
      return { data: result, success: true };
    } catch (error) {
      console.error('Toggle Cancelled (Admin) API Error:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  },

  async getUserStats(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      
      // Check if token exists
      if (!token) {
        console.log('🔍 getUserStats - No authentication token found');
        return { 
          error: 'Authentication required - please log in', 
          success: false 
        };
      }

      let url = buildApiUrl('/opportunity-outcomes/stats');
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      console.log('🔍 getUserStats - URL:', url);
      console.log('🔍 getUserStats - Token available:', !!token);
      console.log('🔍 getUserStats - Token preview:', token ? token.substring(0, 20) + '...' : 'null');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
          'Content-Type': 'application/json',
        },
      });

      console.log('🔍 getUserStats - Response status:', response.status);
      console.log('🔍 getUserStats - Response ok:', response.ok);
      console.log('🔍 getUserStats - Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🔍 getUserStats - Error response text:', errorText);
        
        // Check if it's an HTML error page (like 404 or 500)
        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          throw new Error(`API endpoint not found or server error (${response.status}). The /opportunity-outcomes/stats endpoint may not exist on the backend.`);
        }
        
        throw new Error(`Failed to get user stats: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('🔍 getUserStats - Success response:', result);
      return { data: result, success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message === 'Failed to fetch') {
        console.warn('Get User Stats: network error (API unreachable, CORS, or wrong API URL).');
        return {
          error: 'Stats unavailable. Check that the API is running and reachable.',
          success: false,
        };
      }
      console.error('Get User Stats API Error:', error);
      return { error: message, success: false };
    }
  },

  /**
   * Admin-only: Get all reps stats for a date range.
   * Endpoint: GET /opportunity-outcomes/admin/all-reps-stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
   */
  async getAllRepsStats(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      let url = buildApiUrl('/opportunity-outcomes/admin/all-reps-stats');
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get all reps stats: ${errorText}`);
      }

      const result = await response.json();
      return { data: result, success: true };
    } catch (error) {
      console.error('Get All Reps Stats API Error:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      };
    }
  },

  async getRecentOutcomes(limit: number = 10): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl(`/opportunity-outcomes/recent?limit=${limit}`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get recent outcomes: ${errorText}`);
      }

      const result = await response.json();
      return { data: result, success: true };
    } catch (error) {
      console.error('Get Recent Outcomes API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getAllUsersStats(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      let url = buildApiUrl('/opportunity-outcomes/admin/all-stats');
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get all users stats: ${errorText}`);
      }

      const result = await response.json();
      return { data: result, success: true };
    } catch (error) {
      console.error('Get All Users Stats API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getOverallStats(startDate?: string, endDate?: string): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      let url = buildApiUrl('/opportunity-outcomes/admin/overall-stats');
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get overall stats: ${errorText}`);
      }

      const result = await response.json();
      return { data: result, success: true };
    } catch (error) {
      console.error('Get Overall Stats API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async syncFromGHL(): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl('/opportunity-outcomes/sync-ghl'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to sync from GHL: ${errorText}`);
      }

      const result = await response.json();
      return { data: result, success: true };
    } catch (error) {
      console.error('Sync from GHL API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getOutcomeByOpportunityId(ghlOpportunityId: string): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl(`/opportunity-outcomes/opportunity/${ghlOpportunityId}`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      // 404 is expected if no outcome exists yet
      if (response.status === 404) {
        return { data: null, success: true };
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Failed to get outcome: ${errorText}`);
      }

      // Check if response has content
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      // If content-length is 0 or content-type doesn't indicate JSON, return null
      if (contentLength === '0' || (contentType && !contentType.includes('application/json'))) {
        return { data: null, success: true };
      }

      // Try to get response text first to check if it's empty
      const responseText = await response.text();
      
      // If response is empty, return null
      if (!responseText || responseText.trim() === '') {
        return { data: null, success: true };
      }

      // Try to parse JSON
      try {
        const result = JSON.parse(responseText);
        return { data: result, success: true };
      } catch (jsonError) {
        // If JSON parsing fails, log and return null
        console.warn(`Failed to parse JSON response for opportunity ${ghlOpportunityId}:`, jsonError);
        return { data: null, success: true };
      }
    } catch (error) {
      console.error('Get Outcome by Opportunity ID API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  },

  async getOutcomesByOpportunityIds(ghlOpportunityIds: string[]): Promise<ApiResponse<any>> {
    try {
      const token = await getAccessToken();
      const response = await fetch(buildApiUrl('/opportunity-outcomes/batch'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ opportunityIds: ghlOpportunityIds }),
      });

      if (!response.ok) {
        // If batch endpoint doesn't exist, fall back to individual calls
        if (response.status === 404) {
          return { data: null, success: false, error: 'Batch endpoint not available' };
        }
        const errorText = await response.text();
        throw new Error(`Failed to get outcomes: ${errorText}`);
      }

      const result = await response.json();
      return { data: result, success: true };
    } catch (error) {
      console.error('Get Outcomes by Opportunity IDs API Error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        success: false 
      };
    }
  }
};

// Admin Analytics API
export const adminAnalyticsApi = {
  getSystemAnalytics: async (): Promise<ApiResponse<any>> => {
    try {
      console.log('📊 Fetching system analytics...');
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      let url = buildApiUrl('/admin/analytics/system');
      console.log('📊 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📊 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('📊 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 System analytics data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('📊 Error fetching system analytics:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getSystemLogs: async (filter?: string, limit?: number): Promise<ApiResponse<any>> => {
    try {
      console.log('📋 Fetching system logs...');
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const params = new URLSearchParams();
      if (filter) params.append('filter', filter);
      if (limit) params.append('limit', limit.toString());

      let url = buildApiUrl(`/admin/analytics/logs?${params.toString()}`);
      console.log('📋 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📋 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('📋 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📋 System logs data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('📋 Error fetching system logs:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getUserActivitySummary: async (userId?: string): Promise<ApiResponse<any>> => {
    try {
      console.log('👤 Fetching user activity summary...');
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      let url = buildApiUrl(`/admin/analytics/user-activity?${params.toString()}`);
      console.log('👤 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('👤 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('👤 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('👤 User activity data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('👤 Error fetching user activity:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getSystemPerformanceMetrics: async (): Promise<ApiResponse<any>> => {
    try {
      console.log('⚡ Fetching system performance metrics...');
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      let url = buildApiUrl('/admin/analytics/performance');
      console.log('⚡ API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('⚡ Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('⚡ Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('⚡ Performance metrics data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('⚡ Error fetching performance metrics:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getAllUsers: async (): Promise<ApiResponse<any>> => {
    try {
      console.log('👥 Fetching all users...');
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      let url = buildApiUrl('/admin/analytics/users');
      console.log('👥 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('👥 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('👥 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('👥 Users data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('👥 Error fetching users:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getUserOpportunities: async (userId: string): Promise<ApiResponse<any>> => {
    try {
      console.log(`🎯 Fetching opportunities for user: ${userId}...`);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      let url = buildApiUrl(`/admin/analytics/users/${userId}/opportunities`);
      console.log('🎯 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('🎯 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('🎯 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🎯 User opportunities data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('🎯 Error fetching user opportunities:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getUserAutosavedSurveyData: async (userId: string, opportunityId?: string): Promise<ApiResponse<any>> => {
    try {
      console.log(`📋 Fetching autosaved survey data for user: ${userId}...`);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const params = new URLSearchParams();
      if (opportunityId) params.append('opportunityId', opportunityId);

      let url = buildApiUrl(`/admin/analytics/users/${userId}/survey-data?${params.toString()}`);
      console.log('📋 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📋 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('📋 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📋 User survey data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('📋 Error fetching user survey data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getUserAutosavedCalculatorData: async (userId: string, opportunityId?: string): Promise<ApiResponse<any>> => {
    try {
      console.log(`🧮 Fetching autosaved calculator data for user: ${userId}...`);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const params = new URLSearchParams();
      if (opportunityId) params.append('opportunityId', opportunityId);

      let url = buildApiUrl(`/admin/analytics/users/${userId}/calculator-data?${params.toString()}`);
      console.log('🧮 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('🧮 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('🧮 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('🧮 User calculator data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('🧮 Error fetching user calculator data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getUserComprehensiveData: async (userId: string): Promise<ApiResponse<any>> => {
    try {
      console.log(`📊 Fetching comprehensive data for user: ${userId}...`);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      let url = buildApiUrl(`/admin/analytics/users/${userId}/comprehensive`);
      console.log('📊 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📊 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('📊 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📊 User comprehensive data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('📊 Error fetching user comprehensive data:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};

export const reportsApi = {
  async getSummary(startDate?: string, endDate?: string, userId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (userId) params.append('userId', userId);
    const query = params.toString();
    return api.get<any>(`/reports/summary${query ? `?${query}` : ''}`);
  },

  async getTimeseries(startDate?: string, endDate?: string, userId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (userId) params.append('userId', userId);
    const query = params.toString();
    return api.get<any>(`/reports/timeseries${query ? `?${query}` : ''}`);
  },

  async exportCsv(startDate?: string, endDate?: string, userId?: string): Promise<ApiResponse<{ filename: string; content: string }>> {
    try {
      const token = await getAccessToken();
      if (!token) {
        return { success: false, error: 'Authentication required' };
      }
    const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (userId) params.append('userId', userId);

      const response = await fetch(buildApiUrl(`/reports/export.csv?${params.toString()}`), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`CSV export failed: ${errorText}`);
      }

      const disposition = response.headers.get('content-disposition') || '';
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] || `reports-${new Date().toISOString().slice(0, 10)}.csv`;
      const content = await response.text();
      return { success: true, data: { filename, content } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'CSV export failed' };
    }
  }
  ,
  async getAppointmentCycleReport(startDate?: string, endDate?: string, userId?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (userId) params.append('userId', userId);
    const query = params.toString();
    return api.get<any>(`/reports/appointment-cycle${query ? `?${query}` : ''}`);
  }
};

// Admin Opportunity Details API
export const adminOpportunityDetailsApi = {
  getAllUsersWithOpportunities: async (): Promise<ApiResponse<any>> => {
    try {
      console.log('👥 Fetching all users with opportunities (summary)...');
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      let url = buildApiUrl('/admin/opportunities/users');
      console.log('👥 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('👥 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('👥 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('👥 Users with opportunities data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('👥 Error fetching users with opportunities:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getAllUsersWithOpportunitiesFull: async (): Promise<ApiResponse<any>> => {
    try {
      console.log('👥 Fetching all users with opportunities (full)...');
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      let url = buildApiUrl('/admin/opportunities/users/full');
      console.log('👥 API URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('👥 Response status:', response.status);

      if (!response.ok) {
        if (response.status === 401) {
          console.log('👥 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('👥 Users with opportunities (full) data:', data);
      return { success: true, data };
    } catch (error) {
      console.error('👥 Error fetching users with opportunities (full):', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  getOpportunityDetails: async (opportunityId: string): Promise<ApiResponse<any>> => {
    try {
      console.log(`📋 Fetching opportunity details for: ${opportunityId}...`);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Try the new admin endpoint first
      let url = buildApiUrl(`/admin/opportunities/details/${opportunityId}`);
      console.log('📋 API URL:', url);

      let response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      });

      console.log('📋 Response status:', response.status);

      let usedFallback = false;
      let usedBasicFallback = false;

      // If 404 (not deployed) or 5xx (manual UUIDs can 500), fall back to existing endpoints.
      if (response.status === 404 || response.status >= 500) {
        console.log('⚠️ Admin endpoint failed, falling back to existing endpoint...');
        usedFallback = true;
        url = buildApiUrl(`/opportunities/${opportunityId}/details`);
        console.log('📋 Fallback API URL:', url);
        
        response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
        });
        
        console.log('📋 Fallback response status:', response.status);

        // If /details fails (some deployments), fall back to base opportunity endpoint.
        if (!response.ok && response.status !== 401) {
          console.log('⚠️ Details endpoint failed, falling back to base opportunity endpoint...');
          usedBasicFallback = true;
          url = buildApiUrl(`/opportunities/${opportunityId}`);
          console.log('📋 Base fallback API URL:', url);
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true',
            },
          });
          console.log('📋 Base fallback response status:', response.status);
        }
      }

      if (!response.ok) {
        if (response.status === 401) {
          console.log('📋 Token expired, triggering logout');
          tokenExpirationEvents.trigger();
          throw new Error('Authentication expired');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('📋 Opportunity details data:', data);
      
      // Basic fallback: wrap a single opportunity into the expected shape.
      if (usedBasicFallback) {
        const address =
          data?.contactAddress ||
          data?.address ||
          data?.customerAddress ||
          data?.opportunity?.contactAddress ||
          data?.opportunity?.address ||
          data?.opportunity?.customerAddress;
        return {
          success: true,
          data: {
            opportunity: {
              id: data.id,
              ghlOpportunityId: opportunityId,
              contactAddress: address,
              contactPostcode: data.contactPostcode,
              ...data,
            },
          },
        };
      }

      // Only transform if we used the fallback endpoint
      if (usedFallback) {
        // This is the fallback endpoint response, transform it to match expected structure
        console.log('⚠️ Using fallback endpoint response structure');
        const address = data.contactAddress || data.address || data.customerAddress;
        return { 
          success: true, 
          data: {
            opportunity: {
              id: data.id,
              ghlOpportunityId: opportunityId,
              contactAddress: address,
              contactPostcode: data.contactPostcode,
              ...data
            },
          } 
        };
      }
      
      // Return admin endpoint response as-is (should contain all data: opportunity, calculator, survey, etc.)
      return { success: true, data };
    } catch (error) {
      console.error('📋 Error fetching opportunity details:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
};

/** Admin workflow override: mark steps complete, survey status, image overview */
export const adminWorkflowOverrideApi = {
  getOverview: (opportunityId: string) =>
    api.get<any>(`/admin/workflow-override/${encodeURIComponent(opportunityId.trim())}`),

  ensureWorkflow: (opportunityId: string) =>
    api.post<any>(
      `/admin/workflow-override/${encodeURIComponent(opportunityId.trim())}/ensure-workflow`,
      {},
    ),

  completeStep: (opportunityId: string, stepNumber: number, data?: Record<string, unknown>) =>
    api.post<any>(
      `/admin/workflow-override/${encodeURIComponent(opportunityId.trim())}/complete-step`,
      { stepNumber, data },
    ),

  setSurveyStatus: (opportunityId: string, status: string) =>
    api.put<any>(
      `/admin/workflow-override/${encodeURIComponent(opportunityId.trim())}/survey-status`,
      { status },
    ),

  markSurveyComplete: (opportunityId: string) =>
    api.post<any>(
      `/admin/workflow-override/${encodeURIComponent(opportunityId.trim())}/mark-survey-complete`,
      {},
    ),

  markCalculatorComplete: (opportunityId: string, calculatorType?: string) =>
    api.post<any>(
      `/admin/workflow-override/${encodeURIComponent(opportunityId.trim())}/mark-calculator-complete`,
      { calculatorType },
    ),

  markDisclaimerComplete: (opportunityId: string) =>
    api.post<any>(
      `/admin/workflow-override/${encodeURIComponent(opportunityId.trim())}/mark-disclaimer-complete`,
      {},
    ),

  setDisclaimerDisplay: (opportunityId: string, mode: 'auto' | 'show' | 'hide') =>
    api.put<any>(
      `/admin/workflow-override/${encodeURIComponent(opportunityId.trim())}/disclaimer-display`,
      { mode },
    ),
};

export type TrainingProgramStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TrainingScenarioStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface TrainingWorkflowProgress {
  currentStep: number | null;
  currentStepLabel: string | null;
  workflowStatus: string | null;
  totalSteps: number;
  startedAt?: string;
  completedAt?: string;
}

export interface TrainingScenario {
  id: string;
  programId: string;
  scenarioNumber: number;
  opportunityId: string;
  status: TrainingScenarioStatus;
  completedAt?: string | null;
  adminReviewedAt?: string | null;
  adminNotes?: string | null;
  scenarioData: Record<string, unknown>;
  workflowProgress?: TrainingWorkflowProgress | null;
}

export interface TrainingProgram {
  id: string;
  userId: string;
  startedById: string;
  status: TrainingProgramStatus;
  startedAt: string;
  completedAt?: string | null;
  user?: { id: string; name?: string; email?: string; username?: string };
  startedBy?: { id: string; name?: string; email?: string };
  scenarios: TrainingScenario[];
  summary?: {
    totalScenarios: number;
    completedScenarios: number;
    progressPercent: number;
  };
}

export type CalculatorFolderKey =
  | 'epvs-opportunities'
  | 'epvs-opportunities-pdfs'
  | 'opportunities'
  | 'opportunities-pdfs';

export type CalculatorFolderInfo = {
  key: CalculatorFolderKey;
  label: string;
  relativePath: string;
  description: string;
  absolutePath: string;
  fileCount?: number;
  exists?: boolean;
};

export type CalculatorFolderFile = {
  fileName: string;
  name?: string;
  size: number;
  modifiedAt: string;
};

function normalizeCalculatorFolder(raw: any): CalculatorFolderInfo | null {
  const key = String(raw?.key || raw?.id || '').trim() as CalculatorFolderKey;
  if (!key) return null;
  return {
    key,
    label: String(raw?.label || raw?.name || key),
    relativePath: String(raw?.relativePath || raw?.path || ''),
    description: String(raw?.description || ''),
    absolutePath: String(raw?.absolutePath || ''),
    fileCount: typeof raw?.fileCount === 'number' ? raw.fileCount : undefined,
    exists: typeof raw?.exists === 'boolean' ? raw.exists : undefined,
  };
}

function normalizeCalculatorFile(raw: any): CalculatorFolderFile {
  return {
    ...raw,
    fileName: String(raw?.fileName || raw?.name || '').trim(),
    name: String(raw?.name || raw?.fileName || '').trim() || undefined,
    size: Number(raw?.size || 0),
    modifiedAt: String(raw?.modifiedAt || ''),
  };
}

export const adminCalculatorFilesApi = {
  async listFolders(): Promise<ApiResponse<CalculatorFolderInfo[]>> {
    const response = await api.get<any>('/admin/calculator-files/folders');
    if (!response.success) return response as ApiResponse<CalculatorFolderInfo[]>;
    const payload = response.data?.data ?? response.data;
    const rawFolders = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.folders)
        ? payload.folders
        : [];
    return {
      success: true,
      data: rawFolders.map(normalizeCalculatorFolder).filter(Boolean) as CalculatorFolderInfo[],
    };
  },

  async listFiles(
    folder: CalculatorFolderKey,
  ): Promise<
    ApiResponse<{ folder: CalculatorFolderKey; label: string; files: CalculatorFolderFile[]; total?: number }>
  > {
    const response = await api.get<any>(
      `/admin/calculator-files?folder=${encodeURIComponent(folder)}&limit=500`,
    );
    if (!response.success) {
      return response as ApiResponse<{
        folder: CalculatorFolderKey;
        label: string;
        files: CalculatorFolderFile[];
        total?: number;
      }>;
    }
    const payload = response.data?.data ?? response.data;
    const normalizedFiles = Array.isArray(payload?.files)
      ? payload.files.map(normalizeCalculatorFile)
      : [];
    return {
      success: true,
      data: {
        folder: (payload?.folder?.id || payload?.folder || folder) as CalculatorFolderKey,
        label: String(payload?.folder?.name || payload?.label || folder),
        total: typeof payload?.total === 'number' ? payload.total : normalizedFiles.length,
        files: normalizedFiles,
      },
    };
  },

  async download(folder: CalculatorFolderKey, fileName: string): Promise<void> {
    const storage = getStorage();
    const token = storage ? await storage.getItem('accessToken') : null;
    if (!token) {
      throw new Error('Authentication required');
    }

    // Prefer legacy query route (works with current admin UI), fall back to nested route.
    const urls = [
      buildApiUrl(
        `/admin/calculator-files/download?folder=${encodeURIComponent(folder)}&fileName=${encodeURIComponent(fileName)}`,
      ),
      buildApiUrl(
        `/admin/calculator-files/folders/${encodeURIComponent(folder)}/files/${encodeURIComponent(fileName)}/download`,
      ),
    ];

    let lastError = 'Download failed';
    for (const url of urls) {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'ngrok-skip-browser-warning': 'true',
          Accept: 'application/octet-stream, */*',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        lastError = text || `Download failed (${response.status})`;
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer.byteLength) {
        throw new Error('Downloaded file is empty');
      }

      if (typeof document !== 'undefined') {
        const blob = new Blob([arrayBuffer], {
          type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
        });
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          window.URL.revokeObjectURL(blobUrl);
        }, 100);
        return;
      }

      throw new Error('File download is supported on web. Use the browser admin tools screen.');
    }

    throw new Error(lastError);
  },

  async upload(
    folder: CalculatorFolderKey,
    file: { uri?: string; name: string; type?: string; file?: File },
  ): Promise<
    ApiResponse<{ folder: CalculatorFolderKey; fileName: string; size: number; overwritten?: boolean }>
  > {
    const storage = getStorage();
    const token = storage ? await storage.getItem('accessToken') : null;
    if (!token) {
      return { success: false, error: 'Authentication required' };
    }

    // Prefer legacy query route used by admin UI, then nested route.
    // Rebuild FormData per attempt — fetch can consume the body.
    const urls = [
      buildApiUrl(`/admin/calculator-files/upload?folder=${encodeURIComponent(folder)}`),
      buildApiUrl(`/admin/calculator-files/folders/${encodeURIComponent(folder)}/upload`),
    ];

    let lastError = 'Upload failed';
    for (const url of urls) {
      const formData = new FormData();
      if (typeof File !== 'undefined' && file.file instanceof File) {
        formData.append('file', file.file, file.name);
      } else if (file.uri) {
        formData.append('file', {
          uri: file.uri,
          name: file.name,
          type: file.type || 'application/vnd.ms-excel.sheet.macroEnabled.12',
        } as any);
      } else {
        return { success: false, error: 'No file selected' };
      }

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: formData,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Browser often reports IIS/Cloudflare 413 / connection reset as "Failed to fetch"
        if (/failed to fetch|networkerror|load failed/i.test(msg)) {
          lastError =
            `Network error uploading ${file.name} (${Math.round((file.file?.size || 0) / 1048576)}MB). ` +
            'The API host likely rejected a large body (IIS default ~28MB). ' +
            'Raise maxAllowedContentLength to 100MB on the server (see backend web.config), then retry.';
          // Don't retry alternate URL for transport failures — same proxy limit
          return { success: false, error: lastError };
        }
        lastError = msg || 'Upload failed';
        continue;
      }

      const text = await response.text();
      let parsed: any = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        if (response.status === 413) {
          return {
            success: false,
            error:
              'Upload rejected: file too large for the API host (413). ' +
              'Raise IIS maxAllowedContentLength to 100MB (backend web.config) and retry.',
          };
        }
        lastError =
          parsed?.message ||
          parsed?.error ||
          (text && !text.trim().startsWith('<') ? text : null) ||
          `Upload failed (${response.status})`;
        // Try alternate route on 404 only
        if (response.status === 404) continue;
        return { success: false, error: lastError };
      }

      if (parsed?.success === false) {
        return { success: false, error: parsed.error || parsed.message || 'Upload failed' };
      }

      const payload = parsed?.data ?? parsed ?? {};
      return {
        success: true,
        data: {
          folder: (payload.folderId || payload.folder || folder) as CalculatorFolderKey,
          fileName: String(payload.fileName || payload.name || file.name),
          size: Number(payload.size || file.file?.size || 0),
          overwritten: Boolean(payload.overwritten),
        },
      };
    }

    return { success: false, error: lastError };
  },

  deleteFile: (folder: CalculatorFolderKey, fileName: string) =>
    api.delete<{ success: boolean }>(
      `/admin/calculator-files/folders/${encodeURIComponent(folder)}/files/${encodeURIComponent(fileName)}`,
    ),
};

export const trainingApi = {
  getTemplates: () => api.get<{
    scenarios: unknown[];
    tariffReference: unknown;
    howToGuides: unknown[];
  }>('/training/scenarios/templates'),

  getMyProgram: () => api.get<{ program: TrainingProgram | null }>('/training/my-program'),

  startProgram: (userId: string) =>
    api.post<TrainingProgram>('/training/programs', { userId }),

  listPrograms: (status?: TrainingProgramStatus) => {
    const query = status ? `?status=${status}` : '';
    return api.get<{ programs: TrainingProgram[] }>(`/training/programs${query}`);
  },

  getProgram: (programId: string) => api.get<TrainingProgram>(`/training/programs/${programId}`),

  cancelProgram: (programId: string) =>
    api.patch<{ success: boolean }>(`/training/programs/${programId}/cancel`, {}),

  reviewScenario: (scenarioId: string, adminNotes?: string) =>
    api.patch<TrainingScenario>(`/training/scenarios/${scenarioId}/review`, { adminNotes }),
};