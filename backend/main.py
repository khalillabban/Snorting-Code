from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(
    title="Snorting Code API",
    description="Backend API for Snorting Code mobile application",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return JSONResponse(
        content={
            "message": "Snorting Code API",
            "version": "1.0.0",
            "status": "running",
        }
    )


@app.get("/health")
async def health_check():
    return JSONResponse(content={"status": "healthy"})


@app.get("/api/v1/status")
async def api_status():
    return JSONResponse(
        content={
            "api": "Snorting Code API",
            "version": "1.0.0",
            "status": "operational",
        }
    )
