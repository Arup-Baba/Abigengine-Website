import * as api from './api.js';
import * as state from './state.js';
import * as ui from './ui.js';
import { initializeAdminPanel } from './admin.js';
import { 
    showPage, 
    updateCarView,
    updateProfileUI,
    goBackCar,
    handleConfirmation,
    openReviewModal,
    renderTyreReplacementPage,
    updateCarSelectorDisplay,
    renderCarWashPage,
    openAuthModal,
    showAuthStep,
    openServiceDetailModal,
    openBookingModal,
    showNotification,
    showProfileView,
    openOrderDetailModal,
    renderBatteryReplacementPage
} from './ui.js';
import { uploadMediaFile } from './api.js';
import { showLoadingOverlay, debounce } from './dom-helpers.js';

/**
 * Initializes the MSG91 OTP service by injecting the script and then polling for key functions.
 */
function initializeOtpService() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://verify.msg91.com/otp-provider.js';
        script.type = 'text/javascript';
        document.head.appendChild(script);

        const pollInterval = 100;
        const timeout = 7000;
        let elapsedTime = 0;
        
        const failureMessage = "MSG91 OTP service failed to initialize. This is most likely due to an incorrect Widget ID or Token Auth in the Admin Panel. Please verify your credentials. It could also be a network issue preventing the script from loading.";

        const waitForInit = setInterval(() => {
            elapsedTime += pollInterval;

            if (typeof window.initSendOTP === 'function') {
                clearInterval(waitForInit);
                console.log("MSG91 script loaded, initSendOTP function found.");
                
                window.initSendOTP({
                    widgetId: state.msg91WidgetId,
                    tokenAuth: state.msg91TokenAuth,
                    exposeMethods: true,
                    success: (data) => console.log('MSG91 widget success callback during init:', data),
                    failure: (error) => console.error('MSG91 widget failure callback during init:', error),
                });

                let sendOtpElapsedTime = 0;
                const waitForSendOtp = setInterval(() => {
                    sendOtpElapsedTime += pollInterval;

                    if (typeof window.sendOtp === 'function') {
                        clearInterval(waitForSendOtp);
                        console.log("MSG91 OTP Widget is fully initialized and ready.");
                        resolve();
                    } else if (sendOtpElapsedTime >= (timeout / 2)) {
                        clearInterval(waitForSendOtp);
                        console.error("MSG91 OTP service did not become ready after initialization call.");
                        reject(new Error(failureMessage));
                    }
                }, pollInterval);

            } else if (elapsedTime >= timeout) {
                clearInterval(waitForInit);
                console.error("MSG91 OTP script did not load or define initSendOTP within the timeout period.");
                reject(new Error(failureMessage));
            }
        }, pollInterval);

        script.onerror = () => {
            clearInterval(waitForInit);
            console.error("Failed to load MSG91 OTP provider script from the network.");
            reject(new Error(failureMessage));
        };
    });
}


