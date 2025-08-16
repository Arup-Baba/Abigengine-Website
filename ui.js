
import * as state from './state.js';
import * as api from './api.js';
import { setAsyncImage, parseTyreTitle } from './dom-helpers.js';


// --- Page View Management ---
export const showPage = (pageName) => {
    const allContentIds = ['home-content', 'car-wash-content', 'battery-replacement-content', 'tyre-replacement-content', 'car-care-content', 'my-order-content', 'my-orders-list-content', 'order-details-content', 'payment-method-content', 'order-confirmation-content', 'admin-content'];
    allContentIds.forEach(id => document.getElementById(id)?.classList.add('hidden'));
    
    // Always hide the service detail modal on page navigation
    document.getElementById('service-detail-modal')?.classList.add('hidden');

    // Clear temporary guest user details when navigating away from the checkout flow
    const checkoutPages = ['my-order', 'order-details', 'payment-method', 'order-confirmation'];
    if (!state.isLoggedIn && !checkoutPages.includes(pageName)) {
        state.setUserDetails(null);
    }

    // Update nav links active state
    const servicePages = ['car-wash', 'battery-replacement', 'tyre-replacement', 'car-care'];
    const isHomePage = pageName === 'home';
    const isServicePage = servicePages.includes(pageName);

    document.querySelectorAll('#nav-home, #footer-nav-home').forEach(el => el.classList.toggle('active', isHomePage));
    document.querySelectorAll('#nav-services, #footer-nav-services').forEach(el => el.classList.toggle('active', isServicePage));


    let activeContent = null;
    switch (pageName) {
        case 'home':
            activeContent = document.getElementById('home-content');
            renderReelsSection();
            renderTestimonialsSection();
            renderBannersSection();
            break;
        case 'car-wash':
            activeContent = document.getElementById('car-wash-content');
            renderCarWashPage();
            break;
        case 'battery-replacement':
            activeContent = document.getElementById('battery-replacement-content');
            renderBatteryReplacementPage();
            break;
        case 'tyre-replacement':
            activeContent = document.getElementById('tyre-replacement-content');
            renderTyreReplacementPage();
            break;
        case 'car-care':
            activeContent = document.getElementById('car-care-content');
            renderCarCarePage();
            break;
        case 'my-order':
            activeContent = document.getElementById('my-order-content');
            renderOrderPage();
            break;
        case 'my-orders-list':
             if (!state.isLoggedIn) {
                showNotification("Please log in to view your orders.", "error");
                openAuthModal();
                return;
            }
            activeContent = document.getElementById('my-orders-list-content');
            renderMyOrdersListPage();
            break;
        case 'order-details':
            activeContent = document.getElementById('order-details-content');
            renderOrderDetailsPage();
            break;
        case 'payment-method':
            activeContent = document.getElementById('payment-method-content');
            renderPaymentMethodPage();
            break;
        case 'order-confirmation':
            activeContent = document.getElementById('order-confirmation-content');
            renderOrderConfirmationPage();
            break;
        case 'admin':
            // The content is rendered by the dynamically imported module
            activeContent = document.getElementById('admin-content');
            break;
    }

    if (activeContent) {
        activeContent.classList.remove('hidden');
        window.scrollTo(0, 0);
    }
};

export const renderAllPages = () => {
    renderReelsSection();
    renderTestimonialsSection();
    renderBannersSection();
    renderCarWashPage();
    renderTyreReplacementPage();
    renderBatteryReplacementPage();
    renderCarCarePage();
    updateProfileUI();
    updateCartCountBadge();
    // showPage('home'); // The router will now handle showing the initial page
};

// --- Review & Rating Helpers ---
function createStarRatingDisplay(rating, reviewCount, type = 'summary') {
    if (reviewCount === 0 && type === 'summary') {
        return `<div class="star-rating" aria-label="No reviews yet."><i class="far fa-star"></i><span class="review-count">New</span></div>`;
    }
    if (reviewCount === 0 && type === 'full') {
        return `<div class="star-rating" aria-label="No reviews yet."><i class="far fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i><i class="far fa-star"></i><span class="review-count">No reviews yet</span></div>`;
    }

    let starsHtml = '';
    const roundedRating = Math.round(rating * 2) / 2;
    for (let i = 1; i <= 5; i++) {
        if (roundedRating >= i) starsHtml += '<i class="fas fa-star"></i>';
        else if (roundedRating >= i - 0.5) starsHtml += '<i class="fas fa-star-half-alt"></i>';
        else starsHtml += '<i class="far fa-star"></i>';
    }

    const ratingText = type === 'summary' ? `${rating.toFixed(1)} <i class="fas fa-star"></i>` : `${rating.toFixed(1)}`;
    const countText = type === 'summary' ? `(${reviewCount})` : `(${reviewCount} ratings)`;

    return `
        <div class="star-rating" aria-label="Rated ${rating.toFixed(1)} out of 5 stars from ${reviewCount} reviews.">
            ${type === 'full' ? starsHtml : ''}
            <span class="rating-value">${ratingText}</span>
            <span class="review-count">${countText}</span>
        </div>
    `;
}

function renderReviewsList(reviews) {
    if (!reviews || reviews.length === 0) {
        return '<p class="no-data-message">No reviews for this service yet.</p>';
    }
    return `
        <div class="reviews-list">
            ${reviews.map(review => `
                <div class="review-item">
                    <div class="review-header">
                        <strong>${review.userName}</strong>
                        ${createStarRatingDisplay(review.rating, 1, 'full').replace('class="star-rating"', 'class="star-rating" style="margin-bottom:0;"').replace(/<span.*span>/g, '')}
                    </div>
                    <p class="review-comment">${review.comment}</p>
                </div>
            `).join('')}
        </div>
    `;
}

// --- Pricing Display Helper ---
function createPriceDisplay(price, mrp) {
    if (!price) return { html: '<div class="price-container"></div>', discount: 0 };

    const numericPrice = parseFloat(String(price).replace(/[^\d.]/g, ''));
    const numericMrp = mrp ? parseFloat(String(mrp).replace(/[^\d.]/g, '')) : 0;
    
    let discount = 0;
    let html = '';

    if (numericMrp > numericPrice) {
        discount = Math.round(((numericMrp - numericPrice) / numericMrp) * 100);
        html = `<div class="price-line">
                    <span class="offer-price">₹${numericPrice.toLocaleString()}</span>
                    <del class="mrp-price">₹${numericMrp.toLocaleString()}</del>
                    ${discount > 0 ? `<span class="discount">${discount}% OFF</span>` : ''}
                </div>`;
    } else {
        html = `<div class="price-line"><span class="offer-price">₹${numericPrice.toLocaleString()}</span></div>`;
    }
    return { html, discount };
}

// --- Component Creation Functions ---
const createReelCard = (reel) => {
    const card = document.createElement('div');
    card.className = 'reel-card';
    card.innerHTML = `
        <video src="${reel.videoUrl}" autoplay loop muted playsinline></video>
        <div class="reel-card-overlay">
            <h3 class="reel-card-title">${reel.title}</h3>
        </div>
    `;
    return card;
};

const createTestimonialCard = (testimonial) => {
    const card = document.createElement('div');
    card.className = 'reel-card testimonial-card'; // Reuse reel-card styles
    
    const isVideo = typeof testimonial.mediaUrl === 'string' && testimonial.mediaUrl.toLowerCase().includes('.mp4');

    const mediaTag = isVideo
        ? `<video src="${testimonial.mediaUrl}" autoplay loop muted playsinline></video>`
        : `<div class="main-image-container"><img src="" alt="Testimonial from ${testimonial.customerName}" loading="lazy"></div>`;

    card.innerHTML = `
        ${mediaTag}
        <div class="reel-card-overlay">
            <p class="testimonial-text">"${testimonial.text}"</p>
            <h3 class="reel-card-title testimonial-author">- ${testimonial.customerName}</h3>
        </div>
    `;

    if (!isVideo) {
        const img = card.querySelector('img');
        if (img && testimonial.mediaUrl) setAsyncImage(img, testimonial.mediaUrl);
    }
    return card;
};

