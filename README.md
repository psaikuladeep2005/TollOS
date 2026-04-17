# 🚦 TollOS – Smart Toll Lane Optimization System

TollOS is a web-based traffic management system that helps optimize vehicle flow at toll plazas by calculating and displaying the estimated waiting time for each lane.

The system analyzes vehicle traffic in individual lanes and determines which lane has the minimum waiting time, allowing users to make smarter decisions and reduce congestion.

---

## 📌 Problem Statement

At toll plazas, vehicles often select lanes randomly, which leads to uneven distribution of traffic, increased waiting times, and congestion.

TollOS addresses this problem by:

* Monitoring traffic in each lane separately
* Calculating waiting time for every lane
* Displaying results on a dashboard
* Identifying the most efficient lane

---

## ⚙️ Tech Stack

* **Backend:** Python (Flask)
* **Frontend:** HTML, CSS, JavaScript
* **Architecture:** Web-based dashboard application

---

## ✨ Features

* 🚗 Lane-wise vehicle traffic analysis
* ⏱️ Waiting time calculation for each lane
* 📊 Dashboard to display real-time lane status
* ✅ Identification of the best lane (minimum waiting time)
* 🌐 Simple and lightweight web interface

---

## 📁 Project Structure

```
TollOS/
│
├── static/              # CSS, JavaScript, and assets
├── templates/           # HTML templates
├── app.py               # Main Flask application
├── requirements.txt     # Python dependencies
└── README.md
```

---

## 🚀 Installation & Setup

Follow these steps to run the project locally:

### 1. Clone the Repository

```bash
git clone https://github.com/psaikuladeep2005/TollOS.git
cd TollOS
```

### 2. Create a Virtual Environment

```bash
python -m venv venv
```

### 3. Activate the Virtual Environment

* **Windows:**

```bash
venv\Scripts\activate
```

* **Linux / Mac:**

```bash
source venv/bin/activate
```

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

### 5. Run the Application

```bash
python app.py
```

### 6. Open in Browser

```
http://127.0.0.1:5000/
```

---
---

## 📈 Future Improvements

* Integration with real-time traffic sensors
* Machine Learning-based prediction of traffic flow
* Mobile application support
* Automated lane recommendation system
* Camera-based vehicle detection

---

## 👨‍💻 Author

**Sai Kuladeep P**
GitHub: https://github.com/psaikuladeep2005

---

## 📜 License

This project is developed as a **mini project** for academic purposes.

