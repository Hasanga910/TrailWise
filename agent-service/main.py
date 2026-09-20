from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional

app = FastAPI(title="TrailWise Fleet Capacity Agent")

class FleetMatchRequest(BaseModel):
    bookingId: str
    groupSize: int
    requiresAC: bool
    startDate: str
    endDate: str

class FleetMatchResponse(BaseModel):
    vehicleId: Optional[str] = None
    driverId: Optional[str] = None
    acMatch: bool
    seatConfigMatch: bool
    conflictCheck: bool

@app.post("/fleet-match")
def match_fleet(req: FleetMatchRequest):
    # Day 1 stub: LangGraph agent planner endpoint skeleton
    return FleetMatchResponse(
        vehicleId=None,
        driverId=None,
        acMatch=False,
        seatConfigMatch=False,
        conflictCheck=True
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)