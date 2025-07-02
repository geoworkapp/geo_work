/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

// 🔥 GeoWork Time Tracker Cloud Functions
// For cost control and performance optimization
setGlobalOptions({ 
  maxInstances: 10,
  region: 'europe-west1' // European region for GDPR compliance
});

// 🚀 Health check function - verifies Cloud Functions are working
export const healthCheck = onRequest((request, response) => {
  logger.info("Health check called", {structuredData: true});
  
  response.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "GeoWork Cloud Functions are running!",
    version: "1.0.0"
  });
});

// 📋 API Info function - provides API documentation endpoint
export const apiInfo = onRequest((request, response) => {
  logger.info("API info requested", {structuredData: true});
  
  response.json({
    name: "GeoWork Time Tracker API",
    version: "1.0.0",
    description: "Geofence-based employee time tracking system",
    endpoints: {
      "/healthCheck": "Health status check",
      "/apiInfo": "API documentation"
    },
    documentation: "https://github.com/yourcompany/geowork-time-tracker"
  });
});
