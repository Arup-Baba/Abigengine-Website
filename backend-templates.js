// This file contains the complete Google Apps Script code for both backends.
// The frontend reads these templates for the in-app "Backend Code Generator".

export const MAIN_BACKEND_TEMPLATE = `
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
const SPREADSHEET_ID = SCRIPT_PROPERTIES.getProperty('SPREADSHEET_ID');
const ACCOUNT_ID = SCRIPT_PROPERTIES.getProperty('ACCOUNT_ID');
const BUCKET_NAME = SCRIPT_PROPERTIES.getProperty('BUCKET_NAME');
const BUCKET_URL = SCRIPT_PROPERTIES.getProperty('BUCKET_URL');
const ACCESS_KEY_ID = SCRIPT_PROPERTIES.getProperty('ACCESS_KEY_ID');
const SECRET_ACCESS_KEY = SCRIPT_PROPERTIES.getProperty('SECRET_ACCESS_KEY');

/**
 * Sanitizes a string to be used as a valid Google Sheet name.
 * @param {string} name The original name.
 * @returns {string} The sanitized name.
 */
function sanitizeSheetName(name) {
  // Removes spaces and characters forbidden in sheet names.
  const sanitized = name.replace(/[\\\\/\\\\*\\\\?\\\\\\\\[\\\\\\]:]/g, '').replace(/ /g, '');
  return sanitized.length > 100 ? sanitized.substring(0, 100) : sanitized;
}


function doGet(e) {
  try {
    const action = String(e.parameter.action || '').trim();
    let data;

    if (action === 'getHomepageData') {
      data = getHomepageData();
    } else if (action === 'getCoreData') {
      data = getCoreData();
    } else if (action === 'getPublicData') { // Kept for testing/backward compatibility
      data = getPublicData();
    } else if (action === 'getCarData') {
      data = { carData: getCarDataFromSheet() };
    } else {
      const message = 'Invalid action parameter. Received: "' + action + '". Full parameters: ' + JSON.stringify(e.parameter);
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: message })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...data })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message, stack: error.stack })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;
    let result;

    if (action === 'saveContentData') {
      result = saveContentData(payload);
    } else if (action === 'uploadMedia') {
      result = uploadMedia(payload);
    } else {
       return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...result })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message, stack: error.stack })).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Data Fetching Functions ---

function getSheetData(sheetName) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data.shift();
    
    const jsonHeaders = [
      'imageUrls', 'features', 'specifications', 'tyreDetails', 'reviews',
      'galleryUrls', 'includedFeatures', 'comparisonTable', 'faqs'
    ];

    return data.map(row => {
      const obj = {};
      headers.forEach((header, i) => {
        const value = row[i];
        if (jsonHeaders.includes(header) && typeof value === 'string' && value) {
          try {
            obj[header] = JSON.parse(value);
          } catch (e) {
            obj[header] = value;
          }
        } else {
          obj[header] = value;
        }
      });

      // Backward compatibility: If we find an old 'tyreDetails' object, flatten it.
      if (obj.tyreDetails && typeof obj.tyreDetails === 'object') {
        obj.tyre_brand = obj.tyreDetails.brand || '';
        obj.tyre_model = obj.tyreDetails.model || '';
        obj.tyre_width = obj.tyreDetails.width || '';
        obj.tyre_profile = obj.tyreDetails.profile || '';
        obj.tyre_radius = obj.tyreDetails.radius || '';
        obj.tyre_loadIndex = obj.tyreDetails.loadIndex || '';
        obj.tyre_speedRating = obj.tyreDetails.speedRating || '';
        delete obj.tyreDetails; // remove the old property
      }
      
      return obj;
    });
  } catch (e) {
    console.error("Error reading sheet " + sheetName + ": " + e.toString());
    return [];
  }
}

function getCarDataFromSheet() {
    try {
        const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
        const carDbSheet = spreadsheet.getSheets().find(s => s.getName().toLowerCase() === 'cardatabase');
        
        if (!carDbSheet) {
          console.log("Could not find a sheet named 'CarDatabase' (case-insensitive). Returning empty array.");
          return [];
        }

        const data = carDbSheet.getDataRange().getValues();
        if (data.length < 2) return [];
        const headers = data.shift();
        
        const carData = {};

        data.forEach(row => {
            const rowData = {};
            headers.forEach((header, i) => {
                rowData[header] = row[i];
            });

            const { brand, logo, model, image, version, year_range, fuel_type, front_tyres_spec, front_tyres_width, front_tyres_profile, front_tyres_radius, rear_tyres_spec, rear_tyres_width, rear_tyres_profile, rear_tyres_radius } = rowData;

            if (!brand || !model || !version) return; // Skip incomplete rows

            if (!carData[brand]) {
                carData[brand] = { name: brand, logo: logo, models: {} };
            }
            if (!carData[brand].models[model]) {
                carData[brand].models[model] = { image: image, variants: {} };
            }
            carData[brand].models[model].variants[version] = {
                version: version,
                year_range: year_range,
                fuel_type: fuel_type,
                front_tyres: { full_spec: front_tyres_spec, width: front_tyres_width, profile: front_tyres_profile, radius: front_tyres_radius },
                rear_tyres: { full_spec: rear_tyres_spec, width: rear_tyres_width, profile: rear_tyres_profile, radius: rear_tyres_radius }
            };
        });

        return Object.values(carData);
    } catch (e) {
        console.error("Error processing car data: " + e.toString());
        return [];
    }
}

function getHomepageData() {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const allSheets = spreadsheet.getSheets();
    const findSheet = (name) => allSheets.find(s => s.getName().toLowerCase() === name.toLowerCase());
    
    const reelsSheet = findSheet('reels');
    const testimonialsSheet = findSheet('testimonials');
    const bannersSheet = findSheet('banners');
    
    const reels = reelsSheet ? getSheetData(reelsSheet.getName()) : [];
    const testimonials = testimonialsSheet ? getSheetData(testimonialsSheet.getName()) : [];
    const banners = bannersSheet ? getSheetData(bannersSheet.getName()) : [];

    return { reels, testimonials, banners };
}

function getCoreData() {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const allSheets = spreadsheet.getSheets();
    let services = [];
    
    const knownDataSheets = ['reels', 'testimonials', 'banners', 'cardatabase'];
    const ignoreSheets = ['services', 'content', 'sheet9', 'sheet13', 'dynamicpricing']; 

    // Process sheets as potential service sheets
    allSheets.forEach(sheet => {
        const sheetNameLower = sheet.getName().toLowerCase();
        if (knownDataSheets.includes(sheetNameLower) || ignoreSheets.includes(sheetNameLower)) {
            return;
        }
        try {
            const range = sheet.getRange(1, 1, 1, 1);
            const header = range.getValue();
            if (header && String(header).toLowerCase() === 'id') {
                const serviceData = getSheetData(sheet.getName());
                services = services.concat(serviceData);
            }
        } catch (e) {
            console.log("Could not process sheet '" + sheet.getName() + "'. Skipping. Error: " + e.message);
        }
    });

    const carData = getCarDataFromSheet();
    return { services, carData };
}

function getPublicData() {
    const homepageData = getHomepageData();
    const coreData = getCoreData();
    return { ...homepageData, ...coreData };
}


// --- Data Saving Functions ---

function saveDataToSheet(sheetName, dataArray) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  
  sheet.clearContents(); 

  if (!dataArray || dataArray.length === 0) {
    // Keep a header row in empty sheets so they can be identified.
    sheet.appendRow(['id']);
    return;
  }
  
  const headers = [...new Set(dataArray.flatMap(obj => Object.keys(obj)))];
  sheet.appendRow(headers);

  const rows = dataArray.map(obj => {
    return headers.map(header => {
      const value = obj[header];
      if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
      }
      return value !== undefined && value !== null ? value : "";
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function saveContentData(data) {
  // Separate content by type
  const reels = data.filter(item => item.type === 'Reel');
  const testimonials = data.filter(item => item.type === 'Testimonial');
  const banners = data.filter(item => item.type === 'Banner');
  const allServices = data.filter(item => item.type === 'Service');

  // Save non-service items to their dedicated sheets
  saveDataToSheet('Reels', reels);
  saveDataToSheet('Testimonials', testimonials);
  saveDataToSheet('Banners', banners);

  // Group services by segment
  const servicesBySegment = allServices.reduce((acc, service) => {
    // IMPORTANT: Remove reviews from service object before saving to the main content DB.
    // Reviews are now managed by the User Data backend.
    if (service.hasOwnProperty('reviews')) {
      delete service.reviews;
    }

    // --- SANITIZATION FIX ---
    // Enforce correct data types for fields that should be arrays to prevent data loss.
    // This handles legacy data where a single string might exist instead of an array.
    const jsonArrayHeaders = ['imageUrls', 'features', 'galleryUrls'];
    jsonArrayHeaders.forEach(header => {
      if (service.hasOwnProperty(header) && !Array.isArray(service[header])) {
        // If the property exists but is not an array, wrap it in an array.
        // This makes the data structure consistent before saving.
        // It also handles null/undefined by converting them to an array with that value,
        // which will later be saved as a string like "[null]".
        service[header] = [service[header]];
      }
    });
    // --- END OF FIX ---

    const segment = service.segment || 'Uncategorized';
    if (!acc[segment]) {
      acc[segment] = [];
    }
    acc[segment].push(service);
    return acc;
  }, {});

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const allSheetNames = spreadsheet.getSheets().map(s => s.getName());
  const reservedSheetNames = ['Reels', 'Testimonials', 'Banners', 'CarDatabase', 'Services'];
  
  // Identify which of the existing sheets are for services
  const existingServiceSheetNames = allSheetNames.filter(name => !reservedSheetNames.includes(name));

  const currentSegments = Object.keys(servicesBySegment);
  const currentSanitizedSheetNames = currentSegments.map(sanitizeSheetName);

  // Save current service data to their respective sheets
  currentSegments.forEach(segment => {
    const sheetName = sanitizeSheetName(segment);
    const segmentData = servicesBySegment[segment];
    saveDataToSheet(sheetName, segmentData);
  });
  
  // Clear any existing service sheets that are no longer in use
  existingServiceSheetNames.forEach(sheetName => {
    if (!currentSanitizedSheetNames.includes(sheetName)) {
      saveDataToSheet(sheetName, []); // save an empty array to clear it
    }
  });

  // Finally, attempt to delete the old "Services" sheet if it exists, as it is now obsolete.
  const oldServicesSheet = spreadsheet.getSheetByName('Services');
  if (oldServicesSheet) {
    spreadsheet.deleteSheet(oldServicesSheet);
  }

  return { message: 'Content saved successfully.' };
}

// --- Cloudflare R2 Upload Function ---

function uploadMedia(payload) {
    const { base64Data, fileName, contentType, folder } = payload;
    const data = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(data, contentType, fileName);
    
    // Sanitize filename to be URL-friendly, preventing future loading issues.
    // Replaces spaces with hyphens and removes most non-alphanumeric characters.
    const sanitizedFileName = fileName.replace(/\\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
    const objectName = folder + '/' + new Date().getTime() + '-' + sanitizedFileName;

    const url = "https://" + ACCOUNT_ID + ".r2.cloudflarestorage.com/" + BUCKET_NAME + "/" + objectName;
    const publicUrl = "https://" + BUCKET_URL + "/" + objectName;

    const date = new Date().toUTCString();
    
    const stringToSign = "PUT\\n\\n" + contentType + "\\n" + date + "\\nx-amz-date:" + date + "\\n/" + BUCKET_NAME + "/" + objectName;
    
    const signature = Utilities.computeHmacSha1Signature(stringToSign, SECRET_ACCESS_KEY);
    const auth = "AWS " + ACCESS_KEY_ID + ":" + Utilities.base64Encode(signature);

    const headers = {
        "Authorization": auth,
        "x-amz-date": date,
        "Content-Type": contentType
    };

    const options = {
        "method": "PUT",
        "headers": headers,
        "payload": blob,
        "muteHttpExceptions": true
    };

    const response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
        return { url: publicUrl };
    } else {
        throw new Error("Upload failed: " + response.getContentText());
    }
}
`;

