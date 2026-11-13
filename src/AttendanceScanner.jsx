// src/AttendanceScanner.jsx
import React, { useRef, useState } from 'react';
import Webcam from 'react-webcam';
import { Link } from 'react-router-dom';
import { supabase } from './supabaseClient';

const AttendanceScanner = () => {
  const webcamRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [employeeName, setEmployeeName] = useState('');

  const handleClockInOut = async (type) => {
    if (!employeeName.trim()) {
      setMessage('Please enter your name first.');
      return;
    }

    setLoading(true);
    setMessage('Capturing photo...');

    try {
      // 1. Capture Image
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error('Could not capture image. Please allow camera access.');

      const blob = await fetch(imageSrc).then((res) => res.blob());

      const safeName = employeeName.trim().replace(/\s+/g, '_');
      const fileName = `${safeName}_${Date.now()}.jpeg`;

      // 2. Upload to Supabase Storage
      setMessage('Uploading photo...');
      const { error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('attendance-photos').getPublicUrl(fileName);

      // 3. Insert into Database
      setMessage('Saving record...');
      const { error: dbError } = await supabase.from('attendance_logs').insert({
        employee_id: employeeName.trim(),
        type,
        photo_url: urlData.publicUrl,
      });
      if (dbError) throw dbError;

      setMessage(`✅ Success! Clocked ${type} for ${employeeName.trim()}.`);
    } catch (error) {
      console.error(error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const msgClass = message.includes('✅') ? 'ok' : message.includes('❌') || message.includes('Please') ? 'err' : '';

  return (
    <div className="screen">
      <div className="scan-wrap">
        <header className="scan-top glass">
          <div className="brand"><span className="brand-mark">N</span>Attendance</div>
          <Link className="btn ghost" to="/login">Admin</Link>
        </header>

        <section className="scan-card glass">
          <div>
            <h2>Clock In / Out</h2>
            <p className="auth-sub" style={{ margin: '4px 0 0', textAlign: 'left' }}>Enter your name, face the camera, then tap a button.</p>
          </div>

          <label className="field">
            <span>Your name</span>
            <input
              type="text"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              placeholder="e.g. Juan Dela Cruz"
              autoComplete="name"
            />
          </label>

          <div className="cam">
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: 'user' }}
              mirrored
            />
            <span className="cam-tag">● Live camera</span>
          </div>

          <div className="scan-actions">
            <button className="btn green" onClick={() => handleClockInOut('in')} disabled={loading}>
              {loading ? 'Wait...' : 'Time In'}
            </button>
            <button className="btn red" onClick={() => handleClockInOut('out')} disabled={loading}>
              {loading ? 'Wait...' : 'Time Out'}
            </button>
          </div>

          {message && <p className={`msg ${msgClass}`}>{message}</p>}
        </section>
      </div>
    </div>
  );
};

export default AttendanceScanner;