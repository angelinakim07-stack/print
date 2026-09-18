"""PRINT PACK INC — Order & Production Management API."""
import logging
import os

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

import auth_routes
import file_routes
import followup_routes
import notification_routes
import order_routes
import report_routes
import request_routes
import user_routes
from db import client, ensure_indexes
from seed import ensure_seed

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("printpack")

app = FastAPI(title="PRINT PACK INC API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "PRINT PACK INC Order & Production Management", "status": "ok"}


@api_router.get("/health")
async def health():
    return {"status": "healthy"}


api_router.include_router(auth_routes.router, prefix="/auth", tags=["auth"])
api_router.include_router(user_routes.router, prefix="/users", tags=["users"])
api_router.include_router(request_routes.router, prefix="/requests", tags=["requests"])
api_router.include_router(order_routes.router, prefix="/orders", tags=["orders"])
api_router.include_router(followup_routes.router, prefix="/followups", tags=["followups"])
api_router.include_router(notification_routes.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(file_routes.router, prefix="/files", tags=["files"])
api_router.include_router(report_routes.router, prefix="/reports", tags=["reports"])

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await ensure_indexes()
    await ensure_seed()
    logger.info("PRINT PACK INC API ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()
