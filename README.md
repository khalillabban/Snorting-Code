# Snorting Code


**Frontend:**
```
npm install
```

**Backend:**
```
cd backend
python -m venv venv
venv\Scripts\activate.bat
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
cd ..
```

## Verify Everything Works

### Step 1: Test Frontend

Open Terminal 1:
```
npm test
```

Expected: All tests pass (3 tests)

### Step 2: Test Backend

Open Terminal 2:
```
cd backend
venv\Scripts\activate.bat
python -m pytest --cov
```

Expected: All tests pass (3 tests, 100% coverage)

### Step 3: Run Frontend

Open Terminal 1 (or new terminal):
```
npm run web
```

Expected: App opens in browser at http://localhost:8081

### Step 4: Run Backend

Open Terminal 2 (or new terminal):
```
cd backend
venv\Scripts\activate.bat
uvicorn main:app --reload
```

Expected: Server starts at http://localhost:8000

### Step 5: Verify Backend API

Open browser and visit:
- http://localhost:8000 (should show API info)
- http://localhost:8000/docs (should show Swagger UI)
- http://localhost:8000/health (should return {"status": "healthy"})

## Quick Reference

**Testing:**
- Frontend: `npm test`
- Backend: `cd backend`, then `venv\Scripts\activate.bat`, then `python -m pytest --cov`

**Running:**
- Frontend: `npm run web` (or `npm start` for Expo Go)
- Backend: `cd backend`, then `venv\Scripts\activate.bat`, then `uvicorn main:app --reload`

## Troubleshooting

**Expo Go stuck on "Opening project":**
1. Make sure phone and computer are on the same WiFi network
2. Try using tunnel mode: `npx expo start --tunnel`
3. Check firewall isn't blocking port 8081
4. Restart Expo: Stop server (Ctrl+C) and run `npm start` again
5. Alternative: Use web version with `npm run web`

**Backend venv not activated:**
- Make sure you see `(venv)` in your terminal prompt
- If not: `cd backend`, then `venv\Scripts\activate.bat`

**Port already in use:**
- Frontend: Change port in Expo settings
- Backend: Change port: `uvicorn main:app --reload --port 8001`

**Tests fail:**
- Frontend: Run `npm install` again
- Backend: Make sure venv is activated and run `python -m pip install -r requirements-dev.txt`
