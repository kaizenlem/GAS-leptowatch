"""
Firebase Configuration and Initialization module for LeptoWatch.
Provides resilient initialization of Firebase Admin SDK / Cloud Firestore
with automatic fallback to local audit logging for offline or unconfigured environments.
"""

import os
import json
import logging
from typing import Optional, Any

import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger("leptowatch.firebase")

_firestore_client: Optional[Any] = None
_firebase_initialized: bool = False


def initialize_firebase():
    """
    Initializes Firebase Admin SDK using:
    1. FIREBASE_CREDENTIALS environment variable (file path or inline JSON string)
    2. GOOGLE_APPLICATION_CREDENTIALS environment variable
    3. Google Cloud Run ambient default service account
    4. Graceful fallback if no credentials provided (local persistence fallback)
    """
    global _firestore_client, _firebase_initialized

    if _firebase_initialized and _firestore_client is not None:
        return _firestore_client

    cred_val = os.getenv("FIREBASE_CREDENTIALS") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")

    try:
        if not firebase_admin._apps:
            if cred_val:
                # Check if cred_val is a JSON string or a file path
                if cred_val.strip().startswith("{"):
                    cred_dict = json.loads(cred_val)
                    cred = credentials.Certificate(cred_dict)
                elif os.path.exists(cred_val):
                    cred = credentials.Certificate(cred_val)
                else:
                    logger.warning("FIREBASE_CREDENTIALS path not found. Falling back to Application Default Credentials.")
                    cred = credentials.ApplicationDefault()
                firebase_admin.initialize_app(cred)
            else:
                # Attempt to initialize with Cloud Run default credentials
                try:
                    cred = credentials.ApplicationDefault()
                    firebase_admin.initialize_app(cred)
                except Exception as default_err:
                    logger.info("Application Default Credentials unavailable: %s. Using local fallback mode.", default_err)
                    _firebase_initialized = False
                    return None

        _firestore_client = firestore.client()
        _firebase_initialized = True
        logger.info("Firebase Firestore successfully initialized.")
        return _firestore_client
    except Exception as e:
        logger.warning("Could not initialize Firebase Admin SDK: %s. Continuing in offline/local fallback mode.", e)
        _firestore_client = None
        _firebase_initialized = False
        return None


def get_firestore_db():
    """Returns the initialized Firestore database client, or None if in offline fallback mode."""
    global _firestore_client
    if _firestore_client is None and not _firebase_initialized:
        return initialize_firebase()
    return _firestore_client
