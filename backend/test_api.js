
const fetch = require('node-fetch');

async function testApi() {
    try {
        const response = await fetch("http://localhost:3000/api/reports/detailed-monthly?startDate=2024-01-01T00:00:00.000Z&endDate=2024-12-31T23:59:59.999Z");
        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error(err);
    }
}

testApi();
