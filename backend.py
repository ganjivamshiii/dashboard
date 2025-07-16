from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List
from datetime import date, datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String, Float, Date, ForeignKey, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from fastapi.responses import FileResponse
import os
import uvicorn
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="EazyVenue Booking API")

# Then mount static files after this
app.mount("/static", StaticFiles(directory="static"), name="static")

# Database Setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./venues.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class VenueDB(Base):
    __tablename__ = "venues"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    location = Column(String)
    capacity = Column(Integer)
    price_per_day = Column(Float)
    description = Column(String)
    amenities = Column(String)
    bookings = relationship("BookingDB", back_populates="venue")
    blocked_dates = relationship("BlockedDateDB", back_populates="venue")

class BookingDB(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id"))
    booking_date = Column(Date)
    user_name = Column(String)
    user_email = Column(String)
    status = Column(String, default="confirmed")
    venue = relationship("VenueDB", back_populates="bookings")

class BlockedDateDB(Base):
    __tablename__ = "blocked_dates"
    id = Column(Integer, primary_key=True, index=True)
    venue_id = Column(Integer, ForeignKey("venues.id"))
    blocked_date = Column(Date)
    reason = Column(String)
    venue = relationship("VenueDB", back_populates="blocked_dates")

Base.metadata.create_all(bind=engine)

# Pydantic Models
class VenueCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    location: str = Field(..., min_length=1)
    capacity: int = Field(..., gt=0)
    price_per_day: float = Field(..., gt=0)
    description: str = ""
    amenities: str = ""

class Venue(VenueCreate):
    id: int

    class Config:
        orm_mode = True

class BookingCreate(BaseModel):
    venue_id: int
    booking_date: date
    user_name: str = Field(..., min_length=1)
    user_email: str = Field(..., regex=r'^[^@]+@[^@]+\.[^@]+$')

class Booking(BookingCreate):
    id: int
    status: str

    class Config:
        orm_mode = True  # ✅ this is the required fix


class BlockDate(BaseModel):
    venue_id: int
    blocked_date: date
    reason: str = "Owner blocked"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/venues", response_model=List[Venue])
async def get_venues(db: Session = Depends(get_db)):
    return db.query(VenueDB).all()

@app.post("/venues", response_model=Venue)
async def create_venue(venue: VenueCreate, db: Session = Depends(get_db)):
    db_venue = VenueDB(**venue.dict())
    db.add(db_venue)
    db.commit()
    db.refresh(db_venue)
    return db_venue

@app.get("/venues/{venue_id}/availability")
async def get_venue_availability(venue_id: int, db: Session = Depends(get_db)):
    venue = db.query(VenueDB).filter(VenueDB.id == venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    booked_dates = [b.booking_date for b in db.query(BookingDB).filter(BookingDB.venue_id == venue_id).all()]
    blocked_dates = [b.blocked_date for b in db.query(BlockedDateDB).filter(BlockedDateDB.venue_id == venue_id).all()]
    
    available_dates = []
    current_date = date.today()
    for i in range(30):
        check_date = current_date + timedelta(days=i)
        if check_date not in booked_dates and check_date not in blocked_dates:
            available_dates.append(check_date)

    return {
        "venue_id": venue_id,
        "available_dates": available_dates,
        "blocked_dates": blocked_dates,
        "booked_dates": booked_dates
    }

@app.post("/bookings", response_model=Booking)
async def book_venue(booking: BookingCreate, db: Session = Depends(get_db)):
    venue = db.query(VenueDB).filter(VenueDB.id == booking.venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")

    if db.query(BookingDB).filter(BookingDB.venue_id == booking.venue_id, BookingDB.booking_date == booking.booking_date).first():
        raise HTTPException(status_code=400, detail="Venue already booked for this date")
    
    if db.query(BlockedDateDB).filter(BlockedDateDB.venue_id == booking.venue_id, BlockedDateDB.blocked_date == booking.booking_date).first():
        raise HTTPException(status_code=400, detail="Date is blocked by venue owner")

    db_booking = BookingDB(**booking.dict())
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    return db_booking

@app.get("/bookings", response_model=List[Booking])
async def get_bookings(db: Session = Depends(get_db)):
    return db.query(BookingDB).all()

@app.post("/block-date")
async def block_date(block_date: BlockDate, db: Session = Depends(get_db)):
    venue = db.query(VenueDB).filter(VenueDB.id == block_date.venue_id).first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    # Check if date is already booked
    existing_booking = db.query(BookingDB).filter(
        BookingDB.venue_id == block_date.venue_id,
        BookingDB.booking_date == block_date.blocked_date
    ).first()
    
    if existing_booking:
        raise HTTPException(status_code=400, detail="Date is already booked")
    
    # Check if date is already blocked
    existing_block = db.query(BlockedDateDB).filter(
        BlockedDateDB.venue_id == block_date.venue_id,
        BlockedDateDB.blocked_date == block_date.blocked_date
    ).first()
    
    if existing_block:
        raise HTTPException(status_code=400, detail="Date is already blocked")
    
    db_block = BlockedDateDB(
        venue_id=block_date.venue_id,
        blocked_date=block_date.blocked_date,
        reason=block_date.reason
    )
    db.add(db_block)
    db.commit()
    db.refresh(db_block)
    return {"message": "Date blocked successfully"}

@app.get("/analytics/dashboard")
async def get_analytics(db: Session = Depends(get_db)):
    total_venues = db.query(VenueDB).count()
    total_bookings = db.query(BookingDB).count()

    total_revenue = db.query(func.sum(VenueDB.price_per_day)).join(BookingDB).scalar() or 0.0

    top_venue = db.query(
        VenueDB.name, func.count(BookingDB.id).label('booking_count')
    ).join(BookingDB).group_by(VenueDB.id).order_by(func.count(BookingDB.id).desc()).first()

    top_user = db.query(
        BookingDB.user_name, func.count(BookingDB.id).label('booking_count')
    ).group_by(BookingDB.user_name).order_by(func.count(BookingDB.id).desc()).first()

    return {
        "total_venues": total_venues,
        "total_bookings": total_bookings,
        "total_revenue": total_revenue,
        "top_venue": {"name": top_venue[0], "bookings": top_venue[1]} if top_venue else None,
        "top_user": {"name": top_user[0], "bookings": top_user[1]} if top_user else None,
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now()}

from fastapi.responses import FileResponse

@app.get("/")
def serve_index():
    return FileResponse("static/index.html")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)