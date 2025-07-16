const API_BASE = window.location.origin;
let currentVenueId = null;
let bookingChart = null;
let revenueChart = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    loadUserVenues();
    loadHeaderStats();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    // Search functionality
    document.getElementById('venueSearch').addEventListener('input', filterVenues);
    document.getElementById('capacityFilter').addEventListener('change', filterVenues);
    
    // Analytics period filter
    document.getElementById('analyticsPeriod').addEventListener('change', loadAnalytics);
    
    // Form submission
    document.getElementById('venueForm').addEventListener('submit', handleVenueSubmit);
}

// Tab Management
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'user') loadUserVenues();
    if (tabName === 'admin') loadAdminData();
    if (tabName === 'analytics') loadAnalytics();
}

// Alert System
function showAlert(message, type = 'success') {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => alert.remove(), 300);
    }, 5000);
}

// Load Header Statistics
async function loadHeaderStats() {
    try {
        const response = await axios.get(`${API_BASE}/analytics/dashboard`);
        const data = response.data;
        
        document.getElementById('headerTotalVenues').textContent = data.total_venues;
        document.getElementById('headerTotalBookings').textContent = data.total_bookings;
    } catch (error) {
        console.error('Error loading header stats:', error);
    }
}

// Load User Venues
async function loadUserVenues() {
    try {
        const response = await axios.get(`${API_BASE}/venues`);
        const venues = response.data;
        
        displayVenues(venues);
    } catch (error) {
        showAlert('Error loading venues', 'error');
    }
}