const createBannerItem = (banner) => {
    const hasLink = banner.linkUrl && banner.linkUrl.trim() !== '';
    const wrapper = document.createElement(hasLink ? 'a' : 'div');
    wrapper.className = 'banner-item';
    if(hasLink) {
        wrapper.setAttribute('href', banner.linkUrl);
        wrapper.setAttribute('target', '_blank'); // Open in new tab for external links
        wrapper.setAttribute('rel', 'noopener noreferrer');
    }
    
    wrapper.innerHTML = `<img src="" alt="Promotional Banner" loading="lazy">`;
    const img = wrapper.querySelector('img');
    if (img && banner.imageUrl) {
        setAsyncImage(img, banner.imageUrl);
    }
    return wrapper;
};


const createServiceListCard = (service) => {
    const card = document.createElement('div');
    card.className = 'service-list-card';
    card.dataset.id = service.id;

    const reviews = state.reviews.filter(r => r.serviceId === service.id);
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    const priceInfo = createPriceDisplay(service.price, service.mrp);
    
    // Use new includedFeatures for preview, fallback to legacy features
    const featuresPreview = (service.includedFeatures && service.includedFeatures.length > 0)
        ? service.includedFeatures
        : (Array.isArray(service.features) ? service.features.map(f => ({ name: f })) : []);

    // Use modern galleryUrls for Car Wash, otherwise fallback for other types
    let primaryMediaUrl;
    if (service.segment === 'Car Wash') {
        primaryMediaUrl = service.galleryUrls?.[0];
    } else {
        primaryMediaUrl = (Array.isArray(service.imageUrls) ? service.imageUrls[0] : service.imageUrls) || service.videoSrc;
    }
        
    const isVideo = typeof primaryMediaUrl === 'string' && primaryMediaUrl.toLowerCase().includes('.mp4');

    card.innerHTML = `
        <div class="info">
            <h3>${service.title}</h3>
            ${createStarRatingDisplay(avgRating, reviews.length)}
            <ul class="features-preview">
                ${featuresPreview.slice(0, 3).map(f => `<li>${f.name}</li>`).join('')}
            </ul>
            <button class="details-link" data-id="${service.id}">${featuresPreview.length > 3 ? `+${featuresPreview.length - 3} more ` : ''}View Details</button>
            <div class="price-line-container">
                ${priceInfo.html}
            </div>
            ${service.promoText ? `<div class="promo-text">${service.promoText}</div>` : ''}
        </div>
        <div class="media">
            ${isVideo 
                ? `<video class="media-img" src="${primaryMediaUrl}" autoplay loop muted playsinline></video>`
                : `<img class="media-img" src="" alt="${service.title}" loading="lazy">`
            }
            <button class="add-btn" data-id="${service.id}">ADD</button>
        </div>
    `;

    if (!isVideo) {
        const img = card.querySelector('.media-img');
        if (img && primaryMediaUrl) {
            setAsyncImage(img, primaryMediaUrl);
        } else if (img) {
            img.parentElement?.classList.add('no-image');
        }
    }

    return card;
};

const createBatteryProductCard = (service) => {
    const card = document.createElement('div');
    card.className = 'battery-product-card';
    card.dataset.id = service.id;

    const images = (Array.isArray(service.imageUrls) ? service.imageUrls : (typeof service.imageUrls === 'string' ? [service.imageUrls] : [])).filter(Boolean);
    const reviews = state.reviews.filter(r => r.serviceId === service.id);
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    
    const priceDiv = document.createElement('div');
    priceDiv.innerHTML = createPriceDisplay(service.price, service.mrp).html;
    // Adapt price style for this card
    const offerPrice = priceDiv.querySelector('.offer-price');
    const mrpPrice = priceDiv.querySelector('.mrp-price');
    const discount = priceDiv.querySelector('.discount');
    if(offerPrice) offerPrice.className = 'current-price';
    if(mrpPrice) mrpPrice.className = 'original-price';
    if(discount) discount.className = 'discount-badge';

    const compatibleVehicles = Array.isArray(service.features) ? service.features.join(', ') : '';
    const brand = service.specifications?.Brand || service.tyre_brand || 'N/A';
    const soldBy = service.specifications?.['Sold by'] || brand;

    card.innerHTML = `
        <div class="battery-image-gallery">
            <div class="main-image-wrapper">
                <img class="main-image" src="" alt="${service.title}" loading="lazy">
            </div>
            <div class="thumbnail-list">
                ${images.map((imgUrl, index) => `
                    <img class="thumbnail ${index === 0 ? 'active' : ''}" src="" data-src="${imgUrl}" alt="Thumbnail ${index + 1}" loading="lazy">
                `).join('')}
            </div>
        </div>
        <div class="battery-details">
            <div class="battery-header">
                <h3>${service.title}</h3>
                <div class="actions">
                    <button class="action-btn-icon" aria-label="Add to wishlist"><i class="far fa-heart"></i></button>
                    <button class="action-btn-icon" aria-label="Share"><i class="fas fa-share-alt"></i></button>
                </div>
            </div>
            <div class="reviews-summary">
                ${createStarRatingDisplay(avgRating, reviews.length, 'full')}
                <span class="assured-badge">A Big Engine's Assured</span>
            </div>
            <div class="product-info-table">
                <div class="info-row">
                    <span class="label">Brand</span>
                    <span class="value">${brand}</span>
                </div>
                <div class="info-row">
                    <span class="label">Sold by</span>
                    <span class="value">${soldBy}</span>
                </div>
                <div class="info-row">
                    <span class="label">Compatible Vehicles</span>
                    <span class="value">${compatibleVehicles}</span>
                </div>
            </div>
            <div class="price-section">
                ${priceDiv.innerHTML}
            </div>
            <div class="product-actions">
                <button class="add-to-cart-btn" data-id="${service.id}">Add to Cart</button>
                <button class="buy-now-btn">Buy Now</button>
            </div>
        </div>
    `;

    const mainImage = card.querySelector('.main-image');
    const thumbnails = card.querySelectorAll('.thumbnail');
    const updateMainImage = (url) => {
        if (mainImage && url) setAsyncImage(mainImage, url);
    };

    thumbnails.forEach(thumb => {
        const thumbUrl = thumb.dataset.src;
        if (thumbUrl) {
            setAsyncImage(thumb, thumbUrl);
            thumb.addEventListener('click', () => {
                updateMainImage(thumbUrl);
                thumbnails.forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        }
    });

    if (images.length > 0) {
        updateMainImage(images[0]);
    }
    
    card.querySelector('.buy-now-btn')?.addEventListener('click', () => {
        const addToCartBtn = card.querySelector('.add-to-cart-btn');
        if (addToCartBtn) addToCartBtn.click();
        window.navigate('/my-order');
    });

    return card;
};

const createTyreCard = (service) => {
    const card = document.createElement('div');
    card.className = 'tyre-card';
    card.dataset.id = service.id;

    const features = Array.isArray(service.features) ? service.features : [];
    const specs = service.specifications ? Object.entries(service.specifications) : [];
    const images = Array.isArray(service.imageUrls) ? service.imageUrls : (typeof service.imageUrls === 'string' ? [service.imageUrls] : []);
    const reviews = state.reviews.filter(r => r.serviceId === service.id);
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;

    let productThumbnailHtml = '';
    let productThumbnailUrl = '';
    if (images.length > 0) {
        productThumbnailUrl = images[0];
        // Re-use the existing class for styling consistency. The alt text is updated.
        productThumbnailHtml = `<div class="main-image-container tyre-brand-logo"><img src="" alt="${service.title} thumbnail" loading="lazy"></div>`;
    }
    
    const cleanTitle = service.title;

    card.innerHTML = `
        <div class="tyre-card-gallery" data-current-index="0">
            <div class="main-image-container">
                <img class="main-gallery-image" src="" alt="${service.title}" loading="lazy">
                ${images.length > 1 ? `
                    <button class="carousel-btn prev" aria-label="Previous image"><i class="fas fa-chevron-left"></i></button>
                    <button class="carousel-btn next" aria-label="Next image"><i class="fas fa-chevron-right"></i></button>
                ` : ''}
            </div>
            <div class="thumbnail-container">
                ${images.map((imgUrl, index) => `
                    <div class="thumbnail-wrapper ${index === 0 ? 'active' : ''}" data-url="${imgUrl}">
                        <img class="thumbnail-image" src="" alt="thumbnail ${index+1}" loading="lazy">
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="tyre-card-details">
            <div class="tyre-title-wrapper">
                ${productThumbnailHtml}
                <h3>${cleanTitle}</h3>
            </div>
            ${createStarRatingDisplay(avgRating, reviews.length, 'full')}
            ${createPriceDisplay(service.price, service.mrp).html}
            <div class="tyre-card-tabs">
                <button class="tab-button active" data-tab="features">Features</button>
                <button class="tab-button" data-tab="specifications">Specifications</button>
                <button class="tab-button" data-tab="reviews">Reviews (${reviews.length})</button>
            </div>
            <div class="tyre-card-tab-content">
                <div class="tab-pane active" data-tab-content="features">
                    <ul class="features">
                        ${features.map(f => `<li>${f}</li>`).join('')}
                    </ul>
                </div>
                <div class="tab-pane hidden" data-tab-content="specifications">
                    ${specs.map(([key, value]) => `
                        <div class="spec-row">
                            <span class="spec-key">${key}</span>
                            <span class="spec-value">${value}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="tab-pane hidden" data-tab-content="reviews">
                    ${renderReviewsList(reviews)}
                </div>
            </div>
            <button class="add-to-cart-btn" data-id="${service.id}">Add to Cart</button>
        </div>
    `;
    
    const mainImage = card.querySelector('.main-gallery-image');
    const thumbnails = card.querySelectorAll('.thumbnail-wrapper');
    const tabs = card.querySelectorAll('.tab-button');
    const panes = card.querySelectorAll('.tab-pane');
    const productThumbnailImg = card.querySelector('.tyre-brand-logo img');
    const gallery = card.querySelector('.tyre-card-gallery');

    if (productThumbnailImg && productThumbnailUrl) {
        setAsyncImage(productThumbnailImg, productThumbnailUrl);
    }

    if (mainImage && images.length > 0) {
        setAsyncImage(mainImage, images[0]);
        
        thumbnails.forEach((thumb) => {
            const thumbImg = thumb.querySelector('.thumbnail-image');
            const thumbUrl = thumb.dataset.url;
            if(thumbImg && thumbUrl) setAsyncImage(thumbImg, thumbUrl);
        });
    }

    const updateImage = (newIndex) => {
        if (!gallery || !mainImage || !images[newIndex]) return;

        gallery.dataset.currentIndex = String(newIndex);
        setAsyncImage(mainImage, images[newIndex]);

        thumbnails.forEach((thumb, i) => {
            thumb.classList.toggle('active', i === newIndex);
        });
    };

    thumbnails.forEach((thumb, index) => {
        thumb.addEventListener('click', () => {
            if (thumb.classList.contains('active')) return;
            updateImage(index);
        });
    });

    if (gallery && images.length > 1) {
        const prevBtn = gallery.querySelector('.carousel-btn.prev');
        const nextBtn = gallery.querySelector('.carousel-btn.next');

        prevBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            let currentIndex = parseInt(gallery.dataset.currentIndex || '0');
            let newIndex = (currentIndex - 1 + images.length) % images.length;
            updateImage(newIndex);
        });

        nextBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            let currentIndex = parseInt(gallery.dataset.currentIndex || '0');
            let newIndex = (currentIndex + 1) % images.length;
            updateImage(newIndex);
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if(tab.classList.contains('active')) return;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            panes.forEach(pane => {
                pane.classList.toggle('hidden', pane.dataset.tabContent !== tab.dataset.tab);
                pane.classList.toggle('active', pane.dataset.tabContent === tab.dataset.tab);
            });
        });
    });
    
    return card;
};

