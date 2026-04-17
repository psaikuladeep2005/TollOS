from flask import Flask, render_template, Response, jsonify, request
import cv2
import os
import json
import threading
import time
import numpy as np
from ultralytics import YOLO

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'

# Create folders
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# =============================================================================
# VEHICLE DETECTOR CLASS
# =============================================================================
class VehicleDetector:
    _instance = None
    _model = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if VehicleDetector._model is None:
            print("🚀 Loading YOLO model...")
            VehicleDetector._model = YOLO('yolov8n.pt')
            print("✅ YOLO model loaded successfully!")
        
        self.model = VehicleDetector._model
        
        # Processing times in seconds
        self.processing_times = {
            'car': 2,
            'bus': 4,
            'truck': 6
        }
        
        # COCO dataset vehicle class IDs
        self.vehicle_classes = {
            2: 'car',       # car
            3: 'car',       # motorcycle
            5: 'bus',       # bus
            7: 'truck'      # truck
        }
        
        # Colors for bounding boxes
        self.colors = {
            'car': (0, 255, 0),      # Green
            'bus': (0, 165, 255),    # Orange
            'truck': (0, 0, 255)     # Red
        }
    
    def detect(self, frame):
        """Detect vehicles in frame"""
        vehicle_counts = {'car': 0, 'bus': 0, 'truck': 0}
        
        # Run YOLO detection
        results = self.model(frame, verbose=False, conf=0.4)
        # Process each detection
        for result in results:
            boxes = result.boxes
            for box in boxes:
                class_id = int(box.cls[0])
                confidence = float(box.conf[0])
                
                if class_id in self.vehicle_classes:
                    vehicle_type = self.vehicle_classes[class_id]
                    vehicle_counts[vehicle_type] += 1
                    
                    # Draw bounding box
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    color = self.colors[vehicle_type]
                    
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    
                    # Add label
                    label = f'{vehicle_type.upper()} {confidence:.2f}'
                    (label_w, label_h), _ = cv2.getTextSize(
                        label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2
                    )
                    cv2.rectangle(frame, (x1, y1 - 20), (x1 + label_w, y1), color, -1)
                    cv2.putText(frame, label, (x1, y1 - 5),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)
        
        # Calculate waiting time
        waiting_time = (
            vehicle_counts['car'] * self.processing_times['car'] +
            vehicle_counts['bus'] * self.processing_times['bus'] +
            vehicle_counts['truck'] * self.processing_times['truck']
        )
        
        # Add info overlay
        self._add_overlay(frame, vehicle_counts, waiting_time)
        
        return frame, vehicle_counts, waiting_time
    
    def _add_overlay(self, frame, vehicle_counts, waiting_time):
        """Add information overlay to frame"""
        overlay = frame.copy()
        cv2.rectangle(overlay, (10, 10), (250, 150), (0, 0, 0), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)
        
        y = 35
        cv2.putText(frame, f'Cars: {vehicle_counts["car"]}', (20, y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        y += 30
        cv2.putText(frame, f'Buses: {vehicle_counts["bus"]}', (20, y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)
        y += 30
        cv2.putText(frame, f'Trucks: {vehicle_counts["truck"]}', (20, y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        y += 35
        cv2.putText(frame, f'Wait: {waiting_time}s', (20, y),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)


# =============================================================================
# LANE MANAGER CLASS
# =============================================================================
class LaneManager:
    def __init__(self):
        self.lanes = {}
        self.lock = threading.Lock()
        self.load_data()
    
    def load_data(self):
        """Load saved lane data"""
        if os.path.exists('lanes.json'):
            try:
                with open('lanes.json', 'r') as f:
                    saved = json.load(f)
                    for lane_id, data in saved.items():
                        self.lanes[lane_id] = {
                            'video_path': data.get('video_path'),
                            'vehicles': {'car': 0, 'bus': 0, 'truck': 0},
                            'waiting_time': 0,
                            'video_ended': False,
                            'active': False
                        }
            except Exception as e:
                print(f"Error loading lanes: {e}")
                self.lanes = {}
    
    def save_data(self):
        """Save lane configuration"""
        with open('lanes.json', 'w') as f:
            save_data = {}
            for lane_id, data in self.lanes.items():
                save_data[lane_id] = {'video_path': data.get('video_path')}
            json.dump(save_data, f)
    
    def add_lane(self):
        """Add new lane"""
        with self.lock:
            lane_num = len(self.lanes) + 1
            lane_id = f'Lane_{lane_num}'
            
            while lane_id in self.lanes:
                lane_num += 1
                lane_id = f'Lane_{lane_num}'
            
            self.lanes[lane_id] = {
                'video_path': None,
                'vehicles': {'car': 0, 'bus': 0, 'truck': 0},
                'waiting_time': 0,
                'video_ended': False,
                'active': False
            }
            self.save_data()
            return lane_id
    
    def delete_lane(self, lane_id):
        """Delete lane"""
        with self.lock:
            if lane_id in self.lanes:
                video_path = self.lanes[lane_id].get('video_path')
                if video_path and os.path.exists(video_path):
                    try:
                        os.remove(video_path)
                    except:
                        pass
                
                del self.lanes[lane_id]
                self.save_data()
                return True
            return False
    
    def update_lane(self, lane_id, vehicles, waiting_time, video_ended=False):
        """Update lane data"""
        with self.lock:
            if lane_id in self.lanes:
                self.lanes[lane_id]['vehicles'] = vehicles
                self.lanes[lane_id]['waiting_time'] = waiting_time
                self.lanes[lane_id]['video_ended'] = video_ended
    
    def set_video(self, lane_id, video_path):
        """Set video for lane"""
        with self.lock:
            if lane_id in self.lanes:
                self.lanes[lane_id]['video_path'] = video_path
                self.lanes[lane_id]['video_ended'] = False
                self.lanes[lane_id]['active'] = False
                self.save_data()
                return True
            return False
    
    def set_active(self, lane_id, active):
        """Set lane active status"""
        with self.lock:
            if lane_id in self.lanes:
                self.lanes[lane_id]['active'] = active
    
    def get_all(self):
        """Get all lanes data"""
        with self.lock:
            result = {}
            for lane_id, data in self.lanes.items():
                result[lane_id] = {
                    'video_path': data.get('video_path'),
                    'vehicles': data.get('vehicles', {'car': 0, 'bus': 0, 'truck': 0}),
                    'waiting_time': data.get('waiting_time', 0),
                    'video_ended': data.get('video_ended', False),
                    'active': data.get('active', False)
                }
            return result
    
    def get_best_lane(self):
        """Get lane with minimum waiting time"""
        with self.lock:
            active = {k: v for k, v in self.lanes.items() 
                     if v.get('active') and not v.get('video_ended')}
            
            if not active:
                return None, 0
            
            best = min(active, key=lambda x: active[x]['waiting_time'])
            return best, active[best]['waiting_time']


# =============================================================================
# VIDEO PROCESSING THREAD
# =============================================================================
class VideoThread(threading.Thread):
    def __init__(self, lane_id, video_path, detector, lane_manager):
        super().__init__(daemon=True)
        self.lane_id = lane_id
        self.video_path = video_path
        self.detector = detector
        self.lane_manager = lane_manager
        self.running = True
        self.current_frame = None
        self.lock = threading.Lock()
    
    def run(self):
        """Process video"""
        cap = cv2.VideoCapture(self.video_path)
        
        if not cap.isOpened():
            print(f"❌ Cannot open: {self.video_path}")
            return
        
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        delay = 1.0 / fps
        
        self.lane_manager.set_active(self.lane_id, True)
        print(f"▶️  Processing {self.lane_id}")
        
        while self.running:
            ret, frame = cap.read()
            
            if not ret:
                print(f"⏹️  {self.lane_id} video ended")
                self.lane_manager.update_lane(
                    self.lane_id,
                    {'car': 0, 'bus': 0, 'truck': 0},
                    0,
                    video_ended=True
                )
                self.lane_manager.set_active(self.lane_id, False)
                
                # Create ended frame
                end_frame = self._create_end_frame()
                with self.lock:
                    self.current_frame = end_frame
                
                break
            
            # Resize
            frame = cv2.resize(frame, (640, 480))
            
            # Detect vehicles
            annotated, vehicles, wait_time = self.detector.detect(frame)
            
            # Update data
            self.lane_manager.update_lane(self.lane_id, vehicles, wait_time)
            
            # Store frame
            with self.lock:
                self.current_frame = annotated.copy()
            
            time.sleep(delay)
        
        cap.release()
        print(f"🛑 Stopped {self.lane_id}")
    
    def _create_end_frame(self):
        """Create video ended frame"""
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.putText(frame, 'VIDEO ENDED', (180, 220),
                   cv2.FONT_HERSHEY_BOLD, 1.5, (100, 100, 100), 3)
        cv2.putText(frame, 'Waiting Time: 0s', (200, 280),
                   cv2.FONT_HERSHEY_SIMPLEX, 0.8, (100, 100, 100), 2)
        return frame
    
    def get_frame(self):
        """Get current frame"""
        with self.lock:
            if self.current_frame is not None:
                return self.current_frame.copy()
            return None
    
    def stop(self):
        """Stop processing"""
        self.running = False


# =============================================================================
# GLOBAL INSTANCES
# =============================================================================
lane_manager = LaneManager()
detector = None
video_threads = {}

def get_detector():
    """Get or create detector instance"""
    global detector
    if detector is None:
        detector = VehicleDetector()
    return detector


# =============================================================================
# VIDEO STREAMING GENERATOR
# =============================================================================
def generate_frames(lane_id):
    """Generate video frames for streaming"""
    while True:
        frame = None
        
        # Get frame from video thread
        if lane_id in video_threads:
            thread = video_threads[lane_id]
            frame = thread.get_frame()
        
        if frame is None:
            # No video - show placeholder
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(frame, 'No Video Uploaded', (170, 220),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (100, 100, 100), 2)
            cv2.putText(frame, 'Click "Upload Video"', (180, 270),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (80, 80, 80), 2)
        
        # Encode frame
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        time.sleep(0.033)  # ~30 FPS


# =============================================================================
# ROUTES
# =============================================================================
@app.route('/')
def index():
    """Main dashboard"""
    return render_template('index.html')


@app.route('/video_feed/<lane_id>')
def video_feed(lane_id):
    """Video stream for specific lane"""
    return Response(
        generate_frames(lane_id),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/api/data')
def get_data():
    """Get all lane data"""
    lanes = lane_manager.get_all()
    best_lane, best_time = lane_manager.get_best_lane()
    
    return jsonify({
        'lanes': lanes,
        'best_lane': best_lane,
        'best_time': best_time,
        'total_lanes': len(lanes)
    })


@app.route('/api/add_lane', methods=['POST'])
def add_lane():
    """Add new lane"""
    lane_id = lane_manager.add_lane()
    return jsonify({
        'success': True,
        'lane_id': lane_id,
        'message': f'{lane_id} added successfully!'
    })


@app.route('/api/delete_lane/<lane_id>', methods=['DELETE'])
def delete_lane(lane_id):
    """Delete lane"""
    # Stop video thread
    if lane_id in video_threads:
        video_threads[lane_id].stop()
        time.sleep(0.5)
        del video_threads[lane_id]
    
    if lane_manager.delete_lane(lane_id):
        return jsonify({
            'success': True,
            'message': f'{lane_id} deleted!'
        })
    
    return jsonify({'success': False, 'message': 'Lane not found'}), 404


@app.route('/api/upload/<lane_id>', methods=['POST'])
def upload_video(lane_id):
    """Upload video for lane"""
    if 'video' not in request.files:
        return jsonify({'success': False, 'message': 'No video file'}), 400
    
    file = request.files['video']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No file selected'}), 400
    
    # Save video
    filename = f'{lane_id}.mp4'
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # Update lane
    lane_manager.set_video(lane_id, filepath)
    
    # Stop existing thread
    if lane_id in video_threads:
        video_threads[lane_id].stop()
        time.sleep(0.5)
    
    # Start new thread
    det = get_detector()
    thread = VideoThread(lane_id, filepath, det, lane_manager)
    video_threads[lane_id] = thread
    thread.start()
    
    return jsonify({
        'success': True,
        'message': f'Video uploaded for {lane_id}!'
    })


@app.route('/api/start_all', methods=['POST'])
def start_all():
    """Start all videos"""
    lanes = lane_manager.get_all()
    started = 0
    det = get_detector()
    
    for lane_id, data in lanes.items():
        video_path = data.get('video_path')
        if video_path and os.path.exists(video_path):
            # Stop existing
            if lane_id in video_threads:
                video_threads[lane_id].stop()
                time.sleep(0.3)
            
            # Reset lane data
            lane_manager.update_lane(lane_id, {'car': 0, 'bus': 0, 'truck': 0}, 0, False)
            
            # Start new
            thread = VideoThread(lane_id, video_path, det, lane_manager)
            video_threads[lane_id] = thread
            thread.start()
            started += 1
    
    return jsonify({
        'success': True,
        'message': f'Started {started} videos!'
    })


@app.route('/api/stop_all', methods=['POST'])
def stop_all():
    """Stop all videos"""
    for lane_id in list(video_threads.keys()):
        video_threads[lane_id].stop()
    
    time.sleep(0.5)
    video_threads.clear()
    
    # Reset all lane data
    for lane_id in lane_manager.lanes:
        lane_manager.update_lane(lane_id, {'car': 0, 'bus': 0, 'truck': 0}, 0, False)
        lane_manager.set_active(lane_id, False)
    
    return jsonify({
        'success': True,
        'message': 'All videos stopped!'
    })
@app.route('/api/statistics')
def get_statistics():
    """Get overall statistics"""
    lanes = lane_manager.get_all()
    
    total_vehicles = {'car': 0, 'bus': 0, 'truck': 0}
    total_waiting = 0
    active_lanes = 0
    
    for lane_data in lanes.values():
        if lane_data.get('active'):
            active_lanes += 1
            for vehicle_type in total_vehicles:
                total_vehicles[vehicle_type] += lane_data['vehicles'].get(vehicle_type, 0)
            total_waiting += lane_data.get('waiting_time', 0)
    
    return jsonify({
        'total_vehicles': total_vehicles,
        'total_waiting_time': total_waiting,
        'active_lanes': active_lanes,
        'avg_waiting_time': total_waiting / active_lanes if active_lanes > 0 else 0
    })

# =============================================================================
# MAIN
# =============================================================================
if __name__ == '__main__':
    print('=' * 60)
    print('🚗 TOLL GATE LANE OPTIMIZER')
    print('=' * 60)
    print('📌 Open browser: http://localhost:5000')
    print('=' * 60)
    
    # Pre-load detector
    get_detector()
    port = int(os.environ.get("PORT",5000))
    app.run(debug=False, host='0.0.0.0', port=port, threaded=True)
