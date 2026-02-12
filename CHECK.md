# If connection failed

1. ./stop
2. cat .run/backend.log
3. cat .run/frontend.log
4. Install backend: cd backend && python3 -m venv venv && source venv/bin/activate && pip install fastapi uvicorn
5. ./start
