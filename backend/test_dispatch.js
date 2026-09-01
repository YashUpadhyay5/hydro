const axios = require('axios');

async function testDispatch() {
  try {
    console.log('Logging in...');
    const loginRes = await axios.post('http://127.0.0.1:8000/api/auth/login', {
      email: 'admin@hrms.com',
      password: 'password123'
    });
    
    const token = loginRes.data.token;
    console.log('Logged in successfully. Token length:', token.length);

    console.log('Dispatching payslips...');
    const dispatchRes = await axios.post('http://127.0.0.1:8000/api/payroll/dispatch-payslips', {
      month: '2026-07'
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Success:', dispatchRes.data);
  } catch (err) {
    if (err.response) {
      console.error('Error Response:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
  }
}

testDispatch();