// Display Venues
function displayVenues(venues) {
    const html = venues.map(venue => `
        <div class="venue-card" data-capacity="${venue.capacity}" data-name="${venue.name.toLowerCase()}">
            <h3>${venue.name}</h3>
            <div class="venue-info">
                <p><strong>📍 Location:</strong> ${venue.location}</p>
                <p><strong>👥 Capacity:</strong> ${venue.capacity} people</p>
                <p><strong>💰 Price:</strong> $${venue.price_per_day}/day</p>
                <p><strong>📝 Description:</strong> ${venue.description}</p>
                <p><strong>🎯 Amenities:</strong> ${venue.amenities}</p>
            </div>
            <div class="venue-actions">
                <button class="btn btn-primary" onclick="openBookingModal(${venue.id})">
                    Check Availability & Book
                </button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('userVenues').innerHTML = html;
}

// Filter Venues
function filterVenues() {
    const searchTerm = document.getElementById('venueSearch').value.toLowerCase();
    const capacityFilter = document.getElementById('capacityFilter').value;
    
    const venues = document.querySelectorAll('.venue-card');
    
    venues.forEach(venue => {
        const name = venue.dataset.name;
        const capacity = parseInt(venue.dataset.capacity);
        
        let showVenue = true;
        
        // Search filter
        if (searchTerm && !name.includes(searchTerm)) {
            showVenue = false;
        }
        
        // Capacity filter
        if (capacityFilter) {
            if (capacityFilter === 'small' && capacity > 50) showVenue = false;
            if (capacityFilter === 'medium' && (capacity <= 50 || capacity > 200)) showVenue = false;
            if (capacityFilter === 'large' && capacity <= 200) showVenue = false;
        }
        
        venue.style.display = showVenue ? 'block' : 'none';
    });
}

// Booking Modal Functions
async function openBookingModal(venueId) {
    currentVenueId = venueId;
    document.getElementById('bookingModal').style.display = 'block';
    
    // Load availability calendar
    try {
        const response = await axios.get(`${API_BASE}/venues/${venueId}/availability`);
        const availability = response.data;
        
        generateCalendar(availability);
    } catch (error) {
        showAlert('Error loading availability', 'error');
    }
}

function generateCalendar(availability) {
    const today = new Date();
    const calendar = [];
    
    for (let i = 0; i < 42; i++) { // 6 weeks
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        let status = 'available';
        if (availability.booked_dates.includes(dateStr)) status = 'booked';
        if (availability.blocked_dates.includes(dateStr)) status = 'blocked';
        
        calendar.push({
            date: dateStr,
            day: date.getDate(),
            status: status
        });
    }
    
    const calendarHtml = calendar.map(day => `
        <div class="calendar-day ${day.status}" 
             onclick="selectDate('${day.date}', '${day.status}')"
             data-date="${day.date}">
            ${day.day}
        </div>
    `).join('');
    
    document.getElementById('availabilityCalendar').innerHTML = calendarHtml;
}

function selectDate(date, status) {
    if (status === 'available') {
        document.getElementById('bookingDate').value = date;
        
        // Update visual selection
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });
        event.target.classList.add('selected');
    } else {
        showAlert(`Date is ${status}`, 'error');
    }
}

function closeBookingModal() {
    document.getElementById('bookingModal').style.display = 'none';
    currentVenueId = null;
    
    // Clear form
    document.getElementById('userName').value = '';
    document.getElementById('userEmail').value = '';
    document.getElementById('bookingDate').value = '';
}

async function confirmBooking() {
    const userName = document.getElementById('userName').value;
    const userEmail = document.getElementById('userEmail').value;
    const bookingDate = document.getElementById('bookingDate').value;
    
    if (!userName || !userEmail || !bookingDate) {
        showAlert('Please fill all fields', 'error');
        return;
    }
    
    try {
        await axios.post(`${API_BASE}/bookings`, {
            venue_id: currentVenueId,
            booking_date: bookingDate,
            user_name: userName,
            user_email: userEmail
        });
        
        showAlert('Booking confirmed successfully!');
        closeBookingModal();
        loadUserVenues();
        loadHeaderStats();
    } catch (error) {
        showAlert(error.response?.data?.detail || 'Booking failed', 'error');
    }
}

// Admin Functions
async function loadAdminData() {
    try {
        const [venuesResponse, bookingsResponse] = await Promise.all([
            axios.get(`${API_BASE}/venues`),
            axios.get(`${API_BASE}/bookings`)
        ]);
        
        const venues = venuesResponse.data;
        const bookings = bookingsResponse.data;
        
        displayAdminVenues(venues);
        displayRecentBookings(bookings);
    } catch (error) {
        showAlert('Error loading admin data', 'error');
    }
}

function displayAdminVenues(venues) {
    const adminVenuesHtml = venues.map(venue => `
        <div class="venue-card">
            <h4>${venue.name}</h4>
            <p><strong>Location:</strong> ${venue.location}</p>
            <p><strong>Capacity:</strong> ${venue.capacity} people</p>
            <p><strong>Price:</strong> $${venue.price_per_day}/day</p>
            <div class="venue-actions">
                <button class="btn btn-primary" onclick="manageVenue(${venue.id})">
                    Manage Dates
                </button>
                <button class="btn btn-danger" onclick="deleteVenue(${venue.id})">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
    
    document.getElementById('adminVenues').innerHTML = adminVenuesHtml;
}

function displayRecentBookings(bookings) {
    const recentBookingsHtml = bookings.slice(-8).reverse().map(booking => `
        <div class="venue-card">
            <h4>Booking #${booking.id}</h4>
            <p><strong>Venue ID:</strong> ${booking.venue_id}</p>
            <p><strong>Date:</strong> ${new Date(booking.booking_date).toLocaleDateString()}</p>
            <p><strong>User:</strong> ${booking.user_name}</p>
            <p><strong>Email:</strong> ${booking.user_email}</p>
            <div class="booking-status">
                <span class="availability-status available">${booking.status}</span>
            </div>
        </div>
    `).join('');
    
    document.getElementById('recentBookings').innerHTML = recentBookingsHtml;
}

// Manage Venue Dates
async function manageVenue(venueId) {
    try {
        const response = await axios.get(`${API_BASE}/venues/${venueId}/availability`);
        const availability = response.data;
        
        const modalContent = `
            <div class="form-group">
                <label>Block a Date</label>
                <input type="date" id="blockDateInput" class="form-control">
            </div>
            <div class="form-group">
                <label>Reason (optional)</label>
                <input type="text" id="blockReason" placeholder="Reason for blocking" class="form-control">
            </div>
            <button class="btn btn-danger" onclick="blockDate(${venueId})">Block Date</button>
            
            <div style="margin-top: 30px;">
                <h4>Current Status</h4>
                <div class="status-summary">
                    <div class="status-item">
                        <span class="status-count">${availability.booked_dates.length}</span>
                        <span class="status-label">Booked Dates</span>
                    </div>
                    <div class="status-item">
                        <span class="status-count">${availability.blocked_dates.length}</span>
                        <span class="status-label">Blocked Dates</span>
                    </div>
                </div>
            </div>
        `;
        
        showModal('Manage Dates', modalContent);
    } catch (error) {
        showAlert('Error loading venue dates', 'error');
    }
}

async function blockDate(venueId) {
    const dateInput = document.getElementById('blockDateInput').value;
    const reason = document.getElementById('blockReason').value;
    
    if (!dateInput) {
        showAlert('Please select a date', 'error');
        return;
    }
    
    try {
        await axios.post(`${API_BASE}/block-date`, {
            venue_id: venueId,
            blocked_date: dateInput,
            reason: reason || "Owner blocked"
        });
        
        showAlert('Date blocked successfully');
        document.querySelector('.modal').remove();
        loadAdminData();
    } catch (error) {
        showAlert(error.response?.data?.detail || 'Failed to block date', 'error');
    }
}

async function deleteVenue(venueId) {
    if (!confirm('Are you sure you want to delete this venue?')) {
        return;
    }
    
    try {
        await axios.delete(`${API_BASE}/venues/${venueId}`);
        showAlert('Venue deleted successfully');
        loadAdminData();
    } catch (error) {
        showAlert(error.response?.data?.detail || 'Failed to delete venue', 'error');
    }
}

// Analytics Functions
async function loadAnalytics() {
    try {
        const response = await axios.get(`${API_BASE}/analytics/dashboard`);
        const data = response.data;
        
        displayAnalyticsCards(data);
        displayCharts(data);
        displayTopPerformers(data);
        displayRecentActivity(data);
    } catch (error) {
        showAlert('Error loading analytics', 'error');
    }
}

function displayAnalyticsCards(data) {
    const currentMonth = new Date().getMonth();
    const previousMonth = currentMonth - 1;
    
    // Calculate trends (mock data for demonstration)
    const trends = {
        venues: Math.floor(Math.random() * 20) - 10,
        bookings: Math.floor(Math.random() * 50) - 25,
        revenue: Math.floor(Math.random() * 1000) - 500,
        occupancy: Math.floor(Math.random() * 20) - 10
    };
    
    const cardsHtml = `
        <div class="analytics-card">
            <h3>${data.total_venues}</h3>
            <p>Total Venues</p>
            <div class="trend ${trends.venues > 0 ? 'up' : 'down'}">
                ${trends.venues > 0 ? '↗' : '↘'} ${Math.abs(trends.venues)}% vs last month
            </div>
        </div>
        <div class="analytics-card success">
            <h3>${data.total_bookings}</h3>
            <p>Total Bookings</p>
            <div class="trend ${trends.bookings > 0 ? 'up' : 'down'}">
                ${trends.bookings > 0 ? '↗' : '↘'} ${Math.abs(trends.bookings)}% vs last month
            </div>
        </div>
        <div class="analytics-card warning">
            <h3>$${data.total_revenue.toFixed(2)}</h3>
            <p>Total Revenue</p>
            <div class="trend ${trends.revenue > 0 ? 'up' : 'down'}">
                ${trends.revenue > 0 ? '↗' : '↘'} $${Math.abs(trends.revenue)} vs last month
            </div>
        </div>
        <div class="analytics-card danger">
            <h3>${Math.floor(Math.random() * 40 + 60)}%</h3>
            <p>Occupancy Rate</p>
            <div class="trend ${trends.occupancy > 0 ? 'up' : 'down'}">
                ${trends.occupancy > 0 ? '↗' : '↘'} ${Math.abs(trends.occupancy)}% vs last month
            </div>
        </div>
    `;
    
    document.getElementById('analyticsCards').innerHTML = cardsHtml;
}

function displayCharts(data) {
    // Booking Trends Chart
    const bookingCtx = document.getElementById('bookingChart').getContext('2d');
    
    if (bookingChart) {
        bookingChart.destroy();
    }
    
    bookingChart = new Chart(bookingCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Bookings',
                data: [12, 19, 3, 17, 28, 24],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f1f5f9'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // Revenue Distribution Chart
    const revenueCtx = document.getElementById('revenueChart').getContext('2d');
    
    if (revenueChart) {
        revenueChart.destroy();
    }
    
    revenueChart = new Chart(revenueCtx, {
        type: 'doughnut',
        data: {
            labels: ['Venue Type A', 'Venue Type B', 'Venue Type C'],
            datasets: [{
                data: [40, 35, 25],
                backgroundColor: [
                    '#667eea',
                    '#f093fb',
                    '#4facfe'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function displayTopPerformers(data) {
    let performersHtml = '';
    
    if (data.top_venue) {
        performersHtml += `
            <div class="performer-item">
                <div class="performer-info">
                    <h4>🏆 Top Venue</h4>
                    <p>${data.top_venue.name}</p>
                    <span class="performer-stat">${data.top_venue.bookings} bookings</span>
                </div>
            </div>
        `;
    }
    
    if (data.top_user) {
        performersHtml += `
            <div class="performer-item">
                <div class="performer-info">
                    <h4>👑 Top User</h4>
                    <p>${data.top_user.name}</p>
                    <span class="performer-stat">${data.top_user.bookings} bookings</span>
                </div>
            </div>
        `;
    }
    
    document.getElementById('topPerformers').innerHTML = performersHtml;
}

function displayRecentActivity(data) {
    const activities = [
        'New booking for Conference Room A',
        'Venue "Grand Hall" was updated',
        'User John Doe made 3 bookings',
        'Payment received for Booking #123',
        'New venue "Sky Lounge" added'
    ];
    
    const activityHtml = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-dot"></div>
            <p>${activity}</p>
            <span class="activity-time">${Math.floor(Math.random() * 60)} min ago</span>
        </div>
    `).join('');
    
    document.getElementById('recentActivity').innerHTML = activityHtml;
}

// Helper Functions
function showModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Form Submission
async function handleVenueSubmit(e) {
    e.preventDefault();
    
    const venueData = {
        name: document.getElementById('venueName').value,
        location: document.getElementById('venueLocation').value,
        capacity: parseInt(document.getElementById('venueCapacity').value),
        price_per_day: parseFloat(document.getElementById('venuePrice').value),
        description: document.getElementById('venueDescription').value,
        amenities: document.getElementById('venueAmenities').value,
    };

    try {
        await axios.post(`${API_BASE}/venues`, venueData);
        showAlert('Venue added successfully!');
        document.getElementById('venueForm').reset();
        loadAdminData();
        loadHeaderStats();
    } catch (error) {
        showAlert(error.response?.data?.detail || 'Failed to add venue', 'error');
    }
}

// Additional CSS for analytics
const additionalStyles = `
    .status-summary {
        display: flex;
        gap: 20px;
        margin-top: 15px;
    }
    
    .status-item {
        text-align: center;
        padding: 15px;
        background: #f8fafc;
        border-radius: 8px;
        flex: 1;
    }
    
    .status-count {
        display: block;
        font-size: 1.5em;
        font-weight: 700;
        color: #667eea;
    }
    
    .status-label {
        font-size: 0.9em;
        color: #7f8c8d;
    }
    
    .performer-item {
        padding: 15px;
        background: #f8fafc;
        border-radius: 8px;
        margin-bottom: 15px;
    }
    
    .performer-info h4 {
        margin-bottom: 5px;
        color: #2c3e50;
    }
    
    .performer-info p {
        margin-bottom: 5px;
        color: #7f8c8d;
    }
    
    .performer-stat {
        font-size: 0.9em;
        color: #667eea;
        font-weight: 600;
    }
    
    .activity-item {
        display: flex;
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #f1f5f9;
        position: relative;
    }
    
    .activity-item:last-child {
        border-bottom: none;
    }
    
    .activity-dot {
        width: 8px;
        height: 8px;
        background: #667eea;
        border-radius: 50%;
        margin-right: 12px;
        flex-shrink: 0;
    }
    
    .activity-item p {
        flex: 1;
        margin: 0;
        font-size: 0.9em;
        color: #2c3e50;
    }
    
    .activity-time {
        font-size: 0.8em;
        color: #7f8c8d;
        margin-left: 10px;
    }
`;

// Add additional styles to the document
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);