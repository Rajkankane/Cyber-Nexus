import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException
from app.schemas.schemas import TaskResponse, ErrorEnvelope

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

# In-memory background task registry (thread-safe for async FastAPI event loop)
_TASKS: Dict[str, Dict[str, Any]] = {}

def create_task(task_type: str, message: str = "Task initiated") -> str:
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    _TASKS[task_id] = {
        "task_id": task_id,
        "task_type": task_type,
        "status": "RUNNING",
        "progress": 10,
        "message": message,
        "result": None,
        "created_at": now,
        "updated_at": now
    }
    return task_id

def update_task_progress(task_id: str, progress: int, message: str, result: Optional[Dict[str, Any]] = None):
    if task_id in _TASKS:
        _TASKS[task_id]["progress"] = progress
        _TASKS[task_id]["message"] = message
        _TASKS[task_id]["updated_at"] = datetime.now(timezone.utc)
        if result is not None:
            _TASKS[task_id]["result"] = result
        if progress >= 100:
            _TASKS[task_id]["status"] = "COMPLETED"

def fail_task(task_id: str, error_message: str):
    if task_id in _TASKS:
        _TASKS[task_id]["status"] = "FAILED"
        _TASKS[task_id]["message"] = error_message
        _TASKS[task_id]["updated_at"] = datetime.now(timezone.utc)

@router.get("/{task_id}", response_model=TaskResponse, responses={404: {"model": ErrorEnvelope}})
def get_task_status(task_id: str):
    task = _TASKS.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return TaskResponse(**task)

@router.get("", response_model=List[TaskResponse])
def list_tasks(limit: int = 10):
    sorted_tasks = sorted(_TASKS.values(), key=lambda x: x["created_at"], reverse=True)
    return [TaskResponse(**t) for t in sorted_tasks[:limit]]
