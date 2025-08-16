// IMPORTANT: Permanent Configuration
// This file contains the core configuration for the application.
// These values are compiled into the code and are not editable in the browser.
// To change them, you must edit this file and redeploy the application.

/**
 * The Web App URL for your Main Content Backend Google Apps Script.
 * This script manages public content like services, reels, cars, and handles media uploads.
 * Follow the README-main-backend.md guide to get this URL.
 */
export const MAIN_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbwXqk1N4R-Ciq09phuhuBsRWL4rMa821uJc_-2AcPUi8Yd5TJPuS9O3hLK8hz4IzHS3/exec'

/**
 * The Web App URL for your User Data Backend Google Apps Script.
 * This script securely manages user profiles and order history.
 * Follow the README-user-data-backend.md guide to get this URL.
 */
export const USER_DATA_BACKEND_URL = 'https://script.google.com/macros/s/AKfycbyBt0qbleCmfzfnji908lCdGvk7Y6PlK9d6xxHMApIT89v8qUh5gEZ5mmR4V6zLkdJp/exec';

/**
 * The WIDGET ID for your MSG91 OTP service.
 * This is a public, client-side key found in your MSG91 dashboard.
 */
export const MSG91_WIDGET_ID = '3567446c4833333230373539';

/**
 * The TOKEN AUTH (client-side) for your MSG91 OTP service.
 * This is a public, client-side key found in your MSG91 dashboard in the widget settings.
 */
export const MSG91_TOKEN_AUTH = '462470TotkJtRYB46890bfa3P1';