const createCartItemComponent = (item) => {
    const itemElement = document.createElement('div');
    const cartItemId = `${item.id}-${item.bookingDate}-${item.bookingTime}`;
    itemElement.className = 'cart-item';
    itemElement.dataset.cartItemId = cartItemId;
    
    const bookingInfoHtml = item.bookingDate && item.bookingTime ? `
        <div class="cart-item-booking-info">
            <i class="fas fa-calendar-check"></i> ${new Date(item.bookingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short'})}, ${item.bookingTime}
        </div>
    ` : '';

    const isVideo = typeof item.thumbnailSrc === 'string' && item.thumbnailSrc.toLowerCase().includes('.mp4');

    itemElement.innerHTML = `
        <div class="cart-item-video">
            ${isVideo ? `<video src="${item.thumbnailSrc}" autoplay loop muted playsinline></video>` : `<img src="" alt="${item.name}" loading="lazy">`}
        </div>
        <div class="cart-item-details">
            <h4>${item.name}</h4>
            <p class="price">₹${item.price.toFixed(2)}</p>
            ${bookingInfoHtml}
        </div>
        <div class="cart-item-actions">
            <div class="quantity-selector">
                <button class="quantity-btn decrease">-</button>
                <input type="number" class="quantity-input" value="${item.quantity}" min="1" readonly>
                <button class="quantity-btn increase">+</button>
            </div>
            <button class="remove-item-btn">Remove</button>
        </div>
    `;
    
    if (!isVideo) {
        const img = itemElement.querySelector('img');
        if(img && item.thumbnailSrc) {
            setAsyncImage(img, item.thumbnailSrc);
        }
    }

    itemElement.querySelector('.increase')?.addEventListener('click', () => updateQuantity(cartItemId, 1));
    itemElement.querySelector('.decrease')?.addEventListener('click', () => updateQuantity(cartItemId, -1));
    itemElement.querySelector('.remove-item-btn')?.addEventListener('click', () => removeItem(cartItemId));
    
    return itemElement;
};


// --- Page Rendering Functions ---
export const renderReelsSection = () => {
    const container = document.getElementById('reels-container');
    const section = document.getElementById('reels-section');
    if (!container || !section) return;

    container.innerHTML = '';
    if (state.reels.length > 0) {
        state.reels.forEach(reel => {
            container.appendChild(createReelCard(reel));
        });
        section.classList.remove('hidden');
    } else {
        section.classList.add('hidden');
    }
};

export const renderTestimonialsSection = () => {
    const container = document.getElementById('testimonials-container');
    const section = document.getElementById('testimonials-section');
    if (!container || !section) return;

    container.innerHTML = '';
    if (state.testimonials.length > 0) {
        state.testimonials.forEach(testimonial => {
            container.appendChild(createTestimonialCard(testimonial));
        });
        section.classList.remove('hidden');
    } else {
        section.classList.add('hidden');
    }
};

export const renderBannersSection = () => {
    const container = document.getElementById('banner-container');
    const section = document.getElementById('banner-section');
    const progressBarContainer = section?.querySelector('.banner-progress-bar-container');
    if (!container || !section || !progressBarContainer) return;

    container.innerHTML = '';
    if (state.banners.length > 0) {
        state.banners.forEach(banner => {
            container.appendChild(createBannerItem(banner));
        });
        section.classList.remove('hidden');
        // Hide progress bar if there is only one banner
        progressBarContainer.classList.toggle('hidden', state.banners.length <= 1);
        
        // Also need to reset the progress bar on render
        const bannerProgressBar = document.getElementById('banner-progress-bar');
        if (bannerProgressBar) {
             bannerProgressBar.style.width = '0%';
        }
    } else {
        section.classList.add('hidden');
    }
};

export const renderCarWashPage = () => {
    const container = document.getElementById('car-wash-content')?.querySelector('.service-packages-list');
    if (!container) return;
    const carWashServices = state.services.filter(s => s.segment === 'Car Wash');

    container.innerHTML = '';
    if (carWashServices.length === 0) {
        container.innerHTML = `<p class="no-data-message">No car wash services available at the moment.</p>`;
        return;
    }

    carWashServices.forEach(service => container.appendChild(createServiceListCard(service)));
};

export const renderCarCarePage = () => {
    const container = document.getElementById('car-care-content')?.querySelector('.service-packages-list');
    if (!container) return;
    const carCareServices = state.services.filter(s => s.segment === 'Car Care');

    container.innerHTML = '';
    if (carCareServices.length === 0) {
        container.innerHTML = `<p class="no-data-message">No car care services available at the moment.</p>`;
        return;
    }

    carCareServices.forEach(service => container.appendChild(createServiceListCard(service)));
};

export const renderBatteryReplacementPage = () => {
    const container = document.getElementById('battery-replacement-content');
    if (!container) return;

    const listContainer = container.querySelector('.service-packages-list');
    if (!listContainer) return;

    const batteryServices = state.services.filter(s => s.segment === 'Battery Replacement');

    listContainer.innerHTML = '';
    if (batteryServices.length === 0) {
        listContainer.innerHTML = `<p class="no-data-message">No battery replacement services available at the moment.</p>`;
        return;
    }

    batteryServices.forEach(service => listContainer.appendChild(createBatteryProductCard(service)));
};

