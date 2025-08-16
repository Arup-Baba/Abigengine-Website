import * as state from './state.js';
import { showLoadingOverlay, showUploadProgress } from './dom-helpers.js';
import { showNotification } from './ui.js';

// --- Backend Data Synchronization ---

const postToBackend = async (backendUrl, action, payload, loadingMessage) => {
    if (!backendUrl) {
        alert(`Cannot perform action '${action}'. The required backend URL is not configured.`);
        return { success: false, data: null };
    }

    if (loadingMessage) showLoadingOverlay(true, loadingMessage);
    try {
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, payload }),
            mode: 'cors',
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }
        const result = await response.json();
        // Allow notFound as a "successful" response from the backend that the frontend needs to handle.
        if (result.status !== 'success' && result.status !== 'notFound') {
            throw new Error(result.message || 'An unknown error occurred on the backend.');
        }
        return { success: true, data: result };
    } catch (error) {
        console.error(`Error posting data for action '${action}':`, error);
        alert(`Failed to save data: ${error instanceof Error ? error.message : String(error)}`);
        return { success: false, data: null };
    } finally {
        if (loadingMessage) showLoadingOverlay(false);
    }
};

export const fetchAllUserDataFromAdmin = async () => {
    if (!state.userDataBackendUrl) {
        throw new Error('User Data Backend URL is not configured. Please set it in the Admin Panel.');
    }
    try {
        const url = new URL(state.userDataBackendUrl);
        url.searchParams.append('action', 'getAllData');
        const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.message || `An error occurred: ${JSON.stringify(data)}`);

        state.setAllUsers(data.users || []);
        state.setAllOrders(data.orders || []);
        state.setReviews(data.reviews || []);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Failed to fetch admin data from user backend: ${errorMessage}`);
        throw new Error(`Failed to fetch admin data from user backend: ${errorMessage}`);
    }
};

/**
 * Fetches only the data required for the homepage (reels, testimonials, banners).
 */
export const fetchHomepageData = async () => {
    if (!state.backendUrl) throw new Error('Main Backend URL not configured.');
    const url = new URL(state.backendUrl);
    url.searchParams.append('action', 'getHomepageData');
    const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message);
    return {
        reels: data.reels || [],
        testimonials: data.testimonials || [],
        banners: data.banners || []
    };
};

/**
 * Fetches the core data required for the app to be interactive (services, car database).
 */
export const fetchCoreData = async () => {
    if (!state.backendUrl) throw new Error('Main Backend URL not configured.');
    const url = new URL(state.backendUrl);
    url.searchParams.append('action', 'getCoreData');
    const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
    if (!response.ok) throw new Error(`Server responded with ${response.status}`);
    const data = await response.json();
    if (data.status !== 'success') throw new Error(data.message);
    return {
        services: data.services || [],
        carData: data.carData || null
    };
};

/**
 * Fetches non-critical review data in the background.
 */
export const fetchReviews = async () => {
    if (!state.userDataBackendUrl) {
        console.warn('User Data Backend URL not configured. Cannot fetch reviews.');
        return [];
    }
    try {
        const url = new URL(state.userDataBackendUrl);
        url.searchParams.append('action', 'getReviews');
        const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        const data = await response.json();
        if (data.status !== 'success') throw new Error(data.message);
        return data.reviews || [];
    } catch (e) {
        console.error("Failed to fetch reviews in background:", e);
        return []; // Don't block the app for this non-critical fetch
    }
};


/**
 * A utility function to fetch ALL data in parallel, used for refreshing the app state
 * after a major action like submitting a review.
 * @param {boolean} showOverlay - Whether to show the full-screen loading overlay.
 */
export const fetchAllData = async (showOverlay = true) => {
    if (showOverlay) showLoadingOverlay(true, 'Refreshing all data...');
    try {
        // Run all fetches in parallel for a full refresh
        const [homepageData, coreData, reviewsData] = await Promise.all([
            fetchHomepageData(),
            fetchCoreData(),
            fetchReviews()
        ]);
        
        // Repopulate the state
        state.setReels(homepageData.reels);
        state.setTestimonials(homepageData.testimonials);
        state.setBanners(homepageData.banners);
        state.setServices(coreData.services);
        state.setCarDatabase(coreData.carData);
        state.setReviews(reviewsData);

    } catch (error) {
        console.error('Failed to refresh all data:', error);
        throw error; // Let the caller handle the error display
    } finally {
        if (showOverlay) showLoadingOverlay(false);
    }
};


/**
 * Fetches profile and order data for a specific user from the user data backend.
 * @param mobile The user's mobile number.
 * @returns An object with the user's profile and orders, or null if not found.
 */
export const fetchUserData = async (mobile) => {
    if (!state.userDataBackendUrl) {
        throw new Error('User Data Backend URL is not configured.');
    }
    
    showLoadingOverlay(true, 'Fetching your data...');
    try {
        const url = new URL(state.userDataBackendUrl);
        url.searchParams.append('action', 'getUserData');
        url.searchParams.append('mobile', mobile);

        const response = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
        if (!response.ok) throw new Error(`Server responded with ${response.status}`);
        const result = await response.json();
        
        if (result.status === 'notFound') {
            return null; // User does not exist yet
        }
        if (result.status !== 'success') {
            throw new Error(result.message || 'Failed to get user data.');
        }

        return {
            profile: result.profile,
            orders: result.orders || [],
        };
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error; // Re-throw for the caller to handle
    } finally {
        showLoadingOverlay(false);
    }
};

/**
 * Fetches just the car database from the main backend.
 * @returns {Promise<boolean>} True on success, throws error on failure.
 */
export const fetchCarDatabase = async () => {
    if (!state.backendUrl) {
        throw new Error('Main Backend URL is not configured in the Admin Panel.');
    }
    
    try {
        const url = new URL(state.backendUrl);
        url.searchParams.append('action', 'getCarData');

        const response = await fetch(url.toString(), {
            method: 'GET',
            mode: 'cors',
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }
        const result = await response.json();

        if (result.status !== 'success') {
            throw new Error(result.message || 'An unknown error occurred on the backend.');
        }

        state.setCarDatabase(result.carData || null);
        return true;
    } catch (error) {
        console.error(`Error fetching car database:`, error);
        // Re-throw so the UI handler can display the error.
        throw error;
    }
};


export const testBackendConnection = async (url) => {
    if (!url) return { status: 'error', message: 'URL cannot be empty.' };
    try {
        const testUrl = new URL(url);
        // Test with the new granular endpoint
        testUrl.searchParams.append('action', 'getCoreData');
        
        const response = await fetch(testUrl.toString(), { method: 'GET', mode: 'cors' });
        if (!response.ok) return { status: 'error', message: `Connection failed. Server responded with status ${response.status}.`};
        const data = await response.json();
        if (data.status !== 'success') return { status: 'error', message: `Backend error: ${data.message}`};

        const requiredKeys = ['services', 'carData'];
        const missingKeys = requiredKeys.filter(key => !(key in data));
        if(missingKeys.length > 0) return { status: 'error', message: `Connection successful, but response is missing required core data: ${missingKeys.join(', ')}.`};

        return { status: 'success', message: 'Connection successful and data format is valid!' };

    } catch (error) {
        console.error("Test connection error:", error);
        return { status: 'error', message: `Request failed. Check URL, CORS policy, and browser console for details.` };
    }
};

export const testUserDataBackendConnection = async (url) => {
    if (!url) return { status: 'error', message: 'URL cannot be empty.' };
    try {
        const testUrl = new URL(url);
        // Test by fetching a non-existent user, we expect a 'notFound' status for success.
        testUrl.searchParams.append('action', 'getUserData');
        testUrl.searchParams.append('mobile', '0000000000');
        
        const response = await fetch(testUrl.toString(), { method: 'GET', mode: 'cors' });
        if (!response.ok) return { status: 'error', message: `Connection failed. Server responded with status ${response.status}.`};
        const data = await response.json();

        // A successful connection can either find nothing (for a test user) or succeed. Error is a failure.
        if (data.status === 'notFound' || data.status === 'success') {
             return { status: 'success', message: 'Connection successful to User Data backend!' };
        } else {
             return { status: 'error', message: `Backend error: ${data.message}`};
        }

    } catch (error) {
        console.error("Test user data connection error:", error);
        return { status: 'error', message: `Request failed. Check URL, CORS policy, and browser console.` };
    }
};

export const saveContent = async () => {
    const allContent = [
        ...state.services,
        ...state.reels,
        ...state.testimonials,
        ...state.banners,
    ];
    const result = await postToBackend(state.backendUrl, 'saveContentData', allContent, 'Saving content...');
    return result.success;
};

export const saveNewOrder = async (order) => {
    // This action should append a single order (sent in an array) on the backend.
    const result = await postToBackend(state.userDataBackendUrl, 'saveOrders', [order], 'Saving your order...');
    return result.success;
};

export const saveReview = async (review) => {
    if (!state.userDetails) {
        showNotification('You must be logged in to leave a review.', 'error');
        return false;
    }

    const payload = {
        ...review,
        userId: state.userDetails.mobile,
        userName: `${state.userDetails.firstName} ${state.userDetails.lastName}`.trim(),
    };

    const result = await postToBackend(state.userDataBackendUrl, 'saveReview', payload, 'Submitting your review...');
    return result.success;
};

export const updateOrderStatus = async (orderId, status) => {
    const payload = { orderId, status };
    // Don't show a full-screen loading overlay for this, as it's a small background action.
    // The UI will give immediate feedback (e.g., disabling the dropdown).
    try {
        const response = await fetch(state.userDataBackendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'updateOrderStatus', payload }),
            mode: 'cors',
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
        }
        const result = await response.json();
        if (result.status !== 'success') {
            throw new Error(result.message || 'An unknown error occurred on the backend.');
        }
        return true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showNotification(`Failed to update order status: ${message}`, 'error');
        console.error(`Error updating order status for '${orderId}':`, error);
        return false;
    }
};


export const saveCurrentUserProfile = async () => {
    if (!state.userDetails) return false;
    // This action now saves a single user's profile to the user data backend.
    const result = await postToBackend(state.userDataBackendUrl, 'saveUserData', state.userDetails, 'Saving profile...');
    return result.success;
};


export const uploadMediaFile = async (file, folder) => {
    return new Promise((resolve) => {
        if (!state.backendUrl) {
            alert('Cannot upload file. Main Backend URL is not configured.');
            resolve(null);
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File is too large. Please upload files smaller than 5MB.');
            resolve(null);
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Data = e.target?.result;
            const payload = {
                base64Data,
                fileName: file.name,
                contentType: file.type,
                folder: folder,
            };

            showUploadProgress(true, 0);
            
            try {
                // Simulate progress for user feedback as UrlFetchApp doesn't support streaming progress
                let progress = 0;
                const interval = setInterval(() => {
                    progress += 10;
                    if (progress < 90) showUploadProgress(true, progress);
                }, 200);

                const response = await fetch(state.backendUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'uploadMedia', payload }),
                    mode: 'cors',
                });

                clearInterval(interval);
                showUploadProgress(true, 95);

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Upload failed. Server responded with ${response.status}: ${errorText}`);
                }

                const result = await response.json();
                if (result.status === 'success' && result.url) {
                    showUploadProgress(true, 100);
                    setTimeout(() => showUploadProgress(false), 500);
                    resolve(result.url);
                } else {
                    throw new Error(result.message || 'An unknown upload error occurred.');
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
                showUploadProgress(false);
                resolve(null);
            }
        };
        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            alert('Failed to read the file.');
            resolve(null);
        };
        reader.readAsDataURL(file);
    });
};