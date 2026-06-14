# How to Run the Test Case Generator

This guide provides step-by-step instructions for setting up and running the Test Case Generator application.

## Prerequisites

Before starting, ensure you have the following installed:
- Python 3.12 or higher
- Node.js 16 or higher
- PostgreSQL 12 or higher
- Git

## Step 1: Clone the Repository

```bash
git clone <repository-url>
cd Test-Forge_AI
```

## Step 2: Backend Setup

1. **Install root level dependencies first**:
```bash
# From the project root directory
pip install -r requirements.txt
```
This installs the global dependencies with their specific versions.

2. **Create and activate Python virtual environment**:
```bash
# Navigate to Backend directory
cd Backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# For Windows:
venv\Scripts\activate
# For Linux/Mac:
source venv/bin/activate
```

3. **Install Backend dependencies**:
```bash
# Make sure you're in the Backend directory with venv activated
pip install -r requirements.txt
```
Note: Some packages might be installed with different versions than the root requirements.txt. This is expected and necessary for the Backend to function properly.

4. **Set up environment variables**:
Create a `.env` file in the Backend directory with the following content:
```env
# Database Configuration
POSTGRES_DB=test_case_generator
POSTGRES_USER=your_username
POSTGRES_PASSWORD=your_password
POSTGRES_HOST=localhost
POSTGRES_PORT=5432

# LLM Configuration (Groq + Llama 3.1 — see app/config.py)
GROQ_API_KEY=your_groq_api_key
GROQ_API_KEY_IMPACT=your_groq_api_key  # Optional; falls back to GROQ_API_KEY

# Jira Configuration (Optional)
JIRA_BASE_URL=https://your-company.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token
JIRA_SYNC_ENABLED=false
JIRA_PROJECT_KEYS=PROJ1,PROJ2
JIRA_SYNC_ALL_PROJECTS=false
```

5. **Create required folders**:
```bash
python setup_project_folders.py
```

6. **Initialize databases**:
```bash
# Navigate to models directory
cd app/models
python create_dbs.py
```

## Step 3: Frontend Setup

1. **Install Node.js dependencies**:
```bash
# Navigate to frontend directory
cd frontend/test-case-generator

#Try 
npm install 
#if not works
# Install dependencies (use legacy peer deps to avoid conflicts)
npm install --legacy-peer-deps
```

2. **Set up frontend environment variables**:
Create `.env.local` file in `frontend/test-case-generator` directory:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SCHEDULER_API_URL=http://localhost:5001
GOOGLE_GENERATIVE_AI_API_KEY=your_google_api_key
```

## Step 4: Running the Application

You'll need two terminal windows to run all components:

1. **Terminal 1 - Run Backend API**:
```bash
# Make sure you're in Backend directory with venv activated
cd Backend
python run.py
```
This will start the main API server on http://localhost:5000

2. **Terminal 2 - Run Standalone Scheduler**:
```bash
# In Backend directory with venv activated
cd Backend
python standalone_scheduler.py
```
This will start the scheduler service on http://localhost:5001

The standalone scheduler provides:
- API endpoints for manual triggering
- Web interface integration
- Background job processing
- Next reload time tracking
- CORS support for frontend

Note: You don't need to run both `scheduler.py` and `standalone_scheduler.py`. The `standalone_scheduler.py` is the preferred version as it provides additional features and better integration with the frontend.

3. **Terminal 3 - Run Frontend**:
```bash
# Navigate to frontend directory
cd frontend/test-case-generator

#Try 
npm install 
#if not works
# Install dependencies (use legacy peer deps to avoid conflicts)
npm install --legacy-peer-deps

# Start the development server
npm run dev
```
This will start the frontend application on http://localhost:3000

## Step 5: Verify Installation

1. Open your browser and navigate to http://localhost:3000
2. You should see the Test Case Generator interface
3. Try uploading a sample user story or connecting to Jira to verify functionality

## Common Issues and Solutions

1. **Database Connection Error**:
   - Verify PostgreSQL is running
   - Check database credentials in `.env`
   - Ensure database is created

2. **LanceDB Error**:
   - Check if lance_db directory exists in Backend/data
   - Verify write permissions

3. **API Connection Error**:
   - Verify all services are running
   - Check if ports 5000 and 5001 are available
   - Verify environment variables are set correctly

## File Execution Order

For proper setup, execute files in this order:
1. `setup_project_folders.py` - Creates necessary directories
2. `create_dbs.py` - Initializes databases
3. `run.py` - Starts main API
4. `scheduler.py` - Starts scheduler service
5. Frontend `npm run dev` - Starts web interface

## Additional Notes

- The scheduler runs every 5 minutes to process new documents
- You can manually trigger processing using the UI
- Check logs in the terminal windows for any errors
- For Jira integration, ensure you have valid API credentials

For more detailed information about the project structure and features, refer to the main `README.md` file. 
