# Dashboard
# EazyVenue Booking API

A FastAPI-based venue booking management system that allows users to book venues, manage availability, and view analytics.

## Features

- **Venue Management**: Create and list venues with details like capacity, location, pricing, and amenities
- **Booking System**: Book venues for specific dates with user validation
- **Date Blocking**: Allow venue owners to block specific dates
- **Availability Checking**: Check available dates for venues (30-day window)
- **Analytics Dashboard**: View booking statistics and revenue data

## Tech Stack

- **Backend**: FastAPI (Python)
- **Database**: SQLite with SQLAlchemy ORM
- **Validation**: Pydantic models
- **CORS**: Enabled for frontend integration

## Installation

### Prerequisites

- Python 3.7+
- pip (Python package manager)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ganjivamshiii/dashboard
   cd eazyvenue-booking-api
   ```

2. **Create a virtual environment**
   ```bash
   python -m venv venv
   
   # On Windows
   venv\Scripts\activate
   
   # On macOS/Linux
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install fastapi uvicorn sqlalchemy pydantic
   ```

4. **Create static directory**
   ```bash
   mkdir static
   ```

5. **Run the application**
   ```bash
   python main.py
   ```

   Or using uvicorn directly:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

## API Endpoints

### Venues

- **GET /venues** - Get all venues
- **POST /venues** - Create a new venue
- **GET /venues/{venue_id}/availability** - Check venue availability

### Bookings

- **GET /bookings** - Get all bookings
- **POST /bookings** - Create a new booking

### Date Management

- **POST /block-date** - Block a specific date for a venue

### Analytics

- **GET /analytics/dashboard** - Get booking analytics and statistics


### Frontend

- **GET /** - Serve the main frontend page (index.html)

## API Documentation

Once the server is running, you can access:

- **Interactive API Documentation**: http://localhost:8000/docs
- **Alternative API Documentation**: http://localhost:8000/redoc

## Request/Response Examples

### Create a Venue

```bash
curl -X POST "http://localhost:8000/venues" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grand Ballroom",
    "location": "Downtown Hotel",
    "capacity": 200,
    "price_per_day": 1500.00,
    "description": "Elegant ballroom perfect for weddings and corporate events",
    "amenities": "Sound system, lighting, tables, chairs"
  }'
```

### Check Availability

```bash
curl -X GET "http://localhost:8000/venues/1/availability"
```

### Block a Date

```bash
curl -X POST "http://localhost:8000/block-date" \
  -H "Content-Type: application/json" \
  -d '{
    "venue_id": 1,
    "blocked_date": "2024-12-31",
    "reason": "Maintenance"
  }'
```

## Data Models

### Venue
- `id`: Integer (auto-generated)
- `name`: String (required, 1-100 characters)
- `location`: String (required)
- `capacity`: Integer (required, > 0)
- `price_per_day`: Float (required, > 0)
- `description`: String (optional)
- `amenities`: String (optional)

### Booking
- `id`: Integer (auto-generated)
- `venue_id`: Integer (required)
- `booking_date`: Date (required)
- `user_name`: String (required)
- `user_email`: String (required, valid email format)
- `status`: String (default: "confirmed")

### Blocked Date
- `id`: Integer (auto-generated)
- `venue_id`: Integer (required)
- `blocked_date`: Date (required)
- `reason`: String (default: "Owner blocked")

## Database

The application uses SQLite database (`venues.db`) with the following tables:

- `venues`: Store venue information
- `bookings`: Store booking records
- `blocked_dates`: Store blocked dates for venues

The database is automatically created when the application starts.


### Running in Development Mode

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Testing

You can test the API using:

- **Postman**: Import the API endpoints
- **curl**: Use the examples provided above
- **FastAPI Docs**: Use the interactive documentation at `/docs`

## Production Deployment

For production deployment:

1. **Update CORS settings** to specific domains
2. **Use a production database** (sqlite)
3. **Set up proper logging**
4. **Use a production WSGI server** like Gunicorn
Example production command:
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

**Note**: Make sure to place your frontend files (HTML, CSS, JS) in the `static` directory for the frontend serving to work properly.