export const renderTyreReplacementPage = () => {
    const filterBar = document.getElementById('tyre-filter-bar');
    const container = document.getElementById('tyre-services-grid');
    if (!container || !filterBar) return;

    const allTyreServices = state.services.filter(s => s.segment === 'Tyre Replacement' && s.tyre_brand);
    
    const carIsSelected = !!(state.userDetails?.selectedVariant || state.guestSelectedCar?.selectedVariant);

    if (carIsSelected) {
        filterBar.classList.remove('hidden');
        renderTyreFilterBar();
    } else {
        filterBar.classList.add('hidden');
    }

    const { brand, width, profile, radius } = state.tyreFilters;
    const filteredServices = allTyreServices.filter(service => {
        return (!brand || (service.tyre_brand && service.tyre_brand.toLowerCase() === brand.toLowerCase())) &&
               (!width || service.tyre_width === width) &&
               (!profile || service.tyre_profile === profile) &&
               (!radius || service.tyre_radius === radius);
    });
    
    container.innerHTML = '';
    if (filteredServices.length === 0) {
        container.innerHTML = `<p class="no-data-message">No tyres match the current filter. Try adjusting the filters or selecting a different vehicle.</p>`;
    } else {
        filteredServices.forEach(service => container.appendChild(createTyreCard(service)));
    }
};

const renderTyreFilterBar = () => {
    const filterBar = document.getElementById('tyre-filter-bar');
    if (!filterBar) return;

    const allTyreServices = state.services.filter(s => s.segment === 'Tyre Replacement' && s.tyre_brand);
    
    const availableBrands = [...new Set(allTyreServices.map(s => s.tyre_brand))].filter(Boolean).sort();
    const availableWidths = [...new Set(allTyreServices.map(s => s.tyre_width))].filter(Boolean).sort((a,b) => parseInt(a) - parseInt(b));
    const availableProfiles = [...new Set(allTyreServices.map(s => s.tyre_profile))].filter(Boolean).sort((a,b) => parseInt(a) - parseInt(b));
    const availableRadii = [...new Set(allTyreServices.map(s => s.tyre_radius))].filter(Boolean).sort((a,b) => parseInt(a) - parseInt(b));

    const f = state.tyreFilters;

    filterBar.innerHTML = `
        <div class="filter-group">
            <label for="tyre-brand-filter">Brand</label>
            <select id="tyre-brand-filter" data-filter="brand">
                <option value="">All Brands</option>
                ${availableBrands.map(b => `<option value="${b}" ${f.brand.toLowerCase() === b.toLowerCase() ? 'selected' : ''}>${b}</option>`).join('')}
            </select>
        </div>
        <div class="filter-group">
            <label for="tyre-width-filter">Width</label>
            <select id="tyre-width-filter" data-filter="width">
                <option value="">All</option>
                 ${availableWidths.map(w => `<option value="${w}" ${f.width === w ? 'selected' : ''}>${w}</option>`).join('')}
            </select>
        </div>
        <div class="filter-group">
            <label for="tyre-profile-filter">Profile</label>
            <select id="tyre-profile-filter" data-filter="profile">
                <option value="">All</option>
                ${availableProfiles.map(p => `<option value="${p}" ${f.profile === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
        </div>
        <div class="filter-group">
            <label for="tyre-radius-filter">Radius</label>
            <select id="tyre-radius-filter" data-filter="radius">
                <option value="">All</option>
                ${availableRadii.map(r => `<option value="${r}" ${f.radius === r ? 'selected' : ''}>R${r}</option>`).join('')}
            </select>
        </div>
        <button class="reset-btn" id="tyre-filter-reset-btn">Reset</button>
    `;
};


// --- Auth & Profile UI ---

export function showProfileView(view) {
    const dashboardView = document.getElementById('profile-dashboard-view');
    const editView = document.getElementById('profile-edit-view');
    const profileTitle = document.getElementById('profile-modal-title');
    const modalBody = document.querySelector('#profile-page-modal .profile-modal-body');
    const modalHeader = document.querySelector('#profile-page-modal .modal-header');

    if (!dashboardView || !editView || !profileTitle || !modalBody || !modalHeader) return;

    if (view === 'dashboard') {
        dashboardView.classList.remove('hidden');
        editView.classList.add('hidden');
        profileTitle.textContent = "Profile";
        modalBody.style.padding = '0';
        modalHeader.classList.remove('hidden'); // Ensure header is visible for dashboard
    } else { // 'edit'
        dashboardView.classList.add('hidden');
        editView.classList.remove('hidden');
        profileTitle.textContent = "Edit Profile";
        modalBody.style.padding = '20px 30px';
        modalHeader.classList.remove('hidden');
    }
}

export function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    document.getElementById('auth-mobile-input').value = '';
    const otpInputs = document.querySelectorAll('.otp-input');
    otpInputs.forEach(input => (input.value = ''));
    showAuthStep('mobile');
    modal.classList.remove('hidden');
}

export function showAuthStep(step) { // 'mobile', 'otp', 'success'
    const mobileStep = document.getElementById('auth-step-mobile');
    const otpStep = document.getElementById('auth-step-otp');
    const successStep = document.getElementById('auth-step-success');
    if (!mobileStep || !otpStep || !successStep) return;

    mobileStep.classList.toggle('hidden', step !== 'mobile');
    otpStep.classList.toggle('hidden', step !== 'otp');
    successStep.classList.toggle('hidden', step !== 'success');
    
    document.getElementById('auth-mobile-error')?.classList.add('hidden');
    document.getElementById('auth-otp-error')?.classList.add('hidden');

    if (step === 'otp') {
        // Clear inputs and focus first one
        const otpInputs = document.querySelectorAll('.otp-input');
        otpInputs.forEach(input => (input.value = ''));
        (otpInputs[0])?.focus();
    }
}


export function updateCarSelectorDisplay() {
    const carSelectorTrigger = document.getElementById('car-selector-trigger');
    if (!carSelectorTrigger) return;
    const infoContainer = carSelectorTrigger.querySelector('.car-info');
    if (!infoContainer) return;

    let carInfo = null;
    if (state.isLoggedIn && state.userDetails?.selectedVariant) {
        carInfo = {
            carBrandModel: state.userDetails.carBrandModel,
            brand: state.userDetails.selectedVariant.brand,
            model: state.userDetails.selectedVariant.model,
        };
    } else if (!state.isLoggedIn && state.guestSelectedCar) {
        carInfo = {
            carBrandModel: state.guestSelectedCar.carBrandModel,
            brand: state.guestSelectedCar.selectedVariant.brand,
            model: state.guestSelectedCar.selectedVariant.model,
        }
    }

    if (carInfo && carInfo.carBrandModel && Array.isArray(state.carDatabase)) {
        const currentBrand = state.carDatabase.find(b => b.name === carInfo.brand);
        const modelImage = currentBrand?.models[carInfo.model]?.image;
        infoContainer.innerHTML = `<div class="main-image-container" style="width: 40px; height: 25px; margin: 0; border-radius: 3px;"><img alt="${carInfo.carBrandModel}" class="car-thumb"></div><span>${carInfo.carBrandModel}</span>`;
        const thumb = infoContainer.querySelector('.car-thumb');
        if (thumb && modelImage) setAsyncImage(thumb, modelImage);
    } else {
        // Reset to default
        infoContainer.innerHTML = `<i class="fas fa-car-alt"></i><span>Select Your Car</span>`;
    }
}

export const updateProfileUI = () => {
    const loggedOutView = document.getElementById('logged-out-view');
    const loggedInView = document.getElementById('logged-in-view');
    const userDisplay = document.getElementById('user-display');
    if (state.isLoggedIn && state.userDetails) {
        loggedOutView?.classList.add('hidden');
        loggedInView?.classList.remove('hidden');
        if (userDisplay) {
            userDisplay.textContent = state.userDetails.firstName 
                ? `Welcome, ${state.userDetails.firstName}` 
                : 'My Profile';
        }
        
        // New dashboard population
        const dashboardName = document.getElementById('profile-dashboard-name');
        const dashboardEmail = document.getElementById('profile-dashboard-email');
        if (dashboardName) dashboardName.textContent = state.userDetails.firstName ? `${state.userDetails.firstName} ${state.userDetails.lastName}`.trim() : 'User Name';
        if (dashboardEmail) dashboardEmail.textContent = state.userDetails.mobile ? `+${state.userDetails.mobile}` : 'username@example.com';
        
        const cartCount = document.getElementById('profile-cart-count');
        const ordersCount = document.getElementById('profile-orders-count');
        if (cartCount) cartCount.textContent = String(state.cart.reduce((sum, item) => sum + item.quantity, 0)).padStart(2, '0');
        if (ordersCount) ordersCount.textContent = String(state.userOrders.length).padStart(2, '0');

        // Populate the form in the edit view
        document.getElementById('first-name').value = state.userDetails.firstName || '';
        document.getElementById('last-name').value = state.userDetails.lastName || '';
        document.getElementById('mobile-number').value = state.userDetails.mobile || '';
        document.getElementById('car-details').value = state.userDetails.carBrandModel || '';
        document.getElementById('car-number').value = state.userDetails.carNumber || '';
        document.getElementById('address-street').value = state.userDetails.street || '';
        document.getElementById('address-city').value = state.userDetails.city || '';
        document.getElementById('address-pincode').value = state.userDetails.pincode || '';
        
    } else {
        loggedOutView?.classList.remove('hidden');
        loggedInView?.classList.add('hidden');
    }
    updateCarSelectorDisplay();
    updateCartCountBadge();
};

// --- Cart & Checkout Flow ---
export const updateCartCountBadge = () => {
    const cartItemCountBadge = document.getElementById('cart-item-count');
    if (!cartItemCountBadge) return;
    const totalItems = state.cart.reduce((sum, item) => sum + item.quantity, 0);
    cartItemCountBadge.textContent = String(totalItems);
    cartItemCountBadge.classList.toggle('hidden', totalItems === 0);
};

const updateOrderSummary = () => {
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    document.getElementById('cart-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
    document.getElementById('cart-tax').textContent = `₹${tax.toFixed(2)}`;
    document.getElementById('cart-total').textContent = `₹${total.toFixed(2)}`;
};

export const renderOrderPage = () => {
    const container = document.getElementById('order-view-container');
    if (!container) return;

    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart-view">
                <i class="fas fa-shopping-cart"></i>
                <h3>Your Cart is Empty</h3>
                <p>Looks like you haven't booked any services yet.</p>
                <a href="/services" class="btn" id="shop-now-btn">Book a Service</a>
            </div>
        `;
        return;
    }

    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    let checkoutBtnDisabled = false;
    let checkoutTooltip = '';

    if (state.isLoggedIn && state.userDetails) {
        const { street, city, pincode } = state.userDetails;
        if (!street || !city || !pincode) {
            checkoutBtnDisabled = true;
            checkoutTooltip = 'Please complete your address in My Profile before checking out.';
        }
    }


    container.innerHTML = `
        <div class="order-layout">
            <div class="cart-items-list"></div>
            <div class="order-summary">
                <h3>Order Summary</h3>
                <div class="summary-row"><span>Subtotal</span><span id="cart-subtotal">₹${subtotal.toFixed(2)}</span></div>
                <div class="summary-row"><span>Taxes & Fees</span><span id="cart-tax">₹${tax.toFixed(2)}</span></div>
                <div class="summary-row total"><span>Total</span><span id="cart-total">₹${total.toFixed(2)}</span></div>
                <button class="checkout-btn" id="proceed-to-checkout-btn" ${checkoutBtnDisabled ? 'disabled' : ''} title="${checkoutTooltip}">Proceed to Checkout</button>
                ${checkoutTooltip ? `<p style="font-size:12px; color:var(--error-color); text-align:center; margin-top:10px;">${checkoutTooltip}</p>`: ''}
            </div>
        </div>
    `;
    
    const cartItemsList = container.querySelector('.cart-items-list');
    if (cartItemsList) {
        state.cart.forEach(item => cartItemsList.appendChild(createCartItemComponent(item)));
    }
    
    container.querySelector('#proceed-to-checkout-btn')?.addEventListener('click', () => {
        if (!state.isLoggedIn) {
            if (!state.msg91WidgetId) {
                showNotification("Please log in to continue.", "info");
                openAuthModal();
            } else {
                showNotification("Please log in using the 'My Profile' button to continue.", "info");
            }
        } else if (!state.userDetails?.street || !state.userDetails?.city || !state.userDetails.pincode) {
            showNotification('Please complete your address details in "My Profile" before checking out.', "error");
            document.getElementById('profile-page-modal')?.classList.remove('hidden');
        } else {
            window.navigate('/order-details');
        }
    });
};

