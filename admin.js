

import * as state from './state.js';
import * as api from './api.js';
import { setAsyncImage, showLoadingOverlay, debounce, getDragAfterElement } from './dom-helpers.js';
import { uploadMediaFile } from './api.js';
import { USER_BACKEND_TEMPLATE, MAIN_BACKEND_TEMPLATE } from './backend-templates.js';
import { showNotification } from './ui.js';

// --- Admin Panel ---

// Module-level variable to hold files for bulk upload
let parsedBulkFiles = null;


const handleReelFormSubmit = async (form) => {
    const id = form.querySelector('#reel-id-input').value;
    const title = form.querySelector('#reel-title-input').value;
    const videoUrl = form.querySelector('#reel-video-url-input').value;

    if (!title || !videoUrl) {
        showNotification('Please fill out all required fields.', 'error');
        return false;
    }

    const reelData = {
        id: id || `reel_${Date.now()}`,
        type: 'Reel',
        title,
        videoUrl
    };

    if (id) {
        const index = state.reels.findIndex(r => r.id === id);
        if (index > -1) state.reels[index] = reelData;
    } else {
        state.reels.push(reelData);
    }

    const saved = await api.saveContent();
    if (saved) renderAdminReels();
    return saved;
};

const handleTestimonialFormSubmit = async (form) => {
    const id = form.querySelector('#testimonial-id-input').value;
    const customerName = form.querySelector('#testimonial-name-input').value;
    const text = form.querySelector('#testimonial-text-input').value;
    const mediaUrl = form.querySelector('#testimonial-media-url-input').value;

    if (!customerName || !text || !mediaUrl) {
        showNotification('Please fill out all required fields.', 'error');
        return false;
    }

    const testimonialData = {
        id: id || `testimonial_${Date.now()}`,
        type: 'Testimonial',
        customerName,
        text,
        mediaUrl,
        mediaType: mediaUrl.toLowerCase().includes('.mp4') ? 'video' : 'image'
    };

    if (id) {
        const index = state.testimonials.findIndex(t => t.id === id);
        if (index > -1) state.testimonials[index] = testimonialData;
    } else {
        state.testimonials.push(testimonialData);
    }

    const saved = await api.saveContent();
    if (saved) renderAdminTestimonials();
    return saved;
};

const handleBannerFormSubmit = async (form) => {
    const id = form.querySelector('#banner-id-input').value;
    const imageUrl = form.querySelector('#banner-image-url-input').value;
    const linkUrl = form.querySelector('#banner-link-url-input').value;

    if (!imageUrl) {
        showNotification('Banner Image URL is required.', 'error');
        return false;
    }

    const bannerData = {
        id: id || `banner_${Date.now()}`,
        type: 'Banner',
        imageUrl,
        linkUrl: linkUrl || undefined,
    };

    if (id) {
        const index = state.banners.findIndex(b => b.id === id);
        if (index > -1) state.banners[index] = bannerData;
    } else {
        state.banners.push(bannerData);
    }

    const saved = await api.saveContent();
    if (saved) renderAdminBanners();
    return saved;
};

const handleServiceFormSubmit = async (form) => {
    const id = form.querySelector('#service-id-input').value;
    
    let segment;
    const segmentSelector = form.querySelector('#service-segment-selector');
    if (segmentSelector.value === 'other') {
        segment = form.querySelector('#service-segment-other-input').value.trim();
    } else {
        segment = segmentSelector.value;
    }

    if (!segment) {
        showNotification('Service Category cannot be empty.', 'error');
        return false;
    }
    
    const service = {
        id: id || `service_${Date.now()}`,
        type: 'Service',
        segment: segment,
        mrp: form.querySelector('#service-mrp-input').value,
        price: form.querySelector('#service-price-input').value,
        title: form.querySelector('#service-title-input').value,
        promoText: form.querySelector('#service-promo-text-input')?.value,
    };

    // Conditionally read data from dynamic fields based on their visibility
    const timeEstimateFields = form.querySelector('#timeEstimate-fields');
    if (timeEstimateFields && !timeEstimateFields.classList.contains('hidden')) {
        service.timeEstimate = form.querySelector('#service-time-estimate-input')?.value;
    }

    const galleryUrlsFields = form.querySelector('#galleryUrls-fields');
    if (galleryUrlsFields && !galleryUrlsFields.classList.contains('hidden')) {
        service.galleryUrls = Array.from(form.querySelectorAll('#gallery-urls-container .editor-row input[type="text"]'))
            .map(input => input.value.trim()).filter(Boolean);
    }
    
    const includedFeaturesFields = form.querySelector('#includedFeatures-fields');
    if (includedFeaturesFields && !includedFeaturesFields.classList.contains('hidden')) {
         service.includedFeatures = Array.from(form.querySelectorAll('.included-feature-editor-row'))
            .map(row => ({
                name: row.querySelector('.included-feature-name').value.trim(),
                imageUrl: row.querySelector('.included-feature-image').value.trim()
            })).filter(f => f.name);
    }
    
    const comparisonTableFields = form.querySelector('#comparisonTable-fields');
    if (comparisonTableFields && !comparisonTableFields.classList.contains('hidden')) {
        service.comparisonTable = Array.from(form.querySelectorAll('.comparison-editor-row'))
            .map(row => ({
                feature: row.querySelector('.comparison-feature').value.trim(),
                us: row.querySelector('.comparison-us').checked,
                us_text: row.querySelector('.comparison-us-text').value.trim(),
                them: row.querySelector('.comparison-them').checked,
                them_text: row.querySelector('.comparison-them-text').value.trim(),
            })).filter(r => r.feature);
    }
    
    const faqsFields = form.querySelector('#faqs-fields');
    if (faqsFields && !faqsFields.classList.contains('hidden')) {
        service.faqs = Array.from(form.querySelectorAll('#faqs-container .editor-row'))
            .map(row => ({
                q: row.querySelector('.faq-q').value.trim(),
                a: row.querySelector('.faq-a').value.trim()
            })).filter(f => f.q && f.a);
    }
    
    const tyreSpecsFields = form.querySelector('#tyreSpecs-fields');
    if (tyreSpecsFields && !tyreSpecsFields.classList.contains('hidden')) {
        service.tyre_brand = form.querySelector('#tyre-brand-input')?.value;
        service.tyre_model = form.querySelector('#tyre-model-input')?.value;
        service.tyre_width = form.querySelector('#tyre-width-input')?.value;
        service.tyre_profile = form.querySelector('#tyre-profile-input')?.value;
        service.tyre_radius = form.querySelector('#tyre-radius-input')?.value;
        service.tyre_loadIndex = form.querySelector('#tyre-loadIndex-input')?.value;
        service.tyre_speedRating = form.querySelector('#tyre-speedRating-input')?.value;
    }
    
    const featuresListFields = form.querySelector('#featuresList-fields');
    if (featuresListFields && !featuresListFields.classList.contains('hidden')) {
        const featuresText = form.querySelector('#tyre-features-textarea')?.value || '';
        service.features = featuresText.split('\n').map(f => f.trim()).filter(Boolean);
    }
    
    const specificationsFields = form.querySelector('#specifications-fields');
    if (specificationsFields && !specificationsFields.classList.contains('hidden')) {
        service.specifications = {};
        Array.from(form.querySelectorAll('#specifications-container .spec-editor-row')).forEach(row => {
            const key = row.querySelector('.spec-key-input').value.trim();
            const value = row.querySelector('.spec-value-input').value.trim();
            if (key && value && service.specifications) {
                service.specifications[key] = value;
            }
        });
    }

    const imageUrlsFields = form.querySelector('#imageUrls-fields');
    if (imageUrlsFields && !imageUrlsFields.classList.contains('hidden')) {
        service.imageUrls = Array.from(form.querySelectorAll('#image-urls-container .editor-row input[type="text"]'))
            .map(input => input.value.trim()).filter(Boolean);
    }


    if (id) {
        const index = state.services.findIndex(s => s.id === id);
        if (index > -1) state.services[index] = service;
    } else {
        state.services.push(service);
    }

    const saved = await api.saveContent();
    if (saved) {
        renderAdminServices();
        showNotification('Service saved successfully!', 'success');
    }
    return saved;
};