export const USER_BACKEND_TEMPLATE = `
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
const SPREADSHEET_ID = SCRIPT_PROPERTIES.getProperty('SPREADSHEET_ID');
const MSG91_AUTH_KEY = SCRIPT_PROPERTIES.getProperty('MSG91_AUTH_KEY');

/**
 * Normalizes a mobile number to its last 10 digits by removing all non-digit characters.
 * @param {string | number} mobile The mobile number to normalize.
 * @returns {string} The normalized 10-digit mobile number.
 */
function normalizeMobile(mobile) {
  if (!mobile) return "";
  // Remove all non-digit characters (like '+', ' ', '-') and then get the last 10 digits.
  return String(mobile).replace(/\\D/g, '').slice(-10);
}

function doGet(e) {
  try {
    const action = String(e.parameter.action || '').trim();
    let data;

    if (action === 'getUserData') {
      const mobile = e.parameter.mobile;
      data = getUserData(mobile);
    } else if (action === 'getAllData') {
      data = getAllData();
    } else if (action === 'getReviews') {
      data = getReviews();
    } else {
      const message = 'Invalid action parameter. Received: "' + action + '". Full parameters: ' + JSON.stringify(e.parameter);
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: message })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message, stack: error.stack })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;
    let result;

    if (action === 'saveUserData') {
      result = saveUserData(payload);
    } else if (action === 'saveOrders') {
      result = saveOrders(payload);
    } else if (action === 'saveReview') {
      result = saveReview(payload);
    } else if (action === 'updateOrderStatus') {
      result = updateOrderStatus(payload);
    } else {
       return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid action' })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', ...result })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.message, stack: error.stack })).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Data Fetching & Parsing ---

function getSheetDataAsObjects(sheet) {
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    const headers = data.shift();
    return data.map(row => {
        const obj = {};
        headers.forEach((header, i) => {
            obj[header] = row[i];
        });
        return obj;
    });
}

function parseUser(user) {
  if (!user) return null;
  // Check for the new or old field, prioritizing the new one.
  const jsonString = user.selectedVariantJson || user.selectedVariant;
  
  if (jsonString && typeof jsonString === 'string') {
    try {
      // This creates the final 'selectedVariant' object property
      user.selectedVariant = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse variant JSON for user " + user.mobile + ". Value: " + jsonString);
      user.selectedVariant = null; // Set to null on failure
    }
  }
  
  // Clean up: delete the source JSON string property(s) before sending to frontend
  delete user.selectedVariantJson;
  // Also delete the old one if it was the source, ensuring only the object remains.
  // This check is important: only delete 'selectedVariant' if it's NOT the object we just created.
  if (user.hasOwnProperty('selectedVariant') && typeof user.selectedVariant !== 'object') {
    delete user.selectedVariant;
  }
  
  return user;
}

function parseOrder(order) {
    if (!order) return null;
    // Check for non-empty string before parsing
    if (order.itemsJson && typeof order.itemsJson === 'string' && order.itemsJson.trim() !== '') {
        try {
            order.items = JSON.parse(order.itemsJson);
        } catch (e) {
            console.error("Failed to parse itemsJson for order " + order.orderId);
            order.items = [];
        }
    } else {
        order.items = []; // Ensure items is an array even if json is missing/empty
    }
    delete order.itemsJson;
    return order;
}

function parseReview(review) {
    if (review) {
        review.rating = parseInt(review.rating, 10) || 0;
    }
    return review;
}


function getUserData(mobile) {
  const usersSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Users');
  const ordersSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
  
  const searchMobile10Digit = normalizeMobile(mobile);

  // Add logging to help debug issues. Viewable in Apps Script Executions log.
  console.log("Searching for normalized 10-digit mobile: " + searchMobile10Digit);

  if (!searchMobile10Digit || searchMobile10Digit.length !== 10) {
    console.error("Invalid mobile number provided for lookup after normalization: " + mobile);
    return { status: 'error', message: 'Invalid mobile number for lookup.' };
  }

  const users = getSheetDataAsObjects(usersSheet);
  
  // Find user by comparing the normalized 10-digit mobile number.
  const userProfile = users.find(u => {
    const sheetMobile10Digit = normalizeMobile(u.mobile);
    return sheetMobile10Digit === searchMobile10Digit;
  });

  if (!userProfile) {
    console.log("User not found in sheet. Sheet contains " + users.length + " users. First user mobile in sheet (raw): " + (users.length > 0 ? users[0].mobile : "N/A"));
    return { status: 'notFound', message: 'User not found.' };
  }
  
  console.log("User found: " + JSON.stringify(userProfile));
  
  const allOrders = getSheetDataAsObjects(ordersSheet);
  const userOrders = allOrders
    .filter(o => normalizeMobile(o.userId) === searchMobile10Digit)
    .map(parseOrder);
    
  return { status: 'success', profile: parseUser(userProfile), orders: userOrders };
}


function getAllData() {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const usersSheet = spreadsheet.getSheetByName('Users');
    const ordersSheet = spreadsheet.getSheetByName('Orders');
    const reviewsSheet = spreadsheet.getSheetByName('Reviews');
    
    const users = getSheetDataAsObjects(usersSheet).map(parseUser);
    const orders = getSheetDataAsObjects(ordersSheet).map(parseOrder);
    const reviews = reviewsSheet ? getSheetDataAsObjects(reviewsSheet).map(parseReview) : [];
    
    return { status: 'success', users: users, orders: orders, reviews: reviews };
}

function getReviews() {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const reviewsSheet = spreadsheet.getSheetByName('Reviews');
    const reviews = reviewsSheet ? getSheetDataAsObjects(reviewsSheet).map(parseReview) : [];
    return { status: 'success', reviews: reviews };
}

// --- Data Saving Functions ---

function saveUserData(userData) {
  if (!userData || !userData.mobile) {
    throw new Error("Cannot save user data without a mobile number.");
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Users');
  const dataWithHeaders = sheet.getDataRange().getValues();
  const headers = dataWithHeaders.shift();
  const data = dataWithHeaders;
  
  const mobileHeaderIndex = headers.indexOf('mobile');
  if (mobileHeaderIndex === -1) {
    throw new Error("'mobile' column not found in Users sheet. Check sheet headers.");
  }

  // Stringify the selectedVariant object once.
  let variantJsonString = "";
  if (userData.selectedVariant && typeof userData.selectedVariant === 'object') {
    variantJsonString = JSON.stringify(userData.selectedVariant);
  }

  // Create the row array based on the sheet's headers.
  const newRow = headers.map(header => {
    if (header === 'selectedVariantJson') {
      return variantJsonString; // Use the JSON string for the new column
    }
    if (header === 'selectedVariant') {
      return variantJsonString; // Also use it for the old column for backward compatibility
    }
    const value = userData[header];
    return value !== undefined && value !== null ? value : "";
  });
  
  const mobileToSave10Digit = normalizeMobile(userData.mobile);
  const existingRowIndex = data.findIndex(row => {
    const sheetMobile10Digit = normalizeMobile(row[mobileHeaderIndex]);
    return sheetMobile10Digit === mobileToSave10Digit;
  });

  if (existingRowIndex > -1) {
    // +2 because sheet rows are 1-based and we shifted headers.
    sheet.getRange(existingRowIndex + 2, 1, 1, newRow.length).setValues([newRow]);
    return { message: 'User profile updated successfully.' };
  } else {
    sheet.appendRow(newRow);
    return { message: 'New user profile created successfully.' };
  }
}

function saveOrders(orders) {
  if (!orders || orders.length === 0) {
    return { message: 'No orders to save.' };
  }
  
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const rows = orders.map(order => {
      // Stringify the items array once.
      let itemsJsonString = "";
      if (order.items && Array.isArray(order.items)) {
          itemsJsonString = JSON.stringify(order.items);
      }
      
      // Create the row based on the sheet's headers.
      return headers.map(header => {
          if (header === 'itemsJson') {
              return itemsJsonString;
          }
          const value = order[header];
          return value !== undefined && value !== null ? value : "";
      });
  });

  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
  return { message: 'Orders saved successfully.' };
}

function saveReview(reviewData) {
  const { reviewId, serviceId, userId, userName, rating, comment } = reviewData;

  if (!serviceId || !userId) {
    throw new Error("Cannot save review without serviceId and userId.");
  }
  
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName('Reviews');
  
  const EXPECTED_HEADERS = ['reviewId', 'serviceId', 'userId', 'userName', 'rating', 'comment', 'timestamp'];

  if (!sheet) {
    sheet = spreadsheet.insertSheet('Reviews');
    sheet.appendRow(EXPECTED_HEADERS);
  }
  
  const allData = sheet.getDataRange().getValues();
  const headers = allData.length > 0 ? allData[0] : [];
  const dataRows = allData.length > 1 ? allData.slice(1) : [];
  
  // Use actual headers from sheet for robustness, but fallback to expected.
  const reviewIdHeaderIndex = headers.indexOf('reviewId') > -1 ? headers.indexOf('reviewId') : EXPECTED_HEADERS.indexOf('reviewId');
  const userIdHeaderIndex = headers.indexOf('userId') > -1 ? headers.indexOf('userId') : EXPECTED_HEADERS.indexOf('userId');
  const serviceIdHeaderIndex = headers.indexOf('serviceId') > -1 ? headers.indexOf('serviceId') : EXPECTED_HEADERS.indexOf('serviceId');
  
  let existingRowIndex = -1;
  const payloadReviewId = reviewId ? String(reviewId).trim() : '';

  // Find existing row: First try by explicit ID (for edits), then by user/service combo (to prevent duplicates).
  if (payloadReviewId) {
      existingRowIndex = dataRows.findIndex(row => row[reviewIdHeaderIndex] === payloadReviewId);
  } 
  if (existingRowIndex === -1) {
      existingRowIndex = dataRows.findIndex(row => row[userIdHeaderIndex] === userId && row[serviceIdHeaderIndex] === serviceId);
  }

  // Determine the final ID for the review.
  let finalReviewId = payloadReviewId;
  if (existingRowIndex > -1) {
    // If we found an existing row, we must prioritize the ID already in the database.
    const sheetReviewId = String(dataRows[existingRowIndex][reviewIdHeaderIndex] || '').trim();
    if (sheetReviewId) {
      finalReviewId = sheetReviewId;
    }
  }

  // If after all checks we still don't have a valid ID, it's a new review, so we generate one.
  if (!finalReviewId) {
    finalReviewId = 'review_' + Date.now();
  }

  // Build the final row data object with the guaranteed ID.
  const newRowData = {
    reviewId: finalReviewId,
    serviceId: serviceId,
    userId: userId,
    userName: userName,
    rating: rating,
    comment: comment,
    timestamp: new Date().toISOString()
  };

  const rowToWrite = EXPECTED_HEADERS.map(header => newRowData[header] || "");

  if (existingRowIndex > -1) {
    // Update the existing row in the sheet.
    // +2 offset because sheet rows are 1-based and we sliced off the header row from dataRows.
    sheet.getRange(existingRowIndex + 2, 1, 1, rowToWrite.length).setValues([rowToWrite]);
    return { message: 'Review updated successfully.' };
  } else {
    // Append a new row for a new review.
    sheet.appendRow(rowToWrite);
    return { message: 'Review saved successfully.' };
  }
}

function updateOrderStatus(payload) {
  const { orderId, status } = payload;
  if (!orderId || !status) {
    throw new Error("orderId and new status are required to update an order.");
  }

  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
  if (!sheet) {
    throw new Error("Orders sheet not found.");
  }
  
  const dataWithHeaders = sheet.getDataRange().getValues();
  const headers = dataWithHeaders.shift();
  const data = dataWithHeaders;
  
  const orderIdHeaderIndex = headers.indexOf('orderId');
  const statusHeaderIndex = headers.indexOf('status');

  if (orderIdHeaderIndex === -1 || statusHeaderIndex === -1) {
    throw new Error("'orderId' or 'status' column not found in Orders sheet.");
  }

  const rowIndexToUpdate = data.findIndex(row => row[orderIdHeaderIndex] == orderId);

  if (rowIndexToUpdate > -1) {
    // +2 because sheet rows are 1-based and we shifted headers.
    const row = rowIndexToUpdate + 2;
    sheet.getRange(row, statusHeaderIndex + 1).setValue(status);
    return { message: 'Order status updated successfully.' };
  } else {
    throw new Error('Order with ID ' + orderId + ' not found.');
  }
}
`;
