# 🚦 TollOS – Smart Toll Lane Optimization System

TollOS is a smart traffic management system designed to optimize vehicle flow at toll plazas by calculating and displaying the estimated waiting time for each lane in real time.

The system helps drivers choose the most efficient lane, reducing congestion and improving overall traffic flow.

---

## 📌 Problem Statement

At toll plazas, vehicles often choose lanes randomly, leading to uneven congestion and increased waiting times.

TollOS solves this by:
- Calculating lane-wise waiting times based on traffic
- Displaying the data on a dashboard
- Helping users identify the fastest lane

---

## ⚙️ Tech Stack

- **Backend:** Python (Flask)
- **Frontend:** HTML, CSS, JavaScript
- **Architecture:** Web-based dashboard system

---

## ✨ Features

- 🚗 Lane-wise vehicle tracking
- ⏱️ Waiting time calculation for each lane
- 📊 Interactive dashboard display
- ✅ Identifies the best (minimum waiting time) lane
- 🌐 Lightweight web application

---

## 📁 Project Structure
TollOS/
│
├── static/ # CSS, JS, assets
├── templates/ # HTML files
├── app.py # Main Flask application
├── requirements.txt # Dependencies
└── README.md


---

## 🚀 Installation & Setup

Follow these steps to run the project locally:

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/psaikuladeep2005/TollOS.git
cd TollOS
2️⃣ Create Virtual Environment
python -m venv venv
3️⃣ Activate Virtual Environment
Windows:
venv\Scripts\activate
Linux/Mac:
source venv/bin/activate
4️⃣ Install Dependencies
pip install -r requirements.txt
5️⃣ Run the Application
python app.py
6️⃣ Open in Browser
http://127.0.0.1:5000/