const updateQuantity = (cartItemId, change) => {
    const item = state.cart.find(i => `${i.id}-${i.bookingDate}-${i.bookingTime}` === cartItemId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeItem(cartItemId);
        } else {
            // Targeted DOM update
            const itemElement = document.querySelector(`.cart-item[data-cart-item-id="${cartItemId}"]`);
            if (itemElement) {
                itemElement.querySelector('.quantity-input').value = String(item.quantity);
            }
            updateOrderSummary();
            updateCartCountBadge();
        }
    }
};

const removeItem = (cartItemId) => {
    state.setCart(state.cart.filter(i => `${i.id}-${i.bookingDate}-${i.bookingTime}` !== cartItemId));
    
    const itemElement = document.querySelector(`.cart-item[data-cart-item-id="${cartItemId}"]`);
    itemElement?.remove();
    
    if (state.cart.length === 0) {
        renderOrderPage();
    } else {
        updateOrderSummary();
    }
    updateCartCountBadge();
};

const renderCheckoutProgressBar = (activeStep) => {
    const steps = ['Details', 'Payment', 'Confirm'];
    let html = '<div class="checkout-progress-bar">';
    steps.forEach((index, i) => {
        const stepState = i < activeStep ? 'completed' : (i === activeStep ? 'active' : '');
        html += `<div class="progress-node ${stepState}"><div class="progress-icon">${i + 1}</div><div class="progress-label">${steps[i]}</div></div>`;
        if (i < steps.length - 1) html += `<div class="progress-connector"></div>`;
    });
    html += '</div>';
    return html;
};

