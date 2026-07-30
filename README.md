# KidneyGuard Clinical AI

KidneyGuard is a next-generation clinical decision support tool designed to assist healthcare professionals in early kidney disease risk assessment. By leveraging modern AI patterns and a streamlined clinical interface, KidneyGuard transforms complex lab data into actionable risk insights.

## Purpose

The primary goal of KidneyGuard is to bridge the gap between complex laboratory biomarkers and clinical decision-making. It provides a standardized, mobile-responsive platform for:
- **Early Detection**: Identifying high-risk patients before advanced symptoms appear.
- **Data Centralization**: Consolidating demographics, vital signs, and laboratory biomarkers into a single unified view.
- **Clinical Efficiency**: Reducing the time required to interpret disparate lab values through AI-driven risk scoring.

## Key Features

- **AI Risk Assessment**: Intelligent prediction engine based on routine clinical parameters.
- **Comprehensive Data Entry**: Dedicated sections for Demographics, Vital Signs, Laboratory Biomarkers (Glucose, Urea, Creatinine, etc.), and Comorbidities.
- **Clinical Dashboard**: High-level metrics for total assessments, high-risk detection rates, and model accuracy.
- **Mobile-First UX**: Highly optimized 2-column mobile grid system for "on-the-go" clinical environments.
- **Real-time Analytics**: Immediate feedback and risk scoring as data is processed.
- **Historical Tracking**: A persistent log of recent predictions for patient follow-up.

## Technology Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router & React 19)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (Using modern @theme patterns)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: React Hooks (useState/useEffect)
- **Deployment Ready**: Optimized for Vercel and other modern hosting providers.

## Mobile Optimization

KidneyGuard was designed with the understanding that clinicians are often mobile.
- **Creative Grid Logic**: Uses a custom 2-column grid on small screens to avoid "long scroll" fatigue.
- **Pill-Style Navigation**: A sticky, compact mobile header for quick access to the side menu.
- **Adaptive Inputs**: Touch-friendly form fields with units (mg/dL, mmHg, etc.) integrated for precision.
- **Responsive Tables**: Horizontal overflow handling for deep clinical data tables on mobile viewports.

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or yarn

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/kidneyguard.git
   cd kidneyguard
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Connecting the CKD Prediction API

The frontend talks to the FastAPI prediction service in [`Kindneyguard-backend/`](./Kindneyguard-backend).

1. Configure the API URL (already scaffolded in `.env.local`):
   ```bash
   NEXT_PUBLIC_CKD_API_URL=http://localhost:8000
   ```
2. Start the backend (in a separate terminal):
   ```bash
   cd Kindneyguard-backend
   pip install fastapi uvicorn joblib scikit-learn numpy pandas shap lime pdfplumber python-multipart
   uvicorn ckd_api:app --reload --host 0.0.0.0 --port 8000
   ```
3. With both running, the **Predict Risk** page shows an "API Online" pill. Enter the 14 clinical
   values (or upload a text-based lab PDF) and click **Run AI Prediction** to get a live risk
   score, eGFR stage, and SHAP explainability.

All API calls live in [`src/lib/ckdService.ts`](./src/lib/ckdService.ts) (native `fetch`, typed).
A `savePrediction()` seam is stubbed there for **Supabase** persistence, which will be wired once
database credentials are available.

## Roadmap

- [ ] **Authentication**: Login and signup pages will be added (role-based access for Admin, Doctor, and Nurse).
- [ ] **EHR Integration**: Seamlessly pull data from existing Electronic Health Records.
- [ ] **Trend Analysis**: Visualize patient risk over time with interactive charting.
- [ ] **Multi-language Support**: Localization for global clinical teams.
- [ ] **Export Options**: Generate PDF clinical summaries for patient records.

---

*Disclaimer: KidneyGuard is a clinical decision support tool and is not intended to replace professional medical diagnosis or treatment.*