const openAdminModal = (title, formHtml, onSubmit) => {
    const overlay = document.createElement('div');
    overlay.id = 'admin-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
        <div class="modal-content" id="admin-edit-modal">
            <div class="modal-header">
                <h3 id="admin-modal-title"></h3>
                <button id="admin-modal-close" class="modal-nav-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body" id="admin-modal-form-container"></div>
        </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#admin-modal-title').textContent = title;
    const formContainer = overlay.querySelector('#admin-modal-form-container');
    formContainer.innerHTML = `<form id="admin-modal-form" novalidate>${formHtml}</form>`;
    
    const form = formContainer.querySelector('#admin-modal-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoadingOverlay(true, 'Saving...');
        const success = await onSubmit(form);
        showLoadingOverlay(false);
        if (success) {
            overlay.remove();
        }
    });
    
    overlay.querySelector('#admin-modal-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target.id === 'admin-modal-overlay') overlay.remove();
    });

    // Final step: make it visible
    setTimeout(() => overlay.classList.remove('hidden'), 0);
};

const renderReelForm = (reel) => {
    return `
        <input type="hidden" id="reel-id-input" value="${reel?.id || ''}">
        <div class="form-group">
            <label for="reel-title-input">Title</label>
            <input type="text" id="reel-title-input" class="form-group-input" value="${reel?.title || ''}" required>
        </div>
        <div class="form-group">
            <label for="reel-video-url-input">Video URL</label>
            <div class="form-group-btn-row">
                <input type="text" id="reel-video-url-input" class="form-group-input large-input" value="${reel?.videoUrl || ''}" required>
                <button type="button" class="auth-btn upload-btn" data-folder="reels" data-target-input="reel-video-url-input"><i class="fas fa-upload"></i> Upload</button>
            </div>
        </div>
        <button type="submit" class="auth-btn">Save Reel</button>
    `;
};

const createAdminReelItem = (reel) => {
    const item = document.createElement('div');
    item.className = 'admin-list-item draggable';
    item.dataset.id = reel.id;
    item.draggable = true;
    item.innerHTML = `
        <div class="admin-thumb-preview">
            <video src="${reel.videoUrl}" muted loop autoplay playsinline></video>
        </div>
        <div class="service-list-info">
            <strong>${reel.title}</strong>
             <span class="reel-list-info-url">${reel.videoUrl}</span>
        </div>
        <div class="service-actions">
            <button class="action-btn edit-btn"><i class="fas fa-pencil-alt"></i></button>
            <button class="action-btn delete"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;
    item.querySelector('.edit-btn')?.addEventListener('click', () => {
        openAdminModal('Edit Reel', renderReelForm(reel), handleReelFormSubmit);
    });
    item.querySelector('.delete')?.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete "${reel.title}"?`)) {
            state.setReels(state.reels.filter(r => r.id !== reel.id));
            await api.saveContent();
            renderAdminReels();
        }
    });
    return item;
};

const renderTestimonialForm = (testimonial) => {
    return `
        <input type="hidden" id="testimonial-id-input" value="${testimonial?.id || ''}">
        <div class="form-group">
            <label for="testimonial-name-input">Customer Name</label>
            <input type="text" id="testimonial-name-input" class="form-group-input" value="${testimonial?.customerName || ''}" required>
        </div>
        <div class="form-group">
            <label for="testimonial-text-input">Testimonial Text</label>
            <textarea id="testimonial-text-input" class="form-group-input" required>${testimonial?.text || ''}</textarea>
        </div>
        <div class="form-group">
            <label for="testimonial-media-url-input">Media URL (Image or Video)</label>
            <div class="form-group-btn-row">
                <input type="text" id="testimonial-media-url-input" class="form-group-input large-input" value="${testimonial?.mediaUrl || ''}" required>
                <button type="button" class="auth-btn upload-btn" data-folder="testimonials" data-target-input="testimonial-media-url-input"><i class="fas fa-upload"></i> Upload</button>
            </div>
        </div>
        <button type="submit" class="auth-btn">Save Testimonial</button>
    `;
};

const createAdminTestimonialItem = (testimonial) => {
    const item = document.createElement('div');
    item.className = 'admin-list-item';
    item.dataset.id = testimonial.id;
    item.innerHTML = `
        <div class="admin-thumb-preview">
             ${testimonial.mediaType === 'video' 
                ? `<video src="${testimonial.mediaUrl}" muted loop autoplay playsinline></video>` 
                : `<img src="" data-src="${testimonial.mediaUrl}" alt="${testimonial.customerName}">`
            }
        </div>
        <div class="service-list-info">
            <strong>${testimonial.customerName}</strong>
            <span>"${testimonial.text.substring(0, 50)}..."</span>
        </div>
        <div class="service-actions">
            <button class="action-btn edit-btn"><i class="fas fa-pencil-alt"></i></button>
            <button class="action-btn delete"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;

    if (testimonial.mediaType === 'image') {
        const img = item.querySelector('img');
        if (img) setAsyncImage(img, testimonial.mediaUrl);
    }
    
    item.querySelector('.edit-btn')?.addEventListener('click', () => {
        openAdminModal('Edit Testimonial', renderTestimonialForm(testimonial), handleTestimonialFormSubmit);
    });
    item.querySelector('.delete')?.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete the testimonial from "${testimonial.customerName}"?`)) {
            state.setTestimonials(state.testimonials.filter(t => t.id !== testimonial.id));
            await api.saveContent();
            renderAdminTestimonials();
        }
    });
    return item;
};

const renderBannerForm = (banner) => {
    return `
        <input type="hidden" id="banner-id-input" value="${banner?.id || ''}">
        <div class="form-group">
            <label for="banner-image-url-input">Image URL</label>
             <div class="form-group-btn-row">
                <input type="text" id="banner-image-url-input" class="form-group-input large-input" value="${banner?.imageUrl || ''}" required>
                <button type="button" class="auth-btn upload-btn" data-folder="banners" data-target-input="banner-image-url-input"><i class="fas fa-upload"></i> Upload</button>
            </div>
        </div>
        <div class="form-group">
            <label for="banner-link-url-input">Link URL (Optional)</label>
            <input type="text" id="banner-link-url-input" class="form-group-input" value="${banner?.linkUrl || ''}">
        </div>
        <button type="submit" class="auth-btn">Save Banner</button>
    `;
};

