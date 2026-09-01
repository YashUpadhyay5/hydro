module.exports = {
  apps: [
    {
      name: 'hydro-express-backend',
      script: 'src/server.js',
      cwd: 'C:/Users/Falcon/Desktop/hydro-copy/Hydro/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      }
    },
    {
      name: 'hydro-invoice-backend',
      script: 'venv/Scripts/python.exe',
      args: '-m uvicorn app:app --port 8080',
      cwd: 'C:/Users/Falcon/Desktop/hydro-copy/Hydro/backend/src/modules/invoice'
    },
    {
      name: 'hydro-frontend',
      script: 'node_modules/vite/bin/vite.js',
      cwd: 'C:/Users/Falcon/Desktop/hydro-copy/Hydro/frontend',
      args: 'preview --host 0.0.0.0 --port 5173'
    }
  ]
};