export const renderOrderDetailsPage = () => {
    const container = document.getElementById('order-details-view-container');
    const progressContainer = document.getElementById('checkout-progress-bar-container');
    if (!container || !progressContainer || !state.userDetails) return;

    progressContainer.innerHTML = renderCheckoutProgressBar(0);

    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.18;
    const total = subtotal + tax;

    const { firstName, lastName, mobile, carBrandModel, carNumber, street, city, pincode } = state.userDetails;

    container.innerHTML = `
        <div class="order-details-grid">
            <div class="details-card">
                <h4>Your Information</h4>
                <div class="user-info-item"><i class="fas fa-user"></i> <span>${firstName} ${lastName}</span></div>
                <div class="user-info-item"><i class="fas fa-phone"></i> <span>${mobile}</span></div>
            </div>
             <div class="details-card">
                <h4>Shipping Address</h4>
                <div class="user-info-item"><i class="fas fa-map-marker-alt"></i> <span>${street}, ${city}, ${pincode}</span></div>
            </div>
            <div class="details-card">
                <h4>Vehicle Details</h4>
                <div class="user-info-item"><i class="fas fa-car"></i> <span>${carBrandModel}</span></div>
                <div class="user-info-item"><i class="fas fa-hashtag"></i> <span>${carNumber || 'Not provided'}</span></div>
            </div>
             <div class="order-summary-card">
                <h4>Order Summary</h4>
                <div class="summary-items-container">
                    ${state.cart.map(item => `
                        <div class="summary-item">
                            <span>${item.name} (x${item.quantity})</span>
                            <span>₹${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="summary-row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
                <div class="summary-row"><span>Taxes & Fees</span><span>₹${tax.toFixed(2)}</span></div>
                <div class="summary-row total"><span>Total</span><span>₹${total.toFixed(2)}</span></div>
            </div>
        </div>
        <button class="checkout-btn" id="proceed-to-payment-btn">Proceed to Payment</button>
    `;
    
    document.getElementById('proceed-to-payment-btn')?.addEventListener('click', () => {
        window.navigate('/payment-method');
    });
};


export const renderPaymentMethodPage = () => {
    const container = document.getElementById('payment-method-view-container');
    const progressContainer = document.getElementById('checkout-progress-bar-container-payment');
    if (!container || !progressContainer) return;
    
    progressContainer.innerHTML = renderCheckoutProgressBar(1);

     const total = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 1.18;

    container.innerHTML = `
        <div class="payment-layout">
            <div class="payment-options">
                <h4>Choose Payment Method</h4>
                <label class="payment-option">
                    <input type="radio" name="payment-method" value="COD" checked>
                    <i class="fas fa-money-bill-wave"></i>
                    <div>
                        <strong>Cash on Delivery</strong>
                        <p>Pay upon service completion</p>
                    </div>
                </label>
                 <label class="payment-option">
                    <input type="radio" name="payment-method" value="UPI" disabled>
                     <i class="fab fa-google-pay"></i>
                    <div>
                        <strong>UPI (Google Pay, PhonePe, etc)</strong>
                        <p style="color: var(--text-muted);">Coming soon</p>
                    </div>
                </label>
                 <label class="payment-option">
                    <input type="radio" name="payment-method" value="Card" disabled>
                     <i class="fas fa-credit-card"></i>
                    <div>
                        <strong>Credit/Debit Card</strong>
                         <p style="color: var(--text-muted);">Coming soon</p>
                    </div>
                </label>
            </div>
            <div class="order-summary">
                <h3>Order Summary</h3>
                <div class="summary-row total"><span>Total</span><span>₹${total.toFixed(2)}</span></div>
                 <button class="checkout-btn" id="place-order-btn">Place Order</button>
            </div>
        </div>
    `;

    document.getElementById('place-order-btn')?.addEventListener('click', async () => {
        const selectedMethod = document.querySelector('input[name="payment-method"]:checked').value;
        state.setCurrentOrderPaymentMethod(selectedMethod);
        
        window.navigate('/order-confirmation');
    });
};

export const renderOrderConfirmationPage = async () => {
    const container = document.getElementById('order-confirmation-view-container');
    const progressContainer = document.getElementById('checkout-progress-bar-container-confirmation');
    if (!container || !progressContainer || !state.userDetails) return;
    
    container.innerHTML = '<div class="loading-spinner" style="margin: 80px auto;"></div><p style="text-align:center;">Placing your order...</p>';
    progressContainer.innerHTML = renderCheckoutProgressBar(2);

    const { firstName, lastName, mobile, street, city, pincode } = state.userDetails;
    const totalAmount = state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 1.18;
    const serviceTypes = [...new Set(state.cart.map(item => {
        const service = state.services.find(s => s.id === item.id);
        return service?.segment || 'Unknown';
    }))];
    
    const newOrder = {
        orderId: `order_${Date.now()}`,
        userId: mobile,
        userName: `${firstName} ${lastName}`,
        orderDate: new Date().toISOString(),
        items: state.cart,
        totalAmount: totalAmount,
        paymentMethod: state.currentOrder.paymentMethod,
        status: 'Placed',
        shippingAddress: `${street}, ${city}, ${pincode}`,
        serviceTypes: serviceTypes
    };

    const saved = await api.saveNewOrder(newOrder);

    if (!saved) {
        container.innerHTML = `
            <div class="order-confirmation-view">
                <i class="fas fa-times-circle success-icon" style="color: var(--error-color);"></i>
                <h2>Order Failed</h2>
                <p>We couldn't place your order due to an error. Please try again.</p>
                <div class="confirmation-actions">
                     <button class="btn" id="try-again-btn">Try Again</button>
                </div>
            </div>`;
        document.getElementById('try-again-btn')?.addEventListener('click', () => {
            window.navigate('/payment-method');
        });
        return;
    }

    // Add to local state and clear cart
    state.userOrders.push(newOrder);
    state.setCart([]);
    updateCartCountBadge();

    container.innerHTML = `
         <div class="order-confirmation-view">
            <i class="fas fa-check-circle success-icon"></i>
            <h2>Thank You For Your Order!</h2>
            <p>Your order has been placed successfully. We will contact you shortly.</p>
            
             <div class="confirmation-summary">
                <div class="summary-header">
                    <strong>Order ID: ${newOrder.orderId}</strong>
                    <strong>Total: ₹${newOrder.totalAmount.toFixed(2)}</strong>
                </div>
                <div class="summary-details">
                    <p><strong>Payment Method:</strong> ${newOrder.paymentMethod}</p>
                    <p><strong>Shipping To:</strong> ${newOrder.shippingAddress}</p>
                </div>
            </div>
            
            <div class="review-submission-section">
                <h4>Enjoyed the service? Leave a review!</h4>
                ${newOrder.items.map(item => `
                    <div class="review-submission-item">
                        <span>${item.name}</span>
                        <button class="btn leave-review-btn" data-service-id="${item.id}">Leave Review</button>
                    </div>
                `).join('')}
            </div>

            <div class="confirmation-actions">
                <button class="btn" id="view-orders-btn">View My Orders</button>
            </div>
        </div>
    `;
    
    document.getElementById('view-orders-btn')?.addEventListener('click', () => {
        window.navigate('/my-orders-list');
    });
};

export const renderMyOrdersListPage = () => {
    const container = document.getElementById('orders-list-view-container');
    if (!container) return;
    
    if (!state.userOrders || state.userOrders.length === 0) {
        container.innerHTML = `
             <div class="empty-cart-view">
                <i class="fas fa-box-open"></i>
                <h3>No Orders Found</h3>
                <p>You haven't placed any orders with us yet.</p>
                <a href="/services" class="btn" id="shop-now-btn-orders">Book a Service</a>
            </div>
        `;
        return;
    }

    // Sort orders by date robustly, placing invalid dates last.
    const sortedOrders = [...state.userOrders].sort((a, b) => {
        const timeA = new Date(a.orderDate).getTime();
        const timeB = new Date(b.orderDate).getTime();
        // If a date is invalid, its time is NaN. Treat NaN as older than any valid date.
        if (isNaN(timeA) && isNaN(timeB)) return 0;
        if (isNaN(timeA)) return 1; // a is invalid, b is valid, so a is "older" (comes after in descending sort)
        if (isNaN(timeB)) return -1; // b is invalid, a is valid, so b is "older"
        return timeB - timeA; // both are valid, sort descending
    });

    container.innerHTML = `
        <div class="orders-list-container">
            ${sortedOrders.map(order => {
                const itemsHtml = order.items.map(item => {
                    const service = state.services.find(s => s.id === item.id);
                    let reviewButtonHtml = '';

                    if (service && state.isLoggedIn && state.userDetails) {
                        const existingReview = state.reviews.find(r => r.serviceId === item.id && r.userId === state.userDetails?.mobile);

                        if (existingReview) {
                            reviewButtonHtml = `<button class="btn edit-review-btn" data-service-id="${item.id}">Edit Review</button>`;
                        } else {
                            reviewButtonHtml = `<button class="btn leave-review-btn" data-service-id="${item.id}">Leave Review</button>`;
                        }
                    }

                    const isVideo = item.itemType === 'video';
                    return `
                        <div class="order-item-row">
                            ${isVideo ? `<video src="${item.thumbnailSrc}" autoplay loop muted playsinline></video>` : `<img src="" data-src="${item.thumbnailSrc}" alt="${item.name}" loading="lazy">`}
                            <div class="order-item-info-actions">
                                <div class="order-item-info">
                                    <button class="order-item-product-link" data-service-id="${item.id}">${item.name}</button>
                                    <span>Qty: ${item.quantity}</span>
                                    <span>Price: ₹${item.price.toFixed(2)}</span>
                                </div>
                                <div class="order-item-actions">
                                    ${reviewButtonHtml}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');

                // Safely format the order date
                const orderDate = new Date(order.orderDate);
                const displayDate = !isNaN(orderDate.getTime())
                    ? orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Invalid Date';

                return `
                <div class="order-card">
                    <div class="order-card-header">
                        <div class="order-card-header-info">
                            ORDER PLACED
                            <span>${displayDate}</span>
                        </div>
                        <div class="order-card-header-info">
                            TOTAL
                            <span>₹${order.totalAmount.toFixed(2)}</span>
                        </div>
                        <div class="order-card-header-info">
                            ORDER ID
                            <span>${order.orderId}</span>
                        </div>
                        <div class="order-status ${order.status.toLowerCase()}">${order.status}</div>
                    </div>
                    <div class="order-card-body">
                        <div class="order-card-items-list">
                            ${itemsHtml}
                        </div>
                    </div>
                    <div class="order-card-footer">
                        <button class="btn view-order-details-btn" data-order-id="${order.orderId}">View Details</button>
                    </div>
                </div>
            `}).join('')}
        </div>
    `;
    
    container.querySelectorAll('.order-item-row img[data-src]').forEach(img => {
        const url = img.dataset.src;
        if(url && url !== 'undefined') setAsyncImage(img, url);
    });
};


// --- User-Facing Modals ---

export const openServiceDetailModal = (serviceId) => {
    const modal = document.getElementById('service-detail-modal');
    const service = state.services.find(s => s.id === serviceId);
    if (!modal || !service) return;

    const modalBody = modal.querySelector('#service-detail-body-content');
    const modalFooter = modal.querySelector('#service-detail-footer-content');
    if (!modalBody || !modalFooter) return;
    
    // --- Data Gathering ---
    const reviews = state.reviews.filter(r => r.serviceId === service.id);
    const avgRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    const priceInfo = createPriceDisplay(service.price, service.mrp);

    // Gather all media URLs into a single array for the carousel
    const mediaItems = [];
    if (service.galleryUrls && service.galleryUrls.length > 0) {
        mediaItems.push(...service.galleryUrls);
    } else { // Fallback for legacy data
        if (service.videoSrc) mediaItems.push(service.videoSrc);
        if (Array.isArray(service.imageUrls)) {
            service.imageUrls.forEach(url => url && mediaItems.push(url));
        } else if (typeof service.imageUrls === 'string') {
            mediaItems.push(service.imageUrls);
        }
    }

    // --- Build Modal Body ---
    modalBody.innerHTML = `
        <div class="service-hero-carousel">
            <div class="carousel-inner">
                ${mediaItems.map(url => {
                    const isVideo = typeof url === 'string' && url.toLowerCase().includes('.mp4');
                    return `<div class="carousel-item">${isVideo ? `<video src="${url}" autoplay loop muted playsinline></video>` : `<img src="" alt="${service.title}" loading="lazy">`}</div>`;
                }).join('')}
            </div>
            ${mediaItems.length > 1 ? `<div class="carousel-dots">${mediaItems.map((_, i) => `<span class="dot ${i === 0 ? 'active' : ''}" data-slide="${i}"></span>`).join('')}</div>` : ''}
        </div>
        
        <div class="service-main-info">
            <h3>${service.title}</h3>
            <div class="info-line">
                ${createStarRatingDisplay(avgRating, reviews.length, 'full')}
                ${service.timeEstimate ? `<div class="time-estimate"><i class="far fa-clock"></i> ${service.timeEstimate}</div>` : ''}
            </div>
        </div>

        ${(service.includedFeatures && service.includedFeatures.length > 0) ? `
        <div class="service-detail-section">
            <h4>What's Included in my Service?</h4>
            <div class="included-items-carousel">
                <div class="included-items-container">
                    ${service.includedFeatures.map(f => `
                        <div class="included-item">
                            ${f.imageUrl ? `<img src="" alt="${f.name}" loading="lazy">` : `<div class="included-item-placeholder"><i class="fas fa-check"></i></div>`}
                            <span>${f.name}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>` : ''}
        
        ${(service.comparisonTable && service.comparisonTable.length > 0) ? `
        <div class="service-detail-section">
            <h4>Our Service vs. Others</h4>
            <div class="comparison-table-wrapper">
                <table class="comparison-table">
                    <thead><tr><th>Feature</th><th>A Big Engine</th><th>Local Centers</th></tr></thead>
                    <tbody>
                        ${service.comparisonTable.map(row => `
                            <tr>
                                <td>${row.feature}</td>
                                <td>
                                    <i class="fas ${row.us ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                    ${row.us_text ? `<span class="subtext">${row.us_text}</span>` : ''}
                                </td>
                                <td>
                                    <i class="fas ${row.them ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                    ${row.them_text ? `<span class="subtext">${row.them_text}</span>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : ''}

        <div class="service-detail-section">
            <h4>Recommended Add-ons</h4>
            <div class="addon-list">
                <!-- Add-ons logic can be enhanced later -->
                <p class="no-data-message">No specific add-ons for this service yet.</p>
            </div>
        </div>

        ${(service.faqs && service.faqs.length > 0) ? `
        <div class="service-detail-section">
            <h4>Frequently Asked Questions</h4>
            <div class="faq-accordion">
                ${service.faqs.map(faq => `
                    <div class="faq-item">
                        <button class="faq-question">${faq.q}</button>
                        <div class="faq-answer"><p>${faq.a}</p></div>
                    </div>
                `).join('')}
            </div>
        </div>` : ''}

        <div class="service-detail-section">
            <h4>Customer Reviews</h4>
            ${renderReviewsList(reviews)}
        </div>
    `;

    // --- Build Footer ---
    modalFooter.innerHTML = `
        <div class="price-container">
            ${priceInfo.html}
            ${service.promoText ? `<div class="promo-text">${service.promoText}</div>` : ''}
        </div>
        <button class="btn book-now-btn" data-id="${service.id}">Book Slot</button>
    `;

    // --- Post-Render Logic ---
    // Set images after they are in the DOM
    modalBody.querySelectorAll('.carousel-item, .included-item').forEach(parent => {
        const img = parent.querySelector('img');
        if (!img) return;

        if (parent.matches('.carousel-item')) {
            const index = Array.from(parent.parentElement.children).indexOf(parent);
            const url = mediaItems[index];
            if (url && !url.toLowerCase().includes('.mp4')) setAsyncImage(img, url);
        }
        if (parent.matches('.included-item')) {
            const index = Array.from(parent.parentElement.children).indexOf(parent);
            const url = service.includedFeatures[index]?.imageUrl;
            if (url) setAsyncImage(img, url);
        }
    });

    modal.classList.remove('hidden');
};

export const openBookingModal = (serviceId) => {
    const modal = document.getElementById('booking-modal');
    const service = state.services.find(s => s.id === serviceId);
    if (!modal || !service) return;

    state.setCurrentBookingServiceId(serviceId);
    state.setCurrentBookingSelection({ date: null, time: null });

    const titleEl = modal.querySelector('#booking-modal-title');
    if(titleEl) titleEl.textContent = `Book Slot for: ${service.title}`;
    
    const bodyEl = modal.querySelector('#booking-modal-body');
    if (!bodyEl) return;

    bodyEl.innerHTML = `
        <div class="form-group">
            <label for="booking-date-input">Select Date</label>
            <input type="date" id="booking-date-input" class="form-group-input">
        </div>
        <div class="form-group">
            <label>Select Time Slot</label>
            <div id="booking-time-slots" class="tyre-details-grid">
                <!-- Time slots will be injected here -->
            </div>
        </div>
        <button id="confirm-booking-btn" class="auth-btn" style="margin-top: 20px;">Add to Cart</button>
    `;
    
    const dateInput = modal.querySelector('#booking-date-input');
    dateInput.min = new Date().toISOString().split("T")[0]; // Set min date to today
    
    const timeSlotsContainer = modal.querySelector('#booking-time-slots');
    if (timeSlotsContainer) {
        const availableTimes = ["09:00 - 11:00", "11:00 - 13:00", "14:00 - 16:00", "16:00 - 18:00"];
        timeSlotsContainer.innerHTML = ''; // Clear previous
        availableTimes.forEach(time => {
            const timeSlot = document.createElement('button');
            timeSlot.className = 'btn time-slot-btn'; // Use a standard button style, add specific class
            timeSlot.textContent = time;
            timeSlot.dataset.time = time;
            timeSlotsContainer.appendChild(timeSlot);
        });
    }

    modal.classList.remove('hidden');
};

export const openReviewModal = (serviceId, reviewToEdit) => {
    const modal = document.getElementById('review-modal');
    const service = state.services.find(s => s.id === serviceId);
    if (!modal || !service) return;

    state.setCurrentReviewServiceId(serviceId);

    const titleEl = document.getElementById('review-modal-title');
    if (titleEl) {
        titleEl.textContent = `${reviewToEdit ? 'Edit' : 'Leave'} a review for: ${service.title}`;
    }

    const form = document.getElementById('review-form');
    form.reset();
    document.getElementById('review-id-input').value = reviewToEdit?.reviewId || '';
    document.getElementById('review-comment-input').value = reviewToEdit?.comment || '';

    // Set star rating
    const rating = reviewToEdit?.rating || 0;
    document.getElementById('review-rating-value').value = String(rating);
    modal.querySelectorAll('.interactive-star-rating i').forEach(star => {
        const starRating = parseInt(star.dataset.rating || '0');
        star.classList.toggle('fas', starRating <= rating);
        star.classList.toggle('far', starRating > rating);
    });

    modal.classList.remove('hidden');
};

export const openOrderDetailModal = (orderId) => {
    const modal = document.getElementById('order-details-summary-modal');
    const order = state.userOrders.find(o => o.orderId === orderId);
    if (!modal || !order) {
        showNotification('Could not find order details.', 'error');
        return;
    }

    const modalBody = modal.querySelector('#order-summary-modal-body');
    if (!modalBody) return;

    const { userName, shippingAddress, items, totalAmount, paymentMethod } = order;

    modalBody.innerHTML = `
        <div class="summary-card">
            <h4>Customer Information</h4>
            <p><strong>Name:</strong> ${userName}</p>
            <p><strong>Shipping Address:</strong> ${shippingAddress}</p>
        </div>
        <div class="summary-card">
            <h4>Order Summary</h4>
            <div class="summary-items-container">
                ${items.map(item => `
                    <div class="summary-item">
                        <span>${item.name} (x${item.quantity})</span>
                        <span>₹${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                `).join('')}
            </div>
            <div class="summary-row total">
                <span>Total Paid</span>
                <span>₹${totalAmount.toFixed(2)}</span>
            </div>
            <div class="summary-row">
                <span>Payment Method</span>
                <span>${paymentMethod}</span>
            </div>
        </div>
    `;

    modal.classList.remove('hidden');
};


// --- Car Selection Modal UI ---
const createGridItem = (id, name, imageUrl, type) => {
    const item = document.createElement('div');
    item.className = 'grid-item';
    item.dataset.id = id;
    item.innerHTML = `
        <div class="main-image-container">
           <img class="${type}" src="" alt="${name}" loading="lazy">
        </div>
        <p>${name}</p>
    `;
    const img = item.querySelector('img');
    if (img && imageUrl) setAsyncImage(img, imageUrl);
    return item;
};

const createListItem = (id, name) => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.dataset.id = id;
    item.textContent = name;
    return item;
};

export const updateCarView = () => {
    const { step, brand, model, variant } = state.selectionState;
    const carSelectionModal = document.getElementById('car-selection-modal');
    if (!carSelectionModal) return;

    const stepContentContainer = document.getElementById('modal-step-content');
    const searchContainer = document.getElementById('modal-search-container');
    const carModalBackBtn = document.getElementById('modal-back-btn');
    const carModalTitle = document.getElementById('modal-title');
    const searchInput = document.getElementById('modal-search-input');

    if (!stepContentContainer || !searchContainer || !carModalBackBtn || !carModalTitle || !searchInput) return;

    stepContentContainer.innerHTML = '';
    searchContainer.classList.add('hidden');
    carModalBackBtn.classList.toggle('hidden', step === 'brand');

    const progressSteps = carSelectionModal.querySelectorAll('.progress-step');
    progressSteps.forEach(s => {
        s.classList.remove('active', 'completed');
        if (s.dataset.step === step) s.classList.add('active');
        if (['brand', 'model', 'variant'].indexOf(s.dataset.step) < ['brand', 'model', 'variant'].indexOf(step)) {
            s.classList.add('completed');
        }
    });

    switch (step) {
        case 'brand':
            carModalTitle.textContent = 'SELECT BRAND';
            searchContainer.classList.remove('hidden');
            const grid = document.createElement('div');
            grid.className = 'modal-step-grid';
            state.carDatabase?.forEach(b => grid.appendChild(createGridItem(b.name, b.name, b.logo, 'logo')));
            stepContentContainer.appendChild(grid);
            break;
        case 'model':
            carModalTitle.textContent = `SELECT MODEL (${brand})`;
            searchContainer.classList.remove('hidden');
            const currentBrand = state.carDatabase?.find(b => b.name === brand);
            if (currentBrand) {
                const grid = document.createElement('div');
                grid.className = 'modal-step-grid';
                Object.entries(currentBrand.models).forEach(([modelName, modelDetails]) => {
                    grid.appendChild(createGridItem(modelName, modelName, modelDetails.image, 'car'));
                });
                stepContentContainer.appendChild(grid);
            }
            break;
        case 'variant':
            carModalTitle.textContent = `SELECT VARIANT (${model})`;
            const currentModel = state.carDatabase?.find(b => b.name === brand)?.models[model];
            if (currentModel) {
                const list = document.createElement('div');
                list.className = 'variant-list';
                Object.entries(currentModel.variants).forEach(([variantName, variantDetails]) => {
                    list.appendChild(createListItem(variantName, variantDetails.version));
                });
                stepContentContainer.appendChild(list);
            }
            break;
        case 'confirmation':
            handleConfirmation();
            break;
    }
    searchInput.value = '';
    const items = stepContentContainer.querySelectorAll('.grid-item, .list-item');
    items?.forEach(item => item.style.display = '');
};

export const goBackCar = () => {
    const stepOrder = ['brand', 'model', 'variant', 'confirmation'];
    const currentStepIndex = stepOrder.indexOf(state.selectionState.step);
    if (currentStepIndex > 0) {
        state.setSelectionState({ ...state.selectionState, step: stepOrder[currentStepIndex - 1] });
        updateCarView();
    }
};

export const handleConfirmation = () => {
    const { brand, model, variant } = state.selectionState;
    if (!brand || !model || !variant) return;

    const carModalTitle = document.getElementById('modal-title');
    const stepContentContainer = document.getElementById('modal-step-content');
    if (!carModalTitle || !stepContentContainer) return;

    const currentVariant = state.carDatabase?.find(b => b.name === brand)?.models[model]?.variants[variant];
    const modelImage = state.carDatabase?.find(b => b.name === brand)?.models[model]?.image;

    carModalTitle.textContent = 'CONFIRM YOUR CAR';
    stepContentContainer.innerHTML = `
        <div class="confirmation-view">
            <div class="main-image-container">
                <img src="" alt="${model}" loading="lazy">
            </div>
            <h4>${brand} ${model}</h4>
            <p>${currentVariant?.version}</p>
            <div class="confirmation-buttons">
                <button class="change-btn" id="change-car-btn">Change</button>
                <button class="done-btn" id="confirm-car-btn">Confirm</button>
            </div>
        </div>
    `;

    const img = stepContentContainer.querySelector('img');
    if (img && modelImage) setAsyncImage(img, modelImage);

    document.getElementById('change-car-btn')?.addEventListener('click', goBackCar);
    
    document.getElementById('confirm-car-btn')?.addEventListener('click', async () => {
        if (!currentVariant) return;

        const carDetails = {
            carBrandModel: `${brand} ${model}`,
            selectedVariant: { ...currentVariant, brand, model }
        };
        
        let shouldOpenProfileModal = false;

        if (state.isLoggedIn && state.userDetails) {
            const updatedDetails = { ...state.userDetails, ...carDetails };
            state.setUserDetails(updatedDetails);
            await api.saveCurrentUserProfile(); // Save to backend

            // Check if profile is incomplete AFTER setting the car
            if (!updatedDetails.firstName || !updatedDetails.lastName) {
                shouldOpenProfileModal = true;
            }
        } else {
            state.setGuestSelectedCar(carDetails);
        }

        updateCarSelectorDisplay();
        
        // If on tyre page, re-render it with new filters
        if (!document.getElementById('tyre-replacement-content')?.classList.contains('hidden')) {
            renderTyreReplacementPage();
        }

        document.getElementById('car-selection-modal')?.classList.add('hidden');

        // Now, after closing car modal, open profile modal if needed
        if (shouldOpenProfileModal) {
            const profileModal = document.getElementById('profile-page-modal');
            if (profileModal) {
                const profileTitle = profileModal.querySelector('#profile-modal-title');
                if (profileTitle) profileTitle.textContent = "Last Step! Create Your Profile";
                profileModal.classList.remove('hidden');
            }
        }
    });
};

// --- Notification System ---

/**
 * Displays a non-blocking notification message.
 * @param message The text to display.
 * @param type The type of notification ('success', 'error', 'info').
 * @param duration The time in milliseconds to show the notification.
 */
export const showNotification = (message, type = 'info', duration = 3000) => {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';

    notification.innerHTML = `<i class="fas ${iconClass}"></i><span>${message}</span>`;
    
    container.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, duration);
};
