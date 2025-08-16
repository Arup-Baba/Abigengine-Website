import { MAIN_BACKEND_URL, USER_DATA_BACKEND_URL, MSG91_WIDGET_ID, MSG91_TOKEN_AUTH } from './config.js';

// --- Central Application State ---
export let carDatabase = null;
export let allUsers = []; // Holds all users for the admin panel.
export let services = [];
export let reviews = [];
export let reels = [];
export let testimonials = [];
export let banners = [];
export let bookings = [];
export let allOrders = []; // Holds ALL orders for the admin panel.
export let userOrders = []; // Holds only the logged-in user's orders.

export const setCarDatabase = (data) => { carDatabase = data; };
export const setAllUsers = (data) => { allUsers = data; };
export const setServices = (data) => { 
    services = data; 
    const allSegments = [...new Set(data.map(s => s.segment))].filter(Boolean).sort();
    // If the currently selected segment is no longer valid (or was never set), default to the first available one.
    if (allSegments.length > 0 && !allSegments.includes(adminSelectedServiceSegment)) {
        adminSelectedServiceSegment = allSegments[0];
    }
};
export const setReviews = (data) => { reviews = data; };
export const setReels = (data) => { reels = data; };
export const setTestimonials = (data) => { testimonials = data; };
export const setBanners = (data) => { banners = data; };
export const setBookings = (data) => { bookings = data; };
export const setAllOrders = (data) => { allOrders = data; };
export const setUserOrders = (data) => { userOrders = data; };


// --- Backend & Admin State ---
export let backendUrl = MAIN_BACKEND_URL.startsWith('REPLACE_WITH') ? '' : MAIN_BACKEND_URL;
export let userDataBackendUrl = USER_DATA_BACKEND_URL.startsWith('REPLACE_WITH') ? '' : USER_DATA_BACKEND_URL;
export let msg91WidgetId = MSG91_WIDGET_ID.startsWith('REPLACE_WITH') ? '' : MSG91_WIDGET_ID;
export let msg91TokenAuth = MSG91_TOKEN_AUTH.startsWith('REPLACE_WITH') ? '' : MSG91_TOKEN_AUTH;
export let adminSelectedServiceSegment = 'Car Wash';
export let orderFilters = { status: '', searchQuery: '' };

export const setBackendUrl = (url) => { backendUrl = url; };
export const setUserDataBackendUrl = (url) => { userDataBackendUrl = url; };
export const setMsg91WidgetId = (id) => { msg91WidgetId = id; };
export const setMsg91TokenAuth = (token) => { msg91TokenAuth = token; };
export const setAdminSelectedServiceSegment = (segment) => { adminSelectedServiceSegment = segment; };
export const setOrderFilters = (filters) => { 
    orderFilters = filters; 
};


// --- Session State ---
export let isLoggedIn = false;
export let userDetails = null;
export let cart = [];
export let currentOrder = { paymentMethod: '' };
export let selectionState = { step: 'brand', brand: null, model: null, variant: null };
export let tyreFilters = { brand: '', width: '', profile: '', radius: '' };
export let guestSelectedCar = null;


// --- Modal State ---
export let currentBookingServiceId = null;
export let currentBookingSelection = { date: null, time: null };
export let currentReviewServiceId = null;
export let mediaUploadTargetInputId = null;
export let tempAuthMobile = null;

export const setTyreFilters = (filters) => { tyreFilters = filters; };

export const resetTyreFilters = () => {
    setTyreFilters({ brand: '', width: '', profile: '', radius: '' });
};

export const updateTyreFiltersFromUserCar = () => {
    const variant = userDetails?.selectedVariant || guestSelectedCar?.selectedVariant;
    if (variant?.front_tyres) {
        const { width, profile, radius } = variant.front_tyres;
        setTyreFilters({
            brand: '', // Brand filter remains independent for user choice
            width: width || '',
            profile: profile || '',
            radius: radius || '',
        });
    } else {
        resetTyreFilters();
    }
};

export const setCurrentBookingServiceId = (id) => { currentBookingServiceId = id; };
export const setCurrentBookingSelection = (selection) => { currentBookingSelection = selection; };
export const setCurrentReviewServiceId = (id) => { currentReviewServiceId = id; };
export const setMediaUploadTargetInputId = (id) => { mediaUploadTargetInputId = id; };
export const setTempAuthMobile = (mobile) => { tempAuthMobile = mobile; };
export const setGuestSelectedCar = (car) => {
    guestSelectedCar = car;
    if (car) {
        localStorage.setItem('guestSelectedCar', JSON.stringify(car));
    } else {
        localStorage.removeItem('guestSelectedCar');
    }
    // Update tyre filters when guest selects/deselects a car
    updateTyreFiltersFromUserCar();
};

/**
 * Sets the user's logged-in status and manages local storage for persistent sessions.
 * On logout, it clears all user-specific data from state and storage.
 * @param status - The new login status.
 * @param details - The user's details (profile and orders) on login, or null on logout.
 */
export const setLoggedIn = (status, details) => {
    isLoggedIn = status;
    if (status && details) {
        // Ensure selectedVariant is an object, not a string
        if (details.profile.selectedVariant && typeof details.profile.selectedVariant === 'string') {
            try {
                details.profile.selectedVariant = JSON.parse(details.profile.selectedVariant);
            } catch (e) {
                console.error("Failed to parse selectedVariant JSON from profile data:", e);
                (details.profile).selectedVariant = undefined;
            }
        }
        
        // User's car takes precedence. Clear guest car selection.
        setGuestSelectedCar(null); 
        
        userDetails = details.profile;
        setUserOrders(details.orders);
        localStorage.setItem('loggedInUserSession', JSON.stringify(details));

        // Now update filters based on the new userDetails.
        updateTyreFiltersFromUserCar();

    } else {
        // Clear user-specific state on logout
        userDetails = null;
        setUserOrders([]);
        cart = []; // Also clear the cart on logout
        localStorage.removeItem('loggedInUserSession');
        
        // Re-evaluate filters based on potential guest car
        updateTyreFiltersFromUserCar();
    }
};

/**
 * Populates the state with the logged-in user's data.
 * @param profile - The user's profile information.
 * @param orders - The user's order history.
 */
export const setSessionData = (profile, orders) => {
    isLoggedIn = true;
    
    // Ensure selectedVariant is an object, not a string
    if (profile.selectedVariant && typeof profile.selectedVariant === 'string') {
        try {
            profile.selectedVariant = JSON.parse(profile.selectedVariant);
        } catch (e) {
            console.error("Failed to parse selectedVariant JSON from session data:", e);
            (profile).selectedVariant = undefined;
        }
    }

    userDetails = profile;
    setUserOrders(orders);
    
    // Update filters from the restored session data
    updateTyreFiltersFromUserCar();
};


export const setUserDetails = (details) => { 
    userDetails = details; 
    // Also update local storage if the user is logged in
    if (isLoggedIn && userDetails) {
        const sessionData = { profile: userDetails, orders: userOrders };
        localStorage.setItem('loggedInUserSession', JSON.stringify(sessionData));
    }
    // Update filters whenever user details change (e.g. after profile save)
    updateTyreFiltersFromUserCar();
};
export const setCart = (newCart) => { cart = newCart; };
export const setCurrentOrderPaymentMethod = (method) => { currentOrder.paymentMethod = method; };
export const setSelectionState = (state) => { selectionState = state; };
export const resetSelectionState = () => {
    selectionState = { step: 'brand', brand: null, model: null, variant: null };
};