const createAdminBannerItem = (banner) => {
    const item = document.createElement('div');
    item.className = 'admin-list-item';
    item.dataset.id = banner.id;
    item.innerHTML = `
        <div class="admin-thumb-preview">
            <img src="" data-src="${banner.imageUrl}" alt="Banner Image">
        </div>
        <div class="service-list-info">
            <strong>Banner</strong>
            <span>Links to: ${banner.linkUrl || 'N/A'}</span>
        </div>
        <div class="service-actions">
            <button class="action-btn edit-btn"><i class="fas fa-pencil-alt"></i></button>
            <button class="action-btn delete"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;

    const img = item.querySelector('img');
    if (img) setAsyncImage(img, banner.imageUrl);

    item.querySelector('.edit-btn')?.addEventListener('click', () => {
        openAdminModal('Edit Banner', renderBannerForm(banner), handleBannerFormSubmit);
    });
    item.querySelector('.delete')?.addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete this banner?`)) {
            state.setBanners(state.banners.filter(b => b.id !== banner.id));
            await api.saveContent();
            renderAdminBanners();
        }
    });
    return item;
};

const renderAdminReels = () => {
    const list = document.getElementById('admin-reels-list');
    if (!list) return;
    list.innerHTML = '';
    if (state.reels.length > 0) {
        state.reels.forEach(reel => list.appendChild(createAdminReelItem(reel)));
    } else {
        list.innerHTML = '<p class="no-data-message">No reels added yet.</p>';
    }
};

const renderAdminTestimonials = () => {
    const list = document.getElementById('admin-testimonials-list');
    if (!list) return;
    list.innerHTML = '';
    if (state.testimonials.length > 0) {
        state.testimonials.forEach(testimonial => list.appendChild(createAdminTestimonialItem(testimonial)));
    } else {
        list.innerHTML = '<p class="no-data-message">No testimonials added yet.</p>';
    }
};

const renderAdminBanners = () => {
    const list = document.getElementById('admin-banners-list');
    if (!list) return;
    list.innerHTML = '';
    if (state.banners.length > 0) {
        state.banners.forEach(banner => list.appendChild(createAdminBannerItem(banner)));
    } else {
        list.innerHTML = '<p class="no-data-message">No banners added yet.</p>';
    }
};

const renderAdminServices = () => {
    const segment = state.adminSelectedServiceSegment;
    const servicesForSegment = state.services.filter(s => s.segment === segment);
    const list = document.getElementById('admin-services-list');
    
    const bulkUploaderSection = document.getElementById('bulk-image-uploader-section');
    if (bulkUploaderSection) {
        bulkUploaderSection.style.display = segment === 'Tyre Replacement' ? 'block' : 'none';
        if (segment !== 'Tyre Replacement') {
            // Clear the uploader if switching away from tyres
            document.getElementById('bulk-image-input').value = '';
            document.getElementById('bulk-image-preview-container').innerHTML = '';
            document.getElementById('start-bulk-upload-btn').classList.add('hidden');
            parsedBulkFiles = null;
        }
    }

    if (!list) return;
    list.innerHTML = '';

    if (servicesForSegment.length === 0) {
        list.innerHTML = '<p class="no-data-message">No services found in this category.</p>';
    } else {
        servicesForSegment.forEach(service => {
            list.appendChild(createAdminServiceItem(service));
        });
    }
};

const createAdminServiceItem = (service) => {
    const item = document.createElement('div');
    item.className = 'admin-list-item';
    item.dataset.id = service.id;

    const priceInfo = service.price ? `₹${service.price}` : 'N/A';
    const mrpInfo = service.mrp ? `<del>₹${service.mrp}</del>` : '';
    
    // Fallback to a placeholder if image is missing.
    const primaryMediaUrl = (service.galleryUrls?.[0]) || (Array.isArray(service.imageUrls) ? service.imageUrls[0] : service.imageUrls) || service.videoSrc;
    const isVideo = typeof primaryMediaUrl === 'string' && primaryMediaUrl.toLowerCase().includes('.mp4');

    item.innerHTML = `
        <div class="admin-thumb-preview">
            ${primaryMediaUrl 
                ? (isVideo ? `<video src="${primaryMediaUrl}" muted></video>` : `<img src="" data-src="${primaryMediaUrl}">`)
                : '<i class="fas fa-image"></i>'
            }
        </div>
        <div class="service-list-info">
            <strong>${service.title}</strong>
            <span>ID: ${service.id}</span>
        </div>
        <div class="service-actions">
            <button class="action-btn edit-btn"><i class="fas fa-pencil-alt"></i></button>
            <i class="fas fa-info-circle" title="Price: ${priceInfo} ${mrpInfo}"></i>
        </div>
    `;

    const img = item.querySelector('img[data-src]');
    if (img) {
        setAsyncImage(img, img.getAttribute('data-src'));
    }
    
    item.querySelector('.edit-btn')?.addEventListener('click', () => {
        openAdminModal('Edit Service', renderServiceForm(service), handleServiceFormSubmit);
    });

    return item;
};


const createRowEditor = (containerId, itemHtml) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const item = document.createElement('div');
    item.innerHTML = itemHtml();
    container.appendChild(item.firstElementChild);
};

const createListEditor = (containerId, items = [], itemHtml) => {
    const container = document.getElementById(containerId);
    if (!container || !Array.isArray(items)) return;
    container.innerHTML = '';
    items.forEach(item => {
        const row = document.createElement('div');
        row.innerHTML = itemHtml(item);
        container.appendChild(row.firstElementChild);
    });
};