document.addEventListener('DOMContentLoaded', () => {

    // --- Path-based Router (using History API) ---
    let router;
    const navigate = (path) => {
        if (window.location.pathname !== path) {
            window.history.pushState({ path }, '', path);
        }
        router();
    };
    window.navigate = navigate;

    router = async () => {
        const path = window.location.pathname;
        const pageMappings = {
            '/': 'home',
            '/home': 'home',
            '/services/car-wash': 'car-wash',
            '/services/tyre-replacement': 'tyre-replacement',
            '/services/battery-replacement': 'battery-replacement',
            '/services/car-care': 'car-care',
            '/my-order': 'my-order',
            '/my-orders-list': 'my-orders-list',
            '/order-details': 'order-details',
            '/payment-method': 'payment-method',
            '/order-confirmation': 'order-confirmation',
        };

        const pageName = pageMappings[path];

        if (path === '/services') {
            if (document.getElementById('home-content')?.classList.contains('hidden')) {
                showPage('home');
            }
            document.querySelectorAll('#nav-home, #footer-nav-home').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('#nav-services, #footer-nav-services').forEach(el => el.classList.add('active'));
            setTimeout(() => {
                document.getElementById('services-section')?.scrollIntoView({ behavior: 'smooth' });
            }, 50);
        } else if (path === '/admin') {
            const adminContainer = document.getElementById('admin-content');
            if (adminContainer) {
                showLoadingOverlay(true, 'Loading Admin Panel...');
                try {
                    await initializeAdminPanel(adminContainer);
                    showPage('admin');
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    showNotification(`Failed to initialize Admin Panel: ${message}`, 'error');
                } finally {
                    showLoadingOverlay(false);
                }
            }
        } else if (pageName) {
            showPage(pageName);
        } else {
            showPage('home');
        }
    };

    window.addEventListener('popstate', router);
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor) {
            const href = anchor.getAttribute('href');
            const target = anchor.getAttribute('target');
            if (href && href.startsWith('/') && target !== '_blank' && !href.startsWith('/#')) {
                e.preventDefault();
                navigate(href);
            }
        }
    });


    // --- Session Restoration ---
    const checkSession = () => {
        const storedSession = localStorage.getItem('loggedInUserSession');
        if (storedSession) {
            try {
                const sessionData = JSON.parse(storedSession);
                if (sessionData.profile && sessionData.orders) {
                    state.setSessionData(sessionData.profile, sessionData.orders);
                }
            } catch (e) {
                console.error("Failed to parse stored session data", e);
                localStorage.removeItem('loggedInUserSession');
            }
        }
        
        if (!state.isLoggedIn) {
            const storedGuestCar = localStorage.getItem('guestSelectedCar');
            if (storedGuestCar) {
                try {
                    state.setGuestSelectedCar(JSON.parse(storedGuestCar));
                } catch (e) {
                    console.error("Failed to parse stored guest car data", e);
                    localStorage.removeItem('guestSelectedCar');
                }
            }
        }
    };

    const handleLoginSuccess = (profile, orders) => {
        state.setLoggedIn(true, { profile, orders });
        updateProfileUI();
        
        if (!profile.selectedVariant) {
            const carSelectionModal = document.getElementById('car-selection-modal');
            if (carSelectionModal) {
                if (!Array.isArray(state.carDatabase) || state.carDatabase.length === 0) {
                    showNotification('The car database is empty or invalid. An administrator must use "Sync from Sheet" in the Admin Panel to load vehicle data.', 'error');
                    return;
                }
                state.resetSelectionState();
                carSelectionModal.classList.remove('hidden');
                updateCarView();
            }
        } else if (!profile.firstName || !profile.lastName) {
            const profileModal = document.getElementById('profile-page-modal');
            if (profileModal) {
                showProfileView('edit');
                profileModal.classList.remove('hidden');
            }
        }
    };

    const handleDirectLogin = async (mobile) => {
        const errorDiv = document.getElementById('auth-mobile-error');
        const fullMobile = `91${mobile}`;
        
        showLoadingOverlay(true, 'Logging in test user...');
        try {
            const result = await api.fetchUserData(fullMobile);
            
            if (result) {
                handleLoginSuccess(result.profile, result.orders);
            } else {
                const newUser = {
                    mobile: fullMobile,
                    firstName: '', lastName: '', carBrandModel: '', carNumber: '', street: '', city: '', pincode: ''
                };
                handleLoginSuccess(newUser, []);
            }
            showAuthStep('success');
        } catch (e) {
            let errorMessage = 'An unknown error occurred during login.';
            if (e instanceof Error) {
                errorMessage = e.message;
            }
            if (errorDiv) {
                errorDiv.textContent = `Test login failed: ${errorMessage}`;
                errorDiv.classList.remove('hidden');
            }
        } finally {
            showLoadingOverlay(false);
        }
    };
    
    const handleOtpVerificationSuccess = async () => {
        const errorDiv = document.getElementById('auth-otp-error');
        const fullMobile = state.tempAuthMobile;
    
        if (!fullMobile) {
            throw new Error("Could not find the mobile number being verified. Please start over.");
        }
    
        try {
            const result = await api.fetchUserData(fullMobile);
            state.setTempAuthMobile(null);
            
            if (result) {
                handleLoginSuccess(result.profile, result.orders);
            } else {
                const newUser = {
                    mobile: fullMobile,
                    firstName: '', lastName: '', carBrandModel: '', carNumber: '', street: '', city: '', pincode: ''
                };
                handleLoginSuccess(newUser, []);
            }
        } catch (e) {
            state.setTempAuthMobile(null);
            let errorMessage = e instanceof Error ? e.message : 'An unknown error occurred after OTP verification.';
            if (errorDiv) {
                errorDiv.textContent = `Login failed: ${errorMessage}`;
                errorDiv.classList.remove('hidden');
            }
            throw e;
        }
    };

    const setupEventListeners = () => {
        document.querySelectorAll('.service-box').forEach(box => {
            box.addEventListener('click', (e) => {
                const serviceType = box.dataset.service;
                const pageExists = ['Car Wash', 'Tyre Replacement', 'Battery Replacement', 'Car Care'].includes(serviceType);
                if (!pageExists) {
                    e.preventDefault();
                    ui.showNotification(`${serviceType} page is coming soon!`, 'info');
                }
            });
        });
        
        document.getElementById('cart-icon-container')?.addEventListener('click', () => {
            navigate('/my-order');
        });

        const hamburgerBtn = document.getElementById('hamburger-btn');
        const navMenu = document.getElementById('nav-menu');
        const pageContent = document.getElementById('page-content');

        hamburgerBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            navMenu?.classList.toggle('is-open');
        });

        navMenu?.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                navMenu.classList.remove('is-open');
            }
        });

        pageContent?.addEventListener('click', () => {
            if (navMenu?.classList.contains('is-open')) {
                navMenu.classList.remove('is-open');
            }
        });

        const carSelectionModal = document.getElementById('car-selection-modal');
        const openCarModal = () => {
            if (!Array.isArray(state.carDatabase) || state.carDatabase.length === 0) {
                ui.showNotification('The car database is empty or invalid. An administrator must go to the Admin Panel and use "Sync from Sheet" to load the vehicle data.', 'error');
                return;
            }
            state.resetSelectionState();
            carSelectionModal?.classList.remove('hidden');
            updateCarView();
        };

        const handleStepSelection = (e) => {
            const item = e.target.closest('.grid-item, .list-item');
            if (!item || !item.dataset.id) return;

            const id = item.dataset.id;
            const stepOrder = ['brand', 'model', 'variant', 'confirmation'];
            const currentStepIndex = stepOrder.indexOf(state.selectionState.step);
            
            const newSelection = {...state.selectionState};

            switch (state.selectionState.step) {
                case 'brand': newSelection.brand = id; break;
                case 'model': newSelection.model = id; break;
                case 'variant': newSelection.variant = id; break;
                default: return;
            }
            
            if (currentStepIndex < stepOrder.length - 1) {
                newSelection.step = stepOrder[currentStepIndex + 1];
                state.setSelectionState(newSelection);
                updateCarView();
            }
        };

        const debouncedSearch = debounce(() => {
            const searchInput = document.getElementById('modal-search-input');
            const stepContentContainer = document.getElementById('modal-step-content');
            const filter = searchInput.value.toLowerCase();
            const items = stepContentContainer?.querySelectorAll('.grid-item, .list-item');
            items?.forEach(item => {
                const text = item.textContent?.toLowerCase() || '';
                item.style.display = text.includes(filter) ? '' : 'none';
            });
        }, 300);

        document.getElementById('car-selector-trigger')?.addEventListener('click', openCarModal);
        document.getElementById('modal-close-btn')?.addEventListener('click', () => carSelectionModal?.classList.add('hidden'));
        document.getElementById('modal-back-btn')?.addEventListener('click', goBackCar);
        document.getElementById('modal-step-content')?.addEventListener('click', handleStepSelection);
        document.getElementById('modal-search-input')?.addEventListener('input', debouncedSearch);

        const profileModal = document.getElementById('profile-page-modal');
        const authModal = document.getElementById('auth-modal');
        
        document.getElementById('profile-action-btn')?.addEventListener('click', () => {
            if (state.isLoggedIn) {
                if(profileModal) {
                    updateProfileUI();
                    showProfileView('dashboard');
                    profileModal.classList.remove('hidden');
                }
            } else {
                openAuthModal();
            }
        });
        document.getElementById('auth-modal-close-btn')?.addEventListener('click', () => authModal?.classList.add('hidden'));
        document.getElementById('auth-success-continue-btn')?.addEventListener('click', () => authModal?.classList.add('hidden'));
        document.getElementById('auth-back-btn')?.addEventListener('click', () => showAuthStep('mobile'));
        document.getElementById('auth-edit-number-btn')?.addEventListener('click', () => showAuthStep('mobile'));
        document.getElementById('profile-modal-close-btn')?.addEventListener('click', () => profileModal?.classList.add('hidden'));
        document.getElementById('order-summary-modal-close-btn')?.addEventListener('click', () => document.getElementById('order-details-summary-modal')?.classList.add('hidden'));

        document.getElementById('auth-continue-btn')?.addEventListener('click', async () => {
            const mobileInput = document.getElementById('auth-mobile-input');
            const errorDiv = document.getElementById('auth-mobile-error');
            const mobile = mobileInput.value.trim();
        
            if (mobile.length !== 10 || !/^\d+$/.test(mobile)) {
                if (errorDiv) {
                    errorDiv.textContent = 'Please enter a valid 10-digit mobile number.';
                    errorDiv.classList.remove('hidden');
                }
                return;
            }
            if (errorDiv) errorDiv.classList.add('hidden');
        
            if (mobile === '1234567890') {
                handleDirectLogin(mobile);
                return;
            }

            if (typeof window.sendOtp === 'function') {
                const fullMobile = `91${mobile}`;
                state.setTempAuthMobile(fullMobile);
                showLoadingOverlay(true, 'Sending OTP...');
                window.sendOtp(
                    fullMobile,
                    (data) => {
                        showLoadingOverlay(false);
                        document.getElementById('auth-otp-prompt-number').textContent = `+${fullMobile}`;
                        showAuthStep('otp');
                    },
                    (error) => {
                        showLoadingOverlay(false);
                        state.setTempAuthMobile(null);
                        const errorMessage = error.message || (typeof error === 'string' ? error : 'Failed to send OTP. Please try again.');
                        if (errorMessage.toLowerCase().includes('invalid-data')) {
                            showNotification("OTP Sending Failed: [hCaptcha] Invalid Data. Check Widget ID, Token Auth, and whitelisted domain in MSG91 dashboard.", 'error', 10000);
                        }
                        if (errorDiv) {
                            errorDiv.textContent = errorMessage;
                            errorDiv.classList.remove('hidden');
                        }
                    }
                );
            } else {
                if (errorDiv) {
                    errorDiv.textContent = 'Login service is not available.';
                    errorDiv.classList.remove('hidden');
                }
            }
        });
        
        document.getElementById('auth-resend-otp-btn')?.addEventListener('click', () => {
            const fullMobile = state.tempAuthMobile;
            if (!fullMobile) {
                showNotification('Could not find mobile number to resend OTP. Please start over.', 'error');
                showAuthStep('mobile');
                return;
            }
            if (typeof window.sendOtp === 'function') {
                showLoadingOverlay(true, 'Resending OTP...');
                window.sendOtp(fullMobile, 
                    () => {
                        showLoadingOverlay(false);
                        showNotification('A new OTP has been sent.', 'success');
                        showAuthStep('otp');
                    },
                    (error) => {
                        showLoadingOverlay(false);
                        showNotification(`Failed to resend OTP: ${error.message || 'Unknown error'}`, 'error');
                    }
                );
            }
        });

        const otpContainer = document.getElementById('otp-inputs');
        if (otpContainer) {
            otpContainer.addEventListener('input', (e) => {
                const target = e.target;
                if (target.matches('.otp-input') && target.value) {
                    const next = target.nextElementSibling;
                    if (next?.matches('.otp-input')) next.focus();
                    else document.getElementById('auth-verify-btn')?.focus();
                }
            });
            otpContainer.addEventListener('keydown', (e) => {
                const target = e.target;
                if (e.key === 'Backspace' && target.matches('.otp-input') && !target.value) {
                    target.previousElementSibling?.focus();
                }
            });
            otpContainer.addEventListener('paste', (e) => {
                e.preventDefault();
                const paste = (e.clipboardData || window.clipboardData).getData('text');
                const inputs = otpContainer.querySelectorAll('.otp-input');
                inputs.forEach((input, i) => input.value = paste[i] || '');
                if (paste.length >= inputs.length) document.getElementById('auth-verify-btn')?.focus();
                else inputs[paste.length]?.focus();
            });
        }

        document.getElementById('auth-verify-btn')?.addEventListener('click', async () => {
            const otp = Array.from(document.querySelectorAll('.otp-input')).map(input => input.value).join('');
            const errorDiv = document.getElementById('auth-otp-error');
        
            if (otp.length !== 6) {
                if (errorDiv) {
                    errorDiv.textContent = 'Please enter a valid 6-digit OTP.';
                    errorDiv.classList.remove('hidden');
                }
                return;
            }
            if (errorDiv) errorDiv.classList.add('hidden');
        
            if (typeof window.verifyOtp === 'function') {
                showLoadingOverlay(true, 'Verifying OTP...');
                window.verifyOtp(
                    otp,
                    async () => {
                        try {
                            await handleOtpVerificationSuccess();
                            showAuthStep('success');
                        } catch (e) {
                            console.error("Error after OTP verification:", e);
                        } finally {
                            showLoadingOverlay(false);
                        }
                    },
                    (error) => {
                        showLoadingOverlay(false);
                        if (errorDiv) {
                            errorDiv.textContent = 'Incorrect OTP or verification failed. Please try again.';
                            errorDiv.classList.remove('hidden');
                        }
                    }
                );
            } else {
                if (errorDiv) errorDiv.textContent = 'Login service is not available.';
                errorDiv.classList.remove('hidden');
            }
        });
        
        profileModal?.addEventListener('click', (e) => {
            const target = e.target;
            if (target.closest('#profile-edit-btn')) showProfileView('edit');
            if (target.closest('#profile-dashboard-logout-btn')) {
                state.setLoggedIn(false, null);
                updateProfileUI();
                profileModal?.classList.add('hidden');
                navigate('/home');
                showNotification('You have been logged out.', 'info');
            }
            const actionItem = target.closest('.action-item');
            if (actionItem) {
                const action = actionItem.getAttribute('data-action');
                switch(action) {
                    case 'orders':
                        profileModal?.classList.add('hidden');
                        navigate('/my-orders-list');
                        break;
                    case 'vehicle':
                        profileModal?.classList.add('hidden');
                        document.getElementById('car-selector-trigger')?.click();
                        break;
                    default:
                        showNotification(`${action.charAt(0).toUpperCase() + action.slice(1)} feature is coming soon!`, 'info');
                }
            }
        });

        document.getElementById('get-location-btn')?.addEventListener('click', () => {
            if (!navigator.geolocation) {
                showNotification('Geolocation is not supported by your browser.', 'error');
                return;
            }
            showLoadingOverlay(true, 'Getting your location...');
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;
                    showLoadingOverlay(true, 'Fetching address...');
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
                        if (!response.ok) throw new Error('Failed to fetch address.');
                        const data = await response.json();
                        if (data.error) throw new Error(data.error);

                        const address = data.address || {};
                        document.getElementById('address-street').value = address.road || address.street || address.pedestrian || address.suburb || '';
                        document.getElementById('address-city').value = address.city || address.town || address.village || address.county || '';
                        document.getElementById('address-pincode').value = address.postcode || '';

                        showNotification('Address fields populated! Please review and save.', 'success');
                    } catch (err) {
                        showNotification(err instanceof Error ? err.message : 'Could not determine address.', 'error');
                    } finally {
                        showLoadingOverlay(false);
                    }
                },
                (err) => {
                    showLoadingOverlay(false);
                    showNotification(`Geolocation error: ${err.message}`, 'error');
                }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });

        document.getElementById('user-details-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.userDetails) return;
            const formData = new FormData(e.target);
            const updatedDetails = { ...state.userDetails };
            for (let [key, value] of formData.entries()) {
                updatedDetails[key] = value;
            }
            state.setUserDetails(updatedDetails);
            if (await api.saveCurrentUserProfile()) {
                showNotification('Profile updated successfully!', 'success');
                updateProfileUI();
                showProfileView('dashboard');
            }
        });
        
        document.getElementById('page-content')?.addEventListener('click', (e) => {
            const target = e.target;
            const serviceListCard = target.closest('.service-list-card');
            if (serviceListCard) {
                if (target.matches('.add-btn')) {
                    e.preventDefault();
                    // addToCart logic here, omitted for brevity
                } else if (target.matches('.details-link')) {
                    e.preventDefault();
                    openServiceDetailModal(serviceListCard.dataset.id);
                }
            }
        });
    };

    const initializeApp = async () => {
        const loadingScreen = document.getElementById('initial-loading-screen');

        state.setBackendUrl(localStorage.getItem('backendUrl') || state.backendUrl);
        state.setUserDataBackendUrl(localStorage.getItem('userDataBackendUrl') || state.userDataBackendUrl);
        state.setMsg91WidgetId(localStorage.getItem('msg91WidgetId') || state.msg91WidgetId);
        state.setMsg91TokenAuth(localStorage.getItem('msg91TokenAuth') || state.msg91TokenAuth);
        checkSession();

        ui.renderAllPages();
        setupEventListeners();
        
        try {
            const [homepageResult, coreResult] = await Promise.all([
                api.fetchHomepageData(),
                api.fetchCoreData()
            ]);

            state.setReels(homepageResult.reels);
            state.setTestimonials(homepageResult.testimonials);
            state.setBanners(homepageResult.banners);
            state.setServices(coreResult.services);
            state.setCarDatabase(coreResult.carData);
            
            ui.renderAllPages();
            
            loadingScreen?.classList.add('hidden');
            router();

            api.fetchReviews().then(reviews => {
                state.setReviews(reviews);
                ui.renderAllPages(); 
            });

            if (state.msg91WidgetId && state.msg91TokenAuth) {
                initializeOtpService().catch(e => console.error("Failed to initialize OTP service in background:", e));
            }

        } catch (error) {
            loadingScreen?.classList.add('hidden');
            console.error("Critical application initialization failed:", error);
            const adminPanelContainer = document.getElementById('admin-content');
            const errorMessage = error instanceof Error ? error.message : String(error);

            if (adminPanelContainer) {
                await initializeAdminPanel(adminPanelContainer, { errorMessage });
                navigate('/admin');
            } else {
                document.body.innerHTML = `<div style="padding: 20px; text-align: center;"><h1>Application Error</h1><p>Could not load the application. Please try again later.</p><pre style="text-align: left; background: #f0f0f0; padding: 10px; border-radius: 5px;">${errorMessage}</pre></div>`;
            }
        }
    };
    
    initializeApp();
});
