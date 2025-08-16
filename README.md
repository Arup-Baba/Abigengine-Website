# A Big Engine - Backend Setup Guide

This project uses a two-backend system to enhance security and organization by separating public-facing content from private user data. You will need to deploy **two separate Google Apps Scripts** from the same `Code.gs` file, but with different configurations.

Please follow the guides below in order.

---

### 1. Main Content Backend Setup

This backend manages all public content, such as services, reels, testimonials, the car database, and handles all media uploads to Cloudflare R2.

**➡️ [Follow the Main Content Backend Setup Guide](./README-main-backend.md)**

---

### 2. User Data Backend Setup

This is a separate, dedicated backend that securely manages all sensitive user information, including user profiles and order history.

**➡️ [Follow the User Data Backend Setup Guide](./README-user-data-backend.md)**
