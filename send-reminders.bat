@echo off
REM change this to your project folder if needed
cd /d C:\Kar_Materials\hospital

REM call the API for next 24 hours
curl -X POST http://localhost:3000/api/admin/send-upcoming-reminders

REM (optional) if you added the 7‑day mode:
REM curl -X POST http://localhost:3000/api/admin/send-upcoming-reminders?mode=7d