const renderServiceForm = (service) => {
    const segment = service?.segment || state.adminSelectedServiceSegment;
    const allSegments = [...new Set(state.services.map(s => s.segment))].filter(Boolean).sort();
    const reviewsForService = service ? state.reviews.filter(r => r.serviceId === service.id) : [];
    const reviewCount = reviewsForService.length;

    const baseForm = `
        <input type="hidden" id="service-id-input" value="${service?.id || ''}">
        <div class="form-group">
            <label for="service-mrp-input">MRP (Max Retail Price)</label>
            <input type="text" id="service-mrp-input" class="form-group-input" value="${service?.mrp || ''}">
        </div>
        <div class="form-group">
            <label for="service-price-input">Offer Price</label>
            <input type="text" id="service-price-input" class="form-group-input" value="${service?.price || ''}" required>
        </div>
        <div class="form-group">
            <label for="service-segment-selector">Service Category</label>
            <div class="segment-selector-container">
                <select id="service-segment-selector" class="form-group-input">
                    ${allSegments.map(s => `<option value="${s}" ${s === segment ? 'selected' : ''}>${s}</option>`).join('')}
                    <option value="other">-- Add New Category --</option>
                </select>
                <input type="text" id="service-segment-other-input" class="form-group-input hidden" placeholder="Enter new category name">
            </div>
        </div>
        <div class="form-group">
            <label for="service-title-input">Service Title</label>
            <input type="text" id="service-title-input" class="form-group-input" value="${service?.title || ''}" required>
        </div>
        <div class="form-group">
            <label for="service-promo-text-input">Promotional Text (Optional)</label>
            <input type="text" id="service-promo-text-input" class="form-group-input" value="${service?.promoText || ''}">
        </div>
    `;

    // --- Dynamic Field Selector Logic ---
    const fieldBlocks = {
        timeEstimate: { label: 'Time Estimate', property: 'timeEstimate' },
        galleryUrls: { label: 'Gallery URLs (Car Wash)', property: 'galleryUrls' },
        includedFeatures: { label: 'Included Features (Car Wash)', property: 'includedFeatures' },
        comparisonTable: { label: 'Comparison Table (Car Wash)', property: 'comparisonTable' },
        faqs: { label: 'FAQs (Car Wash)', property: 'faqs' },
        tyreSpecs: { label: 'Tyre Specs', property: 'tyre_brand' },
        featuresList: { label: 'Features (Tyre)', property: 'features' },
        specifications: { label: 'Specifications (Tyre)', property: 'specifications' },
        imageUrls: { label: 'Image URLs (Tyre)', property: 'imageUrls' }
    };

    const has = (prop) => service && service[prop] && (!Array.isArray(service[prop]) || service[prop].length > 0);

    let fieldSelectorHtml = '<div class="field-selector-grid">';
    for (const [key, config] of Object.entries(fieldBlocks)) {
        fieldSelectorHtml += `
            <label class="field-selector-label">
                <input type="checkbox" data-controls="${key}-fields" ${has(config.property) ? 'checked' : ''}>
                ${config.label}
            </label>
        `;
    }
    fieldSelectorHtml += '</div>';

    // --- Dynamic Field Sections HTML (initially hidden) ---
    const timeEstimateFields = `
        <div id="timeEstimate-fields" class="form-group dynamic-field-group ${!has('timeEstimate') ? 'hidden' : ''}">
            <label for="service-time-estimate-input">Time Estimate (e.g., "45 Mins")</label>
            <input type="text" id="service-time-estimate-input" class="form-group-input" value="${service?.timeEstimate || ''}">
        </div>`;

    const galleryUrlsFields = `
        <div id="galleryUrls-fields" class="dynamic-field-group ${!has('galleryUrls') ? 'hidden' : ''}">
            <label>Gallery (Image/Video URLs)</label>
            <div id="gallery-urls-container"></div>
            <button type="button" class="auth-btn" id="add-gallery-item-btn" style="width:auto; padding: 5px 10px; font-size: 14px;">+ Add URL</button>
        </div>`;
    
    const includedFeaturesFields = `
        <div id="includedFeatures-fields" class="dynamic-field-group ${!has('includedFeatures') ? 'hidden' : ''}">
            <label>Included Features</label>
            <div id="included-features-container"></div>
            <button type="button" class="auth-btn" id="add-included-feature-btn" style="width:auto; padding: 5px 10px; font-size: 14px;">+ Add Feature</button>
        </div>`;

    const comparisonTableFields = `
        <div id="comparisonTable-fields" class="dynamic-field-group ${!has('comparisonTable') ? 'hidden' : ''}">
            <label>Comparison Table</label>
            <div id="comparison-table-container"></div>
            <button type="button" class="auth-btn" id="add-comparison-row-btn" style="width:auto; padding: 5px 10px; font-size: 14px;">+ Add Row</button>
        </div>`;

    const faqsFields = `
        <div id="faqs-fields" class="dynamic-field-group ${!has('faqs') ? 'hidden' : ''}">
            <label>FAQs</label>
            <div id="faqs-container"></div>
            <button type="button" class="auth-btn" id="add-faq-btn" style="width:auto; padding: 5px 10px; font-size: 14px;">+ Add FAQ</button>
        </div>`;

    const tyreSpecsFields = `
        <div id="tyreSpecs-fields" class="dynamic-field-group ${!has('tyre_brand') ? 'hidden' : ''}">
             <label>Tyre Specifications</label>
             <div class="tyre-details-grid" style="grid-template-columns: 1fr 1fr; margin-bottom: 15px;">
                <div class="form-group"><label for="tyre-brand-input">Brand</label><input id="tyre-brand-input" class="form-group-input" value="${service?.tyre_brand || ''}"></div>
                <div class="form-group"><label for="tyre-model-input">Model</label><input id="tyre-model-input" class="form-group-input" value="${service?.tyre_model || ''}"></div>
                <div class="form-group"><label for="tyre-width-input">Width</label><input id="tyre-width-input" class="form-group-input" value="${service?.tyre_width || ''}"></div>
                <div class="form-group"><label for="tyre-profile-input">Profile</label><input id="tyre-profile-input" class="form-group-input" value="${service?.tyre_profile || ''}"></div>
                <div class="form-group"><label for="tyre-radius-input">Radius</label><input id="tyre-radius-input" class="form-group-input" value="${service?.tyre_radius || ''}"></div>
                <div class="form-group"><label for="tyre-loadIndex-input">Load Index</label><input id="tyre-loadIndex-input" class="form-group-input" value="${service?.tyre_loadIndex || ''}"></div>
                <div class="form-group"><label for="tyre-speedRating-input">Speed Rating</label><input id="tyre-speedRating-input" class="form-group-input" value="${service?.tyre_speedRating || ''}"></div>
            </div>
        </div>`;
    
    const featuresListFields = `
        <div id="featuresList-fields" class="dynamic-field-group ${!has('features') ? 'hidden' : ''}">
            <label for="tyre-features-textarea">Features (one per line)</label>
            <textarea id="tyre-features-textarea" class="form-group-input" rows="4">${(Array.isArray(service?.features) ? service.features : []).join('\n')}</textarea>
        </div>`;

    const specificationsFields = `
        <div id="specifications-fields" class="dynamic-field-group ${!has('specifications') ? 'hidden' : ''}">
            <label>Specifications (Key-Value Pairs)</label>
            <div id="specifications-container"></div>
            <button type="button" class="auth-btn" id="add-spec-btn" style="width:auto; padding: 8px 12px; font-size: 14px;">Add Spec</button>
        </div>`;
    
    const imageUrlsFields = `
        <div id="imageUrls-fields" class="dynamic-field-group ${!has('imageUrls') ? 'hidden' : ''}">
            <label>Image URLs</label>
            <div id="image-urls-container"></div>
            <button type="button" class="auth-btn" id="add-image-url-btn" style="width:auto; padding: 8px 12px; font-size: 14px;">+ Add URL</button>
            <button type="button" class="auth-btn upload-btn" id="upload-image-btn" style="width:auto; padding: 8px 12px; font-size: 14px; margin-left: 10px;"><i class="fas fa-upload"></i> Upload Image</button>
        </div>`;


    const finalForm = `
        <div class="segment-tabs" style="margin-bottom: 20px;">
            <button type="button" class="segment-tab active" data-tab="content">Content</button>
            <button type="button" class="segment-tab" data-tab="reviews">Reviews (${reviewCount})</button>
        </div>
        <div id="content-tab" class="tab-pane active">
            ${baseForm}

            <div class="form-group">
                <label>Service-Specific Fields</label>
                <p class="form-group-description">Select the fields this service requires. The form will update below.</p>
                ${fieldSelectorHtml}
            </div>

            <div class="dynamic-fields-container">
                ${timeEstimateFields}
                ${galleryUrlsFields}
                ${includedFeaturesFields}
                ${comparisonTableFields}
                ${faqsFields}
                ${tyreSpecsFields}
                ${featuresListFields}
                ${specificationsFields}
                ${imageUrlsFields}
            </div>

            <button type="submit" class="auth-btn" id="save-service-btn">Save Service</button>
        </div>
        <div id="reviews-tab" class="tab-pane hidden">
            <div id="reviews-list-container"></div>
        </div>
    `;

    setTimeout(() => {
        const segmentSelector = document.getElementById('service-segment-selector');
        const otherInput = document.getElementById('service-segment-other-input');
        segmentSelector?.addEventListener('change', () => {
            otherInput.classList.toggle('hidden', segmentSelector.value !== 'other');
        });

        // Tab switching logic
        document.querySelector('.segment-tabs')?.addEventListener('click', (e) => {
            const target = e.target;
            const tabButton = target.closest('.segment-tab');
            if (!tabButton || tabButton.classList.contains('active')) return;

            document.querySelectorAll('.segment-tab').forEach(t => t.classList.remove('active'));
            tabButton.classList.add('active');

            document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
            const tabContentId = tabButton.dataset.tab;
            document.getElementById(`${tabContentId}-tab`)?.classList.remove('hidden');
        });

        // Dynamic field checkbox logic
        document.querySelectorAll('.field-selector-label input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const target = e.currentTarget;
                const controlledSectionId = target.dataset.controls;
                if (controlledSectionId) {
                    document.getElementById(controlledSectionId)?.classList.toggle('hidden', !target.checked);
                }
            });
        });

        // --- Render and attach events for dynamic list editors ---
        // -- Gallery --
        const galleryUrlItemHtml = (url = '') => `<div class="editor-row"><div class="form-group-btn-row"><input type="text" class="form-group-input large-input" value="${url}" placeholder="https://..."><button type="button" class="auth-btn upload-btn" data-folder="services" data-target-input-is-sibling="true"><i class="fas fa-upload"></i></button><button type="button" class="action-btn delete"><i class="fas fa-trash-alt"></i></button></div></div>`;
        createListEditor('gallery-urls-container', service?.galleryUrls, galleryUrlItemHtml);
        document.getElementById('add-gallery-item-btn')?.addEventListener('click', () => createRowEditor('gallery-urls-container', galleryUrlItemHtml));

        // -- Included Features --
        const includedFeatureItemHtml = (feature = { name: '', imageUrl: '' }) => `<div class="editor-row included-feature-editor-row"><div class="form-group-btn-row"><input type="text" class="form-group-input included-feature-name" value="${feature.name}" placeholder="Feature Name"><input type="text" class="form-group-input included-feature-image" value="${feature.imageUrl}" placeholder="Image URL (optional)"><button type="button" class="auth-btn upload-btn" data-folder="services/features" data-target-input-is-sibling="true"><i class="fas fa-upload"></i></button><button type="button" class="action-btn delete"><i class="fas fa-trash-alt"></i></button></div></div>`;
        createListEditor('included-features-container', service?.includedFeatures, includedFeatureItemHtml);
        document.getElementById('add-included-feature-btn')?.addEventListener('click', () => createRowEditor('included-features-container', includedFeatureItemHtml));

        // -- Comparison Table --
        const comparisonItemHtml = (row = { feature: '', us: true, us_text: '', them: false, them_text: '' }) => `<div class="editor-row comparison-editor-row"><input type="text" class="form-group-input comparison-feature" value="${row.feature}" placeholder="Feature"><div class="comparison-inputs"><label><input type="checkbox" class="comparison-us" ${row.us ? 'checked' : ''}> Us</label><input type="text" class="form-group-input comparison-us-text" value="${row.us_text}" placeholder="Subtext (optional)"></div><div class="comparison-inputs"><label><input type="checkbox" class="comparison-them" ${row.them ? 'checked' : ''}> Them</label><input type="text" class="form-group-input comparison-them-text" value="${row.them_text}" placeholder="Subtext (optional)"></div><button type="button" class="action-btn delete"><i class="fas fa-trash-alt"></i></button></div>`;
        createListEditor('comparison-table-container', service?.comparisonTable, comparisonItemHtml);
        document.getElementById('add-comparison-row-btn')?.addEventListener('click', () => createRowEditor('comparison-table-container', comparisonItemHtml));
        
        // -- FAQs --
        const faqItemHtml = (faq = { q: '', a: '' }) => `<div class="editor-row"><input type="text" class="form-group-input faq-q" value="${faq.q}" placeholder="Question"><textarea class="form-group-input faq-a" placeholder="Answer">${faq.a}</textarea><button type="button" class="action-btn delete"><i class="fas fa-trash-alt"></i></button></div>`;
        createListEditor('faqs-container', service?.faqs, faqItemHtml);
        document.getElementById('add-faq-btn')?.addEventListener('click', () => createRowEditor('faqs-container', faqItemHtml));
    
        // -- Specifications --
        const specItemHtml = (spec = { key: '', value: '' }) => `<div class="editor-row spec-editor-row"><input type="text" class="form-group-input spec-key-input" placeholder="Spec Key (e.g., Warranty)" value="${spec.key}"><input type="text" class="form-group-input spec-value-input" placeholder="Spec Value" value="${spec.value}"><button type="button" class="action-btn delete"><i class="fas fa-trash-alt"></i></button></div>`;
        const specsArray = service?.specifications ? Object.entries(service.specifications).map(([key, value]) => ({ key, value })) : [];
        createListEditor('specifications-container', specsArray, specItemHtml);
        document.getElementById('add-spec-btn')?.addEventListener('click', () => createRowEditor('specifications-container', specItemHtml));

        // -- Image URLs --
        const imageUrlItemHtml = (url = '') => `<div class="editor-row"><input type="text" class="form-group-input url-input" value="${url || ''}" placeholder="https://..."><button type="button" class="action-btn delete"><i class="fas fa-trash-alt"></i></button></div>`;
        const imageUrlsArray = Array.isArray(service?.imageUrls) ? service.imageUrls : (typeof service?.imageUrls === 'string' ? [service.imageUrls] : []);
        createListEditor('image-urls-container', imageUrlsArray, imageUrlItemHtml);
        document.getElementById('add-image-url-btn')?.addEventListener('click', () => createRowEditor('image-urls-container', imageUrlItemHtml));
        
        document.getElementById('upload-image-btn')?.addEventListener('click', async (e) => {
            const button = e.currentTarget;
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*,video/*';
            fileInput.onchange = async () => {
                if (fileInput.files && fileInput.files[0]) {
                    button.textContent = 'Uploading...';
                    button.setAttribute('disabled', 'true');
                    const url = await uploadMediaFile(fileInput.files[0], 'services/tyres');
                    if (url) {
                        const container = document.getElementById('image-urls-container');
                        if(container) {
                            const row = document.createElement('div');
                            row.innerHTML = imageUrlItemHtml(url);
                            container.appendChild(row.firstElementChild);
                        }
                    }
                    button.innerHTML = '<i class="fas fa-upload"></i> Upload Image';
                    button.removeAttribute('disabled');
                }
            };
            fileInput.click();
        });
        
        // Generic logic for all delete buttons and upload buttons in the modal
        const modalForm = document.getElementById('admin-modal-form');
        modalForm?.addEventListener('click', async (e) => {
            const target = e.target;
            const deleteBtn = target.closest('.action-btn.delete');
            if (deleteBtn) {
                deleteBtn.closest('.editor-row')?.remove();
            }

            const uploadBtn = target.closest('.upload-btn');
            if (uploadBtn) {
                const folder = uploadBtn.dataset.folder || 'general';
                let targetInput;
                if (uploadBtn.dataset.targetInputIsSibling) {
                    targetInput = uploadBtn.parentElement.querySelector('input[type="text"]');
                } else {
                    targetInput = document.getElementById(uploadBtn.dataset.targetInput);
                }
                if (targetInput) {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = 'image/*,video/*';
                    fileInput.onchange = async () => {
                        if (fileInput.files && fileInput.files[0]) {
                            const url = await uploadMediaFile(fileInput.files[0], folder);
                            if (url) {
                                targetInput.value = url;
                            }
                        }
                    };
                    fileInput.click();
                }
            }
        });
        
        // Reviews tab rendering
        const reviewsContainer = document.getElementById('reviews-list-container');
        if (reviewsContainer) {
            if (reviewCount > 0) {
                 reviewsContainer.innerHTML = `<ul>${reviewsForService.map(r => `<li><b>${r.userName} (${r.rating}★):</b> ${r.comment}</li>`).join('')}</ul>`;
            } else {
                 reviewsContainer.innerHTML = '<p class="no-data-message">No reviews for this service yet.</p>';
            }
        }

    }, 0);

    return finalForm;
};

const openAdminOrderDetailModal = (orderId) => {
    const modal = document.getElementById('order-details-summary-modal');
    const order = state.allOrders.find(o => o.orderId === orderId);
    if (!modal || !order) {
        showNotification('Could not find order details.', 'error');
        return;
    }

    const modalBody = modal.querySelector('#order-summary-modal-body');
    if (!modalBody) return;

    const { userName, shippingAddress, items, totalAmount, paymentMethod, userId } = order;

    modalBody.innerHTML = `
        <div class="summary-card">
            <h4>Customer Information</h4>
            <p><strong>Name:</strong> ${userName}</p>
            <p><strong>Mobile:</strong> ${userId}</p>
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


const renderOrderManagementTable = () => {
    const container = document.getElementById('order-management-table-container');
    if (!container) return;

    const { status: statusFilter, searchQuery } = state.orderFilters;
    const lowerCaseQuery = searchQuery.toLowerCase();

    const filteredOrders = state.allOrders.filter(order => {
        const statusMatch = !statusFilter || order.status === statusFilter;
        const searchMatch = !lowerCaseQuery ||
                            order.orderId.toLowerCase().includes(lowerCaseQuery) ||
                            order.userName.toLowerCase().includes(lowerCaseQuery) ||
                            order.userId.toLowerCase().includes(lowerCaseQuery);
        return statusMatch && searchMatch;
    }).sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

    if (filteredOrders.length === 0) {
        container.innerHTML = '<p class="no-data-message">No orders match the current filters.</p>';
        return;
    }
    
    const table = document.createElement('table');
    table.className = 'admin-data-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody>
            ${filteredOrders.map(order => {
                const orderDate = new Date(order.orderDate);
                const displayDate = !isNaN(orderDate.getTime())
                    ? orderDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Invalid Date';

                const statusOptions = ['Placed', 'Shipped', 'Delivered', 'Cancelled'];
                
                return `
                    <tr data-order-id="${order.orderId}">
                        <td>${order.orderId}</td>
                        <td>${order.userName}</td>
                        <td>${displayDate}</td>
                        <td>₹${order.totalAmount.toFixed(2)}</td>
                        <td>
                            <div class="status-tag-wrapper">
                                <select class="status-select" data-order-id="${order.orderId}">
                                    ${statusOptions.map(opt => `<option value="${opt}" ${order.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                                </select>
                                <div class="status-tag ${order.status.toLowerCase()}">${order.status}</div>
                            </div>
                        </td>
                        <td>
                            <button class="action-btn view-details-btn" title="View Details"><i class="fas fa-eye"></i></button>
                        </td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;
    container.innerHTML = '';
    container.appendChild(table);
};

const handleBulkImageSelection = (files) => {
    const previewContainer = document.getElementById('bulk-image-preview-container');
    const uploadBtn = document.getElementById('start-bulk-upload-btn');
    if (!previewContainer || !uploadBtn) return;

    const tyreServices = state.services.filter(s => s.segment === 'Tyre Replacement');
    const filesByServiceId = new Map();
    const unmatchedFiles = [];

    Array.from(files).forEach(file => {
        const matchingService = tyreServices.find(s => file.name.startsWith(s.id));
        if (matchingService) {
            if (!filesByServiceId.has(matchingService.id)) {
                filesByServiceId.set(matchingService.id, { service: matchingService, files: [] });
            }
            filesByServiceId.get(matchingService.id).files.push(file);
        } else {
            unmatchedFiles.push(file);
        }
    });

    parsedBulkFiles = { matched: filesByServiceId, unmatched: unmatchedFiles };

    let previewHtml = '';
    if (filesByServiceId.size > 0) {
        previewHtml += '<h4>Matched Images</h4><ul class="bulk-preview-list">';
        filesByServiceId.forEach(({ service, files }, serviceId) => {
            previewHtml += `
                <li class="preview-service-group">
                    <strong>${service.title}</strong> (ID: ${serviceId})
                    <ul class="preview-file-list">
                        ${files.map(f => `<li><i class="fas fa-file-image"></i> ${f.name}</li>`).join('')}
                    </ul>
                </li>`;
        });
        previewHtml += '</ul>';
    }

    if (unmatchedFiles.length > 0) {
        previewHtml += '<h4>Unmatched Images (will be ignored)</h4><ul class="bulk-preview-list unmatched">';
        unmatchedFiles.forEach(file => {
            previewHtml += `<li><i class="fas fa-question-circle"></i> ${file.name}</li>`;
        });
        previewHtml += '</ul>';
    }

    previewContainer.innerHTML = previewHtml;

    if (filesByServiceId.size > 0) {
        uploadBtn.classList.remove('hidden');
        uploadBtn.textContent = `Upload ${Array.from(filesByServiceId.values()).reduce((sum, val) => sum + val.files.length, 0)} Images & Save`;
    } else {
        uploadBtn.classList.add('hidden');
    }
};

const openCodeGeneratorModal = (title, code) => {
    // Remove existing modal if it's there
    document.getElementById('code-generator-modal')?.remove();
    
    const modal = document.createElement('div');
    modal.id = 'code-generator-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="code-generator-modal-title"></h3>
                <button id="code-generator-modal-close-btn" class="modal-nav-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <textarea id="code-generator-textarea" readonly></textarea>
                <button id="copy-code-btn" class="auth-btn">Copy Code</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#code-generator-modal-title').textContent = title;
    modal.querySelector('#code-generator-textarea').value = code.trim();
    
    modal.querySelector('#code-generator-modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target.id === 'code-generator-modal') modal.remove(); });
    
    modal.querySelector('#copy-code-btn').addEventListener('click', e => {
        const btn = e.currentTarget;
        const textarea = modal.querySelector('#code-generator-textarea');
        navigator.clipboard.writeText(textarea.value).then(() => {
            btn.textContent = 'Copied!';
            btn.classList.add('copied');
        }).catch(err => {
            alert('Failed to copy code: ' + err);
        });
    });
    
    setTimeout(() => modal.classList.remove('hidden'), 0);
};

const renderAdminDashboard = () => {
    const container = document.getElementById('admin-dashboard-section');
    if (!container) return;
    container.innerHTML = `
        <div class="admin-dashboard">
            <div class="admin-card">
                 <div class="admin-card-title-row">
                    <h3>Backend & Login Configuration</h3>
                </div>
                <p>These settings are critical for the app to function. They are saved in your browser's local storage.</p>
                <form id="admin-config-form">
                    <div class="form-group">
                        <label for="main-backend-url-input">Main Content Backend URL</label>
                        <div class="form-group-btn-row">
                            <input type="url" id="main-backend-url-input" class="form-group-input large-input" value="${state.backendUrl}">
                            <button type="button" id="test-main-backend-btn" class="auth-btn">Test</button>
                        </div>
                         <div id="main-backend-test-result" class="test-result"></div>
                    </div>
                    <div class="form-group">
                        <label for="user-data-backend-url-input">User Data Backend URL</label>
                        <div class="form-group-btn-row">
                            <input type="url" id="user-data-backend-url-input" class="form-group-input large-input" value="${state.userDataBackendUrl}">
                            <button type="button" id="test-user-backend-btn" class="auth-btn">Test</button>
                        </div>
                         <div id="user-backend-test-result" class="test-result"></div>
                    </div>
                    <div class="form-group">
                        <label for="msg91-widget-id-input">MSG91 Widget ID</label>
                        <input type="text" id="msg91-widget-id-input" class="form-group-input" value="${state.msg91WidgetId}">
                    </div>
                     <div class="form-group">
                        <label for="msg91-token-auth-input">MSG91 Token Auth (Client-side)</label>
                        <input type="text" id="msg91-token-auth-input" class="form-group-input" value="${state.msg91TokenAuth}">
                    </div>
                    <button type="button" id="save-config-btn" class="auth-btn">Save Configuration</button>
                </form>
            </div>
            <div class="admin-card">
                <h3>Backend Setup</h3>
                <p>Generate the Google Apps Script code for your two backends. Follow the README files for deployment instructions.</p>
                 <div class="form-group-btn-row">
                    <button class="auth-btn" id="generate-main-backend-code-btn">Get Main Backend Code</button>
                    <button class="auth-btn" id="generate-user-backend-code-btn">Get User Data Code</button>
                </div>
                 <div class="admin-subsection">
                    <h3>Car Database Management</h3>
                    <p>Syncs car data from the 'CarDatabase' tab in your Main Content Google Sheet.</p>
                     <button class="auth-btn" id="sync-car-db-from-sheet-btn"><i class="fas fa-sync-alt"></i> Sync from Sheet</button>
                </div>
            </div>
        </div>
    `;
};

const renderAdminContentManagement = () => {
    const container = document.getElementById('admin-content-section');
    if (!container) return;

    const allSegments = [...new Set(state.services.map(s => s.segment))].filter(Boolean).sort();

    container.innerHTML = `
        <div class="admin-card admin-card-full-width">
             <div class="admin-card-title-row">
                <h3>Content Management</h3>
                <button class="auth-btn" id="save-all-content-btn"><i class="fas fa-save"></i> Save All Content</button>
            </div>
            <p>Manage all public-facing content like services, reels, and testimonials. Changes are saved locally until you click "Save All Content".</p>

            <div class="segment-tabs">
                <button class="segment-tab active" data-content="services">Services</button>
                <button class="segment-tab" data-content="reels">Reels</button>
                <button class="segment-tab" data-content="testimonials">Testimonials</button>
                <button class="segment-tab" data-content="banners">Banners</button>
            </div>
            
            <div id="admin-services-view" class="content-view">
                <div class="view-header">
                    <select id="admin-service-category-selector" class="form-group-input">
                        ${allSegments.map(s => `<option value="${s}" ${s === state.adminSelectedServiceSegment ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <button class="auth-btn" id="add-service-btn"><i class="fas fa-plus"></i> Add Service</button>
                </div>
                <div id="bulk-image-uploader-section" style="display: none;" class="admin-subsection">
                    <h4>Bulk Image Uploader (for Tyres)</h4>
                    <p>Upload multiple images for Tyre Replacement services. Name files like <strong><code>[ServiceID]-any-name.jpg</code></strong> to auto-match.</p>
                    <div class="form-group">
                        <input type="file" id="bulk-image-input" class="form-group-input" multiple accept="image/*">
                    </div>
                    <div id="bulk-image-preview-container"></div>
                    <button class="auth-btn hidden" id="start-bulk-upload-btn"><i class="fas fa-cloud-upload-alt"></i> Upload & Save</button>
                </div>
                <div id="admin-services-list" class="service-list-container"></div>
            </div>

            <div id="admin-reels-view" class="content-view hidden">
                 <div class="view-header"><h2>Reels</h2><button class="auth-btn" id="add-reel-btn"><i class="fas fa-plus"></i> Add Reel</button></div>
                <div id="admin-reels-list" class="service-list-container"></div>
            </div>
            <div id="admin-testimonials-view" class="content-view hidden">
                 <div class="view-header"><h2>Testimonials</h2><button class="auth-btn" id="add-testimonial-btn"><i class="fas fa-plus"></i> Add Testimonial</button></div>
                <div id="admin-testimonials-list" class="service-list-container"></div>
            </div>
            <div id="admin-banners-view" class="content-view hidden">
                 <div class="view-header"><h2>Banners</h2><button class="auth-btn" id="add-banner-btn"><i class="fas fa-plus"></i> Add Banner</button></div>
                <div id="admin-banners-list" class="service-list-container"></div>
            </div>
        </div>
    `;

    renderAdminServices();
    renderAdminReels();
    renderAdminTestimonials();
    renderAdminBanners();
};

const renderAdminOrderManagement = () => {
    const container = document.getElementById('admin-orders-section');
    if (!container) return;
    container.innerHTML = `
        <div class="admin-card admin-card-full-width">
            <div class="admin-card-title-row">
                <h3>Order Management</h3>
                <button class="auth-btn refresh-orders-btn"><i class="fas fa-sync-alt"></i> Refresh</button>
            </div>
            <div class="order-management-controls">
                 <div class="order-filter-container">
                    <label for="order-status-filter">Status:</label>
                    <select id="order-status-filter" class="form-group-input">
                        <option value="">All</option>
                        <option value="Placed">Placed</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                </div>
                 <div class="order-search-container">
                    <i class="fas fa-search"></i>
                    <input type="search" id="admin-order-search-input" class="form-group-input" placeholder="Search by Order ID, Name, or Mobile...">
                </div>
            </div>
            <div id="order-management-table-container" class="table-container"></div>
        </div>
    `;

    renderOrderManagementTable();
};

const renderAdminPanel = (container, options) => {
    const errorMessageHtml = options.errorMessage ? `
        <div class="admin-error-banner">
            <h4><i class="fas fa-exclamation-triangle"></i> Application Initialization Failed</h4>
            <p>The main application could not load, likely due to a configuration issue. You can use the Admin Panel to correct the settings.</p>
            <pre>${options.errorMessage}</pre>
        </div>
    ` : '';

    container.innerHTML = `
        ${errorMessageHtml}
        <div class="admin-dashboard-container">
            <h1 class="admin-title">Admin Panel</h1>
            <nav class="segment-tabs">
                <button class="segment-tab admin-nav-link active" data-section="dashboard">Dashboard</button>
                <button class="segment-tab admin-nav-link" data-section="content">Content</button>
                <button class="segment-tab admin-nav-link" data-section="orders">Orders</button>
            </nav>

            <div id="admin-dashboard-section" class="admin-section"></div>
            <div id="admin-content-section" class="admin-section hidden"></div>
            <div id="admin-orders-section" class="admin-section hidden"></div>
        </div>
    `;

    renderAdminDashboard();
    renderAdminContentManagement();
    renderAdminOrderManagement();
};

const setupAdminEventListeners = () => {
    const adminContainer = document.getElementById('admin-content');
    if (!adminContainer) return;

    const debouncedOrderRender = debounce(renderOrderManagementTable, 300);

    adminContainer.addEventListener('click', async (e) => {
        const target = e.target;

        // Main navigation
        const navLink = target.closest('.admin-nav-link');
        if (navLink) {
            e.preventDefault();
            const section = navLink.dataset.section;
            document.querySelectorAll('.admin-nav-link').forEach(link => link.classList.remove('active'));
            navLink.classList.add('active');
            document.querySelectorAll('.admin-section').forEach(sec => {
                sec.classList.toggle('hidden', sec.id !== `admin-${section}-section`);
            });
            return;
        }

        // Content sub-navigation
        const contentNavLink = target.closest('.segment-tabs .segment-tab:not(.admin-nav-link)');
        if (contentNavLink) {
            e.preventDefault();
            const content = contentNavLink.dataset.content;
            document.querySelectorAll('.segment-tabs .segment-tab').forEach(link => link.classList.remove('active'));
            contentNavLink.classList.add('active');
            document.querySelectorAll('.content-view').forEach(view => {
                view.classList.toggle('hidden', view.id !== `admin-${content}-view`);
            });
            return;
        }

        // --- Dashboard Buttons ---
        if (target.id === 'generate-main-backend-code-btn') { openCodeGeneratorModal('Main Content Backend Code', MAIN_BACKEND_TEMPLATE); return; }
        if (target.id === 'generate-user-backend-code-btn') { openCodeGeneratorModal('User Data Backend Code', USER_BACKEND_TEMPLATE); return; }
        
        if (target.id === 'save-config-btn') {
            localStorage.setItem('backendUrl', document.getElementById('main-backend-url-input').value);
            localStorage.setItem('userDataBackendUrl', document.getElementById('user-data-backend-url-input').value);
            localStorage.setItem('msg91WidgetId', document.getElementById('msg91-widget-id-input').value);
            localStorage.setItem('msg91TokenAuth', document.getElementById('msg91-token-auth-input').value);
            showNotification('Configuration saved! Please reload the page.', 'success', 5000);
            return;
        }
        if (target.id === 'test-main-backend-btn') {
            const resultDiv = document.getElementById('main-backend-test-result');
            resultDiv.className = 'test-result'; resultDiv.textContent = 'Testing...';
            const result = await api.testBackendConnection(document.getElementById('main-backend-url-input').value);
            resultDiv.textContent = result.message; resultDiv.classList.add(result.status);
            return;
        }
        if (target.id === 'test-user-backend-btn') {
            const resultDiv = document.getElementById('user-backend-test-result');
            resultDiv.className = 'test-result'; resultDiv.textContent = 'Testing...';
            const result = await api.testUserDataBackendConnection(document.getElementById('user-data-backend-url-input').value);
            resultDiv.textContent = result.message; resultDiv.classList.add(result.status);
            return;
        }
        
        if (target.id === 'sync-car-db-from-sheet-btn') {
            if (!confirm('Sync car database from your Google Sheet?')) return;
            showLoadingOverlay(true, 'Syncing Car DB...');
            try {
                await api.fetchCarDatabase();
                showNotification('Car Database synced!', 'success');
            } catch (error) { showNotification(`Sync failed: ${error.message}`, 'error', 5000); } 
            finally { showLoadingOverlay(false); }
            return;
        }

        // --- Content Buttons ---
        if (target.id === 'save-all-content-btn') { 
            await api.saveContent();
            showNotification('All content saved!', 'success');
            return;
        }
        if (target.id === 'add-reel-btn') { openAdminModal('Add New Reel', renderReelForm(null), handleReelFormSubmit); return; }
        if (target.id === 'add-testimonial-btn') { openAdminModal('Add New Testimonial', renderTestimonialForm(null), handleTestimonialFormSubmit); return; }
        if (target.id === 'add-banner-btn') { openAdminModal('Add New Banner', renderBannerForm(null), handleBannerFormSubmit); return; }
        if (target.id === 'add-service-btn') { openAdminModal('Add New Service', renderServiceForm(null), handleServiceFormSubmit); return; }
    
        if (target.id === 'start-bulk-upload-btn') {
             if (!parsedBulkFiles || parsedBulkFiles.matched.size === 0) return;
            if (!confirm('This will upload matched images and overwrite the Image URLs for the corresponding services. Continue?')) return;
            showLoadingOverlay(true, 'Starting bulk upload...');
            const allUploads = Array.from(parsedBulkFiles.matched.values()).flatMap(({ service, files }) => 
                files.map(file => uploadMediaFile(file, 'services/tyres').then(url => ({ serviceId: service.id, url })))
            );
            const results = await Promise.all(allUploads);
            results.forEach(({ serviceId, url }) => {
                const service = state.services.find(s => s.id === serviceId);
                if (service && url) {
                    if (!Array.isArray(service.imageUrls)) service.imageUrls = [];
                    service.imageUrls.push(url);
                }
            });
            if (await api.saveContent()) {
                renderAdminServices();
                showNotification('Bulk upload complete and services updated!', 'success');
            } else {
                showNotification('Images uploaded, but failed to save service data.', 'error');
            }
            // Reset uploader
            parsedBulkFiles = null;
            document.getElementById('bulk-image-input').value = '';
            document.getElementById('bulk-image-preview-container').innerHTML = '';
            document.getElementById('start-bulk-upload-btn').classList.add('hidden');
            showLoadingOverlay(false);
            return;
        }
        
        // --- Orders Buttons ---
        if (target.closest('.refresh-orders-btn')) {
            showLoadingOverlay(true, 'Refreshing Orders...');
            try {
                await api.fetchAllUserDataFromAdmin();
                renderOrderManagementTable();
                showNotification('Orders refreshed!', 'success');
            } catch (error) { showNotification(`Failed to refresh orders: ${error.message}`, 'error', 5000); }
            finally { showLoadingOverlay(false); }
            return;
        }
        const detailsBtn = target.closest('.view-details-btn');
        if (detailsBtn) {
            const orderId = detailsBtn.closest('tr')?.dataset.orderId;
            if (orderId) openAdminOrderDetailModal(orderId);
            return;
        }
    });

    adminContainer.addEventListener('change', async (e) => {
        const target = e.target;
        if (target.id === 'admin-service-category-selector') { state.setAdminSelectedServiceSegment(target.value); renderAdminServices(); return; }
        if (target.id === 'order-status-filter') { state.setOrderFilters({ ...state.orderFilters, status: target.value }); renderOrderManagementTable(); return; }
        if (target.id === 'bulk-image-input' && target.files.length > 0) { handleBulkImageSelection(target.files); return; }
        
        const statusSelect = target.closest('.status-select');
        if (statusSelect) {
            const orderId = statusSelect.dataset.orderId;
            const newStatus = statusSelect.value;
            statusSelect.disabled = true;
            if (await api.updateOrderStatus(orderId, newStatus)) {
                const order = state.allOrders.find(o => o.orderId === orderId);
                if (order) order.status = newStatus;
                renderOrderManagementTable(); // Re-render to update tag
                showNotification(`Order ${orderId} status updated.`, 'success');
            } else {
                renderOrderManagementTable(); // Re-render to revert dropdown
            }
            statusSelect.disabled = false;
        }
    });

    adminContainer.addEventListener('input', (e) => {
        if (e.target.id === 'admin-order-search-input') {
            state.setOrderFilters({ ...state.orderFilters, searchQuery: e.target.value });
            debouncedOrderRender();
        }
    });
};

export const initializeAdminPanel = async (container, options = {}) => {
    // Fetch data *before* rendering the panel
    if (!options.errorMessage) { // Don't fetch if we're just showing an initial error
         try {
            // This is the key change: fetch all data needed for the admin panel on-demand.
            await api.fetchAllUserDataFromAdmin();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            // Pass the fetch error to the render function to be displayed within the panel
            options.errorMessage = `Failed to load Admin Panel data: ${message}`;
        }
    }
   
    renderAdminPanel(container, options);
    setupAdminEventListeners();
};