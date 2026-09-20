import time
from typing import Dict, Tuple
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import User
from app.schemas.schemas import Token, UserLogin, UserResponse, RefreshTokenRequest, ErrorEnvelope
from app.auth.jwt import verify_password, create_access_token, create_refresh_token, decode_access_token
from app.auth.rbac import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory sliding window rate limiter for auth (max 10 attempts per minute per IP)
_AUTH_ATTEMPTS: Dict[str, list] = {}
RATE_LIMIT_MAX_ATTEMPTS = 10
RATE_LIMIT_WINDOW_SECONDS = 60

def check_rate_limit(client_ip: str):
    now = time.time()
    attempts = _AUTH_ATTEMPTS.get(client_ip, [])
    # Filter attempts within window
    valid_attempts = [t for t in attempts if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(valid_attempts) >= RATE_LIMIT_MAX_ATTEMPTS:
        _AUTH_ATTEMPTS[client_ip] = valid_attempts
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Rate limit exceeded. Please wait 60 seconds."
        )
    valid_attempts.append(now)
    _AUTH_ATTEMPTS[client_ip] = valid_attempts

@router.post("/login", response_model=Token, responses={401: {"model": ErrorEnvelope}, 429: {"model": ErrorEnvelope}})
def login(login_req: UserLogin, request: Request, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "127.0.0.1"
    check_rate_limit(client_ip)

    user = db.query(User).filter(User.username == login_req.username).first()
    if not user or not verify_password(login_req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or badge credentials."
        )

    access_token = create_access_token(data={"sub": user.username, "role": user.role})
    refresh_token = create_refresh_token(data={"sub": user.username, "role": user.role})

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
        "role": user.role,
        "badge_number": user.badge_number,
        "username": user.username
    }

@router.post("/refresh", response_model=Token, responses={401: {"model": ErrorEnvelope}})
def refresh_token_endpoint(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    payload = decode_access_token(req.refresh_token)
    if not payload or payload.get("token_type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token."
        )

    username = payload.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with refresh token not found."
        )

    new_access = create_access_token(data={"sub": user.username, "role": user.role})
    new_refresh = create_refresh_token(data={"sub": user.username, "role": user.role})

    return {
        "access_token": new_access,
        "token_type": "bearer",
        "refresh_token": new_refresh,
        "role": user.role,
        "badge_number": user.badge_number,
        "username": user.username
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
