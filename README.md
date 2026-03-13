# Gather Up 

Gather Up is an AI-powered, campus-exclusive social networking mobile application designed for university students. It bridges the gap between digital planning and physical gathering by utilizing intelligent algorithms to match students based on shared interests, common free time, and campus locations.

> Developed as a senior design project at TOBB University of Economics and Technology by team **LORD OF THE STRINGS**.

---

##  Key Features

- 🔒 **Trusted Circle (Strict Identity):** Secure authentication restricted solely to verified university email domains (e.g., `.edu.tr`), ensuring a safe and closed campus network.
- 📅 **Smart Availability (OCR Parsing):** Users can upload their course syllabuses. The system uses OCR to parse schedules, find common free blocks, and suggest optimal meeting times.
- 🤖 **AI-Powered Recommendation Engine:** Utilizes Supabase `pgvector` to create embeddings of user interests and event descriptions, offering "One-Tap Suggestions" for highly relevant social gatherings.
- 💬 **Real-Time Event Chat:** Instant, event-scoped messaging powered by Supabase WebSockets.
- 📍 **Spatio-Temporal Heatmaps:** Analyzes campus activity trends to show users where the most popular public events are happening in real-time.

---

##  Architecture & Project Structure

The project strictly adheres to a **Feature-based Low-Level Design (LLD)** and **Clean Architecture** principles to maintain scalability and zero-budget operational efficiency.

The repository is structured as follows:
```
.
├── app/                  # Expo Router UI views and navigation screens (Presentation layer)
├── src/
│   ├── core/             # Core business logic and domain models
│   │   ├── identity/     # User management, Gamification, and Friendship (Trusted Circle) graphs
│   │   ├── schedule/     # Time slot management, availability calculations, and OCR processing
│   │   └── event/        # Event lifecycle management, capacities, and ChatRooms
│   ├── controllers/      # "Thin Controllers" — API gateway between UI and background services
│   ├── intelligence/     # AI components, matching services, and vector calculations
│   └── infra/            # Infrastructure layer (Supabase Client, Expo Push Notifications)
└── scripts/              # Automation scripts for DB population, testing, and AI model configs
```

---

##  Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React Native, Expo Router (File-based routing) |
| **Backend as a Service** | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| **AI & Algorithms** | pgvector (Vector Similarity Search), Python (LLM setup & data generation) |
| **Languages** | TypeScript, Python |

---

##  Getting Started

Follow these steps to run the project locally.

### Prerequisites

- Node.js (v18 or newer recommended)
- Expo CLI
- A Supabase project account

### Installation

1. **Clone the repository:**
```bash
   git clone https://github.com/LordOfTheStringss/GatherUp.git
   cd GatherUp
```

2. **Install dependencies:**
```bash
   npm install
```

3. **Configure Environment Variables:**

   Create a `.env` file in the root directory and add your Supabase credentials:
```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Run the Application:**
```bash
   npx expo start
```
   Press `a` for Android Emulator, `i` for iOS Simulator, or scan the QR code with the **Expo Go** app.

### AI & Database Setup (Optional)

If you are working on the Intelligence package, use the provided scripts to initialize the vector database and LLM configurations:
```bash
bash setup_llm.sh
node test_db.js
```

---

##  Team: LORD OF THE STRINGS

| Name |
|---|
| Aylin Doğan |
| Emir Yücedağ |
| Kerem Kazandır |
| Zeynep Yağmur Bozdağ |

---

> This project is developed under the constraints of a **zero-budget architecture** and strict data privacy **(KVKK)** rules.
